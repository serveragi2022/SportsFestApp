// Live streams per game, using VDO.Ninja (https://vdo.ninja). Table: sf_streams (see supabase/streams.sql).
// VDO.Ninja is peer-to-peer: the phone that streams uploads to every viewer directly (no server of ours).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';

const HOST = 'https://vdo.ninja/';
const pwKey = (gameId) => `sf.stream.pw.${gameId}`;

// VDO.Ninja only keeps letters, numbers and underscore in a stream ID (it turns anything else, like "-", into "_").
// The camera page and the viewer page must use the exact same ID, so both links always go through vdoId().
export const vdoId = (id) => String(id).replace(/[^A-Za-z0-9_]/g, '_');

export const newStreamId = (gameId) =>
  `agi26_${String(gameId).replace(/[^a-z0-9]/gi, '')}_${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 6)}`;

// link the viewers watch
export function viewUrl(streamId, password) {
  const q = [`view=${encodeURIComponent(vdoId(streamId))}`];
  if (password) q.push(`password=${encodeURIComponent(password)}`);
  return `${HOST}?${q.join('&')}`;
}

// link the person who films opens on the phone that does the filming
export function pushUrl(streamId, password) {
  const q = [`push=${encodeURIComponent(vdoId(streamId))}`];
  if (password) q.push(`password=${encodeURIComponent(password)}`);
  q.push('webcam', 'autostart');
  return `${HOST}?${q.join('&')}`;
}

export const loadPassword = async (gameId) => {
  try {
    return (await AsyncStorage.getItem(pwKey(gameId))) || '';
  } catch (e) {
    return '';
  }
};
export const savePassword = async (gameId, pw) => {
  try {
    await AsyncStorage.setItem(pwKey(gameId), pw);
  } catch (e) {
    // not saved: the person types it again next time
  }
};

export async function fetchStream(gameId) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.from('sf_streams').select('game_id, stream_id, live, streamer_id, streamer_name').eq('game_id', gameId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// The database decides: only a committee account assigned to the game, and only one streamer at a time.
export async function startStream(gameId, streamId) {
  if (!isSupabaseConfigured) throw new Error('Not connected to the server.');
  const { error } = await supabase.rpc('sf_stream_start', { g: gameId, sid: streamId });
  if (error) throw new Error(error.message);
}

export async function stopStream(gameId) {
  if (!isSupabaseConfigured) throw new Error('Not connected to the server.');
  const { error } = await supabase.rpc('sf_stream_stop', { g: gameId });
  if (error) throw new Error(error.message);
}

// calls onChange() whenever this game's stream row changes; returns an unsubscribe function
export function watchStream(gameId, onChange) {
  if (!isSupabaseConfigured) return () => {};
  const ch = supabase
    .channel(`sf_streams_${gameId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sf_streams', filter: `game_id=eq.${gameId}` }, () => onChange())
    .subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}