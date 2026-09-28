'use strict';
// Writes docs/ANSWER_KEYS.md and docs/QUESTION_BANK.xlsx from the seed files.
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const dir = path.join(__dirname, '..', 'seed', 'questions');
const out = path.join(__dirname, '..', 'docs');
fs.mkdirSync(out, { recursive: true });
const sets = fs.readdirSync(dir).filter((f) => /^set-\d+\.json$/.test(f)).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
let md = '# Answer Keys & Question Bank\n\nConfidential – staff only. 6 sets × (20 aptitude + 10 communication) = 180 questions. Options are shuffled per candidate at runtime; keys below refer to the stored (unshuffled) options.\n';
for (const s of sets) {
  md += `\n## ${s.set_code}\n\n### Aptitude (20 × 1 mark)\n\n| # | Code | Category | Difficulty | Question | Options | Answer | Explanation |\n|---|---|---|---|---|---|---|---|\n`;
  s.aptitude.forEach((q, i) => {
    const t = q.table ? ` <br>Table: ${q.table.headers.join(' / ')}; ${q.table.rows.map((r) => r.join(' / ')).join('; ')}` : '';
    const esc = (x) => String(x).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    md += `| ${i + 1} | ${q.code} | ${q.category} | ${q.difficulty} | ${esc(q.question + t)} | ${['A', 'B', 'C', 'D'].map((k) => `${k}) ${esc(q.options[k])}`).join('<br>')} | **${q.correct}** | ${esc(q.explanation)} |\n`;
  });
  md += '\n### Communication (10 × 10 marks, 100–200 words)\n\n';
  s.communication.forEach((q, i) => { md += `${i + 1}. **${q.code}** (${q.category || 'General'}) – ${q.question}\n`; });
}
fs.writeFileSync(path.join(out, 'ANSWER_KEYS.md'), md);
(async () => {
  const wb = new ExcelJS.Workbook();
  const a = wb.addWorksheet('Aptitude');
  a.columns = ['Set', 'Code', 'Category', 'Topic', 'Difficulty', 'Question', 'Table', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct', 'Marks', 'Explanation'].map((h) => ({ header: h, key: h, width: h === 'Question' || h === 'Explanation' ? 60 : 16 }));
  const c = wb.addWorksheet('Communication');
  c.columns = ['Set', 'Code', 'Category', 'Question', 'Min words', 'Max words', 'Marks'].map((h) => ({ header: h, key: h, width: h === 'Question' ? 90 : 14 }));
  for (const s of sets) {
    for (const q of s.aptitude) a.addRow({ Set: s.set_code, Code: q.code, Category: q.category, Topic: q.topic, Difficulty: q.difficulty, Question: q.question,
      Table: q.table ? JSON.stringify(q.table) : '', 'Option A': q.options.A, 'Option B': q.options.B, 'Option C': q.options.C, 'Option D': q.options.D, Correct: q.correct, Marks: q.marks ?? 1, Explanation: q.explanation });
    for (const q of s.communication) c.addRow({ Set: s.set_code, Code: q.code, Category: q.category, Question: q.question, 'Min words': q.expected_words_min, 'Max words': q.expected_words_max, Marks: q.marks });
  }
  for (const ws of [a, c]) { ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', ySplit: 1 }]; }
  // Programming bank (6 languages × 5 sets × 10)
  const pdir = path.join(__dirname, '..', 'seed', 'programming');
  const langs = fs.existsSync(pdir) ? fs.readdirSync(pdir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(pdir, f), 'utf8'))) : [];
  const pw = wb.addWorksheet('Programming');
  pw.columns = ['Language', 'Set', 'Code', 'Topic', 'Task type', 'Difficulty', 'Minutes', 'Question', 'Starter code', 'Reference solution', 'Evaluation points', 'Test cases'].map((h) => ({ header: h, key: h, width: ['Question', 'Starter code', 'Reference solution', 'Evaluation points'].includes(h) ? 60 : 14 }));
  let pmd = '# Programming Question Bank & Reference Solutions\n\nConfidential – staff only. Written code questions; AI evaluation compares each answer with the reference solution and evaluation points. Candidate code is never executed.\n';
  for (const L of langs) {
    pmd += `\n## ${L.label}\n`;
    for (const st of L.sets) {
      pmd += `\n### ${L.label} – Set ${st.set_number}\n`;
      st.questions.forEach((q, i) => {
        pmd += `\n**${i + 1}. ${q.code}** · ${q.topic || ''} · ${q.task_type} · ${q.difficulty} · ~${q.expected_minutes} min\n\n${q.question}\n`;
        if (q.starter_code) pmd += `\nGiven code:\n\n\`\`\`\n${q.starter_code}\n\`\`\`\n`;
        pmd += `\nReference solution:\n\n\`\`\`\n${q.reference_solution}\n\`\`\`\n\nEvaluation points: ${(q.evaluation_points || []).join('; ')}\n`;
        pw.addRow({ Language: L.label, Set: st.set_number, Code: q.code, Topic: q.topic, 'Task type': q.task_type, Difficulty: q.difficulty, Minutes: q.expected_minutes, Question: q.question,
          'Starter code': q.starter_code || '', 'Reference solution': q.reference_solution, 'Evaluation points': (q.evaluation_points || []).join('\n'),
          'Test cases': (q.test_cases || []).map((t) => `${t.input} => ${t.expected}`).join('\n') });
      });
    }
  }
  pw.getRow(1).font = { bold: true }; pw.views = [{ state: 'frozen', ySplit: 1 }];
  fs.writeFileSync(path.join(out, 'PROGRAMMING_BANK.md'), pmd);
  await wb.xlsx.writeFile(path.join(out, 'QUESTION_BANK.xlsx'));
  console.log('Wrote docs/ANSWER_KEYS.md, docs/PROGRAMMING_BANK.md and docs/QUESTION_BANK.xlsx');
})();
