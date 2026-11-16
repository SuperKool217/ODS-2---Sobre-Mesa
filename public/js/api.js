const USER_KEY = 'cerohambre_user';

export function saveSession(user) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearSession() {
  sessionStorage.removeItem(USER_KEY);
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
}

export async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...options, headers, credentials: 'same-origin' });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    if (response.status === 401 && !location.pathname.endsWith('/login.html')) {
      sessionStorage.removeItem(USER_KEY);
      location.href = '/login.html';
    }
    throw new Error(data?.error || `Error HTTP ${response.status}`);
  }
  return data;
}

export function requireSession(role) {
  const user = JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
  if (!user) {
    location.href = '/login.html';
    return null;
  }
  if (role && user.rol !== role) {
    alert('Tu cuenta no tiene permisos para abrir esta página.');
    location.href = '/';
    return null;
  }
  return user;
}
