// Shared theme registry. Keys must match the [data-theme="..."] blocks in globals.css.
export const THEMES = [
  { key: 'black', name: 'Black', dot: '#0a0a0c', ring: 'rgba(255,255,255,0.35)' },
  { key: 'midnight', name: 'Midnight', dot: '#0d1526', ring: 'rgba(126,166,224,0.5)' },
  { key: 'crimson', name: 'Crimson', dot: '#190a0d', ring: 'rgba(224,82,82,0.5)' },
  { key: 'forest', name: 'Forest', dot: '#081510', ring: 'rgba(82,197,142,0.5)' },
  { key: 'dune', name: 'Dune', dot: '#1a1408', ring: 'rgba(224,185,106,0.55)' },
  { key: 'paper', name: 'Paper', dot: '#f4f1ea', ring: 'rgba(0,0,0,0.3)' },
];

export const DEFAULT_THEME = 'black';
export const THEME_STORAGE_KEY = 'vf-theme';

export function themeName(key) {
  return THEMES.find((t) => t.key === key)?.name || THEMES[0].name;
}
