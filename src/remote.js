// Supabase data access. Takes the client as a parameter so it can be tested with a fake client.
//
// Tables (see supabase/schema.sql):
//   sf_master_teams (id, name, color)
//   sf_rosters      (game_id, team_no, master_id, custom_name)
//   sf_results      (game_id, match_no, winner, score1, score2)
//   sf_tiebreak     (game_id, team_no)
//   sf_committee    (game_id, role, name)
//   sf_admins       (user_id)
//   sf_staff        (user_id, username, email, full_name, role)   accounts made by an admin (sign in with username + password)
//   sf_staff_games  (user_id, game_id)                      games a committee account may score
// Creating / deleting logins and passwords go through the 'sf-admin' Edge Function.

export const TABLES = {
  masters: 'sf_master_teams',
  rosters: 'sf_rosters',
  results: 'sf_results',
  tiebreak: 'sf_tiebreak',
  committee: 'sf_committee',
  times: 'sf_match_times',
  placements: 'sf_placements',
  admins: 'sf_admins',
  staff: 'sf_staff',
  staffGames: 'sf_staff_games',
  audit: 'sf_audit',
};

import { sortTeams } from './data/departments.js';
import { dataToRows } from './backup.js';

export const ADMIN_FUNCTION = 'sf-admin';

export function rowsToState({ masters = [], rosters = [], results = [], tiebreak = [], committee = [], times = [], placements = [] }) {
  const state = { masterTeams: [], rosters: {}, results: {}, scores: {}, tiebreak: {}, committee: {}, times: {}, placements: {} };
  state.masterTeams = sortTeams(masters.map((r) => ({ id: r.id, name: r.name, color: r.color, department: r.department || '' })));
  rosters.forEach((r) => {
    if (!state.rosters[r.game_id]) state.rosters[r.game_id] = {};
    const entry = r.master_id ? { masterId: r.master_id } : { name: r.custom_name || '' };
    if (Array.isArray(r.players) && r.players.length) entry.players = r.players;
    state.rosters[r.game_id][r.team_no] = entry;
  });
  results.forEach((r) => {
    if (!state.results[r.game_id]) state.results[r.game_id] = {};
    state.results[r.game_id][r.match_no] = r.winner;
    if (r.score1 != null && r.score2 != null) {
      if (!state.scores[r.game_id]) state.scores[r.game_id] = {};
      state.scores[r.game_id][r.match_no] = [r.score1, r.score2];
    }
  });
  tiebreak.forEach((r) => {
    state.tiebreak[r.game_id] = r.team_no;
  });
  committee.forEach((r) => {
    if (!state.committee[r.game_id]) state.committee[r.game_id] = {};
    state.committee[r.game_id][r.role] = r.name;
  });
  times.forEach((r) => {
    if (!state.times[r.game_id]) state.times[r.game_id] = {};
    state.times[r.game_id][r.match_no] = r.time_text;
  });
  placements.forEach((r) => {
    if (!state.placements[r.event_id]) state.placements[r.event_id] = {};
    state.placements[r.event_id][r.place] = r.department;
  });
  return state;
}

export function makeRemote(client) {
  const check = ({ error }) => {
    if (error) throw new Error(error.message || String(error));
  };
  const db = (name) => client.from(name);

  // erases every Sports Fest table (not the accounts, not the audit trail)
  const wipeEverything = async () => {
    check(await db(TABLES.results).delete().neq('game_id', ''));
    check(await db(TABLES.tiebreak).delete().neq('game_id', ''));
    check(await db(TABLES.committee).delete().neq('game_id', ''));
    await db(TABLES.times).delete().neq('game_id', '');
    await db(TABLES.placements).delete().neq('event_id', '');
    check(await db(TABLES.rosters).delete().neq('game_id', ''));
    check(await db(TABLES.masters).delete().not('id', 'is', null));
  };

  // Writes a line to the audit trail (see supabase/schema.sql). It must never stop what the person is doing.
  const logAudit = async (action, gameId = null, detail = {}) => {
    try {
      if (client.rpc) await client.rpc('sf_audit_log', { p_action: action, p_game: gameId, p_detail: detail });
    } catch (e) {
      // ignore
    }
  };

  // Calls the sf-admin Edge Function and turns every failure into a readable message.
  const callFunction = async (body) => {
    const { data, error } = await client.functions.invoke(ADMIN_FUNCTION, { body });
    if (error) {
      const res = error.context && typeof error.context.text === 'function' ? error.context : null;
      const status = res ? res.status : null;
      let detail = '';
      if (res) {
        try {
          const text = await res.text();
          try {
            const j = JSON.parse(text);
            detail = j.error || j.message || j.msg || (typeof j === 'string' ? j : '');
          } catch (e) {
            detail = text;
          }
        } catch (e) {
          // no body
        }
      }
      let message = detail || error.message || 'Request failed';
      if (status === 404) message = 'The account function "sf-admin" is not deployed on Supabase yet. (' + (detail || 'not found') + ')';
      else if (status === 401 && /jwt/i.test(detail)) message = 'Supabase rejected the login token (' + detail + '). Redeploy sf-admin with: supabase functions deploy sf-admin --no-verify-jwt';
      else if (status && !detail) message = 'Account function failed (HTTP ' + status + '). Check Supabase > Edge Functions > sf-admin > Logs.';
      throw new Error(message);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  };

  return {
    async fetchAll() {
      // times / placements are new tables: an old database without them must not break the app
      const soft = (q) => Promise.resolve(q).then((r) => (r && !r.error ? r : { data: [] })).catch(() => ({ data: [] }));
      const [masters, rosters, results, tiebreak, committee, times, placements] = await Promise.all([
        db(TABLES.masters).select('*'),
        db(TABLES.rosters).select('*'),
        db(TABLES.results).select('*'),
        db(TABLES.tiebreak).select('*'),
        db(TABLES.committee).select('*'),
        soft(db(TABLES.times).select('*')),
        soft(db(TABLES.placements).select('*')),
      ]);
      [masters, rosters, results, tiebreak, committee].forEach(check);
      return rowsToState({ masters: masters.data, rosters: rosters.data, results: results.data, tiebreak: tiebreak.data, committee: committee.data, times: times.data, placements: placements.data });
    },

    async checkAdmin(userId) {
      const res = await db(TABLES.admins).select('user_id').eq('user_id', userId).maybeSingle();
      check(res);
      return !!res.data;
    },

    // -> { role: 'admin' | 'committee' | 'guest', games: [] }
    async getAccess(userId) {
      const admin = await db(TABLES.admins).select('user_id').eq('user_id', userId).maybeSingle();
      check(admin);
      if (admin.data) return { role: 'admin', games: [] };
      const staff = await db(TABLES.staff).select('user_id').eq('user_id', userId).maybeSingle();
      check(staff);
      if (!staff.data) return { role: 'guest', games: [] };
      const games = await db(TABLES.staffGames).select('game_id').eq('user_id', userId);
      check(games);
      return { role: 'committee', games: (games.data || []).map((g) => g.game_id) };
    },

    // ----- accounts (admin only)
    async listStaff() {
      const [staff, games] = await Promise.all([db(TABLES.staff).select('*'), db(TABLES.staffGames).select('*')]);
      check(staff);
      check(games);
      return (staff.data || [])
        .map((u) => ({
          userId: u.user_id,
          username: u.username,
          fullName: u.full_name,
          role: u.role,
          games: (games.data || []).filter((g) => g.user_id === u.user_id).map((g) => g.game_id),
        }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName) || a.username.localeCompare(b.username));
    },

    async createStaff({ username, password, fullName, role, gameIds }) {
      return callFunction({ action: 'create', username, password, fullName, role, gameIds });
    },

    async deleteStaff(userId) {
      return callFunction({ action: 'delete', userId });
    },

    async setStaffPassword(userId, password) {
      return callFunction({ action: 'password', userId, password });
    },

    // Replace the games of a committee account.
    async setStaffGames(userId, gameIds) {
      check(await db(TABLES.staffGames).delete().eq('user_id', userId));
      if (gameIds.length) check(await db(TABLES.staffGames).insert(gameIds.map((game_id) => ({ user_id: userId, game_id }))));
    },

    // ---- audit trail (admins read it; the database writes the lines about changes by itself)
    logAudit,

    async logLoginFailed(login) {
      try {
        if (client.rpc) await client.rpc('sf_audit_login_failed', { p_login: String(login || '').slice(0, 40) });
      } catch (e) {
        // ignore
      }
    },

    // newest first. before = id of the oldest line already shown. actions = only these actions (null = all)
    async getAudit({ limit = 100, before = null, actions = null, userId = null, gameId = null } = {}) {
      let q = db(TABLES.audit).select('*').order('id', { ascending: false }).limit(limit);
      if (before != null) q = q.lt('id', before);
      if (actions && actions.length) q = q.in('action', actions);
      if (userId) q = q.eq('user_id', userId);
      if (gameId) q = q.eq('game_id', gameId);
      const res = await q;
      check(res);
      return (res.data || []).map((r) => ({
        id: r.id,
        at: r.at,
        userId: r.user_id,
        username: r.username || '',
        fullName: r.full_name || '',
        action: r.action,
        gameId: r.game_id || null,
        detail: r.detail || {},
      }));
    },

    // clearNos: later matches that depended on the old winner (their results are removed)
    async setResult(gameId, matchNo, winner, scores, clearNos = []) {
      if (clearNos.length) check(await db(TABLES.results).delete().eq('game_id', gameId).in('match_no', clearNos));
      check(await db(TABLES.tiebreak).delete().eq('game_id', gameId));
      check(
        await db(TABLES.results).upsert({
          game_id: gameId,
          match_no: matchNo,
          winner,
          score1: scores ? scores[0] : null,
          score2: scores ? scores[1] : null,
        })
      );
    },

    async clearResult(gameId, matchNos) {
      check(await db(TABLES.results).delete().eq('game_id', gameId).in('match_no', matchNos));
      check(await db(TABLES.tiebreak).delete().eq('game_id', gameId));
    },

    async setTiebreak(gameId, team) {
      check(await db(TABLES.tiebreak).upsert({ game_id: gameId, team_no: team }));
    },

    // keepRow: the slot also has players, so clearing the name must not delete the row.
    async assignTeam(gameId, teamNo, value, keepRow = false) {
      if (!value) {
        if (keepRow) {
          check(await db(TABLES.rosters).upsert({ game_id: gameId, team_no: teamNo, master_id: null, custom_name: null }));
        } else {
          check(await db(TABLES.rosters).delete().eq('game_id', gameId).eq('team_no', teamNo));
        }
        return;
      }
      check(
        await db(TABLES.rosters).upsert({
          game_id: gameId,
          team_no: teamNo,
          master_id: value.masterId || null,
          custom_name: value.masterId ? null : value.name || null,
        })
      );
    },

    // Players of a team slot (admin only). keepRow: the slot also has a name, so only the players are cleared.
    async setPlayers(gameId, teamNo, players, keepRow = false) {
      if (!players.length && !keepRow) {
        check(await db(TABLES.rosters).delete().eq('game_id', gameId).eq('team_no', teamNo));
        return;
      }
      check(await db(TABLES.rosters).upsert({ game_id: gameId, team_no: teamNo, players: players.length ? players : null }));
    },

    async addMaster(team) {
      check(await db(TABLES.masters).insert({ id: team.id, name: team.name, color: team.color, department: team.department || null }));
    },

    async updateMaster(team) {
      check(await db(TABLES.masters).update({ name: team.name, color: team.color, department: team.department || null }).eq('id', team.id));
    },

    // Slots that used the name keep it as a custom label.
    async deleteMaster(id, name) {
      check(await db(TABLES.rosters).update({ master_id: null, custom_name: name }).eq('master_id', id));
      check(await db(TABLES.masters).delete().eq('id', id));
    },

    // Time text of a match (admin only). Empty text removes it (the default time of the app shows again).
    async setMatchTime(gameId, matchNo, text) {
      if (!text) {
        check(await db(TABLES.times).delete().eq('game_id', gameId).eq('match_no', matchNo));
        return;
      }
      check(await db(TABLES.times).upsert({ game_id: gameId, match_no: matchNo, time_text: text }));
    },

    // Cheer Dance / Muse: department of a place (1..8). Empty department clears the place.
    async setPlacement(eventId, place, department) {
      if (department) check(await db(TABLES.placements).delete().eq('event_id', eventId).eq('department', department));
      check(await db(TABLES.placements).delete().eq('event_id', eventId).eq('place', place));
      if (department) check(await db(TABLES.placements).insert({ event_id: eventId, place, department }));
    },

    async setCommittee(gameId, role, name) {
      check(await db(TABLES.committee).upsert({ game_id: gameId, role, name }));
    },

    async resetGame(gameId) {
      await logAudit('reset.game', gameId);
      check(await db(TABLES.results).delete().eq('game_id', gameId));
      check(await db(TABLES.tiebreak).delete().eq('game_id', gameId));
    },

    async resetAllResults() {
      await logAudit('reset.results');
      check(await db(TABLES.results).delete().neq('game_id', ''));
      check(await db(TABLES.tiebreak).delete().neq('game_id', ''));
    },

    async resetEverything() {
      await logAudit('reset.all');
      await wipeEverything();
    },

    // Restore a backup (admin only): everything is erased, then the backup rows are written back (teams first).
    async restoreAll(data) {
      const rows = dataToRows(data);
      await logAudit('backup.restore', null, { teamNames: rows.masters.length, results: rows.results.length, committee: rows.committee.length, times: rows.times.length });
      await wipeEverything();
      const insert = async (table, list) => {
        if (list.length) check(await db(table).insert(list));
      };
      await insert(TABLES.masters, rows.masters);
      await insert(TABLES.rosters, rows.rosters);
      await insert(TABLES.results, rows.results);
      await insert(TABLES.tiebreak, rows.tiebreak);
      await insert(TABLES.committee, rows.committee);
      await insert(TABLES.times, rows.times);
      await insert(TABLES.placements, rows.placements);
    },

    // Legacy: calls onChange (debounced) whenever any Sports Fest table changes. Kept for backward compatibility.
    subscribe(onChange) {
      let timer = null;
      const fire = () => {
        clearTimeout(timer);
        timer = setTimeout(onChange, 250);
      };
      let channel = client.channel('sportsfest-live');
      [TABLES.masters, TABLES.rosters, TABLES.results, TABLES.tiebreak, TABLES.committee].forEach((table) => {
        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, fire);
      });
      channel.subscribe();
      return () => {
        clearTimeout(timer);
        client.removeChannel(channel);
      };
    },

    // Incremental: calls onPatch per changed row (batched, ~80ms). Preferred over subscribe() — avoids full fetchAll().
    // onPatch: ({ table, eventType, new: row|null, old: row|null }) => void
    subscribePatches(onPatch) {
      let timer = null;
      let batch = [];
      const flush = () => {
        const toSend = batch.splice(0);
        // Coalesce: if storm of >30 events, fallback is handled by caller via refresh()
        toSend.forEach(onPatch);
        timer = null;
      };
      const push = (payload) => {
        batch.push({ table: payload.table, eventType: payload.eventType, new: payload.new, old: payload.old });
        clearTimeout(timer);
        timer = setTimeout(flush, 80);
      };
      let channel = client.channel('sportsfest-live-patch');
      [TABLES.masters, TABLES.rosters, TABLES.results, TABLES.tiebreak, TABLES.committee].forEach((table) => {
        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, push);
      });
      channel.subscribe();
      // separate channel for the newer tables, so an old database without them cannot break the main one
      let extra = client.channel('sportsfest-live-extra');
      [TABLES.times, TABLES.placements].forEach((table) => {
        extra = extra.on('postgres_changes', { event: '*', schema: 'public', table }, push);
      });
      extra.subscribe();
      return () => {
        clearTimeout(timer);
        client.removeChannel(channel);
        client.removeChannel(extra);
      };
    },
  };
}
