// ══════════════════════════════════════════════════════════
// Stayform · traduction de la page d'accueil et de l'espace hôte
// (FR / EN / ES / AR)
//
// Chargé dans le <head> de index.html et pricing.html, avant le reste.
// Le français est la langue source : en français, ce fichier ne touche
// à rien. Dans une autre langue, il traduit les textes de la page à
// partir du dictionnaire app-i18n-dict.js (clé = texte français) :
//   - les nœuds de texte et les attributs placeholder / title /
//     aria-label, y compris ceux ajoutés plus tard par le JavaScript ;
//   - les nombres sont remplacés par {n} pour la recherche, puis remis
//     à leur place (« Étape 2 sur 4 » utilise la clé « Étape {n} sur {n} ») ;
//   - les textes avec un nom ou une valeur libre passent par PATTERNS ;
//   - alert() et confirm() sont traduits de la même façon.
// Ne sont jamais traduits : champs de saisie, <textarea>, <script>,
// <style>, et tout élément marqué data-no-i18n (ou à l'intérieur).
//
// Langue : ?lang=xx, puis le dernier choix (localStorage « sf_lang »,
// partagé avec le check-in), puis la langue du navigateur, sinon le
// français. Changer de langue enregistre le choix et recharge la page.
// ══════════════════════════════════════════════════════════
(function () {
  var LANGS = ['fr', 'en', 'es', 'ar'];
  var NAMES = { fr: 'Français', en: 'English', es: 'Español', ar: 'العربية' };
  var LOCALES = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', ar: 'ar-MA' };
  var IDX = { en: 0, es: 1, ar: 2 };

  function pick(list) {
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i] || '').toLowerCase().slice(0, 2);
      if (LANGS.indexOf(code) !== -1) return code;
    }
    return null;
  }

  function detect() {
    var fromUrl = null;
    try { fromUrl = pick([new URLSearchParams(location.search).get('lang')]); } catch (e) {}
    if (fromUrl) return fromUrl;
    var saved = null;
    try { saved = localStorage.getItem('sf_lang'); } catch (e) {}
    return pick([saved]) || pick(navigator.languages || [navigator.language]) || 'fr';
  }

  var lang = detect();
  window.SF_LANG = lang;
  window.SF_LOCALE = LOCALES[lang];
  document.documentElement.setAttribute('lang', lang);
  if (lang === 'ar') document.documentElement.setAttribute('dir', 'rtl');

  function setLang(next) {
    if (LANGS.indexOf(next) === -1 || next === lang) return;
    try { localStorage.setItem('sf_lang', next); } catch (e) {}
    // Retire ?lang= de l'adresse, sinon il reprendrait le dessus au rechargement.
    try {
      var u = new URL(location.href);
      if (u.searchParams.has('lang')) { u.searchParams.delete('lang'); history.replaceState(null, '', u.toString()); }
    } catch (e) {}
    location.reload();
  }
  window.sfSetLang = setLang;

  // Menu de langue : <select> placé dans chaque conteneur [data-lang-switch].
  function mountSwitchers(root) {
    var hosts = (root || document).querySelectorAll('[data-lang-switch]:not([data-lang-ready])');
    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      host.setAttribute('data-lang-ready', '1');
      host.setAttribute('data-no-i18n', '');
      var sel = document.createElement('select');
      sel.className = 'sf-lang-select';
      sel.setAttribute('aria-label', { fr: 'Langue', en: 'Language', es: 'Idioma', ar: 'اللغة' }[lang]);
      LANGS.forEach(function (code) {
        var o = document.createElement('option');
        o.value = code;
        // Version courte (barre du haut) : le code seul, le nom complet en infobulle.
        var short = host.getAttribute('data-lang-switch') === 'short';
        o.textContent = short ? code.toUpperCase() : NAMES[code];
        o.title = NAMES[code];
        if (code === lang) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function (e) { setLang(e.target.value); });
      host.appendChild(sel);
    }
  }

  // ── Traduction ────────────────────────────────────────
  var DICT = window.SF_APP_DICT || {};
  var PATTERNS = window.SF_APP_PATTERNS || [];
  var cache = Object.create(null);

  function fromDict(key) {
    var e = DICT[key];
    if (!e) return null;
    var v = e[IDX[lang]];
    return v == null ? null : v;
  }

  // Traduit un texte sans ses espaces de début et de fin.
  function core(s) {
    var hit = fromDict(s);
    if (hit != null) return hit;
    // Nombres → {n}
    var nums = [];
    var tpl = s.replace(/\d+(?:[.,  ]\d+)*/g, function (m) { nums.push(m); return '{n}'; });
    if (nums.length) {
      hit = fromDict(tpl);
      if (hit != null) { var k = 0; return hit.replace(/\{n\}/g, function () { return nums[k++]; }); }
    }
    for (var i = 0; i < PATTERNS.length; i++) {
      var p = PATTERNS[i];
      var m = s.match(p[0]);
      if (m) {
        var out = p[1][IDX[lang]];
        return out.replace(/\$(\d)/g, function (_, d) { return m[+d] == null ? '' : m[+d]; });
      }
    }
    return null;
  }

  function tr(text) {
    if (lang === 'fr' || text == null) return text;
    var str = String(text);
    if (str in cache) return cache[str];
    var m = str.match(/^(\s*)([\s\S]*?)(\s*)$/);
    var inner = m[2].replace(/\s+/g, ' ');
    var res = null;
    if (/[A-Za-zÀ-ÿ]/.test(inner)) res = core(inner);
    var out = res == null ? str : m[1] + res + m[3];
    cache[str] = out;
    return out;
  }
  window.sfT = tr;

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, NOSCRIPT: 1, CODE: 1 };
  var ATTRS = ['placeholder', 'title', 'aria-label'];
  var done = new WeakMap(); // nœud de texte → valeur déjà traduite

  function skipped(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (SKIP_TAGS[e.tagName] || e.hasAttribute('data-no-i18n') || e.isContentEditable) return true;
    }
    return false;
  }

  function doText(node) {
    var v = node.nodeValue;
    if (!v || done.get(node) === v) return;
    if (skipped(node.parentElement)) return;
    var t = tr(v);
    if (t !== v) node.nodeValue = t;
    done.set(node, t);
  }

  function doAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute(a)) continue;
      var v = el.getAttribute(a), t = tr(v);
      if (t !== v) el.setAttribute(a, t);
    }
    // Bouton <input type="button|submit"> : son texte est dans value.
    if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit') && el.value) {
      var tv = tr(el.value);
      if (tv !== el.value) el.value = tv;
    }
  }

  // Élément exclu (data-no-i18n) ou dans une zone exclue.
  function attrSkipped(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (e.hasAttribute('data-no-i18n') || e.isContentEditable) return true;
    }
    return false;
  }

  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 || attrSkipped(root)) return;
    doAttrs(root);
    if (SKIP_TAGS[root.tagName]) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType !== 1) return NodeFilter.FILTER_ACCEPT;
        if (n.hasAttribute('data-no-i18n') || n.isContentEditable) return NodeFilter.FILTER_REJECT;
        // Champ de saisie : on traduit son placeholder, jamais son contenu.
        if (SKIP_TAGS[n.tagName]) { doAttrs(n); return NodeFilter.FILTER_REJECT; }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) doText(n); else doAttrs(n);
    }
  }

  function start() {
    mountSwitchers(document);
    if (lang === 'fr') {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) for (var j = 0; j < muts[i].addedNodes.length; j++) {
          var n = muts[i].addedNodes[j];
          if (n.nodeType === 1) mountSwitchers(n.parentElement || n);
        }
      }).observe(document.body, { childList: true, subtree: true });
      return;
    }
    document.title = tr(document.title);
    walk(document.body);
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') { if (!attrSkipped(m.target)) doAttrs(m.target); }
        else for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType === 1) mountSwitchers(n.parentElement || n);
          walk(n);
        }
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    // Le <title> peut aussi être changé par le script de la page.
    var t = document.querySelector('title');
    if (t) new MutationObserver(function () { var v = tr(document.title); if (v !== document.title) document.title = v; })
      .observe(t, { childList: true, characterData: true, subtree: true });
  }

  if (lang !== 'fr') {
    var _alert = window.alert, _confirm = window.confirm;
    window.alert = function (msg) { return _alert.call(window, tr(msg)); };
    window.confirm = function (msg) { return _confirm.call(window, tr(msg)); };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
