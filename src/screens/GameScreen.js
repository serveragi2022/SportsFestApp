import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GAME_BY_ID } from '../data/games';
import { useStore } from '../store';
import { eliminatedTeams, getChampion, gameProgress, matchStatus, matchTeams, robinStandings, slotLabel } from '../engine';
import MatchCard from '../components/MatchCard';
import TeamChip from '../components/TeamChip';
import TeamNamePicker from '../components/TeamNamePicker';
import { Trophy } from '../components/GameIcon';
import { Button, Card, Chip, PressableScale, ProgressBar, Segmented } from '../components/ui';
import { colors, radius, shadow } from '../theme';

export default function GameScreen({ route, navigation }) {
  const { gameId, tab: initialTab } = route.params;
  const game = GAME_BY_ID[gameId];
  const { state } = useStore();
  const [tab, setTab] = useState(initialTab || 'matches');
  const results = state.results[gameId] || {};
  const scores = state.scores[gameId] || {};

  useLayoutEffect(() => {
    navigation.setOptions({ title: game.name });
  }, [navigation, game]);

  const progress = gameProgress(game, results);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sumText}>
            {game.teams} teams{game.venue ? ` · ${game.venue}` : ''} · {progress.done}/{progress.total} matches done
          </Text>
          <View style={{ marginTop: 8 }}>
            <ProgressBar done={progress.done} total={progress.total} />
          </View>
        </View>
      </View>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { key: 'matches', label: 'Matches' },
          { key: 'bracket', label: 'Bracket' },
          { key: 'teams', label: 'Teams' },
          { key: 'committee', label: 'Committee' },
        ]}
      />

      <View style={{ marginTop: 14 }}>
        {tab === 'matches' && <MatchesTab game={game} results={results} scores={scores} />}
        {tab === 'bracket' && <BracketTab game={game} results={results} scores={scores} />}
        {tab === 'teams' && <TeamsTab game={game} />}
        {tab === 'committee' && <CommitteeTab game={game} />}
      </View>
    </ScrollView>
  );
}

function ChampionBanner({ game, results, scores }) {
  const { state, setTiebreak, canEditGame } = useStore();
  const canEdit = canEditGame(game.id);
  const { champion, tied, reason } = getChampion(game, results, state.tiebreak[game.id], scores);

  if (champion != null) {
    return (
      <View style={styles.champ}>
        <Trophy size={38} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.champLabel}>CHAMPION</Text>
          <TeamChip gameId={game.id} teamNo={champion} bold />
        </View>
      </View>
    );
  }
  if (tied) {
    return (
      <Card style={{ marginBottom: 14, borderWidth: 2, borderColor: colors.accent }}>
        <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>Tie-breaker needed</Text>
        <Text style={{ color: colors.muted, marginTop: 4, marginBottom: 10 }}>
          {reason === 'points'
            ? 'These teams have the same wins and the same total points.'
            : 'These teams have the same number of wins.'}{' '}
          {canEdit ? 'Choose the champion.' : 'Waiting for the committee to choose the champion.'}
        </Text>
        {tied.map((t) => (
          <View key={t} style={styles.tieRow}>
            <TeamChip gameId={game.id} teamNo={t} />
            {canEdit ? <Button title="Pick as champion" icon="trophy" kind="accent" small onPress={() => setTiebreak(game.id, t)} /> : null}
          </View>
        ))}
      </Card>
    );
  }
  return null;
}

function WinsTable({ game, roundIndex, results, scores }) {
  const { state } = useStore();
  const st = robinStandings(game, roundIndex, results, scores);
  const champ = getChampion(game, results, state.tiebreak[game.id], scores);
  const needsTiebreak = roundIndex === game.rounds.length - 1 && champ.tied && champ.champion == null;
  return (
    <Card style={{ marginBottom: 12 }}>
      <Text style={styles.tableTitle}>Wins table</Text>
      <View style={[styles.tr, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <Text style={[styles.th, { flex: 1, textAlign: 'left' }]}>Team</Text>
        <Text style={styles.th}>Wins</Text>
        <Text style={styles.th}>Losses</Text>
        {st.scoring ? <Text style={styles.th}>Total pts</Text> : null}
      </View>
      {st.rows.length === 0 ? <Text style={{ color: colors.muted, paddingVertical: 8 }}>Teams appear when the semi-finals are decided.</Text> : null}
      {st.rows.map((r) => (
        <View key={r.team} style={styles.tr}>
          <View style={{ flex: 1 }}>
            <TeamChip gameId={game.id} teamNo={r.team} />
          </View>
          <Text style={[styles.td, { fontWeight: '800' }]}>{r.wins}</Text>
          <Text style={styles.td}>{r.losses}</Text>
          {st.scoring ? <Text style={styles.td}>{r.pf}</Text> : null}
        </View>
      ))}
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Most wins is the Champion.{st.scoring ? ' If tied, the total points scored decide; if still tied, the admin picks.' : ''} Matches done: {st.done}/{st.total}</Text>
      {needsTiebreak ? <Text style={{ color: colors.warn, fontWeight: '700', fontSize: 12, marginTop: 6 }}>Tie. The champion is chosen in the Tie-breaker box at the top of this screen.</Text> : null}
    </Card>
  );
}

function MatchesTab({ game, results, scores }) {
  return (
    <View>
      <ChampionBanner game={game} results={results} scores={scores} />
      {game.rounds.map((round, ri) => (
        <View key={round.name}>
          <Text style={styles.roundTitle}>{round.name}</Text>
          {round.matches.map((m) => (
            <MatchCard key={m.no} game={game} results={results} scores={scores} match={{ ...m, roundIndex: ri, roundName: round.name, roundType: round.type, scoring: !!round.scoring, venue: m.venue || game.venue }} />
          ))}
          {round.type === 'robin' ? <WinsTable game={game} roundIndex={ri} results={results} scores={scores} /> : null}
        </View>
      ))}
    </View>
  );
}

function BracketTab({ game, results, scores }) {
  const out = eliminatedTeams(game, results);
  return (
    <View>
      <ChampionBanner game={game} results={results} scores={scores} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        {game.rounds.map((round) => (
          <View key={round.name} style={styles.bCol}>
            <Text style={styles.bRound}>{round.name.replace(/^Round \d+: /, '')}</Text>
            <View style={{ flex: 1, justifyContent: 'space-around' }}>
              {round.matches.map((m) => {
                const teams = matchTeams(m, results);
                const status = matchStatus(m, results);
                const winner = results[m.no];
                const sc = round.scoring ? scores[m.no] : null;
                return (
                  <View key={m.no} style={[styles.node, status === 'done' && { borderColor: colors.success }]}>
                    <Text style={styles.nodeNo}>Game {m.no}</Text>
                    {m.slots.map((slot, i) => {
                      const t = teams[i];
                      if (t == null) {
                        return (
                          <Text key={i} style={styles.nodeWait}>
                            {slotLabel(slot)}
                          </Text>
                        );
                      }
                      const lost = winner != null && winner !== t;
                      return (
                        <View key={i} style={[styles.nodeRow, winner === t && { backgroundColor: colors.successBg }]}>
                          <TeamChip gameId={game.id} teamNo={t} compact dim={lost && (round.type === 'elim' || out.has(t))} bold={winner === t} />
                          {sc ? <Text style={styles.nodeScore}>{sc[i]}</Text> : null}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Swipe sideways to see every round. Select winners in the Matches tab.</Text>
    </View>
  );
}

function TeamsTab({ game }) {
  const { getTeam, isAdmin } = useStore(); // only the admin gives names to the teams
  const [editing, setEditing] = useState(null);
  const teams = useMemo(() => Array.from({ length: game.teams }, (_, i) => i + 1), [game]);
  return (
    <View>
      <Text style={styles.note}>
        {isAdmin
          ? 'Give each team slot its team name. The same name can be used by more than one team (for example Team 1 and Team 2 can both be “Production”).'
          : 'Team names of this game.'}
      </Text>
      {teams.map((n) => {
        const info = getTeam(game.id, n);
        return (
          <PressableScale key={n} disabled={!isAdmin} haptic={false} scaleTo={0.98} onPress={() => setEditing(n)} style={{ marginBottom: 8 }} innerStyle={styles.teamRow}>
            <TeamChip gameId={game.id} teamNo={n} />
            {isAdmin ? <Text style={{ color: colors.primary, fontWeight: '800' }}>{info.name ? 'Change' : 'Set name'}</Text> : null}
          </PressableScale>
        );
      })}
      {isAdmin ? <TeamNamePicker visible={editing != null} gameId={game.id} teamNo={editing || 1} onClose={() => setEditing(null)} /> : null}
    </View>
  );
}

function CommitteeTab({ game }) {
  const { getCommittee, setCommittee, isAdmin } = useStore();
  const rows = getCommittee(game.id);
  return (
    <View>
      {rows.map((r) => (
        <Card key={r.role} style={{ marginBottom: 10 }}>
          <Text style={styles.roleLabel}>{r.role}</Text>
          <TextInput
            defaultValue={r.name}
            onEndEditing={(e) => setCommittee(game.id, r.role, e.nativeEvent.text)}
            editable={isAdmin}
            placeholder="Not assigned"
            placeholderTextColor={colors.muted}
            style={styles.roleInput}
          />
        </Card>
      ))}
      {isAdmin ? <Text style={{ color: colors.muted, fontSize: 12 }}>Changes are saved automatically.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  summary: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 14, marginBottom: 14, flexDirection: 'row', ...shadow },
  sumText: { fontWeight: '700', color: colors.text },
  champ: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7E6', borderWidth: 2, borderColor: '#F59E0B', borderRadius: radius.lg, padding: 16, marginBottom: 14 },
  champLabel: { color: '#B45309', fontWeight: '900', letterSpacing: 1.5, fontSize: 12, marginBottom: 4 },
  tieRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  roundTitle: { fontSize: 14, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 6 },
  tableTitle: { fontWeight: '800', fontSize: 15, marginBottom: 6, color: colors.text },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  th: { width: 52, textAlign: 'center', fontSize: 12, fontWeight: '800', color: colors.muted, paddingBottom: 6 },
  td: { width: 52, textAlign: 'center', fontSize: 15, color: colors.text },
  bCol: { width: 190, marginRight: 14 },
  bRound: { fontWeight: '800', color: colors.primary, marginBottom: 8 },
  node: { backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: 8, marginBottom: 12 },
  nodeNo: { fontSize: 11, fontWeight: '800', color: colors.muted, marginBottom: 4 },
  nodeRow: { paddingVertical: 5, paddingHorizontal: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nodeScore: { fontWeight: '900', color: colors.text, fontSize: 15, marginLeft: 6 },
  nodeWait: { color: colors.muted, fontStyle: 'italic', fontSize: 12, paddingVertical: 6, paddingHorizontal: 4 },
  note: { color: colors.muted, marginBottom: 12, lineHeight: 19 },
  teamRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: radius.md, padding: 12, ...shadow },
  roleLabel: { fontSize: 12, fontWeight: '800', color: colors.muted, marginBottom: 6, textTransform: 'uppercase' },
  roleInput: { fontSize: 16, color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 6 },
});
