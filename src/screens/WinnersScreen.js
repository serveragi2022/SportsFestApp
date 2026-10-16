import React from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { GAMES } from '../data/games';
import GameIcon, { Trophy } from '../components/GameIcon';
import { useStore } from '../store';
import { getChampion } from '../engine';
import TeamChip from '../components/TeamChip';
import { Button, Card, Chip } from '../components/ui';
import { colors } from '../theme';

export default function WinnersScreen({ navigation }) {
  const { state, getTeam } = useStore();

  const rows = GAMES.map((g) => {
    const { champion, tied } = getChampion(g, state.results[g.id] || {}, state.tiebreak[g.id], (state.scores && state.scores[g.id]) || {});
    return { game: g, champion, tied };
  });
  const decided = rows.filter((r) => r.champion != null).length;

  const share = () => {
    const lines = rows.map((r) => `${r.game.name}: ${r.champion != null ? getTeam(r.game.id, r.champion).label : 'TBD'}`);
    Share.share({ message: `AGI Sports Fest 2026 - Champions\n\n${lines.join('\n')}` }).catch(() => {});
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.head}>
        <Text style={styles.headText}>
          {decided} of {GAMES.length} champions decided
        </Text>
        <Button title="Share" icon="share-social" small kind="accent" onPress={share} />
      </View>

      {rows.map(({ game, champion, tied }) => (
        <Card key={game.id} style={{ marginBottom: 10 }}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <GameIcon id={game.id} />
                <Text style={styles.game}>{game.name}</Text>
              </View>
              <View style={{ marginTop: 10 }}>
                {champion != null ? (
                  <TeamChip gameId={game.id} teamNo={champion} bold />
                ) : tied ? (
                  <Chip label="Tie-breaker needed" tone="warn" />
                ) : (
                  <Text style={styles.tbd}>TBD</Text>
                )}
              </View>
            </View>
            <Trophy size={40} color={champion != null ? '#D97706' : '#CBD5E1'} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headText: { fontWeight: '800', fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center' },
  game: { fontSize: 16, fontWeight: '800', color: colors.text },
  tbd: { color: colors.muted, fontWeight: '800', fontSize: 15 },
});
