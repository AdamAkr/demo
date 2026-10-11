// Runs before first paint: sets language/direction and re-applies the last theme
// from cache so there is no flash of the wrong colours or layout direction.
(function () {
  try {
    var d = document.documentElement;
    var q = new URLSearchParams(location.search).get('lang');
    var l = q || localStorage.getItem('cz_lang') || localStorage.getItem('cz_default_lang') || 'ckb';
    if (['ar', 'ckb', 'en'].indexOf(l) < 0) l = 'ckb';
    d.lang = l;
    d.dir = l === 'en' ? 'ltr' : 'rtl';
    var css = localStorage.getItem('cz_theme_css');
    if (css) {
      var s = document.createElement('style');
      s.id = 'cz-theme';
      s.textContent = css;
      document.head.appendChild(s);
    }
    var ah = Number(localStorage.getItem('cz_ann_h'));
    if (ah > 0 && ah < 200) d.style.setProperty('--ann-h', ah + 'px');
    var f = localStorage.getItem('cz_fonts_href');
    if (f) {
      var k = document.createElement('link');
      k.id = 'cz-fonts';
      k.rel = 'stylesheet';
      k.href = f;
      document.head.appendChild(k);
    }
  } catch (e) { /* storage blocked */ }
})();
