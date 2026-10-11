// Shopping cart stored in localStorage. Only ids/weights/quantities are stored;
// prices are always recomputed from the latest catalog (and again on the server).
import { state } from './store.js';
import { computeTotals } from './shared/pricing.js';
import { decimals } from './format.js';

const KEY = 'cz_cart';
const COUPON_KEY = 'cz_coupon';
const listeners = new Set();

let items = load();

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((i) => i && i.id && i.w && i.q > 0) : [];
  } catch {
    return [];
  }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  listeners.forEach((fn) => fn());
}

export const onCartChange = (fn) => listeners.add(fn);
export const cartItems = () => items.slice();
export const cartCount = () => items.reduce((n, i) => n + i.q, 0);

export function addToCart(id, weightId, qty = 1) {
  const existing = items.find((i) => i.id === id && i.w === weightId);
  if (existing) existing.q = Math.min(99, existing.q + qty);
  else items.push({ id, w: weightId, q: Math.min(99, qty) });
  save();
}

export function setQty(id, weightId, qty) {
  const it = items.find((i) => i.id === id && i.w === weightId);
  if (!it) return;
  if (qty <= 0) items = items.filter((i) => i !== it);
  else it.q = Math.min(99, qty);
  save();
}

export function removeFromCart(id, weightId) {
  items = items.filter((i) => !(i.id === id && i.w === weightId));
  save();
}

export function clearCart() {
  items = [];
  try { localStorage.removeItem(COUPON_KEY); } catch { /* ignore */ }
  save();
}

export function getCoupon() {
  try { return localStorage.getItem(COUPON_KEY) || ''; } catch { return ''; }
}
export function setCoupon(code) {
  try {
    if (code) localStorage.setItem(COUPON_KEY, code);
    else localStorage.removeItem(COUPON_KEY);
  } catch { /* ignore */ }
}

/** Cart lines resolved against the catalog; unknown products are dropped. */
export function cartLines() {
  const lines = [];
  for (const i of items) {
    const product = state.productMap.get(i.id);
    const weight = product?.weights.find((w) => w.id === i.w);
    if (product && weight) lines.push({ product, weight, qty: i.q, key: `${i.id}|${i.w}` });
  }
  return lines;
}

/** Client-side preview of totals (the server recalculates the real amount). */
export function cartTotals({ couponDiscount = 0, deliveryFee = 0 } = {}) {
  const r = computeTotals({ lines: cartLines(), categories: state.discountCats, deliveryFee, decimals: decimals() });
  const total = Math.max(0, r.subtotal - couponDiscount) + r.deliveryFee;
  return { ...r, couponDiscount, total };
}

export function cartPayload() {
  return items.map((i) => ({ productId: i.id, weightId: i.w, qty: i.q }));
}

// Keep tabs in sync.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    items = load();
    listeners.forEach((fn) => fn());
  }
});
