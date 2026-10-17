import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { GAMES } from '../data/games';
import GameIcon, { Trophy } from '../components/GameIcon';
import InstallBanner from '../components/InstallBanner';
import { useStore } from '../store';
import { allMatches, gameProgress, getChampion, matchStatus, matchTeams } from '../engine';
import TeamChip from '../components/TeamChip';
import { Card, Chip, PressableScale, ProgressBar, SectionTitle } from '../components/ui';
import { colors, radius, shadow } from '../theme';

export default function HomeScreen({ navigation }) {
  const { state, getTeam } = useStore();

  const { totalDone, total, upNext, decided } = useMemo(() => {
    let d = 0;
    let t = 0;
    let champs = 0;
    const next = [];
    GAMES.forEach((g) => {
      const results = state.results[g.id] || {};
      const p = gameProgress(g, results);
      d += p.done;
      t += p.total;
      if (getChampion(g, results, state.tiebreak[g.id], (state.scores && state.scores[g.id]) || {}).champion != null) champs += 1;
      allMatches(g).forEach((m) => {
        if (matchStatus(m, results) === 'ready') next.push({ game: g, match: m, teams: matchTeams(m, results) });
      });
    });
    return { totalDone: d, total: t, upNext: next.slice(0, 4), decided: champs };
  }, [state.results, state.tiebreak, state.scores]);

  const header = (
    <View>
      <InstallBanner />
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>AGI Sports Fest 2026</Text>
        <Text style={styles.heroSub}>
          {totalDone} of {total} matches done · {decided} of {GAMES.length} champions
        </Text>
        <View style={{ marginTop: 12 }}>
          <ProgressBar done={totalDone} total={total} color="#FDBA74" />
        </View>
      </View>

      {upNext.length > 0 && (
        <View>
          <SectionTitle>Ready to play</SectionTitle>
          {upNext.map(({ game, match, teams }) => (
            <PressableScale key={`${game.id}-${match.no}`} haptic={false} scaleTo={0.98} onPress={() => navigation.navigate('Game', { gameId: game.id })}>
              <Card style={{ marginBottom: 8, paddingVertical: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                    <GameIcon id={game.id} size={20} />
                    <Text style={styles.nextTitle}>
                      {game.short || game.name} · Game {match.no}
                    </Text>
                  </View>
                  {match.time ? <Chip label={match.time} tone="info" /> : match.venue || game.venue ? <Chip label={match.venue || game.venue} /> : null}
                </View>
                <View style={{ marginTop: 8, gap: 6 }}>
                  {teams.map((t, i) => (
                    <TeamChip key={i} gameId={game.id} teamNo={t} compact />
                  ))}
                </View>
              </Card>
            </PressableScale>
          ))}
        </View>
      )}
      <SectionTitle>All games</SectionTitle>
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
      data={GAMES}
      keyExtractor={(g) => g.id}
      numColumns={2}
      columnWrapperStyle={{ gap: 12 }}
      ListHeaderComponent={header}
      renderItem={({ item: g }) => {
        const results = state.results[g.id] || {};
        const p = gameProgress(g, results);
        const { champion, tied } = getChampion(g, results, state.tiebreak[g.id], (state.scores && state.scores[g.id]) || {});
        const status = champion != null ? 'Champion decided' : p.done > 0 ? 'In progress' : 'Not started';
        return (
          <PressableScale style={{ flex: 1, marginBottom: 12 }} innerStyle={{ flex: 1 }} haptic={false} scaleTo={0.96} onPress={() => navigation.navigate('Game', { gameId: g.id })}>
            <View style={styles.gameCard}>
              <GameIcon id={g.id} size={32} />
              <Text style={styles.gameName} numberOfLines={2}>
                {g.name}
              </Text>
              <Text style={styles.gameMeta}>{g.teams} teams</Text>
              <View style={{ marginVertical: 8 }}>
                <ProgressBar done={p.done} total={p.total} color={champion != null ? colors.success : colors.accent} />
              </View>
              <Text style={styles.gameMeta}>
                {p.done}/{p.total} matches
              </Text>
              {champion != null ? (
                <View style={{ marginTop: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Trophy size={15} />
                    <Text style={styles.champLine}>Team {champion}{getTeam(g.id, champion).name ? ` · ${getTeam(g.id, champion).name}` : ''}</Text>
                  </View>
                </View>
              ) : tied ? (
                <Chip label="Tie-breaker needed" tone="warn" style={{ marginTop: 6 }} />
              ) : (
                <Chip label={status} tone={p.done > 0 ? 'info' : 'neutral'} style={{ marginTop: 6 }} />
              )}
            </View>
          </PressableScale>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 18 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '900' },
  heroSub: { color: '#DBEAFE', marginTop: 4, fontWeight: '600' },
  nextTitle: { fontWeight: '800', color: colors.text, flexShrink: 1 },
  gameCard: { flex: 1, backgroundColor: '#fff', borderRadius: radius.lg, padding: 14, ...shadow },
  gameName: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 6, minHeight: 38 },
  gameMeta: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  champLine: { fontSize: 12, fontWeight: '800', color: colors.success },
});
