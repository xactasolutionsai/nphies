export function normalizeApiBase(value) {
  const base = (value || '/api').replace(/\/+$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
}

export const API_BASE_URL = normalizeApiBase(import.meta.env.VITE_API_URL);

export function clearSession() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  // Unscoped drafts from older releases cannot safely be attributed to a user.
  localStorage.removeItem('generalRequestDraft');
  localStorage.removeItem('generalRequestDraftTimestamp');
  window.dispatchEvent(new Event('auth:changed'));
}

export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 && token === localStorage.getItem('auth_token')) clearSession();
  return response;
}
