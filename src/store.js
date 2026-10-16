import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GAME_BY_ID, TEAM_COLORS } from './data/games';
import { downstream } from './engine';
import { resolveTeam } from './teams';
import { supabase } from './supabase';
import { makeRemote } from './remote';
import { can, GUEST, loginToEmail } from './permissions';
import { DEFAULT_TEAMS, sortTeams } from './data/departments';

const STORAGE_KEY = 'sportsfest:v2';
const OLD_STORAGE_KEY = 'sportsfest:v1';

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
      if (action.value) roster[action.teamNo] = action.value;
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
          rosters[gid][no] = v.masterId === action.id ? { name: gone ? gone.name : '' } : v;
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
  const skipFirstSave = useRef(true);
  const stateRef = useRef(state);
  const accessRef = useRef(access);
  const sessionRef = useRef(session);
  const queueRef = useRef(Promise.resolve()); // saves to Supabase run one after another, in order
  stateRef.current = state;
  accessRef.current = access;
  sessionRef.current = session;
  const isAdmin = access.role === 'admin';

  // ----- cloud: load + live updates
  const refresh = useCallback(async () => {
    if (!remote) return;
    try {
      const next = await remote.fetchAll();
      dispatch({ type: 'LOAD', state: next });
      setSyncError(null);
      // the admin may have changed which games this account can score
      const s = sessionRef.current;
      if (s) setAccess(await remote.getAccess(s.user.id));
    } catch (e) {
      setSyncError(e.message || 'Cannot reach the server');
    }
  }, []);

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
    refresh().finally(() => setLoaded(true));
    const unsubscribe = remote.subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

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
        queueRef.current = queueRef.current
          .then(() => remoteCall(remote))
          .catch((e) => {
            setSyncError(e.message || 'Could not save');
            refresh();
          });
      }
      return true;
    },
    [refresh]
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
      assignTeam: (gameId, teamNo, value) => run({ type: 'ASSIGN_TEAM', gameId, teamNo, value }, (r) => r.assignTeam(gameId, teamNo, value), { game: gameId }),
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
      refresh,
      signIn,
      signOut,
      getTeam,
      getCommittee,
      ...actions,
    }),
    [state, loaded, access, isAdmin, isStaff, canEditGame, session, syncError, refresh, signIn, signOut, getTeam, getCommittee, actions]
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
