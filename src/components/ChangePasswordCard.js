import React, { useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { useStore } from '../store';
import { Button, Card } from './ui';
import { colors, radius } from '../theme';

// "Change my password" for a signed-in committee or admin account. Asks for the current password first.
export default function ChangePasswordCard() {
  const { changePassword, mode, session } = useStore();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { text, error? }

  if (mode !== 'cloud' || !session) return null;

  const problem = !current ? 'Enter your current password.' : next.length < 8 ? 'The new password needs at least 8 characters.' : next !== again ? 'The two new passwords are not the same.' : null;

  const close = () => {
    setOpen(false);
    setCurrent('');
    setNext('');
    setAgain('');
  };

  const submit = async () => {
    if (problem) {
      setMessage({ text: problem, error: true });
      return;
    }
    setBusy(true);
    setMessage(null);
    const err = await changePassword(current, next);
    setBusy(false);
    if (err) {
      setMessage({ text: err, error: true });
      return;
    }
    close();
    setMessage({ text: 'Your password was changed. Use the new one the next time you sign in.' });
  };

  return (
    <Card style={{ marginTop: 14 }}>
      <Text style={styles.title}>My password</Text>
      {!open ? (
        <>
          <Text style={styles.note}>Change the password you use to sign in.</Text>
          <Button title="Change my password" icon="key-outline" kind="ghost" small onPress={() => { setOpen(true); setMessage(null); }} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
        </>
      ) : (
        <>
          <TextInput value={current} onChangeText={setCurrent} placeholder="Current password" placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={styles.input} />
          <TextInput value={next} onChangeText={setNext} placeholder="New password (at least 8 characters)" placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={styles.input} />
          <TextInput value={again} onChangeText={setAgain} placeholder="New password again" placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={styles.input} onSubmitEditing={submit} returnKeyType="done" />
          <Button title={busy ? 'Saving…' : 'Save new password'} icon="checkmark" onPress={submit} disabled={busy} style={{ marginTop: 14 }} />
          <Button title="Cancel" kind="ghost" small onPress={close} disabled={busy} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
        </>
      )}
      {message ? <Text style={[styles.msg, message.error ? { color: colors.danger } : { color: colors.success }]}>{message.text}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  note: { color: colors.muted, lineHeight: 19, fontSize: 13, marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginTop: 10, color: colors.text, backgroundColor: '#fff' },
  msg: { marginTop: 12, fontWeight: '700', fontSize: 13, lineHeight: 18 },
});
