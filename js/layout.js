// Shared page shell: header, search, cart drawer, footer, announcement bar,
// toasts and the add-to-cart interactions used by every customer page.
import { to, categoryUrl, siteLink, STATIC } from './routes.js';
import { boot, state, onStoreChange } from './store.js';
import { initLang, setLang, getLang, onLangChange, t, tr, translateDom, LANG_NAMES } from './i18n.js';
import { applyTheme } from './theme.js';
import { icon } from './icons.js';
import { esc, money, imgTag, productUrl, price, priceHtml, weightText } from './format.js';
import { addToCart, onCartChange, cartCount, cartLines, cartTotals, setQty, removeFromCart } from './cart.js';
import { searchProducts, minPrice } from './search.js';
import { LANGS } from './shared/text.js';

const LOGO_MARK = `<svg class="logo-mark" viewBox="0 0 48 48" aria-hidden="true"><path fill="var(--c-primary)" d="M24 4c8 0 14 7 14 17 0 11-7 23-14 23S10 32 10 21C10 11 16 4 24 4z"/><path fill="var(--c-accent)" d="M24 9c5 0 9 5 9 12 0 2-1 2-2 1-2-3-4-5-7-5s-5 2-7 5c-1 1-2 1-2-1 0-7 4-12 9-12z" opacity=".9"/><path stroke="var(--c-bg)" stroke-width="1.6" fill="none" stroke-linecap="round" d="M24 22v16M19 28c2 1 3 3 5 3s3-2 5-3"/></svg>`;

let page = null;

/** Boots data, language and theme, renders the shell, then the page. */
export async function mountPage(pageDef) {
  page = pageDef;
  await boot();
  initLang();
  applyTheme(state.theme, { persist: !state.preview });
  renderShell();
  renderPage();
  bindGlobalEvents();
  addHreflang();

  onLangChange(() => { renderShell(); renderPage(); });
  onStoreChange(() => { applyTheme(state.theme, { persist: !state.preview }); renderShell(); renderPage(); });
  onCartChange(() => { updateCartBadge(true); renderCartDrawer(); });

  if (!state.preview) registerServiceWorker();
}

function addHreflang() {
  if (document.querySelector('link[rel="alternate"][hreflang]')) return; // already server-rendered
  const base = location.origin + location.pathname;
  const keep = new URLSearchParams(location.search);
  keep.delete('lang');
  for (const l of [...LANGS, 'x-default']) {
    const u = new URLSearchParams(keep);
    if (l !== 'x-default') u.set('lang', l);
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = l;
    link.href = `${base}${u.toString() ? `?${u}` : ''}`;
    document.head.appendChild(link);
  }
}

function renderPage() {
  const main = document.getElementById('main');
  try {
    page?.render?.(main);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="container empty-state"><h1>${esc(t('error.generic'))}</h1></div>`;
  }
  const title = page?.title?.();
  const shopName = tr(state.shop?.name) || 'Charazatydanya';
  document.title = title ? `${title} | ${shopName}` : `${shopName} — ${t('meta.tagline')}`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc && page?.description) desc.content = page.description();
  translateDom();
}

// ------------------------------------------------------------------ shell
function renderShell() {
  const shopName = tr(state.shop?.name) || 'Charazatydanya';
  const logo = state.theme?.logo
    ? `<img class="logo-img" src="${esc(state.theme.logo)}" alt="${esc(shopName)}">`
    : `${LOGO_MARK}<span class="logo-text">${esc(shopName)}</span>`;
  const pageName = document.body.dataset.page;
  const onSale = new URLSearchParams(location.search).get('sale') === '1';
  const nav = [
    [to('home'), 'nav.home', pageName === 'home'], [to('shop'), 'nav.shop', pageName === 'shop' && !onSale], [to('shop', { sale: 1 }), 'nav.offers', pageName === 'shop' && onSale],
    [to('about'), 'nav.about', pageName === 'about'], [to('contact'), 'nav.contact', pageName === 'contact'],
  ];

  const header = document.getElementById('site-header');
  header.className = 'site-header';
  header.innerHTML = `
    ${announcementHtml()}
    <div class="header-bar container">
      <button class="icon-btn only-mobile" type="button" data-open-menu aria-label="${esc(t('nav.menu'))}" aria-controls="mobile-menu">${icon('menu')}</button>
      <a class="logo" href="${to('home')}" aria-label="${esc(shopName)}">${logo}</a>
      <nav class="main-nav only-desktop" aria-label="${esc(t('nav.main'))}">
        ${nav.map(([href, key, active]) => `<a href="${href}"${active ? ' aria-current="page"' : ''}>${esc(t(key))}</a>`).join('')}
      </nav>
      <div class="header-search" role="search">
        <label class="visually-hidden" for="search-input">${esc(t('search.placeholder'))}</label>
        <span class="search-icon">${icon('search')}</span>
        <input id="search-input" type="search" autocomplete="off" enterkeyhint="search" placeholder="${esc(t('search.placeholder'))}" aria-controls="search-results" aria-expanded="false">
        <div id="search-results" class="search-results" role="listbox" hidden></div>
      </div>
      <div class="header-actions">
        <button class="icon-btn only-mobile" type="button" data-open-search aria-label="${esc(t('search.open'))}">${icon('search')}</button>
        ${langSwitcher('header')}
        <button class="icon-btn cart-btn" type="button" data-open-cart aria-label="${esc(t('cart.title'))}">
          ${icon('cart')}<span class="cart-badge" data-cart-count hidden>0</span>
        </button>
      </div>
    </div>`;

  // Mobile slide-out menu
  let menu = document.getElementById('mobile-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'mobile-menu';
    menu.className = 'drawer drawer--start';
    menu.hidden = true;
    document.body.appendChild(menu);
  }
  const topCats = state.categories.filter((c) => !c.parentId);
  menu.innerHTML = `
    <div class="drawer-backdrop" data-close-drawer></div>
    <div class="drawer-panel" role="dialog" aria-modal="true" aria-label="${esc(t('nav.menu'))}">
      <div class="drawer-head"><span class="drawer-title">${esc(shopName)}</span>
        <button class="icon-btn" type="button" data-close-drawer aria-label="${esc(t('close'))}">${icon('close')}</button></div>
      <nav class="drawer-body menu-list">
        ${nav.map(([href, key]) => `<a href="${href}">${esc(t(key))}</a>`).join('')}
        ${topCats.length ? `<div class="menu-label">${esc(t('nav.categories'))}</div>` : ''}
        ${topCats.map((c) => `<a href="${esc(categoryUrl(c.id))}">${esc(tr(c.name))}</a>`).join('')}
      </nav>
      <div class="drawer-foot">${langSwitcher('menu')}</div>
    </div>`;

  try { localStorage.setItem('cz_ann_h', String(header.querySelector('.announce')?.offsetHeight || 0)); } catch { /* ignore */ }
  renderFooter(shopName);
  renderBottomBar();
  if (STATIC) {
    let pill = document.getElementById('demo-pill');
    if (!pill) { pill = document.createElement('div'); pill.id = 'demo-pill'; pill.className = 'demo-pill'; document.body.prepend(pill); }
    pill.textContent = t('demo.label');
  }
  ensureCartDrawer();
  renderCartDrawer();
  updateCartBadge(false);
  startCountdown();
}

function langSwitcher(where) {
  const cur = getLang();
  return `<div class="lang-switch lang-switch--${where}" role="group" aria-label="${esc(t('lang.choose'))}">
    ${LANGS.map((l) => `<button type="button" data-lang="${l}" lang="${l}" aria-pressed="${l === cur}">${esc(LANG_NAMES[l])}</button>`).join('')}
  </div>`;
}

function announcementHtml() {
  const a = state.content?.announcement;
  if (!a?.enabled || !tr(a.text)) return '';
  if (a.endsAt && a.endsAt < Date.now()) return '';
  let dismissed = false;
  try { dismissed = sessionStorage.getItem('cz_ann') === String(a.version || a.endsAt || tr(a.text)); } catch { /* ignore */ }
  if (dismissed) return '';
  const inner = `<span>${esc(tr(a.text))}</span>${a.endsAt ? ` <span class="countdown" data-countdown="${a.endsAt}" aria-label="${esc(t('offer.endsIn'))}"></span>` : ''}`;
  return `<div class="announce" role="region" aria-label="${esc(t('offer.announcement'))}">
    ${a.link ? `<a href="${esc(siteLink(a.link))}">${inner}</a>` : `<div>${inner}</div>`}
    <button type="button" class="announce-close" data-dismiss-ann aria-label="${esc(t('close'))}">${icon('close')}</button>
  </div>`;
}

let countdownTimer = null;
function startCountdown() {
  clearInterval(countdownTimer);
  const tick = () => {
    const els = document.querySelectorAll('[data-countdown]');
    if (!els.length) { clearInterval(countdownTimer); return; }
    els.forEach((el) => {
      const ms = Number(el.dataset.countdown) - Date.now();
      if (ms <= 0) { el.textContent = t('offer.ended'); return; }
      const d = Math.floor(ms / 864e5);
      const h = Math.floor((ms % 864e5) / 36e5);
      const m = Math.floor((ms % 36e5) / 6e4);
      const s = Math.floor((ms % 6e4) / 1e3);
      const pad = (n) => String(n).padStart(2, '0');
      el.innerHTML = `${d > 0 ? `<span>${t('time.days', { n: d })}</span> ` : ''}<span dir="ltr">${pad(h)}:${pad(m)}:${pad(s)}</span>`;
    });
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function renderFooter(shopName) {
  const s = state.shop || {};
  const f = state.content?.footer || {};
  const socials = [
    ['whatsapp', s.whatsapp && `https://wa.me/${String(s.whatsapp).replace(/\D/g, '')}`, 'WhatsApp'],
    ['telegram', s.telegram && (String(s.telegram).startsWith('http') ? s.telegram : `https://t.me/${String(s.telegram).replace('@', '')}`), 'Telegram'],
    ['instagram', s.instagram && (String(s.instagram).startsWith('http') ? s.instagram : `https://instagram.com/${String(s.instagram).replace('@', '')}`), 'Instagram'],
    ['facebook', s.facebook, 'Facebook'],
    ['tiktok', s.tiktok, 'TikTok'],
  ].filter(([, href]) => href);
  const footer = document.getElementById('site-footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="container footer-grid">
      <div class="footer-brand">
        <a class="logo logo--footer" href="${to('home')}">${state.theme?.logo ? `<img class="logo-img" src="${esc(state.theme.logo)}" alt="${esc(shopName)}">` : `${LOGO_MARK}<span class="logo-text">${esc(shopName)}</span>`}</a>
        <p>${esc(tr(f.about) || t('footer.about'))}</p>
        <div class="socials">${socials.map(([ic, href, label]) => `<a href="${esc(href)}" target="_blank" rel="noopener" aria-label="${label}">${icon(ic)}</a>`).join('')}</div>
      </div>
      <div>
        <h2 class="footer-title">${esc(t('footer.shop'))}</h2>
        <ul class="footer-links">
          <li><a href="${to('shop')}">${esc(t('nav.shop'))}</a></li>
          <li><a href="${to('shop', { sale: 1 })}">${esc(t('nav.offers'))}</a></li>
          <li><a href="${to('shop', { sort: 'best' })}">${esc(t('home.bestSellers'))}</a></li>
          <li><a href="${to('about')}">${esc(t('nav.about'))}</a></li>
          <li><a href="${to('contact')}">${esc(t('nav.contact'))}</a></li>
        </ul>
      </div>
      <div>
        <h2 class="footer-title">${esc(t('footer.contact'))}</h2>
        <ul class="footer-links footer-contact">
          ${s.phone ? `<li>${icon('phone')}<a href="tel:${esc(s.phone)}" dir="ltr">${esc(s.phone)}</a></li>` : ''}
          ${s.email ? `<li>${icon('mail')}<a href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>` : ''}
          ${tr(s.address) ? `<li>${icon('location')}<span>${esc(tr(s.address))}</span></li>` : ''}
          ${tr(s.hours) ? `<li>${icon('clock')}<span>${esc(tr(s.hours))}</span></li>` : ''}
        </ul>
      </div>
      <div>
        <h2 class="footer-title">${esc(t('footer.payment'))}</h2>
        <div class="pay-icons">${paymentIcons()}</div>
        <h2 class="footer-title">${esc(t('lang.choose'))}</h2>
        ${langSwitcher('footer')}
      </div>
    </div>
    <div class="container footer-bottom">
      <span>© ${new Date().getFullYear()} ${esc(shopName)}. ${esc(tr(f.copyright) || t('footer.rights'))}</span>
    </div>`;
}

export function paymentIcons() {
  const pay = state.shop?.payments || { cash: true };
  const out = [];
  if (pay.cash !== false) out.push(`<span class="pay-icon" title="${esc(t('checkout.cash'))}">${icon('cash')}<span>${esc(t('pay.cashShort'))}</span></span>`);
  if (pay.card) {
    out.push('<span class="pay-icon pay-icon--brand" title="Visa"><svg viewBox="0 0 48 16" width="48" height="16" aria-label="Visa" role="img"><text x="2" y="13" font-family="Arial,sans-serif" font-weight="900" font-style="italic" font-size="15" fill="#1A1F71">VISA</text></svg></span>');
    out.push('<span class="pay-icon pay-icon--brand" title="Mastercard"><svg viewBox="0 0 40 24" width="34" height="20" aria-label="Mastercard" role="img"><circle cx="15" cy="12" r="9" fill="#EB001B"/><circle cx="25" cy="12" r="9" fill="#F79E1B" fill-opacity=".9"/></svg></span>');
  }
  return out.join('');
}

function renderBottomBar() {
  let bar = document.getElementById('bottom-bar');
  if (!bar) {
    bar = document.createElement('nav');
    bar.id = 'bottom-bar';
    bar.className = 'bottom-bar only-mobile';
    document.body.appendChild(bar);
  }
  bar.setAttribute('aria-label', t('nav.quick'));
  const pageName = document.body.dataset.page;
  bar.innerHTML = `
    <a href="${to('home')}"${pageName === 'home' ? ' aria-current="page"' : ''}>${icon('home')}<span>${esc(t('nav.home'))}</span></a>
    <a href="${to('shop')}"${pageName === 'shop' ? ' aria-current="page"' : ''}>${icon('grid')}<span>${esc(t('nav.shop'))}</span></a>
    <button type="button" data-open-search>${icon('search')}<span>${esc(t('search.short'))}</span></button>
    <button type="button" data-open-cart class="bottom-cart">${icon('cart')}<span>${esc(t('cart.short'))}</span><span class="cart-badge" data-cart-count hidden>0</span></button>`;
}

// ------------------------------------------------------------------- cart UI
function ensureCartDrawer() {
  if (document.getElementById('cart-drawer')) return;
  const d = document.createElement('div');
  d.id = 'cart-drawer';
  d.className = 'drawer drawer--end';
  d.hidden = true;
  document.body.appendChild(d);
}

function renderCartDrawer() {
  const d = document.getElementById('cart-drawer');
  if (!d) return;
  const lines = cartLines();
  const totals = cartTotals();
  const minOrder = Number(state.shop?.minOrder) || 0;
  const belowMin = minOrder > 0 && totals.subtotal < minOrder;
  const wasOpen = !d.hidden;
  d.innerHTML = `
    <div class="drawer-backdrop" data-close-drawer></div>
    <div class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      <div class="drawer-head">
        <h2 id="cart-title" class="drawer-title">${esc(t('cart.title'))} <span class="muted">(${cartCount()})</span></h2>
        <button class="icon-btn" type="button" data-close-drawer aria-label="${esc(t('close'))}">${icon('close')}</button>
      </div>
      <div class="drawer-body">
        ${lines.length ? `<ul class="cart-lines">${lines.map((l, i) => cartLineHtml(l, totals.lines[i])).join('')}</ul>` : `
          <div class="empty-state empty-state--sm">${icon('cart', 'empty-icon')}<p>${esc(t('cart.empty'))}</p>
          <a class="btn btn-primary" href="${to('shop')}">${esc(t('cart.startShopping'))}</a></div>`}
      </div>
      ${lines.length ? `<div class="drawer-foot cart-foot">
        ${totals.itemDiscount > 0 ? `<div class="sum-row sum-row--save"><span>${esc(t('cart.youSave'))}</span><span>-${esc(money(totals.itemDiscount))}</span></div>` : ''}
        <div class="sum-row sum-row--total"><span>${esc(t('cart.subtotal'))}</span><span>${esc(money(totals.subtotal))}</span></div>
        <p class="muted small">${esc(t('cart.deliveryNote'))}</p>
        ${belowMin ? `<p class="notice notice--warn">${esc(t('cart.minOrder', { amount: money(minOrder) }))}</p>` : ''}
        <a class="btn btn-primary btn-block btn-lg${belowMin ? ' is-disabled' : ''}" href="${to('checkout')}" ${belowMin ? 'aria-disabled="true" tabindex="-1"' : ''}>${esc(t('cart.checkout'))}</a>
        <button type="button" class="btn btn-ghost btn-block" data-close-drawer>${esc(t('cart.continue'))}</button>
      </div>` : ''}
    </div>`;
  if (wasOpen) d.hidden = false;
}

function cartLineHtml(l, priced) {
  const name = tr(l.product.name);
  return `<li class="cart-line" data-key="${esc(l.key)}">
    <a href="${productUrl(l.product.id)}" class="cart-line-img">${imgTag(l.product.thumb, { alt: name, blur: l.product.blur, w: 72, h: 72 })}</a>
    <div class="cart-line-info">
      <a href="${productUrl(l.product.id)}" class="cart-line-name">${esc(name)}</a>
      <div class="muted small">${esc(weightText(l.weight))} · ${priceHtml(price(l.product, l.weight))}</div>
      <div class="cart-line-row">
        ${qtyStepper(l.qty, `data-cart-qty="${esc(l.key)}"`)}
        <strong class="cart-line-total">${esc(money(priced.lineTotal))}</strong>
      </div>
    </div>
    <button type="button" class="icon-btn icon-btn--sm" data-cart-remove="${esc(l.key)}" aria-label="${esc(t('cart.remove'))}: ${esc(name)}">${icon('trash')}</button>
  </li>`;
}

export function qtyStepper(qty, attrs = '') {
  return `<div class="qty" ${attrs}>
    <button type="button" data-step="-1" aria-label="${esc(t('qty.decrease'))}">${icon('minus')}</button>
    <input type="number" inputmode="numeric" min="1" max="99" value="${qty}" aria-label="${esc(t('qty.label'))}">
    <button type="button" data-step="1" aria-label="${esc(t('qty.increase'))}">${icon('plus')}</button>
  </div>`;
}

function updateCartBadge(bump) {
  const n = cartCount();
  document.querySelectorAll('[data-cart-count]').forEach((b) => {
    b.textContent = n > 99 ? '99+' : String(n);
    b.hidden = n === 0;
    if (bump) {
      b.classList.remove('bump');
      void b.offsetWidth;
      b.classList.add('bump');
    }
  });
}

// ---------------------------------------------------------------- drawers
let lastFocus = null;
export function openDrawer(id) {
  const d = document.getElementById(id);
  if (!d) return;
  lastFocus = document.activeElement;
  d.hidden = false;
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => d.classList.add('is-open'));
  d.querySelector('.drawer-panel button, .drawer-panel a')?.focus();
}

export function closeDrawers() {
  document.querySelectorAll('.drawer.is-open').forEach((d) => {
    d.classList.remove('is-open');
    setTimeout(() => { if (!d.classList.contains('is-open')) d.hidden = true; }, 260);
  });
  document.body.classList.remove('no-scroll');
  lastFocus?.focus?.();
}

// ----------------------------------------------------------------- toasts
export function toast(message, type = 'ok') {
  let host = document.getElementById('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.className = 'toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `${icon(type === 'ok' ? 'check' : 'close')}<span>${esc(message)}</span>`;
  host.appendChild(el);
  setTimeout(() => el.classList.add('is-leaving'), 2600);
  setTimeout(() => el.remove(), 3000);
}

/** Flying thumbnail from the product image to the cart button. */
export function flyToCart(fromEl) {
  const img = fromEl?.querySelector?.('img') || fromEl;
  const targets = [...document.querySelectorAll('[data-open-cart]')].filter((b) => b.offsetParent !== null);
  const target = targets.at(-1);
  if (!img?.getBoundingClientRect || !target || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = img.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const ghost = img.cloneNode();
  ghost.className = 'fly-ghost';
  Object.assign(ghost.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
  document.body.appendChild(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  ghost.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 0.95, borderRadius: '16px' },
    { transform: `translate(${dx * 0.6}px, ${dy * 0.3 - 80}px) scale(.5)`, opacity: 0.9, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(.12)`, opacity: 0.3, borderRadius: '50%' },
  ], { duration: 700, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => ghost.remove();
}

// ----------------------------------------------------------------- search
let searchTimer = null;
function runSearch(input) {
  const box = document.getElementById('search-results');
  const q = input.value.trim();
  if (!q) { box.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
  const results = searchProducts(q, 8);
  box.innerHTML = results.length
    ? results.map((p, i) => `<a class="sr-item" role="option" id="sr-${i}" href="${productUrl(p.id)}">
        ${imgTag(p.thumb, { alt: '', blur: p.blur, w: 48, h: 48 })}
        <span class="sr-name">${esc(tr(p.name))}</span>
        <span class="sr-price">${esc(money(minPrice(p)))}</span></a>`).join('')
      + `<a class="sr-all" href="${esc(to('shop', { q }))}">${esc(t('search.seeAll'))} ${icon('chevron', 'flip-rtl')}</a>`
    : `<div class="sr-empty">${esc(t('search.noResults', { q }))}</div>`;
  box.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function openSearch() {
  document.body.classList.add('search-open');
  const input = document.getElementById('search-input');
  input?.focus();
}

// --------------------------------------------------------------- events
let bound = false;
function bindGlobalEvents() {
  if (bound) return;
  bound = true;

  document.addEventListener('click', (e) => {
    const el = e.target.closest('button, a, [data-close-drawer]');
    if (!el) {
      if (!e.target.closest('.header-search')) hideSearch();
      return;
    }
    if (el.matches('[data-lang]')) { setLang(el.dataset.lang); return; }
    if (el.matches('[data-open-cart]')) { e.preventDefault(); hideSearch(); openDrawer('cart-drawer'); return; }
    if (el.matches('[data-open-menu]')) { openDrawer('mobile-menu'); return; }
    if (el.matches('[data-close-drawer]')) { closeDrawers(); return; }
    if (el.matches('[data-open-search]')) { openSearch(); return; }
    if (el.matches('[data-dismiss-ann]')) {
      const a = state.content?.announcement || {};
      try { sessionStorage.setItem('cz_ann', String(a.version || a.endsAt || tr(a.text))); } catch { /* ignore */ }
      el.closest('.announce')?.remove();
      try { localStorage.setItem('cz_ann_h', '0'); } catch { /* ignore */ }
      return;
    }
    if (el.matches('.wchip')) {
      const card = el.closest('[data-pid]');
      const p = state.productMap.get(card?.dataset.pid);
      const w = p?.weights.find((x) => x.id === el.dataset.w);
      if (!w) return;
      card.dataset.w = w.id;
      card.querySelectorAll('.wchip').forEach((c) => { c.classList.toggle('is-active', c === el); c.setAttribute('aria-checked', String(c === el)); });
      card.querySelector('.pcard-price').innerHTML = priceHtml(price(p, w));
      return;
    }
    if (el.matches('[data-add]')) {
      const card = el.closest('[data-pid]');
      const p = state.productMap.get(card?.dataset.pid);
      if (!p || !p.inStock) return;
      addToCart(p.id, card.dataset.w || p.weights[0].id, 1);
      flyToCart(card.querySelector('.pcard-media'));
      el.classList.add('is-added');
      setTimeout(() => el.classList.remove('is-added'), 900);
      toast(t('cart.added', { name: tr(p.name) }));
      return;
    }
    if (el.matches('[data-cart-remove]')) {
      const [id, w] = el.dataset.cartRemove.split('|');
      removeFromCart(id, w);
      return;
    }
    if (el.matches('.qty [data-step]')) {
      const wrap = el.closest('.qty');
      const input = wrap.querySelector('input');
      const v = Math.max(wrap.dataset.cartQty ? 0 : 1, Math.min(99, (Number(input.value) || 1) + Number(el.dataset.step)));
      input.value = v || 1;
      if (wrap.dataset.cartQty) {
        const [id, w] = wrap.dataset.cartQty.split('|');
        setQty(id, w, v);
      } else {
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  document.addEventListener('change', (e) => {
    const wrap = e.target.closest('.qty[data-cart-qty]');
    if (wrap && e.target.matches('input')) {
      const [id, w] = wrap.dataset.cartQty.split('|');
      setQty(id, w, Math.max(0, Math.min(99, Math.floor(Number(e.target.value) || 0))));
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id !== 'search-input') return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(e.target), 160);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeDrawers(); hideSearch(); }
    if (e.target.id === 'search-input') {
      const items = [...document.querySelectorAll('#search-results a')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'Enter' && e.target.value.trim()) {
        location.href = to('shop', { q: e.target.value.trim() });
      } else if (e.key === 'ArrowDown' && items.length) {
        e.preventDefault();
        items[0].focus();
      }
    } else if (e.target.closest?.('#search-results')) {
      const items = [...document.querySelectorAll('#search-results a')];
      const i = items.indexOf(e.target);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(items.length - 1, i + 1)]?.focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? document.getElementById('search-input') : items[i - 1]).focus(); }
    }
  });

  // Offline / online banner
  const offline = () => {
    let b = document.getElementById('offline-banner');
    if (!navigator.onLine) {
      if (!b) {
        b = document.createElement('div');
        b.id = 'offline-banner';
        b.className = 'offline-banner';
        b.setAttribute('role', 'status');
        document.body.appendChild(b);
      }
      b.innerHTML = `${icon('wifiOff')}<span>${esc(t('offline.banner'))}</span>`;
    } else b?.remove();
  };
  window.addEventListener('online', offline);
  window.addEventListener('offline', offline);
  offline();
}

function hideSearch() {
  const box = document.getElementById('search-results');
  if (box) box.hidden = true;
  document.getElementById('search-input')?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('search-open');
}

function registerServiceWorker() {
  // Skipped on the local emulator (so code edits show immediately) unless you set
  // localStorage.cz_sw_dev = 1 to test caching locally.
  let devOptIn = false;
  try { devOptIn = !!localStorage.getItem('cz_sw_dev'); } catch { /* ignore */ }
  if (STATIC || !('serviceWorker' in navigator) || (['localhost', '127.0.0.1'].includes(location.hostname) && !devOptIn)) return;
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
