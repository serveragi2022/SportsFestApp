import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../store';
import { allMatches, downstream, eliminatedTeams, matchStatus, matchTeams, slotLabel } from '../engine';
import TeamChip from './TeamChip';
import ScoreModal from './ScoreModal';
import { Button, Chip, PickerModal } from './ui';
import { colors, radius, shadow } from '../theme';

// One team row. Pops when it becomes the winner.
function SlotRow({ gameId, team, isWinner, lost, eliminated, showLost, score }) {
  const pop = useRef(new Animated.Value(1)).current;
  const was = useRef(isWinner);
  useEffect(() => {
    if (isWinner && !was.current) {
      Animated.sequence([
        Animated.spring(pop, { toValue: 1.04, useNativeDriver: true, speed: 40 }),
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }),
      ]).start();
    }
    was.current = isWinner;
  }, [isWinner, pop]);

  return (
    <Animated.View style={[styles.slot, isWinner && styles.slotWin, lost && styles.slotLost, { transform: [{ scale: pop }] }]}>
      <View style={{ flex: 1 }}>
        <TeamChip gameId={gameId} teamNo={team} dim={lost} bold={isWinner} />
      </View>
      {score != null ? <Text style={[styles.score, isWinner && { color: colors.success }, lost && { opacity: 0.5 }]}>{score}</Text> : null}
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {isWinner ? <Chip label={showLost === 'champion' ? 'CHAMPION' : 'WINNER'} tone="success" /> : null}
        {lost && eliminated ? <Chip label="Eliminated" tone="danger" /> : null}
        {lost && !eliminated ? <Chip label="Lost" tone="neutral" /> : null}
      </View>
    </Animated.View>
  );
}

function WaitRow({ slot }) {
  return (
    <View style={[styles.slot, styles.slotWait]}>
      <Text style={styles.waitText}>Waiting for {slotLabel(slot).replace('Winner of', 'winner of')}</Text>
    </View>
  );
}

export default function MatchCard({ game, match, results, scores = {} }) {
  const { getTeam, setResult, clearResult, isAdmin, canEditGame } = useStore();
  const canEdit = canEditGame(game.id); // admin, or committee assigned to this game
  const [picking, setPicking] = useState(false);
  const [scoring, setScoring] = useState(false);

  const status = matchStatus(match, results);
  const teams = matchTeams(match, results);
  const winner = results[match.no];
  const matchScores = match.scoring ? scores[match.no] : null;
  const isElim = match.roundType === 'elim';
  const out = eliminatedTeams(game, results);

  const nextMatch = allMatches(game).find((m) => m.slots.some((s) => s.w === match.no));
  const affected = downstream(game, match.no).filter((no) => results[no] != null);

  const options = teams
    .filter((t) => t != null)
    .map((t) => {
      const info = getTeam(game.id, t);
      return { key: t, label: `Team ${t}`, sub: info.name || undefined, color: info.color };
    });

  const confirmWinner = (teamNo) => {
    const info = getTeam(game.id, teamNo);
    const body = nextMatch
      ? `${info.label} advances to Game ${nextMatch.no}.`
      : isElim
      ? `${info.label} becomes the Champion!`
      : `${info.label} gets the win.`;
    const warn = winner != null && winner !== teamNo && affected.length ? `\n\nThis will clear the results of Game ${affected.join(', ')} that depend on this match.` : '';
    Alert.alert(`${info.label} wins Game ${match.no}?`, `${body}${warn}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => setResult(game.id, match.no, teamNo) },
    ]);
  };

  const onClear = () => {
    const warn = affected.length ? `\n\nThis also clears the results of Game ${affected.join(', ')}.` : '';
    Alert.alert(`Clear result of Game ${match.no}?`, `The result will be removed.${warn}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearResult(game.id, match.no) },
    ]);
  };

  const openEntry = () => (match.scoring ? setScoring(true) : setPicking(true));

  const renderSlot = (slot, i) => {
    const team = teams[i];
    if (team == null) return <WaitRow key={i} slot={slot} />;
    const isWinner = winner === team;
    const lost = winner != null && !isWinner;
    return (
      <SlotRow
        key={i}
        gameId={game.id}
        team={team}
        isWinner={isWinner}
        lost={lost}
        eliminated={isElim && out.has(team)}
        showLost={!nextMatch && isElim ? 'champion' : 'winner'}
        score={matchScores ? matchScores[i] : null}
      />
    );
  };

  // The action area sits in the CENTER of the card (between the two teams).
  const center = (
    <View style={styles.centerRow}>
      <View style={styles.line} />
      <View style={styles.centerBody}>
        {canEdit && status === 'ready' ? (
          <Button title={match.scoring ? 'Enter points' : 'Select winner'} icon={match.scoring ? 'create' : 'trophy'} onPress={openEntry} />
        ) : null}
        {canEdit && status === 'done' ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title={match.scoring ? 'Edit points' : 'Change'} icon="create-outline" kind="ghost" small onPress={openEntry} />
            {isAdmin ? <Button title="Clear" icon="close-circle-outline" kind="ghostDanger" small onPress={onClear} /> : null}
          </View>
        ) : null}
        {!(canEdit && status !== 'waiting') ? (
          <View style={styles.vs}>
            <Text style={styles.vsText}>VS</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.line} />
    </View>
  );

  const twoSlots = match.slots.length === 2;

  return (
    <View style={[styles.card, status === 'done' && { borderLeftColor: colors.success }, status === 'ready' && { borderLeftColor: colors.accent }]}>
      <View style={styles.head}>
        <Text style={styles.gameNo}>Game {match.no}</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {match.time ? <Chip label={match.time} tone="info" /> : null}
          {match.venue ? <Chip label={match.venue} /> : null}
          {match.scoring ? <Chip label="Points" tone="warn" /> : null}
          <Chip label={status === 'done' ? 'Done' : status === 'ready' ? 'Ready' : 'Waiting'} tone={status === 'done' ? 'success' : status === 'ready' ? 'warn' : 'neutral'} />
        </View>
      </View>

      {twoSlots ? (
        <>
          {renderSlot(match.slots[0], 0)}
          {center}
          {renderSlot(match.slots[1], 1)}
        </>
      ) : (
        <>
          {match.slots.map(renderSlot)}
          {center}
        </>
      )}

      <PickerModal
        visible={picking}
        title={`Who won Game ${match.no}?`}
        options={options}
        onClose={() => setPicking(false)}
        onSelect={(o) => {
          setPicking(false);
          if (o.key === winner) return;
          setTimeout(() => confirmWinner(o.key), 250); // let the sheet close first
        }}
      />

      {match.scoring && status !== 'waiting' ? (
        <ScoreModal
          visible={scoring}
          gameId={game.id}
          match={match}
          teams={teams}
          initialScores={matchScores}
          initialWinner={winner}
          onClose={() => setScoring(false)}
          onSave={(w, sc) => {
            setScoring(false);
            setResult(game.id, match.no, w, sc);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 14, marginBottom: 12, borderLeftWidth: 5, borderLeftColor: colors.border, ...shadow },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 },
  gameNo: { fontSize: 15, fontWeight: '800', color: colors.primary },
  slot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, gap: 8 },
  slotWait: { backgroundColor: colors.waitBg, borderStyle: 'dashed' },
  slotWin: { backgroundColor: colors.successBg, borderColor: colors.success },
  slotLost: { backgroundColor: '#FAFAFA' },
  waitText: { color: colors.muted, fontStyle: 'italic', paddingVertical: 4 },
  score: { fontSize: 26, fontWeight: '900', color: colors.text, minWidth: 34, textAlign: 'center' },
  centerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  centerBody: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  vs: { backgroundColor: colors.waitBg, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  vsText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: colors.muted },
});
