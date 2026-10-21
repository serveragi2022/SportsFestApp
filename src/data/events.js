// Department events (not bracket games): the admin, or a committee account assigned to the event, encodes
// which DEPARTMENT finished 1st ... 8th. A department with no place did not take part (0 points).
// The standing points are only used as the FINAL tie-breaker of the overall team ranking (see standings.js).

export const EVENTS = [
  { id: 'cheer-dance', name: 'Cheer Dance' },
  { id: 'muse', name: 'Muse' },
];

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

// index 0 = 1st place
export const PLACE_POINTS = [100, 75, 60, 50, 40, 30, 20, 10];

export const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4] || 'th'}`;

// placements: { [eventId]: { [place]: department } }  ->  { [department]: totalPoints }
export function departmentPoints(placements = {}) {
  const out = {};
  EVENTS.forEach((e) => {
    const byPlace = placements[e.id] || {};
    Object.keys(byPlace).forEach((place) => {
      const pts = PLACE_POINTS[Number(place) - 1];
      const d = String(byPlace[place] || '').trim();
      if (pts && d) out[d] = (out[d] || 0) + pts;
    });
  });
  return out;
}
