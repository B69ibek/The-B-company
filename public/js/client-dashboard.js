const STATUS_LABEL = { pending: 'Pending', in_transit: 'In transit', delivered: 'Delivered' };

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

(async function init() {
  let user;
  try {
    user = await TBC.loadSession();
  } catch (_) {
    window.location.href = '/client-login.html';
    return;
  }
  if (!user || user.role !== 'client') {
    window.location.href = '/client-login.html';
    return;
  }

  document.getElementById('whoAmI').textContent = `Signed in as ${user.username}`;

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await TBC.logout();
    window.location.href = '/client-login.html';
  });

  try {
    const profile = await TBC.request('/client/profile');
    document.getElementById('companyLine').textContent = profile.companyName || '';
  } catch (_) { /* non-fatal */ }

  const shipments = await TBC.request('/client/shipments');
  const el = document.getElementById('shipmentsTable');

  if (!shipments.length) {
    el.innerHTML = `<div class="empty-state">No shipments on record yet. Contact The B Company for updates.</div>`;
    return;
  }

  el.innerHTML = `<table>
    <thead><tr>
      <th>Ref No</th><th>Route</th><th>Mode</th><th>Goods</th><th>Value</th><th>Status</th><th>Dispatch</th><th>ETA</th>
    </tr></thead>
    <tbody>
      ${shipments.map(s => `
        <tr>
          <td class="mono">${esc(s.refNo || '—')}</td>
          <td>${esc(s.origin || '?')} → ${esc(s.destination || '?')}</td>
          <td>${esc(s.mode || '—')}</td>
          <td>${esc(s.goodsDescription || '—')}</td>
          <td class="mono">${esc(s.currency || '')} ${esc(s.value || '')}</td>
          <td><span class="badge ${s.status || 'pending'}">${STATUS_LABEL[s.status] || s.status || 'Pending'}</span></td>
          <td class="mono">${esc(s.dispatchDate || '—')}</td>
          <td class="mono">${esc(s.eta || '—')}</td>
        </tr>`).join('')}
    </tbody>
  </table>`;
})();
