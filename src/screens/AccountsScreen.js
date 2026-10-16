import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GAMES, GAME_BY_ID } from '../data/games';
import { useStore } from '../store';
import { cleanUsername, USERNAME_RULE } from '../permissions';
import { Button, Card, Chip, Segmented } from '../components/ui';
import { colors, radius, shadow } from '../theme';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
const makePassword = () => Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const gameLabel = (id) => (GAME_BY_ID[id] ? `${GAME_BY_ID[id].icon} ${GAME_BY_ID[id].short || GAME_BY_ID[id].name}` : id);

// Bottom/center dialog shell
function Dialog({ visible, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap} pointerEvents="box-none">
        <View style={styles.dialog}>{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Tick the games a committee account may score.
function GameChecklist({ value, onChange }) {
  const all = value.length === GAMES.length;
  const toggle = (id) => onChange(value.includes(id) ? value.filter((g) => g !== id) : [...value, id]);
  return (
    <View>
      <View style={styles.checkHead}>
        <Text style={styles.label}>Games ({value.length} of {GAMES.length})</Text>
        <Pressable onPress={() => onChange(all ? [] : GAMES.map((g) => g.id))} hitSlop={8}>
          <Text style={styles.link}>{all ? 'Clear all' : 'Select all'}</Text>
        </Pressable>
      </View>
      {GAMES.map((g) => {
        const on = value.includes(g.id);
        return (
          <Pressable key={g.id} onPress={() => toggle(g.id)} style={[styles.checkRow, on && styles.checkRowOn]}>
            <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.muted} />
            <Text style={styles.checkText}>
              {g.icon}  {g.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function NewAccountDialog({ visible, onClose, onCreated, api }) {
  const empty = { fullName: '', username: '', password: makePassword(), role: 'committee', games: [] };
  const [f, setF] = useState(empty);
  const [show, setShow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null); // { username, password }

  useEffect(() => {
    if (visible) {
      setF({ fullName: '', username: '', password: makePassword(), role: 'committee', games: [] });
      setError(null);
      setDone(null);
      setShow(true);
    }
  }, [visible]);

  const username = cleanUsername(f.username);
  const problem = !f.fullName.trim()
    ? 'Enter the name of the person.'
    : !USERNAME_RULE.test(username)
    ? 'Username: 3-30 characters, letters, numbers, dot, dash or underscore (no spaces).'
    : f.password.length < 6
    ? 'The password needs at least 6 characters.'
    : null;

  const submit = async () => {
    if (problem || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.createStaff({ username, password: f.password, fullName: f.fullName.trim(), role: f.role, gameIds: f.role === 'committee' ? f.games : [] });
      setDone({ username, password: f.password });
      onCreated();
    } catch (e) {
      setError(e.message || 'Could not create the account.');
    }
    setBusy(false);
  };

  if (done) {
    return (
      <Dialog visible={visible} onClose={onClose}>
        <Text style={styles.title}>Account created ✅</Text>
        <Text style={styles.note}>Give these login details to the person. The password is not shown again.</Text>
        <View style={styles.credBox}>
          <Text style={styles.credLabel}>Username</Text>
          <Text style={styles.credValue} selectable>{done.username}</Text>
          <Text style={[styles.credLabel, { marginTop: 10 }]}>Password</Text>
          <Text style={styles.credValue} selectable>{done.password}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Button title="Share" icon="share-social" kind="accent" style={{ flex: 1 }} onPress={() => Share.share({ message: `Sports Fest login\nUsername: ${done.username}\nPassword: ${done.password}` }).catch(() => {})} />
          <Button title="Done" style={{ flex: 1 }} onPress={onClose} />
        </View>
      </Dialog>
    );
  }

  return (
    <Dialog visible={visible} onClose={onClose}>
      <Text style={styles.title}>New account</Text>
      <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Name of the person</Text>
        <TextInput value={f.fullName} onChangeText={(v) => setF({ ...f, fullName: v })} placeholder="e.g. Nel Marasigan" placeholderTextColor={colors.muted} style={styles.input} />

        <Text style={styles.label}>Username</Text>
        <TextInput value={f.username} onChangeText={(v) => setF({ ...f, username: v.replace(/\s/g, '') })} placeholder="e.g. nel.marasigan" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} style={styles.input} />

        <View style={styles.checkHead}>
          <Text style={styles.label}>Password</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable onPress={() => setShow(!show)} hitSlop={8}>
              <Text style={styles.link}>{show ? 'Hide' : 'Show'}</Text>
            </Pressable>
            <Pressable onPress={() => setF({ ...f, password: makePassword() })} hitSlop={8}>
              <Text style={styles.link}>Generate</Text>
            </Pressable>
          </View>
        </View>
        <TextInput value={f.password} onChangeText={(v) => setF({ ...f, password: v })} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} placeholder="At least 6 characters" placeholderTextColor={colors.muted} style={styles.input} />

        <Text style={styles.label}>Type</Text>
        <Segmented value={f.role} onChange={(role) => setF({ ...f, role })} options={[{ key: 'committee', label: 'Committee' }, { key: 'admin', label: 'Admin' }]} />
        <Text style={[styles.note, { marginTop: 6 }]}>
          {f.role === 'committee' ? 'Committee can choose winners, enter points, and add team names, only in the games you tick below.' : 'Admins can do everything, including creating accounts.'}
        </Text>

        {f.role === 'committee' ? (
          <View style={{ marginTop: 14 }}>
            <GameChecklist value={f.games} onChange={(games) => setF({ ...f, games })} />
          </View>
        ) : null}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : problem && (f.fullName || f.username) ? <Text style={styles.hint}>{problem}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Button title="Cancel" kind="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Button title={busy ? 'Creating…' : 'Create account'} icon="person-add" onPress={submit} disabled={!!problem || busy} style={{ flex: 1.4 }} />
      </View>
    </Dialog>
  );
}

function GamesDialog({ user, onClose, onSave }) {
  const [games, setGames] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user) setGames(user.games);
  }, [user]);
  return (
    <Dialog visible={!!user} onClose={onClose}>
      <Text style={styles.title}>Games of {user ? user.fullName : ''}</Text>
      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
        <GameChecklist value={games} onChange={setGames} />
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Button title="Cancel" kind="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Button
          title={busy ? 'Saving…' : 'Save games'}
          icon="checkmark-circle"
          kind="success"
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            await onSave(user, games);
            setBusy(false);
          }}
          style={{ flex: 1.4 }}
        />
      </View>
    </Dialog>
  );
}

function PasswordDialog({ user, onClose, onSave }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (user) {
      setPw(makePassword());
      setError(null);
    }
  }, [user]);
  return (
    <Dialog visible={!!user} onClose={onClose}>
      <Text style={styles.title}>New password</Text>
      <Text style={styles.note}>
        For {user ? user.fullName : ''} (@{user ? user.username : ''}). Tell them the new password.
      </Text>
      <TextInput value={pw} onChangeText={setPw} autoCapitalize="none" autoCorrect={false} style={styles.input} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Button title="Cancel" kind="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Button
          title={busy ? 'Saving…' : 'Change password'}
          disabled={busy || pw.length < 6}
          onPress={async () => {
            setBusy(true);
            const err = await onSave(user, pw);
            setBusy(false);
            if (err) setError(err);
          }}
          style={{ flex: 1.4 }}
        />
      </View>
    </Dialog>
  );
}

export default function AccountsScreen() {
  const { api, isAdmin, session } = useStore();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [gamesFor, setGamesFor] = useState(null);
  const [passwordFor, setPasswordFor] = useState(null);

  const load = useCallback(async () => {
    if (!api) return;
    try {
      setList(await api.listStaff());
      setError(null);
    } catch (e) {
      setError(e.message || 'Could not load the accounts.');
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  if (!api || !isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.note}>Only admins can manage accounts (and Supabase must be set up).</Text>
      </View>
    );
  }

  const me = session && session.user.id;

  const confirmDelete = (u) =>
    Alert.alert(`Delete ${u.fullName}?`, `@${u.username} will not be able to sign in anymore.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteStaff(u.userId);
          } catch (e) {
            Alert.alert('Could not delete', e.message);
          }
          load();
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <Button title="New account" icon="person-add" onPress={() => setCreating(true)} />
        <Text style={[styles.note, { marginTop: 10 }]}>Committee accounts sign in with a username and password in the Admin tab. You choose which games each one can score.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {list == null && !error ? <Text style={styles.empty}>Loading…</Text> : null}
        {list && list.length === 0 ? <Text style={styles.empty}>No accounts yet. Tap “New account”.</Text> : null}

        {(list || []).map((u) => (
          <Card key={u.userId} style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{u.fullName || u.username}</Text>
                <Text style={styles.user}>@{u.username}</Text>
              </View>
              <Chip label={u.role === 'admin' ? 'Admin' : 'Committee'} tone={u.role === 'admin' ? 'warn' : 'info'} />
            </View>

            {u.role === 'committee' ? (
              <View style={styles.chips}>
                {u.games.length === 0 ? <Chip label="No games yet" tone="danger" /> : u.games.map((g) => <Chip key={g} label={gameLabel(g)} />)}
              </View>
            ) : (
              <Text style={[styles.note, { marginTop: 8 }]}>All games</Text>
            )}

            <View style={styles.actions}>
              {u.role === 'committee' ? <Button title="Games" icon="list" small kind="ghost" onPress={() => setGamesFor(u)} /> : null}
              <Button title="Password" icon="key" small kind="ghost" onPress={() => setPasswordFor(u)} />
              {u.userId !== me ? <Button title="Delete" icon="trash" small kind="ghostDanger" onPress={() => confirmDelete(u)} /> : null}
            </View>
          </Card>
        ))}
      </ScrollView>

      <NewAccountDialog visible={creating} api={api} onClose={() => setCreating(false)} onCreated={load} />
      <GamesDialog
        user={gamesFor}
        onClose={() => setGamesFor(null)}
        onSave={async (u, games) => {
          try {
            await api.setStaffGames(u.userId, games);
            setGamesFor(null);
          } catch (e) {
            Alert.alert('Could not save', e.message);
          }
          load();
        }}
      />
      <PasswordDialog
        user={passwordFor}
        onClose={() => setPasswordFor(null)}
        onSave={async (u, pw) => {
          try {
            await api.setStaffPassword(u.userId, pw);
            setPasswordFor(null);
            Alert.alert('Password changed', `Tell ${u.fullName} the new password.`);
            return null;
          } catch (e) {
            return e.message;
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: colors.bg },
  note: { color: colors.muted, lineHeight: 19, fontSize: 13 },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 24 },
  error: { color: colors.danger, fontWeight: '700', marginTop: 12 },
  hint: { color: colors.warn, fontWeight: '600', marginTop: 12, fontSize: 13 },
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  user: { color: colors.muted, fontWeight: '600', marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.55)' },
  wrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', padding: 18 },
  dialog: { backgroundColor: '#fff', borderRadius: 22, padding: 18, ...shadow },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  link: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, color: colors.text, backgroundColor: '#fff' },
  checkHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: radius.md, marginBottom: 6, borderWidth: 1, borderColor: colors.border },
  checkRowOn: { borderColor: colors.primary, backgroundColor: '#EFF4FF' },
  checkText: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  credBox: { backgroundColor: colors.waitBg, borderRadius: radius.md, padding: 14, marginTop: 12 },
  credLabel: { fontSize: 12, fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  credValue: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 2 },
});
