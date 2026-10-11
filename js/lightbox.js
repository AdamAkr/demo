// Full-screen image viewer. Loads the FULL image only when opened.
// Swipe on mobile, pinch / double-tap / wheel to zoom, drag when zoomed,
// arrows to navigate, Esc or tap outside to close.
import { t } from './i18n.js';
import { esc } from './format.js';

let el = null;
let images = [];
let index = 0;
let caption = '';
let lastFocus = null;
let scale = 1;
let tx = 0;
let ty = 0;

function build() {
  el = document.createElement('div');
  el.className = 'lightbox';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.hidden = true;
  el.innerHTML = `
    <div class="lb-top">
      <span class="lb-count" aria-live="polite"></span>
      <button class="lb-btn lb-close" type="button" aria-label="${esc(t('close'))}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <div class="lb-stage">
      <div class="lb-spinner" aria-hidden="true"></div>
      <img class="lb-img" alt="" draggable="false">
    </div>
    <button class="lb-btn lb-nav lb-prev" type="button" aria-label="${esc(t('previous'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
    <button class="lb-btn lb-nav lb-next" type="button" aria-label="${esc(t('next'))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
    <div class="lb-caption"></div>`;
  document.body.appendChild(el);

  const stage = el.querySelector('.lb-stage');
  const img = el.querySelector('.lb-img');
  el.querySelector('.lb-close').addEventListener('click', close);
  el.querySelector('.lb-prev').addEventListener('click', () => go(-1));
  el.querySelector('.lb-next').addEventListener('click', () => go(1));
  stage.addEventListener('click', (e) => { if (e.target === stage && scale === 1) close(); });
  img.addEventListener('load', () => el.classList.remove('is-loading'));
  img.addEventListener('dblclick', (e) => toggleZoom(e));
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    setScale(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }, { passive: false });

  // Pointer gestures: swipe, drag, pinch.
  const pointers = new Map();
  let start = null;
  let pinchDist = 0;
  let pinchScale = 1;
  let lastTap = 0;
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) start = { x: e.clientX, y: e.clientY, tx, ty, time: Date.now() };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchScale = scale;
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      setScale(pinchScale * (Math.hypot(a.x - b.x, a.y - b.y) / pinchDist));
    } else if (start && scale > 1) {
      tx = start.tx + (e.clientX - start.x);
      ty = start.ty + (e.clientY - start.y);
      render();
    } else if (start) {
      img.style.transform = `translateX(${e.clientX - start.x}px)`;
    }
  });
  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size > 0 || !start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const quick = Date.now() - start.time < 250 && Math.abs(dx) < 10 && Math.abs(dy) < 10;
    if (scale === 1) {
      img.style.transform = '';
      const rtl = document.documentElement.dir === 'rtl';
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) go((dx < 0) !== rtl ? 1 : -1);
      else if (dy > 120) close();
    }
    if (quick && e.pointerType !== 'mouse') {
      if (Date.now() - lastTap < 300) toggleZoom(e);
      lastTap = Date.now();
    }
    start = null;
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  document.addEventListener('keydown', (e) => {
    if (el.hidden) return;
    const rtl = document.documentElement.dir === 'rtl';
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') go(rtl ? -1 : 1);
    else if (e.key === 'ArrowLeft') go(rtl ? 1 : -1);
    else if (e.key === 'Tab') {
      const focusables = [...el.querySelectorAll('button:not([hidden])')];
      const i = focusables.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); focusables.at(-1).focus(); }
      else if (!e.shiftKey && i === focusables.length - 1) { e.preventDefault(); focusables[0].focus(); }
    }
  });
}

function setScale(s) {
  scale = Math.min(4, Math.max(1, s));
  if (scale === 1) { tx = 0; ty = 0; }
  render();
}

function toggleZoom(e) {
  if (scale > 1) setScale(1);
  else {
    const img = el.querySelector('.lb-img');
    const r = img.getBoundingClientRect();
    scale = 2.5;
    tx = (r.left + r.width / 2 - e.clientX) * 1.5;
    ty = (r.top + r.height / 2 - e.clientY) * 1.5;
    render();
  }
}

function render() {
  const img = el.querySelector('.lb-img');
  img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  el.classList.toggle('is-zoomed', scale > 1);
}

function show() {
  const item = images[index];
  const img = el.querySelector('.lb-img');
  scale = 1; tx = 0; ty = 0;
  img.style.transform = '';
  el.classList.remove('is-zoomed');
  el.classList.add('is-loading');
  // Show the cached thumbnail instantly, then swap in the full image.
  img.src = item.thumb || item.full;
  img.alt = item.alt || '';
  if (item.full && item.full !== item.thumb) {
    const full = new Image();
    full.onload = () => { if (images[index] === item) { img.src = item.full; el.classList.remove('is-loading'); } };
    full.src = item.full;
  }
  el.querySelector('.lb-count').textContent = images.length > 1 ? `${index + 1} / ${images.length}` : '';
  el.querySelectorAll('.lb-nav').forEach((b) => { b.hidden = images.length < 2; });
  el.querySelector('.lb-caption').innerHTML = caption;
  el.querySelector('.lb-caption').hidden = !caption;
  // Preload neighbours' full images for smooth swiping.
  [index + 1, index - 1].forEach((i) => { const n = images[(i + images.length) % images.length]; if (n?.full) new Image().src = n.full; });
}

function go(d) {
  if (images.length < 2) return;
  index = (index + d + images.length) % images.length;
  show();
}

/** images: [{ full, thumb, alt }], captionHtml: already-escaped HTML. */
export function openLightbox(imgs, i = 0, captionHtml = '') {
  if (!el) build();
  images = imgs;
  index = i;
  caption = captionHtml;
  lastFocus = document.activeElement;
  el.hidden = false;
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => el.classList.add('is-open'));
  show();
  el.querySelector('.lb-close').focus();
}

export function close() {
  if (!el || el.hidden) return;
  el.classList.remove('is-open');
  document.body.classList.remove('no-scroll');
  setTimeout(() => { el.hidden = true; }, 200);
  lastFocus?.focus?.();
}
