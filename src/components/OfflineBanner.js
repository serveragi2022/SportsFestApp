import React from 'react';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

export default function OfflineBanner({ visible, onRetry }) {
  if (!visible) return null;
  return (
    <View style={styles.wrap}>
      <Ionicons name="cloud-offline-outline" size={14} color="#fff" style={{ marginRight: 6 }} />
      <Text style={styles.text}>Offline — scores will sync when back online</Text>
      {onRetry ? (
        <Text onPress={onRetry} style={styles.retry}>Retry</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#0F172A',
    paddingVertical: 7,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: '#fff', fontSize: 12, fontWeight: '700' },
  retry: { color: '#93C5FD', fontSize: 12, fontWeight: '800', marginLeft: 10, textDecorationLine: 'underline' },
});
