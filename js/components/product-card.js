import { t, tr } from '../i18n.js';
import { esc, imgTag, price, priceHtml, productUrl, weightText, bestPercent } from '../format.js';
import { icon } from '../icons.js';

/** Product card HTML. Weight chips let customers pick a size right from the grid. */
export function productCard(p, { eager = false } = {}) {
  const name = tr(p.name);
  const w0 = p.weights.find(() => true);
  const info = price(p, w0);
  const pct = bestPercent(p);
  const chips = p.weights.length > 1
    ? `<div class="wchips" role="radiogroup" aria-label="${esc(t('product.weight'))}">${p.weights.slice(0, 4).map((w, i) =>
      `<button type="button" class="wchip${i === 0 ? ' is-active' : ''}" role="radio" aria-checked="${i === 0}" data-w="${esc(w.id)}">${esc(weightText(w))}</button>`).join('')}</div>`
    : `<div class="wchips wchips--single">${esc(weightText(w0))}</div>`;
  return `<article class="pcard${p.inStock ? '' : ' is-oos'}" data-pid="${esc(p.id)}" data-w="${esc(w0?.id || '')}">
  <a class="pcard-media" href="${productUrl(p.id)}" tabindex="-1" aria-hidden="true">
    ${imgTag(p.thumb, { alt: name, blur: p.blur, eager })}
    ${pct > 0 ? `<span class="badge badge--sale">-${pct}%</span>` : ''}
    ${p.inStock ? '' : `<span class="badge badge--oos">${esc(t('product.outOfStock'))}</span>`}
  </a>
  <div class="pcard-body">
    <h3 class="pcard-title"><a href="${productUrl(p.id)}">${esc(name)}</a></h3>
    ${chips}
    <div class="pcard-foot">
      <div class="pcard-price">${priceHtml(info)}</div>
      <button type="button" class="add-btn" data-add ${p.inStock ? '' : 'disabled'} aria-label="${esc(t('cart.add'))}: ${esc(name)}">${icon('plus')}</button>
    </div>
  </div>
</article>`;
}

export function skeletonCards(n = 8) {
  return Array.from({ length: n }, () => `<div class="pcard pcard--skeleton" aria-hidden="true"><div class="pcard-media sk"></div><div class="pcard-body"><div class="sk sk-line"></div><div class="sk sk-line sk-short"></div></div></div>`).join('');
}
