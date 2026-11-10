// Stayform · Remplissage automatique du check-in à partir de la pièce d'identité.
//
// Le voyageur photographie la bande MRZ (les 2 ou 3 lignes « <<<< » en bas du
// passeport, ou au dos de la CNIE marocaine / d'une carte d'identité / d'un titre
// de séjour). La lecture se fait entièrement dans le navigateur avec Tesseract.js :
// la photo n'est envoyée à aucun serveur, seul le moteur OCR est téléchargé
// (une fois, puis mis en cache par le navigateur).
//
// Les données lues sont validées avec les chiffres de contrôle de la norme
// ICAO 9303, puis recopiées dans le formulaire « Vos coordonnées ». Le voyageur
// vérifie et peut tout corriger : le formulaire manuel reste la référence.
(function () {
  'use strict';

  // ── Moteur OCR (chargé seulement au premier scan) ─────────────────────────
  var TESS = {
    script: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
    langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',
  };
  var MRZ_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';

  // ══════════════════════════════════════════════════════════════════════════
  // 1. Lecture de la MRZ (pur JavaScript, sans DOM : testable isolément)
  // ══════════════════════════════════════════════════════════════════════════

  function charValue(c) {
    if (c === '<') return 0;
    if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
    if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55;
    return -1;
  }

  function checkDigit(str) {
    var w = [7, 3, 1], sum = 0;
    for (var i = 0; i < str.length; i++) {
      var v = charValue(str[i]);
      if (v < 0) return -1;
      sum += v * w[i % 3];
    }
    return sum % 10;
  }

  // Confusions classiques de l'OCR entre lettres et chiffres.
  var TO_DIGIT = { O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', T: '1', Z: '2', S: '5', G: '6', B: '8', '<': '0' };
  var TO_ALPHA = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '6': 'G', '8': 'B' };

  function digits(s) { return s.replace(/[^0-9]/g, function (c) { return TO_DIGIT[c] || c; }); }
  function alpha(s) { return s.replace(/[0-9]/g, function (c) { return TO_ALPHA[c] || c; }); }

  function cleanLine(raw) {
    return String(raw || '').toUpperCase()
      .replace(/[«‹≤]/g, '<')
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9<]/g, '');
  }

  function fit(line, len) {
    if (line.length > len) return line.slice(0, len);
    while (line.length < len) line += '<';
    return line;
  }

  // Corrige un champ dont on connaît le chiffre de contrôle : essaie d'abord
  // tel quel, puis en remplaçant un caractère ambigu (O/0, I/1, S/5, B/8...).
  function fixWithCheck(field, cd, numericOnly) {
    if (numericOnly) field = digits(field);
    var expected = parseInt(digits(cd), 10);
    if (checkDigit(field) === expected) return { value: field, ok: true };
    for (var i = 0; i < field.length; i++) {
      var c = field[i];
      var alts = [TO_DIGIT[c], TO_ALPHA[c]];
      if (c === '0') alts.push('D', 'Q');
      for (var a = 0; a < alts.length; a++) {
        if (!alts[a] || alts[a] === '<' && !numericOnly) continue;
        var cand = field.slice(0, i) + alts[a] + field.slice(i + 1);
        if (checkDigit(cand) === expected) return { value: cand, ok: true };
      }
    }
    return { value: field, ok: false };
  }

  function parseDate(yymmdd, kind) {
    if (!/^\d{6}$/.test(yymmdd)) return null;
    var yy = +yymmdd.slice(0, 2), mm = +yymmdd.slice(2, 4), dd = +yymmdd.slice(4, 6);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    var nowYY = new Date().getFullYear() % 100;
    var year = kind === 'birth' ? (yy > nowYY ? 1900 + yy : 2000 + yy) : (yy >= 70 ? 1900 + yy : 2000 + yy);
    var d = new Date(Date.UTC(year, mm - 1, dd));
    if (d.getUTCMonth() !== mm - 1) return null;
    return year + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
  }

  function cleanName(s) {
    return s.replace(/</g, ' ')
      .split(' ')
      .filter(function (w) { return w && !/^[KCL]{2,}$/.test(w); }) // « <<<< » mal lus en K/C/L
      .join(' ').trim();
  }

  function parseNames(field) {
    field = alpha(field);
    var sep = field.indexOf('<<');
    var surname = sep >= 0 ? field.slice(0, sep) : field;
    var given = sep >= 0 ? field.slice(sep + 2) : '';
    var end = given.indexOf('<<');
    if (end >= 0) given = given.slice(0, end);
    return { surname: cleanName(surname), givenNames: cleanName(given) };
  }

  function docKind(code, country) {
    if (code[0] === 'P') return 'passport';
    if (code[0] === 'A' || code === 'IR' || code === 'RP' || code[0] === 'R') return 'residence';
    return 'cin';
  }

  // Numéro à recopier : sur la CNIE marocaine, le numéro de CIN (ex. BE123456)
  // figure dans les données facultatives quand il diffère du numéro de carte.
  function pickNumber(docNumber, optional, country) {
    if (country === 'MAR') {
      var m = /^([A-Z0-9]{1,2})([0-9OQDISBZG]{3,7})$/.exec(optional.split('<')[0]);
      if (m) {
        var cin = alpha(m[1]) + digits(m[2]);
        if (/^[A-Z]{1,2}[0-9]{3,7}$/.test(cin) && cin !== docNumber) return cin;
      }
    }
    return docNumber;
  }

  function build(o) {
    var num = fixWithCheck(o.numField, o.numCd, false);
    var birth = fixWithCheck(o.birth, o.birthCd, true);
    var expiry = fixWithCheck(o.expiry, o.expiryCd, true);
    var names = parseNames(o.names);
    var country = alpha(o.country).replace(/</g, '');
    var nationality = alpha(o.nationality).replace(/</g, '');
    var code = alpha(o.code).replace(/</g, '');
    var docNumber = num.value.replace(/</g, '');
    var res = {
      format: o.format,
      docCode: code,
      docType: docKind(code, country),
      issuingCountry: country,
      docNumber: pickNumber(docNumber, o.optional || '', country),
      mrzDocNumber: docNumber,
      surname: names.surname,
      givenNames: names.givenNames,
      nationality: nationality,
      birthDate: parseDate(birth.value, 'birth'),
      expiryDate: parseDate(expiry.value, 'expiry'),
      sex: /[MF]/.test(o.sex) ? o.sex : '',
      checks: { number: num.ok, birth: birth.ok, expiry: expiry.ok },
    };
    var passed = (num.ok ? 1 : 0) + (birth.ok ? 1 : 0) + (expiry.ok ? 1 : 0);
    // Exige au moins 2 contrôles sur 3, une date de naissance et un nom.
    res.valid = passed >= 2 && !!res.birthDate && !!res.surname;
    res.score = passed;
    return res;
  }

  function parseTD3(l1, l2) {
    l1 = fit(l1, 44); l2 = fit(l2, 44);
    return build({
      format: 'TD3', code: l1.slice(0, 2), country: l1.slice(2, 5), names: l1.slice(5, 44),
      numField: l2.slice(0, 9), numCd: l2[9], nationality: l2.slice(10, 13),
      birth: l2.slice(13, 19), birthCd: l2[19], sex: l2[20], expiry: l2.slice(21, 27), expiryCd: l2[27],
      optional: l2.slice(28, 42),
    });
  }

  function parseTD2(l1, l2) {
    l1 = fit(l1, 36); l2 = fit(l2, 36);
    return build({
      format: 'TD2', code: l1.slice(0, 2), country: l1.slice(2, 5), names: l1.slice(5, 36),
      numField: l2.slice(0, 9), numCd: l2[9], nationality: l2.slice(10, 13),
      birth: l2.slice(13, 19), birthCd: l2[19], sex: l2[20], expiry: l2.slice(21, 27), expiryCd: l2[27],
      optional: l2.slice(28, 35),
    });
  }

  function parseTD1(l1, l2, l3) {
    l1 = fit(l1, 30); l2 = fit(l2, 30); l3 = fit(l3, 30);
    return build({
      format: 'TD1', code: l1.slice(0, 2), country: l1.slice(2, 5),
      numField: l1.slice(5, 14), numCd: l1[14], optional: l1.slice(15, 30),
      birth: l2.slice(0, 6), birthCd: l2[6], sex: l2[7], expiry: l2.slice(8, 14), expiryCd: l2[14],
      nationality: l2.slice(15, 18), names: l3,
    });
  }

  // Cherche la MRZ dans le texte brut renvoyé par l'OCR et garde la meilleure lecture.
  function parseMRZ(text) {
    var lines = String(text || '').split(/\r?\n/).map(cleanLine).filter(function (l) { return l.length >= 26; });
    var best = null;
    function consider(r) { if (r && (!best || r.score > best.score)) best = r; }
    for (var i = 0; i < lines.length; i++) {
      var a = lines[i], b = lines[i + 1], c = lines[i + 2];
      if (b && a.length >= 40 && b.length >= 40 && /^[P]/.test(a)) consider(parseTD3(a, b));
      if (b && a.length >= 33 && a.length <= 39 && b.length >= 33 && b.length <= 39 && /^[IACP]/.test(a)) consider(parseTD2(a, b));
      if (b && c && a.length <= 33 && b.length <= 33 && c.length <= 33 && /^[IAC]/.test(a)) consider(parseTD1(a, b, c));
    }
    // Lignes de passeport sans « P » lisible en tête : tente quand même les paires longues.
    if (!best || !best.valid) {
      for (var j = 0; j + 1 < lines.length; j++) {
        if (lines[j].length >= 40 && lines[j + 1].length >= 40) consider(parseTD3('P' + lines[j].slice(1), lines[j + 1]));
      }
    }
    if (best && best.valid) return best;
    // Carte d'identité dont la 1re ligne est illisible : les lignes 2 et 3 donnent
    // quand même nom, prénom, date de naissance et nationalité (sans le numéro).
    for (var k = 0; k + 1 < lines.length; k++) {
      var l2 = lines[k], l3 = lines[k + 1];
      if (l2.length < 26 || l2.length > 33 || l3.length > 33 || !/^[0-9OQDISBZG]{7}[MF<]/.test(l2)) continue;
      var part = parseTD1('I<' + 'XXX' + '<<<<<<<<<<<<<<<<<<<<<<<<<', l2, l3);
      if (part.checks.birth && part.checks.expiry && part.birthDate && part.surname) {
        part.docNumber = ''; part.mrzDocNumber = ''; part.issuingCountry = part.nationality; part.partial = true;
        part.valid = true;
        return part;
      }
    }
    return null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. Conversion vers les champs du formulaire
  // ══════════════════════════════════════════════════════════════════════════

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

  function nationalityLabel(code, lang) {
    var n = NATIONALITIES[code];
    if (!n) return code;
    return lang === 'en' ? n[1] : n[0];
  }

  function titleCase(s) {
    return s.toLowerCase().replace(/(^|[\s'-])([a-zà-ÿ])/g, function (m, p, c) { return p + c.toUpperCase(); });
  }

  function isoToFr(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function toFormValues(r, lang) {
    return {
      docNumber: r.docNumber,
      docType: r.docType,
      firstName: titleCase(r.givenNames),
      lastName: titleCase(r.surname),
      nationality: nationalityLabel(r.nationality, lang),
      birthdate: isoToFr(r.birthDate),
      expiry: isoToFr(r.expiryDate),
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. OCR dans le navigateur
  // ══════════════════════════════════════════════════════════════════════════

  var workerPromise = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.Tesseract) return resolve();
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('ocr-load')); };
      document.head.appendChild(s);
    });
  }

  function getWorker(onProgress) {
    if (!workerPromise) {
      workerPromise = loadScript(TESS.script).then(function () {
        return window.Tesseract.createWorker('eng', 1, {
          workerPath: TESS.workerPath, corePath: TESS.corePath, langPath: TESS.langPath,
          logger: function (m) { if (onProgress && m && m.status) onProgress(m); },
        });
      }).then(function (w) {
        return w.setParameters({ tessedit_char_whitelist: MRZ_CHARS, tessedit_pageseg_mode: '6' }).then(function () { return w; });
      });
      workerPromise.catch(function () { workerPromise = null; });
    }
    return workerPromise;
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }

  // Prépare une version de la photo : recadrage (part du bas), rotation, gris + contraste.
  function prepare(img, opts) {
    var sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
    var rot = opts.rotate || 0;
    var rw = rot % 180 ? sh : sw, rh = rot % 180 ? sw : sh;   // dimensions après rotation
    var cropTop = Math.round(rh * (opts.from || 0));
    var outW0 = rw, outH0 = rh - cropTop;
    var scale = Math.min(1, 2000 / outW0);
    if (outW0 < 1200) scale = 1200 / outW0;
    var c = document.createElement('canvas');
    c.width = Math.round(outW0 * scale); c.height = Math.round(outH0 * scale);
    var ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    ctx.translate(0, -cropTop);
    ctx.translate(rw / 2, rh / 2);
    ctx.rotate(rot * Math.PI / 180);
    ctx.drawImage(img, -sw / 2, -sh / 2);
    var data = ctx.getImageData(0, 0, c.width, c.height), px = data.data;
    var min = 255, max = 0, i, g;
    for (i = 0; i < px.length; i += 4) {
      g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      px[i] = g; if (g < min) min = g; if (g > max) max = g;
    }
    var range = Math.max(1, max - min);
    for (i = 0; i < px.length; i += 4) {
      g = (px[i] - min) * 255 / range;
      px[i] = px[i + 1] = px[i + 2] = g;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(data, 0, 0);
    return c;
  }

  // Plusieurs passes, de la plus probable à la moins probable ; s'arrête dès qu'une MRZ valide est lue.
  var PASSES = [
    { from: 0.5 }, { from: 0 }, { rotate: 90, from: 0.4 }, { rotate: 270, from: 0.4 }, { rotate: 180, from: 0.5 },
  ];

  function scanFile(file, onStatus) {
    return Promise.all([loadImage(file), getWorker(function (m) {
      if (m.status.indexOf('loading') === 0 && onStatus) onStatus('loading');
    })]).then(function (res) {
      var img = res[0], worker = res[1];
      api.lastText = [];
      var k = 0;
      function next() {
        if (k >= PASSES.length) return null;
        var pass = PASSES[k++];
        if (onStatus) onStatus('reading', k, PASSES.length);
        return worker.recognize(prepare(img, pass)).then(function (out) {
          var text = out && out.data ? out.data.text : '';
          api.lastText.push(text);
          var r = parseMRZ(text);
          return r || next();
        });
      }
      return next();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. Interface (étape 2 « Vos coordonnées »)
  // ══════════════════════════════════════════════════════════════════════════

  var TXT = {
    fr: {
      title: 'Remplir automatiquement avec votre pièce d\'identité',
      sub: 'Prenez en photo la page de votre passeport, ou le dos de votre CIN / titre de séjour, avec les lignes <<< bien visibles.',
      privacy: '🔒 La photo reste sur votre téléphone : elle est lue sur place et n\'est envoyée nulle part.',
      btn: '📷 Scanner ma pièce d\'identité',
      loading: '⏳ Préparation du lecteur (quelques secondes la première fois)…',
      reading: '🔍 Lecture du document…',
      ok: '✅ Document lu. Vérifiez les champs surlignés et corrigez-les si besoin.',
      expiry: 'Valide jusqu\'au',
      expired: '⚠️ Ce document semble expiré (date d\'expiration : {d}).',
      fail: '⚠️ Lecture impossible. Reprenez la photo bien à plat, sans reflet, avec les lignes <<< entières et nettes, ou remplissez le formulaire à la main.',
      offline: '⚠️ Le lecteur n\'a pas pu être chargé (connexion ?). Vous pouvez remplir le formulaire à la main.',
      partial: 'Le numéro du document n\'a pas pu être lu : saisissez-le à la main.',
    },
    en: {
      title: 'Fill in automatically with your ID',
      sub: 'Take a photo of your passport photo page, or the back of your ID card / residence permit, with the <<< lines clearly visible.',
      privacy: '🔒 The photo stays on your phone: it is read on the device and never sent anywhere.',
      btn: '📷 Scan my ID document',
      loading: '⏳ Preparing the reader (a few seconds the first time)…',
      reading: '🔍 Reading the document…',
      ok: '✅ Document read. Please check the highlighted fields and correct them if needed.',
      expiry: 'Valid until',
      expired: '⚠️ This document looks expired (expiry date: {d}).',
      fail: '⚠️ Could not read it. Retake the photo flat, without glare, with the full <<< lines sharp, or fill in the form by hand.',
      offline: '⚠️ The reader could not be loaded (connection?). You can fill in the form by hand.',
      partial: 'The document number could not be read: please type it in.',
    },
    ar: {
      title: 'املأ البيانات تلقائياً من وثيقة هويتك',
      sub: 'التقط صورة لصفحة جواز السفر أو لظهر بطاقة التعريف / بطاقة الإقامة، مع ظهور أسطر <<< بوضوح.',
      privacy: '🔒 تبقى الصورة على هاتفك: تُقرأ على الجهاز ولا تُرسل إلى أي مكان.',
      btn: '📷 مسح وثيقة الهوية',
      loading: '⏳ جارٍ تحضير القارئ (بضع ثوانٍ في المرة الأولى)…',
      reading: '🔍 جارٍ قراءة الوثيقة…',
      ok: '✅ تمت قراءة الوثيقة. تحقق من الحقول المظللة وصححها عند الحاجة.',
      expiry: 'صالحة حتى',
      expired: '⚠️ يبدو أن هذه الوثيقة منتهية الصلاحية (تاريخ الانتهاء: {d}).',
      fail: '⚠️ تعذرت القراءة. أعد التقاط الصورة بشكل مستوٍ ودون انعكاس، مع ظهور أسطر <<< كاملة، أو املأ النموذج يدوياً.',
      offline: '⚠️ تعذر تحميل القارئ (الاتصال؟). يمكنك ملء النموذج يدوياً.',
      partial: 'تعذرت قراءة رقم الوثيقة: يرجى إدخاله يدوياً.',
    },
  };
  function tr(k) { var l = window._lang || 'fr'; return (TXT[l] && TXT[l][k]) || TXT.fr[k]; }

  var FIELD_IDS = ['docNumber', 'firstName', 'lastName', 'nationality', 'birthdate'];

  function setStatus(kind, html) {
    var el = document.getElementById('idScanStatus');
    if (!el) return;
    var styles = {
      info: ['#F7F7F7', '#EBEBEB', '#4A4A4A'],
      ok: ['#F0FFF4', 'rgba(0,138,5,0.3)', '#0A6B1F'],
      warn: ['#FFFBF0', '#FFE082', '#8B6500'],
    }[kind] || ['#F7F7F7', '#EBEBEB', '#4A4A4A'];
    el.style.display = 'block';
    el.style.background = styles[0]; el.style.border = '1px solid ' + styles[1]; el.style.color = styles[2];
    el.innerHTML = html;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function highlight(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.add('id-scan-filled');
    el.addEventListener('input', function onIn() { el.classList.remove('id-scan-filled'); el.removeEventListener('input', onIn); });
  }

  function applyToForm(r) {
    var v = toFormValues(r, window._lang || 'fr');
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
    window.sfScannedDocument = { values: v, mrz: r };

    var msg = tr('ok');
    if (r.partial) msg += '<br><strong>' + esc(tr('partial')) + '</strong>';
    if (r.expiryDate) {
      var expired = r.expiryDate < new Date().toISOString().slice(0, 10);
      msg += '<br><span style="font-size:0.78rem;">' + esc(tr('expiry')) + ' ' + esc(v.expiry) + '</span>';
      if (expired) msg += '<br><strong>' + esc(tr('expired').replace('{d}', v.expiry)) + '</strong>';
    }
    setStatus('ok', msg);
  }

  function onFile(input) {
    var file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    var btn = document.getElementById('idScanBtn');
    if (btn) btn.disabled = true;
    setStatus('info', esc(tr('loading')));
    scanFile(file, function (stage, k, n) {
      setStatus('info', esc(stage === 'loading' ? tr('loading') : tr('reading')) + (k > 1 ? ' (' + k + '/' + n + ')' : ''));
    }).then(function (r) {
      if (r) applyToForm(r);
      else setStatus('warn', esc(tr('fail')));
    }).catch(function (e) {
      console.warn('ID scan error:', e);
      setStatus('warn', esc(e && e.message === 'ocr-load' ? tr('offline') : tr('fail')));
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = tr('btn'); }
    });
  }

  function mount() {
    var page = document.getElementById('page2');
    var notice = document.getElementById('identityNotice');
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
      '<h3 data-idscan="title"></h3>' +
      '<p data-idscan="sub"></p>' +
      '<input type="file" id="idScanInput" accept="image/*" style="display:none">' +
      '<button type="button" id="idScanBtn" data-idscan="btn"></button>' +
      '<p data-idscan="privacy" style="font-size:0.74rem;margin:0.6rem 0 0;"></p>' +
      '<div id="idScanStatus" role="status" aria-live="polite"></div>';
    if (notice && notice.parentNode === page) page.insertBefore(card, notice.nextSibling);
    else page.insertBefore(card, page.querySelector('.card'));

    var input = card.querySelector('#idScanInput');
    card.querySelector('#idScanBtn').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { onFile(input); });
    translate();

    document.querySelectorAll('.lang-btn').forEach(function (b) { b.addEventListener('click', function () { setTimeout(translate, 0); }); });
  }

  function translate() {
    document.querySelectorAll('[data-idscan]').forEach(function (el) { el.textContent = tr(el.getAttribute('data-idscan')); });
  }

  var api = window.StayformIdScan = { lastText: [],  parseMRZ: parseMRZ, checkDigit: checkDigit, toFormValues: toFormValues, applyToForm: applyToForm, scanFile: scanFile, TESS: TESS };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
