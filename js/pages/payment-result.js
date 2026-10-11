import { to } from '../routes.js';
import { mountPage } from '../layout.js';
import { t } from '../i18n.js';
import { getDoc, callFunction } from '../api.js';
import { esc } from '../format.js';
import { icon } from '../icons.js';
import { orderDetails } from '../components/order-view.js';

const id = new URLSearchParams(location.search).get('order') || '';
let order = null;
let loaded = false;
let polls = 0;
let retrying = false;

async function load() {
  try { order = id ? await getDoc(`publicOrders/${encodeURIComponent(id)}`) : null; } catch { order = null; }
  loaded = true;
  render(document.getElementById('main'));
  // The gateway's webhook may arrive a moment after the redirect — keep checking.
  if (order && order.paymentStatus === 'awaiting' && polls < 30) {
    polls += 1;
    setTimeout(load, 2000);
  }
}

function render(main) {
  if (!loaded) {
    main.innerHTML = `<div class="container narrow empty-state"><div class="spinner"></div><p>${esc(t('payment.checking'))}</p></div>`;
    return;
  }
  if (!order) {
    main.innerHTML = `<div class="container empty-state"><h1>${esc(t('order.notFound'))}</h1><a class="btn btn-primary" href="${to('home')}">${esc(t('nav.home'))}</a></div>`;
    return;
  }
  if (order.paymentStatus === 'paid') {
    location.replace(to('order', { id }));
    return;
  }
  const failed = order.paymentStatus === 'failed' || (order.paymentStatus === 'awaiting' && polls >= 30);
  main.innerHTML = `<div class="container narrow order-page">
    <div class="success-hero ${failed ? 'is-failed' : ''}">
      ${failed ? `<div class="success-icon success-icon--fail">${icon('close')}</div>` : '<div class="spinner"></div>'}
      <h1>${esc(t(failed ? 'payment.failedTitle' : 'payment.checking'))}</h1>
      <p class="order-number">${esc(t('order.number'))} <strong dir="ltr">#${esc(order.number)}</strong></p>
      ${failed ? `<p class="muted">${esc(t('payment.failedText'))}</p>` : ''}
    </div>
    ${failed ? `<div class="order-actions">
      <button type="button" class="btn btn-primary btn-lg" data-retry ${retrying ? 'disabled' : ''}>${icon('card')} ${esc(t('payment.retry'))}</button>
      <a class="btn btn-outline" href="${to('contact')}">${esc(t('order.contactUs'))}</a>
    </div>` : ''}
    ${orderDetails(order)}
  </div>`;
}

document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-retry]')) return;
  retrying = true;
  render(document.getElementById('main'));
  try {
    const r = await callFunction('createPayment', { orderId: id });
    location.href = r.url;
  } catch {
    retrying = false;
    render(document.getElementById('main'));
    alert(t('error.generic'));
  }
});

mountPage({ render(main) { render(main); if (!loaded) load(); }, title: () => t('payment.title') });
