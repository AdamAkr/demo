import { to } from '../routes.js';
import { mountPage } from '../layout.js';
import { state } from '../store.js';
import { t } from '../i18n.js';
import { getDoc } from '../api.js';
import { esc } from '../format.js';
import { icon } from '../icons.js';
import { statusTimeline, orderDetails } from '../components/order-view.js';

const id = new URLSearchParams(location.search).get('id') || '';
let order = null;
let loaded = false;

async function load() {
  try { order = id ? await getDoc(`publicOrders/${encodeURIComponent(id)}`) : null; } catch { order = null; }
  loaded = true;
  render(document.getElementById('main'));
}

function render(main) {
  if (!loaded) {
    main.innerHTML = `<div class="container narrow"><div class="sk sk-block"></div></div>`;
    return;
  }
  if (!order) {
    main.innerHTML = `<div class="container empty-state"><h1>${esc(t('order.notFound'))}</h1><a class="btn btn-primary" href="${to('home')}">${esc(t('nav.home'))}</a></div>`;
    return;
  }
  const wa = state.shop?.whatsapp ? `https://wa.me/${String(state.shop.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(`${t('order.number')} #${order.number}`)}` : '';
  main.innerHTML = `<div class="container narrow order-page">
    <div class="success-hero">
      <div class="success-icon">${icon('check')}</div>
      <h1>${esc(t('order.thanks'))}</h1>
      <p class="order-number">${esc(t('order.number'))} <strong dir="ltr">#${esc(order.number)}</strong></p>
      <p class="muted">${esc(t(order.paymentMethod === 'card' && order.paymentStatus === 'paid' ? 'order.paidText' : 'order.cashText'))}</p>
    </div>
    ${statusTimeline(order.status)}
    ${orderDetails(order)}
    <div class="order-actions">
      <a class="btn btn-primary" href="${to('shop')}">${esc(t('cart.continue'))}</a>
      ${wa ? `<a class="btn btn-outline" href="${esc(wa)}" target="_blank" rel="noopener">${icon('whatsapp')} ${esc(t('order.contactUs'))}</a>` : ''}
    </div>
  </div>`;
}

mountPage({ render(main) { render(main); if (!loaded) load(); }, title: () => t('order.title') });

// Refresh status while the page is open.
setInterval(() => { if (document.visibilityState === 'visible' && loaded && order) load(); }, 30000);
