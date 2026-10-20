"use strict";

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const config = require("./config");

const dbFile = path.resolve(config.dbPath);
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new Database(dbFile);
db.pragma("journal_mode = WAL");

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
const STATUSES = ["pending", "validated", "false_positive"];
const RISKS = ["Élevé", "Moyen", "Faible"];

db.exec(`
  CREATE TABLE IF NOT EXISTS analyses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at   TEXT    NOT NULL DEFAULT (${NOW}),
    input_type   TEXT    NOT NULL CHECK (input_type IN ('text','image','text+image')),
    lang         TEXT    NOT NULL,
    scam_type    TEXT    NOT NULL,
    risk_level   TEXT    NOT NULL,
    confidence   INTEGER NOT NULL,
    text_length  INTEGER NOT NULL DEFAULT 0,
    latency_ms   INTEGER NOT NULL DEFAULT 0,
    model        TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at);
  CREATE INDEX IF NOT EXISTS idx_analyses_scam    ON analyses(scam_type);
  CREATE INDEX IF NOT EXISTS idx_analyses_risk    ON analyses(risk_level);

  CREATE TABLE IF NOT EXISTS api_errors (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at   TEXT    NOT NULL DEFAULT (${NOW}),
    code         INTEGER NOT NULL,
    message      TEXT    NOT NULL,
    input_type   TEXT,
    latency_ms   INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_api_errors_created ON api_errors(created_at);

  CREATE TABLE IF NOT EXISTS reports (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at     TEXT NOT NULL DEFAULT (${NOW}),
    status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','validated','false_positive')),
    reviewed_at    TEXT,
    scam_type      TEXT NOT NULL,
    channel        TEXT NOT NULL,
    operator       TEXT NOT NULL,
    country        TEXT NOT NULL,
    lang           TEXT NOT NULL DEFAULT 'fr',
    text           TEXT NOT NULL,
    sender         TEXT NOT NULL DEFAULT '',
    ai_risk_level  TEXT CHECK (ai_risk_level IS NULL OR ai_risk_level IN ('Élevé','Moyen','Faible')),
    ai_scam_type   TEXT,
    ai_confidence  INTEGER,
    ai_analysis    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);

  CREATE TABLE IF NOT EXISTS platform_settings (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  );
`);

function run(sql, params = {}, method = "all") {
  const stmt = db.prepare(sql);
  return Object.keys(params).length ? stmt[method](params) : stmt[method]();
}

const clampInt = (v, def, min, max) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

function paging(page, pageSize) {
  const p = clampInt(page, 1, 1, 1000000);
  const s = clampInt(pageSize, 20, 1, 100);
  return { page: p, pageSize: s, offset: (p - 1) * s };
}

function dayStartISO(daysAgo) {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysAgo)).toISOString();
}

function fillDays(rows, n) {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const r = byDay.get(day);
    out.push({ day, total: r ? r.total : 0, high: r ? r.high || 0 : 0 });
  }
  return out;
}

const BASE_TYPE =
  "CASE WHEN instr(scam_type, ' (') > 0 THEN substr(scam_type, 1, instr(scam_type, ' (') - 1) ELSE scam_type END";

const insertAnalysis = db.prepare(`
  INSERT INTO analyses (input_type, lang, scam_type, risk_level, confidence, text_length, latency_ms, model)
  VALUES (@inputType, @lang, @scamType, @riskLevel, @confidence, @textLength, @latencyMs, @model)
`);
const insertApiError = db.prepare(`
  INSERT INTO api_errors (code, message, input_type, latency_ms)
  VALUES (@code, @message, @inputType, @latencyMs)
`);

function logAnalysis(entry) {
  return Number(insertAnalysis.run(entry).lastInsertRowid);
}

function logError(entry) {
  return Number(insertApiError.run(entry).lastInsertRowid);
}

function getStats() {
  const total = run(
    "SELECT COUNT(*) AS n, ROUND(AVG(confidence), 1) AS avgConfidence, ROUND(AVG(latency_ms)) AS avgLatencyMs FROM analyses",
    {},
    "get"
  );
  const toMap = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r.n]));
  const byRisk = toMap(run("SELECT risk_level, COUNT(*) AS n FROM analyses GROUP BY risk_level"), "risk_level");
  const byScamType = toMap(
    run(`SELECT ${BASE_TYPE} AS base_type, COUNT(*) AS n FROM analyses GROUP BY base_type ORDER BY n DESC`),
    "base_type"
  );
  const byInput = toMap(run("SELECT input_type, COUNT(*) AS n FROM analyses GROUP BY input_type"), "input_type");
  const days = run(
    `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS total,
            SUM(CASE WHEN risk_level = 'Élevé' THEN 1 ELSE 0 END) AS high
     FROM analyses WHERE created_at >= @start GROUP BY day`,
    { start: dayStartISO(29) }
  );
  const risky = byRisk["Élevé"] || 0;

  return {
    totalAnalyses: total.n,
    riskyShare: total.n ? Math.round((risky / total.n) * 1000) / 10 : 0,
    averageConfidence: total.avgConfidence || 0,
    averageLatencyMs: total.avgLatencyMs || 0,
    byRiskLevel: byRisk,
    byScamType,
    byInputType: byInput,
    last30Days: fillDays(days, 30).map((d) => ({ day: d.day, analyses: d.total, risky: d.high })),
  };
}

function getAdminStats(daysParam) {
  const days = clampInt(daysParam, 30, 1, 365);
  const start = dayStartISO(days - 1);
  const one = (sql, params = {}) => run(sql, params, "get");

  const totals = one("SELECT COUNT(*) AS total, SUM(CASE WHEN risk_level = 'Élevé' THEN 1 ELSE 0 END) AS high FROM analyses");

  const series = fillDays(
    run(
      `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS total,
              SUM(CASE WHEN risk_level = 'Élevé' THEN 1 ELSE 0 END) AS high
       FROM analyses WHERE created_at >= @start GROUP BY day`,
      { start }
    ),
    days
  );

  const byRisk = { "Élevé": 0, Moyen: 0, Faible: 0 };
  for (const r of run("SELECT risk_level, COUNT(*) AS n FROM analyses WHERE created_at >= @start GROUP BY risk_level", { start })) {
    if (r.risk_level in byRisk) byRisk[r.risk_level] = r.n;
  }

  const byScamType = run(
    `SELECT ${BASE_TYPE} AS type, COUNT(*) AS count
     FROM analyses
     WHERE created_at >= @start AND risk_level IN ('Moyen', 'Élevé')
     GROUP BY type ORDER BY count DESC, type LIMIT 8`,
    { start }
  );

  const quality = one(
    "SELECT ROUND(AVG(confidence), 1) AS avgConfidence, ROUND(AVG(latency_ms)) AS avgLatencyMs FROM analyses WHERE created_at >= @start",
    { start }
  );
  const since24h = new Date(Date.now() - 86400000).toISOString();
  const sinceHour = new Date(Date.now() - 3600000).toISOString();

  return {
    days,
    kpis: {
      totalAnalyses: totals.total,
      analysesToday: one("SELECT COUNT(*) AS n FROM analyses WHERE created_at >= @t", { t: dayStartISO(0) }).n,
      highRisk: totals.high || 0,
      pendingReports: reportCounts().pending,
    },
    series,
    byRisk,
    byScamType,
    quality: {
      avgConfidence: quality.avgConfidence || 0,
      avgLatencyMs: quality.avgLatencyMs || 0,
      errors24h: one("SELECT COUNT(*) AS n FROM api_errors WHERE created_at >= @t", { t: since24h }).n,
      highRiskLastHour: one("SELECT COUNT(*) AS n FROM analyses WHERE risk_level = 'Élevé' AND created_at >= @t", { t: sinceHour }).n,
    },
  };
}

function listAnalyses({ risk, belowConfidence, page, pageSize } = {}) {
  const where = [];
  const params = {};
  if (RISKS.includes(risk)) { where.push("risk_level = @risk"); params.risk = risk; }
  if (Number.isFinite(belowConfidence) && belowConfidence > 0) { where.push("confidence < @below"); params.below = belowConfidence; }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const pg = paging(page, pageSize);

  const total = run(`SELECT COUNT(*) AS n FROM analyses ${w}`, params, "get").n;
  const rows = run(
    `SELECT id, created_at, input_type, lang, scam_type, risk_level, confidence, latency_ms, model
     FROM analyses ${w} ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset`,
    { ...params, limit: pg.pageSize, offset: pg.offset }
  );
  return {
    items: rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      inputType: r.input_type,
      lang: r.lang,
      riskLevel: r.risk_level,
      scamType: r.scam_type,
      confidence: r.confidence,
      latencyMs: r.latency_ms,
      model: r.model,
    })),
    total,
    page: pg.page,
    pageSize: pg.pageSize,
  };
}

function listErrors({ page, pageSize } = {}) {
  const pg = paging(page, pageSize);
  const total = run("SELECT COUNT(*) AS n FROM api_errors", {}, "get").n;
  const rows = run(
    "SELECT id, created_at, code, message, input_type, latency_ms FROM api_errors ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset",
    { limit: pg.pageSize, offset: pg.offset }
  );
  return {
    items: rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      code: r.code,
      message: r.message,
      inputType: r.input_type,
      latencyMs: r.latency_ms,
    })),
    total,
    page: pg.page,
    pageSize: pg.pageSize,
  };
}

const insertReportStmt = db.prepare(`
  INSERT INTO reports (scam_type, channel, operator, country, lang, text, sender)
  VALUES (@scamType, @channel, @operator, @country, @lang, @text, @sender)
`);

function insertReport(r) {
  return Number(insertReportStmt.run(r).lastInsertRowid);
}

function toReport(r) {
  return {
    id: r.id,
    createdAt: r.created_at,
    status: r.status,
    reviewedAt: r.reviewed_at,
    scamType: r.scam_type,
    channel: r.channel,
    operator: r.operator,
    country: r.country,
    lang: r.lang,
    text: r.text,
    sender: r.sender,
    aiRiskLevel: r.ai_risk_level,
    aiScamType: r.ai_scam_type,
    aiConfidence: r.ai_confidence,
    aiAnalysis: r.ai_analysis,
  };
}

function reportCounts() {
  const counts = { pending: 0, validated: 0, false_positive: 0, all: 0 };
  for (const row of run("SELECT status, COUNT(*) AS n FROM reports GROUP BY status")) {
    if (row.status in counts) counts[row.status] = row.n;
    counts.all += row.n;
  }
  return counts;
}

function listReports({ status, q, page, pageSize } = {}) {
  const where = [];
  const params = {};
  if (STATUSES.includes(status)) { where.push("status = @status"); params.status = status; }
  if (typeof q === "string" && q.trim()) {
    where.push(
      "(text LIKE @q ESCAPE '\\' OR sender LIKE @q ESCAPE '\\' OR scam_type LIKE @q ESCAPE '\\' OR operator LIKE @q ESCAPE '\\' OR ai_scam_type LIKE @q ESCAPE '\\')"
    );
    params.q = `%${q.trim().slice(0, 100).replace(/[\\%_]/g, "\\$&")}%`;
  }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const pg = paging(page, pageSize);

  const total = run(`SELECT COUNT(*) AS n FROM reports ${w}`, params, "get").n;
  const rows = run(
    `SELECT * FROM reports ${w} ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset`,
    { ...params, limit: pg.pageSize, offset: pg.offset }
  );
  return { items: rows.map(toReport), total, page: pg.page, pageSize: pg.pageSize, counts: reportCounts() };
}

function getReport(id) {
  const row = run("SELECT * FROM reports WHERE id = @id", { id }, "get");
  return row ? toReport(row) : null;
}

function setReportStatus(id, status) {
  if (!STATUSES.includes(status)) return null;
  const reviewedAt = status === "pending" ? null : new Date().toISOString();
  const info = db.prepare("UPDATE reports SET status = @status, reviewed_at = @reviewedAt WHERE id = @id").run({ id, status, reviewedAt });
  return info.changes ? getReport(id) : null;
}

function setReportTriage(id, { riskLevel, scamType, confidence, analysis }) {
  db.prepare(
    "UPDATE reports SET ai_risk_level = @riskLevel, ai_scam_type = @scamType, ai_confidence = @confidence, ai_analysis = @analysis WHERE id = @id"
  ).run({ id, riskLevel, scamType, confidence, analysis });
}

function deleteReport(id) {
  return db.prepare("DELETE FROM reports WHERE id = ?").run(id).changes > 0;
}

function getSettingsRaw() {
  const out = {};
  for (const row of run("SELECT key, value FROM platform_settings")) {
    try { out[row.key] = JSON.parse(row.value); } catch {}
  }
  return out;
}

const upsertSetting = db.prepare(
  "INSERT INTO platform_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
);
const saveSettingsRaw = db.transaction((obj) => {
  for (const [k, v] of Object.entries(obj)) upsertSetting.run(k, JSON.stringify(v));
});

module.exports = {
  db,
  logAnalysis,
  logError,
  getStats,
  getAdminStats,
  listAnalyses,
  listErrors,
  insertReport,
  reportCounts,
  listReports,
  getReport,
  setReportStatus,
  setReportTriage,
  deleteReport,
  getSettingsRaw,
  saveSettingsRaw,
};
