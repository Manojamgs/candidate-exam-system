'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { getDb } = require('./db');
const { ensureBaseData } = require('./db/seed');
const { csrfGuard } = require('./middleware/auth');
const { setSyncHook } = require('./lib/audit');
const { enqueue } = require('./services/sync/queue');

function createApp() {
  getDb();
  const base = ensureBaseData();
  setSyncHook(enqueue);
  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: { useDefaults: true, directives: {
      'default-src': ["'self'"], 'script-src': ["'self'"], 'style-src': ["'self'", "'unsafe-inline'"], 'img-src': ["'self'", 'data:'],
      'connect-src': ["'self'"], 'frame-ancestors': ["'none'"], 'form-action': ["'self'"], 'object-src': ["'none'"],
      'upgrade-insecure-requests': config.secureCookies ? [] : null } },
    crossOriginEmbedderPolicy: false,
    hsts: config.secureCookies ? { maxAge: 15552000, includeSubDomains: true } : false,
  }));
  app.use(express.json({ limit: '1mb' })); // logo uploads are capped at 512 KB (≈700 KB base64)
  app.use(cookieParser());
  // Public branding (used by the login page, candidate portal and emails before anyone signs in)
  const branding = require('./services/branding');
  app.get('/brand/theme.css', (req, res) => { res.type('text/css').set('Cache-Control', 'no-cache').send(branding.themeCss()); });
  app.get('/brand/logo', (req, res) => {
    const l = branding.getLogo();
    if (!l) return res.status(404).end();
    res.set({ 'Content-Type': l.mime, 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox", 'Content-Disposition': 'inline' });
    res.send(l.data);
  });
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, csrfGuard);
  app.get('/api/brand', (req, res) => res.json(branding.publicInfo()));
  app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.use('/api/candidate', require('./routes/candidate'));
  app.use('/api', require('./routes/staff'));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  const pub = path.join(__dirname, '..', 'public');
  app.use(express.static(pub, { index: false, maxAge: config.env === 'production' ? '1h' : 0 }));
  app.get(['/exam', '/exam/'], (req, res) => res.sendFile(path.join(pub, 'exam', 'index.html')));
  app.get('/', (req, res) => res.sendFile(path.join(pub, 'index.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    res.status(status).json({ error: status >= 500 && config.env === 'production' ? 'Internal server error' : err.message, code: err.code });
  });
  app.locals.baseData = base;
  return app;
}
module.exports = { createApp };
