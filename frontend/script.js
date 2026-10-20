/* ==========================================================
   iDetector — logique applicative
   - Routage par ancres (#home, #about, …)
   - Internationalisation FR / EN
   - Analyse par l'IA (backend) avec moteur heuristique local en repli
   - OCR des captures d'écran (Tesseract.js, chargé à la demande)
   - Formulaire de contribution
   ========================================================== */
(function () {
  "use strict";

  var CONFIG = {
    REPORT_ENDPOINT: "",
    API_BASE: "",
    API_TIMEOUT_MS: 45000,
    REPORT_EMAIL: "supportidetectorai@gmail.com",
    TESSERACT_URL: "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js",
    MAX_IMAGE_BYTES: 8 * 1024 * 1024,
    LINKS: {
      email: "supportidetectorai@gmail.com",
      linkedin: "https://www.linkedin.com/company/idetector_ai",
      twitter: "https://x.com/idetector_ai"
    }
  };

  var ROUTES = ["home", "about", "faq", "contribute", "api", "privacy"];

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function normalize(s) {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  var EN = {
    "skip": "Skip to main content",
    "nav.home": "Analyzer", "nav.about": "About", "nav.faq": "FAQ", "nav.contribute": "Contribute", "nav.api": "API", "nav.privacy": "Privacy",
    "hero.eyebrow": "Mobile Money protection · West Africa",
    "hero.title": "Check a message before it costs you money.",
    "hero.lead": "Paste an SMS or upload a screenshot: iDetector assesses the risk level, identifies the type of scam and tells you what to do. Covers scams targeting Wave, Orange Money, MTN MoMo and Moov Money.",
    "hero.t1": "Instant analysis", "hero.t2": "Powered by the iGuard AI", "hero.t3": "Free, no sign-up",
    "tab.text": "SMS text", "tab.image": "Screenshot",
    "an.label": "Suspicious message",
    "an.placeholder": "Paste the SMS or WhatsApp message you received here…",
    "an.sample": "Insert an example", "an.clear": "Clear", "an.analyze": "Analyze message",
    "an.disclaimer": "This tool provides decision support based on known indicators. It does not replace vigilance: a message rated “low risk” is not a guarantee. If in doubt, contact your operator directly through its official channels.",
    "img.drop": "Drop a screenshot here",
    "img.hint": "or click to browse · PNG, JPG, WebP · 8 MB max",
    "img.remove": "Remove image",
    "img.note": "Text is extracted directly in your browser (OCR); the image is never sent to a server, only the extracted text is analyzed.",
    "rep.emptyTitle": "Analysis report",
    "rep.emptyText": "Results will appear here: risk level, scam type, detailed analysis and recommendations.",
    "about.eyebrow": "About",
    "about.title": "Our mission: make Mobile Money safer for everyone.",
    "about.lead": "iDetector is a fraud detection project born in Côte d'Ivoire, designed to protect mobile financial service users across West Africa.",
    "about.c1t": "The problem",
    "about.c1p": "Mobile Money has brought millions of people closer to financial services. Fraudsters have noticed too: fake transfers, fake agents and fake account-block links spread via SMS, WhatsApp and voice calls.",
    "about.c2t": "Our approach",
    "about.c2p": "We combine analysis rules drawn from real cases, community reporting and, over time, machine learning models trained on locally annotated examples, in French and in the West African linguistic context.",
    "about.c3t": "Our principles",
    "about.c3p": "Transparency about what the tool can and cannot do, privacy by design, free access for the general public and openness to developers and partner operators.",
    "about.covTitle": "Services and regions covered",
    "about.covText": "Starting in Côte d'Ivoire, with gradual expansion to Senegal, Mali, Burkina Faso, Benin and Togo. iDetector is an independent project; it is not affiliated with any operator, and service names are cited only to describe the scams that target them.",
    "faq.title": "Frequently asked questions about Mobile Money scams",
    "faq.q1": "What is a “fake transfer” scam?",
    "faq.a1": "<p>You receive an SMS imitating a deposit confirmation, then a call or message asks you to “send back the money sent by mistake”. No real deposit took place: by sending the amount back, you lose your own money. <strong>Always check your balance from the official app or your operator's USSD code.</strong></p>",
    "faq.q2": "How do I recognize a fake agent or fake customer service?",
    "faq.a2": "<p>They contact you unprompted, create urgency and ask for your secret PIN, a code received by SMS (OTP) or an identity “verification”. <strong>A real agent will never ask for your secret PIN.</strong> Hang up and call your operator's official number.</p>",
    "faq.q3": "What should I do if I get a link saying my account is blocked?",
    "faq.a3": "<p>Do not click. Operators do not restore accounts through a link sent by SMS. Open the official app or contact customer service through official channels. Addresses imitating a known name (e.g. with hyphens or unusual extensions) are a major warning sign.</p>",
    "faq.q4": "I already shared my code or sent money. What now?",
    "faq.a4": "<ol><li>Contact your operator immediately to block the account and report the transaction.</li><li>Change your secret PIN through an official channel.</li><li>Keep screenshots, numbers and timestamps.</li><li>File a complaint with the competent authorities in your country (in Côte d'Ivoire: the National Police cybercrime platform).</li></ol>",
    "faq.q5": "Can iDetector be wrong?",
    "faq.a5": "<p>Yes. The analysis relies on indicators and cannot detect everything, especially very recent scams or conversations without an obvious link or keyword. False positives are possible, and a low-risk result is not a guarantee of safety.</p>",
    "faq.q6": "Are my messages stored?",
    "faq.a6": "<p>No. The analyzed text is sent to our server and then to an AI provider to be assessed, but its content is not kept: only content-free statistics (date, scam type, risk level, confidence) are recorded. A message is kept only if you choose to report it through the “Contribute” page.</p>",
    "contrib.eyebrow": "Community",
    "contrib.title": "Report a scam, protect others.",
    "contrib.lead": "Every report helps spot new fraud patterns and improves detection for everyone.",
    "contrib.type": "Scam type", "contrib.channel": "Channel received", "contrib.call": "Voice call",
    "contrib.operator": "Service impersonated", "contrib.country": "Country",
    "contrib.text": "Message content (without your personal data)",
    "contrib.sender": "Sender number or link (optional)",
    "contrib.consent": "I confirm this message contains neither my secret PIN nor my personal data, and I allow its use to improve detection.",
    "contrib.submit": "Submit report",
    "contrib.howTitle": "How to report well",
    "contrib.s1": "Copy the exact text of the message you received.",
    "contrib.s2": "Hide any personal element: your name, number, balance.",
    "contrib.s3": "Indicate the channel, the impersonated service and the sender's number or link.",
    "contrib.s4": "Never click the link and never call the sender back.",
    "contrib.warn": "Already lost money? Contact your operator and the authorities first; this form cannot recover funds.",
    "ty.transfer": "Fake transfer / refund request", "ty.agent": "Fake agent / customer service", "ty.block": "Fake account block / link",
    "ty.lottery": "Fake lottery / prize", "ty.pin": "Request for secret PIN or OTP", "ty.other": "Other",
    "co.ci": "Côte d'Ivoire", "co.sn": "Senegal", "co.ml": "Mali", "co.bf": "Burkina Faso", "co.bj": "Benin", "co.tg": "Togo",
    "api.eyebrow": "Developers",
    "api.title": "iDetector API documentation",
    "api.lead": "Integrate scam analysis into your app, WhatsApp bot or service back-office. This page describes the REST API used by the site.",
    "api.status": "This is the API that powers this site's analyzer. Replace the base address with your own deployment's.",
    "api.baseT": "Base URL and access",
    "api.analyzeP": "Analyzes a message (text and/or screenshot) and returns the risk level, scam type, an analysis and a recommendation.",
    "api.reqT": "Request", "api.resT": "Response 200",
    "api.f1": "Message to analyze (2,000 characters max). Required if no image is sent.",
    "api.f2": "“fr” or “en”. Language of returned explanations. Default: “fr”.",
    "api.f3": "PNG, JPG or WebP screenshot (8 MB max). multipart/form-data only, alone or with “text”.",
    "api.reportsP": "Submits a community report, queued for moderator validation.",
    "api.healthP": "Checks service availability and maintenance mode.",
    "api.sampleT": "Integration examples",
    "api.errT": "Error codes and limits",
    "api.e400": "Invalid request (text and image missing, text too long, invalid image).",
    "api.e401": "Image or request too large.",
    "api.e429": "Rate limit exceeded (default 20 analyses per minute per IP address).",
    "api.e500": "Service under maintenance or AI service unavailable; try again later.",
    "priv.eyebrow": "Legal notices",
    "priv.title": "Privacy policy and copyright",
    "priv.updated": "Last updated: October 20, 2026",
    "priv.body": "<h2>1. Data processed</h2><p>The text you submit to the analyzer is sent to our server, then to an artificial-intelligence provider (the AI service configured by iDetector) solely to produce the analysis. The message content is not kept: we only record statistical data (date, scam type, risk level, confidence score, processing time). Screenshots are read in your browser (OCR): the image is not sent, only the extracted text is. If the AI is unavailable, a simplified local analysis runs in your browser. Never enter a secret PIN, password or personal data.</p><h2>2. Community reports</h2><p>If you use the “Contribute” page, the information you provide (scam type, message content, sender number or link) is used only to improve fraud detection. Never include a secret PIN, password or personal data.</p><h2>3. Local storage</h2><p>Your language preference may be saved in your browser's local storage. You can delete it at any time from your browser settings.</p><h2>4. Cookies and trackers</h2><p>iDetector uses no advertising cookies or profiling trackers.</p><h2>5. Your rights</h2><p>In accordance with applicable personal data protection laws (including Ivorian law no. 2013-450 and equivalent texts in the countries concerned), you have the right to access, rectify and delete your data. Write to us at the support address shown in the footer.</p><h2>6. Limitation of liability</h2><p>Analysis results are provided for guidance only. iDetector cannot be held liable for decisions made solely on their basis.</p><h2>7. Copyright</h2><p>© 2026 iDetector. All rights reserved. The content, design and code of this site are protected. Third-party service names (Wave, Orange Money, MTN MoMo, Moov Money) belong to their respective owners and are cited for descriptive purposes only; iDetector is not affiliated with any of them.</p>",
    "foot.tag": "Detecting Mobile Money scams in West Africa.",
    "foot.nav": "Navigation", "foot.contact": "Contact",
    "foot.copy": "© 2026 iDetector. All rights reserved."
  };

  var currentLang = "fr";
  var FR = {};
  var FR_PH = {};

  function captureFrench() {
    $all("[data-i18n]").forEach(function (n) {
      var k = n.getAttribute("data-i18n");
      if (!(k in FR)) FR[k] = n.innerHTML;
    });
    $all("[data-i18n-placeholder]").forEach(function (n) {
      FR_PH[n.getAttribute("data-i18n-placeholder")] = n.getAttribute("placeholder");
    });
  }

  function applyLang(lang) {
    currentLang = lang === "en" ? "en" : "fr";
    document.documentElement.lang = currentLang;
    var dict = currentLang === "en" ? EN : FR;
    $all("[data-i18n]").forEach(function (n) {
      var k = n.getAttribute("data-i18n");
      if (dict[k] != null) n.innerHTML = dict[k];
    });
    $all("[data-i18n-placeholder]").forEach(function (n) {
      var k = n.getAttribute("data-i18n-placeholder");
      var v = currentLang === "en" ? EN[k] : FR_PH[k];
      if (v != null) n.setAttribute("placeholder", v);
    });
    $all(".lang-btn").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === currentLang));
    });
    document.title = currentLang === "en"
      ? "iDetector — Mobile Money scam detection in West Africa"
      : "iDetector — Détection des arnaques Mobile Money en Afrique de l'Ouest";
    store("idetector.lang", currentLang);
    if (lastResult) renderReport(lastResult);
    updateOcrIdle();
  }

  function t(fr, en) { return currentLang === "en" ? en : fr; }

  function route() {
    var name = (location.hash || "#home").slice(1);
    if (ROUTES.indexOf(name) === -1) name = "home";
    $all(".view").forEach(function (v) { v.hidden = v.getAttribute("data-view") !== name; });
    $all(".main-nav a[data-route]").forEach(function (a) {
      a.classList.toggle("is-active", a.getAttribute("data-route") === name);
      if (a.getAttribute("data-route") === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    closeNav();
    window.scrollTo(0, 0);
  }

  var navToggle = $("#navToggle"), mainNav = $("#mainNav");
  function closeNav() {
    mainNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  }
  navToggle.addEventListener("click", function () {
    var open = mainNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });

  var OFFICIAL_DOMAINS = ["wave.com", "orange.ci", "orange.com", "mtn.ci", "mtn.com", "moov-africa.ci", "moov-africa.com"];
  var BRANDS = ["wave", "orange", "mtn", "moov", "momo"];
  var SHORTENERS = ["bit.ly", "tinyurl.com", "cutt.ly", "t.ly", "rb.gy", "is.gd", "shorturl.at", "ow.ly", "buff.ly", "tiny.cc", "s.id"];
  var SUSPICIOUS_TLDS = ["xyz", "top", "club", "online", "site", "click", "link", "icu", "vip", "shop", "live", "tk", "cc"];

  var TYPES = {
    pin:      { fr: "Vol de code secret / OTP", en: "Secret PIN / OTP theft" },
    transfer: { fr: "Faux transfert (renvoi d'argent « par erreur »)", en: "Fake transfer (money “sent by mistake”)" },
    block:    { fr: "Faux blocage de compte / lien d'hameçonnage", en: "Fake account block / phishing link" },
    lottery:  { fr: "Fausse loterie ou faux gain", en: "Fake lottery or prize" },
    agent:    { fr: "Faux agent / faux service client", en: "Fake agent / fake customer service" },
    fee:      { fr: "Avance de frais frauduleuse", en: "Advance-fee fraud" },
    ussd:     { fr: "Manipulation par code USSD", en: "USSD code manipulation" },
    link:     { fr: "Lien d'hameçonnage", en: "Phishing link" },
    none:     { fr: "Aucun schéma d'arnaque connu détecté", en: "No known scam pattern detected" }
  };

  function extractUrls(raw) {
    var re = /(?:https?:\/\/|www\.)[^\s<>"']+|\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|net|org|info|xyz|top|club|online|site|link|click|ci|sn|ml|bf|bj|tg|tk|cc|co|me|app|live|shop|icu|vip|ly|gl|is)\b(?:\/[^\s<>"']*)?/gi;
    var out = [], m;
    while ((m = re.exec(raw)) !== null) {
      var before = raw.charAt(m.index - 1);
      if (before === "@" || before === ".") continue;
      out.push(m[0].replace(/[).,;:!?]+$/, ""));
    }
    return out;
  }
  function hostOf(u) {
    return u.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[\/?#:]/)[0].toLowerCase();
  }
  function isOfficial(h) {
    return OFFICIAL_DOMAINS.some(function (d) { return h === d || h.slice(-(d.length + 1)) === "." + d; });
  }

  function analyze(raw) {
    var text = normalize(raw);
    var findings = [];
    function add(id, w, type, fr, en) { findings.push({ id: id, weight: w, type: type, fr: fr, en: en }); }
    function has(re) { return re.test(text); }

    var codeWord = /\b(code secret|code pin|pin|mot de passe|password|otp|code de verification|code de confirmation|code recu|verification code|secret code)\b/;
    var giveVerb = /\b(envoy|donn|communiqu|transmet|partag|fourni|confirm|saisi|entr|repond|send|share|give|provide|enter|reply|tell)/;
    if (has(codeWord) && has(giveVerb)) {
      add("pin", 35, "pin",
        "Le message demande de communiquer ou de confirmer un code secret / OTP.",
        "The message asks you to share or confirm a secret PIN / OTP.");
    }

    if (has(/(par erreur|by mistake|erreur de transfert|erreur d'envoi|mauvais numero|wrong number|renvoy|retourn|rembours|send (it )?back|return the|refund)/) &&
        has(/(recu|deposit|depot|transfert|transfer|credit|argent|money|fcfa|xof|f cfa|\bcfa\b)/)) {
      add("transfer", 30, "transfer",
        "Il est question d'un transfert ou dépôt « par erreur » et d'un remboursement demandé : schéma classique du faux transfert.",
        "It mentions a transfer or deposit “by mistake” with a refund request: a classic fake-transfer pattern.");
    }

    if (has(/(bloqu|suspend|desactiv|ferme|limite|restreint|blocked|suspended|deactivat|locked|restricted|will be closed|sera supprime)/) &&
        has(/(compte|account|wallet|portefeuille|sim|ligne|numero|number|mobile money|momo|wave|orange|mtn|moov)/)) {
      add("block", 25, "block",
        "Le message menace de bloquer, suspendre ou fermer votre compte.",
        "The message threatens to block, suspend or close your account.");
    }

    if (has(/(urgent|immediat|sans delai|dans les \d+ ?(h|heure|minute|min)|24 ?h|48 ?h|avant ce soir|faute de quoi|sinon|derniere chance|expire|dernier avertissement|within \d+|otherwise|immediately|asap|last chance|final warning)/)) {
      add("urgency", 15, null,
        "Un ton d'urgence ou une menace de délai vise à vous faire agir sans réfléchir.",
        "An urgent tone or deadline threat is meant to make you act without thinking.");
    }

    var urls = extractUrls(raw);
    var seenHosts = {};
    urls.forEach(function (u) {
      var h = hostOf(u);
      if (seenHosts[h]) return; seenHosts[h] = true;
      var tld = h.split(".").pop();
      if (SHORTENERS.indexOf(h) !== -1) {
        add("short:" + h, 30, "link",
          "Lien raccourci (" + h + ") : la destination réelle est cachée.",
          "Shortened link (" + h + "): the real destination is hidden.");
      } else if (!isOfficial(h) && BRANDS.some(function (b) { return h.indexOf(b) !== -1; })) {
        add("lookalike:" + h, 35, "block",
          "Le lien « " + h + " » imite le nom d'un service connu mais n'est pas un domaine officiel répertorié.",
          "The link “" + h + "” imitates a known service name but is not a listed official domain.");
      } else if (!isOfficial(h)) {
        var odd = SUSPICIOUS_TLDS.indexOf(tld) !== -1;
        add("url:" + h, odd ? 25 : 18, "link",
          "Lien vers un domaine non officiel : " + h + (odd ? " (extension souvent utilisée pour la fraude)." : "."),
          "Link to a non-official domain: " + h + (odd ? " (extension often used for fraud)." : "."));
      }
    });

    if (has(/(felicitation|vous avez gagne|gagnant|loterie|tirage au sort|heureux|cadeau|bonus|you('ve| have) won|winner|lottery|prize|congratulations|jackpot)/)) {
      add("lottery", 25, "lottery",
        "Annonce d'un gain, d'un cadeau ou d'un bonus inattendu.",
        "Announcement of an unexpected prize, gift or bonus.");
    }

    var agentRe = /(service client|customer service|support technique|agent (wave|orange|mtn|moov|officiel)|conseiller|je suis (de|un agent)|this is (the )?(wave|orange|mtn|moov)|equipe (wave|orange|mtn|moov))/;
    var contactRe = /(rappel|rappelez|appelez|appeler|contactez|call (me|us|back)|contact us|whatsapp|\+?\d[\d ]{7,})/;
    if (has(agentRe) && has(contactRe)) {
      add("agent", 18, "agent",
        "Un prétendu agent ou service client vous demande de le contacter ou de le rappeler.",
        "A supposed agent or customer service asks you to contact or call them back.");
    }

    if (has(/(frais (de|d')|payer|paiement|verser|avance|caution|depot de garantie|pay (a )?fee|processing fee|upfront|advance payment|registration fee)/) &&
        has(/(fcfa|xof|f cfa|\bcfa\b|\d{3,}|argent|money|pret|credit|loan|emploi|job|colis|parcel|heritage|inheritance|debloqu|release)/)) {
      add("fee", 22, "fee",
        "Un paiement préalable (frais, caution, avance) est exigé en échange d'un bénéfice.",
        "An upfront payment (fee, deposit, advance) is requested in exchange for a benefit.");
    }

    if (/(compos|tape[rz]?|dial|enter|saisi)[^\n]{0,30}[*#]\d{2,4}[*#\d]*/i.test(raw) || /[*]\d{2,4}*\d{6,}[*#]?/.test(raw)) {
      add("ussd", 25, "ussd",
        "Le message vous invite à composer un code USSD, ce qui peut déclencher un transfert ou une redirection.",
        "The message asks you to dial a USSD code, which can trigger a transfer or a call diversion.");
    }

    var letters = raw.replace(/[^A-Za-zÀ-ÿ]/g, "");
    var upper = raw.replace(/[^A-ZÀ-Ý]/g, "");
    if ((letters.length > 20 && upper.length / letters.length > .55) || /!{3,}/.test(raw)) {
      add("style", 6, null,
        "Usage excessif de majuscules ou de points d'exclamation.",
        "Excessive use of capitals or exclamation marks.");
    }

    var ids = findings.map(function (f) { return f.id.split(":")[0]; });
    var hasLink = ids.some(function (i) { return i === "short" || i === "lookalike" || i === "url"; });
    if (hasLink && (ids.indexOf("block") !== -1 || ids.indexOf("pin") !== -1)) {
      add("combo", 10, null,
        "La combinaison lien + menace ou demande de code est typique de l'hameçonnage.",
        "A link combined with a threat or code request is typical of phishing.");
    }

    var score = Math.min(100, findings.reduce(function (s, f) { return s + f.weight; }, 0));
    var level = score >= 70 ? "critical" : score >= 45 ? "high" : score >= 20 ? "medium" : "low";

    var tally = {};
    findings.forEach(function (f) { if (f.type) tally[f.type] = (tally[f.type] || 0) + f.weight; });
    var best = "none", bw = 0;
    Object.keys(tally).forEach(function (k) { if (tally[k] > bw) { bw = tally[k]; best = k; } });

    var secondary = Object.keys(tally).filter(function (k) { return k !== best; });

    return {
      score: score, level: level, type: best, secondary: secondary,
      findings: findings, urls: urls,
      length: raw.length
    };
  }

  function backendAvailable() {
    return Boolean(CONFIG.API_BASE) || location.protocol === "http:" || location.protocol === "https:";
  }

  var AI_LEVELS = { "Élevé": "high", "Moyen": "medium", "Faible": "low" };

  function analyzeRemote(raw) {
    if (!backendAvailable()) return Promise.reject(new Error("no-backend"));
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, CONFIG.API_TIMEOUT_MS) : null;
    return fetch(CONFIG.API_BASE + "/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: raw, lang: currentLang }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) { var e = new Error(data.error || "http"); e.apiMessage = data.message; throw e; }
        return data;
      });
    }).then(function (d) {
      var level = AI_LEVELS[d.riskLevel];
      if (!level || typeof d.analysis !== "string") throw new Error("bad-response");
      var local = analyze(raw);
      local.level = level;
      local.ai = {
        scamType: String(d.scamType || ""),
        analysis: d.analysis,
        recommendation: String(d.recommendation || ""),
        confidence: Math.max(0, Math.min(100, Math.round(Number(d.confidenceScore) || 0)))
      };
      return local;
    }).then(function (r) { clearTimeout(timer); return r; },
            function (err) { clearTimeout(timer); throw err; });
  }

  function analyzeAny(raw) {
    return analyzeRemote(raw).catch(function (err) {
      var r = analyze(raw);
      r.fallback = true;
      r.fallbackReason = err && err.apiMessage ? err.apiMessage : "";
      return r;
    });
  }

  var lastResult = null;
  var LEVEL_LABEL = {
    low:      { fr: "Risque faible", en: "Low risk" },
    medium:   { fr: "Risque modéré", en: "Moderate risk" },
    high:     { fr: "Risque élevé", en: "High risk" },
    critical: { fr: "Risque critique", en: "Critical risk" }
  };
  var LEVEL_SUMMARY = {
    low:      { fr: "Aucun schéma d'arnaque marquant n'a été détecté dans ce message.", en: "No significant scam pattern was detected in this message." },
    medium:   { fr: "Ce message présente des éléments suspects. Procédez avec prudence.", en: "This message contains suspicious elements. Proceed with caution." },
    high:     { fr: "Ce message ressemble fortement à une tentative d'arnaque. N'y donnez pas suite.", en: "This message strongly resembles a scam attempt. Do not act on it." },
    critical: { fr: "Très probable arnaque. Ne cliquez pas, ne répondez pas et ne transmettez aucun code.", en: "Very likely a scam. Do not click, do not reply and do not share any code." }
  };

  function renderReport(r) {
    var body = $("#reportBody");
    body.textContent = "";

    var head = el("div", "risk-head");
    head.appendChild(el("span", "badge lvl-" + r.level, t(LEVEL_LABEL[r.level].fr, LEVEL_LABEL[r.level].en)));
    var shown = r.ai ? r.ai.confidence : r.score;
    var score = el("div", "score", String(shown));
    score.appendChild(el("small", null, r.ai ? t(" % de confiance", " % confidence") : " / 100"));
    head.appendChild(score);
    body.appendChild(head);

    var meter = el("div", "meter");
    meter.setAttribute("role", "meter");
    meter.setAttribute("aria-valuemin", "0"); meter.setAttribute("aria-valuemax", "100"); meter.setAttribute("aria-valuenow", String(shown));
    meter.setAttribute("aria-label", r.ai ? t("Confiance de l'analyse", "Analysis confidence") : t("Score de risque", "Risk score"));
    var fill = el("span", "fill-" + r.level);
    fill.style.width = "0%";
    meter.appendChild(fill);
    body.appendChild(meter);
    requestAnimationFrame(function () { requestAnimationFrame(function () { fill.style.width = Math.max(shown, 3) + "%"; }); });

    body.appendChild(el("p", null, t(LEVEL_SUMMARY[r.level].fr, LEVEL_SUMMARY[r.level].en))).style.marginTop = "14px";
    var src = r.ai ? t("Analysé par iGuard (IA).", "Analyzed by iGuard (AI).")
      : t("Analyse locale simplifiée : le service d'IA est indisponible.", "Simplified local analysis: the AI service is unavailable.");
    if (r.fallback && r.fallbackReason) src += " " + r.fallbackReason;
    body.appendChild(el("p", "muted small", src));

    var typeLabel = r.ai ? (r.ai.scamType || t("Non précisé", "Not specified")) : t(TYPES[r.type].fr, TYPES[r.type].en);
    var s1 = el("div", "report-section");
    s1.appendChild(el("h3", null, t("Type d'arnaque", "Scam type")));
    s1.appendChild(el("div", "type-line", typeLabel));
    if (!r.ai && r.secondary.length && r.level !== "low") {
      s1.appendChild(el("p", "muted small", t("Indices secondaires : ", "Secondary signs: ") +
        r.secondary.map(function (k) { return t(TYPES[k].fr, TYPES[k].en); }).join(" · ")));
    }
    body.appendChild(s1);

    var s2 = el("div", "report-section");
    s2.appendChild(el("h3", null, t("Analyse détaillée", "Detailed analysis")));
    if (r.ai) s2.appendChild(el("p", null, r.ai.analysis));
    if (r.findings.length) {
      if (r.ai) s2.appendChild(el("p", "muted small", t("Indices repérés automatiquement :", "Automatically detected signs:")));
      var ul = el("ul", "findings");
      r.findings.forEach(function (f) { ul.appendChild(el("li", null, t(f.fr, f.en))); });
      s2.appendChild(ul);
    } else if (!r.ai) {
      s2.appendChild(el("p", "muted", t("Aucun indicateur suspect relevé : pas de lien, de demande de code, de menace ni d'urgence.", "No suspicious indicator found: no link, code request, threat or urgency.")));
    }
    if (r.urls.length) {
      var u = el("div", "urls", r.urls.join("\n"));
      u.style.whiteSpace = "pre-wrap";
      s2.appendChild(u);
    }
    body.appendChild(s2);

    var s3 = el("div", "report-section");
    s3.appendChild(el("h3", null, t("Recommandations", "Recommendations")));
    var rl = el("ul", "recos");
    var list = r.ai ? (r.ai.recommendation ? [r.ai.recommendation] : []) : (RECOS[r.type] ? RECOS[r.type][currentLang].slice() : []);
    if (r.level === "high" || r.level === "critical") list = list.concat(GENERAL_RECOS[currentLang]);
    list.forEach(function (x) { rl.appendChild(el("li", null, x)); });
    s3.appendChild(rl);
    body.appendChild(s3);

    var actions = el("div", "report-actions");
    var copy = el("button", "btn btn-ghost", t("Copier le rapport", "Copy report"));
    copy.type = "button";
    copy.addEventListener("click", function () {
      var txt = "iDetector — " + t(LEVEL_LABEL[r.level].fr, LEVEL_LABEL[r.level].en) +
        (r.ai ? " (" + r.ai.confidence + " %)" : " (" + r.score + "/100)") + "\n" +
        t("Type : ", "Type: ") + typeLabel + "\n\n" +
        (r.ai ? r.ai.analysis + "\n\n" + r.ai.recommendation + "\n\n" : "") +
        r.findings.map(function (f) { return "- " + t(f.fr, f.en); }).join("\n");
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt).then(function () {
          copy.textContent = t("Copié ✓", "Copied ✓");
          setTimeout(function () { copy.textContent = t("Copier le rapport", "Copy report"); }, 1800);
        });
      }
    });
    actions.appendChild(copy);
    if (r.level !== "low") {
      var rep = el("button", "btn btn-ghost", t("Signaler cette arnaque", "Report this scam"));
      rep.type = "button";
      rep.addEventListener("click", function () {
        $("#cText").value = $("#smsInput").value;
        var map = { pin: "vol_pin", transfer: "faux_transfert", block: "faux_blocage", lottery: "faux_gain", agent: "faux_agent" };
        $("#cType").value = (!r.ai && map[r.type]) || "autre";
        location.hash = "#/contribute";
      });
      actions.appendChild(rep);
    }
    body.appendChild(actions);

    $("#reportEmpty").hidden = true;
    body.hidden = false;
    lastResult = r;
  }

  var RECOS = {
    pin: {
      fr: ["Ne communiquez jamais votre code secret ni un code reçu par SMS, à personne, y compris à un prétendu agent.", "Si vous l'avez déjà donné, contactez immédiatement votre opérateur et changez votre code."],
      en: ["Never share your secret PIN or an SMS code with anyone, including a supposed agent.", "If you already shared it, contact your operator immediately and change your PIN."]
    },
    transfer: {
      fr: ["Vérifiez votre solde depuis l'application officielle ou le code USSD de votre opérateur avant toute action.", "Ne « renvoyez » jamais de l'argent à la demande d'un inconnu : le dépôt annoncé est probablement faux."],
      en: ["Check your balance from the official app or your operator's USSD code before doing anything.", "Never “send back” money at a stranger's request: the announced deposit is probably fake."]
    },
    block: {
      fr: ["Ne cliquez pas sur le lien et ne saisissez aucune information sur le site qu'il ouvre.", "Vérifiez l'état de votre compte via l'application officielle ou le service client."],
      en: ["Do not click the link or enter any information on the site it opens.", "Check your account status through the official app or customer service."]
    },
    lottery: {
      fr: ["Vous n'avez pas gagné de concours auquel vous n'avez pas participé : ignorez le message.", "Ne payez jamais de « frais de déblocage » pour recevoir un gain."],
      en: ["You cannot win a contest you did not enter: ignore the message.", "Never pay “release fees” to receive a prize."]
    },
    agent: {
      fr: ["Raccrochez et rappelez uniquement le numéro officiel de votre opérateur.", "Un agent légitime ne vous demande jamais de code secret ni de paiement pour « vérifier » votre compte."],
      en: ["Hang up and call back only your operator's official number.", "A legitimate agent never asks for a PIN or a payment to “verify” your account."]
    },
    fee: {
      fr: ["Méfiez-vous de toute offre exigeant un paiement préalable (crédit, emploi, colis, héritage).", "Ne versez aucune somme à un inconnu avant d'avoir vérifié l'offre auprès d'une source officielle."],
      en: ["Be wary of any offer requiring upfront payment (loan, job, parcel, inheritance).", "Do not pay a stranger before verifying the offer with an official source."]
    },
    ussd: {
      fr: ["Ne composez jamais un code USSD dicté par un inconnu : certains codes déclenchent un transfert ou redirigent vos appels.", "Vérifiez la signification d'un code auprès de votre opérateur avant de l'utiliser."],
      en: ["Never dial a USSD code dictated by a stranger: some codes trigger a transfer or divert your calls.", "Check what a code does with your operator before using it."]
    },
    link: {
      fr: ["N'ouvrez pas les liens reçus de sources inconnues ; saisissez plutôt l'adresse officielle vous-même.", "Vérifiez le nom de domaine : les faux sites imitent des noms connus avec des tirets ou des extensions inhabituelles."],
      en: ["Do not open links from unknown sources; type the official address yourself instead.", "Check the domain name: fake sites imitate known names with hyphens or unusual extensions."]
    },
    none: {
      fr: ["Aucun signal d'alerte majeur détecté, mais restez vigilant.", "En cas de doute, contactez votre opérateur par un canal officiel."],
      en: ["No major warning sign detected, but stay vigilant.", "If in doubt, contact your operator through an official channel."]
    }
  };

  var GENERAL_RECOS = {
    fr: ["Bloquez et signalez le numéro à votre opérateur.", "Aidez les autres : signalez cette arnaque via la page « Contribuer »."],
    en: ["Block the number and report it to your operator.", "Help others: report this scam through the “Contribute” page."]
  };

  var smsInput = $("#smsInput");
  var analyzeBtn = $("#analyzeBtn");

  function updateCount() { $("#charCount").textContent = smsInput.value.length + " / 2000"; }
  smsInput.addEventListener("input", updateCount);
  $("#clearBtn").addEventListener("click", function () {
    smsInput.value = ""; updateCount(); smsInput.focus();
    $("#reportBody").hidden = true; $("#reportEmpty").hidden = false; lastResult = null;
  });
  $("#sampleBtn").addEventListener("click", function () {
    smsInput.value = currentLang === "en"
      ? "URGENT: Your Mobile Money account has been suspended. Verify your identity within 24h at http://wave-ci-verif.xyz and send your secret PIN to avoid permanent closure."
      : "URGENT : Votre compte Mobile Money est suspendu. Vérifiez votre identité dans les 24h sur http://wave-ci-verif.xyz et envoyez votre code secret pour éviter la fermeture définitive.";
    updateCount();
  });

  analyzeBtn.addEventListener("click", function () {
    var txt = smsInput.value.trim();
    if (!txt) {
      smsInput.focus();
      smsInput.style.borderColor = "#c81e1e";
      setTimeout(function () { smsInput.style.borderColor = ""; }, 1200);
      return;
    }
    runAnalysis(txt);
  });

  var analysisBusy = false;
  function runAnalysis(txt) {
    if (analysisBusy) return Promise.resolve();
    analysisBusy = true;
    var label = analyzeBtn.textContent;
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = t("Analyse en cours…", "Analyzing…");
    return analyzeAny(txt).then(function (r) {
      renderReport(r);
      if (window.matchMedia("(max-width: 960px)").matches) $("#reportCard").scrollIntoView({ behavior: "smooth", block: "start" });
    }).then(function () {
      analysisBusy = false;
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = label;
    });
  }

  function selectTab(name) {
    ["text", "image"].forEach(function (n) {
      var on = n === name;
      var tab = $("#tab-" + n), panel = $("#panel-" + n);
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", String(on));
      panel.hidden = !on;
    });
  }
  $("#tab-text").addEventListener("click", function () { selectTab("text"); });
  $("#tab-image").addEventListener("click", function () { selectTab("image"); });

  var dropzone = $("#dropzone"), fileInput = $("#fileInput"), ocrStatus = $("#ocrStatus");
  var currentFile = null, previewUrl = null, ocrBusy = false;

  function updateOcrIdle() {
    if (!ocrBusy && !currentFile) ocrStatus.textContent = "";
  }
  function setStatus(msg) { ocrStatus.textContent = msg; }

  dropzone.addEventListener("click", function () { fileInput.click(); });
  dropzone.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
  ["dragenter", "dragover"].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add("is-over"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove("is-over"); });
  });
  dropzone.addEventListener("drop", function (e) {
    if (e.dataTransfer && e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener("change", function () { if (fileInput.files[0]) setFile(fileInput.files[0]); });
  $("#removeImg").addEventListener("click", clearFile);

  function setFile(f) {
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) {
      setStatus(t("Format non pris en charge. Utilisez PNG, JPG ou WebP.", "Unsupported format. Use PNG, JPG or WebP."));
      return;
    }
    if (f.size > CONFIG.MAX_IMAGE_BYTES) {
      setStatus(t("Image trop volumineuse (8 Mo maximum).", "Image too large (8 MB maximum)."));
      return;
    }
    clearFile();
    currentFile = f;
    previewUrl = URL.createObjectURL(f);
    $("#previewImg").src = previewUrl;
    $("#preview").hidden = false;
    dropzone.hidden = true;
    setStatus("");
  }
  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null; currentFile = null; fileInput.value = "";
    $("#preview").hidden = true; dropzone.hidden = false; setStatus("");
  }

  function loadTesseract() {
    return new Promise(function (resolve, reject) {
      if (window.Tesseract) return resolve();
      var s = document.createElement("script");
      s.src = CONFIG.TESSERACT_URL;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("load")); };
      document.head.appendChild(s);
    });
  }

  function runOcr() {
    ocrBusy = true;
    analyzeBtn.disabled = true;
    setStatus(t("Chargement du moteur de lecture…", "Loading the text-recognition engine…"));
    return loadTesseract().then(function () {
      return window.Tesseract.recognize(currentFile, "fra+eng", {
        logger: function (m) {
          if (m.status === "recognizing text") {
            setStatus(t("Lecture du texte… ", "Reading text… ") + Math.round(m.progress * 100) + " %");
          }
        }
      });
    }).then(function (res) {
      var text = (res && res.data && res.data.text || "").trim();
      if (!text) {
        setStatus(t("Aucun texte lisible détecté. Essayez une capture plus nette ou collez le texte.", "No readable text detected. Try a sharper screenshot or paste the text."));
        return;
      }
      smsInput.value = text.slice(0, 2000);
      updateCount();
      setStatus(t("Texte extrait. Vous pouvez le corriger dans l'onglet « Texte du SMS ».", "Text extracted. You can edit it in the “SMS text” tab."));
      ocrBusy = false; analyzeBtn.disabled = false;
      return runAnalysis(smsInput.value);
    }).catch(function () {
      setStatus(t("La lecture de l'image a échoué (connexion requise la première fois). Collez le texte à la place.", "Reading the image failed (a connection is required the first time). Paste the text instead."));
    }).then(function () {
      ocrBusy = false; analyzeBtn.disabled = false;
    });
  }

  analyzeBtn.addEventListener("click", function (e) {
    if (!$("#panel-image").hidden && currentFile && !ocrBusy) {
      e.stopImmediatePropagation();
      runOcr();
    }
  }, true);

  var form = $("#reportForm"), formError = $("#formError"), formSuccess = $("#formSuccess");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    formError.hidden = true; formSuccess.hidden = true;

    var text = $("#cText").value.trim();
    if (text.length < 10) {
      formError.textContent = t("Veuillez coller le contenu du message (10 caractères minimum).", "Please paste the message content (10 characters minimum).");
      formError.hidden = false; $("#cText").focus(); return;
    }
    if (!$("#cConsent").checked) {
      formError.textContent = t("Veuillez accepter la confirmation pour continuer.", "Please accept the confirmation to continue.");
      formError.hidden = false; return;
    }

    var payload = {
      scam_type: $("#cType").value,
      channel: $("#cChannel").value,
      operator: $("#cOperator").value,
      country: $("#cCountry").value,
      text: text,
      sender: $("#cSender").value.trim(),
      lang: currentLang,
      submitted_at: new Date().toISOString()
    };

    var done = function () {
      formSuccess.textContent = t("Merci ! Votre signalement a été envoyé. Vous aidez à protéger d'autres utilisateurs.", "Thank you! Your report has been sent. You are helping protect other users.");
      formSuccess.hidden = false;
      form.reset();
    };

    var endpoint = CONFIG.REPORT_ENDPOINT || (backendAvailable() ? CONFIG.API_BASE + "/api/reports" : "");
    if (endpoint) {
      payload.consent = true;
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) throw new Error("http");
        done();
      }).catch(function () {
        formError.textContent = t("L'envoi a échoué. Réessayez plus tard.", "Sending failed. Please try again later.");
        formError.hidden = false;
      });
    } else {
      var subject = encodeURIComponent("[iDetector] Signalement : " + payload.scam_type);
      var bodyTxt = encodeURIComponent(
        "Type: " + payload.scam_type + "\nCanal: " + payload.channel + "\nService: " + payload.operator +
        "\nPays: " + payload.country + "\nExpéditeur: " + (payload.sender || "-") + "\n\nMessage:\n" + payload.text
      );
      window.location.href = "mailto:" + CONFIG.REPORT_EMAIL + "?subject=" + subject + "&body=" + bodyTxt;
      done();
    }
  });

  captureFrench();
  $all("[data-link]").forEach(function (a) {
    var key = a.getAttribute("data-link"), v = CONFIG.LINKS[key];
    if (!v) { a.hidden = true; return; }
    a.href = key === "email" ? "mailto:" + v : v;
    if (a.hasAttribute("data-link-text")) a.textContent = v;
  });
  $all(".lang-btn").forEach(function (b) {
    b.addEventListener("click", function () { applyLang(b.getAttribute("data-lang")); });
  });

  var saved = store("idetector.lang");
  var initial = saved || ((navigator.language || "fr").toLowerCase().indexOf("en") === 0 ? "en" : "fr");
  if (initial !== "fr") applyLang(initial); else document.documentElement.lang = "fr";

  window.addEventListener("hashchange", route);
  route();
  updateCount();
})();
