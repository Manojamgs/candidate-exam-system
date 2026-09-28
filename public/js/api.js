// Thin fetch wrapper for the staff API. Credentials travel in an httpOnly cookie; the custom header is the CSRF guard.
export class ApiError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code; } }
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }
export async function api(method, url, body) {
  const res = await fetch('/api' + url, {
    method, credentials: 'same-origin',
    headers: { 'x-requested-with': 'cexs', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/auth/login')) onUnauthorized();
    throw new ApiError(res.status, (data && data.error) || res.statusText, data && data.code);
  }
  return data;
}
export const get = (u) => api('GET', u);
export const post = (u, b = {}) => api('POST', u, b);
export const put = (u, b = {}) => api('PUT', u, b);
export const del = (u) => api('DELETE', u);
export function qs(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString(); return s ? '?' + s : '';
}
