import { get, post, setUnauthorizedHandler } from './api.js';
import { $, h, html, render, toast } from './ui.js';

const ROUTES = [
  // [pattern, module, title, permission, nav group, icon]
  ['dashboard', 'dashboard', 'Dashboard', 'dashboard', 'Overview', '▦'],
  ['candidates', 'candidates', 'Candidates', 'candidates.view', 'Recruitment', '👤'],
  ['candidates/:id', 'candidate', 'Candidate Details', 'candidates.view'],
  ['assign', 'assign', 'Exam Assignment', 'exams', 'Recruitment', '✉'],
  ['monitor', 'monitor', 'Exam Monitoring', 'monitor', 'Recruitment', '◉'],
  ['reschedules', 'reschedules', 'Reschedule Requests', 'exams', 'Recruitment', '↻'],
  ['results', 'results', 'Exam Results', 'results.view', 'Evaluation', '✓'],
  ['results/:id', 'result', 'Candidate Result', 'results.view'],
  ['evaluation', 'evaluation', 'Communication Evaluation', 'evaluation', 'Evaluation', '✎'],
  ['evaluation/:id', 'evaluate', 'Evaluate Exam', 'evaluation'],
  ['questions', 'questions', 'Question Bank', 'questions', 'Content', '?'],
  ['communication-questions', 'commQuestions', 'Communication Questions', 'questions', 'Content', '¶'],
  ['programming-questions', 'programmingQuestions', 'Programming Questions', 'questions', 'Content', '{}'],
  ['reports', 'reports', 'Reports & Export', 'reports', 'Administration', '⇩'],
  ['audit', 'audit', 'Audit Log', 'audit.view', 'Administration', '≡'],
  ['settings', 'settings', 'Settings', 'settings', 'Administration', '⚙'],
];
const PERMS = {
  admin: ['*'],
  hr: ['candidates', 'exams', 'results.view', 'questions', 'reports', 'dashboard', 'audit.view', 'evaluation', 'monitor', 'settings.view'],
  evaluator: ['results.view', 'evaluation', 'dashboard', 'candidates.view'],
};
export const session = { user: null };
export const brand = { title: 'Candidate Examination', subtitle: 'Aptitude & Communication', company: '', logo: null };
export async function loadBrand() {
  try { Object.assign(brand, await get('/brand')); } catch { /* keep defaults */ }
  document.title = `${brand.company ? brand.company + ' · ' : ''}${brand.title || 'Candidate Examination'}`;
  const css = document.querySelector('link[href^="/brand/theme.css"]'); if (css) css.href = `/brand/theme.css?v=${Date.now()}`;
  if (brand.logo) { let ic = document.querySelector('link[rel=icon]'); if (ic) ic.href = brand.logo.url; }
}
const logoImg = (cls) => (brand.logo ? h('img', { class: `${cls}${brand.logo_plate ? ' on-plate' : ''}`, src: brand.logo.url, alt: brand.company || 'Company logo' }) : null);
export function relayout() { layout(); route(); }
export function can(perm) {
  const p = PERMS[session.user?.role] || [];
  if (p.includes('*') || p.includes(perm)) return true;
  if (perm.endsWith('.view') && p.includes(perm.split('.')[0])) return true;
  if (perm === 'settings' && p.includes('settings.view')) return true;
  return false;
}
export function navigate(path) { location.hash = '#/' + path.replace(/^#?\/?/, ''); }

function match(path) {
  for (const r of ROUTES) {
    const parts = r[0].split('/'); const segs = path.split('/');
    if (parts.length !== segs.length) continue;
    const params = {}; let ok = true;
    parts.forEach((p, i) => { if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(segs[i]); else if (p !== segs[i]) ok = false; });
    if (ok) return { route: r, params };
  }
  return null;
}

function layout() {
  const app = $('#app');
  app.innerHTML = '';
  const groups = {};
  for (const r of ROUTES) if (r[4] && can(r[3])) (groups[r[4]] ||= []).push(r);
  const nav = h('nav', { 'aria-label': 'Main' });
  for (const [g, items] of Object.entries(groups)) {
    nav.append(h('div', { class: 'group' }, g));
    for (const r of items) nav.append(h('a', { href: `#/${r[0]}`, 'data-route': r[0] }, h('span', { class: 'icon', 'aria-hidden': 'true' }, r[5]), r[2]));
  }
  const shell = h('div', { class: 'shell' },
    h('aside', { class: 'sidebar' }, h('div', { class: 'brand' }, logoImg('brand-logo'), brand.title || 'Candidate Examination', h('small', {}, brand.subtitle || '')), nav),
    h('div', { class: 'main' },
      h('header', { class: 'topbar' },
        h('button', { class: 'btn ghost menu-btn', 'aria-label': 'Menu', onclick: () => shell.classList.toggle('nav-open') }, '☰'),
        h('div', { id: 'page-title', class: 'muted' }),
        h('div', { class: 'btn-row' },
          h('span', { class: 'muted small' }, `${session.user.full_name} · `, h('span', { class: 'badge brand' }, session.user.role.toUpperCase())),
          h('button', { class: 'btn sm', onclick: changePassword }, 'Password'),
          h('button', { class: 'btn sm', onclick: logout }, 'Sign out'))),
      h('main', { class: 'content', id: 'content' })));
  nav.addEventListener('click', () => shell.classList.remove('nav-open'));
  app.append(shell);
}

async function logout() { try { await post('/auth/logout'); } catch { /* ignore */ } session.user = null; showLogin(); }
async function changePassword() {
  const { modal, field, formData } = await import('./ui.js');
  const form = h('form', {}, field('Current password', h('input', { type: 'password', name: 'current_password', required: true, autocomplete: 'current-password' })),
    field('New password', h('input', { type: 'password', name: 'new_password', required: true, autocomplete: 'new-password' }), 'At least 10 characters with upper-case, lower-case and a number.'));
  const m = modal({ title: 'Change password', body: form, size: 'narrow' });
  m.foot.append(h('button', { class: 'btn', onclick: m.close }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
    try { await post('/auth/change-password', formData(form)); m.close(); toast('Password changed', 'success'); } catch (e) { toast(e.message, 'error'); }
  } }, 'Change password'));
}

let currentToken = 0;
async function route() {
  if (!session.user) return;
  const path = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const m = match(path);
  const content = $('#content');
  if (!m || !can(m.route[3])) { render(content, html`<div class="card empty">Page not found or you do not have access. <a href="#/dashboard">Go to dashboard</a></div>`); return; }
  document.querySelectorAll('.sidebar nav a').forEach((a) => a.classList.toggle('active', path === a.dataset.route || path.startsWith(a.dataset.route + '/')));
  $('#page-title').textContent = m.route[2];
  document.title = `${m.route[2]} · Candidate Examination System`;
  const token = ++currentToken;
  render(content, html`<div class="empty"><span class="spinner"></span></div>`);
  try {
    const mod = await import(`./pages/${m.route[1]}.js`);
    if (token !== currentToken) return;
    content.innerHTML = '';
    window.scrollTo(0, 0);
    await mod.default(content, m.params, { isCurrent: () => token === currentToken });
  } catch (e) {
    if (token !== currentToken) return;
    console.error(e);
    render(content, html`<div class="callout bad">Could not load this page: ${e.message}</div>`);
  }
}

function showLogin() {
  const app = $('#app');
  app.innerHTML = '';
  const err = h('div', { class: 'callout bad hidden', role: 'alert' });
  const form = h('form', { autocomplete: 'on' },
    h('div', { class: 'field' }, h('label', { for: 'u' }, 'Username or email'), h('input', { id: 'u', name: 'username', type: 'text', required: true, autocomplete: 'username' })),
    h('div', { class: 'field' }, h('label', { for: 'p' }, 'Password'), h('input', { id: 'p', name: 'password', type: 'password', required: true, autocomplete: 'current-password' })),
    h('button', { class: 'btn primary', type: 'submit', style: 'width:100%;justify-content:center;padding:10px' }, 'Sign in'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.classList.add('hidden');
    const btn = form.querySelector('button'); btn.disabled = true;
    try {
      const r = await post('/auth/login', { username: form.username.value.trim(), password: form.password.value });
      session.user = r.user; layout(); if (!location.hash || location.hash === '#/login') location.hash = '#/dashboard'; route();
    } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); } finally { btn.disabled = false; }
  });
  app.append(h('div', { class: 'login-wrap' }, h('div', { class: 'login-card' },
    logoImg('login-logo'), h('h1', {}, brand.title || 'Candidate Examination System'),
    h('p', { class: 'muted' }, `${brand.company ? brand.company + ' – ' : ''}sign in to the recruitment console (Admin, HR, Evaluator).`), err, form,
    h('p', { class: 'muted small', style: 'margin-top:16px' }, 'Candidates: please use the personal exam link sent to you by email.'))));
  $('#u').focus();
}

setUnauthorizedHandler(() => { if (session.user) { session.user = null; toast('Your session has expired. Please sign in again.', 'error'); showLogin(); } });
window.addEventListener('hashchange', route);
(async () => {
  await loadBrand();
  try { const me = await get('/auth/me'); session.user = me.user; layout(); route(); } catch { showLogin(); }
})();
