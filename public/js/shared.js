// Shared dialogs: candidate form, exam assignment, credential display.
import { get, post, put } from './api.js';
import { h, modal, field, select, toast, copyText, formData } from './ui.js';

export const CANDIDATE_STATUSES = ['New', 'Shortlisted', 'Exam Assigned', 'Exam Started', 'Exam Completed', 'Under Evaluation', 'Passed', 'Failed', 'Selected', 'Rejected', 'On Hold'];
const FIELDS = [
  ['Personal', [['first_name', 'First name *'], ['last_name', 'Last name *'], ['email', 'Email *', 'email'], ['mobile', 'Mobile number'],
    ['alternate_mobile', 'Alternate mobile'], ['date_of_birth', 'Date of birth', 'date'], ['nationality', 'Nationality'],
    ['current_location', 'Current location'], ['country', 'Country'], ['city', 'City']]],
  ['Application', [['position_applied', 'Position applied for'], ['department', 'Department'], ['application_date', 'Application date', 'date'],
    ['recruitment_source', 'Recruitment source', 'list:Referral,LinkedIn,Job Portal,Company Website,Recruitment Agency,Campus,Walk-in,Other'],
    ['recruiter_name', 'Recruiter name'], ['interviewer', 'Interviewer'], ['candidate_status', 'Candidate status', 'status']]],
  ['Experience & education', [['experience', 'Experience summary'], ['years_of_experience', 'Years of experience', 'number'],
    ['highest_qualification', 'Highest qualification', 'list:High School,Diploma,Bachelor,Master,Doctorate,Professional Certification,Other'],
    ['university', 'University / institute'], ['current_company', 'Current company'], ['current_salary', 'Current salary'],
    ['expected_salary', 'Expected salary'], ['notice_period', 'Notice period']]],
];

export function candidateForm(c = {}, onSaved) {
  const form = h('form', { novalidate: true });
  for (const [group, fields] of FIELDS) {
    const fs = h('fieldset', {}, h('legend', {}, group));
    const grid = h('div', { class: 'form-grid' });
    for (const [name, label, type] of fields) {
      let inp;
      if (type === 'status') inp = select(name, CANDIDATE_STATUSES, c[name] || 'New');
      else if (type?.startsWith('list:')) inp = select(name, [['', '— Select —'], ...type.slice(5).split(',')], c[name]);
      else inp = h('input', { type: type || 'text', name, value: c[name] ?? '', ...(type === 'number' ? { min: 0, max: 60, step: 0.5 } : {}),
        ...(name === 'email' ? { autocomplete: 'off' } : {}) });
      grid.append(field(label, inp));
    }
    fs.append(grid); form.append(fs);
  }
  const m = modal({ title: c.id ? `Edit ${c.full_name}` : 'New candidate', body: form, size: 'wide' });
  const save = h('button', { class: 'btn primary', type: 'button' }, c.id ? 'Save changes' : 'Create candidate');
  save.addEventListener('click', async () => {
    const d = formData(form);
    if (!d.first_name.trim() || !d.last_name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) { toast('First name, last name and a valid email are required', 'error'); return; }
    save.disabled = true;
    try {
      const r = c.id ? await put(`/candidates/${c.id}`, d) : await post('/candidates', d);
      m.close(); toast(c.id ? 'Candidate updated' : `Candidate ${r.candidate_code} created`, 'success'); onSaved?.(r);
    } catch (e) { toast(e.message, 'error'); } finally { save.disabled = false; }
  });
  m.foot.append(h('button', { class: 'btn', onclick: m.close }, 'Cancel'), save);
}

const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
export { toLocalInput, fromLocalInput };

export async function assignDialog(candidate, onDone) {
  const [sets, st, types, langs] = await Promise.all([get('/exam-sets'), get('/settings').catch(() => null), get('/exam-types'), get('/programming/languages')]);
  const s = st?.settings || {};
  const defMethod = s['exam.assignment_method'] || 'automatic';
  const langMode = s['exam.programming_language_choice'] || 'candidate';
  const priorAttempts = candidate.attempts ?? 0;
  const form = h('form');
  const typeSel = select('exam_type', types.map((t) => [t.code, t.name]), s['exam.default_exam_type'] || 'APT-COMM');
  const method = select('method', [['automatic', 'Automatic – least recently used set'], ['random', 'Random set'], ['manual', 'Manual – choose a set']], defMethod);
  const setSel = select('set_id', sets.filter((x) => x.active).map((x) => [x.id, `${x.code} – ${x.name} (used ${x.used}×)${x.readiness.ready ? '' : ' – incomplete'}`]), '');
  const setField = field('Aptitude & communication set', setSel, 'Sets the candidate has already taken are flagged; retakes should use a new set.');
  const ready = langs.filter((l) => l.active && l.sets.some((x) => x.ready));
  const langSel = select('programming_language', [['', langMode === 'hr' ? 'Select a language…' : 'Let the candidate choose from their skills'], ...ready.map((l) => [l.key, l.label])], '');
  const prgSetSel = select('programming_set', [['', 'Automatic (least recently used, not taken before)']], '');
  const refreshPrgSets = () => {
    prgSetSel.innerHTML = '';
    prgSetSel.append(h('option', { value: '' }, 'Automatic (least recently used, not taken before)'));
    const l = ready.find((x) => x.key === langSel.value);
    for (const x of l ? l.sets.filter((y) => y.ready) : []) prgSetSel.append(h('option', { value: x.set_number }, `${l.label} set ${x.set_number} (used ${x.used}×)`));
    prgSetF.classList.toggle('hidden', !langSel.value);
  };
  const langF = field('Programming language', langSel, langMode === 'hr' ? 'Required: the language is fixed by HR (Settings → Assignment).' : 'Optional: leave empty to let the candidate pick from the skills they declare.');
  const prgSetF = field('Programming set', prgSetSel);
  const prgBox = h('fieldset', {}, h('legend', {}, 'Programming section'), langF, prgSetF);
  const from = h('input', { type: 'datetime-local', name: 'available_from' });
  const exp = h('input', { type: 'datetime-local', name: 'expires_at' });
  const reason = h('textarea', { name: 'retake_reason', rows: 2, placeholder: 'e.g. Connectivity issue during first attempt' });
  form.append(field('Exam type', typeSel), field('Assignment method', method), setField, prgBox,
    h('fieldset', {}, h('legend', {}, 'Schedule (optional)'), h('div', { class: 'form-grid' },
      field('Available from', from, 'Leave empty to open immediately.'), field('Link expires', exp, `Default: ${s['exam.link_expiry_days'] || 7} days after opening.`))));
  if (priorAttempts > 0) form.append(h('div', { class: 'callout warn' }, `This is a retake (attempt ${priorAttempts + 1}). A reason is required and may need Admin approval.`), field('Retake reason *', reason));
  const toggle = () => {
    setField.classList.toggle('hidden', method.value !== 'manual');
    prgBox.classList.toggle('hidden', !(types.find((t) => t.code === typeSel.value)?.config?.sections || []).some((x) => x.kind === 'code'));
  };
  method.addEventListener('change', toggle); typeSel.addEventListener('change', toggle); langSel.addEventListener('change', refreshPrgSets);
  toggle(); refreshPrgSets();
  const m = modal({ title: `Assign examination – ${candidate.full_name}`, body: form, size: 'narrow' });
  const go = h('button', { class: 'btn primary', type: 'button' }, 'Assign & send invitation');
  go.addEventListener('click', async () => {
    go.disabled = true;
    try {
      const d = formData(form);
      const hasPrg = !prgBox.classList.contains('hidden');
      const r = await post(`/candidates/${candidate.id}/assign`, { exam_type: d.exam_type, method: d.method, set_id: d.method === 'manual' ? Number(d.set_id) : undefined,
        retake_reason: d.retake_reason, programming_language: hasPrg ? d.programming_language || undefined : undefined,
        programming_set: hasPrg && d.programming_set ? Number(d.programming_set) : undefined, available_from: fromLocalInput(d.available_from), expires_at: fromLocalInput(d.expires_at) });
      m.close();
      if (r.pending_approval) toast(`Retake ${r.exam_code} (${r.exam_set}) created and awaiting Admin approval`, 'success', 6000);
      else showCredentials(r, `Exam ${r.exam_code} assigned – ${r.exam_set}${r.programming ? ` · ${r.programming.label} set ${r.programming.set}` : ''}`,
        { examId: r.exam_id, candidateEmail: candidate.email, candidateName: candidate.first_name });
      for (const w of r.warnings || []) toast(w, 'info', 7000);
      onDone?.(r);
    } catch (e) { toast(e.message, 'error', 6000); } finally { go.disabled = false; }
  });
  m.foot.append(h('button', { class: 'btn', onclick: m.close }, 'Cancel'), go);
}

export function showCredentials(r, title = 'Exam link', { examId = r.exam_id, candidateEmail = r.candidate_email, candidateName = r.candidate_name } = {}) {
  const box = h('div', {},
    h('div', { class: 'callout info' }, r.viewed ? 'This is the candidate\'s current exam link. Viewing it is recorded in the audit log.'
      : 'The invitation email with this link and access code has been queued. You can also email it again below, or open it in your own email app.'),
    field('Candidate exam link', h('div', { class: 'copybox' }, h('span', { class: 'mono', style: 'flex:1' }, r.link), h('button', { class: 'btn sm', type: 'button', onclick: () => copyText(r.link) }, 'Copy'))),
    field('Access code', h('div', { class: 'copybox' }, h('b', { class: 'mono', style: 'flex:1;font-size:18px;letter-spacing:.15em' }, r.access_code), h('button', { class: 'btn sm', type: 'button', onclick: () => copyText(r.access_code) }, 'Copy'))),
    r.available_from ? h('p', { class: 'muted small' }, `Exam opens: ${new Date(r.available_from).toLocaleString()}`) : null,
    h('p', { class: 'muted small' }, `Link expires: ${new Date(r.expires_at).toLocaleString()}`),
    examId ? emailLinkPanel(examId, { ...r, candidateEmail, candidateName }) : null);
  const m = modal({ title, body: box, size: 'narrow' });
  m.foot.append(h('button', { class: 'btn primary', onclick: m.close }, 'Done'));
}

// "Email this link" – sends the branded invitation (with optional personal note / CC) through the system outbox,
// or opens a pre-filled message in the staff member's own email app (mailto).
function emailLinkPanel(examId, r) {
  const to = h('input', { type: 'email', name: 'to', value: r.candidateEmail || '', maxlength: 200, placeholder: 'Leave blank to use the candidate\'s email' });
  const cc = h('input', { type: 'text', name: 'cc', maxlength: 600, placeholder: 'recruiter@company.com, manager@company.com' });
  const msg = h('textarea', { name: 'message', rows: 3, maxlength: 2000, placeholder: 'Optional personal message shown at the top of the email' });
  const incl = h('input', { type: 'checkbox', name: 'include_access_code', checked: true });
  const status = h('div', { class: 'small', style: 'margin-top:6px' });
  const send = async (btn, regenerate = false) => {
    btn.disabled = true; status.textContent = 'Sending…'; status.className = 'small muted';
    try {
      const out = await post(`/exams/${examId}/send-link`, { to: to.value.trim(), cc: cc.value, message: msg.value.trim() || undefined, include_access_code: incl.checked, regenerate });
      const failed = out.emails.filter((x) => x.status === 'failed');
      const pending = out.emails.filter((x) => x.status === 'queued');
      if (failed.length) { status.className = 'small err'; status.textContent = `Could not deliver to ${failed.map((x) => x.to_address).join(', ')}: ${failed[0].error || 'SMTP error'}. It will be retried automatically.`; }
      else if (out.emails.length && out.emails.every((x) => x.status === 'logged')) { status.className = 'small warn'; status.textContent = `Recorded for ${out.recipients.join(', ')}, but not delivered: email is in log-only mode. An Admin can configure SMTP / Microsoft 365 in Settings → Email, or use "Open in my email app".`; }
      else { status.className = 'small ok'; status.textContent = `${pending.length ? 'Queued' : 'Sent'} to ${out.recipients.join(', ')}${out.regenerated ? ' (a new link and access code were issued)' : ''}.`; }
      toast(failed.length ? 'Email delivery failed' : 'Exam link emailed', failed.length ? 'error' : 'success');
    } catch (e) {
      if (e.code === 'REGENERATE_REQUIRED') {
        status.className = 'small warn'; status.textContent = '';
        status.append(e.message + ' ', h('button', { class: 'btn sm danger', type: 'button', onclick: (ev) => send(ev.currentTarget, true) }, 'Issue new link & send'));
      } else { status.className = 'small err'; status.textContent = e.message; }
    } finally { btn.disabled = false; }
  };
  const mailto = () => {
    const body = `Dear ${r.candidateName || 'Candidate'},\n\n${msg.value.trim() ? msg.value.trim() + '\n\n' : ''}Please complete your online assessment using your personal link:\n${r.link}\n\n`
      + (incl.checked && r.access_code ? `Access code: ${r.access_code}\n` : '') + `The link expires on ${new Date(r.expires_at).toLocaleString()}.\n\nKind regards,\nRecruitment Team`;
    const url = `mailto:${encodeURIComponent(to.value.trim())}?${cc.value.trim() ? 'cc=' + encodeURIComponent(cc.value.trim()) + '&' : ''}subject=${encodeURIComponent('Your online assessment link')}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };
  return h('details', { class: 'email-link', open: true },
    h('summary', {}, '✉ Email this link'),
    h('div', { class: 'form-grid', style: 'grid-template-columns:1fr' },
      field('To', to), field('CC (optional, comma-separated, max 5)', cc), field('Personal message (optional)', msg),
      h('label', { class: 'check' }, incl, ' Include the access code in the email')),
    h('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' },
      h('button', { class: 'btn primary sm', type: 'button', onclick: (ev) => send(ev.currentTarget) }, 'Send email'),
      r.legacy ? null : h('button', { class: 'btn sm', type: 'button', title: 'Opens a pre-filled draft in Outlook / Mail on this computer', onclick: mailto }, 'Open in my email app')),
    status);
}

// Fetch the current link (audited) and show it with the email panel.
export async function emailLinkDialog(exam, candidate) {
  try {
    const r = await get(`/exams/${exam.id}/link`);
    if (!r.available) {
      return showCredentials({ link: '(link issued before v1.2 – a new one will be created when you send)', access_code: '——', expires_at: r.expires_at, viewed: true, legacy: true },
        `Email exam link – ${exam.exam_code}`, { examId: exam.id, candidateEmail: r.candidate_email, candidateName: r.candidate_name });
    }
    showCredentials({ ...r, viewed: true }, `Email exam link – ${exam.exam_code}`, { examId: exam.id, candidateEmail: r.candidate_email, candidateName: candidate?.first_name || r.candidate_name });
  } catch (e) { toast(e.message, 'error'); }
}

// ---------- Skills editor (HR) ----------
export function skillsDialog(candidate, skills, meta, onSaved) {
  const rows = h('div');
  const dl = h('datalist', { id: 'hr-skill-suggest' }, (meta.suggestions || []).map((x) => h('option', { value: x })));
  const add = (v = {}) => {
    const row = h('div', { class: 'form-grid', style: 'grid-template-columns:2fr 1.2fr 1.2fr .8fr auto;align-items:end;gap:8px' },
      field('Skill', h('input', { type: 'text', list: 'hr-skill-suggest', value: v.skill || '', maxlength: 60 })),
      field('Category', select('category', [['', 'Auto'], ...meta.categories], v.category)),
      field('Level', select('level', [['', 'Select…'], ...meta.levels], v.level)),
      field('Years', h('input', { type: 'number', min: 0, max: 50, step: 0.5, value: v.years ?? '' })),
      h('button', { type: 'button', class: 'btn sm danger', style: 'margin-bottom:12px', onclick: () => row.remove() }, '✕'));
    rows.append(row);
  };
  (skills.length ? skills : [{}]).forEach(add);
  const m = modal({ title: `Skills – ${candidate.full_name}`, body: h('div', {}, dl, h('p', { class: 'muted small' }, 'Record every relevant skill with a proficiency level. Candidates can also add or update their skills before starting the exam.'), rows,
    h('button', { type: 'button', class: 'btn sm', onclick: () => add() }, '+ Add skill')) });
  m.foot.append(h('button', { class: 'btn', onclick: m.close }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
    const list = [...rows.children].map((r) => { const [sk, cat, lv, yr] = r.querySelectorAll('input,select'); return { skill: sk.value.trim(), category: cat.value || undefined, level: lv.value, years: yr.value === '' ? null : Number(yr.value) }; }).filter((x) => x.skill);
    try { await put(`/candidates/${candidate.id}/skills`, { skills: list }); m.close(); toast('Skills saved', 'success'); onSaved?.(); } catch (e) { toast(e.message, 'error'); }
  } }, 'Save skills'));
}

// ---------- Reschedule request (HR) ----------
export async function rescheduleDialog(exam, candidate, onDone) {
  const meta = await get('/reschedules?status=__none__');
  const opts = exam.reschedule_options || [];
  if (!opts.length) { toast(`An exam that is ${exam.status} cannot be rescheduled`, 'error'); return; }
  const form = h('form');
  const reason = select('reason_category', Object.entries(meta.reasons), 'internet_outage');
  const option = select('requested_option', opts.map((o) => [o, meta.options[o]]), opts[0]);
  const extra = h('input', { type: 'number', name: 'extra_minutes', min: 0, max: 180, value: 15 });
  const extraF = field('Extra minutes to add', extra, 'Added to the remaining time; the candidate may resume once.');
  const start = h('input', { type: 'datetime-local', name: 'proposed_start' });
  const expiry = h('input', { type: 'datetime-local', name: 'proposed_expiry' });
  const windowF = h('div', { class: 'form-grid' }, field('New exam opens at', start, 'Empty = immediately after approval'), field('New link expires', expiry, 'Empty = default expiry'));
  const desc = h('textarea', { name: 'description', rows: 3, placeholder: 'What happened, when, and how it was reported (min. 20 characters)', required: true });
  const incident = h('input', { type: 'datetime-local', name: 'incident_at' });
  const ev = h('textarea', { name: 'evidence_notes', rows: 2, placeholder: 'e.g. ISP outage ticket number, screenshot sent by email, medical certificate reference' });
  form.append(h('div', { class: 'callout info small' }, `Exam ${exam.exam_code} (${exam.status}). System diagnostics — connection losses, resumes, last autosave, answers saved — are captured automatically with the request. An Admin must approve it.`),
    field('Reason *', reason), field('Requested action *', option), extraF, windowF, field('Description *', desc), h('div', { class: 'form-grid' }, field('Incident time', incident), field('Evidence / reference', ev)));
  const toggle = () => { extraF.classList.toggle('hidden', option.value !== 'resume_extra_time'); windowF.classList.toggle('hidden', option.value === 'resume_extra_time'); };
  option.addEventListener('change', toggle); toggle();
  const m = modal({ title: `Request reschedule – ${candidate.full_name}`, body: form });
  m.foot.append(h('button', { class: 'btn', onclick: m.close }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
    const d = formData(form);
    if (d.description.trim().length < 20) { toast('Please describe what happened (at least 20 characters)', 'error'); return; }
    try {
      const r = await post(`/exams/${exam.id}/reschedule-requests`, { reason_category: d.reason_category, requested_option: d.requested_option, description: d.description,
        extra_minutes: d.requested_option === 'resume_extra_time' ? Number(d.extra_minutes) : undefined, proposed_start: fromLocalInput(d.proposed_start),
        proposed_expiry: fromLocalInput(d.proposed_expiry), incident_at: fromLocalInput(d.incident_at), evidence_notes: d.evidence_notes });
      m.close(); toast(`Request ${r.request_code} submitted for Admin approval`, 'success', 6000);
      for (const w of r.warnings || []) toast(w, 'info', 8000);
      onDone?.(r);
    } catch (e) { toast(e.message, 'error', 7000); }
  } }, 'Submit request'));
}
