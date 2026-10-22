import React, { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { GAMES } from '../data/games';
import { EVENTS } from '../data/events';
import GameIcon, { Trophy } from '../components/GameIcon';
import InstallBanner from '../components/InstallBanner';
import OfflineBanner from '../components/OfflineBanner';
import MyTeamCard from '../components/MyTeamCard';
import HeroBoard from '../components/HeroBoard';
import { computeStandings, leadingTeams } from '../standings';
import { useStore } from '../store';
import { gameProgress, getChampion } from '../engine';
import { Chip, PressableScale, ProgressBar, SectionTitle } from '../components/ui';
import { colors, radius, shadow } from '../theme';

export default function HomeScreen({ navigation }) {
  const { state, getTeam, offline, refreshing, refresh, syncError, pending, retry } = useStore();

  const { totalDone, total, decided } = useMemo(() => {
    let d = 0;
    let t = 0;
    let champs = 0;
    GAMES.forEach((g) => {
      const results = state.results[g.id] || {};
      const p = gameProgress(g, results);
      d += p.done;
      t += p.total;
      if (getChampion(g, results, state.tiebreak[g.id], (state.scores && state.scores[g.id]) || {}).champion != null) champs += 1;
    });
    return { totalDone: d, total: t, decided: champs };
  }, [state.results, state.tiebreak, state.scores]);

  const leaders = useMemo(() => leadingTeams(computeStandings(state)), [state]);

  const header = (
    <View>
      <OfflineBanner visible={offline} offline={offline} pending={pending} onRetry={retry} />
      {syncError && !offline ? (
        <View style={styles.syncErr}>
          <Text style={styles.syncErrText}>{syncError}</Text>
          <Text onPress={retry} style={styles.syncRetry}>Retry</Text>
        </View>
      ) : null}
      <InstallBanner />
      <HeroBoard leaders={leaders} done={totalDone} total={total} decided={decided} games={GAMES.length} onLive={() => navigation.navigate('Live')} />

      <MyTeamCard navigation={navigation} />

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
      refreshControl={refresh ? <RefreshControl refreshing={!!refreshing} onRefresh={refresh} colors={[colors.primary]} tintColor={colors.primary} /> : undefined}
      ListHeaderComponent={header}
      ListFooterComponent={
        <View>
          <SectionTitle>Department events</SectionTitle>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {EVENTS.map((e) => {
              const placed = Object.keys((state.placements && state.placements[e.id]) || {}).length;
              return (
                <PressableScale key={e.id} style={{ flex: 1 }} innerStyle={{ flex: 1 }} haptic={false} scaleTo={0.96} onPress={() => navigation.navigate('Event', { eventId: e.id })}>
                  <View style={styles.gameCard}>
                    <GameIcon id={e.id} size={32} />
                    <Text style={styles.gameName} numberOfLines={2}>{e.name}</Text>
                    <Chip label={placed ? `${placed} of 8 places set` : 'Not set'} tone={placed ? 'info' : 'neutral'} />
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </View>
      }
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
  gameCard: { flex: 1, backgroundColor: '#fff', borderRadius: radius.lg, padding: 14, ...shadow },
  gameName: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 6, minHeight: 38 },
  gameMeta: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  champLine: { fontSize: 12, fontWeight: '800', color: colors.success },
  syncErr: { backgroundColor: colors.warnBg, borderRadius: 10, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  syncErrText: { flex: 1, color: colors.warn, fontWeight: '700', fontSize: 12, lineHeight: 16 },
  syncRetry: { color: colors.primary, fontWeight: '800', fontSize: 12 },
});
