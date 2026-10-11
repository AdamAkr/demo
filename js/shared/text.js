// Shared text helpers (copied to functions/shared/ by scripts/sync-shared.mjs).

export const LANGS = ['ar', 'ckb', 'en'];
export const RTL_LANGS = ['ar', 'ckb'];

/** Converts Arabic-Indic (٠-٩) and Persian/Kurdish (۰-۹) digits to Latin digits. */
export function latinDigits(s) {
  return String(s ?? '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * Validates an Iraqi mobile number and returns it as +9647XXXXXXXXX, or null.
 * Accepts: 07XX XXX XXXX, 7XX XXX XXXX, +964 7XX…, 00964 7XX…, with spaces/dashes,
 * in Latin or Arabic/Kurdish digits.
 */
export function normalizeIraqiPhone(input) {
  const s = latinDigits(input).replace(/[\s\-().]/g, '');
  const m = s.match(/^(?:\+964|00964|964|0)?(7[3-9]\d{8})$/);
  return m ? `+964${m[1]}` : null;
}

/** Normalizes text for search across Arabic, Kurdish (Sorani) and English. */
export function normalizeSearch(s) {
  return latinDigits(s)
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '') // tashkeel + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىيێ]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ةەه]/g, 'ه')
    .replace(/ۆ/g, 'و')
    .replace(/ڵ/g, 'ل')
    .replace(/ڕ/g, 'ر')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ی')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Picks the text for `lang` from a { ar, ckb, en } object with fallbacks. */
export function pick(obj, lang, fallbackLang = 'ar') {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj[fallbackLang] || obj.en || obj.ar || obj.ckb || '';
}
