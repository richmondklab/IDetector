"use strict";

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");

const config = require("./src/config");
config.validate();

const { logAnalysis, logError, getStats, insertReport } = require("./src/db");
const { analyzeWithLLM, LlmError } = require("./src/llm");
const { HttpError } = require("./src/errors");
const { getSettings, applyCaution } = require("./src/settings");
const { validateReport } = require("./src/reports");
const { triageReport } = require("./src/triage");
const adminRouter = require("./src/admin");

const app = express();
app.disable("x-powered-by");

if (process.env.TRUST_PROXY) {
  app.set("trust proxy", /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "upgrade-insecure-requests": config.isProd ? [] : null,
        "script-src": ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "'wasm-unsafe-eval'"],
        "worker-src": ["'self'", "blob:"],
        "connect-src": ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://tessdata.projectnaptha.com"],
        "img-src": ["'self'", "data:", "blob:"],
      },
    },
  })
);

const publicCors = cors((req, callback) => {
  const options = { origin: true, methods: ["GET", "POST"], maxAge: 600 };
  const origin = req.get("origin");
  if (!origin) return callback(null, options);
  try {
    if (new URL(origin).host === req.get("host")) return callback(null, options);
  } catch {}
  if (!config.isProd && config.allowedOrigins.length === 0) return callback(null, options);
  if (config.allowedOrigins.includes(origin)) return callback(null, options);
  return callback(new Error("Origine non autorisée par CORS"));
});
app.use(["/api/analyze", "/api/reports", "/api/stats", "/api/health"], publicCors);
app.use(express.json({ limit: "20kb" }));

function maintenanceGuard(req, res, next) {
  const s = getSettings();
  if (s.maintenanceMode) return res.status(503).json({ error: "maintenance", message: s.maintenanceMessage });
  next();
}

const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: () => getSettings().rateLimitPerMinute,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Trop de requêtes. Réessayez dans une minute." },
});

const reportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Trop de signalements envoyés. Réessayez plus tard." },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.limits.maxImageBytes, files: 1, fields: 5 },
  fileFilter(req, file, cb) {
    if (["image/png", "image/jpeg", "image/webp"].includes(file.mimetype)) return cb(null, true);
    cb(new HttpError(400, "invalid_image", "Format d'image non pris en charge (PNG, JPG ou WebP)."));
  },
});

function sniffImageMime(buf) {
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 12 && buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

function safely(label, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(`[db] ${label} impossible :`, err.message);
    return null;
  }
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    llmConfigured: Boolean(config.llm.apiKey) && config.llm.apiKey !== "sk-remplacez-moi",
    maintenance: getSettings().maintenanceMode,
  });
});

app.post("/api/analyze", maintenanceGuard, analyzeLimiter, upload.single("image"), async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const lang = req.body?.lang === "en" ? "en" : "fr";

    if (text.length > config.limits.maxTextChars) {
      throw new HttpError(400, "text_too_long", `Le texte dépasse ${config.limits.maxTextChars} caractères.`);
    }

    let image = null;
    if (req.file) {
      const mime = sniffImageMime(req.file.buffer);
      if (!mime) throw new HttpError(400, "invalid_image", "Le fichier envoyé n'est pas une image valide.");
      image = { buffer: req.file.buffer, mime };
    }

    if (!text && !image) {
      throw new HttpError(400, "missing_input", "Envoyez un texte (champ « text ») et/ou une capture d'écran (champ « image »).");
    }

    const inputType = text && image ? "text+image" : image ? "image" : "text";

    let result;
    try {
      result = await analyzeWithLLM({ text, image, lang });
    } catch (err) {
      if (err instanceof LlmError) {
        safely("journal d'erreurs", () => logError({ code: err.status, message: err.message, inputType, latencyMs: Date.now() - startedAt }));
      }
      throw err;
    }

    result = applyCaution(result, lang);

    const analysisId = safely("écriture", () =>
      logAnalysis({
        inputType,
        lang,
        scamType: result.scamType,
        riskLevel: result.riskLevel,
        confidence: result.confidenceScore,
        textLength: text.length,
        latencyMs: Date.now() - startedAt,
        model: config.llm.model,
      })
    );

    res.json({ analysisId, ...result });
  } catch (err) {
    next(err);
  }
});

app.post("/api/reports", reportLimiter, (req, res, next) => {
  try {
    const { value, error } = validateReport(req.body);
    if (error) throw new HttpError(400, "invalid_report", error);
    const id = insertReport(value);
    if (getSettings().autoTriageReports) triageReport(id, value.text, value.lang).catch(() => {});
    res.status(201).json({ status: "received", message: "Merci ! Votre signalement sera examiné par notre équipe." });
  } catch (err) {
    next(err);
  }
});

app.get("/api/stats", (req, res, next) => {
  try {
    res.json(getStats());
  } catch (err) {
    next(err);
  }
});

app.use("/api/admin", adminRouter);

const frontendDir = path.join(__dirname, "../frontend");
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(frontendDir, "index.html"));
  });
}

app.use((err, req, res, next) => {
  console.error("[server]", err);
  const status = err?.status || 500;
  const code = err?.code || "internal_error";
  const message = err?.message || "Erreur interne du serveur.";
  res.status(status).json({ error: code, message });
});

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`iDetector backend listening on http://localhost:${PORT}`);
});
