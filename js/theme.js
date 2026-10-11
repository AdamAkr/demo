// Applies the admin-controlled theme as CSS variables. Every visual setting in
// settings/theme maps to a variable used by app.css, so changes show instantly.
import { FONTS, mergeTheme } from './theme-defaults.js';

const kebab = (s) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const fontStack = (name, fallback) => `"${name}", ${fallback}`;

function colorVars(colors) {
  return Object.entries(colors).map(([k, v]) => `--c-${kebab(k)}:${v};`).join('');
}

function cssUrl(u) {
  return `url("${String(u).replace(/["\\\n]/g, '')}")`;
}

function backgroundValue(bg, colors) {
  if (bg.type === 'gradient') return `linear-gradient(${Number(bg.gradient.angle) || 180}deg, ${bg.gradient.from}, ${bg.gradient.to})`;
  if (bg.type === 'image' && bg.image) {
    const o = Math.min(1, Math.max(0, Number(bg.overlay ?? 0.85)));
    // A translucent wash of the background colour keeps text readable over photos.
    const hex = colors.bg.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0);
    return `linear-gradient(rgba(${r},${g},${b},${o}), rgba(${r},${g},${b},${o})), ${cssUrl(bg.image)} center / cover fixed`;
  }
  return colors.bg;
}

let loadedFontsHref = '';
function loadFonts(names) {
  const families = [...new Set(names)]
    .map((n) => FONTS.find((f) => f.name === n))
    .filter(Boolean)
    .map((f) => `family=${encodeURIComponent(f.name).replace(/%20/g, '+')}:wght@${f.weights.filter((w) => w >= 400 && w <= 700).join(';') || f.weights.join(';')}`);
  if (!families.length) return;
  const href = `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
  if (href === loadedFontsHref) return;
  loadedFontsHref = href;
  let link = document.getElementById('cz-fonts');
  if (!link) {
    link = document.createElement('link');
    link.id = 'cz-fonts';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  link.href = href;
  try { localStorage.setItem('cz_fonts_href', href); } catch { /* ignore */ }
}

/** `persist: false` is used by the admin live preview so drafts are not cached. */
export function applyTheme(rawTheme, { persist = true } = {}) {
  const t = mergeTheme(rawTheme);
  const ty = t.typography;
  const sp = t.spacing;
  const base = `
    --font-heading-ar:${fontStack(t.fonts.heading, 'system-ui, sans-serif')};
    --font-body-ar:${fontStack(t.fonts.body, 'system-ui, sans-serif')};
    --font-heading-en:${fontStack(t.fonts.latinHeading, 'Georgia, serif')};
    --font-body-en:${fontStack(t.fonts.latinBody, 'system-ui, sans-serif')};
    --fs-base:${Number(ty.baseSize) || 16}px;
    --fs-scale:${Number(ty.headingScale) || 1.25};
    --fw-heading:${ty.headingWeight};
    --fw-body:${ty.bodyWeight};
    --lh-body:${ty.lineHeight};
    --lh-heading:${ty.headingLineHeight};
    --ls-body:${Number(ty.letterSpacing) || 0}em;
    --ls-heading:${Number(ty.headingLetterSpacing) || 0}em;
    --ws-body:${Number(ty.wordSpacing) || 0}em;
    --space-section:${Number(sp.section) || 56}px;
    --gap-card:${Number(sp.cardGap) || 16}px;
    --radius:${Number(sp.radius) || 0}px;
    --logo-h:${Number(t.logoHeight) || 44}px;`;

  const light = colorVars(t.colors) + `--page-bg:${backgroundValue(t.background, t.colors)};`;
  const darkBg = t.background.type === 'image' ? backgroundValue(t.background, t.darkColors) : t.darkColors.bg;
  const dark = colorVars(t.darkColors) + `--page-bg:${darkBg};`;

  let css = `:root{${base}${t.mode === 'dark' ? dark : light}color-scheme:${t.mode === 'dark' ? 'dark' : 'light'};}`;
  if (t.mode === 'auto') css += `@media (prefers-color-scheme: dark){:root{${dark}color-scheme:dark;}}`;

  let style = document.getElementById('cz-theme');
  if (!style) {
    style = document.createElement('style');
    style.id = 'cz-theme';
    document.head.appendChild(style);
  }
  style.textContent = css;
  if (persist) { try { localStorage.setItem('cz_theme_css', css); } catch { /* ignore */ } }

  loadFonts([t.fonts.heading, t.fonts.body, t.fonts.latinHeading, t.fonts.latinBody]);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t.mode === 'dark' ? t.darkColors.headerBg : t.colors.headerBg;
  if (t.favicon) {
    let icon = document.querySelector('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement('link');
      icon.rel = 'icon';
      document.head.appendChild(icon);
    }
    icon.href = t.favicon;
  }
  return t;
}
