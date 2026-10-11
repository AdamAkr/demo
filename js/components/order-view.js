import { t, tr } from '../i18n.js';
import { esc, money, imgTag, formatDate } from '../format.js';
import { icon } from '../icons.js';

const STEPS = ['new', 'confirmed', 'out_for_delivery', 'delivered'];

export function statusTimeline(status) {
  if (status === 'cancelled') return `<p class="notice notice--error">${esc(t('status.cancelled'))}</p>`;
  const idx = Math.max(0, STEPS.indexOf(status));
  return `<ol class="timeline">${STEPS.map((s, i) => `<li class="${i < idx ? 'is-done' : i === idx ? 'is-current' : ''}">
    <span class="timeline-dot">${i <= idx ? icon('check') : ''}</span><span>${esc(t(`status.${s}`))}</span></li>`).join('')}</ol>`;
}

export function orderDetails(o) {
  return `<div class="card order-card">
    <h2 class="card-title">${esc(t('order.items'))}</h2>
    <ul class="summary-lines">${(o.items || []).map((i) => `<li>
      <span class="summary-img">${imgTag(i.thumb, { alt: '', w: 56, h: 56 })}<span class="summary-qty">${i.qty}</span></span>
      <span class="summary-name">${esc(tr(i.name))}<span class="muted small">${esc(tr(i.weightLabel))}</span></span>
      <span class="summary-price">${esc(money(i.lineTotal))}</span></li>`).join('')}</ul>
    <div class="sum-row"><span>${esc(t('cart.subtotal'))}</span><span>${esc(money(o.subtotalOriginal))}</span></div>
    ${o.itemDiscount > 0 ? `<div class="sum-row sum-row--save"><span>${esc(t('checkout.discount'))}</span><span>-${esc(money(o.itemDiscount))}</span></div>` : ''}
    ${o.couponDiscount > 0 ? `<div class="sum-row sum-row--save"><span>${esc(t('checkout.coupon'))}</span><span>-${esc(money(o.couponDiscount))}</span></div>` : ''}
    <div class="sum-row"><span>${esc(t('checkout.delivery'))}</span><span>${o.deliveryFee ? esc(money(o.deliveryFee)) : esc(t('checkout.free'))}</span></div>
    <div class="sum-row sum-row--total"><span>${esc(t('checkout.total'))}</span><span>${esc(money(o.total))}</span></div>
    <div class="sum-row"><span>${esc(t('checkout.payment'))}</span><span>${esc(t(o.paymentMethod === 'card' ? 'checkout.card' : 'checkout.cash'))} · ${esc(t(`payStatus.${o.paymentStatus}`))}</span></div>
    ${o.createdAt ? `<p class="muted small">${esc(formatDate(o.createdAt))}</p>` : ''}
  </div>`;
}
