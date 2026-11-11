// ══════════════════════════════════════════════════════════
// Stayform · traductions du check-in voyageur (FR / EN / ES / AR)
//
// Chargé dans le <head> de checkin.html, avant le script principal :
//   - choisit la langue : ?lang=xx, puis le dernier choix du voyageur,
//     puis la langue du navigateur, sinon le français ;
//   - expose t(clé, {variables}), tn(clé, nombre) et setLang(langue) ;
//   - traduit les éléments marqués data-i18n (texte), data-i18n-html
//     (HTML statique de ce fichier) et data-i18n-placeholder ;
//   - envoie l'événement « sf:langchange » quand la langue change.
//
// Les données enregistrées (dates, voyageurs, heure d'arrivée) et le
// contrat PDF restent en français : ils sont lus par l'hôte et les autorités.
// ══════════════════════════════════════════════════════════
(function () {
  var LANGS = ['fr', 'en', 'es', 'ar'];
  var PDF_LANGS = ['fr', 'en', 'es'];
  var LOCALES = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', ar: 'ar-MA' };

  var STR = {
    // ── Général ───────────────────────────────────────────
    page_title: { fr: "Check-in · Votre Séjour", en: "Check-in · Your stay", es: "Check-in · Tu estancia", ar: "تسجيل الوصول · إقامتك" },
    hdr_title: { fr: "Check-in en ligne", en: "Online check-in", es: "Check-in online", ar: "تسجيل الوصول الإلكتروني" },
    hdr_welcome: { fr: "Bienvenue dans votre logement", en: "Welcome to your stay", es: "Bienvenido a tu alojamiento", ar: "مرحباً بك في مسكنك" },
    hdr_host_home: { fr: "Logement de {name}", en: "{name}'s place", es: "Alojamiento de {name}", ar: "مسكن {name}" },
    lang_switch: { fr: "Langue", en: "Language", es: "Idioma", ar: "اللغة" },
    step1: { fr: "Séjour", en: "Stay", es: "Estancia", ar: "الإقامة" },
    step2: { fr: "Identité", en: "Identity", es: "Identidad", ar: "الهوية" },
    step3: { fr: "Documents", en: "Documents", es: "Documentos", ar: "الوثائق" },
    step4: { fr: "Contrat", en: "Contract", es: "Contrato", ar: "العقد" },
    btn_next: { fr: "Continuer →", en: "Continue →", es: "Continuar →", ar: "متابعة ←" },
    btn_back: { fr: "← Retour", en: "← Back", es: "← Volver", ar: "→ رجوع" },
    required: { fr: "(obligatoire)", en: "(required)", es: "(obligatorio)", ar: "(إلزامي)" },
    optional: { fr: "(optionnel)", en: "(optional)", es: "(opcional)", ar: "(اختياري)" },
    cancel: { fr: "← Annuler", en: "← Cancel", es: "← Cancelar", ar: "→ إلغاء" },

    // ── Étape 1 : séjour ──────────────────────────────────
    t_sejour: { fr: "Votre séjour", en: "Your stay", es: "Tu estancia", ar: "إقامتك" },
    t_sejour_sub: { fr: "Sélectionnez les dates de votre location sur le calendrier ci-dessous.", en: "Select your rental dates on the calendar below.", es: "Selecciona las fechas de tu estancia en el calendario.", ar: "اختر تواريخ إقامتك من التقويم أدناه." },
    t_sejour_prefilled: { fr: "Les dates de votre séjour ont été pré-remplies par votre hôte.", en: "Your host has already filled in your stay dates.", es: "Tu anfitrión ya ha indicado las fechas de tu estancia.", ar: "قام مضيفك بتحديد تواريخ إقامتك مسبقاً." },
    cal_days: { fr: "Lu,Ma,Me,Je,Ve,Sa,Di", en: "Mo,Tu,We,Th,Fr,Sa,Su", es: "Lu,Ma,Mi,Ju,Vi,Sá,Do", ar: "ن,ث,ر,خ,ج,س,ح" },
    cal_months: {
      fr: "Janvier,Février,Mars,Avril,Mai,Juin,Juillet,Août,Septembre,Octobre,Novembre,Décembre",
      en: "January,February,March,April,May,June,July,August,September,October,November,December",
      es: "Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre",
      ar: "يناير,فبراير,مارس,أبريل,مايو,يونيو,يوليو,أغسطس,سبتمبر,أكتوبر,نوفمبر,ديسمبر"
    },
    cal_prev: { fr: "Mois précédent", en: "Previous month", es: "Mes anterior", ar: "الشهر السابق" },
    cal_next: { fr: "Mois suivant", en: "Next month", es: "Mes siguiente", ar: "الشهر التالي" },
    date_arrival: { fr: "Arrivée", en: "Arrival", es: "Llegada", ar: "الوصول" },
    date_departure: { fr: "Départ", en: "Departure", es: "Salida", ar: "المغادرة" },
    nights_one: { fr: "{n} nuit", en: "{n} night", es: "{n} noche", ar: "ليلة واحدة" },
    nights_two: { ar: "ليلتان" },
    nights_few: { ar: "{n} ليالٍ" },
    nights_other: { fr: "{n} nuits", en: "{n} nights", es: "{n} noches", ar: "{n} ليلة" },
    dates_prefilled: { fr: "Dates pré-remplies", en: "Dates filled in by your host", es: "Fechas indicadas por tu anfitrión", ar: "تواريخ محددة من المضيف" },
    lbl_arrival: { fr: "Heure d'arrivée prévue", en: "Expected arrival time", es: "Hora de llegada prevista", ar: "وقت الوصول المتوقع" },
    opt_select: { fr: "Sélectionner", en: "Select", es: "Seleccionar", ar: "اختر" },
    arr_before12: { fr: "Avant 12h00", en: "Before 12:00", es: "Antes de las 12:00", ar: "قبل 12:00" },
    arr_12_14: { fr: "12h00 – 14h00", en: "12:00 – 14:00", es: "12:00 – 14:00", ar: "12:00 – 14:00" },
    arr_14_16: { fr: "14h00 – 16h00", en: "14:00 – 16:00", es: "14:00 – 16:00", ar: "14:00 – 16:00" },
    arr_16_18: { fr: "16h00 – 18h00", en: "16:00 – 18:00", es: "16:00 – 18:00", ar: "16:00 – 18:00" },
    arr_18_20: { fr: "18h00 – 20h00", en: "18:00 – 20:00", es: "18:00 – 20:00", ar: "18:00 – 20:00" },
    arr_after20: { fr: "Après 20h00", en: "After 20:00", es: "Después de las 20:00", ar: "بعد 20:00" },
    lbl_adults: { fr: "Adultes", en: "Adults", es: "Adultos", ar: "البالغون" },
    lbl_adults_hint: { fr: "(18 ans et plus)", en: "(18 and over)", es: "(18 años o más)", ar: "(18 سنة فما فوق)" },
    lbl_children: { fr: "Enfants", en: "Children", es: "Niños", ar: "الأطفال" },
    lbl_children_hint: { fr: "(moins de 18 ans)", en: "(under 18)", es: "(menores de 18 años)", ar: "(أقل من 18 سنة)" },
    child_n: { fr: "Enfant {n} :", en: "Child {n}:", es: "Niño {n}:", ar: "الطفل {n}:" },
    age_ph: { fr: "Âge", en: "Age", es: "Edad", ar: "العمر" },
    adults_one: { fr: "{n} adulte", en: "{n} adult", es: "{n} adulto", ar: "بالغ واحد" },
    adults_two: { ar: "بالغان" },
    adults_few: { ar: "{n} بالغين" },
    adults_other: { fr: "{n} adultes", en: "{n} adults", es: "{n} adultos", ar: "{n} بالغاً" },
    children_one: { fr: "{n} enfant", en: "{n} child", es: "{n} niño", ar: "طفل واحد" },
    children_two: { ar: "طفلان" },
    children_few: { ar: "{n} أطفال" },
    children_other: { fr: "{n} enfants", en: "{n} children", es: "{n} niños", ar: "{n} طفلاً" },
    err_arrival: { fr: "Veuillez sélectionner votre date d'arrivée.", en: "Please select your arrival date.", es: "Selecciona tu fecha de llegada.", ar: "يرجى اختيار تاريخ الوصول." },
    err_departure: { fr: "Veuillez sélectionner votre date de départ.", en: "Please select your departure date.", es: "Selecciona tu fecha de salida.", ar: "يرجى اختيار تاريخ المغادرة." },
    hint_btn1: { fr: "Choisissez vos dates d'arrivée et de départ pour continuer.", en: "Pick your arrival and departure dates to continue.", es: "Elige tus fechas de llegada y salida para continuar.", ar: "اختر تاريخي الوصول والمغادرة للمتابعة." },

    // ── Étape 2 : identité ────────────────────────────────
    t_coords: { fr: "Vos coordonnées", en: "Your details", es: "Tus datos", ar: "بياناتك الشخصية" },
    t_coords_sub: { fr: "Informations du voyageur principal de la réservation.", en: "Details of the main guest on the booking.", es: "Datos del viajero principal de la reserva.", ar: "معلومات المسافر الرئيسي في الحجز." },
    identity_notice: {
      fr: "<strong>Saisissez vos informations exactement comme sur votre CIN ou passeport.</strong> Ces données seront vérifiées à l'étape suivante par scan de votre document.",
      en: "<strong>Enter your details exactly as they appear on your ID card or passport.</strong> They will be checked at the next step when you scan your document.",
      es: "<strong>Introduce tus datos tal como aparecen en tu documento de identidad o pasaporte.</strong> Se comprobarán en el siguiente paso al escanear tu documento.",
      ar: "<strong>أدخل معلوماتك تماماً كما تظهر في بطاقتك الوطنية أو جواز سفرك.</strong> سيتم التحقق منها في الخطوة التالية عند مسح وثيقتك."
    },
    lbl_docnum: { fr: "N° CIN / Passeport", en: "ID card / Passport number", es: "N.º de documento / Pasaporte", ar: "رقم البطاقة الوطنية / جواز السفر" },
    lbl_doctype: { fr: "Type de document", en: "Document type", es: "Tipo de documento", ar: "نوع الوثيقة" },
    lbl_type: { fr: "Type", en: "Type", es: "Tipo", ar: "النوع" },
    doc_cin: { fr: "CIN", en: "ID card", es: "Documento de identidad", ar: "البطاقة الوطنية" },
    doc_cin_long: { fr: "Carte d'identité nationale (CIN)", en: "National ID card", es: "Documento de identidad", ar: "البطاقة الوطنية للتعريف" },
    doc_passport: { fr: "Passeport", en: "Passport", es: "Pasaporte", ar: "جواز السفر" },
    doc_residence: { fr: "Titre de séjour", en: "Residence permit", es: "Permiso de residencia", ar: "بطاقة الإقامة" },
    lbl_firstname: { fr: "Prénom", en: "First name", es: "Nombre", ar: "الاسم الشخصي" },
    lbl_lastname: { fr: "Nom de famille", en: "Last name", es: "Apellidos", ar: "الاسم العائلي" },
    lbl_email: { fr: "Adresse e-mail", en: "Email address", es: "Correo electrónico", ar: "البريد الإلكتروني" },
    lbl_phone: { fr: "Téléphone", en: "Phone", es: "Teléfono", ar: "الهاتف" },
    lbl_nationality: { fr: "Nationalité", en: "Nationality", es: "Nacionalidad", ar: "الجنسية" },
    lbl_birthdate: { fr: "Date de naissance", en: "Date of birth", es: "Fecha de nacimiento", ar: "تاريخ الازدياد" },
    lbl_address: { fr: "Adresse de résidence", en: "Home address", es: "Dirección de residencia", ar: "عنوان السكن" },
    ph_nationality: { fr: "Française", en: "British", es: "Española", ar: "مغربية" },
    ph_birthdate: { fr: "JJ/MM/AAAA", en: "DD/MM/YYYY", es: "DD/MM/AAAA", ar: "DD/MM/YYYY" },
    ph_address: { fr: "12 rue de la Paix, Paris", en: "12 High Street, London", es: "Calle Mayor 12, Madrid", ar: "12 شارع محمد الخامس، الرباط" },
    companions_title: { fr: "👥 Accompagnants adultes", en: "👥 Other adults", es: "👥 Otros adultos", ar: "👥 المرافقون البالغون" },
    adult_n: { fr: "Adulte {n}", en: "Adult {n}", es: "Adulto {n}", ar: "البالغ {n}" },
    err_docnum: { fr: "Veuillez saisir votre numéro de CIN ou passeport.", en: "Please enter your ID card or passport number.", es: "Introduce tu número de documento o pasaporte.", ar: "يرجى إدخال رقم بطاقتك الوطنية أو جواز سفرك." },
    err_required: { fr: "Veuillez remplir au moins votre prénom et votre nom.", en: "Please fill in at least your first name and last name.", es: "Rellena al menos tu nombre y apellidos.", ar: "يرجى ملء الاسم الشخصي والاسم العائلي على الأقل." },

    // ── Étape 3 : pièce d'identité ────────────────────────
    t_verify: { fr: "Vérification d'identité", en: "Identity check", es: "Verificación de identidad", ar: "التحقق من الهوية" },
    t_verify_sub: { fr: "Scannez le recto de votre CIN avec la caméra. La vérification est automatique.", en: "Scan the front of your ID document with the camera. The check is automatic.", es: "Escanea el anverso de tu documento con la cámara. La verificación es automática.", ar: "امسح الوجه الأمامي لوثيقتك بالكاميرا. التحقق يتم تلقائياً." },
    privacy_box: {
      fr: "<strong>Vos données sont protégées</strong><br>Votre CIN est utilisée <u>uniquement</u> pour vérifier votre identité. Elle apparaît dans votre contrat PDF uniquement — <strong>non stockée</strong> sur nos serveurs.",
      en: "<strong>Your data is protected</strong><br>Your ID is used <u>only</u> to verify your identity. It only appears in your PDF contract and is <strong>not stored</strong> on our servers.",
      es: "<strong>Tus datos están protegidos</strong><br>Tu documento se usa <u>solo</u> para verificar tu identidad. Solo aparece en tu contrato PDF y <strong>no se guarda</strong> en nuestros servidores.",
      ar: "<strong>بياناتك محمية</strong><br>تُستخدم وثيقتك <u>فقط</u> للتحقق من هويتك. تظهر في عقدك بصيغة PDF فقط و<strong>لا تُحفظ</strong> على خوادمنا."
    },
    scan_title: { fr: "Scanner votre CIN", en: "Scan your ID", es: "Escanea tu documento", ar: "امسح وثيقة هويتك" },
    scan_help: { fr: "Placez le recto de votre carte devant la caméra.<br>La détection est automatique.", en: "Hold the front of your card in front of the camera.<br>It is detected automatically.", es: "Coloca el anverso de tu documento delante de la cámara.<br>La detección es automática.", ar: "ضع الوجه الأمامي لبطاقتك أمام الكاميرا.<br>يتم الكشف تلقائياً." },
    scan_open: { fr: "📸 Ouvrir la caméra", en: "📸 Open camera", es: "📸 Abrir la cámara", ar: "📸 فتح الكاميرا" },
    scan_gallery: { fr: "Utiliser une photo depuis la galerie", en: "Use a photo from your gallery", es: "Usar una foto de la galería", ar: "استخدام صورة من المعرض" },
    scan_guide: { fr: "Placez la CIN — numéro visible", en: "Place your ID — number visible", es: "Coloca tu documento — número visible", ar: "ضع البطاقة — مع ظهور الرقم" },
    scan_running: { fr: "🔍 Scan en cours...", en: "🔍 Scanning...", es: "🔍 Escaneando...", ar: "🔍 جارٍ المسح..." },
    scan_adjust: { fr: "⏱ Ajustez la carte... {n}s", en: "⏱ Line up your card... {n}s", es: "⏱ Ajusta el documento... {n}s", ar: "⏱ اضبط البطاقة... {n} ث" },
    scan_analyzing: { fr: "🔍 Analyse Google Vision...", en: "🔍 Analysing...", es: "🔍 Analizando...", ar: "🔍 جارٍ التحليل..." },
    scan_hold: { fr: "📷 Maintenez la carte stable...", en: "📷 Hold the card steady...", es: "📷 Mantén el documento quieto...", ar: "📷 أبقِ البطاقة ثابتة..." },
    scan_cancel: { fr: "✕ Annuler", en: "✕ Cancel", es: "✕ Cancelar", ar: "✕ إلغاء" },
    scan_unreadable: { fr: "📷 Document illisible — prenez une photo plus nette et bien éclairée", en: "📷 Document unreadable — take a sharper, well-lit photo", es: "📷 Documento ilegible — haz una foto más nítida y con buena luz", ar: "📷 الوثيقة غير مقروءة — التقط صورة أوضح وبإضاءة جيدة" },
    scan_not_recognized: { fr: "⚠️ Document non reconnu — repositionnez votre carte et réessayez", en: "⚠️ Document not recognised — reposition your card and try again", es: "⚠️ Documento no reconocido — vuelve a colocarlo e inténtalo de nuevo", ar: "⚠️ لم يتم التعرف على الوثيقة — أعد وضع البطاقة وحاول مجدداً" },
    scan_network: { fr: "⚠️ Erreur réseau — réessayez", en: "⚠️ Network error — please try again", es: "⚠️ Error de red — inténtalo de nuevo", ar: "⚠️ خطأ في الشبكة — حاول مجدداً" },
    scan_valid_cin: { fr: "Carte valide — Identité vérifiée", en: "Valid card — Identity verified", es: "Documento válido — Identidad verificada", ar: "بطاقة صالحة — تم التحقق من الهوية" },
    scan_valid_passport: { fr: "Passeport valide — Identité vérifiée", en: "Valid passport — Identity verified", es: "Pasaporte válido — Identidad verificada", ar: "جواز سفر صالح — تم التحقق من الهوية" },
    scan_valid_doc: { fr: "Document valide — Identité vérifiée", en: "Valid document — Identity verified", es: "Documento válido — Identidad verificada", ar: "وثيقة صالحة — تم التحقق من الهوية" },
    scan_verified_line: { fr: "🛡️ Identité vérifiée · Document authentique", en: "🛡️ Identity verified · Genuine document", es: "🛡️ Identidad verificada · Documento auténtico", ar: "🛡️ تم التحقق من الهوية · وثيقة أصلية" },
    scan_saved_line: { fr: "Numéro enregistré de manière sécurisée", en: "Number saved securely", es: "Número guardado de forma segura", ar: "تم حفظ الرقم بشكل آمن" },
    scan_rescan: { fr: "🔄 Rescanner", en: "🔄 Scan again", es: "🔄 Volver a escanear", ar: "🔄 إعادة المسح" },
    scan_hard_title: { fr: "Scan automatique difficile", en: "Automatic scan is struggling", es: "El escaneo automático no lo consigue", ar: "تعذّر المسح التلقائي" },
    scan_hard_text: { fr: "Essayez avec une meilleure lumière, ou importez une photo depuis votre galerie.", en: "Try with better light, or upload a photo from your gallery.", es: "Prueba con mejor luz o sube una foto de tu galería.", ar: "حاول بإضاءة أفضل، أو ارفع صورة من معرض الصور." },
    scan_no_camera: { fr: "Caméra non disponible. Importez une photo depuis la galerie.", en: "Camera not available. Upload a photo from your gallery.", es: "Cámara no disponible. Sube una foto de tu galería.", ar: "الكاميرا غير متاحة. ارفع صورة من معرض الصور." },
    scan_ocr_running: { fr: "🔍 Analyse Google Vision en cours...", en: "🔍 Analysing your document...", es: "🔍 Analizando tu documento...", ar: "🔍 جارٍ تحليل وثيقتك..." },
    scan_retry_camera: { fr: "↩ Réessayer avec la caméra", en: "↩ Try the camera again", es: "↩ Reintentar con la cámara", ar: "↩ إعادة المحاولة بالكاميرا" },
    gallery_title: { fr: "Photo depuis la galerie", en: "Photo from your gallery", es: "Foto de la galería", ar: "صورة من المعرض" },
    gallery_sub: { fr: "Choisissez une photo nette de votre CIN", en: "Choose a sharp photo of your ID", es: "Elige una foto nítida de tu documento", ar: "اختر صورة واضحة لوثيقتك" },
    gallery_btn: { fr: "📁 Choisir une photo", en: "📁 Choose a photo", es: "📁 Elegir una foto", ar: "📁 اختيار صورة" },
    file_remove: { fr: "✕ Supprimer", en: "✕ Remove", es: "✕ Eliminar", ar: "✕ حذف" },
    selfie_label: { fr: "Selfie", en: "Selfie", es: "Selfie", ar: "صورة شخصية" },
    selfie_title: { fr: "Photo de vous", en: "A photo of you", es: "Una foto tuya", ar: "صورتك" },
    selfie_sub: { fr: "Prenez un selfie ou choisissez une photo", en: "Take a selfie or choose a photo", es: "Hazte un selfie o elige una foto", ar: "التقط صورة شخصية أو اختر صورة" },
    selfie_btn: { fr: "📷 Prendre / Choisir", en: "📷 Take / Choose", es: "📷 Hacer / Elegir", ar: "📷 التقاط / اختيار" },
    check4: {
      fr: "🛡️ Je consens à l'utilisation de ma pièce d'identité <strong>uniquement</strong> à des fins de vérification d'identité pour cette location. Elle sera incluse dans mon contrat PDF uniquement et <strong>non stockée</strong> sur les serveurs de Stayform.",
      en: "🛡️ I agree that my ID document is used <strong>only</strong> to verify my identity for this rental. It will only be included in my PDF contract and <strong>not stored</strong> on Stayform's servers.",
      es: "🛡️ Acepto que mi documento de identidad se use <strong>solo</strong> para verificar mi identidad en este alquiler. Solo se incluirá en mi contrato PDF y <strong>no se guardará</strong> en los servidores de Stayform.",
      ar: "🛡️ أوافق على استخدام وثيقة هويتي <strong>فقط</strong> للتحقق من هويتي في هذا الكراء. ستُدرج في عقدي بصيغة PDF فقط و<strong>لن تُحفظ</strong> على خوادم Stayform."
    },
    skip_banner: { fr: "Vous pouvez passer cette étape, mais votre document sera marqué comme non fourni dans le contrat.", en: "You can skip this step, but your document will be marked as not provided in the contract.", es: "Puedes saltar este paso, pero tu documento constará como no aportado en el contrato.", ar: "يمكنك تخطي هذه الخطوة، لكن ستُسجَّل وثيقتك في العقد على أنها غير مقدَّمة." },
    skip_step: { fr: "Passer cette étape →", en: "Skip this step →", es: "Saltar este paso →", ar: "تخطي هذه الخطوة ←" },
    skip_doc: { fr: "Je n'ai pas mon document maintenant", en: "I don't have my document with me", es: "No tengo mi documento ahora", ar: "ليست وثيقتي معي الآن" },
    hint_btn3: { fr: "Vérifiez votre pièce d'identité pour continuer.", en: "Verify your ID document to continue.", es: "Verifica tu documento de identidad para continuar.", ar: "تحقق من وثيقة هويتك للمتابعة." },

    // ── Étape 4 : contrat ─────────────────────────────────
    t_contrat: { fr: "Contrat de location", en: "Rental contract", es: "Contrato de alquiler", ar: "عقد الكراء" },
    t_contrat_sub: { fr: "Veuillez lire attentivement et signer le contrat ci-dessous.", en: "Please read the contract below carefully and sign it.", es: "Lee atentamente el contrato y fírmalo.", ar: "يرجى قراءة العقد أدناه بعناية والتوقيع عليه." },
    contract_translation_note: { fr: "", en: "", es: "", ar: "هذه الترجمة مقدَّمة لتسهيل الفهم. عقد PDF الموقَّع محرَّر بالفرنسية، والنسخة الفرنسية هي المعتمدة." },
    sum_tenant: { fr: "Locataire", en: "Guest", es: "Huésped", ar: "المكتري" },
    sum_guests: { fr: "Voyageurs", en: "Guests", es: "Viajeros", ar: "المسافرون" },
    sum_duration: { fr: "Durée", en: "Length of stay", es: "Duración", ar: "المدة" },
    sum_arrival_time: { fr: "Arrivée prévue", en: "Expected arrival", es: "Llegada prevista", ar: "الوصول المتوقع" },
    sum_name: { fr: "Nom", en: "Name", es: "Nombre", ar: "الاسم" },
    sum_email: { fr: "E-mail", en: "Email", es: "Correo", ar: "البريد الإلكتروني" },
    sum_id: { fr: "Pièce identité", en: "ID document", es: "Documento", ar: "وثيقة الهوية" },
    id_pending: { fr: "⚠ En attente", en: "⚠ Pending", es: "⚠ Pendiente", ar: "⚠ في الانتظار" },
    id_provided: { fr: "✓ Fournie", en: "✓ Provided", es: "✓ Aportado", ar: "✓ مقدَّمة" },

    contract_title: { fr: "CONTRAT DE LOCATION MEUBLÉE TOURISTIQUE", en: "FURNISHED HOLIDAY RENTAL CONTRACT", es: "CONTRATO DE ALQUILER TURÍSTICO AMUEBLADO", ar: "عقد كراء سياحي لمسكن مفروش" },
    contract_intro: {
      fr: "Entre le soussigné, ci-après dénommé « le Bailleur », et le(s) voyageur(s) mentionné(s) dans le présent contrat, ci-après dénommé(s) « le(s) Locataire(s) ».",
      en: "Between the undersigned, hereinafter “the Landlord”, and the traveller(s) named in this contract, hereinafter “the Tenant(s)”.",
      es: "Entre el abajo firmante, en adelante «el Arrendador», y el/los viajero(s) mencionado(s) en el presente contrato, en adelante «el/los Arrendatario(s)».",
      ar: "بين الموقِّع أدناه، المشار إليه فيما يلي بـ«المُكري»، والمسافر (المسافرين) المذكور (المذكورين) في هذا العقد، المشار إليهم فيما يلي بـ«المكتري (المكترين)»."
    },
    art1_t: { fr: "Article 1 — Objet du contrat", en: "Article 1 — Purpose of the contract", es: "Artículo 1 — Objeto del contrato", ar: "المادة 1 — موضوع العقد" },
    art1: {
      fr: "Le présent contrat a pour objet la location meublée à titre touristique du logement décrit dans la réservation. Cette location est consentie et acceptée aux conditions stipulées ci-après. La location ne peut en aucun cas bénéficier à des tiers et ne peut faire l'objet d'une sous-location ou cession sans accord écrit préalable du bailleur.",
      en: "This contract covers the furnished holiday rental of the accommodation described in the booking. The rental is granted and accepted on the terms set out below. It may not benefit third parties and may not be sublet or assigned without the landlord's prior written consent.",
      es: "El presente contrato tiene por objeto el alquiler turístico amueblado del alojamiento descrito en la reserva. El alquiler se concede y acepta en las condiciones estipuladas a continuación. No podrá beneficiar a terceros ni ser objeto de subarriendo o cesión sin el acuerdo previo por escrito del arrendador.",
      ar: "يهدف هذا العقد إلى كراء المسكن المفروش الموصوف في الحجز لغرض سياحي. ويُبرم هذا الكراء ويُقبل وفق الشروط المبيَّنة أدناه. ولا يجوز بأي حال أن يستفيد منه الغير، ولا أن يكون محل كراء من الباطن أو تفويت دون موافقة كتابية مسبقة من المُكري."
    },
    art2_t: { fr: "Article 2 — Durée de la location", en: "Article 2 — Length of the rental", es: "Artículo 2 — Duración del alquiler", ar: "المادة 2 — مدة الكراء" },
    art2: {
      fr: "La location commence et se termine aux dates sélectionnées lors de ce check-in. Le locataire devra libérer les lieux au plus tard à 11h00 le jour du départ. Le bailleur se réserve le droit de facturer une nuit supplémentaire en cas de départ tardif non convenu.",
      en: "The rental starts and ends on the dates selected during this check-in. The tenant must vacate the premises by 11:00 at the latest on the day of departure. The landlord may charge an extra night for a late departure that was not agreed.",
      es: "El alquiler empieza y termina en las fechas seleccionadas en este check-in. El arrendatario deberá dejar el alojamiento a más tardar a las 11:00 del día de salida. El arrendador se reserva el derecho de cobrar una noche adicional en caso de salida tardía no acordada.",
      ar: "يبدأ الكراء وينتهي في التواريخ المختارة خلال تسجيل الوصول هذا. ويجب على المكتري إخلاء المسكن في أجل أقصاه الساعة 11:00 يوم المغادرة. ويحتفظ المُكري بحق احتساب ليلة إضافية في حال مغادرة متأخرة غير متفق عليها."
    },
    art3_t: { fr: "Article 3 — Prix et conditions de paiement", en: "Article 3 — Price and payment terms", es: "Artículo 3 — Precio y condiciones de pago", ar: "المادة 3 — الثمن وشروط الأداء" },
    art3: {
      fr: "Le montant du loyer, les frais de ménage, taxes de séjour et autres charges ont été convenus entre les parties conformément aux conditions de la réservation.",
      en: "The rent, cleaning fees, tourist taxes and other charges have been agreed between the parties in accordance with the booking terms.",
      es: "El importe del alquiler, los gastos de limpieza, las tasas turísticas y demás cargos se han acordado entre las partes según las condiciones de la reserva.",
      ar: "تم الاتفاق بين الطرفين على مبلغ الكراء ومصاريف التنظيف ورسوم الإقامة وباقي التكاليف وفقاً لشروط الحجز."
    },
    art4_t: { fr: "Article 4 — Dépôt de garantie", en: "Article 4 — Security deposit", es: "Artículo 4 — Fianza", ar: "المادة 4 — مبلغ الضمان" },
    art4: {
      fr: "Un dépôt de garantie peut être demandé par le bailleur. En l'absence de dommages constatés lors de l'état des lieux de sortie, ce dépôt est intégralement restitué dans un délai de 7 jours ouvrés après le départ.",
      en: "The landlord may ask for a security deposit. If no damage is found at the check-out inspection, the deposit is refunded in full within 7 working days after departure.",
      es: "El arrendador puede solicitar una fianza. Si no se constatan daños en la revisión de salida, se devolverá íntegramente en un plazo de 7 días hábiles tras la salida.",
      ar: "يجوز للمُكري طلب مبلغ ضمان. وفي حال عدم معاينة أي أضرار عند معاينة المسكن عند المغادرة، يُرد هذا المبلغ كاملاً داخل أجل 7 أيام عمل بعد المغادرة."
    },
    art5_t: { fr: "Article 5 — Occupation et règles de séjour", en: "Article 5 — Occupancy and house rules", es: "Artículo 5 — Ocupación y normas de la estancia", ar: "المادة 5 — الإشغال وقواعد الإقامة" },
    art5_base: {
      fr: "Le logement est loué à usage exclusivement touristique et résidentiel temporaire. Il est expressément interdit : d'introduire plus de personnes que le nombre déclaré ; ",
      en: "The accommodation is let solely for temporary holiday use. It is expressly forbidden: to bring in more people than the number declared; ",
      es: "El alojamiento se alquila exclusivamente para uso turístico y residencial temporal. Queda expresamente prohibido: alojar a más personas de las declaradas; ",
      ar: "يُكرى المسكن حصرياً للاستعمال السياحي والسكني المؤقت. ويُمنع صراحةً: إدخال عدد من الأشخاص يفوق العدد المصرَّح به؛ "
    },
    art5_parties: { fr: "d'organiser des fêtes, soirées ou rassemblements ; ", en: "to hold parties, events or gatherings; ", es: "organizar fiestas, veladas o reuniones; ", ar: "تنظيم حفلات أو سهرات أو تجمعات؛ " },
    art5_smoking: { fr: "de fumer à l'intérieur du logement ; ", en: "to smoke inside the accommodation; ", es: "fumar dentro del alojamiento; ", ar: "التدخين داخل المسكن؛ " },
    art5_pets_no: { fr: "d'introduire des animaux de compagnie sans autorisation préalable ; ", en: "to bring pets without prior permission; ", es: "introducir animales de compañía sin autorización previa; ", ar: "إدخال حيوانات أليفة دون إذن مسبق؛ " },
    art5_pets_ok: { fr: "les animaux de compagnie sont autorisés sur accord préalable ; ", en: "pets are allowed with prior agreement; ", es: "se admiten animales de compañía con acuerdo previo; ", ar: "يُسمح بالحيوانات الأليفة بعد موافقة مسبقة؛ " },
    art5_marriage: { fr: "un acte de mariage est exigé pour les couples de nationalité marocaine ; ", en: "a marriage certificate is required for couples of Moroccan nationality; ", es: "se exige un certificado de matrimonio a las parejas de nacionalidad marroquí; ", ar: "يُشترط تقديم عقد الزواج بالنسبة للأزواج من الجنسية المغربية؛ " },
    art5_damage: { fr: "d'endommager les équipements et le mobilier.", en: "to damage the equipment and furniture.", es: "dañar el equipamiento y el mobiliario.", ar: "إتلاف التجهيزات والأثاث." },
    art6_t: { fr: "Article 6 — Règlement intérieur", en: "Article 6 — House rules", es: "Artículo 6 — Reglamento interno", ar: "المادة 6 — النظام الداخلي" },
    art6_base: {
      fr: "Le locataire s'engage à respecter le règlement intérieur du logement. Le non-respect du règlement peut entraîner une résiliation immédiate du contrat sans remboursement.",
      en: "The tenant agrees to follow the house rules. Breaking them may lead to immediate termination of the contract without refund.",
      es: "El arrendatario se compromete a respetar el reglamento interno del alojamiento. Su incumplimiento puede conllevar la rescisión inmediata del contrato sin reembolso.",
      ar: "يلتزم المكتري باحترام النظام الداخلي للمسكن. وقد يؤدي عدم احترامه إلى فسخ العقد فوراً دون استرجاع المبلغ."
    },
    art6_quiet: { fr: "Heures calmes : de {a} à {b}.", en: "Quiet hours: from {a} to {b}.", es: "Horas de silencio: de {a} a {b}.", ar: "ساعات الهدوء: من {a} إلى {b}." },
    art6_parking: { fr: "Un emplacement de parking est disponible.", en: "A parking space is available.", es: "Hay una plaza de aparcamiento disponible.", ar: "يتوفر مكان لركن السيارة." },
    art7_t: { fr: "Article 7 — Responsabilité", en: "Article 7 — Liability", es: "Artículo 7 — Responsabilidad", ar: "المادة 7 — المسؤولية" },
    art7: {
      fr: "Le locataire est responsable de tout dommage causé au logement, à son contenu et aux équipements durant son séjour. Le bailleur ne pourra être tenu responsable des vols, pertes ou dommages affectant les biens personnels du locataire.",
      en: "The tenant is liable for any damage to the accommodation, its contents and equipment during the stay. The landlord cannot be held liable for theft, loss or damage affecting the tenant's personal belongings.",
      es: "El arrendatario es responsable de cualquier daño causado al alojamiento, a su contenido y al equipamiento durante su estancia. El arrendador no será responsable de robos, pérdidas o daños que afecten a las pertenencias personales del arrendatario.",
      ar: "يتحمل المكتري مسؤولية كل ضرر يلحق بالمسكن ومحتوياته وتجهيزاته خلال إقامته. ولا يمكن تحميل المُكري مسؤولية السرقة أو الضياع أو الأضرار التي تلحق بالممتلكات الشخصية للمكتري."
    },
    art8_t: { fr: "Article 8 — Protection des données", en: "Article 8 — Data protection", es: "Artículo 8 — Protección de datos", ar: "المادة 8 — حماية المعطيات" },
    art8: {
      fr: "Les données personnelles collectées dans ce formulaire sont traitées conformément au Règlement Général sur la Protection des Données (RGPD – UE 2016/679). Elles sont utilisées uniquement aux fins de vérification d'identité et de gestion de la location.",
      en: "The personal data collected in this form is processed in accordance with the General Data Protection Regulation (GDPR – EU 2016/679). It is used only to verify identity and manage the rental.",
      es: "Los datos personales recogidos en este formulario se tratan conforme al Reglamento General de Protección de Datos (RGPD – UE 2016/679). Se utilizan únicamente para verificar la identidad y gestionar el alquiler.",
      ar: "تُعالَج المعطيات الشخصية المجمَّعة في هذه الاستمارة وفقاً للنظام العام لحماية البيانات (RGPD – الاتحاد الأوروبي 2016/679). ولا تُستعمل إلا لأغراض التحقق من الهوية وتدبير الكراء."
    },
    art9_t: { fr: "Article 9 — Litiges", en: "Article 9 — Disputes", es: "Artículo 9 — Litigios", ar: "المادة 9 — النزاعات" },
    art9: {
      fr: "Tout litige relatif au présent contrat sera soumis à la juridiction compétente du lieu du logement loué, après tentative de résolution amiable.",
      en: "Any dispute relating to this contract will be brought before the competent court where the accommodation is located, after an attempt at amicable settlement.",
      es: "Cualquier litigio relativo al presente contrato se someterá al tribunal competente del lugar del alojamiento, tras un intento de resolución amistosa.",
      ar: "يُعرض كل نزاع متعلق بهذا العقد على المحكمة المختصة بمكان وجود المسكن المكترى، بعد محاولة الحل الودي."
    },
    check1: { fr: "J'ai lu et j'accepte les conditions générales du contrat de location ci-dessus.", en: "I have read and accept the terms of the rental contract above.", es: "He leído y acepto las condiciones generales del contrato de alquiler.", ar: "قرأت وأوافق على الشروط العامة لعقد الكراء أعلاه." },
    check2: { fr: "Je certifie que les informations fournies sont exactes et que les pièces d'identité téléchargées sont authentiques.", en: "I certify that the information provided is accurate and that the ID documents uploaded are genuine.", es: "Certifico que la información facilitada es exacta y que los documentos de identidad aportados son auténticos.", ar: "أشهد أن المعلومات المقدَّمة صحيحة وأن وثائق الهوية المرفوعة أصلية." },
    check3: { fr: "J'accepte le traitement de mes données personnelles conformément au RGPD pour la gestion de cette location.", en: "I agree to the processing of my personal data under the GDPR for the management of this rental.", es: "Acepto el tratamiento de mis datos personales conforme al RGPD para la gestión de este alquiler.", ar: "أوافق على معالجة معطياتي الشخصية وفقاً لـ RGPD من أجل تدبير هذا الكراء." },
    lock_title: { fr: "🔑 Code d'accès au logement", en: "🔑 Door access code", es: "🔑 Código de acceso al alojamiento", ar: "🔑 رمز الدخول إلى المسكن" },
    lock_label: { fr: "Serrure numérique · 7 chiffres", en: "Smart lock · 7 digits", es: "Cerradura digital · 7 cifras", ar: "قفل رقمي · 7 أرقام" },
    lock_generate: { fr: "🎲 Générer", en: "🎲 Generate", es: "🎲 Generar", ar: "🎲 توليد" },
    lock_info: { fr: "✓ Code généré et inclus dans le contrat PDF", en: "✓ Code generated and included in the PDF contract", es: "✓ Código generado e incluido en el contrato PDF", ar: "✓ تم توليد الرمز وإدراجه في عقد PDF" },
    lbl_signature: { fr: "Signature manuscrite", en: "Signature", es: "Firma", ar: "التوقيع" },
    sig_here: { fr: "✍ Signez ici", en: "✍ Sign here", es: "✍ Firma aquí", ar: "✍ وقّع هنا" },
    sig_clear: { fr: "Effacer", en: "Clear", es: "Borrar", ar: "مسح" },
    sig_placeholder: { fr: "Signez avec votre doigt ou votre souris", en: "Sign with your finger or mouse", es: "Firma con el dedo o el ratón", ar: "وقّع بإصبعك أو بالفأرة" },
    sig_error: { fr: "⚠ La signature est obligatoire pour valider le contrat.", en: "⚠ Your signature is required to confirm the contract.", es: "⚠ La firma es obligatoria para validar el contrato.", ar: "⚠ التوقيع إلزامي لتأكيد العقد." },
    btn_submit: { fr: "✓ Valider le check-in", en: "✓ Complete check-in", es: "✓ Confirmar el check-in", ar: "✓ تأكيد تسجيل الوصول" },
    submitting: { fr: "⏳ Enregistrement...", en: "⏳ Saving...", es: "⏳ Guardando...", ar: "⏳ جارٍ الحفظ..." },
    hint_btnSubmit: { fr: "Cochez les cases et signez pour valider.", en: "Tick the boxes and sign to confirm.", es: "Marca las casillas y firma para confirmar.", ar: "ضع علامة على الخانات ووقّع للتأكيد." },

    // ── Confirmation ──────────────────────────────────────
    success_title: { fr: "Check-in validé !", en: "Check-in complete!", es: "¡Check-in completado!", ar: "تم تسجيل الوصول!" },
    success_sub: { fr: "Votre dossier a bien été enregistré. Téléchargez le contrat signé ci-dessous.", en: "Your details have been saved. Download your signed contract below.", es: "Tus datos se han guardado. Descarga el contrato firmado a continuación.", ar: "تم حفظ ملفك بنجاح. حمّل العقد الموقَّع أدناه." },
    success_email: { fr: "Un email de confirmation a été envoyé à votre adresse. L'hôte a également été notifié. Bon séjour !", en: "A confirmation email has been sent to you and your host has been notified. Enjoy your stay!", es: "Te hemos enviado un correo de confirmación y tu anfitrión ha sido avisado. ¡Feliz estancia!", ar: "تم إرسال رسالة تأكيد إلى بريدك وإشعار مضيفك. إقامة سعيدة!" },
    // ── Contrat PDF (FR / EN / ES ; l'arabe utilise le français) ──
    pdf_file: { fr: "DOSSIER DE CHECK-IN", en: "CHECK-IN FILE", es: "EXPEDIENTE DE CHECK-IN" },
    pdf_footer: { fr: "{name} — Contrat de location", en: "{name} — Rental contract", es: "{name} — Contrato de alquiler" },
    pdf_page: { fr: "Page {n}", en: "Page {n}", es: "Página {n}" },
    pdf_sec_property: { fr: "Logement & Bailleur", en: "Accommodation & Landlord", es: "Alojamiento y arrendador" },
    pdf_landlord: { fr: "Bailleur", en: "Landlord", es: "Arrendador" },
    pdf_landlord_default: { fr: "Le bailleur", en: "The landlord", es: "El arrendador" },
    pdf_owner: { fr: "Propriétaire", en: "Owner", es: "Propietario" },
    pdf_property: { fr: "Logement", en: "Accommodation", es: "Alojamiento" },
    pdf_host_cin: { fr: "N° CNIE Bailleur", en: "Landlord ID no.", es: "N.º de documento del arrendador" },
    pdf_address: { fr: "Adresse", en: "Address", es: "Dirección" },
    pdf_location: { fr: "Localisation", en: "Location", es: "Localidad" },
    pdf_wifi: { fr: "WiFi", en: "Wi-Fi", es: "Wi-Fi" },
    pdf_wifi_pw: { fr: "Mot de passe", en: "Password", es: "Contraseña" },
    pdf_sec_identity: { fr: "Identité du locataire", en: "Tenant identity", es: "Identidad del arrendatario" },
    pdf_firstname: { fr: "Prénom", en: "First name", es: "Nombre" },
    pdf_lastname: { fr: "Nom de famille", en: "Last name", es: "Apellidos" },
    pdf_docnum: { fr: "N° document", en: "Document no.", es: "N.º de documento" },
    pdf_type: { fr: "Type", en: "Type", es: "Tipo" },
    pdf_nationality: { fr: "Nationalité", en: "Nationality", es: "Nacionalidad" },
    pdf_birthdate: { fr: "Date de naissance", en: "Date of birth", es: "Fecha de nacimiento" },
    pdf_email: { fr: "E-mail", en: "Email", es: "Correo electrónico" },
    pdf_phone: { fr: "Téléphone", en: "Phone", es: "Teléfono" },
    pdf_home_address: { fr: "Adresse personnelle", en: "Home address", es: "Domicilio" },
    pdf_sec_stay: { fr: "Détails du séjour", en: "Stay details", es: "Detalles de la estancia" },
    pdf_arrival: { fr: "Date d'arrivée", en: "Arrival date", es: "Fecha de llegada" },
    pdf_departure: { fr: "Date de départ", en: "Departure date", es: "Fecha de salida" },
    pdf_duration: { fr: "Durée", en: "Length of stay", es: "Duración" },
    pdf_guests: { fr: "Voyageurs", en: "Guests", es: "Viajeros" },
    pdf_arrival_time: { fr: "Heure d'arrivée prévue", en: "Expected arrival time", es: "Hora de llegada prevista" },
    pdf_lock: { fr: "CODE D'ACCÈS AU LOGEMENT", en: "ACCOMMODATION ACCESS CODE", es: "CÓDIGO DE ACCESO AL ALOJAMIENTO" },
    pdf_lock_sub: { fr: "Serrure numérique 7 chiffres", en: "7-digit digital lock", es: "Cerradura digital de 7 cifras" },
    pdf_sec_occupants: { fr: "Occupants du logement", en: "Occupants", es: "Ocupantes del alojamiento" },
    pdf_full_name: { fr: "Nom complet", en: "Full name", es: "Nombre completo" },
    pdf_children_ages: { fr: "{children} — Âges", en: "{children} — Ages", es: "{children} — Edades" },
    pdf_years: { fr: "{list} ans", en: "{list} years old", es: "{list} años" },
    pdf_sec_docs: { fr: "Pièce d'identité & photo du voyageur", en: "ID document & guest photo", es: "Documento de identidad y foto del viajero" },
    pdf_id_doc: { fr: "PIÈCE D'IDENTITÉ", en: "ID DOCUMENT", es: "DOCUMENTO DE IDENTIDAD" },
    pdf_guest_photo: { fr: "PHOTO DU VOYAGEUR", en: "GUEST PHOTO", es: "FOTO DEL VIAJERO" },
    pdf_wm1: { fr: "STAYFORM · CONFIDENTIEL", en: "STAYFORM · CONFIDENTIAL", es: "STAYFORM · CONFIDENCIAL" },
    pdf_wm2: { fr: "USAGE UNIQUE · VÉRIFICATION IDENTITÉ", en: "SINGLE USE · IDENTITY CHECK", es: "USO ÚNICO · VERIFICACIÓN DE IDENTIDAD" },
    pdf_doc_provided: { fr: "Document fourni", en: "Document provided", es: "Documento aportado" },
    pdf_not_provided: { fr: "Non fourni", en: "Not provided", es: "No aportado" },
    pdf_preamble: {
      fr: "Entre le soussigné {host}{cin}, {quality}, ci-après dénommé « le Bailleur », et le(s) voyageur(s) mentionné(s) dans le présent contrat, ci-après dénommé(s) « le(s) Locataire(s) ».",
      en: "Between the undersigned {host}{cin}, {quality}, hereinafter “the Landlord”, and the traveller(s) named in this contract, hereinafter “the Tenant(s)”.",
      es: "Entre el abajo firmante {host}{cin}, {quality}, en adelante «el Arrendador», y el/los viajero(s) mencionado(s) en el presente contrato, en adelante «el/los Arrendatario(s)»."
    },
    pdf_cin_part: { fr: ", CIN : {cin}", en: ", ID no. {cin}", es: ", documento n.º {cin}" },
    pdf_art2: {
      fr: "La location s'étend du {from} au {to}, soit {nights}. Le locataire devra libérer les lieux au plus tard à {time} le jour du départ. Le bailleur se réserve le droit de facturer une nuit supplémentaire en cas de départ tardif non convenu.",
      en: "The rental runs from {from} to {to}, i.e. {nights}. The tenant must vacate the premises by {time} at the latest on the day of departure. The landlord may charge an extra night for a late departure that was not agreed.",
      es: "El alquiler va del {from} al {to}, es decir, {nights}. El arrendatario deberá dejar el alojamiento a más tardar a las {time} del día de salida. El arrendador se reserva el derecho de cobrar una noche adicional en caso de salida tardía no acordada."
    },
    pdf_custom_art: { fr: "Article {n} — {title}", en: "Article {n} — {title}", es: "Artículo {n} — {title}" },
    pdf_sec_decl: { fr: "Déclarations et consentements", en: "Declarations and consent", es: "Declaraciones y consentimientos" },
    pdf_sec_sign: { fr: "Signatures", en: "Signatures", es: "Firmas" },
    pdf_tenant: { fr: "LE LOCATAIRE", en: "THE TENANT", es: "EL ARRENDATARIO" },
    pdf_landlord_up: { fr: "LE BAILLEUR", en: "THE LANDLORD", es: "EL ARRENDADOR" },
    pdf_esign: { fr: "Signature manuscrite électronique", en: "Electronic handwritten signature", es: "Firma manuscrita electrónica" },
    pdf_host_sign: { fr: "Signature du bailleur", en: "Landlord's signature", es: "Firma del arrendador" },
    pdf_stamp1: { fr: "Stayform — Document généré électroniquement", en: "Stayform — Electronically generated document", es: "Stayform — Documento generado electrónicamente" },
    pdf_stamp2: { fr: "Ce document a valeur contractuelle. Conservez-le pour vos archives.", en: "This document is contractually binding. Keep it for your records.", es: "Este documento tiene valor contractual. Consérvelo para sus archivos." },
    pdf_made_on: { fr: "Établi le {date}", en: "Drawn up on {date}", es: "Redactado el {date}" },
    pdf_between: { fr: "ENTRE LES SOUSSIGNÉS", en: "BETWEEN THE UNDERSIGNED", es: "ENTRE LOS ABAJO FIRMANTES" },
    pdf_agreed: { fr: "IL A ÉTÉ CONVENU CE QUI SUIT", en: "IT HAS BEEN AGREED AS FOLLOWS", es: "SE HA CONVENIDO LO SIGUIENTE" },
    pdf_host_lead: { fr: "Le bailleur :", en: "The landlord:", es: "El arrendador:" },
    pdf_guest_lead: { fr: "Et le locataire :", en: "And the tenant:", es: "Y el arrendatario:" },
    pdf_host_cin2: { fr: "titulaire de la CIN n° {v}", en: "holder of ID card no. {v}", es: "titular del documento n.º {v}" },
    pdf_host_tail: { fr: "ci-après « le Bailleur »,", en: "hereinafter “the Landlord”,", es: "en adelante «el Arrendador»," },
    pdf_g_nat: { fr: "de nationalité {v}", en: "nationality {v}", es: "de nacionalidad {v}" },
    pdf_g_birth: { fr: "né(e) le {v}", en: "born on {v}", es: "nacido/a el {v}" },
    pdf_g_doc: { fr: "titulaire du document {type} n° {v}", en: "holder of {type} no. {v}", es: "titular del documento {type} n.º {v}" },
    pdf_g_addr: { fr: "demeurant {v}", en: "residing at {v}", es: "con domicilio en {v}" },
    pdf_g_phone: { fr: "téléphone {v}", en: "phone {v}", es: "teléfono {v}" },
    pdf_g_email: { fr: "e-mail {v}", en: "email {v}", es: "correo {v}" },
    pdf_guest_tail: { fr: "ci-après « le Locataire ».", en: "hereinafter “the Tenant”.", es: "en adelante «el Arrendatario»." },
    pdf_period: { fr: "Période", en: "Period", es: "Periodo" },
    pdf_period_v: { fr: "Du {from} au {to} ({nights})", en: "From {from} to {to} ({nights})", es: "Del {from} al {to} ({nights})" },
    pdf_arrival_v: { fr: "arrivée prévue vers {v}", en: "expected arrival around {v}", es: "llegada prevista hacia las {v}" },
    pdf_hours: { fr: "Horaires", en: "Times", es: "Horarios" },
    pdf_hours_v: { fr: "Arrivée à partir de {a} — départ avant {b}", en: "Check-in from {a} — check-out by {b}", es: "Entrada desde las {a} — salida antes de las {b}" },
    pdf_lock_short: { fr: "Code d'accès", en: "Access code", es: "Código de acceso" },
    pdf_made_at: { fr: "Fait à {city}, le {date}, en deux exemplaires.", en: "Done in {city} on {date}, in two copies.", es: "Hecho en {city}, el {date}, por duplicado." },
    pdf_made_at_nocity: { fr: "Fait le {date}, en deux exemplaires.", en: "Done on {date}, in two copies.", es: "Hecho el {date}, por duplicado." },
    pdf_read_approved: { fr: "« Lu et approuvé »", en: "“Read and approved”", es: "«Leído y conforme»" },
    pdf_annex: { fr: "ANNEXE — PIÈCES JUSTIFICATIVES", en: "APPENDIX — SUPPORTING DOCUMENTS", es: "ANEXO — DOCUMENTOS JUSTIFICATIVOS" },
    pdf_initials: { fr: "Paraphe du locataire : ______", en: "Tenant's initials: ______", es: "Rúbrica del arrendatario: ______" },
    pdf_intro: { fr: "📋 Générez le dossier complet pour vos archives ou les autorités", en: "📋 Download the full file for your records or the authorities", es: "📋 Descarga el expediente completo para tus archivos o las autoridades", ar: "📋 حمّل الملف الكامل لأرشيفك أو للسلطات" },
    btn_pdf: { fr: "⬇ Télécharger le contrat PDF", en: "⬇ Download the PDF contract", es: "⬇ Descargar el contrato PDF", ar: "⬇ تحميل العقد PDF" },
    pdf_contains: { fr: "Contient : identité, dates, contrat complet et signature", en: "Includes: identity, dates, full contract and signature", es: "Incluye: identidad, fechas, contrato completo y firma", ar: "يتضمن: الهوية والتواريخ والعقد الكامل والتوقيع. ملف PDF باللغة الفرنسية." },
    pdf_generating: { fr: "⏳ Génération en cours...", en: "⏳ Generating...", es: "⏳ Generando...", ar: "⏳ جارٍ الإنشاء..." },
    pdf_done: { fr: "✓ Téléchargé !", en: "✓ Downloaded!", es: "✓ ¡Descargado!", ar: "✓ تم التحميل!" },

    // ── Logement ──────────────────────────────────────────
    info_title: { fr: "ℹ️ Informations du logement", en: "ℹ️ About your accommodation", es: "ℹ️ Información del alojamiento", ar: "ℹ️ معلومات المسكن" },
    info_checkin: { fr: "Check-in", en: "Check-in", es: "Entrada", ar: "الدخول" },
    info_checkout: { fr: "Check-out", en: "Check-out", es: "Salida", ar: "المغادرة" },
    info_wifi: { fr: "WiFi", en: "Wi-Fi", es: "Wifi", ar: "الواي فاي" },
    info_wifi_pw: { fr: "Mot de passe", en: "Password", es: "Contraseña", ar: "كلمة المرور" },

    // ── Lien indisponible ─────────────────────────────────
    locked_title: { fr: "Check-in indisponible", en: "Check-in unavailable", es: "Check-in no disponible", ar: "تسجيل الوصول غير متاح" },
    locked_text: { fr: "Votre hôte a atteint la limite de son plan gratuit.<br>Veuillez le contacter directement pour finaliser votre arrivée.", en: "Your host has reached the limit of their free plan.<br>Please contact them directly to complete your arrival.", es: "Tu anfitrión ha alcanzado el límite de su plan gratuito.<br>Contacta con él directamente para completar tu llegada.", ar: "بلغ مضيفك الحد الأقصى لخطته المجانية.<br>يرجى التواصل معه مباشرة لإتمام وصولك." },
    locked_contact: { fr: "Contactez votre hôte par téléphone ou WhatsApp pour confirmer votre check-in.", en: "Contact your host by phone or WhatsApp to confirm your check-in.", es: "Contacta con tu anfitrión por teléfono o WhatsApp para confirmar tu check-in.", ar: "تواصل مع مضيفك عبر الهاتف أو واتساب لتأكيد تسجيل وصولك." },
    exp_denied_title: { fr: "Accès refusé", en: "Access denied", es: "Acceso denegado", ar: "تم رفض الوصول" },
    exp_title: { fr: "Lien expiré", en: "Link expired", es: "Enlace caducado", ar: "انتهت صلاحية الرابط" },
    exp_no_token: { fr: "Accès non autorisé. Cette page nécessite un lien de check-in valide généré par votre hôte.", en: "Access not allowed. This page needs a valid check-in link from your host.", es: "Acceso no autorizado. Esta página requiere un enlace de check-in válido de tu anfitrión.", ar: "وصول غير مسموح. تتطلب هذه الصفحة رابط تسجيل وصول صالحاً من مضيفك." },
    exp_invalid: { fr: "Lien invalide.", en: "Invalid link.", es: "Enlace no válido.", ar: "رابط غير صالح." },
    exp_expired: { fr: "Ce lien a expiré. Demandez un nouveau lien à votre hôte.", en: "This link has expired. Ask your host for a new one.", es: "Este enlace ha caducado. Pide uno nuevo a tu anfitrión.", ar: "انتهت صلاحية هذا الرابط. اطلب رابطاً جديداً من مضيفك." },
    exp_used: { fr: "Ce lien a déjà été utilisé. Demandez un nouveau lien à votre hôte.", en: "This link has already been used. Ask your host for a new one.", es: "Este enlace ya se ha utilizado. Pide uno nuevo a tu anfitrión.", ar: "تم استخدام هذا الرابط من قبل. اطلب رابطاً جديداً من مضيفك." },
    exp_used_or_invalid: { fr: "Ce lien a déjà été utilisé ou est invalide. Demandez un nouveau lien à votre hôte.", en: "This link has already been used or is invalid. Ask your host for a new one.", es: "Este enlace ya se ha utilizado o no es válido. Pide uno nuevo a tu anfitrión.", ar: "تم استخدام هذا الرابط من قبل أو أنه غير صالح. اطلب رابطاً جديداً من مضيفك." },
    exp_unavailable: { fr: "Ce lien est temporairement indisponible. Veuillez contacter votre hôte.", en: "This link is temporarily unavailable. Please contact your host.", es: "Este enlace no está disponible temporalmente. Contacta con tu anfitrión.", ar: "هذا الرابط غير متاح مؤقتاً. يرجى التواصل مع مضيفك." },
    exp_denied_help: { fr: "🏠 Cette page est réservée aux guests ayant reçu un lien de check-in de leur hôte via <strong style=\"color:#B5573D\">Stayform</strong>.", en: "🏠 This page is only for guests who received a check-in link from their host through <strong style=\"color:#B5573D\">Stayform</strong>.", es: "🏠 Esta página es solo para huéspedes que han recibido un enlace de check-in de su anfitrión a través de <strong style=\"color:#B5573D\">Stayform</strong>.", ar: "🏠 هذه الصفحة مخصصة للضيوف الذين توصلوا برابط تسجيل الوصول من مضيفهم عبر <strong style=\"color:#B5573D\">Stayform</strong>." },
    exp_help: { fr: "⏱ Les liens de check-in sont valables <strong style=\"color:#B5573D\">3 heures</strong> pour votre sécurité. Contactez votre hôte pour un nouveau lien.", en: "⏱ For your security, check-in links are valid for <strong style=\"color:#B5573D\">3 hours</strong>. Contact your host for a new link.", es: "⏱ Por tu seguridad, los enlaces de check-in son válidos durante <strong style=\"color:#B5573D\">3 horas</strong>. Contacta con tu anfitrión para obtener uno nuevo.", ar: "⏱ لأمانك، روابط تسجيل الوصول صالحة لمدة <strong style=\"color:#B5573D\">3 ساعات</strong>. تواصل مع مضيفك للحصول على رابط جديد." },
    timer_expired: { fr: "⏰ Lien expiré", en: "⏰ Link expired", es: "⏰ Enlace caducado", ar: "⏰ انتهت صلاحية الرابط" }
  };

  function pick(list) {
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i] || '').toLowerCase().slice(0, 2);
      if (LANGS.indexOf(code) !== -1) return code;
    }
    return null;
  }

  function detect() {
    var params = new URLSearchParams(window.location.search);
    var fromUrl = pick([params.get('lang')]);
    if (fromUrl) return fromUrl;
    // Aperçu hôte (?demo=1) : le tableau de bord est en français.
    if (params.get('demo') === '1') return 'fr';
    var saved = null;
    try { saved = localStorage.getItem('sf_lang'); } catch (e) {}
    return pick([saved]) || pick(navigator.languages || [navigator.language]) || 'fr';
  }

  function t(key, vars) { return tl(window._lang, key, vars); }

  // Traduction dans une langue donnée (utilisé par le contrat PDF).
  function tl(lang, key, vars) {
    var entry = STR[key];
    var s = entry ? (entry[lang] != null ? entry[lang] : entry.fr) : key;
    if (s == null) s = key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return s;
  }

  // Pluriel : cherche clé_one / clé_two / clé_few / clé_other selon la langue.
  function tn(key, n) { return tnl(window._lang, key, n); }

  function tnl(lang, key, n) {
    var cat = 'other';
    try { cat = new Intl.PluralRules(lang).select(n); } catch (e) { cat = n === 1 ? 'one' : 'other'; }
    var k = key + '_' + cat;
    if (!STR[k] || STR[k][lang] == null) k = key + '_' + (n === 1 ? 'one' : 'other');
    return tl(lang, k, { n: n });
  }

  function applyI18n(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    root.querySelectorAll('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
    root.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  }

  function applyDir() {
    var html = document.documentElement;
    html.setAttribute('lang', window._lang);
    html.setAttribute('dir', window._lang === 'ar' ? 'rtl' : 'ltr');
    if (document.body) document.body.classList.toggle('rtl', window._lang === 'ar');
  }

  function syncSwitcher() {
    document.querySelectorAll('.lang-btn[data-lang]').forEach(function (btn) {
      var on = btn.getAttribute('data-lang') === window._lang;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function setLang(lang) {
    if (LANGS.indexOf(lang) === -1) lang = 'fr';
    window._lang = lang;
    try { localStorage.setItem('sf_lang', lang); } catch (e) {}
    applyDir();
    document.title = t('page_title');
    applyI18n(document);
    syncSwitcher();
    document.dispatchEvent(new CustomEvent('sf:langchange', { detail: { lang: lang } }));
  }

  window._lang = detect();
  window.SF_LANGS = LANGS;
  window.t = t;
  window.tn = tn;
  window.tl = tl;
  window.tnl = tnl;
  // Langue du contrat PDF : celle du voyageur. L'arabe reste en français, car la
  // police du PDF (jsPDF / Helvetica) ne sait pas afficher l'écriture arabe.
  window.sfPdfLang = function () { return PDF_LANGS.indexOf(window._lang) === -1 ? 'fr' : window._lang; };
  window.sfPdfLocale = function () { return LOCALES[window.sfPdfLang()]; };
  window.applyI18n = applyI18n;
  window.setLang = setLang;
  window.sfLocale = function () { return LOCALES[window._lang] || 'fr-FR'; };
  applyDir();

  document.addEventListener('DOMContentLoaded', function () {
    applyDir();
    document.title = t('page_title');
    applyI18n(document);
    syncSwitcher();
  });
})();
