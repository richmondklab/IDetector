"use strict";

const crypto = require("crypto");

const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

function verifyHash(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored).split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  if (expected.length === 0) return false;
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, "base64url"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = { hashPassword, verifyHash };
