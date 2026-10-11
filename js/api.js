// DEMO data layer — replaces js/api.js in the static demo build (scripts/build-demo.mjs).
// Reads the shop data from data/*.json and simulates the Cloud Functions in the
// browser, so the whole site (search, cart, checkout, coupons, card payment)
// can be shown on GitHub Pages without Firebase. Orders are stored in this
// browser only — nothing is sent anywhere.
import { computeTotals } from './shared/pricing.js';
import { normalizeIraqiPhone, LANGS } from './shared/text.js';

const ORDERS_KEY = 'cz_demo_orders';
const DATE_KEYS = new Set(['start', 'end', 'endsAt', 'cr', 'createdAt']);
let bootPromise = null;

/** Shift every date so offers and countdowns always look current in the demo. */
function shiftDates(value, delta) {
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, delta));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = DATE_KEYS.has(k) && typeof v === 'number' ? v + delta : shiftDates(v, delta);
    return out;
  }
  return value;
}

function boot() {
  bootPromise ||= fetch('data/boot.json').then((r) => r.json()).then((b) => {
    const delta = Date.now() - b.generatedAt;
    const docs = shiftDates(b.docs, delta);
    const catalog = shiftDates(JSON.parse(b.docs['catalog/index'].json), delta);
    docs['catalog/index'] = { json: JSON.stringify(catalog), parts: 1 };
    return { ...b, docs, coupons: shiftDates(b.coupons, delta), delta };
  });
  return bootPromise;
}

const loadOrders = () => { try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '{}'); } catch { return {}; } };
const saveOrders = (o) => { try { localStorage.setItem(ORDERS_KEY, JSON.stringify(o)); } catch { /* ignore */ } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let productsPromise = null;
async function product(id) {
  productsPromise ||= fetch('data/products.json').then((r) => r.json());
  const [all, b] = await Promise.all([productsPromise, boot()]);
  return all[id] ? shiftDates(all[id], b.delta) : null;
}

export async function getDoc(path) {
  const [col, ...rest] = path.split('/');
  const id = decodeURIComponent(rest.join('/'));
  if (col === 'publicOrders') return loadOrders()[id] || null;
  if (col === 'products') return product(id);
  return (await boot()).docs[path] ?? null;
}

export async function getDocs(paths) {
  const b = await boot();
  return Object.fromEntries(paths.map((p) => [p, b.docs[p] ?? null]));
}

export class ApiError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

async function priceCart(items, couponCode, cityId) {
  const b = await boot();
  const shop = b.docs['settings/shop'];
  const catalog = JSON.parse(b.docs['catalog/index'].json);
  const categories = Object.fromEntries(catalog.categories.map((c) => [c.id, { discount: c.d, parentId: c.p }]));
  const lines = [];
  for (const it of items || []) {
    const p = await product(it.productId);
    if (!p || p.hidden) throw new ApiError('failed-precondition', `unavailable:${it.productId}`);
    if (p.inStock === false) throw new ApiError('failed-precondition', `out-of-stock:${it.productId}`);
    const weight = (p.weights || []).find((w) => w.id === it.weightId);
    if (!weight) throw new ApiError('failed-precondition', `unavailable:${it.productId}`);
    lines.push({ product: { ...p, id: it.productId }, weight, qty: it.qty });
  }
  if (!lines.length) throw new ApiError('invalid-argument', 'cart-empty');
  const code = String(couponCode || '').trim().toUpperCase();
  const coupon = code ? (b.coupons[code] ? { ...b.coupons[code], code } : { code, active: false }) : null;
  const pre = computeTotals({ lines, categories, coupon });
  const city = (shop.deliveryFees || []).find((c) => c.id === cityId);
  const freeOver = Number(shop.freeDeliveryOver) || 0;
  const fee = city ? (freeOver > 0 && pre.subtotal - pre.couponDiscount >= freeOver ? 0 : Number(city.fee) || 0) : 0;
  return { shop, coupon, city, totals: computeTotals({ lines, categories, coupon, deliveryFee: fee }) };
}

const weightLabel = (w) => {
  const g = Number(w.grams) || 0;
  const units = { en: ['g', 'kg'], ar: ['غم', 'كغم'], ckb: ['گرام', 'کیلۆ'] };
  return Object.fromEntries(LANGS.map((l) => [l, w.label?.[l] || w.label?.en || (g >= 1000 ? `${+(g / 1000).toFixed(2)} ${units[l][1]}` : `${g} ${units[l][0]}`)]));
};

const handlers = {
  async checkCoupon({ items, code, cityId }) {
    const { totals, coupon } = await priceCart(items, code, cityId);
    const r = totals.coupon || { ok: false, reason: 'invalid' };
    return { ok: !!r.ok, reason: r.reason || null, minOrder: r.minOrder || null, code: coupon?.code, discount: totals.couponDiscount, total: totals.total };
  },

  async placeOrder(data) {
    const c = data.customer || {};
    if ((c.name || '').trim().length < 2) throw new ApiError('invalid-argument', 'bad-name');
    const phone = normalizeIraqiPhone(c.phone);
    if (!phone) throw new ApiError('invalid-argument', 'bad-phone');
    if ((c.address || '').trim().length < 4) throw new ApiError('invalid-argument', 'bad-address');
    const { shop, city, totals } = await priceCart(data.items, data.couponCode, c.cityId);
    if (!city) throw new ApiError('invalid-argument', 'bad-city');
    if (Number(shop.minOrder) > 0 && totals.subtotal < Number(shop.minOrder)) throw new ApiError('failed-precondition', 'min-order');
    if (data.couponCode && !totals.coupon?.ok) throw new ApiError('failed-precondition', `coupon:${totals.coupon?.reason || 'invalid'}`);
    const orders = loadOrders();
    const id = `demo-${Date.now().toString(36)}`;
    const number = 1001 + Object.keys(orders).length;
    orders[id] = {
      number,
      status: 'new',
      paymentMethod: data.paymentMethod === 'card' ? 'card' : 'cash',
      paymentStatus: data.paymentMethod === 'card' ? 'awaiting' : 'pending',
      items: totals.lines.map((l) => ({ name: l.product.name, weightLabel: weightLabel(l.weight), qty: l.qty, lineTotal: l.lineTotal, thumb: l.product.images?.[0]?.thumb || '' })),
      subtotalOriginal: totals.subtotalOriginal,
      itemDiscount: totals.itemDiscount,
      couponDiscount: totals.couponDiscount,
      deliveryFee: totals.deliveryFee,
      total: totals.total,
      createdAt: Date.now(),
    };
    saveOrders(orders);
    await wait(700);
    return { orderId: id, number, total: totals.total, paymentMethod: orders[id].paymentMethod };
  },

  async createPayment({ orderId }) {
    const o = loadOrders()[orderId];
    if (!o) throw new ApiError('not-found', 'order-not-found');
    await wait(500);
    return { url: `demo-pay.html?order=${encodeURIComponent(orderId)}`, total: o.total };
  },
};

export async function callFunction(name, data) {
  const fn = handlers[name];
  if (!fn) throw new ApiError('unimplemented', name);
  return fn(data || {});
}
