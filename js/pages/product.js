import { to, currentProductId, productUrl } from '../routes.js';
import { mountPage, flyToCart, toast, qtyStepper } from '../layout.js';
import { state } from '../store.js';
import { t, tr } from '../i18n.js';
import { getDoc } from '../api.js';
import { esc, money, imgTag, price, priceHtml, weightText, categoryUrl, paragraphs } from '../format.js';
import { addToCart } from '../cart.js';
import { productCard } from '../components/product-card.js';
import { openLightbox } from '../lightbox.js';
import { icon } from '../icons.js';

const id = currentProductId();
let full = null;       // full Firestore document (description, all images)
let loadState = 'idle'; // idle | loading | done | missing
let selectedWeight = null;
let qty = 1;
let activeImage = 0;

function product() {
  const fromCatalog = state.productMap.get(id);
  if (!fromCatalog && !full) return null;
  // Merge: catalog for pricing/discounts, full doc for description and images.
  const base = fromCatalog || {
    id, name: full.name, categoryId: full.categoryId, inStock: full.inStock !== false, discount: full.discount || null,
    weights: (full.weights || []).map((w) => ({ id: w.id, grams: w.grams, price: w.price, label: w.label || null })),
    thumb: full.images?.[0]?.thumb || '', blur: full.images?.[0]?.blur || '',
  };
  return {
    ...base,
    description: full?.description || null,
    images: full?.images?.length ? full.images : [{ thumb: base.thumb, full: base.thumb, blur: base.blur }],
  };
}

async function loadFull() {
  if (loadState !== 'idle' || !id) return;
  loadState = 'loading';
  try {
    full = await getDoc(`products/${encodeURIComponent(id)}`);
    loadState = full ? 'done' : 'missing';
  } catch {
    loadState = 'missing';
  }
  render(document.getElementById('main'));
}

function gallery(p) {
  const name = tr(p.name);
  const imgs = p.images;
  const main = imgs[activeImage] || imgs[0];
  return `<div class="gallery">
    <button type="button" class="gallery-main" data-zoom="${activeImage}" aria-label="${esc(t('product.viewImage'))}">
      ${imgTag(main.thumb || main.full, { alt: name, blur: main.blur, w: 600, h: 600, eager: true })}
      <span class="gallery-zoom">${icon('zoom')}</span>
    </button>
    ${imgs.length > 1 ? `<div class="gallery-thumbs" role="tablist">${imgs.map((im, i) => `
      <button type="button" role="tab" class="gallery-thumb${i === activeImage ? ' is-active' : ''}" data-thumb="${i}" aria-selected="${i === activeImage}" aria-label="${esc(t('product.image'))} ${i + 1}">
        ${imgTag(im.thumb || im.full, { alt: '', blur: im.blur, w: 80, h: 80 })}</button>`).join('')}</div>` : ''}
  </div>`;
}

function info(p) {
  const w = selectedWeight;
  const pr = price(p, w);
  const cat = state.categoryMap.get(p.categoryId);
  return `<div class="pinfo">
    ${cat ? `<a class="eyebrow" href="${categoryUrl(cat.id)}">${esc(tr(cat.name))}</a>` : ''}
    <h1 class="pinfo-title">${esc(tr(p.name))}</h1>
    <div class="pinfo-price" aria-live="polite">
      ${priceHtml(pr)}
      ${pr.percent > 0 ? `<span class="badge badge--sale badge--inline">-${pr.percent}%</span>` : ''}
    </div>
    ${pr.endsAt ? `<p class="offer-ends">${icon('clock')} ${esc(t('offer.endsIn'))} <span class="countdown" data-countdown="${pr.endsAt}"></span></p>` : ''}
    <p class="stock ${p.inStock ? 'stock--in' : 'stock--out'}">${icon(p.inStock ? 'check' : 'close')} ${esc(t(p.inStock ? 'product.inStock' : 'product.outOfStock'))}</p>

    <fieldset class="weight-options">
      <legend>${esc(t('product.chooseWeight'))}</legend>
      <div class="weight-grid">
        ${p.weights.map((x) => {
          const xp = price(p, x);
          return `<label class="weight-opt">
            <input type="radio" name="weight" value="${esc(x.id)}" ${x.id === w.id ? 'checked' : ''}>
            <span class="weight-opt-ui"><strong>${esc(weightText(x))}</strong>
              <span>${xp.discount > 0 ? `<s class="price-old">${esc(money(xp.original))}</s> ` : ''}${esc(money(xp.final))}</span></span>
          </label>`;
        }).join('')}
      </div>
    </fieldset>

    <div class="buy-row" id="buy">
      ${qtyStepper(qty, 'data-product-qty')}
      <button type="button" class="btn btn-primary btn-lg add-to-cart" data-add-product ${p.inStock ? '' : 'disabled'}>
        ${icon('cart')} <span>${esc(t('cart.add'))}</span> <span class="btn-sub">${esc(money(pr.final * qty))}</span>
      </button>
    </div>

    <ul class="pinfo-perks">
      <li>${icon('truck')} ${esc(t('product.perkDelivery'))}</li>
      <li>${icon('shield')} ${esc(t('product.perkPayment'))}</li>
    </ul>
    <button type="button" class="btn btn-ghost btn-sm" data-share>${icon('share')} ${esc(t('product.share'))}</button>
  </div>`;
}

function render(main) {
  if (!id) { notFound(main); return; }
  const p = product();
  if (!p) {
    if (loadState === 'missing') { notFound(main); return; }
    main.innerHTML = `<div class="container product-page"><div class="product-layout"><div class="gallery"><div class="gallery-main sk"></div></div><div class="pinfo"><div class="sk sk-line"></div><div class="sk sk-line sk-short"></div></div></div></div>`;
    loadFull();
    return;
  }
  if (!selectedWeight || !p.weights.find((x) => x.id === selectedWeight.id)) {
    selectedWeight = p.weights.find(() => true);
  } else {
    selectedWeight = p.weights.find((x) => x.id === selectedWeight.id);
  }
  const related = state.products.filter((x) => x.categoryId === p.categoryId && x.id !== p.id).slice(0, 8);
  const desc = tr(p.description);
  const cat = state.categoryMap.get(p.categoryId);
  main.innerHTML = `<div class="container product-page">
    <nav class="breadcrumbs" aria-label="${esc(t('nav.breadcrumbs'))}"><ol>
      <li><a href="${to('home')}">${esc(t('nav.home'))}</a></li>
      ${cat ? `<li><a href="${categoryUrl(cat.id)}">${esc(tr(cat.name))}</a></li>` : ''}
      <li><span aria-current="page">${esc(tr(p.name))}</span></li>
    </ol></nav>
    <div class="product-layout">
      ${gallery(p)}
      ${info(p)}
    </div>
    <section class="pdesc">
      <h2>${esc(t('product.description'))}</h2>
      ${desc ? `<div class="prose">${paragraphs(desc)}</div>` : (loadState === 'loading' ? '<div class="sk sk-line"></div><div class="sk sk-line"></div>' : `<p class="muted">${esc(t('product.noDescription'))}</p>`)}
    </section>
    ${related.length ? `<section class="section related"><div class="section-head"><h2>${esc(t('product.related'))}</h2></div>
      <div class="product-grid product-grid--row">${related.map((x) => productCard(x)).join('')}</div></section>` : ''}
  </div>
  ${stickyBuy(p)}`;
  loadFull();
}

function stickyBuy(p) {
  return `<div class="sticky-buy only-mobile" ${p.inStock ? '' : 'hidden'}>
    <div><strong>${esc(money(price(p, selectedWeight).final * qty))}</strong><span class="muted small">${esc(weightText(selectedWeight))} × ${qty}</span></div>
    <button type="button" class="btn btn-primary" data-add-product>${icon('cart')} ${esc(t('cart.add'))}</button>
  </div>`;
}

/** Updates only the price/options panel so images don't re-render. */
function refreshInfo(focusSelector) {
  const main = document.getElementById('main');
  const p = product();
  main.querySelector('.pinfo').outerHTML = info(p);
  main.querySelector('.sticky-buy').outerHTML = stickyBuy(p);
  if (focusSelector) main.querySelector(focusSelector)?.focus();
}

function refreshGallery() {
  const main = document.getElementById('main');
  main.querySelector('.gallery').outerHTML = gallery(product());
  main.querySelector(`[data-thumb="${activeImage}"]`)?.focus();
}

function notFound(main) {
  main.innerHTML = `<div class="container empty-state"><h1>${esc(t('product.notFound'))}</h1><p>${esc(t('product.notFoundText'))}</p><a class="btn btn-primary" href="${to('shop')}">${esc(t('cart.startShopping'))}</a></div>`;
}

let bound = false;
function bind() {
  if (bound) return;
  bound = true;
  const main = document.getElementById('main');
  main.addEventListener('change', (e) => {
    if (e.target.name === 'weight') {
      const p = product();
      selectedWeight = p.weights.find((x) => x.id === e.target.value);
      refreshInfo(`input[name="weight"][value="${CSS.escape(selectedWeight.id)}"]`);
    } else if (e.target.closest('[data-product-qty]')) {
      qty = Math.max(1, Math.min(99, Math.floor(Number(e.target.value) || 1)));
      refreshInfo('[data-product-qty] input');
    }
  });
  main.addEventListener('click', async (e) => {
    const el = e.target.closest('button');
    if (!el) return;
    const p = product();
    if (!p) return;
    if (el.matches('[data-thumb]')) {
      activeImage = Number(el.dataset.thumb);
      refreshGallery();
    } else if (el.matches('[data-zoom]')) {
      const caption = `<strong>${esc(tr(p.name))}</strong>${tr(p.description) ? paragraphs(tr(p.description)) : ''}`;
      openLightbox(p.images.map((im) => ({ full: im.full || im.thumb, thumb: im.thumb || im.full, alt: tr(p.name) })), Number(el.dataset.zoom), caption);
    } else if (el.matches('[data-add-product]')) {
      if (!p.inStock) return;
      addToCart(p.id, selectedWeight.id, qty);
      flyToCart(main.querySelector('.gallery-main'));
      toast(t('cart.added', { name: tr(p.name) }));
    } else if (el.matches('[data-share]')) {
      const url = new URL(productUrl(p.id), location.href).href;
      if (navigator.share) navigator.share({ title: tr(p.name), url }).catch(() => {});
      else { await navigator.clipboard?.writeText(url); toast(t('product.linkCopied')); }
    }
  });
}

mountPage({
  render(main) { bind(); render(main); },
  title: () => { const p = product(); return p ? tr(p.name) : t('nav.shop'); },
  description: () => { const p = product(); return (p && tr(p.description)?.slice(0, 160)) || t('meta.description'); },
});
