import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../store';
import { winnerFromScores } from '../engine';
import TeamChip from './TeamChip';
import { Button, PressableScale } from './ui';
import { colors, radius } from '../theme';

const toNum = (v) => (v === '' || v == null ? null : /^\d+$/.test(String(v).trim()) ? parseInt(v, 10) : null);

// Enter the points of BOTH teams. The team with more points wins; if equal, the admin picks the winner.
export default function ScoreModal({ visible, gameId, match, teams, initialScores, initialWinner, onClose, onSave }) {
  const { getTeam } = useStore();
  const [vals, setVals] = useState(['', '']);
  const [tieWinner, setTieWinner] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setVals(initialScores ? [String(initialScores[0]), String(initialScores[1])] : ['', '']);
    setTieWinner(initialScores && initialScores[0] === initialScores[1] ? initialWinner : null);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const nums = [toNum(vals[0]), toNum(vals[1])];
  const filled = nums[0] != null && nums[1] != null;
  const tie = filled && nums[0] === nums[1];
  const auto = filled ? winnerFromScores(teams, nums) : null;
  const winner = tie ? tieWinner : auto;

  const setVal = (i, v) => setVals((cur) => cur.map((x, j) => (j === i ? v.replace(/[^0-9]/g, '') : x)));
  const bump = (i, d) => setVals((cur) => cur.map((x, j) => (j === i ? String(Math.max(0, (toNum(x) || 0) + d)) : x)));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap} pointerEvents="box-none">
        <View style={styles.dialog}>
          <Text style={styles.title}>Game {match.no} · Enter points</Text>
          <Text style={styles.sub}>Type the points of both teams. The higher points wins.</Text>

          {teams.map((t, i) => (
            <View key={i} style={[styles.row, winner === t && styles.rowWin]}>
              <View style={{ flex: 1 }}>
                <TeamChip gameId={gameId} teamNo={t} bold={winner === t} />
              </View>
              <PressableScale onPress={() => bump(i, -1)} scaleTo={0.85} style={styles.stepOuter} innerStyle={styles.step}>
                <Text style={styles.stepText}>−</Text>
              </PressableScale>
              <TextInput value={vals[i]} onChangeText={(v) => setVal(i, v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.muted} style={styles.input} maxLength={4} selectTextOnFocus />
              <PressableScale onPress={() => bump(i, 1)} scaleTo={0.85} style={styles.stepOuter} innerStyle={styles.step}>
                <Text style={styles.stepText}>+</Text>
              </PressableScale>
            </View>
          ))}

          <View style={styles.result}>
            {!filled ? (
              <Text style={styles.hint}>Enter the points of both teams.</Text>
            ) : tie ? (
              <View style={{ alignItems: 'center', width: '100%' }}>
                <Text style={[styles.hint, { color: colors.warn, fontWeight: '800' }]}>Same points. Choose the winner:</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  {teams.map((t) => (
                    <Button key={t} title={getTeam(gameId, t).label.split(' · ')[0]} kind={tieWinner === t ? 'success' : 'ghost'} small onPress={() => setTieWinner(t)} />
                  ))}
                </View>
              </View>
            ) : (
              <Text style={[styles.hint, { color: colors.success, fontWeight: '800' }]}>Winner: {getTeam(gameId, auto).label}</Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Button title="Cancel" kind="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Save result" icon="checkmark-circle" kind="success" disabled={winner == null} onPress={() => onSave(winner, [nums[0], nums[1]])} style={{ flex: 1.4 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.55)' },
  wrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', padding: 20 },
  dialog: { backgroundColor: '#fff', borderRadius: 22, padding: 18 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  sub: { color: colors.muted, textAlign: 'center', marginTop: 4, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: 10, marginBottom: 8, gap: 6 },
  rowWin: { borderColor: colors.success, backgroundColor: colors.successBg },
  stepOuter: {},
  step: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.waitBg, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 22, fontWeight: '800', color: colors.primary, marginTop: -2 },
  input: { width: 62, height: 46, textAlign: 'center', fontSize: 22, fontWeight: '800', color: colors.text, borderRadius: radius.sm, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border },
  result: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  hint: { color: colors.muted, textAlign: 'center' },
});
