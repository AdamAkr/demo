// About Us and Contact Us pages — fully editable from the admin (3 languages).
import { mountPage } from '../layout.js';
import { state } from '../store.js';
import { t, tr } from '../i18n.js';
import { esc, paragraphs } from '../format.js';
import { icon } from '../icons.js';

const kind = document.body.dataset.page; // "about" | "contact"

function about(main) {
  const a = state.content?.about || {};
  main.innerHTML = `<div class="container info-page">
    <header class="info-hero">
      <span class="eyebrow">${esc(t('nav.about'))}</span>
      <h1>${esc(tr(a.title) || t('about.title'))}</h1>
      ${tr(a.subtitle) ? `<p class="lead">${esc(tr(a.subtitle))}</p>` : ''}
    </header>
    <div class="info-grid${a.image ? '' : ' info-grid--single'}">
      <div class="prose">${paragraphs(tr(a.body) || t('about.body'))}</div>
      ${a.image ? `<img class="info-img" src="${esc(a.image)}" alt="" loading="lazy" width="560" height="420">` : ''}
    </div>
    ${(a.values || []).length ? `<div class="values">${a.values.map((v) => `<div class="value-card"><h3>${esc(tr(v.title))}</h3><p>${esc(tr(v.text))}</p></div>`).join('')}</div>` : ''}
  </div>`;
}

function contact(main) {
  const c = state.content?.contact || {};
  const s = state.shop || {};
  const items = [
    s.phone && ['phone', t('contact.phone'), s.phone, `tel:${s.phone}`],
    s.whatsapp && ['whatsapp', 'WhatsApp', s.whatsapp, `https://wa.me/${String(s.whatsapp).replace(/\D/g, '')}`],
    s.telegram && ['telegram', 'Telegram', s.telegram, String(s.telegram).startsWith('http') ? s.telegram : `https://t.me/${String(s.telegram).replace('@', '')}`],
    s.instagram && ['instagram', 'Instagram', s.instagram, String(s.instagram).startsWith('http') ? s.instagram : `https://instagram.com/${String(s.instagram).replace('@', '')}`],
    s.email && ['mail', t('contact.email'), s.email, `mailto:${s.email}`],
  ].filter(Boolean);
  // Only Google Maps embeds are allowed in the iframe.
  const mapSrc = s.mapEmbedUrl && /^https:\/\/(www\.google\.[a-z.]+\/maps\/embed|maps\.google\.[a-z.]+\/maps\?)/.test(s.mapEmbedUrl) ? s.mapEmbedUrl : '';
  main.innerHTML = `<div class="container info-page">
    <header class="info-hero">
      <span class="eyebrow">${esc(t('nav.contact'))}</span>
      <h1>${esc(tr(c.title) || t('contact.title'))}</h1>
      <p class="lead">${esc(tr(c.intro) || t('contact.intro'))}</p>
    </header>
    <div class="contact-grid">
      <div class="contact-list">
        ${items.map(([ic, label, value, href]) => `<a class="contact-item" href="${esc(href)}" ${href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>
          <span class="contact-icon">${icon(ic)}</span><span><strong>${esc(label)}</strong><span dir="ltr">${esc(value)}</span></span></a>`).join('')}
        ${tr(s.address) ? `<div class="contact-item"><span class="contact-icon">${icon('location')}</span><span><strong>${esc(t('contact.address'))}</strong><span>${esc(tr(s.address))}</span></span></div>` : ''}
        ${tr(s.hours) ? `<div class="contact-item"><span class="contact-icon">${icon('clock')}</span><span><strong>${esc(t('contact.hours'))}</strong><span>${esc(tr(s.hours))}</span></span></div>` : ''}
      </div>
      <div class="map-wrap">
        ${mapSrc ? `<iframe title="${esc(t('contact.map'))}" src="${esc(mapSrc)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`
          : `<div class="map-placeholder">${icon('location')}<span>${esc(tr(s.address) || t('contact.map'))}</span></div>`}
        ${s.mapLink ? `<a class="btn btn-outline btn-block" href="${esc(s.mapLink)}" target="_blank" rel="noopener">${icon('location')} ${esc(t('contact.openMap'))}</a>` : ''}
      </div>
    </div>
    ${tr(c.body) ? `<div class="prose contact-body">${paragraphs(tr(c.body))}</div>` : ''}
  </div>`;
}

mountPage({
  render: kind === 'about' ? about : contact,
  title: () => t(kind === 'about' ? 'nav.about' : 'nav.contact'),
});
