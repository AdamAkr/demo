import { to } from '../routes.js';
import { mountPage } from '../layout.js';
import { t } from '../i18n.js';
import { esc } from '../format.js';

mountPage({
  render(main) {
    main.innerHTML = `<div class="container empty-state">
      <p class="big-404" aria-hidden="true">404</p>
      <h1>${esc(t('notFound.title'))}</h1>
      <p>${esc(t('notFound.text'))}</p>
      <a class="btn btn-primary" href="${to('home')}">${esc(t('nav.home'))}</a>
      <a class="btn btn-ghost" href="${to('shop')}">${esc(t('nav.shop'))}</a>
    </div>`;
  },
  title: () => t('notFound.title'),
});
