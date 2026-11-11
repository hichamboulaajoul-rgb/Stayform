// Stayform · Scan de la pièce d'identité dès l'étape 2 « Vos coordonnées ».
//
// On réutilise tel quel le scanner de l'étape 3 (caméra avec cadre, détection
// automatique, galerie en secours, vérification Google Vision par la fonction
// verify-identity) : le bloc #scannerSection est déplacé dans l'étape 2, puis
// remis à sa place à l'étape 3. Quand le scan réussit à l'étape 2 :
//   - le formulaire est pré-rempli avec ce que la fonction a lu ;
//   - l'étape 3 affiche directement « Identité vérifiée », sans second scan.
// Si le voyageur modifie ensuite le numéro du document, la vérification est
// annulée et il devra scanner à l'étape 3.
(function () {
  'use strict';

  // Textes de secours si checkin-i18n.js est une ancienne version en cache.
  var FALLBACK = {
    idscan_title: "Remplir automatiquement avec votre pièce d'identité",
    idscan_sub: "Scannez le recto de votre CIN ou la page photo de votre passeport : vos informations se remplissent et votre identité est vérifiée. Pas besoin de scanner à nouveau à l'étape suivante.",
    idscan_ok: "✅ Identité vérifiée. Vérifiez les champs surlignés et corrigez-les si besoin.",
    idscan_ok_cin: "Complétez la date de naissance et la nationalité si elles sont vides.",
    idscan_expiry: "Valide jusqu'au {d}",
    idscan_expired: "⚠️ Ce document semble expiré (date d'expiration : {d}).",
    idscan_changed: "Vous avez modifié le numéro du document : il sera vérifié par un scan à l'étape suivante.",
    idscan_step3: "Vérifiée à l'étape précédente",
  };

  function tr(key, vars) {
    var s = typeof window.t === 'function' ? window.t(key, vars) : key;
    if (s === key && FALLBACK[key]) {
      s = FALLBACK[key];
      if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    }
    return s;
  }

  // ── Réponse de verify-identity → champs du formulaire ─────────────────────

  function parseDate(yymmdd, kind) {
    if (!/^\d{6}$/.test(yymmdd || '')) return null;
    var yy = +yymmdd.slice(0, 2), mm = +yymmdd.slice(2, 4), dd = +yymmdd.slice(4, 6);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    var nowYY = new Date().getFullYear() % 100;
    var year = kind === 'birth' ? (yy > nowYY ? 1900 + yy : 2000 + yy) : 2000 + yy;
    var d = new Date(Date.UTC(year, mm - 1, dd));
    if (d.getUTCMonth() !== mm - 1) return null;
    return year + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
  }

  function isoToFr(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  var NATIONALITIES = {
    MAR: ['Marocaine', 'Moroccan'], FRA: ['Française', 'French'], ESP: ['Espagnole', 'Spanish'],
    BEL: ['Belge', 'Belgian'], D: ['Allemande', 'German'], DEU: ['Allemande', 'German'],
    ITA: ['Italienne', 'Italian'], PRT: ['Portugaise', 'Portuguese'], NLD: ['Néerlandaise', 'Dutch'],
    CHE: ['Suisse', 'Swiss'], GBR: ['Britannique', 'British'], IRL: ['Irlandaise', 'Irish'],
    USA: ['Américaine', 'American'], CAN: ['Canadienne', 'Canadian'], LUX: ['Luxembourgeoise', 'Luxembourgish'],
    AUT: ['Autrichienne', 'Austrian'], SWE: ['Suédoise', 'Swedish'], NOR: ['Norvégienne', 'Norwegian'],
    DNK: ['Danoise', 'Danish'], FIN: ['Finlandaise', 'Finnish'], POL: ['Polonaise', 'Polish'],
    ROU: ['Roumaine', 'Romanian'], GRC: ['Grecque', 'Greek'], TUR: ['Turque', 'Turkish'],
    RUS: ['Russe', 'Russian'], UKR: ['Ukrainienne', 'Ukrainian'], CZE: ['Tchèque', 'Czech'],
    HUN: ['Hongroise', 'Hungarian'], DZA: ['Algérienne', 'Algerian'], TUN: ['Tunisienne', 'Tunisian'],
    LBY: ['Libyenne', 'Libyan'], EGY: ['Égyptienne', 'Egyptian'], MRT: ['Mauritanienne', 'Mauritanian'],
    SEN: ['Sénégalaise', 'Senegalese'], CIV: ['Ivoirienne', 'Ivorian'], MLI: ['Malienne', 'Malian'],
    CMR: ['Camerounaise', 'Cameroonian'], NGA: ['Nigériane', 'Nigerian'], SAU: ['Saoudienne', 'Saudi'],
    ARE: ['Émirienne', 'Emirati'], QAT: ['Qatarienne', 'Qatari'], KWT: ['Koweïtienne', 'Kuwaiti'],
    LBN: ['Libanaise', 'Lebanese'], JOR: ['Jordanienne', 'Jordanian'], ISR: ['Israélienne', 'Israeli'],
    CHN: ['Chinoise', 'Chinese'], JPN: ['Japonaise', 'Japanese'], KOR: ['Sud-coréenne', 'South Korean'],
    IND: ['Indienne', 'Indian'], BRA: ['Brésilienne', 'Brazilian'], MEX: ['Mexicaine', 'Mexican'],
    ARG: ['Argentine', 'Argentinian'], AUS: ['Australienne', 'Australian'], NZL: ['Néo-zélandaise', 'New Zealander'],
  };

  function nationalityLabel(code) {
    var n = NATIONALITIES[code];
    if (!n) return code || '';
    return (window._lang || 'fr') === 'fr' ? n[0] : n[1];
  }

  function titleCase(s) {
    return String(s || '').toLowerCase().replace(/(^|[\s'-])([a-zà-ÿ])/g, function (m, p, c) { return p + c.toUpperCase(); });
  }

  function docKind(code) {
    code = String(code || '').toUpperCase();
    if (code[0] === 'P') return 'passport';
    if (code[0] === 'A' || code[0] === 'R' || code === 'IR') return 'residence';
    return 'cin';
  }

  // Lignes en majuscules du recto de la CIN qui ne sont pas des noms.
  var NOT_A_NAME = /ROYAUME|MAROC|KINGDOM|MOROCCO|CARTE|NATIONALE|IDENTIT|VALABLE|JUSQU|\bNEE?\b|\bLE\b|\bA\b/;

  function toFormValues(r) {
    var v = { docNumber: String(r.detectedNum || '').toUpperCase(), docType: docKind(r.docType), fromMrz: !!r.mrzData };
    if (r.mrzData) {
      var m = r.mrzData;
      v.firstName = titleCase(m.firstName);
      v.lastName = titleCase(m.lastName);
      v.nationality = nationalityLabel(m.nationality);
      v.birthIso = parseDate(m.birthDate, 'birth');
      v.birthdate = isoToFr(v.birthIso);
      v.expiryIso = parseDate(m.expiryDate, 'expiry');
      v.expiry = isoToFr(v.expiryIso);
    } else {
      // Recto de la CIN marocaine : prénom puis nom, en lettres latines.
      var names = (r.latinNames || []).filter(function (l) { return !NOT_A_NAME.test(String(l).toUpperCase()); });
      if (names.length >= 2) { v.firstName = titleCase(names[0]); v.lastName = titleCase(names[1]); }
    }
    return v;
  }

  // ── Interface ─────────────────────────────────────────────────────────────

  var FIELD_IDS = ['docNumber', 'firstName', 'lastName', 'nationality', 'birthdate'];
  var scannedNumber = null;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toUpperCase().replace(/[\s-]/g, ''); }

  function setStatus(kind, html) {
    var el = document.getElementById('idScanStatus');
    if (!el) return;
    if (!kind) { el.style.display = 'none'; el.innerHTML = ''; return; }
    var c = { ok: ['#F0FFF4', 'rgba(0,138,5,0.3)', '#0A6B1F'], warn: ['#FFFBF0', '#FFE082', '#8B6500'] }[kind];
    el.style.display = 'block';
    el.style.background = c[0]; el.style.border = '1px solid ' + c[1]; el.style.color = c[2];
    el.innerHTML = html;
  }

  function highlight(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.add('id-scan-filled');
    el.addEventListener('input', function onIn() { el.classList.remove('id-scan-filled'); el.removeEventListener('input', onIn); });
  }

  // Appelé par callVisionOCR (checkin.html) quand le document est vérifié.
  function onVerified(result) {
    if (typeof currentStep === 'undefined' || currentStep !== 2) return;
    var v = toFormValues(result || {});
    FIELD_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && v[id]) { el.value = v[id]; highlight(id); }
    });
    ['docTypeIdentity', 'docType'].forEach(function (id) {
      var sel = document.getElementById(id);
      if (sel && sel.querySelector('option[value="' + v.docType + '"]')) {
        sel.value = v.docType;
        if (id === 'docTypeIdentity') highlight(id);
      }
    });
    scannedNumber = norm(document.getElementById('docNumber').value);
    // Photo choisie dans la galerie : on l'affiche dans le bloc « vérifiée » comme pour la caméra.
    var img = document.getElementById('cinCaptured');
    if (img && typeof docImage1 !== 'undefined' && docImage1) { img.src = docImage1; img.style.display = 'block'; }
    var fb = document.getElementById('scanFallback');
    if (fb) fb.style.display = 'none';
    var details = document.getElementById('scanSuccessDetails');
    if (details) details.innerHTML = esc(tr('scan_verified_line')) + '<br><span style="font-size:0.75rem;color:var(--mid);">' + esc(tr('idscan_step3')) + '</span>';

    var msg = esc(tr('idscan_ok'));
    if (!v.fromMrz) msg += '<br><span style="font-size:0.78rem;">' + esc(tr('idscan_ok_cin')) + '</span>';
    if (v.expiryIso) {
      msg += '<br><span style="font-size:0.78rem;">' + esc(tr('idscan_expiry', { d: v.expiry })) + '</span>';
      if (v.expiryIso < new Date().toISOString().slice(0, 10)) msg += '<br><strong>' + esc(tr('idscan_expired', { d: v.expiry })) + '</strong>';
    }
    setStatus('ok', msg);
  }

  // Le voyageur change le numéro après le scan : l'étape 3 redemandera un scan.
  function watchNumber() {
    var el = document.getElementById('docNumber');
    if (!el) return;
    el.addEventListener('input', function () {
      if (scannedNumber === null || norm(el.value) === scannedNumber) return;
      scannedNumber = null;
      if (typeof resetScanner === 'function') resetScanner();
      setStatus('warn', esc(tr('idscan_changed')));
    });
  }

  // Place le scanner dans l'étape affichée (appelé par updateUI).
  function place(step) {
    var scanner = document.getElementById('scannerSection');
    var slot2 = document.getElementById('idScanSlot');
    var slot3 = document.getElementById('scannerHome');
    if (!scanner || !slot2 || !slot3) return;
    var target = step === 2 ? slot2 : step === 3 ? slot3 : null;
    if (!target || scanner.parentNode === target) return;
    if (typeof stopCINScanner === 'function' && typeof cinStream !== 'undefined' && cinStream) {
      stopCINScanner();
      if (!cinVerified) document.getElementById('scanReady').style.display = 'block';
    }
    target.appendChild(scanner);
  }

  function translate() {
    document.querySelectorAll('[data-idscan]').forEach(function (el) { el.textContent = tr(el.getAttribute('data-idscan')); });
  }

  function mount() {
    var page = document.getElementById('page2');
    var scanner = document.getElementById('scannerSection');
    if (!page || !scanner || document.getElementById('idScanCard')) return;
    var style = document.createElement('style');
    style.textContent =
      '.id-scan-filled{background:#FFF8E1 !important;border-color:#C9A227 !important;color:#16241E !important;}' +
      '#idScanCard h3{font-size:0.95rem;font-weight:700;color:var(--deep,#16241E);margin:0 0 0.3rem;}' +
      '#idScanCard .id-scan-sub{font-size:0.8rem;color:var(--light-mid,#5E6B65);line-height:1.55;margin:0 0 0.9rem;}' +
      '#idScanStatus{display:none;margin-top:0.8rem;padding:0.7rem 0.9rem;border-radius:10px;font-size:0.8rem;line-height:1.5;}';
    document.head.appendChild(style);

    // Emplacement d'origine du scanner à l'étape 3.
    var home = document.createElement('div');
    home.id = 'scannerHome';
    scanner.parentNode.insertBefore(home, scanner);
    home.appendChild(scanner);

    var card = document.createElement('div');
    card.id = 'idScanCard';
    card.className = 'card';
    card.style.marginBottom = '1.2rem';
    card.innerHTML =
      '<h3 data-idscan="idscan_title"></h3>' +
      '<p class="id-scan-sub" data-idscan="idscan_sub"></p>' +
      '<div id="idScanSlot"></div>' +
      '<div id="idScanStatus" role="status" aria-live="polite"></div>';
    var notice = document.getElementById('identityNotice');
    if (notice && notice.parentNode === page) page.insertBefore(card, notice.nextSibling);
    else page.insertBefore(card, page.querySelector('.card'));

    translate();
    document.addEventListener('sf:langchange', translate);
    watchNumber();
    if (typeof currentStep !== 'undefined') place(currentStep);
  }

  window.StayformIdScan = { toFormValues: toFormValues, parseDate: parseDate, onVerified: onVerified, place: place };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
