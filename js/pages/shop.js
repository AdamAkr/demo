import { to, currentCategoryId, categoryFromHref, STATIC } from '../routes.js';
import { mountPage, openDrawer, closeDrawers } from '../layout.js';
import { state } from '../store.js';
import { t, tr } from '../i18n.js';
import { esc, money, weightText, categoryUrl } from '../format.js';
import { productCard, skeletonCards } from '../components/product-card.js';
import { filterProducts, priceBounds, weightOptions, categoryTree } from '../search.js';
import { icon } from '../icons.js';

const PAGE_SIZE = 24;
let results = [];
let shown = 0;
let observer = null;

function readFilters() {
  const u = new URL(location.href);
  const pathCat = currentCategoryId();
  return {
    q: u.searchParams.get('q') || '',
    category: pathCat,
    min: u.searchParams.get('min') || '',
    max: u.searchParams.get('max') || '',
    weights: (u.searchParams.get('w') || '').split(',').filter(Boolean),
    sale: u.searchParams.get('sale') === '1',
    stock: u.searchParams.get('stock') === '1',
    sort: u.searchParams.get('sort') || '',
  };
}

function writeFilters(f, { push = false } = {}) {
  const u = new URL(f.category ? categoryUrl(f.category) : to('shop'), location.href);
  u.search = STATIC && f.category ? `?cat=${encodeURIComponent(f.category)}` : '';
  if (f.q) u.searchParams.set('q', f.q);
  if (f.min) u.searchParams.set('min', f.min);
  if (f.max) u.searchParams.set('max', f.max);
  if (f.weights.length) u.searchParams.set('w', f.weights.join(','));
  if (f.sale) u.searchParams.set('sale', '1');
  if (f.stock) u.searchParams.set('stock', '1');
  if (f.sort) u.searchParams.set('sort', f.sort);
  const lang = new URL(location.href).searchParams.get('lang');
  if (lang) u.searchParams.set('lang', lang);
  history[push ? 'pushState' : 'replaceState'](null, '', u);
}

function pageTitle(f) {
  if (f.q) return t('shop.resultsFor', { q: f.q });
  if (f.category) return tr(state.categoryMap.get(f.category)?.name) || t('nav.shop');
  if (f.sale) return t('nav.offers');
  return t('shop.allProducts');
}

function breadcrumbs(f) {
  const trail = [];
  let c = state.categoryMap.get(f.category);
  while (c) { trail.unshift(c); c = state.categoryMap.get(c.parentId); }
  return `<nav class="breadcrumbs" aria-label="${esc(t('nav.breadcrumbs'))}"><ol>
    <li><a href="${to('home')}">${esc(t('nav.home'))}</a></li>
    <li><a href="${to('shop')}">${esc(t('nav.shop'))}</a></li>
    ${trail.map((x, i) => `<li>${i === trail.length - 1 ? `<span aria-current="page">${esc(tr(x.name))}</span>` : `<a href="${categoryUrl(x.id)}">${esc(tr(x.name))}</a>`}</li>`).join('')}
  </ol></nav>`;
}

function categoryChips(f) {
  const current = state.categoryMap.get(f.category);
  const children = state.categories.filter((c) => c.parentId === (f.category || ''));
  const list = children.length ? children : state.categories.filter((c) => c.parentId === (current?.parentId || ''));
  if (!list.length) return '';
  return `<div class="chip-scroll" role="list">
    ${!f.category ? `<a role="listitem" class="chip is-active" href="${to('shop')}" aria-current="page">${esc(t('shop.all'))}</a>` : ''}
    ${list.map((c) => `<a role="listitem" class="chip${c.id === f.category ? ' is-active' : ''}" href="${categoryUrl(c.id)}"${c.id === f.category ? ' aria-current="page"' : ''}>${esc(tr(c.name))}</a>`).join('')}
  </div>`;
}

function filtersPanel(f) {
  const scope = f.category ? state.products.filter((p) => categoryTree(f.category).has(p.categoryId)) : state.products;
  const [lo, hi] = priceBounds(scope);
  const weights = weightOptions(scope);
  const tops = state.categories.filter((c) => !c.parentId);
  const catItem = (c, depth = 0) => `
    <li><a class="filter-cat${c.id === f.category ? ' is-active' : ''}" href="${categoryUrl(c.id)}" data-cat="${esc(c.id)}" style="--depth:${depth}">${esc(tr(c.name))}</a></li>
    ${state.categories.filter((x) => x.parentId === c.id).map((x) => catItem(x, depth + 1)).join('')}`;
  return `
    <div class="drawer-backdrop only-mobile" data-close-drawer></div>
    <div class="drawer-panel filters-panel" role="dialog" aria-label="${esc(t('filters.title'))}">
      <div class="drawer-head only-mobile"><h2 class="drawer-title">${esc(t('filters.title'))}</h2>
        <button class="icon-btn" type="button" data-close-drawer aria-label="${esc(t('close'))}">${icon('close')}</button></div>
      <div class="drawer-body">
        <fieldset class="filter-group">
          <legend>${esc(t('filters.category'))}</legend>
          <ul class="filter-cats">
            <li><a class="filter-cat${!f.category ? ' is-active' : ''}" href="${to('shop')}" data-cat="">${esc(t('shop.all'))}</a></li>
            ${tops.map((c) => catItem(c)).join('')}
          </ul>
        </fieldset>
        <fieldset class="filter-group">
          <legend>${esc(t('filters.price'))}</legend>
          <div class="price-inputs">
            <label><span>${esc(t('filters.min'))}</span><input type="number" inputmode="numeric" min="0" step="250" name="min" value="${esc(f.min)}" placeholder="${lo}"></label>
            <label><span>${esc(t('filters.max'))}</span><input type="number" inputmode="numeric" min="0" step="250" name="max" value="${esc(f.max)}" placeholder="${hi}"></label>
          </div>
          <p class="muted small">${esc(money(lo))} – ${esc(money(hi))}</p>
        </fieldset>
        ${weights.length ? `<fieldset class="filter-group">
          <legend>${esc(t('filters.weight'))}</legend>
          <div class="check-chips">${weights.map((g) => `<label class="check-chip"><input type="checkbox" name="w" value="${g}" ${f.weights.includes(String(g)) ? 'checked' : ''}><span>${esc(weightText({ grams: g }))}</span></label>`).join('')}</div>
        </fieldset>` : ''}
        <fieldset class="filter-group">
          <legend class="visually-hidden">${esc(t('filters.more'))}</legend>
          <label class="switch"><input type="checkbox" name="sale" ${f.sale ? 'checked' : ''}><span class="switch-ui"></span>${esc(t('filters.onSale'))}</label>
          <label class="switch"><input type="checkbox" name="stock" ${f.stock ? 'checked' : ''}><span class="switch-ui"></span>${esc(t('filters.inStock'))}</label>
        </fieldset>
      </div>
      <div class="drawer-foot">
        <button type="button" class="btn btn-ghost" data-clear-filters>${esc(t('filters.clear'))}</button>
        <button type="button" class="btn btn-primary only-mobile" data-close-drawer data-show-results>${esc(t('filters.show'))}</button>
      </div>
    </div>`;
}

function activeChips(f) {
  const chips = [];
  if (f.q) chips.push(['q', `“${f.q}”`]);
  if (f.min) chips.push(['min', `≥ ${money(f.min)}`]);
  if (f.max) chips.push(['max', `≤ ${money(f.max)}`]);
  f.weights.forEach((g) => chips.push([`w:${g}`, weightText({ grams: Number(g) })]));
  if (f.sale) chips.push(['sale', t('filters.onSale')]);
  if (f.stock) chips.push(['stock', t('filters.inStock')]);
  if (!chips.length) return '';
  return chips.map(([k, label]) => `<button type="button" class="chip chip--removable" data-remove-filter="${esc(k)}">${esc(label)} ${icon('close')}</button>`).join('');
}

function renderResults() {
  const f = readFilters();
  results = filterProducts(f);
  shown = 0;
  const grid = document.getElementById('grid');
  document.getElementById('result-count').textContent = t('shop.count', { n: results.length });
  document.getElementById('active-filters').innerHTML = activeChips(f);
  const showBtn = document.querySelector('[data-show-results]');
  if (showBtn) showBtn.textContent = `${t('filters.show')} (${results.length})`;
  if (!results.length) {
    grid.innerHTML = `<div class="empty-state">${icon('search', 'empty-icon')}<h2>${esc(t('shop.emptyTitle'))}</h2><p>${esc(t('shop.emptyText'))}</p><button type="button" class="btn btn-primary" data-clear-filters>${esc(t('filters.clear'))}</button></div>`;
    document.getElementById('more').hidden = true;
    return;
  }
  grid.innerHTML = '';
  appendPage();
}

function appendPage() {
  const grid = document.getElementById('grid');
  const next = results.slice(shown, shown + PAGE_SIZE);
  grid.insertAdjacentHTML('beforeend', next.map((p, i) => productCard(p, { eager: shown === 0 && i < 4 })).join(''));
  shown += next.length;
  const more = document.getElementById('more');
  more.hidden = shown >= results.length;
}

function update(patch, opts) {
  const f = { ...readFilters(), ...patch };
  writeFilters(f, opts);
  renderResults();
  document.querySelectorAll('.filter-cat').forEach((a) => a.classList.toggle('is-active', a.dataset.cat === f.category));
}

let bound = false;
function bind() {
  if (bound) return;
  bound = true;
  let priceTimer = null;
  const main = document.getElementById('main');
  main.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'sort') update({ sort: el.value });
    else if (el.name === 'sale') update({ sale: el.checked });
    else if (el.name === 'stock') update({ stock: el.checked });
    else if (el.name === 'w') update({ weights: [...main.querySelectorAll('input[name="w"]:checked')].map((x) => x.value) });
  });
  main.addEventListener('input', (e) => {
    if (e.target.name !== 'min' && e.target.name !== 'max') return;
    clearTimeout(priceTimer);
    priceTimer = setTimeout(() => update({ [e.target.name]: e.target.value }), 450);
  });
  main.addEventListener('click', (e) => {
    const el = e.target.closest('button, a');
    if (!el) return;
    if (el.matches('[data-open-filters]')) openDrawer('filters');
    else if (el.matches('[data-clear-filters]')) {
      writeFilters({ q: '', category: readFilters().category, min: '', max: '', weights: [], sale: false, stock: false, sort: '' });
      render(document.getElementById('main'));
    } else if (el.matches('[data-remove-filter]')) {
      const k = el.dataset.removeFilter;
      const f = readFilters();
      if (k.startsWith('w:')) update({ weights: f.weights.filter((g) => g !== k.slice(2)) });
      else if (k === 'q') { update({ q: '' }); render(document.getElementById('main')); }
      else update({ [k]: k === 'sale' || k === 'stock' ? false : '' });
      if (k !== 'q') syncInputs();
    } else if (el.matches('[data-more]')) appendPage();
    else if (el.matches('.filter-cat, .chip-scroll .chip')) {
      e.preventDefault();
      const id = el.dataset.cat ?? categoryFromHref(el.href);
      writeFilters({ ...readFilters(), category: id, min: '', max: '', weights: [] }, { push: true });
      closeDrawers();
      render(document.getElementById('main'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
  window.addEventListener('popstate', () => render(document.getElementById('main')));
}

function syncInputs() {
  const f = readFilters();
  const main = document.getElementById('main');
  main.querySelectorAll('input[name="w"]').forEach((x) => { x.checked = f.weights.includes(x.value); });
  const set = (n, v) => { const x = main.querySelector(`input[name="${n}"]`); if (x) { if (x.type === 'checkbox') x.checked = v; else x.value = v; } };
  set('min', f.min); set('max', f.max); set('sale', f.sale); set('stock', f.stock);
}

function render(main) {
  const f = readFilters();
  const sorts = [['', 'sort.recommended'], ['newest', 'sort.newest'], ['price_asc', 'sort.priceAsc'], ['price_desc', 'sort.priceDesc'], ['best', 'sort.best']];
  main.innerHTML = `<div class="container shop">
    ${breadcrumbs(f)}
    <div class="shop-head"><h1>${esc(pageTitle(f))}</h1><span class="muted" id="result-count" aria-live="polite"></span></div>
    ${categoryChips(f)}
    <div class="shop-toolbar">
      <button type="button" class="btn btn-outline only-mobile" data-open-filters aria-controls="filters">${icon('filter')} ${esc(t('filters.title'))}</button>
      <div class="active-filters" id="active-filters"></div>
      <label class="sort-select"><span class="visually-hidden">${esc(t('sort.label'))}</span>
        <select id="sort">${sorts.map(([v, k]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${esc(t(k))}</option>`).join('')}</select>
      </label>
    </div>
    <div class="shop-layout">
      <aside id="filters" class="filters drawer drawer--start drawer--desktop-static">${filtersPanel(f)}</aside>
      <section aria-labelledby="result-count">
        <div class="product-grid" id="grid">${skeletonCards(8)}</div>
        <div class="load-more" id="more" hidden><button type="button" class="btn btn-outline" data-more>${esc(t('shop.loadMore'))}</button></div>
      </section>
    </div>
  </div>`;
  bind();
  renderResults();

  observer?.disconnect();
  observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && shown < results.length) appendPage();
  }, { rootMargin: '600px 0px' });
  observer.observe(document.getElementById('more'));
}

mountPage({
  render,
  title: () => pageTitle(readFilters()),
  description: () => t('meta.description'),
});
