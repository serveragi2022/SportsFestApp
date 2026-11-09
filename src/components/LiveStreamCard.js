import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../store';
import { Button, Card } from './ui';
import { colors, radius } from '../theme';
import { fetchStream, loadPassword, newStreamId, pushUrl, savePassword, startStream, stopStream, viewUrl, watchStream } from '../streams';

// Live tab of a game screen.
//  - Viewers (anyone): see "LIVE", type the stream password once, watch.
//  - Committee assigned to the game, or an admin: "Go live" (opens the camera page on this phone) and "End stream". One streamer per game.
//  - Admin can also end a stream someone else started (e.g. their phone died).
export default function LiveStreamCard({ gameId }) {
  const { access, session, offline } = useStore();
  // a COMMITTEE account assigned to this game, or an admin, can stream it (the database checks this too)
  const isAdmin = access.role === 'admin';
  const canStream = isAdmin || (access.role === 'committee' && (access.games || []).includes(gameId));
  const myId = session && session.user ? session.user.id : null;
  const [row, setRow] = useState(null);
  const [pw, setPw] = useState('');
  const [watching, setWatching] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRow(await fetchStream(gameId));
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  }, [gameId]);

  useEffect(() => {
    load();
    loadPassword(gameId).then(setPw);
    return watchStream(gameId, load);
  }, [gameId, load]);

  const live = !!(row && row.live);
  const iAmStreamer = live && !!myId && row.streamer_id === myId;
  const someoneElse = live && !iAmStreamer;

  const goLive = async () => {
    if (pw.trim().length < 4) return setErr('Set a stream password (at least 4 characters) first.');
    setBusy(true);
    try {
      const id = (row && row.stream_id) || newStreamId(gameId);
      await startStream(gameId, id);
      await savePassword(gameId, pw.trim());
      await load();
      setErr('');
      // opens VDO.Ninja's camera page. Do the filming from that page (browser tab), keep it open while streaming.
      Linking.openURL(pushUrl(id, pw.trim()));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const endStream = async () => {
    setBusy(true);
    try {
      await stopStream(gameId);
      await load();
      setWatching(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const watch = async () => {
    await savePassword(gameId, pw.trim());
    setWatching(true);
  };

  return (
    <View>
      <Card style={{ marginBottom: 12 }}>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: live ? '#DC2626' : colors.muted }]} />
          <Text style={styles.title}>{live ? 'LIVE now' : 'Not live'}</Text>
        </View>
        {!live ? <Text style={styles.muted}>No live stream for this game right now. This page updates by itself when it starts.</Text> : null}
        {err ? <Text style={styles.err}>{err}</Text> : null}
      </Card>

      {canStream && !someoneElse ? (
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.title}>Stream this game</Text>
          <Text style={styles.muted}>Set a password and share it only with the people who should watch.</Text>
          <TextInput value={pw} onChangeText={setPw} placeholder="Stream password" autoCapitalize="none" autoCorrect={false} style={styles.input} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            {!live ? <Button title="Go live" icon="videocam" kind="danger" onPress={goLive} disabled={busy || !!offline} /> : null}
            {iAmStreamer ? <Button title="Open camera again" icon="videocam" kind="primary" small onPress={() => Linking.openURL(pushUrl(row.stream_id, pw.trim()))} /> : null}
            {iAmStreamer ? <Button title="End stream" icon="stop" kind="accent" small onPress={endStream} disabled={busy} /> : null}
          </View>
        </Card>
      ) : null}

      {canStream && someoneElse ? (
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.muted}>
            {row.streamer_name || 'Another committee member'} is already streaming this game.
            {isAdmin ? ' If there is a problem (for example their phone died), you can end it.' : ' You can stream again after they end it.'}
          </Text>
          {isAdmin ? (
            <View style={{ marginTop: 10 }}>
              <Button title="End stream" icon="stop" kind="danger" small onPress={endStream} disabled={busy} />
            </View>
          ) : null}
        </Card>
      ) : null}

      {live ? (
        <Card>
          <Text style={styles.title}>Watch</Text>
          {!watching ? (
            <>
              <Text style={styles.muted}>Enter the stream password.</Text>
              <TextInput value={pw} onChangeText={setPw} placeholder="Stream password" autoCapitalize="none" autoCorrect={false} style={styles.input} />
              <View style={{ marginTop: 10 }}>
                <Button title="Watch" icon="play" onPress={watch} disabled={!pw.trim()} />
              </View>
            </>
          ) : (
            <>
              <Player url={viewUrl(row.stream_id, pw.trim())} />
              <Text style={styles.muted}>Black screen or it keeps loading? The password may be wrong, or the camera has not started yet.</Text>
              <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
                <Button title="Change password" small kind="accent" onPress={() => setWatching(false)} />
                <Button title="Open in browser" small onPress={() => Linking.openURL(viewUrl(row.stream_id, pw.trim()))} />
              </View>
            </>
          )}
        </Card>
      ) : null}
    </View>
  );
}

// Web (the PWA): embedded player. Phone app builds: opens the browser (no extra package needed).
// To embed inside the native app later: npx expo install react-native-webview and render <WebView source={{ uri: url }} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} />
function Player({ url }) {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.frame}>
        {React.createElement('iframe', {
          src: url,
          allow: 'autoplay; fullscreen; picture-in-picture',
          allowFullScreen: true,
          style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 },
          title: 'Live stream',
        })}
      </View>
    );
  }
  return <Button title="Open the live stream" icon="play" onPress={() => Linking.openURL(url)} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  title: { fontWeight: '800', fontSize: 16, color: colors.text },
  muted: { color: colors.muted, marginTop: 6 },
  err: { color: colors.warn, marginTop: 8, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10, color: colors.text, backgroundColor: '#fff' },
  frame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 10, overflow: 'hidden', marginTop: 10 },
});
