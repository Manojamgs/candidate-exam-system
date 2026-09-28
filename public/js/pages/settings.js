import { get, put, post, del } from '../api.js';
import { h, html, field, select, table, toast, fmt, modal, formData, confirmBox } from '../ui.js';
import { session, loadBrand, relayout, brand } from '../app.js';

// [key, label, type, hint, options]
const TABS = [
  ['Scoring & passing', [
    ['scoring.aptitude_weight', 'Aptitude weighting (%)', 'number', 'Both sections are normalised to 100 before weighting.'],
    ['scoring.communication_weight', 'Communication weighting (%)', 'number'],
    ['scoring.aptitude_min_pct', 'Aptitude minimum (%)', 'number', 'Mandatory – below this is FAIL regardless of overall score.'],
    ['scoring.communication_min_pct', 'Communication minimum (%)', 'number', 'Mandatory'],
    ['scoring.overall_min_pct', 'Overall minimum (%)', 'number', 'Mandatory'],
    ['scoring.prg_aptitude_weight', 'With programming: aptitude weighting', 'number', 'Used when the exam includes the programming section (default 40/30/30).'],
    ['scoring.prg_communication_weight', 'With programming: communication weighting', 'number'],
    ['scoring.prg_programming_weight', 'With programming: programming weighting', 'number'],
    ['scoring.programming_min_pct', 'Programming minimum (%)', 'number', 'Mandatory when the exam includes programming.'],
    ['scoring.require_evaluator_finalization', 'Require an evaluator to finalise each result', 'bool', 'If off, results finalise automatically once all answers are evaluated.'],
  ]],
  ['Timer & exam', [
    ['timer.mode', 'Timer mode', 'enum', 'Combined: one timer, free navigation. Sectional: aptitude then communication, each with its own time.', [['combined', 'Combined timer'], ['sectional', 'Separate section timers']]],
    ['timer.total_minutes', 'Total duration (minutes) – combined mode', 'number'],
    ['timer.aptitude_minutes', 'Aptitude duration (minutes) – sectional mode', 'number'],
    ['timer.communication_minutes', 'Communication duration (minutes) – sectional mode', 'number'],
    ['timer.programming_minutes', 'Programming duration (minutes)', 'number', 'Added to the total in combined mode; section 3 time in sectional mode.'],
    ['timer.grace_seconds', 'Network grace period (seconds)', 'number', 'Allows the final autosave to arrive after the timer hits zero.'],
    ['exam.autosave_seconds', 'Autosave interval (seconds)', 'number'],
    ['exam.allow_resume', 'Allow candidates to resume after the browser closes', 'bool'],
    ['exam.randomize_questions', 'Randomise aptitude question order', 'bool'],
    ['exam.randomize_options', 'Randomise answer options', 'bool'],
    ['exam.randomize_communication', 'Randomise communication question order', 'bool'],
    ['exam.min_words_recommended', 'Recommended minimum words', 'number'], ['exam.max_words', 'Word guidance maximum', 'number'],
    ['exam.disable_copy_paste', 'Block copy / paste / right-click in the exam', 'bool'],
    ['exam.tab_switch_warning_limit', 'Tab-switch warnings before final warning', 'number'],
    ['exam.capture_ip', 'Record candidate IP address', 'bool', 'Ensure your privacy notice covers this.'],
    ['exam.capture_browser', 'Record browser information', 'bool'],
    ['exam.show_result_to_candidate', 'Show finalised result to candidates', 'bool'],
    ['exam.show_correct_answers', 'Show correct answers to candidates (with result)', 'bool'],
  ]],
  ['Assignment & attempts', [
    ['exam.default_exam_type', 'Default exam type', 'enum', null, [['APT-COMM', 'Aptitude & Communication'], ['APT-COMM-PRG', 'Aptitude, Communication & Programming']]],
    ['exam.assignment_method', 'Default assignment method', 'enum', null, [['automatic', 'Automatic – least recently used set'], ['random', 'Random'], ['manual', 'Manual']]],
    ['exam.programming_language_choice', 'Programming language chosen by', 'enum', 'Candidate: picks from the skills they declare before starting. HR: fixed when the exam is assigned.', [['candidate', 'Candidate (from declared skills)'], ['hr', 'HR at assignment']]],
    ['exam.collect_skills', 'Ask candidates for their skills before the exam', 'bool'],
    ['exam.min_skills', 'Minimum number of skills', 'number'],
    ['exam.link_expiry_days', 'Exam link expiry (days)', 'number'],
    ['exam.require_access_code', 'Require access code with the exam link', 'bool'],
    ['exam.max_attempts', 'Maximum attempts per candidate', 'number'],
    ['exam.retake_allowed', 'Retakes allowed', 'bool'],
    ['exam.retake_requires_approval', 'Retakes requested by HR need Admin approval', 'bool'],
    ['exam.retake_new_set', 'Retakes must use a set not taken before', 'bool'],
  ]],
  ['AI evaluation', [
    ['ai.enabled', 'Enable AI evaluation', 'bool', 'When off, the built-in rule-based evaluator is used.'],
    ['ai.provider', 'Provider', 'enum', null, [['anthropic', 'Claude (Anthropic)'], ['openai', 'OpenAI'], ['rule', 'Rule-based engine (offline)']]],
    ['ai.anthropic_model', 'Claude model', 'text'], ['ai.anthropic_api_key', 'Anthropic API key', 'secret'],
    ['ai.openai_model', 'OpenAI model', 'text'], ['ai.openai_api_key', 'OpenAI API key', 'secret'],
    ['ai.auto_evaluate_on_submit', 'Evaluate automatically on submission', 'bool'],
    ['ai.fallback_to_rule', 'Communication: fall back to rule-based scoring if the AI call fails', 'bool'],
    ['ai.evaluate_programming', 'Evaluate programming answers with AI', 'bool', 'Code is never executed. Without AI (or if a call fails) programming answers wait for an evaluator.'],
  ]],
  ['Rescheduling', [
    ['reschedule.enabled', 'Allow reschedule requests for technical issues', 'bool'],
    ['reschedule.allow_self_approval', 'Allow an Admin to approve a request they raised', 'bool', 'Off = segregation of duties: a different Admin must decide.'],
    ['reschedule.max_per_candidate', 'Approved reschedules per candidate before an override is required', 'number'],
    ['reschedule.default_extra_minutes', 'Default extra minutes for "resume" requests', 'number'],
    ['reschedule.voided_attempt_counts', 'A voided (rescheduled) attempt counts toward the attempt limit', 'bool'],
  ]],
  ['Backend sync', [
    ['backend.type', 'Backend type', 'enum', 'All data is always stored in the application database; this adds synchronisation.', [['none', 'None (local database only)'], ['google_sheets', 'Google Sheets'], ['sharepoint', 'Microsoft SharePoint']]],
    ['backend.auto_sync', 'Sync automatically in the background', 'bool'],
    ['google.sheet_id', 'Google Sheet ID', 'text', 'From the sheet URL: docs.google.com/spreadsheets/d/<ID>/edit. Share the sheet with the service account email.'],
    ['google.service_account_json', 'Google service account JSON', 'secret-multi'],
    ['google.sheet_names', 'Sheet (tab) names', 'json'],
    ['sharepoint.site_url', 'SharePoint site URL', 'text', 'e.g. https://contoso.sharepoint.com/sites/Recruitment'],
    ['sharepoint.tenant_id', 'Microsoft Entra tenant ID', 'text'], ['sharepoint.client_id', 'App (client) ID', 'text'],
    ['sharepoint.client_secret', 'Client secret', 'secret'], ['sharepoint.list_names', 'SharePoint list names', 'json'],
  ]],
  ['Email', [
    ['email.enabled', 'Send email notifications', 'bool'],
    ['email.transport', 'Transport', 'enum', '"Log only" records emails in the outbox without sending (for testing).', [['log', 'Log only (no sending)'], ['smtp', 'SMTP / Microsoft 365']]],
    ['email.from', 'From address', 'text'], ['email.company_name', 'Company name (emails & reports)', 'text'],
    ['email.smtp_host', 'SMTP host', 'text', 'Microsoft 365: smtp.office365.com · Gmail: smtp.gmail.com'], ['email.smtp_port', 'SMTP port', 'number'],
    ['email.smtp_secure', 'Use implicit TLS (port 465)', 'bool', 'Leave off for STARTTLS on 587.'], ['email.smtp_user', 'SMTP username', 'text'], ['email.smtp_password', 'SMTP password', 'secret'],
    ['email.hr_notification_address', 'HR notification address(es)', 'text', 'Comma-separated. Receives "exam submitted" and "result" emails.'],
    ['email.notify_recruiter', 'Also notify the staff member who assigned the exam', 'bool'],
    ['email.send_completion_email', 'Send candidates a completion confirmation', 'bool'],
  ]],
  ['Security', [
    ['security.staff_session_minutes', 'Staff idle session timeout (minutes)', 'number'],
    ['security.max_failed_logins', 'Failed logins before lockout', 'number'], ['security.lockout_minutes', 'Lockout duration (minutes)', 'number'],
  ]],
  ['Branding', [
    ['email.company_name', 'Company name', 'text', 'Shown on the login page, candidate portal, emails and PDF reports.'],
    ['branding.app_title', 'Application title', 'text'], ['branding.app_subtitle', 'Subtitle', 'text'],
    ['branding.primary_color', 'Primary colour', 'color', 'Sidebar, candidate exam header, email header. Text colour adjusts automatically for contrast.'],
    ['branding.accent_color', 'Accent colour', 'color', 'Buttons, links, highlights and charts.'],
    ['branding.logo_plate', 'Show the logo on a white plate over the primary colour', 'bool', 'Keep on if your logo is dark or full-colour; turn off for a white / reversed logo.'],
  ]],
];

export default async function render(el) {
  const d = await get('/settings');
  const s = d.settings;
  const isAdmin = session.user.role === 'admin';
  el.innerHTML = '';
  el.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Settings'), h('p', {}, isAdmin ? 'System configuration. Secrets are stored encrypted on the server and are never shown again.' : 'Read-only view. Only Admin users can change settings.'))));
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const panel = h('div');
  el.append(tabs, panel);
  const names = [...TABS.map((t) => t[0]), ...(isAdmin ? ['Users'] : [])];
  let current = sessionStorage.getItem('settings-tab') || names[0];
  if (!names.includes(current)) current = names[0];
  const show = (n) => { current = n; try { sessionStorage.setItem('settings-tab', n); } catch { /* ignore */ } [...tabs.children].forEach((b) => b.classList.toggle('active', b.textContent === n)); draw(); };
  for (const n of names) tabs.append(h('button', { role: 'tab', onclick: () => show(n) }, n));
  show(current);

  function draw() {
    panel.innerHTML = '';
    if (current === 'Users') return users(panel);
    const def = TABS.find((t) => t[0] === current)[1];
    const form = h('form', { class: 'card' });
    const grid = h('div', { class: 'form-grid' });
    for (const [key, label, type, hint, opts] of def) {
      let inp; const v = s[key];
      if (type === 'bool') { inp = h('input', { type: 'checkbox', name: key, disabled: !isAdmin }); inp.checked = !!v; grid.append(h('div', { class: 'field full' }, h('label', { class: 'check' }, inp, label), hint ? h('div', { class: 'hint' }, hint) : null)); continue; }
      if (type === 'enum') inp = select(key, opts, v, { disabled: !isAdmin });
      else if (type === 'number') inp = h('input', { type: 'number', name: key, value: v, step: 'any', min: 0, disabled: !isAdmin });
      else if (type === 'color') {
        inp = h('input', { type: 'color', name: key, value: v || '#000000', disabled: !isAdmin, style: 'width:64px;height:36px;padding:2px' });
        const hex = h('input', { type: 'text', value: v || '', maxlength: 7, disabled: !isAdmin, style: 'width:110px', class: 'mono', 'aria-label': `${label} hex` });
        inp.addEventListener('input', () => { hex.value = inp.value; });
        hex.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) inp.value = hex.value; });
        grid.append(field(label, h('div', { class: 'row', style: 'gap:8px;align-items:center' }, inp, hex), hint)); continue;
      }
      else if (type === 'json') inp = h('textarea', { name: key, rows: 5, class: 'mono', disabled: !isAdmin }, JSON.stringify(v, null, 2));
      else if (type.startsWith('secret')) {
        const status = v.configured ? `Configured (${v.source === 'environment' ? 'from environment variable' : 'stored encrypted'}) – leave blank to keep` : 'Not configured';
        inp = type === 'secret-multi' ? h('textarea', { name: key, rows: 4, placeholder: status, class: 'mono', disabled: !isAdmin || v.source === 'environment', autocomplete: 'off' })
          : h('input', { type: 'password', name: key, placeholder: status, autocomplete: 'new-password', disabled: !isAdmin || v.source === 'environment' });
        const wrap = field(label, inp, hint);
        if (isAdmin && v.configured && v.source !== 'environment') wrap.append(h('button', { class: 'btn sm ghost', type: 'button', onclick: async () => {
          if (!await confirmBox('Remove secret?', `Remove the stored ${label}?`, { danger: true, okText: 'Remove' })) return;
          try { await put('/settings', { [key]: '' }); toast('Secret removed', 'success'); render(el); } catch (e) { toast(e.message, 'error'); }
        } }, 'Remove stored value'));
        wrap.classList.add(type === 'secret-multi' ? 'full' : 'x'); grid.append(wrap); continue;
      } else inp = h('input', { type: 'text', name: key, value: v ?? '', disabled: !isAdmin });
      const f = field(label, inp, hint); if (type === 'json' || (hint && hint.length > 80)) f.classList.add('full'); grid.append(f);
    }
    form.append(grid);
    if (current === 'Timer & exam') form.prepend(h('div', { class: 'callout info' }, 'Timer changes apply to exams started after saving. Exams in progress keep their original deadline.'));
    if (isAdmin) {
      const save = h('button', { class: 'btn primary', type: 'submit' }, 'Save settings');
      form.append(h('div', { class: 'btn-row' }, save));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const raw = formData(form); const body = {};
        for (const [key, , type] of def) {
          if (type?.startsWith('secret')) { if (raw[key]) body[key] = raw[key]; continue; }
          if (type === 'json') { try { body[key] = JSON.parse(raw[key]); } catch { toast(`${key} must be valid JSON`, 'error'); return; } continue; }
          if (key in raw) body[key] = raw[key];
        }
        save.disabled = true;
        try {
          const r = await put('/settings', body); Object.assign(s, r.settings); toast('Settings saved', 'success');
          if (current === 'Branding') { await loadBrand(); relayout(); return; }
          draw();
        } catch (x) { toast(x.message, 'error', 6000); } finally { save.disabled = false; }
      });
    }
    panel.append(form);
    if (current === 'AI evaluation' && isAdmin) panel.append(h('div', { class: 'card' }, h('h3', {}, 'Test AI evaluation'), h('p', { class: 'muted small' }, 'Scores a built-in sample answer with the selected provider and shows the structured JSON.'),
      h('div', { class: 'btn-row' }, ...['anthropic', 'openai', 'rule'].map((p) => h('button', { class: 'btn', onclick: async (ev) => {
        ev.target.disabled = true;
        try { const r = await post('/integrations/test-ai', { provider: p }); showJson(`AI test – ${p} (${r.ms} ms)`, r.result); } catch (x) { toast(x.message, 'error', 8000); } finally { ev.target.disabled = false; }
      } }, `Test ${p}`)))));
    if (current === 'Backend sync') panel.append(syncCard());
    if (current === 'Email') panel.append(emailCard());
    if (current === 'Branding') panel.prepend(logoCard());
  }
  function logoCard() {
    const preview = h('div', { class: 'logo-preview' }, brand.logo ? h('img', { src: brand.logo.url, alt: 'Current logo' }) : h('span', { class: 'muted' }, 'No logo uploaded – the application title is shown instead.'));
    const file = h('input', { type: 'file', accept: '.svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp', class: 'hidden' });
    file.addEventListener('change', () => {
      const f = file.files[0]; if (!f) return;
      if (f.size > 512 * 1024) { toast('The logo must be 512 KB or smaller', 'error'); return; }
      const rd = new FileReader();
      rd.onload = async () => {
        try { await put('/branding/logo', { data_url: rd.result, file_name: f.name }); toast('Logo updated', 'success'); await loadBrand(); relayout(); }
        catch (e) { toast(e.message, 'error', 8000); }
      };
      rd.readAsDataURL(f);
    });
    return h('div', { class: 'card' }, h('h3', {}, 'Company logo'),
      h('p', { class: 'muted small' }, 'SVG, PNG, JPEG or WebP, up to 512 KB. Used on the staff console, login page, candidate portal and (PNG/JPEG) in emails and PDF reports. For best results in emails, upload a PNG as well as using an SVG for the web.'),
      preview, brand.logo ? h('p', { class: 'muted small' }, `${brand.logo.file_name} · ${brand.logo.bytes < 1024 ? brand.logo.bytes + " bytes" : Math.round(brand.logo.bytes / 1024) + " KB"}${brand.logo.raster ? '' : ' · SVG (emails and PDFs show the company name as text; upload a PNG to show the logo there too)'}`) : null,
      isAdmin ? h('div', { class: 'btn-row' }, file,
        h('button', { class: 'btn primary', type: 'button', onclick: () => file.click() }, brand.logo ? 'Replace logo' : 'Upload logo'),
        brand.logo ? h('button', { class: 'btn danger', type: 'button', onclick: async () => {
          if (!await confirmBox('Remove logo?', 'The application title will be shown instead of the logo.', { danger: true, okText: 'Remove' })) return;
          try { await del('/branding/logo'); toast('Logo removed', 'success'); await loadBrand(); relayout(); } catch (e) { toast(e.message, 'error'); }
        } }, 'Remove logo') : null) : null);
  }
  function syncCard() {
    const st = d.sync;
    const card = h('div', { class: 'card' }, h('h3', {}, 'Synchronisation'),
      h('div', { class: 'kv', style: 'margin-bottom:12px' }, ...[['Backend', st.backend], ['Pending', st.counts.pending || 0], ['Synced', st.counts.done || 0], ['Failed', st.counts.failed || 0], ['Last success', fmt.dt(st.last_success_at)]].map(([k, v]) => h('div', {}, h('span', {}, k), h('b', {}, String(v))))),
      st.last_error ? h('div', { class: 'callout bad small' }, `Last error (${st.last_error.entity} ${st.last_error.entity_key}): ${st.last_error.last_error}`) : null);
    if (isAdmin) card.append(h('div', { class: 'btn-row' },
      btn('Test connection', '/integrations/test', (r) => toast(`Connected: ${r.spreadsheet || r.site} ${r.sheets ? '(' + r.sheets.length + ' tabs)' : ''}`, 'success', 6000)),
      btn('Create sheets / lists', '/integrations/provision', (r) => toast(`Ready: ${r.created.join(', ')}`, 'success', 8000)),
      btn('Sync pending now', '/integrations/sync-now', (r) => { toast(`Synced ${r.done || 0}, failed ${r.failed || 0}`, r.failed ? 'error' : 'success'); render(el); }),
      btn('Full resync', '/integrations/full-sync', (r) => { toast(`Full sync: ${r.done || 0} records, ${r.failed || 0} failed`, r.failed ? 'error' : 'success', 8000); render(el); })));
    return card;
  }
  function emailCard() {
    const to = h('input', { type: 'email', placeholder: session.user.email, style: 'max-width:280px' });
    return h('div', { class: 'card' }, h('h3', {}, 'Email outbox (latest 25)'),
      isAdmin ? h('div', { class: 'btn-row', style: 'margin-bottom:12px' }, to, h('button', { class: 'btn', onclick: async () => {
        try { const r = await post('/integrations/test-email', { to: to.value || session.user.email }); toast(`Test email: ${r[0]?.status}${r[0]?.error ? ' – ' + r[0].error : ''}`, r[0]?.status === 'failed' ? 'error' : 'success', 8000); } catch (x) { toast(x.message, 'error'); }
      } }, 'Send test email')) : null,
      table([{ label: 'Created', render: (m) => fmt.dt(m.created_at) }, { label: 'Type', key: 'kind' }, { label: 'To', key: 'to_address' }, { label: 'Subject', key: 'subject' },
        { label: 'Status', render: (m) => html`<span class="badge ${m.status === 'sent' ? 'good' : m.status === 'failed' ? 'bad' : m.status === 'logged' ? 'info' : 'warn'}" title="${m.error || ''}">${m.status}</span>` }], d.outbox));
  }
  function btn(label, url, ok) {
    return h('button', { class: 'btn', onclick: async (ev) => { ev.target.disabled = true; try { ok(await post(url)); } catch (x) { toast(x.message, 'error', 9000); } finally { ev.target.disabled = false; } } }, label);
  }
}
function showJson(title, obj) { const m = modal({ title, body: h('pre', { class: 'answer-text mono small' }, JSON.stringify(obj, null, 2)) }); m.foot.append(h('button', { class: 'btn', onclick: m.close }, 'Close')); }

async function users(panel) {
  const list = await get('/users');
  const card = h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, 'Staff users'), h('button', { class: 'btn primary', onclick: () => edit() }, '+ New user')),
    h('p', { class: 'muted small' }, 'Admin: full access. HR: candidates, exams, questions, evaluation, reports (no settings or users). Evaluator: review & finalise communication evaluations.'),
    table([
      { label: 'Name', render: (u) => html`<b>${u.full_name}</b><div class="muted small">${u.username} · ${u.email}</div>` },
      { label: 'Role', render: (u) => html`<span class="badge brand">${u.role}</span>` },
      { label: 'Active', render: (u) => html`<span class="badge ${u.active ? 'good' : ''}">${u.active ? 'Active' : 'Disabled'}</span>` },
      { label: 'Last login', render: (u) => fmt.dt(u.last_login_at) },
      { label: '', render: (u) => h('button', { class: 'btn sm', onclick: () => edit(u) }, 'Edit') },
    ], list));
  panel.append(card);
  function edit(u) {
    const active = h('input', { type: 'checkbox', name: 'active' }); active.checked = u ? !!u.active : true;
    const form = h('form', {},
      u ? null : field('Username', h('input', { type: 'text', name: 'username', autocomplete: 'off' })),
      u ? null : field('Email', h('input', { type: 'email', name: 'email', autocomplete: 'off' })),
      field('Full name', h('input', { type: 'text', name: 'full_name', value: u?.full_name || '' })),
      field('Role', select('role', [['admin', 'Admin / HR (full)'], ['hr', 'HR / Recruiter'], ['evaluator', 'Evaluator']], u?.role || 'hr')),
      field(u ? 'Reset password (optional)' : 'Password', h('input', { type: 'password', name: 'password', autocomplete: 'new-password' }), 'Min 10 characters with upper-case, lower-case and a number.'),
      u ? h('label', { class: 'check' }, active, 'Active') : null);
    const m = modal({ title: u ? `Edit ${u.username}` : 'New user', body: form, size: 'narrow' });
    m.foot.append(h('button', { class: 'btn', onclick: m.close }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
      const d = formData(form); if (u && !d.password) delete d.password;
      try { u ? await put(`/users/${u.id}`, d) : await post('/users', d); m.close(); toast('User saved', 'success'); panel.innerHTML = ''; users(panel); } catch (x) { toast(x.message, 'error'); }
    } }, 'Save'));
  }
}
