import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Trophy } from './GameIcon';
import { deptColor } from '../data/departments';
import { font } from '../fonts';
import { colors, radius } from '../theme';

const MEDAL = { 1: colors.gold, 2: '#CBD5E1', 3: '#D79A5B' };
const HEIGHT = { 1: 150, 2: 112, 3: 92 };

// Top 3 of the ranking. Column height = rank (teams on the same rank stand at the same height).
export default function Podium({ teams }) {
  if (!teams.length) return null;
  const order = teams.length >= 3 ? [teams[1], teams[0], teams[2]] : teams.length === 2 ? [teams[1], teams[0]] : [teams[0]];
  return (
    <View style={styles.wrap}>
      {order.map((t) => {
        const rank = Math.min(t.rank, 3);
        return (
          <View key={t.key} style={styles.col}>
            {t.rank === 1 ? <Trophy size={26} color={colors.gold} /> : <View style={{ height: 26 }} />}
            <Text style={styles.name} numberOfLines={1}>
              {t.name}
            </Text>
            <Text style={styles.dept} numberOfLines={1}>
              {t.department || 'No department'}
            </Text>
            <View style={[styles.block, { height: HEIGHT[rank], backgroundColor: colors.night }]}>
              <View style={[styles.cap, { backgroundColor: deptColor(t.department) }]} />
              <Text style={[styles.rank, { color: MEDAL[rank] }]}>{t.rank}</Text>
              <Text style={styles.percent}>{t.percent}%</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 14, marginBottom: 6 },
  col: { flex: 1, alignItems: 'center' },
  name: { fontFamily: font.display, fontSize: 20, color: colors.text, marginTop: 2, maxWidth: '100%' },
  dept: { fontSize: 11, fontWeight: '700', color: colors.muted, marginBottom: 6, maxWidth: '100%' },
  block: { width: '100%', borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cap: { position: 'absolute', top: 0, left: 0, right: 0, height: 6 },
  rank: { fontFamily: font.display, fontSize: 52, lineHeight: 54 },
  percent: { fontFamily: font.bold, fontSize: 20, color: '#E0E7FF', marginTop: -2 },
});
