// Loads shop settings + the catalog index in one request, caches them in
// localStorage (instant repeat visits) and refreshes in the background.
import { getDocs, getDoc } from './api.js';

const CACHE_KEY = 'cz_boot_v1';
const DOCS = ['settings/theme', 'settings/content', 'settings/shop', 'settings/offers', 'catalog/index'];

export const state = {
  theme: {},
  content: {},
  shop: {},
  offers: { items: [] },
  products: [],
  categories: [],
  productMap: new Map(),
  categoryMap: new Map(),
  discountCats: {},
  catalogVersion: 0,
  loaded: false,
  preview: new URLSearchParams(location.search).has('preview'),
};

const listeners = new Set();
export const onStoreChange = (fn) => listeners.add(fn);
const notify = () => listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });

function normalizeCatalog(cat) {
  const categories = (cat?.categories || []).map((c) => ({
    id: c.id, name: c.n || {}, parentId: c.p || '', sort: c.o || 0, thumb: c.t || '', blur: c.b || '', discount: c.d || null,
  }));
  const products = (cat?.products || []).map((p) => ({
    id: p.id,
    name: p.n || {},
    keywords: p.k || '',
    categoryId: p.c || '',
    weights: (p.w || []).map((w) => ({ id: w.id, grams: w.g, price: w.p, label: w.l || null })),
    thumb: p.t || '',
    blur: p.b || '',
    inStock: p.s !== 0,
    featured: !!p.f,
    sold: p.so || 0,
    created: p.cr || 0,
    sort: p.o || 0,
    discount: p.d || null,
  }));
  return { categories, products, version: cat?.v || 0 };
}

function apply(raw) {
  state.theme = raw.theme || {};
  state.content = raw.content || {};
  state.shop = raw.shop || {};
  state.offers = raw.offers || { items: [] };
  const { categories, products, version } = normalizeCatalog(raw.catalog);
  state.categories = categories;
  state.products = products;
  state.catalogVersion = version;
  state.categoryMap = new Map(categories.map((c) => [c.id, c]));
  state.productMap = new Map(products.map((p) => [p.id, p]));
  state.discountCats = Object.fromEntries(categories.map((c) => [c.id, { discount: c.discount, parentId: c.parentId }]));
  state.loaded = true;
}

async function fetchAll() {
  const docs = await getDocs(DOCS);
  const idx = docs['catalog/index'];
  let json = idx?.json || '{}';
  if (idx?.parts > 1) {
    const rest = await Promise.all(Array.from({ length: idx.parts - 1 }, (_, i) => getDoc(`catalog/index-${i + 1}`)));
    json += rest.map((d) => d?.json || '').join('');
  }
  let catalog = {};
  try { catalog = JSON.parse(json); } catch { catalog = {}; }
  return {
    theme: docs['settings/theme'],
    content: docs['settings/content'],
    shop: docs['settings/shop'],
    offers: docs['settings/offers'],
    catalog,
  };
}

let fingerprint = '';
const fp = (raw) => JSON.stringify([raw.theme, raw.content, raw.shop, raw.offers, raw.catalog?.v]);

/** Resolves as soon as data is available (from cache or network). */
export async function boot() {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { /* private mode */ }
  if (cached) {
    apply(cached);
    fingerprint = fp(cached);
  }
  const fresh = fetchAll()
    .then((raw) => {
      const f = fp(raw);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(raw)); } catch { /* quota */ }
      if (f !== fingerprint) {
        fingerprint = f;
        const first = !state.loaded;
        apply(raw);
        if (!first) notify();
      }
    })
    .catch((e) => {
      console.warn('Could not load shop data', e);
      if (!state.loaded) apply({});
    });
  if (!cached) await fresh;
  if (state.preview) listenForPreview();
  return state;
}

// Live preview from the admin design editor (page is inside an iframe).
function listenForPreview() {
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.data?.type !== 'cz-preview') return;
    if (e.data.theme) state.theme = e.data.theme;
    if (e.data.content) state.content = e.data.content;
    if (e.data.shop) state.shop = e.data.shop;
    notify();
  });
  window.parent?.postMessage({ type: 'cz-preview-ready' }, location.origin);
}
