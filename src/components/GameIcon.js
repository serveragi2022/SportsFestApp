import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';

// Plain line icons for the games (instead of emoji).
const NAMES = {
  basketball: 'basketball',
  'badminton-ws': 'badminton',
  'badminton-ms': 'badminton',
  'badminton-wd': 'badminton',
  'badminton-md': 'badminton',
  'pickleball-ws': 'racquetball',
  'pickleball-md': 'racquetball',
  chess: 'chess-knight',
  darts: 'bullseye-arrow',
  ml: 'sword-cross',
  sungka: 'dots-grid',
  scrabble: 'alphabetical-variant',
  'cheer-dance': 'human-female-dance',
  muse: 'crown',
};

export default function GameIcon({ id, size = 22, color = colors.primary, style }) {
  return <MaterialCommunityIcons name={NAMES[id] || 'trophy'} size={size} color={color} style={style} />;
}

export function Trophy({ size = 22, color = '#D97706', style }) {
  return <MaterialCommunityIcons name="trophy" size={size} color={color} style={style} />;
}
