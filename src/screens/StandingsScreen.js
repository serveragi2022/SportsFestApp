import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import GameIcon, { Trophy } from '../components/GameIcon';
import { useStore } from '../store';
import { computeStandings, groupByDepartment, leadingTeams, rankByPercent } from '../standings';
import { Card, Chip, PressableScale, Segmented } from '../components/ui';
import { colors, radius, shadow } from '../theme';

const MEDAL_COLOR = { 1: '#D4A017', 2: '#94A3B8', 3: '#B7791F' };

const STATUS = {
  champion: { label: 'Champion', tone: 'success' },
  out: { label: 'Lose', tone: 'danger' },
  playing: { label: 'In play', tone: 'warn' },
  idle: { label: 'Not started', tone: 'neutral' },
};

function Stat({ value, label, highlight }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, highlight && { color: colors.primary }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TeamRow({ r, rank, showDept, open, onToggle }) {
  const full = r.percent >= 100;
  return (
    <PressableScale onPress={onToggle} haptic={false} scaleTo={0.98} style={{ marginBottom: 5 }}>
      <View style={styles.row}>
        <View style={styles.rowTop}>
          {rank ? (
            <View style={[styles.rankDot, { backgroundColor: MEDAL_COLOR[rank] || r.color }]}>
              <Text style={styles.rankDotText}>{rank}</Text>
            </View>
          ) : (
            <View style={[styles.colorDot, { backgroundColor: r.color }]} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {r.name}
            </Text>
            {showDept ? <Text style={styles.sub}>{r.department || 'No department'}</Text> : null}
          </View>
          <Text style={[styles.percent, full && { color: colors.success }]}>{r.percent}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${r.percent}%`, backgroundColor: full ? colors.success : colors.primary }]} />
        </View>

        {open ? (
          <View style={styles.detail}>
            <Text style={styles.sub}>
              {r.gamesWon} {r.gamesWon === 1 ? 'game' : 'games'} won · {r.gamesJoined} {r.gamesJoined === 1 ? 'game' : 'games'} joined
            </Text>
            {r.games.length === 0 ? <Text style={styles.slotWl}>Not in any game yet.</Text> : null}
            {r.games.map(({ game, slots }) => (
              <View key={game.id} style={styles.gameBlock}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <GameIcon id={game.id} size={18} />
                  <Text style={[styles.gameTitle, { marginBottom: 0 }]}>{game.name}</Text>
                </View>
                {slots.map((s) => (
                  <View key={s.team} style={styles.slotRow}>
                    <Text style={styles.slotName}>Team {s.team}</Text>
                    <View style={{ flex: 1 }} />
                    <Chip label={STATUS[s.status].label} tone={STATUS[s.status].tone} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

// Team standing. Each team name shows a percent: every game it WINS adds 20%, up to 100% (about 5 games).
// "By department" groups the teams under their department; "Ranking" lists all teams, best first.
export default function StandingsScreen() {
  const { state } = useStore();
  const [view, setView] = useState('department');
  const [open, setOpen] = useState(null);

  const list = useMemo(() => computeStandings(state), [state]);
  const groups = useMemo(() => groupByDepartment(state, list), [state, list]);
  const ranked = useMemo(() => rankByPercent(list), [list]);
  const leaders = useMemo(() => leadingTeams(list), [list]);
  const anyWon = list.some((r) => r.gamesWon > 0);

  const toggle = (key) => setOpen(open === key ? null : key);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { key: 'department', label: 'By department' },
          { key: 'ranking', label: 'Ranking' },
        ]}
      />
      {leaders.length ? (
        <View style={styles.leader}>
          <Text style={styles.leaderLabel}>{leaders.length > 1 ? 'Leading teams (tie)' : 'Leading team'}</Text>
          {leaders.map((t) => (
            <View key={t.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <Trophy size={22} color="#FCD34D" />
              <Text style={styles.leaderName}>
              {t.name} <Text style={{ fontWeight: '700', fontSize: 14 }}>· {t.department || 'No department'} · {t.percent}%</Text>
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={styles.note}>Each game a team wins adds 20%, up to 100%. Tap a team to see its games.</Text>

      {list.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <MaterialCommunityIcons name="chart-bar" size={40} color={colors.muted} />
          <Text style={styles.emptyTitle}>No team names yet</Text>
          <Text style={styles.emptyText}>Standings appear once the admin adds team names (Admin, then Team names).</Text>
        </Card>
      ) : null}

      {view === 'department'
        ? groups.map(({ department, teams }) => (
            <View key={department || 'none'} style={{ marginBottom: 8 }}>
              <Text style={styles.dept}>{department || 'No department'}</Text>
              {teams.map((r) => (
                <TeamRow key={r.key} r={r} open={open === r.key} onToggle={() => toggle(r.key)} />
              ))}
            </View>
          ))
        : ranked.map((r) => <TeamRow key={r.key} r={r} showDept rank={anyWon && r.percent > 0 ? r.rank : null} open={open === r.key} onToggle={() => toggle(r.key)} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  leader: { backgroundColor: colors.primary, borderRadius: radius.md, padding: 12, marginTop: 12 },
  leaderLabel: { color: '#BFD0FF', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  leaderName: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 2 },
  dept: { fontSize: 13, fontWeight: '900', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 10, marginBottom: 6 },
  row: { backgroundColor: '#fff', borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 12, ...shadow },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankDot: { minWidth: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  rankDotText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  percent: { fontSize: 17, fontWeight: '900', color: colors.text },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.waitBg, marginTop: 7, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
  note: { color: colors.muted, marginVertical: 12, lineHeight: 19, fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 14, borderWidth: 2, borderColor: 'transparent', ...shadow },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { minWidth: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  rankText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  sub: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  chev: { color: colors.muted, fontSize: 12 },
  stats: { flexDirection: 'row', marginTop: 12, backgroundColor: colors.waitBg, borderRadius: radius.md, paddingVertical: 10 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, marginTop: 2 },
  detail: { marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 8 },
  gameBlock: { marginTop: 8 },
  gameTitle: { fontWeight: '800', color: colors.text, marginBottom: 4 },
  slotRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 10 },
  slotName: { fontWeight: '700', color: colors.text, width: 70 },
  slotWl: { flex: 1, color: colors.muted, fontWeight: '600' },
  emptyTitle: { fontWeight: '800', fontSize: 16, marginTop: 8, color: colors.text },
  emptyText: { color: colors.muted, textAlign: 'center', marginTop: 4, paddingHorizontal: 12 },
});
