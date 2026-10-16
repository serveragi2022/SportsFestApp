import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useStore } from '../store';
import { colors } from '../theme';

// Team number badge + team name. The number is the real identity, the name is only a label,
// so two slots with the same name (e.g. Team 1 and Team 2 are both "Production") stay distinguishable.
export default function TeamChip({ gameId, teamNo, dim, bold, compact }) {
  const { getTeam } = useStore();
  const team = getTeam(gameId, teamNo);
  return (
    <View style={[styles.row, dim && { opacity: 0.45 }]}>
      <View style={[styles.badge, { backgroundColor: team.color }]}>
        <Text style={styles.badgeText}>{teamNo}</Text>
      </View>
      {compact ? (
        <Text numberOfLines={1} style={[styles.name, bold && { fontWeight: '800' }]}>
          {team.name ? team.name : `Team ${teamNo}`}
        </Text>
      ) : (
        <View style={{ flexShrink: 1 }}>
          <Text style={[styles.title, bold && { fontWeight: '800' }]}>Team {teamNo}</Text>
          {team.name ? (
            <Text numberOfLines={1} style={styles.name}>
              {team.name}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  badge: { minWidth: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 10, paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  name: { fontSize: 13, color: colors.muted, flexShrink: 1 },
});
