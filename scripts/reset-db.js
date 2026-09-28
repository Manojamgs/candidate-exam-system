'use strict';
// Deletes the SQLite database files (DB_PATH) so the next start re-creates a clean system. Requires --yes.
const fs = require('fs');
const config = require('../server/config');
if (!process.argv.includes('--yes')) { console.error(`This permanently deletes ${config.dbPath}. Re-run with --yes to confirm.`); process.exit(1); }
for (const f of [config.dbPath, config.dbPath + '-wal', config.dbPath + '-shm']) if (fs.existsSync(f)) { fs.unlinkSync(f); console.log('Deleted', f); }
