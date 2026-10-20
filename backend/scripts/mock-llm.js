"use strict";

const express = require("express");
const app = express();

app.use(express.json({ limit: "1mb" }));

app.post("/v1/chat/completions", (req, res) => {
  const text = String(req.body?.messages?.at(-1)?.content || "");
  const isHigh = /(code|pin|otp|bloc|urgent|renvoyer|gagner|frais|lien|bit\.ly|tinyurl)/i.test(text);

  const payload = {
    id: "mock-llm",
    object: "chat.completion",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: JSON.stringify({
          riskLevel: isHigh ? "Élevé" : "Faible",
          scamType: isHigh ? "Faux message de blocage de compte (opérateur non précisé)" : "Aucune arnaque détectée",
          confidenceScore: isHigh ? 88 : 70,
          analysis: "Simulation locale du modèle et réponse JSON de démonstration.",
          recommendation: "Vérifiez via l'application officielle de votre opérateur avant d'agir.",
        }),
      },
      finish_reason: "stop",
    }],
  };

  res.json(payload);
});

app.listen(4010, () => console.log("Mock LLM listening on http://localhost:4010/v1/chat/completions"));
