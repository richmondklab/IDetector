"use strict";

const SCAM_TYPES = ["faux_transfert", "faux_agent", "faux_blocage", "faux_gain", "vol_pin", "autre"];
const CHANNELS = ["sms", "whatsapp", "appel", "autre"];
const OPERATORS = ["wave", "orange", "mtn", "moov", "autre"];
const COUNTRIES = ["CI", "SN", "ML", "BF", "BJ", "TG", "XX"];

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const clean = (s) => s.replace(CONTROL_CHARS, "").trim();

function validateReport(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Corps de requête invalide." };

  const pick = (snake, camel) => (body[snake] !== undefined ? body[snake] : body[camel]);

  const choice = (label, raw, allowed, fallback) => {
    if (raw === undefined || raw === null || raw === "") return { value: fallback };
    return typeof raw === "string" && allowed.includes(raw) ? { value: raw } : { error: `Valeur invalide pour « ${label} ».` };
  };

  const scamType = choice("scam_type", pick("scam_type", "scamType"), SCAM_TYPES, "autre");
  const channel = choice("channel", body.channel, CHANNELS, "autre");
  const operator = choice("operator", body.operator, OPERATORS, "autre");
  const country = choice("country", body.country, COUNTRIES, "XX");
  for (const r of [scamType, channel, operator, country]) if (r.error) return { error: r.error };

  const text = typeof body.text === "string" ? clean(body.text) : "";
  if (text.length < 10) return { error: "Le message doit contenir au moins 10 caractères." };
  if (text.length > 2000) return { error: "Le message dépasse 2 000 caractères." };

  const sender = typeof body.sender === "string" ? clean(body.sender) : "";
  if (sender.length > 200) return { error: "L'expéditeur dépasse 200 caractères." };

  if (body.consent === false) return { error: "Le consentement est requis pour envoyer un signalement." };

  return {
    value: {
      scamType: scamType.value,
      channel: channel.value,
      operator: operator.value,
      country: country.value,
      text,
      sender,
      lang: body.lang === "en" ? "en" : "fr",
    },
  };
}

module.exports = { validateReport, SCAM_TYPES, CHANNELS, OPERATORS, COUNTRIES };
