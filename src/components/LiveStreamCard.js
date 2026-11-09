import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../store';
import { Button, Card } from './ui';
import { colors, radius } from '../theme';
import { fetchStream, loadPassword, newStreamId, pushUrl, savePassword, startStream, stopStream, viewUrl, watchStream } from '../streams';

// true  = the camera page is shown inside this screen (web). Needs the site's camera permission to be allowed in the browser.
// false = "Go live" opens the camera page in its own tab (most reliable, also on iPhone). Viewers still watch inside the app.
const CAMERA_IN_PAGE = true;

// Live tab of a game screen. Everything happens inside the site (no leaving the app) on the web / PWA.
//  - Viewers (anyone): see "LIVE", type the stream password once, watch.
//  - Committee assigned to the game, or an admin: "Go live" shows the camera right here and starts streaming. One streamer per game.
//  - Admin can also end a stream someone else started (e.g. their phone died).
export default function LiveStreamCard({ gameId }) {
  const { access, session, offline } = useStore();
  const isAdmin = access.role === 'admin';
  const canStream = isAdmin || (access.role === 'committee' && (access.games || []).includes(gameId));
  const myId = session && session.user ? session.user.id : null;
  const [row, setRow] = useState(null);
  const [pw, setPw] = useState('');
  const [watching, setWatching] = useState(false);
  const [camOn, setCamOn] = useState(false); // the camera page is open inside this screen
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

  // open the camera: inside the page on web, in the browser on the phone app
  const openCamera = (id) => {
    if (Platform.OS === 'web' && CAMERA_IN_PAGE) setCamOn(true);
    else Linking.openURL(pushUrl(id, pw.trim()));
  };

  const goLive = async () => {
    if (pw.trim().length < 4) return setErr('Set a stream password (at least 4 characters) first.');
    setBusy(true);
    try {
      const id = (row && row.stream_id) || newStreamId(gameId);
      await startStream(gameId, id);
      await savePassword(gameId, pw.trim());
      await load();
      setErr('');
      openCamera(id);
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
      setCamOn(false);
      setWatching(false);
      await load();
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
          <Text style={styles.title}>{iAmStreamer ? 'You are streaming' : 'Stream this game'}</Text>
          {!iAmStreamer ? <Text style={styles.muted}>Set a password and share it only with the people who should watch.</Text> : null}
          {!iAmStreamer ? (
            <TextInput value={pw} onChangeText={setPw} placeholder="Stream password" autoCapitalize="none" autoCorrect={false} style={styles.input} />
          ) : null}

          {iAmStreamer && !camOn ? <Text style={styles.muted}>The camera opens in its own tab. Keep that tab open while streaming, then come back here and press End stream when the game is done.</Text> : null}

          {iAmStreamer && camOn && Platform.OS === 'web' ? (
            <>
              <Frame url={pushUrl(row.stream_id, pw.trim())} camera />
              <Text style={styles.muted}>Camera not starting here? Press Open in new tab. Keep this screen open while streaming. Press End stream when the game is done.</Text>
            </>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {!live ? <Button title="Go live" icon="videocam" kind="danger" onPress={goLive} disabled={busy || !!offline} /> : null}
            {iAmStreamer && !camOn ? <Button title="Open camera" icon="videocam" kind="primary" small onPress={() => openCamera(row.stream_id)} /> : null}
            {iAmStreamer && camOn ? <Button title="Open in new tab" kind="primary" small onPress={() => Linking.openURL(pushUrl(row.stream_id, pw.trim()))} /> : null}
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

      {live && !iAmStreamer ? (
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
              <Frame url={viewUrl(row.stream_id, pw.trim())} />
              <Text style={styles.muted}>Black screen? Tap the video once to start it. If it stays black, the password may be wrong or the camera has not started yet.</Text>
              <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button title="Change password" small kind="accent" onPress={() => setWatching(false)} />
                <Button title="Open in new tab" small onPress={() => Linking.openURL(viewUrl(row.stream_id, pw.trim()))} />
              </View>
            </>
          )}
        </Card>
      ) : null}
    </View>
  );
}

// Web (the PWA): the VDO.Ninja page is shown inside this screen. Phone app builds: opens the browser (no extra package needed).
// To embed inside the native app later: npx expo install react-native-webview and render <WebView source={{ uri: url }} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} />
function Frame({ url, camera }) {
  if (Platform.OS !== 'web') return <Button title="Open" icon="play" onPress={() => Linking.openURL(url)} />;
  return (
    <View style={styles.frame}>
      {React.createElement('iframe', {
        src: url,
        allow: camera ? 'camera; microphone; autoplay; fullscreen; display-capture' : 'autoplay; fullscreen; picture-in-picture',
        allowFullScreen: true,
        style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 },
        title: camera ? 'Camera' : 'Live stream',
      })}
    </View>
  );
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