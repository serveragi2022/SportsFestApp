import React, { useMemo, useState } from 'react';
import { ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { GAMES } from '../data/games';
import { useStore } from '../store';
import { allMatches, matchStatus, matchTeams, slotLabel } from '../engine';
import TeamChip from '../components/TeamChip';
import { Chip, FilterChip, PickerModal, PressableScale } from '../components/ui';
import { colors, radius, shadow } from '../theme';

export default function ScheduleScreen({ navigation }) {
  const { state, getTeam } = useStore();
  const [status, setStatus] = useState('all'); // all | upcoming | done
  const [gameFilter, setGameFilter] = useState(null);
  const [nameFilter, setNameFilter] = useState(null);
  const [picker, setPicker] = useState(null); // 'game' | 'team'

  const teamNames = useMemo(() => {
    const set = new Set();
    state.masterTeams.forEach((t) => set.add(t.name));
    Object.values(state.rosters).forEach((r) =>
      Object.values(r).forEach((v) => {
        if (v.name) set.add(v.name);
      })
    );
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [state.masterTeams, state.rosters]);

  const sections = useMemo(() => {
    const out = [];
    GAMES.forEach((g) => {
      if (gameFilter && g.id !== gameFilter) return;
      const results = state.results[g.id] || {};
      const data = allMatches(g)
        .map((m) => ({ game: g, match: m, teams: matchTeams(m, results), status: matchStatus(m, results) }))
        .filter((row) => {
          if (status === 'done' && row.status !== 'done') return false;
          if (status === 'upcoming' && row.status === 'done') return false;
          if (nameFilter) {
            const hit = row.teams.some((t) => t != null && getTeam(g.id, t).name.toLowerCase() === nameFilter.toLowerCase());
            if (!hit) return false;
          }
          return true;
        });
      if (data.length) out.push({ title: g.name, game: g, data });
    });
    return out;
  }, [state, status, gameFilter, nameFilter, getTeam]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterChip label="All" active={status === 'all'} onPress={() => setStatus('all')} />
          <FilterChip label="Upcoming" active={status === 'upcoming'} onPress={() => setStatus('upcoming')} />
          <FilterChip label="Done" active={status === 'done'} onPress={() => setStatus('done')} />
          <FilterChip label={gameFilter ? `Game: ${GAMES.find((g) => g.id === gameFilter).short || GAMES.find((g) => g.id === gameFilter).name} ✕` : 'Game ▾'} active={!!gameFilter} onPress={() => (gameFilter ? setGameFilter(null) : setPicker('game'))} />
          <FilterChip label={nameFilter ? `Team: ${nameFilter} ✕` : 'Team name ▾'} active={!!nameFilter} onPress={() => (nameFilter ? setNameFilter(null) : setPicker('team'))} />
        </ScrollView>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(row) => `${row.game.id}-${row.match.no}`}
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={<Text style={styles.empty}>No matches for these filters.</Text>}
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        renderItem={({ item: row }) => (
          <PressableScale onPress={() => navigation.navigate('Game', { gameId: row.game.id })} haptic={false} scaleTo={0.98} style={{ marginBottom: 8 }} innerStyle={styles.row}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={styles.rowTitle}>
                Game {row.match.no} · <Text style={{ color: colors.muted, fontWeight: '600' }}>{row.match.roundName.replace(/^Round \d+: /, '')}</Text>
              </Text>
              <Chip label={row.status === 'done' ? 'Done' : row.status === 'ready' ? 'Ready' : 'Waiting'} tone={row.status === 'done' ? 'success' : row.status === 'ready' ? 'warn' : 'neutral'} />
            </View>
            {row.match.time || row.match.venue ? (
              <Text style={styles.when}>
                {[row.match.time, row.match.venue].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            <View style={{ gap: 6 }}>
              {row.match.slots.map((slot, i) =>
                row.teams[i] != null ? (
                  <TeamChip key={i} gameId={row.game.id} teamNo={row.teams[i]} compact bold={state.results[row.game.id]?.[row.match.no] === row.teams[i]} />
                ) : (
                  <Text key={i} style={styles.wait}>
                    {slotLabel(slot)}
                  </Text>
                )
              )}
            </View>
          </PressableScale>
        )}
      />

      <PickerModal
        visible={picker === 'game'}
        title="Filter by game"
        options={GAMES.map((g) => ({ key: g.id, label: g.name }))}
        onClose={() => setPicker(null)}
        onSelect={(o) => {
          setGameFilter(o.key);
          setPicker(null);
        }}
      />
      <PickerModal
        visible={picker === 'team'}
        title="Filter by team name"
        options={teamNames.map((n) => ({ key: n, label: n }))}
        onClose={() => setPicker(null)}
        onSelect={(o) => {
          setNameFilter(o.key);
          setPicker(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  sectionHeader: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 14, marginBottom: 8 },
  row: { backgroundColor: '#fff', borderRadius: radius.md, padding: 12, ...shadow },
  rowTitle: { fontWeight: '800', color: colors.primary },
  when: { color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  wait: { color: colors.muted, fontStyle: 'italic', fontSize: 13 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
});
