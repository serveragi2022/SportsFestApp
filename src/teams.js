import { TEAM_COLORS } from './data/games.js';

export function hashColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return TEAM_COLORS[h % TEAM_COLORS.length];
}

// Name + color of "Team N" of a game. The name is only a label: several team numbers may share the same name.
export function resolveTeam(state, gameId, teamNo) {
  const entry = (state.rosters[gameId] || {})[teamNo];
  let name = '';
  let color = null;
  let department = '';
  if (entry) {
    if (entry.masterId) {
      const master = state.masterTeams.find((t) => t.id === entry.masterId);
      if (master) {
        name = master.name;
        color = master.color;
        department = master.department || '';
      }
    } else if (entry.name) {
      name = entry.name;
    }
  }
  if (!color) color = name ? hashColor(name.toLowerCase()) : '#64748B';
  return { no: teamNo, name, color, department, label: name ? `Team ${teamNo} · ${name}` : `Team ${teamNo}` };
}
