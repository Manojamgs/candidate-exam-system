'use strict';
const fs = require('fs');
const http = require('http');
const https = require('https');
const config = require('./config');
const { createApp } = require('./app');
const engine = require('./services/examEngine');
const sync = require('./services/sync');
const email = require('./services/email');

const app = createApp();
const server = config.tlsCert && config.tlsKey
  ? https.createServer({ cert: fs.readFileSync(config.tlsCert), key: fs.readFileSync(config.tlsKey) }, app)
  : http.createServer(app);

server.listen(config.port, config.host, () => {
  console.log(`Candidate Examination System running at ${config.baseUrl} (${config.env})`);
  if (app.locals.baseData.createdAdmin) console.log(`Initial admin created: ${config.initialAdmin.username} / (password from ADMIN_PASSWORD) – change it after first login.`);
  if (app.locals.baseData.seeded) console.log('Question bank seeded:', app.locals.baseData.seeded);
});

if (!config.disableBackgroundJobs) {
  // Auto-submit expired exams & expire stale links (every 15 s)
  setInterval(() => { try { engine.sweep(); } catch (e) { console.error('sweep', e.message); } }, 15000).unref();
  // Push pending changes to Google Sheets / SharePoint (every 20 s)
  setInterval(() => { if (require('./lib/settings').get('backend.auto_sync')) sync.processQueue().catch((e) => console.error('sync', e.message)); }, 20000).unref();
  // Retry queued / failed emails (every 60 s)
  setInterval(() => email.processOutbox({ retryFailed: true }).catch((e) => console.error('email', e.message)), 60000).unref();
  setInterval(() => sync.purgeDone(7), 6 * 3600 * 1000).unref();
}
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(() => { try { require('./db').closeDb(); } catch { /* ignore */ } process.exit(0); }); setTimeout(() => { try { require('./db').closeDb(); } catch { /* ignore */ } process.exit(0); }, 3000).unref(); });
