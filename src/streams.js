// Live streams per game, using VDO.Ninja (https://vdo.ninja). Table: sf_streams (see supabase/streams.sql).
// VDO.Ninja is peer-to-peer: the phone that streams uploads to every viewer directly (no server of ours).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';

const HOST = 'https://vdo.ninja/';
const pwKey = (gameId) => `sf.stream.pw.${gameId}`;

export const newStreamId = (gameId) =>
  `agi26-${String(gameId).replace(/[^a-z0-9]/gi, '')}-${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 6)}`;

// link the viewers watch
export function viewUrl(streamId, password) {
  const q = [`view=${encodeURIComponent(streamId)}`];
  if (password) q.push(`password=${encodeURIComponent(password)}`);
  q.push('cleanoutput');
  return `${HOST}?${q.join('&')}`;
}

// link the person who films opens on the phone that does the filming
export function pushUrl(streamId, password) {
  const q = [`push=${encodeURIComponent(streamId)}`];
  if (password) q.push(`password=${encodeURIComponent(password)}`);
  q.push('webcam');
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
