import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GAMES } from '../data/games';
import { deptColor } from '../data/departments';
import { allMatches, getChampion, matchStatus, matchTeams } from '../engine';
import { computeStandings, rankByPercent } from '../standings';
import { useStore } from '../store';
import GameIcon, { Trophy } from '../components/GameIcon';
import { font } from '../fonts';
import { colors } from '../theme';

const PANELS = ['Standings', 'Up next', 'Champions'];
const SECONDS = 10;

// Full-screen board for a TV / projector. Rotates: Standings, Up next, Champions. Tap = next panel.
// On the web it is also at /live.
export default function LiveBoardScreen({ navigation }) {
  const { state, getTeam, matchTime } = useStore();
  const { width, height } = useWindowDimensions();
  const u = Math.max(0.62, Math.min(width / 900, height / 600, 2.4)); // everything scales with the screen
  const T = (n) => ({ fontSize: s(n), lineHeight: s(Math.round(n * 1.1)) });
  const s = (n) => Math.round(n * u);

  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(new Date());
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % PANELS.length), SECONDS * 1000);
    return () => clearInterval(t);
  }, [index]); // restarts after a manual tap
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [index, fade]);

  const ranked = useMemo(() => rankByPercent(computeStandings(state)), [state]);
  const anyWon = ranked.some((r) => r.percent > 0);

  const ready = useMemo(() => {
    const out = [];
    GAMES.forEach((g) => {
      const results = state.results[g.id] || {};
      allMatches(g).forEach((m) => {
        if (matchStatus(m, results) === 'ready') out.push({ game: g, match: m, teams: matchTeams(m, results) });
      });
    });
    return out.slice(0, 6);
  }, [state.results]);

  const champs = useMemo(
    () =>
      GAMES.map((g) => {
        const c = getChampion(g, state.results[g.id] || {}, state.tiebreak[g.id], (state.scores && state.scores[g.id]) || {}).champion;
        return { game: g, info: c != null ? getTeam(g.id, c) : null };
      }),
    [state, getTeam]
  );

  const clock = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <Pressable style={styles.screen} onPress={() => setIndex((i) => (i + 1) % PANELS.length)}>
      <View style={[styles.header, { paddingHorizontal: s(28), paddingTop: s(22), paddingBottom: s(8) }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
          <View style={[styles.liveDot, { width: s(12), height: s(12), borderRadius: s(6) }]} />
          <Text style={[styles.brand, { fontSize: s(30) }]}>AGI Sports Fest 2026</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(16) }}>
          <Text style={[styles.clock, { fontSize: s(30) }]}>{clock}</Text>
          <Pressable onPress={() => navigation.replace('Tabs')} hitSlop={12} accessibilityLabel="Close the live board" style={styles.close}>
            <Ionicons name="close" size={Math.max(16, s(20))} color="#94A3B8" />
          </Pressable>
        </View>
      </View>

      <Animated.View style={{ flex: 1, opacity: fade, paddingHorizontal: s(28), paddingBottom: s(8) }}>
        <Text style={[styles.panelTitle, T(46)]}>{PANELS[index]}</Text>

        {index === 0 ? (
          <View style={{ flex: 1, marginTop: s(10), gap: s(6) }}>
            {ranked.slice(0, 8).map((r) => (
              <View key={r.key} style={[styles.row, { gap: s(14) }]}>
                <Text style={[styles.rank, T(40), { width: s(54), color: anyWon && r.rank === 1 && r.percent > 0 ? colors.gold : '#64748B' }]}>{anyWon && r.percent > 0 ? r.rank : '–'}</Text>
                <View style={{ width: s(7), alignSelf: 'stretch', borderRadius: 4, backgroundColor: deptColor(r.department), marginVertical: s(8) }} />
                <View style={{ width: s(330) }}>
                  <Text style={[styles.name, T(34)]} numberOfLines={1}>{r.name}</Text>
                  <Text style={[styles.dept, T(13)]} numberOfLines={1}>{r.department || 'No department'}</Text>
                </View>
                <View style={[styles.track, { height: s(18), borderRadius: s(9) }]}>
                  <View style={{ width: `${r.percent}%`, height: '100%', borderRadius: s(9), backgroundColor: deptColor(r.department) }} />
                </View>
                <Text style={[styles.percent, T(38), { width: s(110) }, r.percent === 0 && { color: '#475569' }]}>{r.percent}%</Text>
              </View>
            ))}
          </View>
        ) : null}

        {index === 1 ? (
          ready.length ? (
            <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: s(14), marginTop: s(10), alignContent: 'flex-start' }}>
              {ready.map(({ game, match, teams }) => {
                const time = matchTime(game.id, match);
                return (
                  <View key={`${game.id}-${match.no}`} style={[styles.card, { width: width > 700 ? '48.6%' : '100%', padding: s(12) }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
                      <GameIcon id={game.id} size={s(30)} color="#93C5FD" />
                      <Text style={[styles.cardGame, T(24)]} numberOfLines={1}>{game.short || game.name} · Game {match.no}</Text>
                      <View style={{ flex: 1 }} />
                      {time ? <Text style={[styles.time, T(24)]}>{time}</Text> : null}
                    </View>
                    {teams.map((t, i) => {
                      const info = getTeam(game.id, t);
                      return (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), marginTop: s(4) }}>
                          <View style={{ width: s(6), height: s(22), borderRadius: 3, backgroundColor: deptColor(info.department) }} />
                          <Text style={[styles.name, T(26)]} numberOfLines={1}>{info.name || `Team ${t}`}</Text>
                          {info.department ? <Text style={[styles.dept, { fontSize: s(15) }]}>{info.department}</Text> : null}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={[styles.empty, { fontSize: s(40) }]}>No game is ready right now</Text>
              <Text style={[styles.dept, { fontSize: s(20), marginTop: s(8) }]}>The next games start when the winners are known.</Text>
            </View>
          )
        ) : null}

        {index === 2 ? (
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: s(12), marginTop: s(10), alignContent: 'flex-start' }}>
            {champs.map(({ game, info }) => (
              <View key={game.id} style={[styles.tile, { width: width > 700 ? '31.8%' : '48%', padding: s(14), borderTopColor: info ? deptColor(info.department) : '#1E293B' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                  <GameIcon id={game.id} size={s(22)} color={info ? colors.gold : '#475569'} />
                  <Text style={[styles.dept, { fontSize: s(16) }]} numberOfLines={1}>{game.short || game.name}</Text>
                </View>
                {info ? (
                  <>
                    <Text style={[styles.name, { fontSize: s(32), marginTop: s(4) }]} numberOfLines={1}>{info.name || `Team ${info.no}`}</Text>
                    <Text style={[styles.dept, { fontSize: s(14) }]} numberOfLines={1}>{info.department || ''}</Text>
                  </>
                ) : (
                  <Text style={[styles.name, { fontSize: s(32), marginTop: s(4), color: '#334155' }]}>—</Text>
                )}
              </View>
            ))}
          </View>
        ) : null}
      </Animated.View>

      <View style={[styles.footer, { paddingBottom: s(16), gap: s(10) }]}>
        {PANELS.map((p, i) => (
          <View key={p} style={{ width: i === index ? s(34) : s(10), height: s(6), borderRadius: 3, backgroundColor: i === index ? colors.gold : '#334155' }} />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveDot: { backgroundColor: '#F87171' },
  brand: { color: '#C7D2FE', fontFamily: font.bold },
  clock: { color: '#fff', fontFamily: font.display },
  close: { padding: 4 },
  panelTitle: { color: '#fff', fontFamily: font.display },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, paddingRight: 12, maxHeight: 96, overflow: 'hidden' },
  rank: { fontFamily: font.display, textAlign: 'center' },
  name: { color: '#fff', fontFamily: font.display, flexShrink: 1 },
  dept: { color: '#94A3B8', fontWeight: '700' },
  track: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  percent: { color: colors.gold, fontFamily: font.display, textAlign: 'right' },
  card: { backgroundColor: colors.night2, borderRadius: 14 },
  cardGame: { color: '#E2E8F0', fontFamily: font.bold, flexShrink: 1 },
  time: { color: colors.gold, fontFamily: font.display },
  tile: { backgroundColor: colors.night2, borderRadius: 12, borderTopWidth: 5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#fff', fontFamily: font.display, textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
