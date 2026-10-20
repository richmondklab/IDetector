"use strict";

const crypto = require("crypto");
const config = require("./config");
const { verifyHash } = require("./password");

const COOKIE_NAME = "idetector_admin";
const COOKIE_PATH = "/api/admin";
const CSRF_HEADER_VALUE = "iDetector-Admin";
const TTL_MS = config.admin.sessionHours * 3600 * 1000;

const sha256 = (s) => crypto.createHash("sha256").update(s).digest();
const fail = (res, status, error, message) => res.status(status).json({ error, message });

function isConfigured() {
  return config.admin.enabled;
}

function verifyPassword(input) {
  if (typeof input !== "string" || input.length === 0 || input.length > 200) return false;
  if (config.admin.passwordHash) return verifyHash(input, config.admin.passwordHash);
  return crypto.timingSafeEqual(sha256(input), sha256(config.admin.password));
}

const sign = (data) => crypto.createHmac("sha256", config.admin.sessionSecret).update(data).digest("base64url");

function issueToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TTL_MS, n: crypto.randomBytes(8).toString("hex") })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (typeof token !== "string") return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isFinite(exp) && exp > Date.now();
  } catch {
    return false;
  }
}

function readCookie(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0 || part.slice(0, i).trim() !== COOKIE_NAME) continue;
    try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
  }
  return null;
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "strict",
  secure: config.isProd,
  path: COOKIE_PATH,
});

function setSessionCookie(res) {
  res.cookie(COOKIE_NAME, issueToken(), { ...cookieOptions(), maxAge: TTL_MS });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

function requireCsrfHeader(req, res, next) {
  if (req.get("x-requested-with") !== CSRF_HEADER_VALUE) {
    return fail(res, 403, "csrf", "En-tête de sécurité manquant.");
  }
  const site = req.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return fail(res, 403, "cross_origin", "Requête refusée : origine différente.");
  }
  const origin = req.get("origin");
  if (origin) {
    let host;
    try { host = new URL(origin).host; } catch { return fail(res, 403, "cross_origin", "Origine invalide."); }
    if (host !== req.get("host")) return fail(res, 403, "cross_origin", "Requête refusée : origine différente.");
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!isConfigured()) {
    return fail(res, 503, "admin_disabled", "L'administration n'est pas configurée (mot de passe admin manquant dans .env).");
  }
  if (!verifyToken(readCookie(req))) return fail(res, 401, "unauthorized", "Connexion requise.");
  next();
}

module.exports = { isConfigured, verifyPassword, setSessionCookie, clearSessionCookie, requireAdmin, requireCsrfHeader };
