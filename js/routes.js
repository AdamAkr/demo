// All website links in one place.
// Production (Firebase Hosting) uses pretty URLs: /shop, /p/<id>, /c/<id>.
// The static demo build (scripts/build-demo.mjs) sets STATIC = true so every link
// becomes a plain relative file link (shop.html, product.html?id=…) that works on
// GitHub Pages or any static host, even inside a sub-folder.
export const STATIC = true;

const PAGES = STATIC
  ? { home: 'index.html', shop: 'shop.html', about: 'about.html', contact: 'contact.html', checkout: 'checkout.html', order: 'order.html', payment: 'payment-result.html' }
  : { home: '/', shop: '/shop', about: '/about', contact: '/contact', checkout: '/checkout', order: '/order', payment: '/payment-result' };

function query(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) if (v != null && v !== '' && v !== false) q.set(k, v === true ? '1' : v);
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Link to a page, e.g. to('shop', { sale: 1 }). */
export const to = (page, params) => `${PAGES[page]}${query(params)}`;

export const productUrl = (id) => (STATIC ? `product.html${query({ id })}` : `/p/${encodeURIComponent(id)}`);
export const categoryUrl = (id, params) => (STATIC ? to('shop', { cat: id, ...params }) : `/c/${encodeURIComponent(id)}${query(params)}`);

/** Site asset path, e.g. asset('/img/hero.webp'). */
export const asset = (p) => (STATIC ? String(p).replace(/^\//, '') : p);

/** Product id / category id from the current URL (pretty or ?id= / ?cat= form). */
export const currentProductId = () => decodeURIComponent((location.pathname.match(/\/p\/([^/?#]+)/) || [])[1] || '') || new URLSearchParams(location.search).get('id') || '';
export const currentCategoryId = () => decodeURIComponent((location.pathname.match(/\/c\/([^/?#]+)/) || [])[1] || '') || new URLSearchParams(location.search).get('cat') || '';

/** Category id from a link produced by categoryUrl(). */
export function categoryFromHref(href) {
  const u = new URL(href, location.href);
  return decodeURIComponent((u.pathname.match(/\/c\/([^/?#]+)/) || [])[1] || '') || u.searchParams.get('cat') || '';
}

/** Turns admin-entered links (/shop?sale=1, /p/x, /c/y) into links that work in this build. */
export function siteLink(href) {
  if (!STATIC || !href || !href.startsWith('/')) return href || to('home');
  const u = new URL(href, 'https://x');
  const params = Object.fromEntries(u.searchParams);
  const p = u.pathname.match(/^\/p\/([^/]+)/);
  if (p) return productUrl(decodeURIComponent(p[1]));
  const c = u.pathname.match(/^\/c\/([^/]+)/);
  if (c) return categoryUrl(decodeURIComponent(c[1]), params);
  const name = { '/': 'home', '/shop': 'shop', '/about': 'about', '/contact': 'contact', '/checkout': 'checkout' }[u.pathname.replace(/\.html$/, '')];
  return name ? to(name, params) : href.replace(/^\//, '');
}
