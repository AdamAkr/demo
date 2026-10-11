import { to } from '../routes.js';
import { mountPage, paymentIcons } from '../layout.js';
import { state } from '../store.js';
import { t, tr, getLang } from '../i18n.js';
import { callFunction } from '../api.js';
import { esc, money, imgTag, weightText } from '../format.js';
import { cartLines, cartTotals, cartPayload, clearCart, getCoupon, setCoupon, onCartChange } from '../cart.js';
import { normalizeIraqiPhone } from '../shared/text.js';
import { icon } from '../icons.js';

const SAVED_KEY = 'cz_customer';
let coupon = { code: getCoupon(), discount: 0, ok: false, message: '' };
let location_ = null;
let submitting = false;

function saved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '{}'); } catch { return {}; }
}

function formValues() {
  const f = document.getElementById('checkout-form');
  if (!f) return saved();
  const d = new FormData(f);
  return Object.fromEntries(d.entries());
}

function cities() {
  return state.shop?.deliveryFees || [];
}

function deliveryFee(cityId, subtotalAfterCoupon) {
  const c = cities().find((x) => x.id === cityId);
  if (!c) return null;
  const freeOver = Number(state.shop?.freeDeliveryOver) || 0;
  return freeOver > 0 && subtotalAfterCoupon >= freeOver ? 0 : Number(c.fee) || 0;
}

function summary() {
  const v = formValues();
  const base = cartTotals({ couponDiscount: coupon.ok ? coupon.discount : 0 });
  const fee = deliveryFee(v.cityId, base.subtotal - base.couponDiscount);
  const totals = cartTotals({ couponDiscount: coupon.ok ? coupon.discount : 0, deliveryFee: fee || 0 });
  const lines = cartLines();
  const freeOver = Number(state.shop?.freeDeliveryOver) || 0;
  return `<h2 class="card-title">${esc(t('checkout.summary'))}</h2>
    <ul class="summary-lines">${lines.map((l, i) => `<li>
      <span class="summary-img">${imgTag(l.product.thumb, { alt: '', blur: l.product.blur, w: 56, h: 56 })}<span class="summary-qty">${l.qty}</span></span>
      <span class="summary-name">${esc(tr(l.product.name))}<span class="muted small">${esc(weightText(l.weight))}</span></span>
      <span class="summary-price">${esc(money(totals.lines[i].lineTotal))}</span></li>`).join('')}</ul>
    <div class="sum-row"><span>${esc(t('cart.subtotal'))}</span><span>${esc(money(totals.subtotalOriginal))}</span></div>
    ${totals.itemDiscount > 0 ? `<div class="sum-row sum-row--save"><span>${esc(t('checkout.discount'))}</span><span>-${esc(money(totals.itemDiscount))}</span></div>` : ''}
    ${coupon.ok ? `<div class="sum-row sum-row--save"><span>${esc(t('checkout.coupon'))} (${esc(coupon.code)})</span><span>-${esc(money(coupon.discount))}</span></div>` : ''}
    <div class="sum-row"><span>${esc(t('checkout.delivery'))}</span><span>${fee == null ? esc(t('checkout.chooseCityFirst')) : fee === 0 ? esc(t('checkout.free')) : esc(money(fee))}</span></div>
    ${freeOver > 0 && fee > 0 ? `<p class="muted small">${esc(t('checkout.freeOver', { amount: money(freeOver) }))}</p>` : ''}
    <div class="sum-row sum-row--total"><span>${esc(t('checkout.total'))}</span><span>${esc(money(totals.total))}</span></div>
    <p class="muted small">${icon('shield')} ${esc(t('checkout.serverNote'))}</p>`;
}

function refreshSummary() {
  const box = document.getElementById('summary');
  if (box) box.innerHTML = summary();
  const v = formValues();
  const btn = document.getElementById('place-order');
  if (btn && !submitting) btn.querySelector('span').textContent = v.payment === 'card' ? t('checkout.payByCard') : t('checkout.placeOrder');
}

function field(name, label, input, hint = '') {
  return `<div class="field" data-field="${name}">
    <label for="f-${name}">${esc(label)}</label>
    ${input}
    ${hint ? `<p class="field-hint">${esc(hint)}</p>` : ''}
    <p class="field-error" id="err-${name}" hidden></p>
  </div>`;
}

function render(main) {
  const lines = cartLines();
  if (!lines.length) {
    main.innerHTML = `<div class="container empty-state">${icon('cart', 'empty-icon')}<h1>${esc(t('cart.empty'))}</h1><a class="btn btn-primary" href="${to('shop')}">${esc(t('cart.startShopping'))}</a></div>`;
    return;
  }
  const v = { ...saved(), ...formValues() };
  const pay = state.shop?.payments || { cash: true };
  const methods = [pay.cash !== false && 'cash', pay.card && 'card'].filter(Boolean);
  const method = methods.includes(v.payment) ? v.payment : methods[0];

  main.innerHTML = `<div class="container checkout">
    <h1>${esc(t('checkout.title'))}</h1>
    <div class="checkout-layout">
      <form id="checkout-form" class="checkout-form" novalidate>
        <section class="card">
          <h2 class="card-title"><span class="step">1</span> ${esc(t('checkout.contact'))}</h2>
          ${field('name', t('checkout.name'), `<input id="f-name" name="name" autocomplete="name" required maxlength="80" value="${esc(v.name || '')}">`)}
          ${field('phone', t('checkout.phone'), `<input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" required placeholder="07XX XXX XXXX" value="${esc(v.phone || '')}">`, t('checkout.phoneHint'))}
        </section>

        <section class="card">
          <h2 class="card-title"><span class="step">2</span> ${esc(t('checkout.deliveryTitle'))}</h2>
          ${field('cityId', t('checkout.city'), `<select id="f-cityId" name="cityId" required>
              <option value="">${esc(t('checkout.selectCity'))}</option>
              ${cities().map((c) => `<option value="${esc(c.id)}" ${v.cityId === c.id ? 'selected' : ''}>${esc(tr(c.name))} — ${Number(c.fee) ? esc(money(c.fee)) : esc(t('checkout.free'))}</option>`).join('')}
            </select>`)}
          ${field('address', t('checkout.address'), `<textarea id="f-address" name="address" rows="3" required maxlength="400" autocomplete="street-address" placeholder="${esc(t('checkout.addressPlaceholder'))}">${esc(v.address || '')}</textarea>`)}
          <div class="location-row">
            <button type="button" class="btn btn-outline btn-sm" data-locate>${icon('location')} ${esc(t('checkout.shareLocation'))}</button>
            <span class="muted small" id="location-status">${location_ ? `${icon('check')} ${esc(t('checkout.locationSaved'))} · <a href="https://www.google.com/maps?q=${location_.lat},${location_.lng}" target="_blank" rel="noopener">${esc(t('checkout.viewMap'))}</a>` : esc(t('checkout.locationOptional'))}</span>
          </div>
          ${field('notes', t('checkout.notes'), `<textarea id="f-notes" name="notes" rows="2" maxlength="600" placeholder="${esc(t('checkout.notesPlaceholder'))}">${esc(v.notes || '')}</textarea>`)}
          <div class="hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>
        </section>

        <section class="card">
          <h2 class="card-title"><span class="step">3</span> ${esc(t('checkout.payment'))}</h2>
          <div class="pay-options" role="radiogroup">
            ${methods.map((m) => `<label class="pay-option">
              <input type="radio" name="payment" value="${m}" ${m === method ? 'checked' : ''}>
              <span class="pay-option-ui">${icon(m === 'card' ? 'card' : 'cash')}
                <span><strong>${esc(t(m === 'card' ? 'checkout.card' : 'checkout.cash'))}</strong>
                <span class="muted small">${esc(t(m === 'card' ? 'checkout.cardHint' : 'checkout.cashHint'))}</span></span></span>
            </label>`).join('')}
          </div>
          <div class="pay-icons pay-icons--sm">${paymentIcons()}</div>
          <div class="coupon">
            <label for="f-coupon">${esc(t('checkout.haveCoupon'))}</label>
            <div class="coupon-row">
              <input id="f-coupon" name="coupon" autocomplete="off" dir="ltr" value="${esc(coupon.code)}" placeholder="CODE">
              <button type="button" class="btn btn-outline" data-apply-coupon>${esc(coupon.ok ? t('checkout.remove') : t('checkout.apply'))}</button>
            </div>
            <p class="small coupon-msg ${coupon.ok ? 'text-success' : 'text-danger'}" id="coupon-msg" aria-live="polite">${esc(coupon.message)}</p>
          </div>
        </section>

        <div class="form-error notice notice--error" id="form-error" role="alert" hidden></div>
        <button type="submit" class="btn btn-primary btn-lg btn-block" id="place-order">${icon('check')} <span>${esc(method === 'card' ? t('checkout.payByCard') : t('checkout.placeOrder'))}</span></button>
        <p class="muted small center">${esc(t('checkout.terms'))}</p>
      </form>
      <aside class="card checkout-summary" id="summary" aria-live="polite">${summary()}</aside>
    </div>
  </div>`;
  bind();
}

function showError(name, msg) {
  const el = document.getElementById(`err-${name}`);
  const wrap = document.querySelector(`[data-field="${name}"]`);
  if (!el) return;
  el.textContent = msg || '';
  el.hidden = !msg;
  wrap?.classList.toggle('has-error', !!msg);
  wrap?.querySelector('input, select, textarea')?.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (msg) wrap?.querySelector('input, select, textarea')?.setAttribute('aria-describedby', `err-${name}`);
}

function validate(v) {
  const errors = {};
  if ((v.name || '').trim().length < 2) errors.name = t('checkout.errName');
  if (!normalizeIraqiPhone(v.phone)) errors.phone = t('checkout.errPhone');
  if (!v.cityId) errors.cityId = t('checkout.errCity');
  if ((v.address || '').trim().length < 4) errors.address = t('checkout.errAddress');
  ['name', 'phone', 'cityId', 'address'].forEach((k) => showError(k, errors[k]));
  return errors;
}

function serverMessage(err) {
  const m = String(err?.message || '');
  if (err?.code === 'network') return t('error.network');
  if (m.startsWith('out-of-stock')) {
    const p = state.productMap.get(m.split(':')[1]);
    return t('error.outOfStock', { name: p ? tr(p.name) : '' });
  }
  if (m.startsWith('unavailable')) return t('error.unavailable');
  if (m.startsWith('coupon:')) return t(`coupon.${m.split(':')[1]}`);
  const map = { 'bad-phone': 'checkout.errPhone', 'bad-name': 'checkout.errName', 'bad-address': 'checkout.errAddress', 'bad-city': 'checkout.errCity', 'min-order': 'error.minOrder', 'payment-disabled': 'error.paymentDisabled', 'cart-empty': 'cart.empty' };
  return map[m] ? t(map[m], { amount: money(state.shop?.minOrder || 0) }) : t('error.generic');
}

async function applyCoupon() {
  const input = document.getElementById('f-coupon');
  const msg = document.getElementById('coupon-msg');
  if (coupon.ok) {
    coupon = { code: '', discount: 0, ok: false, message: '' };
    setCoupon('');
    render(document.getElementById('main'));
    return;
  }
  const code = input.value.trim().toUpperCase();
  if (!code) return;
  msg.textContent = t('loading');
  msg.className = 'small coupon-msg';
  try {
    const r = await callFunction('checkCoupon', { items: cartPayload(), code, cityId: formValues().cityId || null });
    if (r.ok) {
      coupon = { code: r.code, discount: r.discount, ok: true, message: t('coupon.applied', { amount: money(r.discount) }) };
      setCoupon(r.code);
    } else {
      coupon = { code, discount: 0, ok: false, message: t(`coupon.${r.reason || 'invalid'}`, { amount: money(r.minOrder || 0) }) };
      setCoupon('');
    }
  } catch (e) {
    coupon = { code, discount: 0, ok: false, message: serverMessage(e) };
  }
  render(document.getElementById('main'));
}

function locate() {
  const status = document.getElementById('location-status');
  if (!navigator.geolocation) { status.textContent = t('checkout.locationUnsupported'); return; }
  status.textContent = t('checkout.locating');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      location_ = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      status.innerHTML = `${icon('check')} ${esc(t('checkout.locationSaved'))} · <a href="https://www.google.com/maps?q=${location_.lat},${location_.lng}" target="_blank" rel="noopener">${esc(t('checkout.viewMap'))}</a>`;
    },
    () => { status.textContent = t('checkout.locationDenied'); },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
  );
}

async function submit(e) {
  e.preventDefault();
  if (submitting) return;
  const v = formValues();
  const errors = validate(v);
  const errBox = document.getElementById('form-error');
  errBox.hidden = true;
  if (Object.keys(errors).length) {
    document.querySelector('.has-error input, .has-error select, .has-error textarea')?.focus();
    return;
  }
  const minOrder = Number(state.shop?.minOrder) || 0;
  if (minOrder && cartTotals().subtotal < minOrder) {
    errBox.textContent = t('error.minOrder', { amount: money(minOrder) });
    errBox.hidden = false;
    return;
  }
  try { localStorage.setItem(SAVED_KEY, JSON.stringify({ name: v.name, phone: v.phone, cityId: v.cityId, address: v.address })); } catch { /* ignore */ }

  submitting = true;
  const btn = document.getElementById('place-order');
  btn.disabled = true;
  btn.classList.add('is-loading');
  btn.querySelector('span').textContent = t('checkout.placing');
  try {
    const res = await callFunction('placeOrder', {
      items: cartPayload(),
      customer: { name: v.name, phone: v.phone, cityId: v.cityId, address: v.address, notes: v.notes, location: location_ },
      couponCode: coupon.ok ? coupon.code : null,
      paymentMethod: v.payment,
      lang: getLang(),
      website: v.website || '',
    });
    clearCart();
    if (res.paymentMethod === 'card') {
      btn.querySelector('span').textContent = t('checkout.redirecting');
      const pay = await callFunction('createPayment', { orderId: res.orderId });
      location.href = pay.url;
    } else {
      location.href = to('order', { id: res.orderId });
    }
  } catch (err) {
    submitting = false;
    btn.disabled = false;
    btn.classList.remove('is-loading');
    errBox.textContent = serverMessage(err);
    errBox.hidden = false;
    errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    refreshSummary();
  }
}

let bound = false;
function bind() {
  const form = document.getElementById('checkout-form');
  form.addEventListener('submit', submit);
  if (bound) return;
  bound = true;
  const main = document.getElementById('main');
  main.addEventListener('change', (e) => {
    if (e.target.name === 'cityId' || e.target.name === 'payment') refreshSummary();
    if (['name', 'phone', 'cityId', 'address'].includes(e.target.name) && document.querySelector(`[data-field="${e.target.name}"].has-error`)) validate(formValues());
  });
  main.addEventListener('blur', (e) => {
    if (e.target.name === 'phone' && e.target.value) {
      const n = normalizeIraqiPhone(e.target.value);
      showError('phone', n ? '' : t('checkout.errPhone'));
    }
  }, true);
  main.addEventListener('click', (e) => {
    if (e.target.closest('[data-apply-coupon]')) applyCoupon();
    if (e.target.closest('[data-locate]')) locate();
  });
  main.addEventListener('keydown', (e) => {
    if (e.target.id === 'f-coupon' && e.key === 'Enter') { e.preventDefault(); applyCoupon(); }
  });
  onCartChange(() => { if (!submitting) render(main); });
}

mountPage({
  render(main) {
    // Re-validate a remembered coupon once per visit.
    if (coupon.code && !coupon.ok && !coupon.message && cartLines().length) {
      setTimeout(() => { document.getElementById('f-coupon').value = coupon.code; applyCoupon(); }, 0);
    }
    render(main);
  },
  title: () => t('checkout.title'),
});
