'use strict';
const nowIso = () => new Date().toISOString();
const addMinutes = (d, m) => new Date(new Date(d).getTime() + m * 60000).toISOString();
const addSeconds = (d, s) => new Date(new Date(d).getTime() + s * 1000).toISOString();
const round2 = (n) => (n === null || n === undefined || Number.isNaN(n) ? null : Math.round(n * 100) / 100);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
function wordCount(text) {
  if (!text) return 0;
  const m = String(text).trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu);
  return m ? m.length : 0;
}
function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function parseJson(s, fallback = null) {
  if (s === null || s === undefined || s === '') return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}
class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
const httpError = (status, message, code) => new HttpError(status, message, code);
function pick(obj, keys) { const o = {}; for (const k of keys) if (obj[k] !== undefined) o[k] = obj[k]; return o; }
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
module.exports = { nowIso, addMinutes, addSeconds, round2, clamp, wordCount, shuffle, parseJson, HttpError, httpError, pick, escapeHtml };
