// Shared pricing & discount math.
// This exact file is copied to functions/shared/ (scripts/sync-shared.mjs) so the
// browser preview and the server-side recalculation always agree.
// The server result is the only one that is ever charged.

/** Converts Firestore Timestamp | Date | ISO string | ms number → ms (or null). */
export function toMs(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'object' && 'seconds' in v) return v.seconds * 1000;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

/** A discount looks like { type: 'percent'|'fixed', value, start?, end?, active? }. */
export function isDiscountActive(d, now = Date.now()) {
  if (!d || d.active === false) return false;
  const value = Number(d.value);
  if (!(value > 0)) return false;
  if (d.type !== 'percent' && d.type !== 'fixed') return false;
  const start = toMs(d.start);
  const end = toMs(d.end);
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

export function roundMoney(n, decimals = 0) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Amount taken off `price` by discount `d` (never more than the price). */
export function discountAmount(price, d, decimals = 0) {
  if (!d) return 0;
  const value = Number(d.value) || 0;
  const raw = d.type === 'percent' ? (price * Math.min(value, 100)) / 100 : value;
  return Math.max(0, Math.min(price, roundMoney(raw, decimals)));
}

/**
 * Collects the discounts that apply to a product: its own discount plus the
 * discounts of its category and every parent category.
 * `categories` is a map { id: { discount, parentId } }.
 */
export function applicableDiscounts(product, categories = {}, now = Date.now()) {
  const list = [];
  if (isDiscountActive(product?.discount, now)) list.push({ ...product.discount, source: 'product' });
  let catId = product?.categoryId;
  const seen = new Set();
  while (catId && categories[catId] && !seen.has(catId)) {
    seen.add(catId);
    const cat = categories[catId];
    if (isDiscountActive(cat.discount, now)) list.push({ ...cat.discount, source: 'category', categoryId: catId });
    catId = cat.parentId;
  }
  return list;
}

/**
 * Final unit price for one weight option. Discounts do not stack:
 * the single best discount for the customer wins.
 */
export function priceFor(product, weightPrice, categories = {}, now = Date.now(), decimals = 0) {
  const original = Number(weightPrice) || 0;
  let best = null;
  let bestAmount = 0;
  for (const d of applicableDiscounts(product, categories, now)) {
    const amt = discountAmount(original, d, decimals);
    if (amt > bestAmount) { bestAmount = amt; best = d; }
  }
  const final = roundMoney(original - bestAmount, decimals);
  const percent = original > 0 && bestAmount > 0 ? Math.round((bestAmount / original) * 100) : 0;
  return { original, final, discount: bestAmount, percent, source: best?.source || null, endsAt: best ? toMs(best.end) : null };
}

/** Coupon validity check. Returns { ok, reason, amount }. */
export function evaluateCoupon(coupon, subtotal, now = Date.now(), decimals = 0) {
  if (!coupon || coupon.active === false) return { ok: false, reason: 'invalid', amount: 0 };
  const start = toMs(coupon.start);
  const end = toMs(coupon.end);
  if (start && now < start) return { ok: false, reason: 'notStarted', amount: 0 };
  if (end && now > end) return { ok: false, reason: 'expired', amount: 0 };
  if (coupon.usageLimit > 0 && (coupon.usedCount || 0) >= coupon.usageLimit) return { ok: false, reason: 'usedUp', amount: 0 };
  if (coupon.minOrder > 0 && subtotal < coupon.minOrder) return { ok: false, reason: 'minOrder', amount: 0, minOrder: coupon.minOrder };
  const amount = discountAmount(subtotal, coupon, decimals);
  if (!(amount > 0)) return { ok: false, reason: 'invalid', amount: 0 };
  return { ok: true, amount };
}

/**
 * Computes a full cart.
 * lines: [{ product, weight: {label, price}, qty }]
 * Returns { lines, subtotalOriginal, itemDiscount, subtotal, couponDiscount, deliveryFee, total }.
 */
export function computeTotals({ lines, categories = {}, coupon = null, deliveryFee = 0, now = Date.now(), decimals = 0 }) {
  const out = [];
  let subtotalOriginal = 0;
  let subtotal = 0;
  for (const l of lines) {
    const p = priceFor(l.product, l.weight.price, categories, now, decimals);
    const qty = Math.max(1, Math.floor(l.qty || 1));
    const lineOriginal = p.original * qty;
    const lineTotal = p.final * qty;
    subtotalOriginal += lineOriginal;
    subtotal += lineTotal;
    out.push({ ...l, qty, unitOriginal: p.original, unitPrice: p.final, percent: p.percent, lineOriginal, lineTotal });
  }
  let couponResult = null;
  let couponDiscount = 0;
  if (coupon) {
    couponResult = evaluateCoupon(coupon, subtotal, now, decimals);
    if (couponResult.ok) couponDiscount = couponResult.amount;
  }
  const fee = Math.max(0, Number(deliveryFee) || 0);
  const total = roundMoney(Math.max(0, subtotal - couponDiscount) + fee, decimals);
  return {
    lines: out,
    subtotalOriginal: roundMoney(subtotalOriginal, decimals),
    itemDiscount: roundMoney(subtotalOriginal - subtotal, decimals),
    subtotal: roundMoney(subtotal, decimals),
    coupon: couponResult,
    couponDiscount,
    deliveryFee: fee,
    total,
  };
}
