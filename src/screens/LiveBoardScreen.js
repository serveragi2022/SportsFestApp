import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GAMES } from '../data/games';
import { deptColor } from '../data/departments';
import { gameProgress, getChampion } from '../engine';
import { computeStandings, rankByPercent } from '../standings';
import { useStore } from '../store';
import GameIcon, { Trophy } from '../components/GameIcon';
import { font } from '../fonts';
import { colors } from '../theme';

const SECONDS = 10;

// Split a list into pages of nearly the same size (17 teams on 2 pages -> 9 + 8, not 16 + 1).
function chunkEven(list, perPage) {
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  const size = Math.ceil(list.length / pages);
  return Array.from({ length: pages }, (_, i) => list.slice(i * size, (i + 1) * size));
}

// Full-screen board for a TV / projector. Rotates: Standings (ALL teams, on several pages if the screen is small),
// Game progress, Champions. All games run at the same time, so there is no "Up next" panel. Tap = next panel.
// On the web it is also at /live.
export default function LiveBoardScreen({ navigation }) {
  const { state, getTeam } = useStore();
  const { width, height } = useWindowDimensions();
  const u = Math.max(0.62, Math.min(width / 900, height / 600, 2.4)); // everything scales with the screen
  const T = (n) => ({ fontSize: s(n), lineHeight: s(Math.round(n * 1.1)) });
  const s = (n) => Math.round(n * u);

  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(new Date());
  const fade = useRef(new Animated.Value(1)).current;

  const ranked = useMemo(() => rankByPercent(computeStandings(state)), [state]);
  const anyWon = ranked.some((r) => r.percent > 0);

  // How many team rows fit: 2 columns on a wide screen, rows at least s(40) high.
  const cols = width >= 700 ? 2 : 1;
  const listHeight = height - s(190);
  const rowsPerCol = Math.max(3, Math.floor(listHeight / (s(40) + s(3))));
  const pages = useMemo(() => chunkEven(ranked, rowsPerCol * cols), [ranked, rowsPerCol, cols]);

  const slides = useMemo(
    () => [
      ...pages.map((rows, i) => ({ key: `standings-${i}`, kind: 'standings', title: pages.length > 1 ? `Standings ${i + 1}/${pages.length}` : 'Standings', rows })),
      { key: 'progress', kind: 'progress', title: 'Game progress' },
      { key: 'champions', kind: 'champions', title: 'Champions' },
    ],
    [pages]
  );
  const slide = slides[index % slides.length];
  const next = () => setIndex((i) => (i + 1) % slides.length);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), SECONDS * 1000);
    return () => clearInterval(t);
  }, [index, slides.length]); // restarts after a manual tap
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [index, fade]);

  // one tile per game: the round being played now + matches done
  const progress = useMemo(
    () =>
      GAMES.map((g) => {
        const results = state.results[g.id] || {};
        const p = gameProgress(g, results);
        const c = getChampion(g, results, state.tiebreak[g.id], (state.scores && state.scores[g.id]) || {}).champion;
        const round = g.rounds.find((r) => r.matches.some((m) => results[m.no] == null));
        const roundName = c != null ? 'Completed' : round ? round.name.replace(/^Round \d+: /, '') : 'Waiting for the champion';
        return { game: g, done: p.done, total: p.total, roundName, champion: c != null ? getTeam(g.id, c) : null };
      }),
    [state, getTeam]
  );

  const champs = useMemo(
    () =>
      GAMES.map((g) => {
        const c = getChampion(g, state.results[g.id] || {}, state.tiebreak[g.id], (state.scores && state.scores[g.id]) || {}).champion;
        return { game: g, info: c != null ? getTeam(g.id, c) : null };
      }),
    [state, getTeam]
  );

  const clock = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const twoCols = cols === 2;

  // one team row of the standings
  const renderRow = (r) => (
    <View key={r.key} style={[styles.row, { gap: s(10), minHeight: s(40) }]}>
      <Text style={[styles.rank, T(30), { width: s(40), color: anyWon && r.rank === 1 && r.percent > 0 ? colors.gold : '#64748B' }]}>{anyWon && r.percent > 0 ? r.rank : '–'}</Text>
      <View style={{ width: s(6), alignSelf: 'stretch', borderRadius: 4, backgroundColor: deptColor(r.department), marginVertical: s(6) }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.name, T(twoCols ? 24 : 32)]} numberOfLines={1}>{r.name}</Text>
        <Text style={[styles.dept, T(11)]} numberOfLines={1}>{r.department || 'No department'}</Text>
      </View>
      <View style={[styles.track, { height: s(14), borderRadius: s(7) }, twoCols ? { width: s(80) } : { flex: 1 }]}>
        <View style={{ width: `${r.percent}%`, height: '100%', borderRadius: s(7), backgroundColor: deptColor(r.department) }} />
      </View>
      <Text style={[styles.percent, T(30), { width: s(twoCols ? 78 : 100) }, r.percent === 0 && { color: '#475569' }]}>{r.percent}%</Text>
    </View>
  );

  return (
    <Pressable style={styles.screen} onPress={next}>
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
        <Text style={[styles.panelTitle, T(40)]}>{slide.title}</Text>

        {slide.kind === 'standings' ? (
          <View style={{ flex: 1, marginTop: s(8), flexDirection: 'row', gap: s(16) }}>
            {chunkEven(slide.rows, Math.ceil(slide.rows.length / cols)).map((col, ci) => (
              <View key={ci} style={{ flex: 1, gap: s(3) }}>
                {col.map(renderRow)}
              </View>
            ))}
          </View>
        ) : null}

        {slide.kind === 'progress' ? (
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: s(12), marginTop: s(10), alignContent: 'flex-start' }}>
            {progress.map(({ game, done, total, roundName, champion }) => (
              <View key={game.id} style={[styles.tile, { width: width > 700 ? '31.8%' : '48%', padding: s(12), borderTopColor: champion ? colors.gold : '#2F5BE0' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                  <GameIcon id={game.id} size={s(22)} color={champion ? colors.gold : '#93C5FD'} />
                  <Text style={[styles.cardGame, { fontSize: s(18) }]} numberOfLines={1}>{game.short || game.name}</Text>
                </View>
                {champion ? (
                  <Text style={[styles.name, { fontSize: s(26), marginTop: s(4) }]} numberOfLines={1}>{champion.name || `Team ${champion.no}`}</Text>
                ) : (
                  <Text style={[styles.time, { fontSize: s(20), marginTop: s(4) }]} numberOfLines={1}>{roundName}</Text>
                )}
                <View style={[styles.track, { height: s(10), borderRadius: s(5), marginTop: s(6), flex: 0 }]}>
                  <View style={{ width: `${total ? Math.round((done / total) * 100) : 0}%`, height: '100%', borderRadius: s(5), backgroundColor: champion ? colors.gold : '#2F5BE0' }} />
                </View>
                <Text style={[styles.dept, { fontSize: s(14), marginTop: s(4) }]}>{done}/{total} matches{champion ? ' · Champion' : ''}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {slide.kind === 'champions' ? (
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
        {slides.map((p, i) => (
          <View key={p.key} style={{ width: i === index % slides.length ? s(34) : s(10), height: s(6), borderRadius: 3, backgroundColor: i === index % slides.length ? colors.gold : '#334155' }} />
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
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, paddingRight: 10, maxHeight: 96, overflow: 'hidden' },
  rank: { fontFamily: font.display, textAlign: 'center' },
  name: { color: '#fff', fontFamily: font.display, flexShrink: 1 },
  dept: { color: '#94A3B8', fontWeight: '700' },
  track: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  percent: { color: colors.gold, fontFamily: font.display, textAlign: 'right' },
  cardGame: { color: '#E2E8F0', fontFamily: font.bold, flexShrink: 1 },
  time: { color: colors.gold, fontFamily: font.display },
  tile: { backgroundColor: colors.night2, borderRadius: 12, borderTopWidth: 5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#fff', fontFamily: font.display, textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
