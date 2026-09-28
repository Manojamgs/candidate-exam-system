'use strict';
// Google Sheets backend adapter (Sheets API v4, service-account auth, no SDK dependency).
const crypto = require('crypto');
const settings = require('../../lib/settings');
const config = require('../../config');

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
let tokenCache = { token: null, exp: 0, key: '' };
const sheetMeta = new Map(); // title -> { exists, headers }

function b64url(obj) { return Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)).toString('base64url'); }
function serviceAccount() {
  const raw = settings.get('google.service_account_json');
  if (!raw) throw new Error('Google service account JSON is not configured');
  let sa;
  try { sa = JSON.parse(raw); } catch { throw new Error('Google service account JSON is not valid JSON'); }
  if (!sa.client_email || !sa.private_key) throw new Error('Service account JSON must contain client_email and private_key');
  return sa;
}
async function getToken() {
  const sa = serviceAccount();
  if (tokenCache.token && tokenCache.exp > Date.now() + 60000 && tokenCache.key === sa.client_email) return tokenCache.token;
  const now = Math.floor(Date.now() / 1000);
  const aud = sa.token_uri || config.endpoints.googleToken;
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({ iss: sa.client_email, scope: SCOPE, aud, iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const r = await fetch(config.endpoints.googleToken, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`Google token error: ${j.error_description || j.error || r.status}`);
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000, key: sa.client_email };
  return tokenCache.token;
}
async function api(method, path, body) {
  const id = settings.get('google.sheet_id');
  if (!id) throw new Error('Google Sheet ID is not configured');
  const url = `${config.endpoints.googleSheets}/v4/spreadsheets/${encodeURIComponent(id)}${path}`;
  const r = await fetch(url, { method, headers: { authorization: `Bearer ${await getToken()}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`Google Sheets ${method} ${path.split('?')[0]} failed: ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}
const q = (title) => `'${title.replace(/'/g, "''")}'`;
function colLetter(n) { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function cell(v) { if (v === null || v === undefined) return ''; if (typeof v === 'object') return JSON.stringify(v); return v; }

async function ensureSheet(title, headers) {
  const cols = [...headers, 'Sync Key'];
  const cached = sheetMeta.get(title);
  if (cached && cached.headers === cols.join('|')) return cols;
  const meta = await api('GET', '?fields=sheets.properties.title');
  const exists = (meta.sheets || []).some((s) => s.properties.title === title);
  if (!exists) await api('POST', ':batchUpdate', { requests: [{ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } }] });
  await api('PUT', `/values/${encodeURIComponent(`${q(title)}!A1`)}?valueInputOption=RAW`, { values: [cols] });
  sheetMeta.set(title, { headers: cols.join('|') });
  return cols;
}

async function upsertRows(entity, headers, rows) {
  const title = settings.get('google.sheet_names')[entity] || entity;
  const cols = await ensureSheet(title, headers);
  if (!rows.length) return { updated: 0, appended: 0 };
  const keyCol = colLetter(cols.length - 1);
  const existing = await api('GET', `/values/${encodeURIComponent(`${q(title)}!${keyCol}:${keyCol}`)}`);
  const index = new Map();
  (existing.values || []).forEach((v, i) => { if (i > 0 && v[0]) index.set(v[0], i + 1); });
  const updates = []; const appends = [];
  for (const r of rows) {
    const values = [...headers.map((hd) => cell(r[hd])), r._key];
    const at = index.get(r._key);
    if (at) updates.push({ range: `${q(title)}!A${at}:${keyCol}${at}`, values: [values] });
    else appends.push(values);
  }
  if (updates.length) await api('POST', '/values:batchUpdate', { valueInputOption: 'RAW', data: updates });
  if (appends.length) await api('POST', `/values/${encodeURIComponent(`${q(title)}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { values: appends });
  return { updated: updates.length, appended: appends.length };
}
async function testConnection() {
  const meta = await api('GET', '?fields=properties.title,sheets.properties.title');
  return { ok: true, spreadsheet: meta.properties?.title, sheets: (meta.sheets || []).map((s) => s.properties.title) };
}
async function provision(ENTITIES) {
  const out = [];
  for (const [entity, def] of Object.entries(ENTITIES)) {
    const title = settings.get('google.sheet_names')[entity] || entity;
    sheetMeta.delete(title);
    await ensureSheet(title, def.headers); out.push(title);
  }
  return out;
}
function resetCache() { sheetMeta.clear(); tokenCache = { token: null, exp: 0, key: '' }; }
module.exports = { upsertRows, testConnection, provision, resetCache, name: 'google_sheets' };
