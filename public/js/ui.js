// DOM helpers (no framework). All user data goes through text nodes or esc() – never raw innerHTML.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
// Tagged template: interpolations are escaped unless wrapped with raw().
export function raw(s) { return { __raw: String(s ?? '') }; }
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) {
      const v = vals[i];
      if (Array.isArray(v)) out += v.map((x) => (x && x.__raw !== undefined ? x.__raw : esc(x))).join('');
      else out += v && v.__raw !== undefined ? v.__raw : esc(v);
    }
  });
  return raw(out);
}
export function render(el, content) { el.innerHTML = content.__raw !== undefined ? content.__raw : esc(content); return el; }
const BOOL_ATTRS = new Set(['disabled', 'checked', 'selected', 'required', 'readonly', 'hidden', 'multiple', 'autofocus', 'novalidate']);
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v; else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (BOOL_ATTRS.has(k)) { if (v) el.setAttribute(k, ''); } else if (v === true) el.setAttribute(k, ''); else if (v !== false && v !== null && v !== undefined) el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
export function toast(msg, type = 'info', ms = 4000) {
  let box = $('.toasts'); if (!box) { box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: `toast ${type}` }, msg); box.append(t); setTimeout(() => t.remove(), ms);
}
export function modal({ title, body, footer, size = '' }) {
  const back = h('div', { class: 'modal-backdrop' });
  const box = h('div', { class: `modal ${size}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const head = h('div', { class: 'modal-head' }, h('h2', {}, title), h('button', { class: 'btn ghost', 'aria-label': 'Close', onclick: close }, '✕'));
  const bodyEl = h('div', { class: 'modal-body' }); if (body instanceof Node) bodyEl.append(body); else render(bodyEl, body || '');
  const foot = h('div', { class: 'modal-foot' });
  box.append(head, bodyEl); if (footer !== false) box.append(foot);
  back.append(box); back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey); document.body.append(back);
  return { el: box, body: bodyEl, foot, close };
}
export function confirmBox(title, message, { okText = 'Confirm', danger = false, input = null } = {}) {
  return new Promise((resolve) => {
    const body = h('div', {}, h('p', {}, message));
    let inp = null;
    if (input) { inp = h(input.multiline ? 'textarea' : 'input', { type: 'text', placeholder: input.placeholder || '', 'aria-label': input.label || 'Value' }); body.append(h('div', { class: 'field' }, h('label', {}, input.label || ''), inp)); }
    const m = modal({ title, body, size: 'narrow' });
    const ok = h('button', { class: `btn ${danger ? 'danger' : 'primary'}` }, okText);
    ok.addEventListener('click', () => { if (input?.required && !inp.value.trim()) { inp.focus(); return; } m.close(); resolve(input ? inp.value : true); });
    m.foot.append(h('button', { class: 'btn', onclick: () => { m.close(); resolve(null); } }, 'Cancel'), ok);
    (inp || ok).focus();
  });
}
export const fmt = {
  date: (s) => (s ? new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }) : '—'),
  dt: (s) => (s ? new Date(s).toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'),
  pct: (v) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(v % 1 ? 1 : 0)}%`),
  num: (v, d = 2) => (v === null || v === undefined ? '—' : String(Math.round(v * 10 ** d) / 10 ** d)),
  dur: (s) => (s === null || s === undefined ? '—' : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`),
  hms: (s) => { s = Math.max(0, s | 0); return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map((x) => String(x).padStart(2, '0')).join(':'); },
};
const STATUS_CLASS = {
  PASS: 'good', Passed: 'good', Selected: 'good', Completed: 'good', FAIL: 'bad', Failed: 'bad', Rejected: 'bad', Expired: 'bad', Cancelled: '',
  Voided: '', Pending: 'warn', Approved: 'good', Withdrawn: '', correct: 'good', partially_correct: 'warn', incorrect: 'bad', not_attempted: '',
  'In Progress': 'info', 'Exam Started': 'info', Assigned: 'brand', 'Exam Assigned': 'brand', 'Under Evaluation': 'purple', Evaluated: 'purple',
  Submitted: 'purple', 'Exam Completed': 'purple', 'Pending Evaluation': 'warn', 'Pending Approval': 'warn', 'On Hold': 'warn', Shortlisted: 'info', New: '',
};
export function badge(text) { return html`<span class="badge ${STATUS_CLASS[text] ?? ''}">${text ?? '—'}</span>`; }
export function resultBadge(r) {
  if (!r || !r.final_status) return badge('—');
  if (r.final_status === 'Pending Evaluation') return badge('Pending Evaluation');
  return r.finalized ? badge(r.final_status) : html`<span class="badge ${r.final_status === 'PASS' ? 'good' : 'bad'}" title="Provisional – not yet finalised">${r.final_status} · provisional</span>`;
}
export function table(columns, rows, { onRow, empty = 'No records found.' } = {}) {
  const wrap = h('div', { class: 'table-wrap' });
  const t = h('table', { class: 'data' });
  const thead = h('thead', {}, h('tr', {}, columns.map((c) => h('th', { class: c.num ? 'num' : '' }, c.label))));
  const tb = h('tbody');
  if (!rows.length) tb.append(h('tr', {}, h('td', { colspan: columns.length, class: 'empty' }, empty)));
  for (const r of rows) {
    const tr = h('tr', { class: onRow ? 'clickable' : '' });
    for (const c of columns) {
      const td = h('td', { class: c.num ? 'num' : c.class || '' });
      const v = c.render ? c.render(r) : r[c.key];
      if (v instanceof Node) td.append(v); else if (v && v.__raw !== undefined) td.innerHTML = v.__raw; else td.textContent = v ?? '—';
      tr.append(td);
    }
    if (onRow) { tr.tabIndex = 0; tr.addEventListener('click', (e) => { if (!e.target.closest('button,a,input')) onRow(r); }); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') onRow(r); }); }
    tb.append(tr);
  }
  t.append(thead, tb); wrap.append(t); return wrap;
}
export function field(label, input, hint) { return h('div', { class: 'field' }, h('label', {}, label), input, hint ? h('div', { class: 'hint' }, hint) : null); }
export function input(name, value, attrs = {}) { return h('input', { type: 'text', name, value: value ?? '', ...attrs }); }
export function select(name, options, value, attrs = {}) {
  const s = h('select', { name, ...attrs });
  for (const o of options) { const [v, l] = Array.isArray(o) ? o : [o, o]; const op = h('option', { value: v }, l); if (String(v) === String(value ?? '')) op.selected = true; s.append(op); }
  return s;
}
export function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked; else if (el.type === 'number') o[el.name] = el.value === '' ? '' : Number(el.value); else o[el.name] = el.value;
  }
  return o;
}
export function downloadUrl(url) { const a = h('a', { href: url, download: '' }); document.body.append(a); a.click(); a.remove(); }
export function copyText(t) { navigator.clipboard?.writeText(t).then(() => toast('Copied to clipboard', 'success'), () => toast('Copy failed – select and copy manually', 'error')); }
export function bars(items, { max, format = (v) => v, label = (x) => x.label, value = (x) => x.value, title = (x) => `${label(x)}: ${format(value(x))}` } = {}) {
  const m = max ?? Math.max(1, ...items.map(value));
  return h('div', { class: 'bars' }, items.map((x) => h('div', { class: 'bar-row', title: title(x) },
    h('span', {}, label(x)), h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: `width:${Math.max(0, Math.min(100, value(x) / m * 100))}%` })),
    h('span', { class: 'v' }, format(value(x))))));
}
