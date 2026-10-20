"use strict";

const crypto = require("crypto");
require("dotenv").config();

function int(name, fallback) {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function float(name, fallback, min, max) {
  if (process.env[name] === undefined || process.env[name] === "") return fallback;
  const n = parseFloat(process.env[name]);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

const isProd = process.env.NODE_ENV === "production";

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const config = {
  isProd,
  port: int("PORT", 3000),
  allowedOrigins,

  llm: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
    timeoutMs: int("LLM_TIMEOUT_MS", 30000),
    temperature: float("LLM_TEMPERATURE", 0.1, 0, 1),
    maxTokens: int("LLM_MAX_TOKENS", 700),
    jsonMode: process.env.LLM_JSON_MODE === "json_schema" ? "json_schema" : "json_object",
    seed: process.env.LLM_SEED === "" ? null : Number.isFinite(parseInt(process.env.LLM_SEED, 10)) ? parseInt(process.env.LLM_SEED, 10) : 42,
  },

  limits: {
    maxTextChars: 2000,
    maxImageBytes: int("MAX_IMAGE_MB", 8) * 1024 * 1024,
    ratePerMinute: int("RATE_LIMIT_PER_MINUTE", 20),
  },

  dbPath: process.env.DB_PATH || "./data/idetector.db",

  admin: {
    passwordHash: (process.env.ADMIN_PASSWORD_HASH || "").trim(),
    password: process.env.ADMIN_PASSWORD || "",
    sessionSecret: process.env.ADMIN_SESSION_SECRET || "",
    sessionHours: int("ADMIN_SESSION_HOURS", 8),
  },
};

const weakPlainPassword = config.admin.password !== "" && config.admin.password.length < 10;
config.admin.enabled = !weakPlainPassword && (Boolean(config.admin.passwordHash) || config.admin.password !== "");

config.admin.ephemeralSecret = false;
if (!config.admin.sessionSecret && !isProd) {
  config.admin.sessionSecret = crypto.randomBytes(32).toString("hex");
  config.admin.ephemeralSecret = true;
}

config.validate = function validate() {
  const problems = [];
  if (isProd && allowedOrigins.length === 0) {
    console.warn("[config] ALLOWED_ORIGINS vide : seul le site servi par ce serveur peut appeler l'API depuis un navigateur.");
  }
  if (!config.llm.apiKey || config.llm.apiKey === "sk-remplacez-moi") {
    console.warn("[config] OPENAI_API_KEY manquante : /api/analyze renverra 503 tant qu'elle n'est pas définie.");
  }
  if (weakPlainPassword) {
    console.warn("[config] ADMIN_PASSWORD fait moins de 10 caractères : administration DÉSACTIVÉE.");
  } else if (!config.admin.enabled) {
    console.warn("[config] Administration DÉSACTIVÉE : définissez ADMIN_PASSWORD_HASH (npm run hash-password) dans .env.");
  } else {
    if (isProd && config.admin.sessionSecret.length < 32) {
      problems.push("ADMIN_SESSION_SECRET (32 caractères minimum) est obligatoire en production.");
    }
    if (config.admin.ephemeralSecret) {
      console.warn("[config] ADMIN_SESSION_SECRET absent : secret temporaire, les sessions admin sautent à chaque redémarrage.");
    }
    if (isProd && !config.admin.passwordHash) {
      console.warn("[config] ADMIN_PASSWORD est en clair : préférez ADMIN_PASSWORD_HASH (npm run hash-password).");
    }
  }
  if (problems.length) {
    problems.forEach((p) => console.error("[config] " + p));
    process.exit(1);
  }
};

module.exports = config;
