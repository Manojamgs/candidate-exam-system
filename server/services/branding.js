'use strict';
// Company branding: logo (SVG/PNG/JPEG/WebP stored in the database) and brand colours.
// The colours are served as /brand/theme.css (CSS custom properties that override the defaults in app.css),
// so the staff console, candidate portal, emails and PDF reports all pick up the same identity.
const { getDb } = require('../db');
const settings = require('../lib/settings');
const { nowIso } = require('../lib/util');

const MAX_BYTES = 512 * 1024;
const MIME = { 'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const HEX = /^#[0-9a-f]{6}$/i;

function ensureTable() {
  getDb().exec(`CREATE TABLE IF NOT EXISTS brand_assets (key TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL,
    file_name TEXT, bytes INTEGER, updated_at TEXT NOT NULL, updated_by INTEGER)`);
}

// Rejects anything in an SVG that could execute or load external content. The logo is only ever shown via <img>
// (where scripts never run) and served with a locked-down CSP, so this is defence in depth.
function checkSvg(text) {
  if (!/<svg[\s>]/i.test(text)) throw Object.assign(new Error('The file is not a valid SVG image'), { status: 400 });
  const bad = [/<script/i, /\son[a-z]+\s*=/i, /javascript:/i, /<foreignObject/i, /<iframe/i, /<embed/i, /<object/i,
    /(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/|data:text)/i, /<!ENTITY/i, /@import/i];
  const hit = bad.find((re) => re.test(text));
  if (hit) throw Object.assign(new Error('The SVG contains scripts or external references and cannot be used as a logo. Export it as a plain SVG or PNG.'), { status: 400 });
}
function sniff(buf) {
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(buf.slice(0, 4096).toString('utf8'))) return 'image/svg+xml';
  return null;
}

function saveLogo({ dataUrl, fileName }, userId) {
  const m = /^data:([a-z+/.-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl || ''));
  if (!m) throw Object.assign(new Error('Upload the logo as an image file (SVG, PNG, JPEG or WebP)'), { status: 400 });
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length) throw Object.assign(new Error('The file is empty'), { status: 400 });
  if (buf.length > MAX_BYTES) throw Object.assign(new Error('The logo must be 512 KB or smaller'), { status: 400 });
  const mime = sniff(buf);
  if (!mime) throw Object.assign(new Error('Unsupported image type. Use SVG, PNG, JPEG or WebP.'), { status: 400 });
  if (mime === 'image/svg+xml') checkSvg(buf.toString('utf8'));
  ensureTable();
  getDb().prepare(`INSERT INTO brand_assets(key, mime, data, file_name, bytes, updated_at, updated_by) VALUES ('logo',?,?,?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET mime=excluded.mime, data=excluded.data, file_name=excluded.file_name, bytes=excluded.bytes, updated_at=excluded.updated_at, updated_by=excluded.updated_by`)
    .run(mime, buf, String(fileName || `logo.${MIME[mime]}`).slice(0, 120), buf.length, nowIso(), userId || null);
  return logoInfo();
}
function deleteLogo() { ensureTable(); getDb().prepare("DELETE FROM brand_assets WHERE key = 'logo'").run(); }
function getLogo() { ensureTable(); return getDb().prepare("SELECT mime, data, file_name, bytes, updated_at FROM brand_assets WHERE key = 'logo'").get() || null; }
function logoInfo() {
  ensureTable();
  const r = getDb().prepare("SELECT mime, file_name, bytes, updated_at FROM brand_assets WHERE key = 'logo'").get();
  return r ? { mime: r.mime, file_name: r.file_name, bytes: r.bytes, updated_at: r.updated_at, version: Date.parse(r.updated_at) || 0, raster: r.mime !== 'image/svg+xml' } : null;
}

// ---- colours ----
const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
const mix = (hex, other, w) => { const a = toRgb(hex); const b = toRgb(other); return toHex(a.map((v, i) => v * (1 - w) + b[i] * w)); };
const luminance = (hex) => { const [r, g, b] = toRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

function colours() {
  const primary = HEX.test(settings.get('branding.primary_color')) ? settings.get('branding.primary_color') : '#1e3a5f';
  const accent = HEX.test(settings.get('branding.accent_color')) ? settings.get('branding.accent_color') : '#2563eb';
  return {
    primary, accent,
    primaryDeep: mix(primary, '#000000', 0.25), primaryLight: mix(primary, '#ffffff', 0.12),
    accentHover: mix(accent, '#000000', 0.15), soft: mix(accent, '#ffffff', 0.9),
    onPrimary: contrast(primary, '#ffffff') >= 3 ? '#ffffff' : '#0f172a',
    onPrimaryMuted: contrast(primary, '#ffffff') >= 3 ? mix(primary, '#ffffff', 0.7) : mix(primary, '#000000', 0.6),
    onAccent: contrast(accent, '#ffffff') >= 3 ? '#ffffff' : '#0f172a',
  };
}
function themeCss() {
  const c = colours();
  return `/* generated from Settings → Branding */\n:root {\n  --brand: ${c.primary}; --brand-deep: ${c.primaryDeep}; --brand-light: ${c.primaryLight};\n`
    + `  --brand-2: ${c.accent}; --brand-2-hover: ${c.accentHover}; --brand-soft: ${c.soft};\n`
    + `  --on-brand: ${c.onPrimary}; --on-brand-muted: ${c.onPrimaryMuted}; --on-brand-2: ${c.onAccent};\n}\n`;
}
function publicInfo() {
  const logo = logoInfo();
  return {
    company: settings.get('email.company_name'), title: settings.get('branding.app_title'), subtitle: settings.get('branding.app_subtitle'),
    logo: logo ? { url: `/brand/logo?v=${logo.version}`, raster: logo.raster, file_name: logo.file_name, bytes: logo.bytes } : null,
    logo_plate: settings.get('branding.logo_plate'), colours: colours(),
  };
}
function validateColour(key, v) {
  if (!HEX.test(String(v))) throw Object.assign(new Error(`${key} must be a colour like #1e3a5f`), { status: 400 });
}
module.exports = { saveLogo, deleteLogo, getLogo, logoInfo, colours, themeCss, publicInfo, validateColour, MAX_BYTES, HEX };
