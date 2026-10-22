// Game definitions taken from "Games Bracket.xlsx".
// Slot types:  { t: n }  -> Team number n
//              { w: g }  -> winner of game number g (within the same sport)
// Round types: 'elim'  -> single elimination (loser is eliminated)
//              'robin' -> round robin (champion = most wins)
// scoring: true -> the points of BOTH teams are encoded (winner = higher points).
//          For round robin, total points scored breaks a tie on wins; still equal -> admin picks.

const T = (n) => ({ t: n });
const W = (g) => ({ w: g });

const m = (no, slots, extra = {}) => ({ no, slots, ...extra });

// Times + game timing taken from the latest basketball schedule sheet.
const basketballTimes = {
  1: '9:20 - 10:00',
  2: '10:00 - 10:40',
  3: '10:40 - 11:20',
  4: '11:20 - 12:00',
  5: '1:30 - 2:10',
  6: '2:10 - 2:50',
  7: '3:20 - 4:30',
};

// Basketball game timing in MINUTES (reference only). Shown on the game screen under each round.
// Rounds 1 and 2: 5 prep + 4 x 5 quarters + 5 half-time + 8 time-out = 38.  Championship: 60.
const BB_TIMING_REGULAR = { duration: 38, prep: 5, q1: 5, q2: 5, half: 5, q3: 5, q4: 5, timeout: 8 };
const BB_TIMING_FINAL = { duration: 60, prep: 5, q1: 10, q2: 10, half: 7, q3: 10, q4: 10, timeout: 8 };
const bb = (no, slots) => m(no, slots, { time: basketballTimes[no] });

export const GAMES = [
  {
    id: 'basketball',
    name: 'Basketball',
    teams: 8,
    rounds: [
      { name: 'Round 1: Qualifying Round', type: 'elim', timing: BB_TIMING_REGULAR, matches: [bb(1, [T(1), T(5)]), bb(2, [T(2), T(6)]), bb(3, [T(3), T(7)]), bb(4, [T(4), T(8)])] },
      { name: 'Round 2: Semi-Finals', type: 'elim', timing: BB_TIMING_REGULAR, matches: [bb(5, [W(1), W(2)]), bb(6, [W(3), W(4)])] },
      { name: 'Round 3: Championship', type: 'elim', timing: BB_TIMING_FINAL, matches: [bb(7, [W(5), W(6)])] },
    ],
    committee: [
      ['Tournament Head', 'Eagle Aurellana'],
      ['Referees (per game)', 'SG Tomaquin / SG Bugia'],
      ['Table Officials / Scorers', 'SG Dia / Charlie Caldito'],
      ['Timekeeper', 'Jayric Sardea'],
      ['Scoreboard Operator', 'SG Mauro'],
      ['Medical / First Aid (shared)', 'April'],
    ],
  },
  {
    id: 'badminton-ws',
    name: "Badminton Women's Singles",
    short: 'Badminton (WS)',
    venue: 'Court 1',
    teams: 7,
    rounds: [
      { name: 'Round 1: Qualifying Round', type: 'elim', matches: [m(1, [T(1), T(5)]), m(2, [T(2), T(6)]), m(3, [T(3), T(7)])] },
      // Team 4 has no qualifying match: Game 4 waits for the winner of Game 1.
      { name: 'Round 2: Semi-Finals', type: 'elim', matches: [m(4, [T(4), W(1)]), m(5, [W(2), W(3)])] },
      { name: 'Round 3: Championship', type: 'elim', matches: [m(6, [W(4), W(5)])] },
    ],
    committee: [
      ['Tournament Head', 'Nicko Mantuano'],
      ['Umpire / Scorer', 'Rose Creag'],
      ['Line Judges', 'Melvin / Khristalline'],
    ],
  },
  {
    id: 'badminton-ms',
    name: "Badminton Men's Singles",
    short: 'Badminton (MS)',
    venue: 'Court 1',
    teams: 4,
    rounds: [
      { name: 'Round 1: Qualifying Round', type: 'elim', matches: [m(1, [T(1), T(3)]), m(2, [T(2), T(4)])] },
      { name: 'Round 3: Championship', type: 'elim', matches: [m(3, [W(1), W(2)])] },
    ],
    committee: [
      ['Tournament Head', 'Nicko Mantuano'],
      ['Umpire / Scorer', 'Rose Creag'],
      ['Line Judges', 'Melvin / Khristalline'],
    ],
  },
  {
    id: 'badminton-wd',
    name: "Badminton Women's Doubles",
    short: 'Badminton (WD)',
    venue: 'Court 2',
    teams: 6,
    rounds: [
      {
        name: 'Round 1: Semi-Finals',
        type: 'elim',
        matches: [m(1, [T(1), T(2)], { time: '8:00 - 8:30' }), m(2, [T(3), T(4)], { time: '8:30 - 9:00' }), m(3, [T(5), T(6)], { time: '9:00 - 9:30' })],
      },
      // Championship = round robin of the 3 semi-final winners. Points are only used when the wins are level.
      {
        name: 'Round 2: Championship (Round Robin)',
        type: 'robin',
        scoring: true,
        matches: [m(4, [W(1), W(2)], { time: '9:30 - 10:00' }), m(5, [W(3), W(2)], { time: '10:00 - 10:30' }), m(6, [W(1), W(3)], { time: '10:30 - 11:00' })],
      },
    ],
    committee: [
      ['Tournament Head', 'Nicko Mantuano'],
      ['Umpire / Scorer', ''],
      ['Line Judges', 'Renzo Euraba / Kineth Sia'],
    ],
  },
  {
    id: 'badminton-md',
    name: "Badminton Men's Doubles",
    short: 'Badminton (MD)',
    venue: 'Court 2',
    teams: 5,
    rounds: [
      { name: 'Round 1: Qualifying Round', type: 'elim', matches: [m(1, [T(1), T(5)])] },
      { name: 'Round 2: Semi-Finals', type: 'elim', matches: [m(2, [T(2), T(3)]), m(3, [T(4), W(1)])] },
      { name: 'Round 3: Championship', type: 'elim', matches: [m(4, [W(2), W(3)])] },
    ],
    committee: [
      ['Tournament Head', 'Nicko Mantuano'],
      ['Umpire / Scorer', ''],
      ['Line Judges', 'Renzo Euraba / Kineth Sia'],
    ],
  },
  {
    id: 'pickleball-ws',
    name: "Pickleball Women's Singles",
    short: 'Pickleball (WS)',
    venue: 'Court 1',
    teams: 3,
    rounds: [
      { name: 'Round 1: Round Robin', type: 'robin', scoring: true, matches: [m(1, [T(1), T(2)]), m(2, [T(2), T(3)]), m(3, [T(1), T(3)])] },
    ],
    committee: [
      ['Tournament Head', 'E. Arevalo'],
      ['Umpire / Scorer', 'Jeremie'],
      ['Line Judges', 'Neil Puda / John Kerby Galipot'],
      ['Medical / First Aid (shared)', 'Gil Famenia'],
    ],
  },
  {
    id: 'pickleball-md',
    name: "Pickleball Men's Doubles",
    short: 'Pickleball (MD)',
    venue: 'Court 1',
    teams: 2,
    rounds: [
      { name: 'Round 1: Championship', type: 'elim', scoring: true, matches: [m(1, [T(1), T(2)])] },
    ],
    committee: [
      ['Tournament Head', 'E. Arevalo'],
      ['Umpire / Scorer', 'Jeremie'],
      ['Line Judges', 'Neil Puda / John Kerby Galipot'],
      ['Medical / First Aid (shared)', 'Gil Famenia'],
    ],
  },
  {
    id: 'chess',
    name: 'Chess',
    teams: 9,
    rounds: [
      { name: 'Round 1: Qualifying Round', type: 'elim', matches: [m(1, [T(1), T(9)], { venue: 'Board 1' })] },
      {
        name: 'Round 2: Quarter Finals',
        type: 'elim',
        matches: [
          m(2, [T(2), T(3)], { venue: 'Board 2' }),
          m(3, [T(4), T(5)], { venue: 'Board 1' }),
          m(4, [T(6), T(7)], { venue: 'Board 2' }),
          m(5, [W(1), T(8)], { venue: 'Board 1' }),
        ],
      },
      { name: 'Round 3: Semi-Finals', type: 'elim', matches: [m(6, [W(2), W(3)], { venue: 'Board 2' }), m(7, [W(4), W(5)], { venue: 'Board 1' })] },
      { name: 'Round 4: Championship', type: 'elim', matches: [m(8, [W(6), W(7)], { venue: 'Board 2' })] },
    ],
    committee: [
      ['Chess Arbiter / Game Official', ''],
      ['Scorekeeper / Results Recorder', 'J. Sarmiento'],
    ],
  },
  {
    id: 'darts',
    name: 'Darts',
    teams: 12,
    rounds: [
      {
        name: 'Round 1: Qualifying Round',
        type: 'elim',
        matches: [m(1, [T(1), T(7)]), m(2, [T(2), T(8)]), m(3, [T(3), T(9)]), m(4, [T(4), T(10)]), m(5, [T(5), T(11)]), m(6, [T(6), T(12)])],
      },
      { name: 'Round 2: Semi-Finals', type: 'elim', matches: [m(7, [W(1), W(2)]), m(8, [W(3), W(4)]), m(9, [W(5), W(6)])] },
      { name: 'Round 3: Championship (Round Robin)', type: 'robin', scoring: true, matches: [m(10, [W(7), W(8)]), m(11, [W(8), W(9)]), m(12, [W(9), W(7)])] },
    ],
    committee: [
      ['Game Official', ''],
      ['Scorekeeper / Results Recorder', 'John Lloyd Jimenez'],
    ],
  },
  {
    id: 'ml',
    name: 'Mobile Legends',
    teams: 5,
    rounds: [
      { name: 'Round 1: Qualifying Round', type: 'elim', matches: [m(1, [T(1), T(5)])] },
      // NOTE: the Excel lists "Team 1 vs Team 4" for Game 2, but Team 1 already plays Game 1.
      // Team 2 is the only team without a match, so it is used here. Change in the data if needed.
      { name: 'Round 2: Semi-Finals', type: 'elim', matches: [m(2, [T(2), T(4)]), m(3, [T(3), W(1)])] },
      { name: 'Round 3: Championship', type: 'elim', matches: [m(4, [W(2), W(3)])] },
    ],
    committee: [
      ['Game Facilitator / Umpire', 'Kathleen Valdez'],
      ['Scorekeeper / Recorder', 'Feds Custodio'],
    ],
  },
  {
    id: 'sungka',
    name: 'Sungka',
    teams: 13,
    rounds: [
      { name: 'Round 1: Qualifying Round', type: 'elim', matches: [m(1, [T(1), T(13)], { venue: 'Board S1' })] },
      {
        name: 'Round 2: Quarter Finals',
        type: 'elim',
        matches: [
          m(2, [T(2), T(3)], { venue: 'Board S2' }),
          m(3, [T(4), T(5)], { venue: 'Board S1' }),
          m(4, [T(6), T(7)], { venue: 'Board S2' }),
          m(5, [T(8), T(9)], { venue: 'Board S1' }),
          m(6, [T(10), T(11)], { venue: 'Board S2' }),
          m(7, [T(12), W(1)], { venue: 'Board S1' }),
        ],
      },
      {
        name: 'Round 3: Semi-Finals',
        type: 'elim',
        matches: [m(8, [W(2), W(3)], { venue: 'Board S2' }), m(9, [W(4), W(5)], { venue: 'Board S1' }), m(10, [W(6), W(7)], { venue: 'Board S2' })],
      },
      { name: 'Round 4: Championship (Round Robin)', type: 'robin', scoring: true, matches: [m(11, [W(8), W(9)]), m(12, [W(9), W(10)]), m(13, [W(10), W(8)])] },
    ],
    committee: [
      ['Game Official', 'Shiela'],
      ['Scorekeeper / Results Recorder', 'D. Husain'],
    ],
  },
  {
    id: 'scrabble',
    name: 'Scrabble',
    teams: 11,
    rounds: [
      {
        name: 'Round 1: Qualifying Round',
        type: 'elim',
        matches: [
          m(1, [T(1), T(2), T(3)], { venue: 'Board 1' }),
          m(2, [T(4), T(5), T(6)], { venue: 'Board 2' }),
          m(3, [T(7), T(8), T(9)], { venue: 'Board 1' }),
          m(4, [T(10), T(11)], { venue: 'Board 2' }),
        ],
      },
      { name: 'Round 2: Semi-Finals', type: 'elim', matches: [m(5, [W(1), W(2)], { venue: 'Board 1' }), m(6, [W(3), W(4)], { venue: 'Board 2' })] },
      { name: 'Round 3: Championship', type: 'elim', matches: [m(7, [W(5), W(6)], { venue: 'Board 1' })] },
    ],
    committee: [
      ['Game Official', ''],
      ['Scorekeeper / Results Recorder', 'S. Obordo'],
    ],
  },
];

// Labels of the basketball timing table, in display order.
export const TIMING_FIELDS = [
  ['duration', 'Duration'],
  ['prep', 'Prep-Time'],
  ['q1', 'Q1'],
  ['q2', 'Q2'],
  ['half', 'Half-Time'],
  ['q3', 'Q3'],
  ['q4', 'Q4'],
  ['timeout', 'Time-Out'],
];

export const GAME_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]));

export const TEAM_COLORS = [
  '#2563EB', '#F97316', '#16A34A', '#DC2626', '#7C3AED', '#0891B2',
  '#CA8A04', '#DB2777', '#4B5563', '#0D9488', '#9333EA', '#EA580C',
];
