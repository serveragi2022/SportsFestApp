import React, { useRef } from 'react';
import { Animated, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../theme';

// Wrapper that springs down when pressed (and gives a light tap feedback on phones).
// `style` is applied to the outer animated view (so flex / margins work), `innerStyle` to the pressable.
export function PressableScale({ onPress, disabled, style, innerStyle, children, scaleTo = 0.95, haptic = true, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 60, bounciness: 7 }).start();
  return (
    <Animated.View style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.45 }]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={() => to(scaleTo)}
        onPressOut={() => to(1)}
        onPress={(e) => {
          if (haptic) {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            } catch (err) {
              // not supported
            }
          }
          if (onPress) onPress(e);
        }}
        style={innerStyle}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function Card({ style, children }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const KINDS = {
  primary: { grad: ['#2F5BE0', '#1E40AF'], glow: '#1E40AF', fg: '#fff' },
  accent: { grad: ['#FB923C', '#EA580C'], glow: '#EA580C', fg: '#fff' },
  danger: { grad: ['#EF4444', '#B91C1C'], glow: '#B91C1C', fg: '#fff' },
  success: { grad: ['#22C55E', '#15803D'], glow: '#15803D', fg: '#fff' },
};

export function Button({ title, onPress, kind = 'primary', small, disabled, style, icon }) {
  const ghost = kind === 'ghost' || kind === 'ghostDanger';
  const tone = ghost ? (kind === 'ghostDanger' ? colors.danger : colors.primary) : null;
  const k = KINDS[kind];
  const content = (
    <>
      {icon ? <Ionicons name={icon} size={small ? 15 : 18} color={ghost ? tone : k.fg} style={{ marginRight: 7 }} /> : null}
      <Text style={[styles.btnText, small && { fontSize: 13 }, { color: ghost ? tone : k.fg }]}>{title}</Text>
    </>
  );
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.94}
      style={[
        { borderRadius: small ? radius.sm + 2 : radius.md + 2 },
        !ghost && !disabled && { shadowColor: k.glow, shadowOpacity: 0.35, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
        style,
      ]}
    >
      {ghost ? (
        <View style={[styles.btn, small && styles.btnSmall, { borderWidth: 1.5, borderColor: tone, backgroundColor: '#fff', borderRadius: small ? radius.sm + 2 : radius.md + 2 }]}>{content}</View>
      ) : (
        <LinearGradient colors={k.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.btn, small && styles.btnSmall, { borderRadius: small ? radius.sm + 2 : radius.md + 2 }]}>
          {content}
        </LinearGradient>
      )}
    </PressableScale>
  );
}

export function Chip({ label, tone = 'neutral', style }) {
  const map = {
    neutral: [colors.waitBg, colors.muted],
    success: [colors.successBg, colors.success],
    warn: [colors.warnBg, colors.warn],
    danger: [colors.dangerBg, colors.danger],
    info: ['#DBEAFE', colors.primary],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.chip, { backgroundColor: bg }, style]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function FilterChip({ label, active, onPress }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.92} haptic={false} style={{ marginRight: 8 }} innerStyle={[styles.filter, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      <Text style={[styles.filterText, active && { color: '#fff' }]}>{label}</Text>
    </PressableScale>
  );
}

export function ProgressBar({ done, total, color = colors.accent }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => (
        <PressableScale key={o.key} onPress={() => onChange(o.key)} scaleTo={0.94} haptic={false} style={{ flex: 1 }} innerStyle={[styles.segItem, value === o.key && styles.segActive]}>
          <Text style={[styles.segText, value === o.key && { color: '#fff' }]}>{o.label}</Text>
        </PressableScale>
      ))}
    </View>
  );
}

// Bottom-sheet style list picker.
// options: [{ key, label, sub?, color?, disabled? }]
export function PickerModal({ visible, title, options, onSelect, onClose, footer }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <SafeAreaView edges={['bottom']}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.sheetClose}>Close</Text>
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(o) => String(o.key)}
            style={{ maxHeight: 420 }}
            ListEmptyComponent={<Text style={styles.empty}>Nothing to choose from yet.</Text>}
            renderItem={({ item }) => (
              <Pressable
                disabled={item.disabled}
                onPress={() => onSelect(item)}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.waitBg }, item.disabled && { opacity: 0.4 }]}
              >
                {item.color ? <View style={[styles.optDot, { backgroundColor: item.color }]} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.optLabel}>{item.label}</Text>
                  {item.sub ? <Text style={styles.optSub}>{item.sub}</Text> : null}
                </View>
              </Pressable>
            )}
          />
          {footer}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export function TextPromptModal({ visible, title, value, onChangeText, onSave, onClose, saveLabel = 'Save', children, placeholder = 'Team name', allowEmpty = false }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.dialogWrap} pointerEvents="box-none">
        <View style={styles.dialog}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={onSave}
          />
          {children}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Button title="Cancel" kind="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button title={saveLabel} onPress={onSave} style={{ flex: 1 }} disabled={!allowEmpty && !String(value).trim()} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, ...shadow },
  btn: { paddingVertical: 13, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 13 },
  btnText: { fontWeight: '700', fontSize: 15 },
  chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  chipText: { fontSize: 11, fontWeight: '700' },
  filter: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  filterText: { fontWeight: '600', color: colors.text, fontSize: 13 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  segment: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: radius.md, padding: 3 },
  segItem: { paddingVertical: 9, alignItems: 'center', borderRadius: radius.sm },
  segActive: { backgroundColor: colors.primary },
  segText: { fontWeight: '700', fontSize: 13, color: colors.muted },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 8 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  sheetClose: { color: colors.primary, fontWeight: '700' },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  optDot: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
  optLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  optSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  empty: { padding: 24, textAlign: 'center', color: colors.muted },
  dialogWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 18 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginTop: 12, color: colors.text },
});
