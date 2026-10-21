import React from 'react';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

// offline: no connection. pending: changes saved on this device that are not on the server yet.
export default function OfflineBanner({ visible, offline, pending = 0, onRetry }) {
  if (!visible && !pending) return null;
  const msg = offline
    ? pending
      ? `Offline — ${pending} change${pending > 1 ? 's' : ''} saved on this phone, will send when back online`
      : 'Offline — showing the last saved scores'
    : `${pending} change${pending > 1 ? 's' : ''} waiting to be sent…`;
  return (
    <View style={styles.wrap}>
      <Ionicons name={offline ? 'cloud-offline-outline' : 'sync-outline'} size={14} color="#fff" style={{ marginRight: 6 }} />
      <Text style={[styles.text, { flexShrink: 1, textAlign: 'center' }]}>{msg}</Text>
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
