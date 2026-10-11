// Three-language system: Arabic (ar), Kurdish Sorani (ckb), English (en).
// Arabic & Kurdish are RTL; switching language flips <html dir>.
import STRINGS from './strings.js';
import { state } from './store.js';
import { LANGS, RTL_LANGS, pick } from './shared/text.js';

const KEY = 'cz_lang';
let current = null;
const listeners = new Set();

export const LANG_NAMES = { ckb: 'کوردی', ar: 'العربية', en: 'English' };
export const defaultLang = () => (LANGS.includes(state.shop?.defaultLanguage) ? state.shop.defaultLanguage : 'ckb');
export const getLang = () => current || defaultLang();
export const isRTL = (l = getLang()) => RTL_LANGS.includes(l);
export const onLangChange = (fn) => listeners.add(fn);

export function initLang() {
  try { localStorage.setItem('cz_default_lang', defaultLang()); } catch { /* ignore */ }
  const fromUrl = new URLSearchParams(location.search).get('lang');
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
  const lang = [fromUrl, saved].find((l) => LANGS.includes(l)) || defaultLang();
  // A language chosen through a link (?lang=ar) is remembered for the next pages.
  if (LANGS.includes(fromUrl) && fromUrl !== saved && !state.preview) {
    try { localStorage.setItem(KEY, fromUrl); } catch { /* ignore */ }
  }
  applyLang(lang);
}

function applyLang(lang) {
  current = lang;
  const html = document.documentElement;
  html.lang = lang;
  html.dir = isRTL(lang) ? 'rtl' : 'ltr';
}

export function setLang(lang) {
  if (!LANGS.includes(lang) || lang === current) return;
  applyLang(lang);
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) {
    url.searchParams.set('lang', lang);
    history.replaceState(history.state, '', url);
  }
  listeners.forEach((fn) => fn(lang));
}

/** UI string by key. Admin overrides (settings/content.texts) win over built-ins. */
export function t(key, vars) {
  const lang = getLang();
  const def = defaultLang();
  const override = state.content?.texts?.[key];
  let s = (override && (override[lang] || override[def]))
    || STRINGS[lang]?.[key] || STRINGS[def]?.[key] || STRINGS.en[key] || key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}

/** Picks the current language from a { ar, ckb, en } object (falls back to default). */
export const tr = (obj) => pick(obj, getLang(), defaultLang());

/** Fills [data-i18n] and [data-i18n-attr="attr:key;attr:key"] in static HTML. */
export function translateDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':');
      if (attr && key) el.setAttribute(attr.trim(), t(key.trim()));
    });
  });
}
