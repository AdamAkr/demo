// Instant, client-side search & filtering over the catalog index.
// Works across Arabic, Kurdish and English names + description keywords.
import { state } from './store.js';
import { normalizeSearch } from './shared/text.js';
import { price } from './format.js';

let indexVersion = -1;
let index = [];

function buildIndex() {
  if (indexVersion === state.catalogVersion && index.length === state.products.length) return;
  indexVersion = state.catalogVersion;
  index = state.products.map((p) => {
    const cat = state.categoryMap.get(p.categoryId);
    return {
      p,
      name: normalizeSearch(Object.values(p.name).join(' ')),
      text: normalizeSearch(`${p.keywords} ${cat ? Object.values(cat.name).join(' ') : ''}`),
    };
  });
}

function score(entry, tokens) {
  let s = 0;
  for (const tok of tokens) {
    const nameWords = entry.name.split(' ');
    if (nameWords.some((w) => w === tok)) s += 12;
    else if (nameWords.some((w) => w.startsWith(tok))) s += 8;
    else if (entry.name.includes(tok)) s += 5;
    else if (entry.text.split(' ').some((w) => w.startsWith(tok))) s += 3;
    else if (entry.text.includes(tok)) s += 1;
    else return 0; // every word must match somewhere
  }
  return s + (entry.p.inStock ? 1 : 0) + Math.min(2, entry.p.sold / 50);
}

export function searchProducts(query, limit = Infinity) {
  buildIndex();
  const tokens = normalizeSearch(query).split(' ').filter(Boolean);
  if (!tokens.length) return [];
  const results = [];
  for (const e of index) {
    const s = score(e, tokens);
    if (s > 0) results.push([s, e.p]);
  }
  results.sort((a, b) => b[0] - a[0]);
  return results.slice(0, limit).map((r) => r[1]);
}

/** All descendant category ids (including itself). */
export function categoryTree(id) {
  const out = new Set([id]);
  let added = true;
  while (added) {
    added = false;
    for (const c of state.categories) {
      if (c.parentId && out.has(c.parentId) && !out.has(c.id)) { out.add(c.id); added = true; }
    }
  }
  return out;
}

export const minPrice = (p) => Math.min(...p.weights.map((w) => price(p, w).final));
const onSale = (p) => p.weights.some((w) => price(p, w).discount > 0);

/**
 * Filters & sorts products.
 * f = { q, category, min, max, weights:[grams], sale, stock, sort }
 */
export function filterProducts(f) {
  let list = f.q ? searchProducts(f.q) : state.products.slice();
  if (f.category) {
    const ids = categoryTree(f.category);
    list = list.filter((p) => ids.has(p.categoryId));
  }
  if (f.weights?.length) {
    const set = new Set(f.weights.map(Number));
    list = list.filter((p) => p.weights.some((w) => set.has(Number(w.grams))));
  }
  if (f.sale) list = list.filter(onSale);
  if (f.stock) list = list.filter((p) => p.inStock);
  if (f.min != null && f.min !== '') list = list.filter((p) => minPrice(p) >= Number(f.min));
  if (f.max != null && f.max !== '') list = list.filter((p) => minPrice(p) <= Number(f.max));

  const sorters = {
    newest: (a, b) => b.created - a.created,
    price_asc: (a, b) => minPrice(a) - minPrice(b),
    price_desc: (a, b) => minPrice(b) - minPrice(a),
    best: (a, b) => b.sold - a.sold,
  };
  if (sorters[f.sort]) list.sort(sorters[f.sort]);
  else if (!f.q) list.sort((a, b) => a.sort - b.sort || b.created - a.created);
  // Out-of-stock items go last.
  return list.sort((a, b) => Number(b.inStock) - Number(a.inStock));
}

export function priceBounds(products = state.products) {
  if (!products.length) return [0, 0];
  const prices = products.map(minPrice);
  return [Math.min(...prices), Math.max(...prices)];
}

export function weightOptions(products = state.products) {
  const set = new Set();
  products.forEach((p) => p.weights.forEach((w) => w.grams && set.add(Number(w.grams))));
  return [...set].sort((a, b) => a - b);
}
