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

const basketballTimes = {
  1: '8:25 - 9:00',
  2: '9:00 - 9:35',
  3: '9:35 - 10:10',
  4: '10:10 - 10:45',
  5: '10:45 - 11:30',
  6: '11:30 - 12:15',
  7: '2:30 - 3:33',
};
const bb = (no, slots) => m(no, slots, { time: basketballTimes[no] });

export const GAMES = [
  {
    id: 'basketball',
    name: 'Basketball',
    teams: 8,
    rounds: [
      { name: 'Round 1: Qualifying Round', type: 'elim', matches: [bb(1, [T(1), T(5)]), bb(2, [T(2), T(6)]), bb(3, [T(3), T(7)]), bb(4, [T(4), T(8)])] },
      { name: 'Round 2: Semi-Finals', type: 'elim', matches: [bb(5, [W(1), W(2)]), bb(6, [W(3), W(4)])] },
      { name: 'Round 3: Championship', type: 'elim', matches: [bb(7, [W(5), W(6)])] },
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
    teams: 8,
    rounds: [
      { name: 'Round 1: Qualifying Round', type: 'elim', matches: [m(1, [T(1), T(5)]), m(2, [T(2), T(6)]), m(3, [T(3), T(7)]), m(4, [T(4), T(8)])] },
      { name: 'Round 2: Semi-Finals', type: 'elim', matches: [m(5, [W(1), W(2)]), m(6, [W(3), W(4)])] },
      { name: 'Round 3: Championship', type: 'elim', matches: [m(7, [W(5), W(6)])] },
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

export const GAME_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]));

export const TEAM_COLORS = [
  '#2563EB', '#F97316', '#16A34A', '#DC2626', '#7C3AED', '#0891B2',
  '#CA8A04', '#DB2777', '#4B5563', '#0D9488', '#9333EA', '#EA580C',
];
