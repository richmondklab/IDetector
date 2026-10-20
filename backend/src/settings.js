"use strict";

const config = require("./config");
const { getSettingsRaw, saveSettingsRaw } = require("./db");

const DEFAULTS = Object.freeze({
  maintenanceMode: false,
  maintenanceMessage: "iDetector est en maintenance. Réessayez dans quelques instants.",
  cautionConfidenceThreshold: 50,
  reviewConfidenceThreshold: 60,
  highRiskAlertPerHour: 0,
  rateLimitPerMinute: config.limits.ratePerMinute,
  autoTriageReports: true,
});

const RULES = {
  maintenanceMode: { type: "boolean" },
  maintenanceMessage: { type: "string", min: 1, max: 300 },
  cautionConfidenceThreshold: { type: "int", min: 0, max: 100 },
  reviewConfidenceThreshold: { type: "int", min: 0, max: 100 },
  highRiskAlertPerHour: { type: "int", min: 0, max: 100000 },
  rateLimitPerMinute: { type: "int", min: 1, max: 600 },
  autoTriageReports: { type: "boolean" },
};

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function check(key, value) {
  const rule = RULES[key];
  if (rule.type === "boolean") {
    return typeof value === "boolean" ? { value } : { error: "Choisissez activé ou désactivé." };
  }
  if (rule.type === "int") {
    return Number.isInteger(value) && value >= rule.min && value <= rule.max
      ? { value }
      : { error: `Entrez un nombre entier entre ${rule.min} et ${rule.max}.` };
  }
  const s = typeof value === "string" ? value.trim() : "";
  return s.length >= rule.min && s.length <= rule.max
    ? { value: s }
    : { error: `Entrez un texte de ${rule.min} à ${rule.max} caractères.` };
}

let cache = null;

function load() {
  const stored = getSettingsRaw();
  const merged = { ...DEFAULTS };
  for (const key of Object.keys(RULES)) {
    if (has(stored, key)) {
      const r = check(key, stored[key]);
      if (!r.error) merged[key] = r.value;
    }
  }
  cache = merged;
}

function getSettings() {
  if (!cache) load();
  return { ...cache };
}

function updateSettings(patch) {
  const entries = patch && typeof patch === "object" && !Array.isArray(patch) ? Object.entries(patch) : [];
  const errors = {};
  const clean = {};
  for (const [key, value] of entries) {
    if (!has(RULES, key)) { errors[key] = "Réglage inconnu."; continue; }
    const r = check(key, value);
    if (r.error) errors[key] = r.error; else clean[key] = r.value;
  }
  if (!entries.length) errors._ = "Aucun réglage à enregistrer.";
  if (Object.keys(errors).length) return { ok: false, errors };

  saveSettingsRaw(clean);
  cache = { ...getSettings(), ...clean };
  return { ok: true, settings: getSettings() };
}

function applyCaution(result, lang) {
  const { cautionConfidenceThreshold } = getSettings();
  const offMission = /hors mission/i.test(result.scamType);
  if (result.riskLevel === "Faible" && result.confidenceScore < cautionConfidenceThreshold && !offMission) {
    const note =
      lang === "en"
        ? " This assessment is not certain enough to rule out a scam: check with your operator before acting."
        : " Cette évaluation n'est pas assez certaine pour écarter une arnaque : vérifiez auprès de votre opérateur avant d'agir.";
    return { ...result, riskLevel: "Moyen", recommendation: (result.recommendation + note).trim() };
  }
  return result;
}

module.exports = { DEFAULTS, getSettings, updateSettings, applyCaution };
