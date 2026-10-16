import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../store';
import { Button, PickerModal } from './ui';
import { TEAM_COLORS } from '../data/games';
import { colors } from '../theme';

// Assign a team name to "Team N" of a game: pick from the master list or type a custom name.
// The same name may be given to several team slots of the same game.
export default function TeamNamePicker({ visible, gameId, teamNo, onClose }) {
  const { state, assignTeam, addMaster, isAdmin } = useStore();
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (visible) setCustom('');
  }, [visible, teamNo]);

  const options = state.masterTeams.map((t) => ({ key: t.id, label: t.name, color: t.color }));

  const saveCustom = () => {
    const name = custom.trim();
    if (!name) return;
    // a new name is added to the shared list of team names, then given to this team
    const match = state.masterTeams.find((t) => t.name.toLowerCase() === name.toLowerCase());
    const team = match || addMaster(name, TEAM_COLORS[state.masterTeams.length % TEAM_COLORS.length]);
    assignTeam(gameId, teamNo, team ? { masterId: team.id } : { name });
    onClose();
  };

  return (
    <PickerModal
      visible={visible}
      title={`Name for Team ${teamNo}`}
      options={options}
      onClose={onClose}
      onSelect={(o) => {
        assignTeam(gameId, teamNo, { masterId: o.key });
        onClose();
      }}
      footer={
        <View style={styles.footer}>
          {isAdmin ? (
            <View>
              <Text style={styles.hint}>Or add a new team name (admin)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput value={custom} onChangeText={setCustom} placeholder="e.g. Production" placeholderTextColor={colors.muted} style={styles.input} onSubmitEditing={saveCustom} returnKeyType="done" />
                <Button title="Use" small onPress={saveCustom} disabled={!custom.trim()} style={{ alignSelf: 'center' }} />
              </View>
            </View>
          ) : null}
          <Pressable
            onPress={() => {
              assignTeam(gameId, teamNo, null);
              onClose();
            }}
            style={{ paddingVertical: 14 }}
          >
            <Text style={{ color: colors.danger, fontWeight: '700', textAlign: 'center' }}>Clear name</Text>
          </Pressable>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  footer: { padding: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  hint: { color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  input: { flex: 1, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.text },
});
