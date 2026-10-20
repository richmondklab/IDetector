"use strict";

const { getSettingsRaw, saveSettingsRaw } = require("./db");

const DEFAULTS = Object.freeze({
  maintenanceMode: false,
  maintenanceMessage: "iDetector est en maintenance. Réessayez dans quelques instants.",
  cautionConfidenceThreshold: 50,
  reviewConfidenceThreshold: 60,
  highRiskAlertPerHour: 0,
  rateLimitPerMinute: 20,
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

function applyCaution(result, lang) {
  const settings = getSettingsRaw();
  const threshold = settings.cautionConfidenceThreshold ?? DEFAULTS.cautionConfidenceThreshold;
  const offMission = /hors mission/i.test(result.scamType);
  if (result.riskLevel === "Faible" && result.confidenceScore < threshold && !offMission) {
    const note = lang === "en"
      ? " This assessment is not certain enough to rule out a scam: check with your operator before acting."
      : " Cette évaluation n'est pas assez certaine pour écarter une arnaque : vérifiez auprès de votre opérateur avant d'agir.";
    return { ...result, riskLevel: "Moyen", recommendation: (result.recommendation + note).trim() };
  }
  return result;
}

module.exports = { DEFAULTS, RULES, applyCaution, getSettingsRaw, saveSettingsRaw };
