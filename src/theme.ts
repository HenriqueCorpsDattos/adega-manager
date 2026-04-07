import { useColorScheme } from 'react-native';

export const GOLD = '#C9A84C';
export const BLACK = '#0A0A0A';
export const WHITE = '#FFFFFF';
export const DANGER = '#E74C3C';
export const SUCCESS = '#27AE60';

const light = {
  bg: '#F9F9F4',
  card: '#FFFFFF',
  text: '#0A0A0A',
  sub: '#666666',
  border: '#E5E5E0',
  placeholder: '#AAAAAA',
  badge: '#F0F0E8',
  badgeText: '#555555',
  inputBg: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.5)',
  sheetBg: '#FFFFFF',
  searchBg: '#F2F2EC',
  optionBg: '#F9F9F4',
  optionSelectedBg: '#FDF8EC',
  tabBar: '#FFFFFF',
  tabBorder: '#E5E5E0',
  headerBg: '#0A0A0A',
  headerText: '#FFFFFF',
};

const dark = {
  bg: '#0A0A0A',
  card: '#1A1A1A',
  text: '#FFFFFF',
  sub: '#AAAAAA',
  border: '#2C2C2C',
  placeholder: '#555555',
  badge: '#2A2A2A',
  badgeText: '#AAAAAA',
  inputBg: '#1A1A1A',
  overlay: 'rgba(0,0,0,0.75)',
  sheetBg: '#1A1A1A',
  searchBg: '#2A2A2A',
  optionBg: '#222222',
  optionSelectedBg: '#2C2710',
  tabBar: '#1A1A1A',
  tabBorder: '#2C2C2C',
  headerBg: '#1A1A1A',
  headerText: '#FFFFFF',
};

export type Theme = typeof light & { gold: string; danger: string; success: string; isDark: boolean };

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const base = scheme === 'dark' ? dark : light;
  return { ...base, gold: GOLD, danger: DANGER, success: SUCCESS, isDark: scheme === 'dark' };
}
