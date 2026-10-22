import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Trophy } from './GameIcon';
import { deptColor } from '../data/departments';
import { font } from '../fonts';
import { colors, radius } from '../theme';

// Home header: a small scoreboard. Big = the leading team. Under it one tick per match (gold = played).
export default function HeroBoard({ leaders, done, total, decided, games, onLive }) {
  const lead = leaders[0];
  return (
    <LinearGradient colors={[colors.night, '#1E3A8A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.wrap}>
      <View style={styles.top}>
        <Text style={styles.title}>AGI Sports Fest 2026</Text>
        <Pressable onPress={onLive} style={styles.live} hitSlop={8} accessibilityRole="button" accessibilityLabel="Open the live board">
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live board</Text>
          <Ionicons name="chevron-forward" size={14} color="#fff" />
        </Pressable>
      </View>

      {lead ? (
        <View style={styles.leadRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Trophy size={16} color={colors.gold} />
              <Text style={styles.small}>{leaders.length > 1 ? `Leading teams (${leaders.length} tied)` : 'Leading team'}</Text>
            </View>
            <Text style={[styles.leadName, leaders.length > 1 && { fontSize: 26, lineHeight: 30 }]} numberOfLines={2}>
              {leaders.map((l) => l.name).join(' · ')}
            </Text>
            <View style={styles.deptRow}>
              <View style={[styles.deptBar, { backgroundColor: deptColor(lead.department) }]} />
              <Text style={styles.dept}>{leaders.length > 1 ? leaders.map((l) => l.department || '-').join(' · ') : lead.department || 'No department'}</Text>
            </View>
          </View>
          <Text style={styles.percent}>
            {lead.percent}
            <Text style={styles.percentSign}>%</Text>
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: 14 }}>
          <Text style={styles.leadName}>No champion yet</Text>
          <Text style={styles.small}>The first team to win a game takes the lead.</Text>
        </View>
      )}

      <View style={styles.ticks}>
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={[styles.tick, i < done && styles.tickDone]} />
        ))}
      </View>
      <Text style={styles.small}>
        {done} of {total} matches played · {decided} of {games} champions
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, padding: 18, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#C7D2FE', fontWeight: '800', fontSize: 14 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingVertical: 5, paddingLeft: 10, paddingRight: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F87171' },
  liveText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  leadRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 14, gap: 10 },
  small: { color: '#BFD0FF', fontSize: 12, fontWeight: '600' },
  leadName: { color: '#fff', fontFamily: font.display, fontSize: 40, lineHeight: 44, marginTop: 2 },
  deptRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  deptBar: { width: 4, height: 16, borderRadius: 2 },
  dept: { color: '#E0E7FF', fontWeight: '800', fontSize: 14 },
  percent: { color: colors.gold, fontFamily: font.display, fontSize: 64, lineHeight: 64 },
  percentSign: { fontSize: 30 },
  ticks: { flexDirection: 'row', gap: 1.5, marginTop: 16, marginBottom: 8, height: 12 },
  tick: { flex: 1, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  tickDone: { backgroundColor: colors.gold },
});
