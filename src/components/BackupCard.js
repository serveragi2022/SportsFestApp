import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Alert } from '../dialog';
import { useStore } from '../store';
import { backupFileName, buildBackup, parseBackup } from '../backup';
import { pickBackupFile, saveBackupFile } from '../backupIO';
import { Button, Card } from './ui';
import { colors, radius } from '../theme';

// Admin > Backup and restore.
export default function BackupCard() {
  const { state, restoreBackup, pending } = useStore();
  const [message, setMessage] = useState(null); // { text, error? }
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState('');

  const doBackup = async () => {
    try {
      const now = new Date();
      const how = await saveBackupFile(buildBackup(state, now), backupFileName(now));
      setMessage({ text: how === 'downloaded' ? 'Backup downloaded. Keep the file somewhere safe.' : 'Backup ready. Save or send it from the share sheet.' });
    } catch (e) {
      setMessage({ text: e && e.message ? e.message : 'Cannot make the backup.', error: true });
    }
  };

  const askRestore = (text) => {
    const r = parseBackup(text);
    if (!r.ok) {
      setMessage({ text: r.error, error: true });
      return;
    }
    const when = r.createdAt ? new Date(r.createdAt).toLocaleString() : 'unknown date';
    const sm = r.summary;
    Alert.alert(
      'Restore this backup?',
      `Backup made: ${when}\n${sm.teamNames} team names, ${sm.results} results, ${sm.committeeNames} committee names, ${sm.times} match times.\n\nThis REPLACES all the current data (results, team names, committee, times). Make a backup of the current data first if you are not sure.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            const ok = restoreBackup(r.data);
            setPasteOpen(false);
            setPasted('');
            setMessage(ok ? { text: 'Backup restored.' } : { text: 'Only the admin can restore a backup.', error: true });
          },
        },
      ]
    );
  };

  const chooseFile = async () => {
    try {
      const text = await pickBackupFile();
      if (text != null) askRestore(text);
    } catch (e) {
      setMessage({ text: e && e.message ? e.message : 'Cannot read the file.', error: true });
    }
  };

  return (
    <Card>
      <Text style={styles.note}>
        Backup saves everything in one file: team names, teams of each game, winners and points, committee names, match times and Cheer Dance / Mr & Ms Team Ambassador places. Login accounts are not included.
      </Text>
      <View style={{ gap: 10, marginTop: 12 }}>
        <Button title={Platform.OS === 'web' ? 'Download backup' : 'Share / save backup'} icon="download-outline" onPress={doBackup} />
        {Platform.OS === 'web' ? <Button title="Restore from file…" icon="cloud-upload-outline" kind="ghost" onPress={chooseFile} /> : null}
        <Button title="Restore from pasted text…" icon="clipboard-outline" kind="ghost" onPress={() => setPasteOpen(true)} />
      </View>
      {pending ? <Text style={[styles.note, { color: colors.warn, marginTop: 10 }]}>{pending} change(s) are still waiting to be sent to the server. Wait for them before you restore.</Text> : null}
      {message ? <Text style={[styles.msg, message.error ? { color: colors.danger } : { color: colors.success }]}>{message.text}</Text> : null}

      <Modal visible={pasteOpen} transparent animationType="fade" onRequestClose={() => setPasteOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPasteOpen(false)} />
        <View style={styles.wrap} pointerEvents="box-none">
          <View style={styles.dialog}>
            <Text style={styles.title}>Restore from pasted text</Text>
            <Text style={[styles.note, { marginTop: 4 }]}>Paste the full text of a backup file.</Text>
            <TextInput value={pasted} onChangeText={setPasted} multiline placeholder='{"app":"sportsfest", ...}' placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} style={styles.box} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Button title="Cancel" kind="ghost" onPress={() => setPasteOpen(false)} style={{ flex: 1 }} />
              <Button title="Check backup" onPress={() => askRestore(pasted)} disabled={!pasted.trim()} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  note: { color: colors.muted, lineHeight: 19, fontSize: 13 },
  msg: { marginTop: 12, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.5)' },
  wrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 18, maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  box: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 13, marginTop: 12, color: colors.text, height: 180, textAlignVertical: 'top' },
});
