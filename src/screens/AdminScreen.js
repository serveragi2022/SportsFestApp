import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GAMES, GAME_BY_ID, TEAM_COLORS } from '../data/games';
import { DEPARTMENTS } from '../data/departments';
import { Alert } from '../dialog';
import { useStore } from '../store';
import { emailToUsername } from '../permissions';
import GameIcon from '../components/GameIcon';
import BackupCard from '../components/BackupCard';
import { Button, Card, Chip, FilterChip, PickerModal, SectionTitle, TextPromptModal } from '../components/ui';
import { colors, radius } from '../theme';

function StatusCard() {
  const { mode, access, session, syncError, refresh, signOut } = useStore();
  const title = access.role === 'admin' ? 'Admin' : access.role === 'committee' ? 'Committee' : 'Guest (view only)';
  return (
    <Card style={{ marginTop: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>{title}</Text>
          <Text style={styles.note}>
            {mode === 'cloud'
              ? session
                ? `Signed in as ${emailToUsername(session.user.email)}`
                : 'Brackets, winners and standings are open to everyone.'
              : 'Local mode: Supabase is not set up, data stays on this device only.'}
          </Text>
        </View>
        <Chip label={mode === 'cloud' ? (syncError ? 'Offline' : 'Online') : 'Local'} tone={mode === 'cloud' ? (syncError ? 'danger' : 'success') : 'warn'} />
      </View>
      {syncError ? (
        <View style={styles.errorBox}>
          <Text style={{ color: colors.danger, fontWeight: '700' }}>Sync problem: {syncError}</Text>
          <Button title="Try again" small kind="ghostDanger" icon="refresh" onPress={refresh} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
        </View>
      ) : null}
      {mode === 'cloud' && session ? <Button title="Sign out" icon="log-out-outline" kind="ghost" small onPress={signOut} style={{ marginTop: 12, alignSelf: 'flex-start' }} /> : null}
    </Card>
  );
}

function LoginCard() {
  const { signIn, session } = useStore();
  const [email, setEmail] = useState(''); // the username
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    const err = await signIn(email, password);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <Card style={{ marginTop: 14 }}>
      <Text style={styles.statusTitle}>Admin / Committee login</Text>
      {session ? (
        <Text style={[styles.note, { color: colors.warn, marginTop: 6 }]}>This account has no access yet. Ask the admin.</Text>
      ) : (
        <Text style={[styles.note, { marginTop: 4 }]}>Admin and committee accounts sign in here with their username and password. Guests do not need to sign in.</Text>
      )}
      <TextInput value={email} onChangeText={setEmail} placeholder="Username" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} style={styles.input} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} onSubmitEditing={submit} returnKeyType="go" />
      {error ? <Text style={{ color: colors.danger, marginTop: 8, fontWeight: '600' }}>{error}</Text> : null}
      <Button title={busy ? 'Signing in…' : 'Sign in'} icon="log-in-outline" onPress={submit} disabled={busy || !email.trim() || !password} style={{ marginTop: 14 }} />
    </Card>
  );
}

// Department of a team name: tap a preset or type another one.
function DepartmentField({ value, onChange }) {
  return (
    <View>
      <Text style={[styles.note, { marginTop: 14, marginBottom: 6 }]}>Department</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {DEPARTMENTS.map((d) => (
          <FilterChip key={d} label={d} active={value === d} onPress={() => onChange(value === d ? '' : d)} />
        ))}
      </View>
      <TextInput value={value} onChangeText={onChange} placeholder="or type a department" placeholderTextColor={colors.muted} style={[styles.input, { marginTop: 10 }]} />
    </View>
  );
}

function CommitteeTools({ navigation }) {
  const { state, access } = useStore();
  const games = access.games.map((id) => GAME_BY_ID[id]).filter(Boolean);

  return (
    <View>
      <SectionTitle>Your games</SectionTitle>
      {games.length === 0 ? <Text style={styles.empty}>No games assigned to you yet. Ask the admin.</Text> : null}
      {games.map((g) => (
        <Card key={g.id} style={styles.gameRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
            <GameIcon id={g.id} />
            <Text style={styles.gameName}>{g.name}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Matches" icon="trophy" small onPress={() => navigation.navigate('Game', { gameId: g.id, tab: 'matches' })} />
          </View>
        </Card>
      ))}
      <Text style={styles.note}>In your games you can choose the winner and enter points. The admin sets the team names.</Text>

      <SectionTitle>Team names</SectionTitle>
      <Text style={styles.note}>Team names are set up by the admin.</Text>
      {state.masterTeams.length === 0 ? <Text style={styles.empty}>No team names yet. Ask the admin.</Text> : null}
      {state.masterTeams.map((t) => (
        <Card key={t.id} style={styles.masterRow}>
          <View style={[styles.dot, { backgroundColor: t.color }]} />
          <Text style={styles.masterName}>{t.name}{t.department ? <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 13 }}>{'   ' + t.department}</Text> : null}</Text>
        </Card>
      ))}

    </View>
  );
}

function AdminTools({ navigation }) {
  const { state, mode, addMaster, updateMaster, deleteMaster, resetGame, resetAllResults, resetEverything } = useStore();
  const [editor, setEditor] = useState(null); // { id?, name, color }
  const [resetPicker, setResetPicker] = useState(false);

  const saveMaster = () => {
    if (!editor || !editor.name.trim()) return;
    if (editor.id) updateMaster({ id: editor.id, name: editor.name.trim(), color: editor.color, department: (editor.department || '').trim() });
    else addMaster(editor.name, editor.color, editor.department);
    setEditor(null);
  };

  const confirmDelete = (t) =>
    Alert.alert(`Delete “${t.name}”?`, 'Team slots using this name keep the name as a custom label.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMaster(t.id) },
    ]);

  const confirmResetGame = (g) =>
    Alert.alert(`Reset ${g.name}?`, 'All winners and points of this game are cleared. Team names stay.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => resetGame(g.id) },
    ]);

  return (
    <View>
      <SectionTitle>Accounts</SectionTitle>
      <Card>
        <Text style={styles.note}>
          {mode === 'cloud'
            ? 'Create accounts (username + password) for the committee and choose which games each one can score.'
            : 'Accounts need Supabase. Set it up (see the README) to create committee accounts.'}
        </Text>
        {mode === 'cloud' ? <Button title="Manage accounts" icon="key" onPress={() => navigation.navigate('Accounts')} style={{ marginTop: 12 }} /> : null}
      </Card>

      <SectionTitle right={<Button title="Add" icon="add" small onPress={() => setEditor({ name: '', department: '', color: TEAM_COLORS[state.masterTeams.length % TEAM_COLORS.length] })} />}>Team names</SectionTitle>
      <Text style={styles.note}>List of the team names taking part. Pick from this list when naming Team 1, Team 2, … of each game. One name can be used by several teams.</Text>
      {state.masterTeams.length === 0 ? <Text style={styles.empty}>No team names yet. Tap “Add”.</Text> : null}
      {state.masterTeams.map((t) => (
        <Card key={t.id} style={styles.masterRow}>
          <View style={[styles.dot, { backgroundColor: t.color }]} />
          <Text style={styles.masterName}>{t.name}{t.department ? <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 13 }}>{'   ' + t.department}</Text> : null}</Text>
          <Button title="Edit" kind="ghost" small onPress={() => setEditor({ id: t.id, name: t.name, color: t.color, department: t.department || '' })} />
          <Button title="Delete" kind="ghostDanger" small onPress={() => confirmDelete(t)} style={{ marginLeft: 6 }} />
        </Card>
      ))}

      <SectionTitle>Per game setup</SectionTitle>
      {GAMES.map((g) => (
        <Card key={g.id} style={styles.gameRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
            <GameIcon id={g.id} />
            <Text style={styles.gameName}>{g.name}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Committee" icon="clipboard" small kind="ghost" onPress={() => navigation.navigate('Game', { gameId: g.id, tab: 'committee' })} />
          </View>
        </Card>
      ))}

      <SectionTitle>Backup and restore</SectionTitle>
      <BackupCard />

      <SectionTitle>Reset</SectionTitle>
      <View style={{ gap: 12 }}>
        <Button title="Reset one game…" icon="refresh" kind="ghost" onPress={() => setResetPicker(true)} />
        <Button
          title="Reset all winners and points"
          icon="refresh-circle"
          kind="ghostDanger"
          onPress={() =>
            Alert.alert('Reset all winners and points?', 'All results of all 12 games are cleared. Team names stay.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: resetAllResults },
            ])
          }
        />
        <Button
          title="Erase everything"
          icon="trash"
          kind="danger"
          onPress={() =>
            Alert.alert('Erase everything?', 'Results, team names, and committee edits are all removed.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Erase', style: 'destructive', onPress: resetEverything },
            ])
          }
        />
      </View>

      <TextPromptModal
        visible={!!editor}
        title={editor && editor.id ? 'Edit team name' : 'Add team name'}
        value={editor ? editor.name : ''}
        onChangeText={(v) => setEditor((e) => ({ ...e, name: v }))}
        onSave={saveMaster}
        onClose={() => setEditor(null)}
      >
        <Text style={[styles.note, { marginTop: 14, marginBottom: 6 }]}>Color</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {TEAM_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setEditor((e) => ({ ...e, color: c }))} style={[styles.swatch, { backgroundColor: c }, editor && editor.color === c && styles.swatchOn]} />
          ))}
        </View>
        <DepartmentField value={(editor && editor.department) || ''} onChange={(v) => setEditor((e) => ({ ...e, department: v }))} />
      </TextPromptModal>

      <PickerModal
        visible={resetPicker}
        title="Reset which game?"
        options={GAMES.map((g) => ({ key: g.id, label: g.name }))}
        onClose={() => setResetPicker(false)}
        onSelect={(o) => {
          setResetPicker(false);
          const g = GAMES.find((x) => x.id === o.key);
          setTimeout(() => confirmResetGame(g), 250);
        }}
      />
    </View>
  );
}

export default function AdminScreen({ navigation }) {
  const { access } = useStore();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
        <StatusCard />
        {access.role === 'admin' ? <AdminTools navigation={navigation} /> : access.role === 'committee' ? <CommitteeTools navigation={navigation} /> : <LoginCard />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  statusTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  note: { color: colors.muted, lineHeight: 19, fontSize: 13 },
  errorBox: { marginTop: 12, backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: 10 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginTop: 12, color: colors.text, backgroundColor: '#fff' },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 16 },
  masterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, padding: 12 },
  dot: { width: 18, height: 18, borderRadius: 9, marginRight: 10 },
  masterName: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  gameRow: { marginBottom: 8, padding: 12 },
  gameName: { fontWeight: '800', fontSize: 15, color: colors.text, marginBottom: 10 },
  swatch: { width: 34, height: 34, borderRadius: radius.sm },
  swatchOn: { borderWidth: 3, borderColor: colors.text },
});
