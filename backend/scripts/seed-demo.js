"use strict";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "yes") {
  console.error("Refusé : les données de démonstration ne doivent jamais être ajoutées en production (ALLOW_DEMO_SEED=yes pour une démo).");
  process.exit(1);
}

const { db } = require("../src/db");

if (process.argv.includes("--if-empty") && db.prepare("SELECT COUNT(*) AS n FROM analyses").get().n > 0) {
  console.log("La base contient déjà des analyses : données de démo non ajoutées.");
  process.exit(0);
}

let seed = 20261018;
function rand() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a, b) => Math.floor(a + rand() * (b - a + 1));
const pickOne = (arr) => arr[Math.floor(rand() * arr.length)];
const weighted = (pairs) => {
  let r = rand() * pairs.reduce((s, p) => s + p[1], 0);
  for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; }
  return pairs[0][0];
};
const iso = (ms) => new Date(ms).toISOString();

const HIGH_TYPES = [
  ["Faux message de blocage de compte (Wave)", 5], ["Vol de code secret / OTP (Orange Money)", 4],
  ["Faux transfert (« envoyé par erreur ») (MTN MoMo)", 4], ["Fausse loterie / faux gain (MTN MoMo)", 3],
  ["Faux agent / faux service client (Moov Money)", 3], ["Lien d'hameçonnage (opérateur non précisé)", 2],
  ["Avance de frais frauduleuse (opérateur non précisé)", 2], ["Manipulation par code USSD (Orange Money)", 1],
];
const MID_TYPES = [
  ["Faux agent / faux service client (opérateur non précisé)", 3], ["Lien d'hameçonnage (opérateur non précisé)", 3],
  ["Faux investissement / pyramide", 1], ["Autre arnaque", 1],
];

const insertAnalysis = db.prepare(`
  INSERT INTO analyses (created_at, input_type, lang, scam_type, risk_level, confidence, text_length, latency_ms, model)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'gpt-4o-mini')
`);
const insertError = db.prepare("INSERT INTO api_errors (created_at, code, message, input_type, latency_ms) VALUES (?, ?, ?, ?, ?)");
const insertReport = db.prepare(`
  INSERT INTO reports (created_at, status, reviewed_at, scam_type, channel, operator, country, lang, text, sender,
                       ai_risk_level, ai_scam_type, ai_confidence, ai_analysis)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'fr', ?, ?, ?, ?, ?, ?)
`);

const REPORTS = [
  ["faux_blocage", "sms", "wave", "[DÉMO] WAVE : votre compte sera bloqué dans 24h. Confirmez votre identité sur http://wave-ci-verif.xyz", "wave-ci-verif.xyz", "Élevé", "Faux message de blocage de compte (Wave)", 96, "Menace de blocage sous 24 h et lien \"wave-ci-verif.xyz\" qui imite Wave avec une extension inhabituelle."],
  ["vol_pin", "whatsapp", "orange", "[DÉMO] Bonjour, c'est le service Orange Money. Envoyez-moi le code que vous venez de recevoir pour annuler une transaction.", "+225 07 00 00 00 01", "Élevé", "Vol de code secret / OTP (Orange Money)", 97, "Demande de communiquer un code reçu par SMS : aucun opérateur ne le fait."],
  ["faux_transfert", "sms", "mtn", "[DÉMO] Je vous ai envoyé 25 000 FCFA par erreur. Pouvez-vous me les renvoyer au 05 00 00 00 02 ? Merci.", "05 00 00 00 02", "Élevé", "Faux transfert (« envoyé par erreur ») (MTN MoMo)", 91, "Scénario classique du dépôt annoncé « par erreur » suivi d'une demande de renvoi."],
  ["faux_gain", "sms", "mtn", "[DÉMO] FÉLICITATIONS ! Vous avez gagné 1 500 000 FCFA au tirage MTN MoMo. Envoyez 10 000 FCFA de frais pour recevoir votre gain.", "05 00 00 00 03", "Élevé", "Fausse loterie / faux gain (MTN MoMo)", 95, "Gain inattendu conditionné au paiement de frais : avance de frais frauduleuse."],
  ["faux_agent", "appel", "moov", "[DÉMO] Appel : « Je suis du service client Moov, votre compte est en danger, donnez-moi votre code secret pour le sécuriser. »", "+225 01 00 00 00 04", "Élevé", "Faux agent / faux service client (Moov Money)", 94, "Usurpation du service client avec demande du code secret."],
  ["faux_blocage", "whatsapp", "orange", "[DÉMO] Votre ligne Orange sera suspendue demain. Mettez à jour vos informations ici : bit.ly/3xYzAb9", "bit.ly/3xYzAb9", "Élevé", "Faux message de blocage de compte (Orange Money)", 90, "Lien raccourci qui masque la destination, associé à une menace de suspension."],
  ["autre", "sms", "autre", "[DÉMO] Offre d'emploi : gagnez 200 000 FCFA par semaine depuis chez vous, contactez-nous sur WhatsApp.", "", "Moyen", "Faux investissement / pyramide", 62, "Promesse de gain élevée et vague, sans lien ni demande de secret : à vérifier."],
  ["faux_agent", "sms", "wave", "[DÉMO] Bonjour, c'est le service client. Un problème sur votre compte, rappelez-moi au 07 00 00 00 05.", "07 00 00 00 05", "Moyen", "Faux agent / faux service client (opérateur non précisé)", 66, "Contact non sollicité et vague, sans lien ni demande de code."],
  ["vol_pin", "sms", "wave", "[DÉMO] Pour valider votre dépôt de 5 000 FCFA, répondez avec votre code PIN.", "", "Élevé", "Vol de code secret / OTP (Wave)", 93, "Demande de code PIN pour « valider » un dépôt."],
  ["faux_transfert", "whatsapp", "orange", "[DÉMO] Mon frère c'est l'agent Orange hein, on t'a envoyé 50000 par erreur, renvoie vite sinon on bloque ton compte.", "+225 07 00 00 00 06", "Élevé", "Faux transfert (« envoyé par erreur ») (Orange Money)", 92, "Faux transfert combiné à une menace de blocage."],
  ["autre", "sms", "autre", "[DÉMO] Promotion ce week-end : doublez vos bonus de recharge dans l'application de votre opérateur.", "", "Faible", "Aucune arnaque détectée", 72, "Promotion plausible, sans lien ni demande de secret."],
  ["faux_gain", "sms", "orange", "[DÉMO] Vous êtes le gagnant du jour ! Cliquez pour réclamer votre cadeau : http://orange-cadeau.top", "orange-cadeau.top", "Élevé", "Fausse loterie / faux gain (Orange Money)", 94, "Faux cadeau avec domaine imitant Orange en .top."],
  ["autre", "appel", "autre", "[DÉMO] Appel d'un inconnu qui demande de composer *555*0700000000*50000# pour annuler un transfert.", "", "Élevé", "Manipulation par code USSD (Orange Money)", 90, "Code USSD dicté par un inconnu."],
  ["faux_blocage", "sms", "mtn", "[DÉMO] MTN MoMo : compte restreint. Rétablissez-le sur http://mtn-momo-secure.click", "mtn-momo-secure.click", "Élevé", "Faux message de blocage de compte (MTN MoMo)", 95, "Lien imitant MTN en .click et menace de restriction."],
];

const seedAll = db.transaction(() => {
  const now = Date.now();
  let analyses = 0;

  for (let d = 89; d >= 0; d--) {
    const dayStart = new Date(now - d * 86400000);
    dayStart.setUTCHours(0, 0, 0, 0);
    const weekday = dayStart.getUTCDay();
    const growth = 0.45 + 0.55 * ((90 - d) / 90);
    const n = Math.round(between(14, 30) * growth * (weekday === 0 || weekday === 6 ? 0.7 : 1));
    for (let i = 0; i < n; i++) {
      const ts = dayStart.getTime() + between(6 * 3600, 23 * 3600) * 1000;
      if (ts > now) continue;
      const risk = weighted([["Élevé", 38], ["Moyen", 27], ["Faible", 35]]);
      const type = risk === "Élevé" ? weighted(HIGH_TYPES) : risk === "Moyen" ? weighted(MID_TYPES) : "Aucune arnaque détectée";
      const confidence = risk === "Élevé" ? between(78, 98) : risk === "Moyen" ? between(48, 78) : between(52, 92);
      const input = weighted([["text", 82], ["image", 14], ["text+image", 4]]);
      insertAnalysis.run(iso(ts), input, weighted([["fr", 90], ["en", 10]]), type, risk, confidence, input === "image" ? 0 : between(40, 420), between(900, 4200));
      analyses++;
    }
  }

  const ERRORS = [[503, "Le service d'analyse est saturé, réessayez dans un instant."], [504, "Le service d'analyse a mis trop de temps à répondre."], [502, "Le service d'analyse a renvoyé une erreur."]];
  for (let i = 0; i < 9; i++) {
    const [code, message] = pickOne(ERRORS);
    insertError.run(iso(now - between(600, 6 * 86400) * 1000), code, message, pickOne(["text", "text", "image"]), between(900, 30000));
  }

  REPORTS.forEach((r, i) => {
    const created = now - (i * 5 + between(0, 4)) * 3600 * 1000 - between(0, 3600) * 1000;
    const status = i < 8 ? "pending" : i < 11 ? "validated" : i < 12 ? "false_positive" : "pending";
    const reviewed = status === "pending" ? null : iso(created + 3600 * 1000);
    const triaged = i !== REPORTS.length - 1;
    insertReport.run(iso(created), status, reviewed, r[0], r[1], r[2], pickOne(["CI", "CI", "CI", "SN", "ML"]), r[3], r[4],
      triaged ? r[5] : null, triaged ? r[6] : null, triaged ? r[7] : null, triaged ? r[8] : null);
  });
  return analyses;
});

const n = seedAll();
console.log(`Données de démonstration ajoutées : ${n} analyses, ${REPORTS.length} signalements, 9 erreurs.`);
