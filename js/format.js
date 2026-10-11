import { asset } from './routes.js';
import { state } from './store.js';
import { getLang, t, tr } from './i18n.js';
import { priceFor } from './shared/pricing.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function decimals() {
  return Number(state.shop?.currency?.decimals) || 0;
}

export function money(n) {
  const cur = state.shop?.currency || {};
  const d = decimals();
  const num = new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(n) || 0);
  const symbol = tr(cur.symbol) || cur.code || t('currency');
  return cur.position === 'before' ? `${symbol} ${num}` : `${num} ${symbol}`;
}

export function weightText(w) {
  if (!w) return '';
  const custom = w.label && tr(w.label);
  if (custom) return custom;
  const g = Number(w.grams) || 0;
  return g >= 1000 ? `${+(g / 1000).toFixed(2)} ${t('unit.kg')}` : `${g} ${t('unit.g')}`;
}

/** Price info for a catalog product + weight, including category discounts. */
export function price(product, weight) {
  return priceFor(product, weight?.price ?? product.weights?.[0]?.price ?? 0, state.discountCats, Date.now(), decimals());
}

/** Best (largest) percentage off across a product's weights — for the card badge. */
export function bestPercent(product) {
  return Math.max(0, ...product.weights.map((w) => price(product, w).percent));
}

export function priceHtml(info, { from = false } = {}) {
  const pre = from ? `<span class="price-from">${esc(t('price.from'))}</span> ` : '';
  if (info.discount > 0) {
    return `${pre}<span class="price price--sale">${esc(money(info.final))}</span> <s class="price-old">${esc(money(info.original))}</s>`;
  }
  return `${pre}<span class="price">${esc(money(info.final))}</span>`;
}

export { productUrl, categoryUrl } from './routes.js';

export function imgTag(src, { alt = '', blur = '', cls = '', w = 400, h = 400, eager = false, sizes = '' } = {}) {
  const style = blur ? ` style="background-image:url('${esc(blur)}')"` : '';
  return `<img class="img-fade ${cls}" src="${esc(src || asset('/img/placeholder.svg'))}" alt="${esc(alt)}" width="${w}" height="${h}"${sizes ? ` sizes="${sizes}"` : ''} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"${style} onload="this.classList.add('is-loaded')" onerror="this.onerror=null;this.src='${asset('/img/placeholder.svg')}'">`;
}

/** Simple rich text: blank line = paragraph, single newline = <br>. */
export function paragraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function formatDate(ms) {
  if (!ms) return '';
  const locale = { en: 'en-GB', ar: 'ar-IQ', ckb: 'ckb-IQ' }[getLang()];
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Baghdad', numberingSystem: 'latn' }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString('en-GB', { timeZone: 'Asia/Baghdad' });
  }
}
