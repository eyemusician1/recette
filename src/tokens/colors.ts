export const palette = {
  // Backgrounds
  bg:        '#faf6ef',   // warm ivory — main background
  surface:   '#f3ede3',   // slightly deeper ivory — cards
  surfaceAlt:'#ede5d8',   // card hover / pressed

  // Accent
  terracotta:'#c8522a',   // primary accent
  terracottaLight: 'rgba(200,82,42,0.1)',

  // Text
  ink:       '#2c1a0e',   // near-black brown — headings
  body:      '#5a3e2b',   // mid-brown — body text
  muted:     '#a08878',   // muted — captions, labels

  // Utility
  border:    'rgba(44,26,14,0.1)',
  borderStrong: 'rgba(44,26,14,0.18)',
  white:     '#ffffff',

  // Legacy (login screen keeps dark palette)
  noir:      '#0d0904',
  bistro:    '#1a1008',
  mahogany:  '#2a1504',
  ember:     '#3d1a08',
  parchment: '#f5e8c8',
  gold:      '#c89040',
  ochre:     '#b8976a',
  amber:     '#c4a87a',
  rust:      '#8b4b1e',
  stone:     '#7a6040',
  burgundy:  '#8b1a2a',
  fog:       '#4a3828',
  overlayLight: 'rgba(200,144,64,0.06)',
  overlayDark:  'rgba(0,0,0,0.45)',
  cream:     '#fff8ea',
} as const;

export type PaletteKey = keyof typeof palette;