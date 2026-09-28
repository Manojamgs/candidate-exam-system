#!/usr/bin/env node
// Executes every JavaScript programming seed question:
//  - write_code / fix_bug / complete_code: runs reference_solution + each test_case.input in a fresh
//    vm context and deep-compares the completion value (awaited if a Promise) with test_case.expected
//    (evaluated as a JS literal in the same context). For fix_bug, also confirms the starter code fails.
//  - explain_output: runs starter_code with node and compares stdout with test_cases[0].expected, and
//    checks the reference_solution states that exact output.
// Usage: node scripts/verify-programming-javascript.js [path/to/javascript.json]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const util = require('util');
const os = require('os');
const { execFileSync } = require('child_process');

const file = process.argv[2] || path.join(__dirname, '..', 'seed', 'programming', 'javascript.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

async function runCase(source, tcase) {
  const ctx = vm.createContext({ console: { log() {} }, setTimeout, Promise });
  vm.runInContext(source, ctx, { timeout: 2000 });
  let actual = vm.runInContext(tcase.input, ctx, { timeout: 2000 });
  if (actual && typeof actual.then === 'function') {
    actual = await Promise.race([actual, new Promise((_, rej) => setTimeout(() => rej(new Error('async timeout')), 2000))]);
  }
  const expected = vm.runInContext('(' + tcase.expected + ')', ctx);
  return { ok: util.isDeepStrictEqual(actual, expected), actual };
}

(async () => {
  let failures = 0;
  let checked = 0;
  for (const set of data.sets) {
    for (const q of set.questions) {
      if (q.task_type === 'explain_output') {
        const tmp = path.join(os.tmpdir(), 'explain_' + q.code + '.js');
        fs.writeFileSync(tmp, q.starter_code);
        const out = execFileSync(process.execPath, [tmp], { encoding: 'utf8', timeout: 5000 }).replace(/\n$/, '');
        const exp = q.test_cases[0] && q.test_cases[0].expected;
        if (out !== exp) { failures++; console.log('FAIL', q.code, 'stdout mismatch:\n' + out + '\n--- expected ---\n' + exp); }
        else if (!q.reference_solution.startsWith('Output:\n' + out + '\n')) { failures++; console.log('FAIL', q.code, 'reference_solution does not state the exact output'); }
        else { checked++; }
        fs.unlinkSync(tmp);
        continue;
      }
      if (!q.test_cases.length) { failures++; console.log('FAIL', q.code, 'no test cases'); continue; }
      for (const t of q.test_cases) {
        try {
          const r = await runCase(q.reference_solution, t);
          if (!r.ok) { failures++; console.log('FAIL', q.code, t.input, '=>', util.inspect(r.actual), 'expected', t.expected); }
          else checked++;
        } catch (e) { failures++; console.log('FAIL', q.code, t.input, 'threw', e.message); }
      }
      if (q.task_type === 'fix_bug') {
        let starterFails = false;
        for (const t of q.test_cases) {
          try { if (!(await runCase(q.starter_code, t)).ok) starterFails = true; } catch (e) { starterFails = true; }
        }
        if (!starterFails) { failures++; console.log('FAIL', q.code, 'buggy starter_code passes all test cases'); }
      }
    }
  }
  console.log(failures ? failures + ' failure(s)' : 'All OK', '-', checked, 'checks passed');
  process.exit(failures ? 1 : 0);
})();
