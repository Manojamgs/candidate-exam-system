'use strict';
// CSV / Excel / PDF exports and the Complete Candidate Report.
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { getDb } = require('../db');
const { parseJson } = require('../lib/util');
const settings = require('../lib/settings');
const { searchCandidates } = require('./candidates');
const { getExamDetail } = require('./results');
const { ENTITIES } = require('./sync/mappings');

// ---- Datasets ----
function dataset(name, query = {}) {
  const db = getDb();
  if (name === 'candidates') {
    const { rows } = searchCandidates({ ...query, limit: 100000 });
    const headers = ENTITIES.candidates.headers;
    return { title: 'Candidate List', headers, rows: rows.map((c) => ENTITIES.candidates.rows(c.candidate_code)[0]) };
  }
  const examFilter = examWhere(query);
  const codes = db.prepare(`SELECT e.exam_code FROM exam_results r JOIN exams e ON e.id = r.exam_id JOIN candidates c ON c.id = e.candidate_id
    LEFT JOIN exam_sets s ON s.id = e.exam_set_id ${examFilter.sql} ORDER BY e.submitted_at DESC`).all(examFilter.p).map((r) => r.exam_code);
  if (name === 'results') {
    const def = ENTITIES.exam_results;
    const headers = ['Candidate Name', 'Position', ...def.headers];
    return { title: 'Examination Results', headers, rows: codes.flatMap((k) => def.rows(k).map((r) => {
      const c = db.prepare('SELECT c.full_name, c.position_applied FROM exams e JOIN candidates c ON c.id = e.candidate_id WHERE e.exam_code = ?').get(k);
      return { ...r, 'Candidate Name': c.full_name, Position: c.position_applied };
    })) };
  }
  if (name === 'communication') {
    const def = ENTITIES.communication_answers;
    return { title: 'Communication Evaluation', headers: def.headers, rows: codes.flatMap((k) => def.rows(k)) };
  }
  if (name === 'aptitude') {
    const def = ENTITIES.aptitude_answers;
    return { title: 'Aptitude Results', headers: def.headers, rows: codes.flatMap((k) => def.rows(k)) };
  }
  if (name === 'programming') {
    const def = ENTITIES.programming_answers;
    return { title: 'Programming Evaluation', headers: def.headers, rows: codes.flatMap((k) => def.rows(k)) };
  }
  if (name === 'programming_questions') {
    const rows = db.prepare('SELECT code FROM programming_questions ORDER BY language, set_number, code').all().flatMap((r) => ENTITIES.programming_questions.rows(r.code));
    return { title: 'Programming Question Bank & Reference Solutions', headers: ENTITIES.programming_questions.headers, rows };
  }
  if (name === 'reschedules') {
    const rows = db.prepare('SELECT request_code FROM reschedule_requests ORDER BY id DESC').all().flatMap((r) => ENTITIES.reschedule_requests.rows(r.request_code));
    return { title: 'Reschedule Requests', headers: ENTITIES.reschedule_requests.headers, rows };
  }
  if (name === 'skills') {
    const rows = db.prepare('SELECT DISTINCT c.candidate_code FROM candidate_skills s JOIN candidates c ON c.id = s.candidate_id').all().flatMap((r) => ENTITIES.candidate_skills.rows(r.candidate_code));
    return { title: 'Candidate Skills', headers: ENTITIES.candidate_skills.headers, rows };
  }
  if (name === 'audit') {
    const rows = db.prepare('SELECT log_code FROM audit_log ORDER BY id DESC LIMIT 50000').all().flatMap((r) => ENTITIES.audit_log.rows(r.log_code));
    return { title: 'Audit Log', headers: ENTITIES.audit_log.headers, rows };
  }
  if (name === 'questions') {
    const rows = db.prepare('SELECT code FROM aptitude_questions ORDER BY code').all().flatMap((r) => ENTITIES.aptitude_questions.rows(r.code));
    return { title: 'Aptitude Question Bank & Answer Key', headers: ENTITIES.aptitude_questions.headers, rows };
  }
  if (name === 'communication_questions') {
    const rows = db.prepare('SELECT code FROM communication_questions ORDER BY code').all().flatMap((r) => ENTITIES.communication_questions.rows(r.code));
    return { title: 'Communication Question Bank', headers: ENTITIES.communication_questions.headers, rows };
  }
  throw Object.assign(new Error('Unknown export dataset'), { status: 400 });
}
function examWhere(q) {
  const w = []; const p = {};
  if (q.exam_set) { w.push('s.code = @exam_set'); p.exam_set = q.exam_set; }
  if (q.result) { w.push('r.final_status = @result'); p.result = q.result; }
  if (q.date_from) { w.push('substr(e.submitted_at,1,10) >= @df'); p.df = q.date_from; }
  if (q.date_to) { w.push('substr(e.submitted_at,1,10) <= @dt'); p.dt = q.date_to; }
  if (q.position) { w.push('c.position_applied LIKE @pos'); p.pos = `%${q.position}%`; }
  if (q.candidate_id) { w.push('c.candidate_code = @cid'); p.cid = q.candidate_id; }
  return { sql: w.length ? 'WHERE ' + w.join(' AND ') : '', p };
}

// ---- Formats ----
function toCsv({ headers, rows }) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // CSV/formula injection guard
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [headers.map(esc).join(','), ...rows.map((r) => headers.map((hd) => esc(r[hd])).join(','))].join('\r\n');
}
async function toXlsx({ title, headers, rows }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Candidate Examination System'; wb.created = new Date();
  const ws = wb.addWorksheet(title.slice(0, 31));
  ws.columns = headers.map((hd) => ({ header: hd, key: hd, width: Math.min(60, Math.max(12, hd.length + 4)) }));
  for (const r of rows) {
    const o = {};
    for (const hd of headers) { const v = r[hd]; o[hd] = v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : (typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v)); }
    ws.addRow(o);
  }
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  return wb.xlsx.writeBuffer();
}
function pdfBuffer(build) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: 'Candidate Examination Report' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    try { build(doc); } catch (e) { reject(e); return; }
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0; // writing inside the margin must not trigger a new page
      doc.fontSize(8).fillColor('#6b7280').text(`${settings.get('email.company_name')} · Confidential · Page ${i + 1} of ${range.count}`, 40, doc.page.height - 30,
        { width: doc.page.width - 80, align: 'center', lineBreak: false });
      doc.page.margins.bottom = bottom;
    }
    doc.end();
  });
}
// Tabular PDF (landscape-ish summary of a dataset – limited to the most useful columns)
function toPdfTable({ title, headers, rows }) {
  const cols = headers.slice(0, 9);
  return pdfBuffer((doc) => {
    header(doc, title);
    const w = (doc.page.width - 80) / cols.length;
    const drawRow = (vals, bold) => {
      const y = doc.y;
      const heights = vals.map((v) => doc.fontSize(7).heightOfString(String(v ?? ''), { width: w - 4 }));
      const hgt = Math.max(...heights) + 6;
      if (y + hgt > doc.page.height - 50) { doc.addPage(); return drawRow(vals, bold); }
      if (bold) doc.rect(40, y, doc.page.width - 80, hgt).fill(require('./branding').colours().primary);
      vals.forEach((v, i) => doc.fillColor(bold ? '#ffffff' : '#111827').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7)
        .text(String(v ?? ''), 42 + i * w, y + 3, { width: w - 4 }));
      doc.moveTo(40, y + hgt).lineTo(doc.page.width - 40, y + hgt).strokeColor('#e5e7eb').stroke();
      doc.y = y + hgt;
    };
    drawRow(cols, true);
    for (const r of rows) drawRow(cols.map((c) => (typeof r[c] === 'object' && r[c] !== null ? JSON.stringify(r[c]) : r[c])));
    if (!rows.length) doc.moveDown().fontSize(10).fillColor('#6b7280').text('No records match the selected filters.');
  });
}
function header(doc, title, subtitle) {
  const bc = require('./branding').colours(); const logo = require('./branding').getLogo();
  doc.rect(0, 0, doc.page.width, 70).fill(bc.primary);
  doc.rect(0, 70, doc.page.width, 3).fill(bc.accent);
  let tx = 40;
  if (logo && logo.mime !== 'image/svg+xml' && logo.mime !== 'image/webp') {
    try { doc.roundedRect(36, 13, 132, 44, 5).fill('#ffffff'); doc.image(logo.data, 42, 17, { fit: [120, 36], align: 'center', valign: 'center' }); tx = 184; } catch { /* unsupported image – text header only */ }
  }
  doc.fillColor(bc.onPrimary).font('Helvetica-Bold').fontSize(16).text(title, tx, 22);
  doc.font('Helvetica').fontSize(9).text(subtitle || `${settings.get('email.company_name')} · Generated ${new Date().toUTCString()}`, tx, 44);
  doc.fillColor('#111827'); doc.y = 90;
}

// ---- Complete Candidate Report (PDF) ----
function candidateReport(examId) {
  const d = getExamDetail(examId);
  if (!d) throw Object.assign(new Error('Exam not found'), { status: 404 });
  const { candidate: c, exam: e, result: r } = d;
  const fmtDate = (s) => (s ? new Date(s).toUTCString().replace(' GMT', ' UTC') : '—');
  const dur = e.duration_seconds != null ? `${Math.floor(e.duration_seconds / 60)} min ${e.duration_seconds % 60} s` : '—';
  return pdfBuffer((doc) => {
    header(doc, 'Candidate Examination Report', `${c.full_name} · ${c.candidate_code} · ${e.exam_code}`);
    const section = (t) => {
      if (doc.y > doc.page.height - 140) doc.addPage();
      doc.moveDown(0.6).font('Helvetica-Bold').fontSize(12).fillColor(require('./branding').colours().primary).text(t, 40);
      doc.moveTo(40, doc.y + 2).lineTo(doc.page.width - 40, doc.y + 2).strokeColor('#cbd5e1').stroke(); doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10).fillColor('#111827');
    };
    const kv = (pairs) => {
      const colW = (doc.page.width - 80) / 2;
      for (let i = 0; i < pairs.length; i += 2) {
        const row = pairs.slice(i, i + 2).map(([k, v]) => [k, v == null || v === '' ? '—' : String(v)]);
        const hgt = 12 + Math.max(...row.map(([, v]) => doc.font('Helvetica-Bold').fontSize(10).heightOfString(v, { width: colW - 10 }))) + 6;
        if (doc.y + hgt > doc.page.height - 60) doc.addPage();
        const y = doc.y;
        row.forEach(([k, v], j) => {
          doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text(k, 40 + j * colW, y, { width: colW - 10, lineBreak: false });
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text(v, 40 + j * colW, y + 10, { width: colW - 10 });
        });
        doc.x = 40; doc.y = y + hgt;
      }
    };
    section('Candidate Information');
    kv([['Candidate name', c.full_name], ['Candidate ID', c.candidate_code], ['Email', c.email], ['Position', c.position_applied],
      ['Experience', c.experience || (c.years_of_experience != null ? `${c.years_of_experience} years` : null)], ['Qualification', c.highest_qualification],
      ['Department', c.department], ['Recruiter', c.recruiter_name]]);
    section('Examination Information');
    kv([['Exam ID', e.exam_code], ['Exam set', e.set_code], ['Attempt', `${e.attempt_number} (${e.attempt_code})`], ['Date', fmtDate(e.started_at)],
      ['Duration', dur], ['Submission', e.submission_type === 'auto_timer' ? 'Auto-submitted (timer expired)' : e.submission_type === 'admin' ? 'Submitted by administrator' : 'Manual submission'],
      ['Tab switches recorded', e.tab_switch_count], ['Suspicious events recorded', e.suspicious_event_count]]);
    if (!r) { doc.text('No result is available yet.'); return; }
    section('Aptitude Result');
    kv([['Score', `${r.aptitude_score} / ${r.aptitude_max}`], ['Percentage', `${r.aptitude_percentage}%`], ['Questions answered', `${r.aptitude_answered} / ${d.aptitude.length}`]]);
    doc.font('Helvetica-Bold').fontSize(9).text('Category-wise performance');
    doc.moveDown(0.3);
    for (const [cat, b] of Object.entries(r.aptitude_breakdown || {})) {
      if (doc.y > doc.page.height - 70) doc.addPage();
      const y = doc.y; const barW = 200;
      doc.font('Helvetica').fontSize(9).fillColor('#111827').text(cat, 40, y, { width: 170 });
      doc.rect(215, y + 1, barW, 9).fill('#e5e7eb');
      doc.rect(215, y + 1, barW * (b.percentage / 100), 9).fill(b.percentage >= 60 ? '#16a34a' : '#dc2626');
      doc.fillColor('#111827').text(`${b.correct}/${b.total} (${b.percentage}%)`, 425, y);
      doc.x = 40; doc.y = y + 16;
    }
    section('Communication Result');
    const rub = r.communication_rubric || {};
    const src = [...new Set(d.communication.map((q) => q.current_evaluation?.source).filter(Boolean))]
      .map((s) => (s === 'ai' ? 'AI Evaluation' : s === 'rule' ? 'Automated Rule-Based Evaluation' : 'Manual Evaluator Review')).join(', ');
    kv([['Score', r.communication_score != null ? `${r.communication_score} / ${r.communication_max}` : 'Pending'],
      ['Percentage', r.communication_percentage != null ? `${r.communication_percentage}%` : 'Pending'],
      ['Grammar', rub.grammar != null ? `${rub.grammar} / 20` : '—'], ['Vocabulary', rub.vocabulary != null ? `${rub.vocabulary} / 20` : '—'],
      ['Clarity', rub.clarity != null ? `${rub.clarity} / 20` : '—'], ['Structure', rub.structure != null ? `${rub.structure} / 20` : '—'],
      ['Professional Communication', rub.professional != null ? `${rub.professional} / 20` : '—'], ['Evaluation method', src || 'Pending']]);
    const hasPrg = d.programming && d.programming.length > 0;
    if (hasPrg) {
      section('Programming Result');
      const pr = r.programming_rubric || {};
      const lang = d.programming[0].language_label;
      const verdicts = d.programming.reduce((m, q) => { const v = q.current_evaluation?.verdict || 'pending'; m[v] = (m[v] || 0) + 1; return m; }, {});
      kv([['Language / set', `${lang} · set ${e.programming_set}`], ['Score', r.programming_score != null ? `${r.programming_score} / ${r.programming_max}` : 'Pending'],
        ['Percentage', r.programming_percentage != null ? `${r.programming_percentage}%` : 'Pending'],
        ['Verdicts', Object.entries(verdicts).map(([k, v]) => `${k.replace('_', ' ')}: ${v}`).join(', ')],
        ['Correctness', pr.correctness != null ? `${pr.correctness} / 40` : '—'], ['Logic', pr.logic != null ? `${pr.logic} / 20` : '—'],
        ['Code quality', pr.code_quality != null ? `${pr.code_quality} / 15` : '—'], ['Efficiency', pr.efficiency != null ? `${pr.efficiency} / 10` : '—'],
        ['Edge cases', pr.edge_cases != null ? `${pr.edge_cases} / 15` : '—'],
        ['Evaluation method', [...new Set(d.programming.map((q) => q.current_evaluation?.source).filter(Boolean))].map((x) => (x === 'ai' ? 'AI Evaluation' : x === 'manual' ? 'Manual Evaluator Review' : 'Automatic (blank)')).join(', ') || 'Pending']]);
      if (d.skills?.length) { doc.font('Helvetica-Bold').fontSize(9).text('Declared skills'); doc.font('Helvetica').fontSize(9).text(d.skills.map((x) => `${x.skill} (${x.level}${x.years != null ? `, ${x.years} yrs` : ''})`).join('  ·  ')); doc.moveDown(0.3); }
    }
    section('Final Result');
    const snap = r.scoring_snapshot || {};
    kv([['Aptitude percentage', `${r.aptitude_percentage}%`], ['Communication percentage', r.communication_percentage != null ? `${r.communication_percentage}%` : 'Pending'],
      ['Overall percentage', r.final_score != null ? `${r.final_score}%` : 'Pending'], ['Result', `${r.final_status}${r.finalized ? '' : ' (not yet finalised)'}`],
      ...(hasPrg ? [['Programming percentage', r.programming_percentage != null ? `${r.programming_percentage}%` : 'Pending']] : []),
      ['Weighting', `Aptitude ${snap.aptitude_weight} / Communication ${snap.communication_weight}${hasPrg ? ` / Programming ${snap.programming_weight}` : ''}`],
      ['Pass thresholds', `Apt >= ${snap.aptitude_min_pct}% / Comm >= ${snap.communication_min_pct}%${hasPrg ? ` / Prog >= ${snap.programming_min_pct}%` : ''} / Overall >= ${snap.overall_min_pct}%`]]);
    if (snap.reasons?.length) doc.fontSize(9).fillColor('#b91c1c').text(snap.reasons.join('. ') + '.').fillColor('#111827');
    section('Evaluation');
    doc.font('Helvetica-Bold').fontSize(10).text('Strengths');
    doc.font('Helvetica').fontSize(10);
    (r.strengths?.length ? r.strengths : ['—']).forEach((s) => doc.text(`•  ${s}`, { indent: 8 }));
    doc.moveDown(0.4).font('Helvetica-Bold').text('Areas for Improvement').font('Helvetica');
    (r.improvements?.length ? r.improvements : ['—']).forEach((s) => doc.text(`•  ${s}`, { indent: 8 }));
    doc.moveDown(0.4).font('Helvetica-Bold').text('Evaluator Comments').font('Helvetica').text(r.evaluator_comments || '—');
    if (r.finalized_at) doc.moveDown(0.3).fontSize(8).fillColor('#6b7280').text(`Finalised ${fmtDate(r.finalized_at)}`).fillColor('#111827');

    doc.addPage();
    header(doc, 'Communication Responses', `${c.full_name} · ${e.exam_code}`);
    d.communication.forEach((q, i) => {
      if (doc.y > doc.page.height - 160) doc.addPage();
      const ev = q.current_evaluation;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(require('./branding').colours().primary).text(`Q${i + 1}. ${q.question}`);
      doc.font('Helvetica').fontSize(9).fillColor('#111827').text(q.answer_text || '(No answer submitted)', { align: 'left' });
      doc.fontSize(8).fillColor('#374151').text(ev
        ? `Words: ${q.word_count} · Grammar ${ev.grammar} · Vocabulary ${ev.vocabulary} · Clarity ${ev.clarity} · Structure ${ev.structure} · Professional ${ev.professional} · Score ${ev.question_score}/${q.marks} · ${ev.source === 'ai' ? 'AI Evaluation' : ev.source === 'rule' ? 'Rule-based' : 'Manual review'}`
        : `Words: ${q.word_count || 0} · Not yet evaluated`);
      if (ev?.feedback) doc.fillColor('#6b7280').text(`Feedback: ${ev.feedback}`);
      doc.fillColor('#111827').moveDown(0.8);
    });
    if (hasPrg) {
      doc.addPage();
      header(doc, 'Programming Responses', `${c.full_name} · ${e.exam_code} · ${d.programming[0].language_label}`);
      d.programming.forEach((q, i) => {
        if (doc.y > doc.page.height - 170) doc.addPage();
        const ev = q.current_evaluation;
        doc.font('Helvetica-Bold').fontSize(10).fillColor(require('./branding').colours().primary).text(`P${i + 1}. [${q.code} · ${q.topic || ''} · ${q.task_type.replace('_', ' ')} · ${q.difficulty}] ${q.question}`);
        doc.font('Courier').fontSize(8).fillColor('#111827').text(q.answer_text || '(No answer submitted)', { align: 'left' });
        doc.font('Helvetica').fontSize(8).fillColor('#374151').text(ev
          ? `Correctness ${ev.correctness}/40 · Logic ${ev.logic}/20 · Quality ${ev.code_quality}/15 · Efficiency ${ev.efficiency}/10 · Edge cases ${ev.edge_cases}/15 · Score ${ev.question_score}/${q.marks} · ${String(ev.verdict || '').replace('_', ' ')} · ${ev.source === 'ai' ? 'AI Evaluation' : ev.source === 'manual' ? 'Manual review' : 'Automatic'}`
          : 'Awaiting evaluation');
        if (ev?.feedback) doc.fillColor('#6b7280').text(`Feedback: ${ev.feedback}`);
        if (ev?.issues?.length) doc.fillColor('#b91c1c').text(`Issues: ${ev.issues.join('; ')}`);
        doc.fillColor('#111827').moveDown(0.8);
      });
    }
    { // staff-only report: answer sheet always included
      doc.addPage();
      header(doc, 'Aptitude Answer Sheet (HR only)', `${c.full_name} · ${e.exam_code}`);
      d.aptitude.forEach((q, i) => {
        if (doc.y > doc.page.height - 70) doc.addPage();
        doc.font('Helvetica').fontSize(8.5).fillColor(q.is_correct ? '#166534' : q.selected_answer ? '#b91c1c' : '#6b7280')
          .text(`${i + 1}. [${q.code} · ${q.category} · ${q.difficulty}] Selected: ${q.selected_answer || 'Unanswered'} · Correct: ${q.correct_answer} ${q.selected_answer ? (q.is_correct ? '(correct)' : '(incorrect)') : ''}`);
        doc.fillColor('#111827').fontSize(8).text(q.question, { indent: 10 }).moveDown(0.3);
      });
    }
  });
}

module.exports = { dataset, toCsv, toXlsx, toPdfTable, candidateReport };
