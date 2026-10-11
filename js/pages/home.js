import { to, asset, siteLink } from '../routes.js';
import { mountPage } from '../layout.js';
import { state } from '../store.js';
import { t, tr } from '../i18n.js';
import { esc, imgTag, categoryUrl, price } from '../format.js';
import { productCard } from '../components/product-card.js';
import { icon } from '../icons.js';
import { toMs } from '../shared/pricing.js';

const sectionTitle = (key, fallbackKey) => tr(state.content?.sections?.[key]) || t(fallbackKey);

function hero() {
  const h = state.content?.hero || {};
  const title = tr(h.title) || t('home.heroTitle');
  const subtitle = tr(h.subtitle) || t('home.heroSubtitle');
  const btn = tr(h.button) || t('home.heroButton');
  const img = h.image || asset('/img/hero.webp');
  return `<section class="hero">
    <div class="container hero-inner">
      <div class="hero-text">
        <span class="eyebrow">${esc(tr(h.eyebrow) || t('home.heroEyebrow'))}</span>
        <h1 class="hero-title">${esc(title)}</h1>
        <p class="hero-sub">${esc(subtitle)}</p>
        <div class="hero-cta">
          <a class="btn btn-primary btn-lg" href="${esc(siteLink(h.link || '/shop'))}">${esc(btn)}</a>
          <a class="btn btn-ghost btn-lg" href="${to('shop', { sale: 1 })}">${icon('tag')} ${esc(t('nav.offers'))}</a>
        </div>
      </div>
      <div class="hero-media">
        <img src="${esc(img)}" alt="${esc(tr(h.imageAlt) || title)}" width="640" height="560" fetchpriority="high" decoding="async">
      </div>
    </div>
  </section>`;
}

function trust() {
  const items = [
    ['truck', 'trust.delivery', 'trust.deliveryText'],
    ['leaf', 'trust.fresh', 'trust.freshText'],
    ['shield', 'trust.secure', 'trust.secureText'],
    ['whatsapp', 'trust.support', 'trust.supportText'],
  ];
  return `<section class="trust container" aria-label="${esc(t('trust.title'))}">
    ${items.map(([ic, k, d]) => `<div class="trust-item">${icon(ic)}<div><strong>${esc(t(k))}</strong><span>${esc(t(d))}</span></div></div>`).join('')}
  </section>`;
}

function offers() {
  const now = Date.now();
  const banners = (state.offers?.items || []).filter((o) => o.active !== false && (!toMs(o.start) || toMs(o.start) <= now) && (!toMs(o.end) || toMs(o.end) >= now));
  const sale = state.products.filter((p) => p.inStock && p.weights.some((w) => price(p, w).discount > 0)).slice(0, 8);
  if (!banners.length && !sale.length) return '';
  return `<section class="section section--offers">
    <div class="container">
      <div class="section-head"><h2>${esc(sectionTitle('offers', 'home.offers'))}</h2><a class="link-more" href="${to('shop', { sale: 1 })}">${esc(t('home.viewAll'))} ${icon('chevron', 'flip-rtl')}</a></div>
      ${banners.length ? `<div class="offer-banners">${banners.map((o) => `
        <a class="offer-banner" href="${esc(siteLink(o.link || '/shop?sale=1'))}" style="--offer-bg:${esc(o.color || 'var(--c-secondary)')}">
          ${o.image ? imgTag(o.image, { alt: '', w: 600, h: 300, cls: 'offer-img' }) : ''}
          <div class="offer-text">
            ${o.badge ? `<span class="offer-badge">${esc(tr(o.badge))}</span>` : ''}
            <strong>${esc(tr(o.title))}</strong>
            ${tr(o.subtitle) ? `<span>${esc(tr(o.subtitle))}</span>` : ''}
            ${toMs(o.end) ? `<span class="countdown countdown--pill" data-countdown="${toMs(o.end)}"></span>` : ''}
          </div>
        </a>`).join('')}</div>` : ''}
      ${sale.length ? `<div class="product-grid product-grid--row">${sale.map((p) => productCard(p)).join('')}</div>` : ''}
    </div>
  </section>`;
}

function categories() {
  const top = state.categories.filter((c) => !c.parentId);
  if (!top.length) return '';
  return `<section class="section">
    <div class="container">
      <div class="section-head"><h2>${esc(sectionTitle('categories', 'home.categories'))}</h2><a class="link-more" href="${to('shop')}">${esc(t('home.viewAll'))} ${icon('chevron', 'flip-rtl')}</a></div>
      <div class="cat-grid">${top.map((c) => `
        <a class="cat-card" href="${categoryUrl(c.id)}">
          <span class="cat-img">${imgTag(c.thumb, { alt: '', blur: c.blur, w: 240, h: 240 })}</span>
          <span class="cat-name">${esc(tr(c.name))}</span>
        </a>`).join('')}</div>
    </div>
  </section>`;
}

function productSection(key, fallbackKey, list, moreHref) {
  if (!list.length) return '';
  return `<section class="section">
    <div class="container">
      <div class="section-head"><h2>${esc(sectionTitle(key, fallbackKey))}</h2><a class="link-more" href="${moreHref}">${esc(t('home.viewAll'))} ${icon('chevron', 'flip-rtl')}</a></div>
      <div class="product-grid">${list.map((p) => productCard(p)).join('')}</div>
    </div>
  </section>`;
}

function contactCta() {
  const wa = state.shop?.whatsapp;
  if (!wa) return '';
  return `<section class="section">
    <div class="container"><div class="cta-band">
      <div><h2>${esc(t('home.ctaTitle'))}</h2><p>${esc(t('home.ctaText'))}</p></div>
      <a class="btn btn-light btn-lg" href="https://wa.me/${esc(String(wa).replace(/\D/g, ''))}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp</a>
    </div></div>
  </section>`;
}

mountPage({
  render(main) {
    const featured = state.products.filter((p) => p.featured).slice(0, 8);
    const best = state.products.slice().sort((a, b) => b.sold - a.sold).filter((p) => p.inStock).slice(0, 8);
    main.innerHTML = hero() + trust() + offers() + categories()
      + productSection('featured', 'home.featured', featured, to('shop'))
      + productSection('best', 'home.bestSellers', best, to('shop', { sort: 'best' }))
      + contactCta();
  },
  description: () => tr(state.content?.hero?.subtitle) || t('meta.description'),
});
