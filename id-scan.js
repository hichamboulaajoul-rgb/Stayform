// Stayform · Remplissage automatique de l'étape 2 « Vos coordonnées » par scan
// de la pièce d'identité.
//
// La photo est envoyée à la même fonction que le scan de l'étape 3
// (verify-identity, Google Vision). Elle renvoie le numéro du document et, quand
// il y a une MRZ (passeport, titre de séjour, carte d'identité au dos), le nom,
// le prénom, la nationalité et les dates. Le formulaire est pré-rempli et
// l'identité est marquée comme vérifiée : l'étape 3 n'a pas besoin d'un second
// scan, sauf si le voyageur modifie ensuite le numéro du document.
(function () {
  'use strict';

  var ENDPOINT = 'https://syvpyvkgauyfqghwiqsl.supabase.co/functions/v1/verify-identity';

  function tr(key, vars) { return typeof window.t === 'function' ? window.t(key, vars) : key; }

  // ── Conversion de la réponse vers les champs du formulaire ────────────────

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

  // ── Photo → JPEG réduit (les photos de téléphone font souvent 4000 px) ─────

  function toJpeg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, scale = Math.min(1, 1600 / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * scale); c.height = Math.round(h * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }

  function verify(dataUrl) {
    var key = typeof SUPABASE_KEY !== 'undefined' ? SUPABASE_KEY : '';
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      // Sans numéro saisi, la fonction lit le document et renvoie ce qu'elle trouve.
      body: JSON.stringify({ imageBase64: dataUrl.split(',')[1], mediaType: 'image/jpeg', docNumber: '' }),
    }).then(function (res) {
      if (res.status === 429) { var e = new Error('limit'); e.code = 'limit'; throw e; }
      return res.json();
    });
  }

  // ── Interface ─────────────────────────────────────────────────────────────

  var FIELD_IDS = ['docNumber', 'firstName', 'lastName', 'nationality', 'birthdate'];
  var scannedNumber = null;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toUpperCase().replace(/[\s-]/g, ''); }

  function setStatus(kind, html) {
    var el = document.getElementById('idScanStatus');
    if (!el) return;
    var c = { info: ['#F7F7F7', '#EBEBEB', '#4A4A4A'], ok: ['#F0FFF4', 'rgba(0,138,5,0.3)', '#0A6B1F'], warn: ['#FFFBF0', '#FFE082', '#8B6500'] }[kind];
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

  // Affiche l'étape 3 comme déjà vérifiée, avec la photo prise à l'étape 2.
  function markVerified(dataUrl, docType) {
    if (typeof stopCINScanner === 'function') { try { stopCINScanner(); } catch (e) {} }
    cinVerified = true;
    docImage1 = dataUrl;
    filesUploaded[0] = true;
    scannedNumber = norm(document.getElementById('docNumber').value);
    var show = { scanReady: 'none', scanActive: 'none', scanFallback: 'none', scanSuccess: 'block' };
    Object.keys(show).forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = show[id]; });
    var img = document.getElementById('cinCaptured');
    if (img) { img.src = dataUrl; img.style.display = 'block'; }
    var title = document.getElementById('scanSuccessTitle');
    if (title) title.textContent = tr(docType === 'cin' ? 'scan_valid_cin' : docType === 'passport' ? 'scan_valid_passport' : 'scan_valid_doc');
    var details = document.getElementById('scanSuccessDetails');
    if (details) details.innerHTML = esc(tr('scan_verified_line')) + '<br><span style="font-size:0.75rem;color:var(--mid);">' + esc(tr('idscan_step3')) + '</span>';
    if (typeof checkStep3 === 'function') checkStep3();
  }

  // Le voyageur change le numéro après le scan : l'étape 3 redemande un scan.
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

  function applyToForm(v) {
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
    var msg = esc(tr('idscan_ok'));
    if (!v.fromMrz) msg += '<br><span style="font-size:0.78rem;">' + esc(tr('idscan_ok_cin')) + '</span>';
    if (v.expiryIso) {
      msg += '<br><span style="font-size:0.78rem;">' + esc(tr('idscan_expiry', { d: v.expiry })) + '</span>';
      if (v.expiryIso < new Date().toISOString().slice(0, 10)) msg += '<br><strong>' + esc(tr('idscan_expired', { d: v.expiry })) + '</strong>';
    }
    setStatus('ok', msg);
  }

  function onFile(input) {
    var file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    var btn = document.getElementById('idScanBtn');
    if (btn) btn.disabled = true;
    setStatus('info', esc(tr('idscan_reading')));
    var photo;
    toJpeg(file).then(function (dataUrl) {
      photo = dataUrl;
      return verify(dataUrl);
    }).then(function (r) {
      if (!r || !r.readable || !r.verified || !r.detectedNum) { setStatus('warn', esc(tr(r && r.readable === false ? 'scan_unreadable' : 'idscan_fail'))); return; }
      var v = toFormValues(r);
      applyToForm(v);
      markVerified(photo, v.docType);
    }).catch(function (e) {
      console.warn('ID scan error:', e);
      setStatus('warn', esc(tr(e && e.code === 'limit' ? 'idscan_limit' : e && e.message === 'image' ? 'idscan_fail' : 'scan_network')));
    }).then(function () {
      if (btn) btn.disabled = false;
    });
  }

  function translate() {
    document.querySelectorAll('[data-idscan]').forEach(function (el) { el.textContent = tr(el.getAttribute('data-idscan')); });
  }

  function mount() {
    var page = document.getElementById('page2');
    if (!page || document.getElementById('idScanCard')) return;
    var style = document.createElement('style');
    style.textContent =
      '.id-scan-filled{background:#FFF8E1 !important;border-color:#C9A227 !important;}' +
      '#idScanCard{background:#fff;border:1.5px solid rgba(201,162,39,0.6);border-radius:14px;padding:1rem 1.1rem;margin-bottom:1.2rem;}' +
      '#idScanCard h3{font-size:0.95rem;font-weight:700;color:var(--deep,#16241E);margin:0 0 0.3rem;}' +
      '#idScanCard p{font-size:0.8rem;color:var(--light-mid,#5E6B65);line-height:1.55;margin:0 0 0.6rem;}' +
      '#idScanBtn{width:100%;background:var(--riad-green,#16241E);color:#fff;border:none;border-radius:10px;padding:0.75rem 1rem;font-family:Inter,sans-serif;font-size:0.9rem;font-weight:600;cursor:pointer;}' +
      '#idScanBtn:disabled{opacity:0.6;cursor:wait;}' +
      '#idScanStatus{display:none;margin-top:0.7rem;padding:0.7rem 0.9rem;border-radius:10px;font-size:0.8rem;line-height:1.5;}';
    document.head.appendChild(style);

    var card = document.createElement('div');
    card.id = 'idScanCard';
    card.innerHTML =
      '<h3 data-idscan="idscan_title"></h3>' +
      '<p data-idscan="idscan_sub"></p>' +
      '<input type="file" id="idScanInput" accept="image/*" style="display:none">' +
      '<button type="button" id="idScanBtn" data-idscan="idscan_btn"></button>' +
      '<p data-idscan="idscan_privacy" style="font-size:0.74rem;margin:0.6rem 0 0;"></p>' +
      '<div id="idScanStatus" role="status" aria-live="polite"></div>';
    var notice = document.getElementById('identityNotice');
    if (notice && notice.parentNode === page) page.insertBefore(card, notice.nextSibling);
    else page.insertBefore(card, page.querySelector('.card'));

    var input = card.querySelector('#idScanInput');
    card.querySelector('#idScanBtn').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { onFile(input); });
    translate();
    document.addEventListener('sf:langchange', translate);
    watchNumber();
  }

  window.StayformIdScan = { toFormValues: toFormValues, parseDate: parseDate };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
