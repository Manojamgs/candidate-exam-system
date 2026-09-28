import { get, post, put } from '../api.js';
import { h, fmt, badge, toast, confirmBox, select } from '../ui.js';
import { navigate, session } from '../app.js';

const SRC = { ai: ['AI Evaluation', 'purple'], rule: ['Automated rule-based', 'info'], manual: ['Manual (evaluator)', 'good'] };
const CRIT = [['grammar', 'Grammar'], ['vocabulary', 'Vocabulary'], ['clarity', 'Clarity'], ['structure', 'Structure'], ['professional', 'Professional Communication']];

export default async function render(el, { id }) {
  const d = await get(`/exams/${id}`);
  const { candidate: c, exam: e, result: r } = d;
  el.innerHTML = '';
  const reload = () => render(el, { id });
  const locked = r?.finalized;
  const prgList = d.programming || [];
  const pending = d.communication.filter((q) => !q.current_evaluation).length + prgList.filter((q) => !q.current_evaluation).length;
  const provider = select('provider', [['', 'Configured provider'], ['anthropic', 'Claude (Anthropic)'], ['openai', 'OpenAI'], ['rule', 'Rule-based engine']], '', { style: 'width:auto', 'aria-label': 'Evaluation provider' });
  const runBtn = (force) => h('button', { class: `btn ${force ? '' : 'primary'}`, disabled: locked, onclick: async (ev) => {
    if (force && !await confirmBox('Re-run automated evaluation?', 'AI / rule-based scores are recalculated for every answer. Manual evaluator scores are kept.', { okText: 'Re-run' })) return;
    ev.target.disabled = true; ev.target.textContent = 'Evaluating…';
    try { const out = await post(`/evaluation/exams/${e.id}/run`, { force, provider: provider.value || undefined }); toast(`${out.evaluated ?? 0} answer(s) evaluated`, 'success'); reload(); } catch (x) { toast(x.message, 'error'); reload(); }
  } }, force ? 'Re-run all' : `Evaluate ${pending} pending`);

  el.append(h('div', { class: 'page-head' },
    h('div', {}, h('a', { href: '#/evaluation', class: 'small' }, '‹ Evaluation queue'), h('h1', {}, `Evaluate: ${c.full_name}`),
      h('p', {}, `${c.candidate_code} · ${c.position_applied || ''} · ${e.exam_code} · ${e.set_code} · attempt ${e.attempt_number}`)),
    h('div', { class: 'btn-row' }, provider, pending ? runBtn(false) : null, runBtn(true), h('a', { class: 'btn', href: `#/results/${e.id}` }, 'Result view'))));

  if (locked) el.append(h('div', { class: 'callout good' }, `Result finalised ${fmt.dt(r.finalized_at)} as ${r.final_status}. Scores are frozen.`,
    session.user.role === 'admin' ? h('button', { class: 'btn sm', style: 'margin-left:10px', onclick: async () => {
      const reason = await confirmBox('Reopen result?', 'The result returns to evaluation so scores can be changed. This is recorded in the audit log.', { input: { label: 'Reason *', required: true }, okText: 'Reopen' });
      if (!reason) return; try { await post(`/evaluation/exams/${e.id}/reopen`, { reason }); toast('Result reopened', 'success'); reload(); } catch (x) { toast(x.message, 'error'); }
    } }, 'Reopen') : null));

  // Summary strip
  const sum = h('div', { class: 'grid g4', style: 'margin-bottom:18px' },
    stat('Aptitude (auto-scored)', `${r?.aptitude_score ?? '—'} / ${r?.aptitude_max ?? 20}`, fmt.pct(r?.aptitude_percentage)),
    stat('Communication', r?.communication_score != null ? `${fmt.num(r.communication_score, 1)} / 100` : '—', `${r?.communication_evaluated ?? 0}/10 evaluated`),
    stat('Overall', fmt.pct(r?.final_score), r?.final_status === 'Pending Evaluation' ? 'Pending' : `${r?.final_status}${locked ? '' : ' (provisional)'}`),
    ...(prgList.length ? [stat('Programming', r?.programming_score != null ? `${fmt.num(r.programming_score, 1)} / ${r.programming_max}` : '—', `${prgList[0].language_label} · ${r?.programming_evaluated ?? 0}/${prgList.length} evaluated`)] : []),
    stat('Integrity', `${e.tab_switch_count} tab switches`, `${e.suspicious_event_count} flags · ${e.submission_type === 'auto_timer' ? 'auto-submitted' : e.submission_type}`));
  if (prgList.length) sum.className = 'grid g5';
  el.append(sum);

  d.communication.forEach((q, i) => {
    const ev = q.current_evaluation;
    const card = h('div', { class: 'card' });
    const [srcLabel, srcCls] = ev ? SRC[ev.source] : ['Not evaluated', 'warn'];
    card.append(h('div', { class: 'card-head' },
      h('div', {}, h('h3', {}, `Q${i + 1}. ${q.question}`), h('div', { class: 'muted small' }, `${q.code} · ${q.word_count || 0} words (recommended ${q.expected_words_min}–${q.expected_words_max}) · ${q.marks} marks`)),
      h('span', { class: `badge ${srcCls}` }, srcLabel + (ev?.source === 'ai' ? ` · ${ev.provider}${ev.model ? ' / ' + ev.model : ''}` : ''))));
    card.append(h('div', { class: 'answer-text' }, q.answer_text || '(No answer submitted)'));
    if (ev) {
      card.append(h('div', { class: 'small', style: 'margin:10px 0' }, h('b', {}, 'Feedback: '), ev.feedback || '—'));
      if (ev.strengths?.length || ev.improvements?.length) card.append(h('div', { class: 'grid g2 small' },
        h('div', {}, h('b', {}, 'Strengths'), h('ul', {}, (ev.strengths || []).map((s) => h('li', {}, s)))),
        h('div', {}, h('b', {}, 'Improvements'), h('ul', {}, (ev.improvements || []).map((s) => h('li', {}, s))))));
    }
    if (q.answer_id) {
      const inputs = {};
      const row = h('div', { class: 'btn-row', style: 'align-items:flex-end;margin-top:8px' });
      for (const [k, label] of CRIT) {
        inputs[k] = h('input', { type: 'number', min: 0, max: 20, step: 0.5, value: ev ? ev[k] : '', class: 'score-input', disabled: locked, 'aria-label': `${label} score out of 20` });
        row.append(h('div', {}, h('label', { class: 'small' }, `${label} /20`), inputs[k]));
      }
      const total = h('b', {}, ev ? `${fmt.num(ev.total, 1)}/100 → ${fmt.num(ev.question_score, 2)}/${q.marks}` : '—');
      const upd = () => { const t = CRIT.reduce((s, [k]) => s + (Number(inputs[k].value) || 0), 0); total.textContent = `${fmt.num(t, 1)}/100 → ${fmt.num(t / 100 * q.marks, 2)}/${q.marks}`; };
      Object.values(inputs).forEach((x) => x.addEventListener('input', upd));
      const comments = h('input', { type: 'text', placeholder: 'Evaluator comment for this answer (optional)', value: ev?.evaluator_comments || '', disabled: locked, style: 'min-width:260px;flex:1', 'aria-label': 'Evaluator comment' });
      row.append(h('div', { style: 'flex:1;min-width:240px' }, h('label', { class: 'small' }, 'Comment'), comments), h('div', {}, h('label', { class: 'small' }, 'Total'), total));
      if (!locked) row.append(h('button', { class: 'btn primary', onclick: async () => {
        const body = Object.fromEntries(CRIT.map(([k]) => [k, Number(inputs[k].value)])); body.comments = comments.value;
        if (CRIT.some(([k]) => inputs[k].value === '' || body[k] < 0 || body[k] > 20)) { toast('Each criterion needs a score between 0 and 20', 'error'); return; }
        try { await put(`/evaluation/answers/${q.answer_id}`, body); toast(`Q${i + 1} saved as manual evaluation`, 'success'); reload(); } catch (x) { toast(x.message, 'error'); }
      } }, ev?.source === 'manual' ? 'Update score' : 'Save manual score'));
      card.append(row);
      if (q.evaluation_history.length > 1) {
        const det = h('details', { style: 'margin-top:8px' }, h('summary', { class: 'small muted' }, `Evaluation history (${q.evaluation_history.length})`));
        for (const hst of q.evaluation_history) det.append(h('div', { class: 'small' }, `${fmt.dt(hst.created_at)} · ${SRC[hst.source][0]}${hst.evaluator_name ? ' by ' + hst.evaluator_name : ''} · ${hst.total}/100 → ${hst.question_score}/${q.marks}${hst.is_current ? ' (current)' : ''}`));
        card.append(det);
      }
    }
    el.append(card);
  });

  if (prgList.length) {
    el.append(h('h2', { style: 'margin:22px 0 10px' }, `Programming – ${prgList[0].language_label} (set ${e.programming_set})`));
    if (d.skills?.length) el.append(h('p', { class: 'muted small' }, 'Declared skills: ' + d.skills.map((x) => `${x.skill} (${x.level}${x.years != null ? `, ${x.years}y` : ''})`).join(' · ')));
    const PCRIT = [['correctness', 'Correctness', 40], ['logic', 'Logic', 20], ['code_quality', 'Code quality', 15], ['efficiency', 'Efficiency', 10], ['edge_cases', 'Edge cases', 15]];
    const VERD = { correct: 'good', partially_correct: 'warn', incorrect: 'bad', not_attempted: '' };
    prgList.forEach((q, i) => {
      const ev = q.current_evaluation;
      const card = h('div', { class: 'card' });
      const [srcLabel, srcCls] = ev ? (ev.source === 'rule' ? ['Automatic (blank answer)', ''] : SRC[ev.source]) : ['Needs review', 'warn'];
      card.append(h('div', { class: 'card-head' },
        h('div', {}, h('h3', {}, `P${i + 1}. ${q.question}`), h('div', { class: 'muted small' }, `${q.code} · ${q.topic || ''} · ${q.task_type.replace('_', ' ')} · ${q.difficulty} · ${q.marks} marks`)),
        h('div', { class: 'btn-row' }, ev?.verdict ? h('span', { class: `badge ${VERD[ev.verdict]}` }, ev.verdict.replace('_', ' ')) : null,
          h('span', { class: `badge ${srcCls}` }, srcLabel + (ev?.source === 'ai' ? ` · ${ev.provider}` : '')))));
      if (q.starter_code) card.append(h('details', {}, h('summary', { class: 'small muted' }, 'Given code'), h('pre', { class: 'answer-text mono small' }, q.starter_code)));
      card.append(h('div', { class: 'small muted', style: 'margin:6px 0 2px' }, 'Candidate answer'), h('pre', { class: 'answer-text mono', style: 'white-space:pre-wrap' }, q.answer_text || '(No answer submitted)'));
      card.append(h('details', { style: 'margin-top:6px' }, h('summary', { class: 'small' }, 'Reference solution & evaluation points'),
        h('pre', { class: 'answer-text mono small' }, q.reference_solution), h('ul', { class: 'small' }, (q.evaluation_points || []).map((x) => h('li', {}, x)))));
      if (ev) {
        card.append(h('div', { class: 'small', style: 'margin:10px 0' }, h('b', {}, 'Feedback: '), ev.feedback || '—'));
        if (ev.issues?.length) card.append(h('div', { class: 'callout bad small' }, h('b', {}, 'Issues: '), ev.issues.join(' · ')));
      }
      if (q.answer_id) {
        const inputs = {};
        const row = h('div', { class: 'btn-row', style: 'align-items:flex-end;margin-top:8px' });
        for (const [k, label, max] of PCRIT) {
          inputs[k] = h('input', { type: 'number', min: 0, max, step: 0.5, value: ev ? ev[k] : '', class: 'score-input', disabled: locked, 'aria-label': `${label} score out of ${max}` });
          row.append(h('div', {}, h('label', { class: 'small' }, `${label} /${max}`), inputs[k]));
        }
        const total = h('b', {}, ev ? `${fmt.num(ev.total, 1)}/100 → ${fmt.num(ev.question_score, 2)}/${q.marks}` : '—');
        const upd = () => { const t = PCRIT.reduce((m, [k]) => m + (Number(inputs[k].value) || 0), 0); total.textContent = `${fmt.num(t, 1)}/100 → ${fmt.num(t / 100 * q.marks, 2)}/${q.marks}`; };
        Object.values(inputs).forEach((x) => x.addEventListener('input', upd));
        const verdict = select('verdict', [['', 'Verdict: auto'], ['correct', 'Correct'], ['partially_correct', 'Partially correct'], ['incorrect', 'Incorrect'], ['not_attempted', 'Not attempted']], '', { disabled: locked, style: 'width:auto' });
        const comments = h('input', { type: 'text', placeholder: 'Evaluator comment (optional)', value: ev?.evaluator_comments || '', disabled: locked, style: 'min-width:220px;flex:1', 'aria-label': 'Evaluator comment' });
        row.append(h('div', {}, h('label', { class: 'small' }, 'Verdict'), verdict), h('div', { style: 'flex:1;min-width:220px' }, h('label', { class: 'small' }, 'Comment'), comments), h('div', {}, h('label', { class: 'small' }, 'Total'), total));
        if (!locked) row.append(h('button', { class: 'btn primary', onclick: async () => {
          const body = Object.fromEntries(PCRIT.map(([k]) => [k, Number(inputs[k].value)]));
          if (PCRIT.some(([k, , max]) => inputs[k].value === '' || body[k] < 0 || body[k] > max)) { toast('Enter every criterion within its maximum', 'error'); return; }
          body.comments = comments.value; if (verdict.value) body.verdict = verdict.value;
          try { await put(`/evaluation/programming-answers/${q.answer_id}`, body); toast(`P${i + 1} saved as manual evaluation`, 'success'); reload(); } catch (x) { toast(x.message, 'error'); }
        } }, ev?.source === 'manual' ? 'Update score' : 'Save manual score'));
        card.append(row);
        if (q.evaluation_history.length > 1) {
          const det = h('details', { style: 'margin-top:8px' }, h('summary', { class: 'small muted' }, `Evaluation history (${q.evaluation_history.length})`));
          for (const hst of q.evaluation_history) det.append(h('div', { class: 'small' }, `${fmt.dt(hst.created_at)} · ${hst.source}${hst.evaluator_name ? ' by ' + hst.evaluator_name : ''} · ${hst.total}/100 → ${hst.question_score}/${q.marks}${hst.is_current ? ' (current)' : ''}`));
          card.append(det);
        }
      }
      el.append(card);
    });
  }

  const comments = h('textarea', { rows: 4, disabled: locked, placeholder: 'Overall evaluator comments (shown on the result and PDF report)' });
  comments.value = r?.evaluator_comments || '';
  el.append(h('div', { class: 'card' }, h('h3', {}, 'Overall evaluator comments'), comments,
    h('div', { class: 'btn-row', style: 'margin-top:10px' },
      h('button', { class: 'btn', disabled: locked, onclick: async () => { try { await put(`/evaluation/exams/${e.id}/comments`, { comments: comments.value }); toast('Comments saved', 'success'); } catch (x) { toast(x.message, 'error'); } } }, 'Save comments'),
      h('button', { class: 'btn success', disabled: locked || r?.final_status === 'Pending Evaluation', onclick: async () => {
        if (!await confirmBox('Finalise result?', `Final result: ${r.final_status} (${fmt.pct(r.final_score)}). The candidate record will be updated and HR notified. Finalised scores are frozen.`, { okText: 'Finalise' })) return;
        try { const out = await post(`/evaluation/exams/${e.id}/finalize`, { comments: comments.value }); toast(`Result finalised: ${out.final_status}`, 'success'); navigate(`results/${e.id}`); } catch (x) { toast(x.message, 'error'); }
      } }, 'Finalise result'),
      r?.final_status === 'Pending Evaluation' ? h('span', { class: 'muted small' }, `All written${prgList.length ? ' and programming' : ''} answers must be evaluated before finalising.`) : null)));
  void badge;
}
const stat = (l, v, s) => h('div', { class: 'stat' }, h('div', { class: 'label' }, l), h('div', { class: 'value', style: 'font-size:20px' }, v), h('div', { class: 'sub' }, s || ''));
