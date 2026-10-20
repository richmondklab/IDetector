"use strict";

const { analyzeWithLLM } = require("./llm");
const { setReportTriage } = require("./db");

async function triageReport(reportId, text, lang = "fr") {
  try {
    const result = await analyzeWithLLM({ text, lang });
    setReportTriage(reportId, {
      riskLevel: result.riskLevel,
      scamType: result.scamType,
      confidence: result.confidenceScore,
      analysis: result.analysis,
    });
    return result;
  } catch (err) {
    return null;
  }
}

module.exports = { triageReport };
