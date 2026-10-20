import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GAME_BY_ID, TEAM_COLORS } from './data/games';
import { downstream } from './engine';
import { resolveTeam } from './teams';
import { supabase } from './supabase';
import { makeRemote, TABLES } from './remote';
import { can, GUEST, loginToEmail } from './permissions';
import { DEFAULT_TEAMS, sortTeams } from './data/departments';

let NetInfo = null;
try {
  // eslint-disable-next-line import/no-unresolved, global-require
  NetInfo = require('@react-native-community/netinfo').default;
} catch (e) {
  NetInfo = null;
}

const STORAGE_KEY = 'sportsfest:v2';
const OLD_STORAGE_KEY = 'sportsfest:v1';
const CLOUD_CACHE_KEY = 'sportsfest:cloud-cache:v1';

// Cloud mode when Supabase is configured (.env), otherwise everything stays on the device.
const remote = supabase ? makeRemote(supabase) : null;

const initialState = {
  masterTeams: DEFAULT_TEAMS.map(([name, department], i) => ({ id: `seed-${i + 1}`, name, department, color: TEAM_COLORS[i % TEAM_COLORS.length] })), // [{ id, name, color, department }]
  rosters: {}, // { [gameId]: { [teamNo]: { masterId?: string, name?: string } } }
  results: {}, // { [gameId]: { [matchNo]: winnerTeamNo } }
  scores: {}, // { [gameId]: { [matchNo]: [pointsSlot1, pointsSlot2] } }  (scored rounds only)
  tiebreak: {}, // { [gameId]: teamNo }
  committee: {}, // { [gameId]: { [role]: name } }  (overrides of the defaults)
};

function withoutKeys(obj, keys) {
  const copy = { ...obj };
  keys.forEach((k) => delete copy[k]);
  return copy;
}

function uuid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (e) {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      const next = { ...initialState, ...action.state };
      return { ...next, masterTeams: sortTeams(next.masterTeams || []) };

    case 'SET_RESULT': {
      const { gameId, matchNo, team, scores } = action;
      const game = GAME_BY_ID[gameId];
      const current = state.results[gameId] || {};
      const currentScores = state.scores[gameId] || {};
      let nextResults = { ...current };
      let nextScores = { ...currentScores };
      if (current[matchNo] != null && current[matchNo] !== team) {
        const later = downstream(game, matchNo);
        nextResults = withoutKeys(nextResults, later);
        nextScores = withoutKeys(nextScores, later);
      }
      nextResults[matchNo] = team;
      if (scores) nextScores[matchNo] = scores;
      else delete nextScores[matchNo];
      return {
        ...state,
        results: { ...state.results, [gameId]: nextResults },
        scores: { ...state.scores, [gameId]: nextScores },
        tiebreak: withoutKeys(state.tiebreak, [gameId]),
      };
    }

    case 'CLEAR_RESULT': {
      const { gameId, matchNo } = action;
      const game = GAME_BY_ID[gameId];
      const gone = [matchNo, ...downstream(game, matchNo)];
      return {
        ...state,
        results: { ...state.results, [gameId]: withoutKeys(state.results[gameId] || {}, gone) },
        scores: { ...state.scores, [gameId]: withoutKeys(state.scores[gameId] || {}, gone) },
        tiebreak: withoutKeys(state.tiebreak, [gameId]),
      };
    }

    case 'SET_TIEBREAK':
      return { ...state, tiebreak: { ...state.tiebreak, [action.gameId]: action.team } };

    case 'ASSIGN_TEAM': {
      const roster = { ...(state.rosters[action.gameId] || {}) };
      const players = (roster[action.teamNo] || {}).players; // the players stay when the name changes
      if (action.value) roster[action.teamNo] = players ? { ...action.value, players } : action.value;
      else if (players) roster[action.teamNo] = { name: '', players };
      else delete roster[action.teamNo];
      return { ...state, rosters: { ...state.rosters, [action.gameId]: roster } };
    }

    case 'SET_PLAYERS': {
      const roster = { ...(state.rosters[action.gameId] || {}) };
      const entry = { ...(roster[action.teamNo] || {}) };
      if (action.players.length) entry.players = action.players;
      else delete entry.players;
      if (entry.masterId || entry.name || entry.players) roster[action.teamNo] = entry;
      else delete roster[action.teamNo];
      return { ...state, rosters: { ...state.rosters, [action.gameId]: roster } };
    }

    case 'ADD_MASTER':
      return { ...state, masterTeams: sortTeams([...state.masterTeams, action.team]) };

    case 'UPDATE_MASTER':
      return { ...state, masterTeams: sortTeams(state.masterTeams.map((t) => (t.id === action.team.id ? { ...t, ...action.team } : t))) };

    case 'DELETE_MASTER': {
      // Slots that pointed to the deleted name keep the name as a custom label.
      const gone = state.masterTeams.find((t) => t.id === action.id);
      const rosters = {};
      Object.keys(state.rosters).forEach((gid) => {
        rosters[gid] = {};
        Object.keys(state.rosters[gid]).forEach((no) => {
          const v = state.rosters[gid][no];
          rosters[gid][no] = v.masterId === action.id ? { name: gone ? gone.name : '', ...(v.players ? { players: v.players } : {}) } : v;
        });
      });
      return { ...state, rosters, masterTeams: state.masterTeams.filter((t) => t.id !== action.id) };
    }

    case 'SET_COMMITTEE': {
      const cur = state.committee[action.gameId] || {};
      return { ...state, committee: { ...state.committee, [action.gameId]: { ...cur, [action.role]: action.name } } };
    }

    case 'RESET_GAME':
      return {
        ...state,
        results: withoutKeys(state.results, [action.gameId]),
        scores: withoutKeys(state.scores, [action.gameId]),
        tiebreak: withoutKeys(state.tiebreak, [action.gameId]),
      };

    case 'RESET_ALL_RESULTS':
      return { ...state, results: {}, scores: {}, tiebreak: {} };

    case 'RESET_EVERYTHING':
      return { ...initialState };

    // ---- incremental realtime patches (avoid full fetchAll) ----
    case 'PATCH_RESULT': {
      const { gameId, matchNo, winner, score1, score2 } = action;
      const cur = { ...(state.results[gameId] || {}) };
      const curScores = { ...(state.scores[gameId] || {}) };
      cur[matchNo] = winner;
      if (score1 != null && score2 != null) curScores[matchNo] = [score1, score2];
      else delete curScores[matchNo];
      return { ...state, results: { ...state.results, [gameId]: cur }, scores: { ...state.scores, [gameId]: curScores } };
    }
    case 'REMOVE_RESULT': {
      const { gameId, matchNo } = action;
      return {
        ...state,
        results: { ...state.results, [gameId]: withoutKeys(state.results[gameId] || {}, [matchNo]) },
        scores: { ...state.scores, [gameId]: withoutKeys(state.scores[gameId] || {}, [matchNo]) },
      };
    }
    case 'PATCH_TIEBREAK':
      return { ...state, tiebreak: { ...state.tiebreak, [action.gameId]: action.teamNo } };
    case 'REMOVE_TIEBREAK':
      return { ...state, tiebreak: withoutKeys(state.tiebreak, [action.gameId]) };
    case 'PATCH_ROSTER': {
      const { gameId, teamNo, masterId, customName, players } = action;
      const roster = { ...(state.rosters[gameId] || {}) };
      const entry = {};
      if (masterId) entry.masterId = masterId;
      else if (customName) entry.name = customName;
      else entry.name = '';
      if (Array.isArray(players) && players.length) entry.players = players;
      // preserve players if patch didn't include them but existing had them and new row has null (Supabase upsert nuance)
      const existing = roster[teamNo];
      if (existing && existing.players && !entry.players && players === undefined) entry.players = existing.players;
      if (!entry.masterId && !entry.name && !entry.players) delete roster[teamNo];
      else roster[teamNo] = entry;
      return { ...state, rosters: { ...state.rosters, [gameId]: roster } };
    }
    case 'REMOVE_ROSTER': {
      const roster = { ...(state.rosters[action.gameId] || {}) };
      delete roster[action.teamNo];
      return { ...state, rosters: { ...state.rosters, [action.gameId]: roster } };
    }
    case 'PATCH_MASTER': {
      const team = action.team;
      const exists = state.masterTeams.some((t) => t.id === team.id);
      const nextTeams = exists ? state.masterTeams.map((t) => (t.id === team.id ? { ...t, ...team } : t)) : [...state.masterTeams, team];
      return { ...state, masterTeams: sortTeams(nextTeams) };
    }
    case 'REMOVE_MASTER':
      return { ...state, masterTeams: state.masterTeams.filter((t) => t.id !== action.id) };
    case 'PATCH_COMMITTEE': {
      const cur = { ...(state.committee[action.gameId] || {}) };
      cur[action.role] = action.name;
      return { ...state, committee: { ...state.committee, [action.gameId]: cur } };
    }
    case 'REMOVE_COMMITTEE': {
      const cur = { ...(state.committee[action.gameId] || {}) };
      delete cur[action.role];
      return { ...state, committee: { ...state.committee, [action.gameId]: cur } };
    }

    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState(null);
  // local mode (no Supabase): the device owner can edit everything
  const [access, setAccess] = useState(remote ? GUEST : { role: 'admin', games: [] });
  const [syncError, setSyncError] = useState(null);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const skipFirstSave = useRef(true);
  const stateRef = useRef(state);
  const accessRef = useRef(access);
  const sessionRef = useRef(session);
  const queueRef = useRef(Promise.resolve()); // saves to Supabase run one after another, in order
  stateRef.current = state;
  accessRef.current = access;
  sessionRef.current = session;
  const isAdmin = access.role === 'admin';

  // ----- offline detection -----
  useEffect(() => {
    if (!NetInfo) return undefined;
    const unsub = NetInfo.addEventListener((s) => {
      const isOffline = s.isConnected === false || s.isInternetReachable === false;
      // isInternetReachable can be null on first event — only treat explicit false as offline
      const nextOffline = s.isConnected === false || s.isInternetReachable === false;
      setOffline(nextOffline);
    });
    return () => unsub && unsub();
  }, []);

  // Persist cloud cache for offline viewing
  useEffect(() => {
    if (!remote || !loaded) return;
    AsyncStorage.setItem(CLOUD_CACHE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  // ----- cloud: load + live updates
  const refresh = useCallback(async () => {
    if (!remote) return;
    setRefreshing(true);
    try {
      const next = await remote.fetchAll();
      dispatch({ type: 'LOAD', state: next });
      setSyncError(null);
      // the admin may have changed which games this account can score
      const s = sessionRef.current;
      if (s) setAccess(await remote.getAccess(s.user.id));
    } catch (e) {
      setSyncError(e.message || 'Cannot reach the server');
      // fallback to cached cloud state when offline
      try {
        const raw = await AsyncStorage.getItem(CLOUD_CACHE_KEY);
        if (raw) dispatch({ type: 'LOAD', state: JSON.parse(raw) });
      } catch (err) {}
    } finally {
      setRefreshing(false);
    }
  }, []);

  const applyPatch = useCallback(
    (payload) => {
      const { table, eventType, new: row, old: oldRow } = payload;
      try {
        if (table === TABLES.results) {
          if (eventType === 'DELETE') {
            const r = oldRow;
            if (r) dispatch({ type: 'REMOVE_RESULT', gameId: r.game_id, matchNo: r.match_no });
          } else if (row) {
            dispatch({ type: 'PATCH_RESULT', gameId: row.game_id, matchNo: row.match_no, winner: row.winner, score1: row.score1, score2: row.score2 });
          }
        } else if (table === TABLES.tiebreak) {
          if (eventType === 'DELETE') {
            const r = oldRow;
            if (r) dispatch({ type: 'REMOVE_TIEBREAK', gameId: r.game_id });
          } else if (row) {
            dispatch({ type: 'PATCH_TIEBREAK', gameId: row.game_id, teamNo: row.team_no });
          }
        } else if (table === TABLES.rosters) {
          if (eventType === 'DELETE') {
            const r = oldRow;
            if (r) dispatch({ type: 'REMOVE_ROSTER', gameId: r.game_id, teamNo: r.team_no });
          } else if (row) {
            dispatch({ type: 'PATCH_ROSTER', gameId: row.game_id, teamNo: row.team_no, masterId: row.master_id, customName: row.custom_name, players: row.players });
          }
        } else if (table === TABLES.masters) {
          if (eventType === 'DELETE') {
            const r = oldRow;
            if (r) dispatch({ type: 'REMOVE_MASTER', id: r.id });
          } else if (row) {
            dispatch({ type: 'PATCH_MASTER', team: { id: row.id, name: row.name, color: row.color, department: row.department || '' } });
          }
        } else if (table === TABLES.committee) {
          if (eventType === 'DELETE') {
            const r = oldRow;
            if (r) dispatch({ type: 'REMOVE_COMMITTEE', gameId: r.game_id, role: r.role });
          } else if (row) {
            dispatch({ type: 'PATCH_COMMITTEE', gameId: row.game_id, role: row.role, name: row.name });
          }
        } else {
          // unknown table: fallback to full refresh
          refresh();
        }
      } catch (e) {
        refresh();
      }
    },
    [refresh]
  );

  useEffect(() => {
    if (!remote) {
      (async () => {
        try {
          const raw = (await AsyncStorage.getItem(STORAGE_KEY)) || (await AsyncStorage.getItem(OLD_STORAGE_KEY));
          if (raw) dispatch({ type: 'LOAD', state: JSON.parse(raw) });
        } catch (e) {
          // start fresh
        }
        setLoaded(true);
      })();
      return undefined;
    }
    let unsubscribe = null;
    let fallbackUnsub = null;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(CLOUD_CACHE_KEY);
        if (cached) dispatch({ type: 'LOAD', state: JSON.parse(cached) });
      } catch (e) {}
      await refresh();
      setLoaded(true);
      // Prefer incremental patches; batch storm fallback handled in remote.js + applyPatch
      if (remote.subscribePatches) {
        let count = 0;
        let stormTimer = null;
        const onPatch = (p) => {
          count += 1;
          clearTimeout(stormTimer);
          stormTimer = setTimeout(() => {
            count = 0;
          }, 3000);
          // if >30 patches in 3s, do a single refresh instead
          if (count > 30) {
            count = 0;
            refresh();
            return;
          }
          applyPatch(p);
        };
        unsubscribe = remote.subscribePatches(onPatch);
      } else {
        unsubscribe = remote.subscribe(refresh);
      }
    })();
    return () => {
      if (unsubscribe) unsubscribe();
      if (fallbackUnsub) fallbackUnsub();
    };
  }, [refresh, applyPatch]);

  // retry sync when coming back online
  useEffect(() => {
    if (!remote || offline) return;
    // when reconnecting, ensure we are consistent
    refresh();
  }, [offline, refresh]);

  // ----- cloud: who is signed in, and are they an admin?
  useEffect(() => {
    if (!remote) return undefined;
    const apply = async (s) => {
      setSession(s);
      sessionRef.current = s;
      if (!s) {
        setAccess(GUEST);
        return;
      }
      try {
        setAccess(await remote.getAccess(s.user.id));
      } catch (e) {
        setAccess(GUEST);
      }
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setTimeout(() => apply(s), 0); // never call supabase inside this callback directly
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // ----- local persistence (only when there is no Supabase)
  useEffect(() => {
    if (!loaded || remote) return;
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  const getTeam = useCallback((gameId, teamNo) => resolveTeam(state, gameId, teamNo), [state.rosters, state.masterTeams]); // eslint-disable-line react-hooks/exhaustive-deps

  const getCommittee = useCallback(
    (gameId) => {
      const overrides = state.committee[gameId] || {};
      return GAME_BY_ID[gameId].committee.map(([role, name]) => ({ role, name: overrides[role] != null ? overrides[role] : name }));
    },
    [state.committee]
  );

  // Every write goes through here: permission check (see permissions.js), optimistic local update,
  // then sync to Supabase (queued, so e.g. "add team name" is saved before "use it for Team 3").
  const run = useCallback(
    (action, remoteCall, perm) => {
      if (!can(accessRef.current, perm)) return false;
      dispatch(action);
      if (remote && remoteCall) {
        if (offline) {
          setSyncError('Offline — change saved locally, will sync when back online');
          // queue for retry when online: keep optimistic state, retry on reconnect
          queueRef.current = queueRef.current
            .then(() => remoteCall(remote))
            .catch((e) => {
              setSyncError(e.message || 'Could not save — will retry when online');
            });
          return true;
        }
        queueRef.current = queueRef.current
          .then(() => remoteCall(remote))
          .catch((e) => {
            setSyncError(e.message || 'Could not save');
            refresh();
          });
      }
      return true;
    },
    [refresh, offline]
  );

  const actions = useMemo(
    () => ({
      // scores: [pointsOfSlot1, pointsOfSlot2] for scored matches, otherwise omit
      setResult: (gameId, matchNo, team, scores) => {
        const prev = (stateRef.current.results[gameId] || {})[matchNo];
        const later = prev != null && prev !== team ? downstream(GAME_BY_ID[gameId], matchNo) : [];
        run({ type: 'SET_RESULT', gameId, matchNo, team, scores }, (r) => r.setResult(gameId, matchNo, team, scores || null, later), { game: gameId });
      },
      clearResult: (gameId, matchNo) => {
        const gone = [matchNo, ...downstream(GAME_BY_ID[gameId], matchNo)];
        run({ type: 'CLEAR_RESULT', gameId, matchNo }, (r) => r.clearResult(gameId, gone), 'admin');
      },
      setTiebreak: (gameId, team) => run({ type: 'SET_TIEBREAK', gameId, team }, (r) => r.setTiebreak(gameId, team), { game: gameId }),
      assignTeam: (gameId, teamNo, value) => {
        const cur = ((stateRef.current.rosters[gameId] || {})[teamNo]) || {};
        const hasPlayers = !!(cur.players && cur.players.length);
        run({ type: 'ASSIGN_TEAM', gameId, teamNo, value }, (r) => r.assignTeam(gameId, teamNo, value, hasPlayers), 'admin');
      },
      // players of a team: array of names (admin only)
      setPlayers: (gameId, teamNo, names) => {
        const players = (names || []).map((n) => String(n).trim().slice(0, 40)).filter(Boolean).slice(0, 10);
        const cur = ((stateRef.current.rosters[gameId] || {})[teamNo]) || {};
        const keepRow = !!(cur.masterId || cur.name);
        run({ type: 'SET_PLAYERS', gameId, teamNo, players }, (r) => r.setPlayers(gameId, teamNo, players, keepRow), 'admin');
      },
      addMaster: (name, color, department = '') => {
        const team = { id: uuid(), name: name.trim(), color, department: (department || '').trim() };
        run({ type: 'ADD_MASTER', team }, (r) => r.addMaster(team), 'admin');
        return team;
      },
      updateMaster: (team) => run({ type: 'UPDATE_MASTER', team }, (r) => r.updateMaster(team), 'admin'),
      deleteMaster: (id) => {
        const gone = stateRef.current.masterTeams.find((t) => t.id === id);
        run({ type: 'DELETE_MASTER', id }, (r) => r.deleteMaster(id, gone ? gone.name : ''), 'admin');
      },
      setCommittee: (gameId, role, name) => run({ type: 'SET_COMMITTEE', gameId, role, name }, (r) => r.setCommittee(gameId, role, name), 'admin'),
      resetGame: (gameId) => run({ type: 'RESET_GAME', gameId }, (r) => r.resetGame(gameId), 'admin'),
      resetAllResults: () => run({ type: 'RESET_ALL_RESULTS' }, (r) => r.resetAllResults(), 'admin'),
      resetEverything: () => run({ type: 'RESET_EVERYTHING' }, (r) => r.resetEverything(), 'admin'),
    }),
    [run]
  );

  // login = username (or an email, for the first admin) + password
  const signIn = useCallback(async (login, password) => {
    if (!supabase) return 'Supabase is not set up.';
    const { error } = await supabase.auth.signInWithPassword({ email: loginToEmail(login), password });
    if (!error) return null;
    return /invalid login/i.test(error.message) ? 'Wrong username or password.' : error.message;
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
  }, []);

  const canEditGame = useCallback((gameId) => can(access, { game: gameId }), [access]);
  const isStaff = access.role === 'admin' || access.role === 'committee';

  const value = useMemo(
    () => ({
      state,
      loaded,
      mode: remote ? 'cloud' : 'local',
      api: remote, // account management (null in local mode)
      access,
      isAdmin,
      isStaff,
      canEditGame,
      session,
      syncError,
      offline,
      refreshing,
      refresh,
      signIn,
      signOut,
      getTeam,
      getCommittee,
      ...actions,
    }),
    [state, loaded, access, isAdmin, isStaff, canEditGame, session, syncError, offline, refreshing, refresh, signIn, signOut, getTeam, getCommittee, actions]
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
