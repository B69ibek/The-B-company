const TBC = (() => {
  let csrfToken = null;

  async function request(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

    const res = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined
    });

    let data = {};
    try { data = await res.json(); } catch (_) { /* no body */ }

    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  async function loadSession() {
    const data = await request('/auth/session');
    csrfToken = data.csrfToken;
    return data.user;
  }

  async function adminLogin(username, password) {
    const data = await request('/auth/admin/login', { method: 'POST', body: { username, password } });
    csrfToken = data.csrfToken;
    return data.user;
  }

  async function clientLogin(username, password) {
    const data = await request('/auth/client/login', { method: 'POST', body: { username, password } });
    csrfToken = data.csrfToken;
    return data.user;
  }

  async function logout() {
    await request('/auth/logout', { method: 'POST' });
    csrfToken = null;
  }

  return { request, loadSession, adminLogin, clientLogin, logout };
})();
