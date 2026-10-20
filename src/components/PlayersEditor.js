import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from './ui';
import { colors, radius, shadow } from '../theme';

// Admin: type the players of one team, one name per line (for example 2 lines for doubles).
export default function PlayersEditor({ visible, title, players, onSave, onClose }) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (visible) setText((players || []).join('\n'));
  }, [visible, players]);

  const names = text
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap} pointerEvents="box-none">
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>One player per line (up to 10). Leave empty to remove the players.</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={5}
            placeholder={'Juan Dela Cruz\nMaria Santos'}
            placeholderTextColor={colors.muted}
            autoFocus
            style={styles.input}
          />
          <Text style={styles.count}>{names.length} player{names.length === 1 ? '' : 's'}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Button title="Cancel" kind="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Save players" icon="checkmark-circle" kind="success" onPress={() => onSave(names)} style={{ flex: 1.4 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.55)' },
  wrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', padding: 18 },
  dialog: { backgroundColor: '#fff', borderRadius: 22, padding: 18, ...shadow },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  hint: { color: colors.muted, fontSize: 13, marginTop: 6, marginBottom: 10, textAlign: 'center' },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, color: colors.text, minHeight: 120, textAlignVertical: 'top' },
  count: { color: colors.muted, fontSize: 12, marginTop: 6, textAlign: 'right' },
});
