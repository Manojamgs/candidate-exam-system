'use strict';
const crypto = require('crypto');
const config = require('../config');

const key = crypto.createHash('sha256').update('enc:' + config.appSecret).digest();
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return 'v1:' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
function decrypt(blob) {
  if (!blob || !blob.startsWith('v1:')) return null;
  const buf = Buffer.from(blob.slice(3), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const hashToken = (t) => crypto.createHmac('sha256', config.appSecret).update(String(t)).digest('hex');
function randomAccessCode(len = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let s = '';
  for (const b of crypto.randomBytes(len)) s += alphabet[b % alphabet.length];
  return s;
}
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
module.exports = { encrypt, decrypt, randomToken, hashToken, randomAccessCode, safeEqual };
