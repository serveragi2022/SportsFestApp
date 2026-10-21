import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store';
import { computeStandings, rankByPercent } from '../standings';
import { myTeamMatches } from '../myteam';
import { slotLabel } from '../engine';
import GameIcon from './GameIcon';
import { Button, Card, Chip, PickerModal, PressableScale, SectionTitle } from './ui';
import { colors, radius } from '../theme';

// Home: follow ONE team name (kept on this phone). Shows its percent, rank, next games and results.
export default function MyTeamCard({ navigation }) {
  const { state, myTeam, setMyTeam, getTeam, matchTime } = useStore();
  const [picking, setPicking] = useState(false);

  const info = useMemo(() => {
    if (!myTeam) return null;
    const list = rankByPercent(computeStandings(state));
    return list.find((r) => r.name.toLowerCase() === myTeam.toLowerCase()) || null;
  }, [state, myTeam]);
  const rows = useMemo(() => (myTeam ? myTeamMatches(state, myTeam) : []), [state, myTeam]);
  const upcoming = rows.filter((r) => r.status !== 'done');
  const played = rows.filter((r) => r.status === 'done');

  const options = state.masterTeams.map((t) => ({ key: t.name, label: t.name, sub: t.department || undefined, color: t.color }));

  const picker = (
    <PickerModal
      visible={picking}
      title="Choose your team"
      options={options}
      onClose={() => setPicking(false)}
      onSelect={(o) => {
        setMyTeam(o.key);
        setPicking(false);
      }}
      footer={
        myTeam ? (
          <Text
            style={styles.stop}
            onPress={() => {
              setMyTeam(null);
              setPicking(false);
            }}
          >
            Stop following {myTeam}
          </Text>
        ) : null
      }
    />
  );

  if (!myTeam || !info) {
    return (
      <View>
        <SectionTitle>My team</SectionTitle>
        <Card style={{ marginBottom: 12 }}>
          <Text style={styles.ask}>Follow your team to see only your games, times and results here.</Text>
          <View style={{ marginTop: 10 }}>
            <Button title="Choose my team" icon="star" onPress={() => setPicking(true)} />
          </View>
        </Card>
        {picker}
      </View>
    );
  }

  const opponent = (r) =>
    r.match.slots
      .map((slot, i) => {
        const t = r.teams[i];
        if (t != null && r.mine.includes(t)) return null;
        if (t == null) return slotLabel(slot).replace('Winner of', 'winner of');
        const g = getTeam(r.game.id, t);
        return g.name || `Team ${t}`;
      })
      .filter(Boolean)
      .join(' / ');

  const line = (r) => {
    const time = matchTime(r.game.id, r.match);
    return (
      <PressableScale key={`${r.game.id}-${r.match.no}`} haptic={false} scaleTo={0.98} onPress={() => navigation.navigate('Game', { gameId: r.game.id })} style={{ marginTop: 8 }}>
        <View style={styles.line}>
          <GameIcon id={r.game.id} size={20} />
          <View style={{ flex: 1 }}>
            <Text style={styles.lineTitle} numberOfLines={1}>
              {r.game.short || r.game.name} · Game {r.match.no}
            </Text>
            <Text style={styles.lineSub} numberOfLines={2}>
              {opponent(r) ? `vs ${opponent(r)}` : 'Waiting for the opponent'}
              {time ? ` · ${time}` : r.match.venue || r.game.venue ? ` · ${r.match.venue || r.game.venue}` : ''}
            </Text>
          </View>
          {r.status === 'done' ? <Chip label={r.outcome === 'won' ? 'Won' : 'Lost'} tone={r.outcome === 'won' ? 'success' : 'danger'} /> : <Chip label={r.status === 'ready' ? 'Ready' : 'Waiting'} tone={r.status === 'ready' ? 'warn' : 'neutral'} />}
        </View>
      </PressableScale>
    );
  };

  return (
    <View>
      <SectionTitle right={<Text style={styles.change} onPress={() => setPicking(true)}>Change</Text>}>My team</SectionTitle>
      <Card style={{ marginBottom: 12 }}>
        <View style={styles.head}>
          <View style={[styles.dot, { backgroundColor: info.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{info.name}</Text>
            <Text style={styles.dept}>{info.department || 'No department'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.percent}>{info.percent}%</Text>
            <Text style={styles.dept}>{info.percent > 0 ? `Rank ${info.rank}` : 'No rank yet'}</Text>
          </View>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${info.percent}%` }]} />
        </View>

        <Text style={styles.block}>Next games</Text>
        {upcoming.length ? upcoming.slice(0, 5).map(line) : <Text style={styles.empty}>{rows.length ? 'No more games to play.' : 'Your team is not in a game yet.'}</Text>}
        {played.length ? (
          <>
            <Text style={styles.block}>Results</Text>
            {played.map(line)}
          </>
        ) : null}
      </Card>
      {picker}
    </View>
  );
}

const styles = StyleSheet.create({
  ask: { color: colors.text, fontWeight: '600', lineHeight: 20 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { fontSize: 18, fontWeight: '900', color: colors.text },
  dept: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  percent: { fontSize: 22, fontWeight: '900', color: colors.primary },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.waitBg, marginTop: 10, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.primary },
  block: { marginTop: 14, fontSize: 12, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  empty: { color: colors.muted, marginTop: 6, fontStyle: 'italic' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10 },
  lineTitle: { fontWeight: '800', color: colors.text },
  lineSub: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  change: { color: colors.primary, fontWeight: '800' },
  stop: { color: colors.danger, fontWeight: '800', textAlign: 'center', padding: 14 },
});
