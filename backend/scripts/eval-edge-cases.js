"use strict";

const fs = require("fs");
const path = require("path");
const { analyzeWithLLM } = require("../src/llm");

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "../prompts/edge-cases.json"), "utf8"));

(async () => {
  let ok = 0;
  const errors = [];

  for (const item of cases) {
    try {
      const result = await analyzeWithLLM({ text: item.text, lang: item.lang || "fr" });
      const expected = item.expect || {};
      const riskOk = expected.riskLevel ? expected.riskLevel.includes(result.riskLevel) : true;
      const confidenceOk = expected.minConfidence ? result.confidenceScore >= expected.minConfidence : true;
      const confidenceMaxOk = expected.maxConfidence ? result.confidenceScore <= expected.maxConfidence : true;
      const scamTypeOk = expected.scamTypeIncludes ? expected.scamTypeIncludes.every((needle) => result.scamType.toLowerCase().includes(needle.toLowerCase())) : true;
      const recommendationOk = expected.recommendationIncludes ? expected.recommendationIncludes.every((needle) => result.recommendation.toLowerCase().includes(needle.toLowerCase())) : true;

      const passed = riskOk && confidenceOk && confidenceMaxOk && scamTypeOk && recommendationOk;
      console.log(`${passed ? "OK" : "ÉCHEC"} :: ${item.id} :: ${result.riskLevel} :: ${result.scamType}`);
      if (!passed) {
        errors.push({ id: item.id, result, expected });
      }
      if (passed) ok++;
    } catch (err) {
      console.log(`ÉCHEC :: ${item.id} :: ${err.message}`);
      errors.push({ id: item.id, error: err.message });
    }
  }

  console.log(`\n${ok}/${cases.length} cas validés.`);
  if (errors.length) process.exit(1);
})();
