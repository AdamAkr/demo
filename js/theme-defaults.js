// Default theme + font registry. Shared by the storefront and the admin editor.
// The admin's settings/theme document is merged over these defaults.

export const FONTS = [
  // name, weights available on Google Fonts, scripts it renders well
  { name: 'Vazirmatn', weights: [300, 400, 500, 700, 800], scripts: ['ar', 'ckb', 'en'] },
  { name: 'Noto Kufi Arabic', weights: [400, 500, 600, 700, 800], scripts: ['ar', 'ckb'] },
  { name: 'Noto Naskh Arabic', weights: [400, 500, 600, 700], scripts: ['ar', 'ckb'] },
  { name: 'Noto Sans Arabic', weights: [300, 400, 500, 600, 700, 800], scripts: ['ar', 'ckb'] },
  { name: 'IBM Plex Sans Arabic', weights: [300, 400, 500, 600, 700], scripts: ['ar', 'ckb', 'en'] },
  { name: 'Readex Pro', weights: [300, 400, 500, 600, 700], scripts: ['ar', 'en'] },
  { name: 'Cairo', weights: [300, 400, 500, 600, 700, 800], scripts: ['ar', 'en'] },
  { name: 'Tajawal', weights: [300, 400, 500, 700, 800], scripts: ['ar', 'en'] },
  { name: 'Almarai', weights: [300, 400, 700, 800], scripts: ['ar', 'en'] },
  { name: 'Inter', weights: [300, 400, 500, 600, 700, 800], scripts: ['en'] },
  { name: 'DM Sans', weights: [300, 400, 500, 600, 700, 800], scripts: ['en'] },
  { name: 'Poppins', weights: [300, 400, 500, 600, 700, 800], scripts: ['en'] },
  { name: 'Fraunces', weights: [400, 500, 600, 700, 800], scripts: ['en'] },
  { name: 'Playfair Display', weights: [400, 500, 600, 700, 800], scripts: ['en'] },
  { name: 'DM Serif Display', weights: [400], scripts: ['en'] },
  { name: 'Lora', weights: [400, 500, 600, 700], scripts: ['en'] },
];

const lightColors = {
  primary: '#7A4A24',
  primaryText: '#FFFFFF',
  secondary: '#24513C',
  accent: '#C9A13B',
  bg: '#FBF7F1',
  surface: '#FFFFFF',
  text: '#2B2018',
  muted: '#6F6156',
  border: '#ECE2D4',
  headerBg: '#FBF7F1',
  headerText: '#2B2018',
  footerBg: '#1E2C24',
  footerText: '#EFE6D8',
  buttonBg: '#7A4A24',
  buttonText: '#FFFFFF',
  badgeBg: '#B5382A',
  badgeText: '#FFFFFF',
  price: '#24513C',
  announceBg: '#24513C',
  announceText: '#FFFFFF',
};

const darkColors = {
  primary: '#D9A066',
  primaryText: '#1A140F',
  secondary: '#7FB89A',
  accent: '#E1BE5C',
  bg: '#16120E',
  surface: '#221B15',
  text: '#F3ECE2',
  muted: '#B5A796',
  border: '#3A3027',
  headerBg: '#1B1611',
  headerText: '#F3ECE2',
  footerBg: '#100D0A',
  footerText: '#E5DACB',
  buttonBg: '#D9A066',
  buttonText: '#1A140F',
  badgeBg: '#E0634F',
  badgeText: '#FFFFFF',
  price: '#9BD3B2',
  announceBg: '#2E5A45',
  announceText: '#FFFFFF',
};

export const DEFAULT_THEME = {
  mode: 'light', // light | dark | auto
  colors: lightColors,
  darkColors,
  background: {
    type: 'solid', // solid | gradient | image
    gradient: { from: '#FBF7F1', to: '#F3E8D6', angle: 180 },
    image: '',
    overlay: 0.85,
  },
  fonts: {
    heading: 'Noto Kufi Arabic',
    body: 'Vazirmatn',
    latinHeading: 'Fraunces',
    latinBody: 'Inter',
  },
  typography: {
    baseSize: 16,
    headingScale: 1.25,
    headingWeight: 700,
    bodyWeight: 400,
    lineHeight: 1.7,
    headingLineHeight: 1.3,
    letterSpacing: 0,
    headingLetterSpacing: 0,
    wordSpacing: 0,
  },
  spacing: {
    section: 56,
    cardGap: 16,
    radius: 18,
  },
  logo: '',
  logoHeight: 44,
  favicon: '',
};

export const COLOR_LABELS = Object.keys(lightColors);

/** Deep-merges admin values over defaults. */
export function mergeTheme(theme = {}) {
  const t = theme || {};
  return {
    ...DEFAULT_THEME,
    ...t,
    colors: { ...DEFAULT_THEME.colors, ...(t.colors || {}) },
    darkColors: { ...DEFAULT_THEME.darkColors, ...(t.darkColors || {}) },
    background: { ...DEFAULT_THEME.background, ...(t.background || {}), gradient: { ...DEFAULT_THEME.background.gradient, ...(t.background?.gradient || {}) } },
    fonts: { ...DEFAULT_THEME.fonts, ...(t.fonts || {}) },
    typography: { ...DEFAULT_THEME.typography, ...(t.typography || {}) },
    spacing: { ...DEFAULT_THEME.spacing, ...(t.spacing || {}) },
  };
}
