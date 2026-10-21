import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DEPARTMENTS } from '../data/departments';
import { EVENT_BY_ID, PLACE_POINTS, ordinal } from '../data/events';
import GameIcon from '../components/GameIcon';
import { Card, Chip, PickerModal, PressableScale } from '../components/ui';
import { useStore } from '../store';
import { colors, radius } from '../theme';

// Cheer Dance / Muse: which DEPARTMENT finished 1st ... 8th. Admin, or the committee assigned to the event, can encode it.
// A department with no place did not take part (0 points). The points only break a tie in the overall team ranking.
export default function EventScreen({ route }) {
  const eventId = route.params.eventId;
  const event = EVENT_BY_ID[eventId];
  const { state, canEditGame, setPlacement } = useStore();
  const canEdit = canEditGame(eventId);
  const byPlace = state.placements[eventId] || {};
  const [place, setPlace] = useState(null); // place being edited

  const taken = new Set(Object.values(byPlace));
  const depts = [...new Set([...DEPARTMENTS, ...Object.values(byPlace)])];
  const options = depts.map((d) => ({
    key: d,
    label: d,
    sub: taken.has(d) && byPlace[place] !== d ? `already ${ordinal(Number(Object.keys(byPlace).find((k) => byPlace[k] === d)))} place - tap to move here` : undefined,
  }));
  const participants = depts.filter((d) => !taken.has(d));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.hero}>
        <GameIcon id={eventId} size={34} color="#fff" />
        <Text style={styles.heroTitle}>{event.name}</Text>
        <Text style={styles.heroSub}>Winners are per department. The standing points are only the final tie-breaker of the overall ranking.</Text>
      </View>
      {!canEdit ? (
        <View style={styles.viewOnly}>
          <Text style={styles.viewOnlyText}>View only. Only the admin or the assigned committee can encode the standings.</Text>
        </View>
      ) : null}

      {PLACE_POINTS.map((pts, i) => {
        const p = i + 1;
        const dept = byPlace[p];
        return (
          <PressableScale key={p} disabled={!canEdit} haptic={false} scaleTo={0.98} onPress={() => setPlace(p)} style={{ marginBottom: 8 }}>
            <Card style={styles.row}>
              <View style={[styles.badge, p <= 3 && { backgroundColor: ['#D4A017', '#94A3B8', '#B7791F'][p - 1] }]}>
                <Text style={styles.badgeText}>{p}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.place}>{ordinal(p)} place</Text>
                <Text style={[styles.dept, !dept && { color: colors.muted, fontWeight: '600' }]}>{dept || (canEdit ? 'Tap to choose a department' : 'Not set')}</Text>
              </View>
              <Chip label={`${pts} pts`} tone={dept ? 'success' : 'neutral'} />
            </Card>
          </PressableScale>
        );
      })}
      <Text style={styles.foot}>No participation: {participants.length ? participants.join(', ') : 'none'} (0 points)</Text>

      <PickerModal
        visible={place != null}
        title={place ? `Department for ${ordinal(place)} place` : ''}
        options={options}
        onClose={() => setPlace(null)}
        onSelect={(o) => {
          setPlacement(eventId, place, o.key);
          setPlace(null);
        }}
        footer={
          place && byPlace[place] ? (
            <View style={{ padding: 12 }}>
              <Text
                style={styles.clear}
                onPress={() => {
                  setPlacement(eventId, place, '');
                  setPlace(null);
                }}
              >
                Clear this place
              </Text>
            </View>
          ) : null
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 18, marginBottom: 12, gap: 6 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  heroSub: { color: '#DBEAFE', fontWeight: '600', fontSize: 12, lineHeight: 17 },
  viewOnly: { backgroundColor: colors.warnBg, borderRadius: 10, padding: 10, marginBottom: 10 },
  viewOnlyText: { color: colors.warn, fontWeight: '700', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  badge: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontWeight: '900' },
  place: { fontSize: 12, color: colors.muted, fontWeight: '700' },
  dept: { fontSize: 16, fontWeight: '800', color: colors.text },
  foot: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  clear: { color: colors.danger || '#DC2626', fontWeight: '800', textAlign: 'center', padding: 8 },
});
