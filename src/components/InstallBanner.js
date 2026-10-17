import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui';
import { colors, radius, shadow } from '../theme';

// "Install app" card for the web version (PWA). Android/Chrome: one tap. iPhone/Safari: shows the steps
// (Share > Add to Home Screen). Hidden when the app is already installed, or after the user closes it.
const KEY = 'agi-install-hidden';

const isStandalone = () => {
  try {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  } catch (e) {
    return false;
  }
};

export default function InstallBanner() {
  const [ready, setReady] = useState(false); // Android/Chrome prompt available
  const [hidden, setHidden] = useState(true);
  const [mode, setMode] = useState(null); // 'prompt' | 'ios' | 'ios-other' | 'manual'

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    let closed = false;
    try {
      closed = window.localStorage.getItem(KEY) === '1';
    } catch (e) {
      closed = false;
    }
    if (closed || isStandalone()) return undefined;

    const ua = window.navigator.userAgent || '';
    const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1);
    const safari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line|GSA/i.test(ua);
    const android = /Android/i.test(ua);

    const onReady = () => {
      setReady(true);
      setMode('prompt');
      setHidden(false);
    };
    const onInstalled = () => setHidden(true);

    if (window.__installPrompt) onReady();
    else if (ios) {
      setMode(safari ? 'ios' : 'ios-other');
      setHidden(false);
    } else if (android) {
      // prompt not offered (yet): show the manual hint
      setMode('manual');
      setHidden(false);
    }
    window.addEventListener('agi-install-ready', onReady);
    window.addEventListener('agi-installed', onInstalled);
    return () => {
      window.removeEventListener('agi-install-ready', onReady);
      window.removeEventListener('agi-installed', onInstalled);
    };
  }, []);

  if (Platform.OS !== 'web' || hidden || !mode) return null;

  const close = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(KEY, '1');
    } catch (e) {
      // ignore
    }
  };

  const install = async () => {
    const p = window.__installPrompt;
    if (!p) return;
    p.prompt();
    try {
      await p.userChoice;
    } catch (e) {
      // ignore
    }
    window.__installPrompt = null;
    setReady(false);
    setHidden(true);
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name="download-outline" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Install the app</Text>
          {mode === 'prompt' ? <Text style={styles.text}>Add AGI Sports Fest 2026 to your home screen. Opens like an app, no browser bar.</Text> : null}
          {mode === 'ios' ? (
            <Text style={styles.text}>
              Tap the <Text style={styles.b}>Share</Text> button at the bottom of Safari, then <Text style={styles.b}>Add to Home Screen</Text>, then <Text style={styles.b}>Add</Text>.
            </Text>
          ) : null}
          {mode === 'ios-other' ? <Text style={styles.text}>On iPhone, open this link in <Text style={styles.b}>Safari</Text>, then tap Share, then Add to Home Screen.</Text> : null}
          {mode === 'manual' ? (
            <Text style={styles.text}>
              In Chrome, tap the <Text style={styles.b}>⋮ menu</Text>, then <Text style={styles.b}>Install app</Text> (or Add to Home screen).
            </Text>
          ) : null}
        </View>
        <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close">
          <Ionicons name="close" size={22} color={colors.muted} />
        </Pressable>
      </View>
      {mode === 'prompt' && ready ? <Button title="Install" icon="download" kind="accent" onPress={install} style={{ marginTop: 12 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: colors.accent, ...shadow },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '800', fontSize: 16, color: colors.text },
  text: { color: colors.muted, marginTop: 2, lineHeight: 19, fontSize: 13 },
  b: { fontWeight: '800', color: colors.text },
});
