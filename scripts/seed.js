'use strict';
// Creates the schema, the initial admin user and loads the 6 seed exam sets (idempotent).
const { getDb, closeDb } = require('../server/db');
const { ensureBaseData, seedQuestionBank, seedProgrammingBank } = require('../server/db/seed');
getDb();
const r = ensureBaseData();
const again = seedQuestionBank();
const prg = seedProgrammingBank();
console.log('Admin created:', r.createdAdmin, '| Question bank:', r.seeded || again, '| Programming bank:', r.seededProgramming || prg);
closeDb();
