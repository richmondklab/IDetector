"use strict";

const config = require("./config");

class LlmError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "LlmError";
    this.status = status;
  }
}

function buildFallbackResponse({ text, lang = "fr" }) {
  const normalized = (text || "").trim();
  const low = normalized.length > 0 ? /\b(code|pin|otp|mot de passe|bloquer|urgent|renvoyer|urgent|envoyer)\b/i.test(normalized) : false;
  const highRisk = low || /http|bit\.ly|tinyurl|wave|orange|mtn|moov/i.test(normalized);

  return {
    riskLevel: highRisk ? "Élevé" : "Faible",
    scamType: highRisk ? "Faux message de blocage de compte (opérateur non précisé)" : "Aucune arnaque détectée",
    confidenceScore: highRisk ? 74 : 62,
    analysis: 
      lang === "en"
        ? "The message contains indicators of urgency or a request for information, but the automatic AI is not configured. This fallback result is only a local warning to stay cautious."
        : "Le message contient des indices de pression ou de demande d'information, mais l'IA automatique n'est pas configurée. Ce résultat de secours n'est qu'un avertissement local pour rester prudent.",
    recommendation:
      lang === "en"
        ? "Do not click or reply. Verify the situation through the official app or your operator's customer service."
        : "Ne cliquez pas et ne répondez pas. Vérifiez la situation via l'application officielle ou le service client de votre opérateur.",
  };
}

async function analyzeWithLLM({ text = "", image = null, lang = "fr" }) {
  if (!config.llm.apiKey || config.llm.apiKey === "sk-remplacez-moi") {
    return buildFallbackResponse({ text, lang });
  }

  const prompt = `Tu es iGuard, analyste expert en arnaques Mobile Money. Analyse en ${lang === "en" ? "anglais" : "français"}. Réponds uniquement en JSON avec exactement ces clés : riskLevel, scamType, confidenceScore, analysis, recommendation.\n\nContenu : ${String(text || "").slice(0, 1800)}`;

  try {
    const response = await fetch(`${config.llm.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.llm.apiKey}`,
      },
      body: JSON.stringify({
        model: config.llm.model,
        temperature: config.llm.temperature,
        max_tokens: config.llm.maxTokens,
        seed: config.llm.seed,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: "Tu analyses les arnaques Mobile Money et tu réponds au format JSON strict." }, { role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new LlmError(response.status, `Service d'IA indisponible (${response.status})` + (errBody ? `: ${errBody}` : ""));
    }

    const data = await response.json();
    const payload = data.choices?.[0]?.message?.content;
    if (!payload) throw new LlmError(502, "Réponse IA vide.");

    const parsed = JSON.parse(payload);
    const riskLevel = ["Élevé", "Moyen", "Faible"].includes(parsed.riskLevel) ? parsed.riskLevel : "Moyen";
    const scamType = typeof parsed.scamType === "string" && parsed.scamType.trim() ? parsed.scamType : "Aucune arnaque détectée";
    const confidenceScore = Math.max(0, Math.min(100, Number(parsed.confidenceScore) || 50));

    return {
      riskLevel,
      scamType,
      confidenceScore,
      analysis: typeof parsed.analysis === "string" ? parsed.analysis : "Analyse effectuée.",
      recommendation: typeof parsed.recommendation === "string" ? parsed.recommendation : "Vérifiez via le canal officiel de votre opérateur.",
    };
  } catch (err) {
    if (err instanceof LlmError) throw err;
    throw new LlmError(503, "Erreur lors de l'appel au fournisseur LLM.");
  }
}

module.exports = { analyzeWithLLM, LlmError };
