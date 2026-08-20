let currentUser = null;
let cache = { buyers: [], sellers: [], suppliers: [], shipments: [], interstate: [], clients: [] };

const STATUS_LABEL = { pending: 'Pending', in_transit: 'In transit', delivered: 'Delivered' };

// ---------- boot ----------
(async function init() {
  try {
    currentUser = await TBC.loadSession();
    if (!currentUser || currentUser.role !== 'admin') {
      window.location.href = '/admin-login.html';
      return;
    }
    document.getElementById('whoAmI').textContent = `Signed in as ${currentUser.username}`;
    bindNav();
    bindLogout();
    bindAddButtons();
    await loadOverview();
  } catch (err) {
    window.location.href = '/admin-login.html';
  }
})();

function bindLogout() {
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await TBC.logout();
    window.location.href = '/admin-login.html';
  });
}

function bindNav() {
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

async function switchView(view) {
  document.querySelectorAll('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('main > section').forEach(s => (s.style.display = 'none'));
  document.getElementById(`view-${view}`).style.display = 'block';

  if (view === 'overview') await loadOverview();
  if (view === 'shipments') await loadShipments();
  if (view === 'buyers') await loadSimple('buyers');
  if (view === 'sellers') await loadSimple('sellers');
  if (view === 'suppliers') await loadSimple('suppliers');
  if (view === 'interstate') await loadInterstate();
  if (view === 'clients') await loadClients();
  if (view === 'audit') await loadAudit();
}

// ---------- overview ----------
async function loadOverview() {
  const stats = await TBC.request('/admin/stats');
  const cards = [
    ['Total shipments', stats.totalShipments],
    ['In transit', stats.inTransit],
    ['Delivered', stats.delivered],
    ['Pending', stats.pending],
    ['Buyers', stats.totalBuyers],
    ['Sellers', stats.totalSellers],
    ['Suppliers', stats.totalSuppliers],
    ['Interstate records', stats.totalInterstateRecords],
    ['Client accounts', stats.totalClients]
  ];
  document.getElementById('statGrid').innerHTML = cards
    .map(([l, n]) => `<div class="stat-card"><div class="n">${n}</div><div class="l">${l}</div></div>`)
    .join('');

  const logs = (await TBC.request('/admin/audit-log')).slice(0, 8);
  document.getElementById('recentAudit').innerHTML = renderAuditRows(logs);
}

// ---------- generic reference-data (buyers/sellers/suppliers) ----------
const SIMPLE_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'country', label: 'Country' },
  { key: 'contactPerson', label: 'Contact person' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address' }
];

async function loadSimple(collection) {
  const data = await TBC.request(`/admin/${collection}`);
  cache[collection] = data;
  const el = document.getElementById(`${collection}Table`);
  if (!data.length) {
    el.innerHTML = `<div class="empty-state">No ${collection} yet. Add the first one.</div>`;
    return;
  }
  el.innerHTML = `<table>
    <thead><tr><th>Name</th><th>Country</th><th>Contact</th><th>Email</th><th>Phone</th><th></th></tr></thead>
    <tbody>
      ${data.map(r => `
        <tr>
          <td>${esc(r.name)}</td>
          <td>${esc(r.country || '—')}</td>
          <td>${esc(r.contactPerson || '—')}</td>
          <td>${esc(r.email || '—')}</td>
          <td>${esc(r.phone || '—')}</td>
          <td>
            <button class="icon-btn" onclick="editSimple('${collection}','${r.id}')">Edit</button>
            <button class="icon-btn danger" onclick="deleteSimple('${collection}','${r.id}')">Delete</button>
          </td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

function openSimpleForm(collection, record) {
  const title = record ? `Edit ${collection.slice(0, -1)}` : `New ${collection.slice(0, -1)}`;
  const fieldsHtml = SIMPLE_FIELDS.map(f => `
    <div class="field">
      <label>${f.label}${f.required ? ' *' : ''}</label>
      <input name="${f.key}" value="${esc(record?.[f.key] || '')}" ${f.required ? 'required' : ''}>
    </div>`).join('');

  openModal(title, fieldsHtml, async (formData) => {
    if (record) {
      await TBC.request(`/admin/${collection}/${record.id}`, { method: 'PUT', body: formData });
    } else {
      await TBC.request(`/admin/${collection}`, { method: 'POST', body: formData });
    }
    closeModal();
    await loadSimple(collection);
  });
}

window.editSimple = (collection, id) => {
  const record = cache[collection].find(r => r.id === id);
  openSimpleForm(collection, record);
};

window.deleteSimple = async (collection, id) => {
  if (!confirm('Delete this record? This cannot be undone.')) return;
  await TBC.request(`/admin/${collection}/${id}`, { method: 'DELETE' });
  await loadSimple(collection);
};

// ---------- shipments ----------
async function loadShipments() {
  const [shipments, buyers, sellers, suppliers] = await Promise.all([
    TBC.request('/admin/shipments'),
    TBC.request('/admin/buyers'),
    TBC.request('/admin/sellers'),
    TBC.request('/admin/suppliers')
  ]);
  cache.shipments = shipments;
  cache.buyers = buyers;
  cache.sellers = sellers;
  cache.suppliers = suppliers;

  const el = document.getElementById('shipmentsTable');
  if (!shipments.length) {
    el.innerHTML = `<div class="empty-state">No shipments yet. Add the first one.</div>`;
    return;
  }
  const nameOf = (list, id) => list.find(x => x.id === id)?.name || '—';

  el.innerHTML = `<table>
    <thead><tr>
      <th>Ref No</th><th>Client</th><th>Buyer</th><th>Seller</th><th>Route</th>
      <th>Mode</th><th>Value</th><th>Status</th><th>ETA</th><th></th>
    </tr></thead>
    <tbody>
      ${shipments.map(s => `
        <tr>
          <td class="mono">${esc(s.refNo || '—')}</td>
          <td>${esc(s.clientUsername || '—')}</td>
          <td>${esc(nameOf(buyers, s.buyerId))}</td>
          <td>${esc(nameOf(sellers, s.sellerId))}</td>
          <td>${esc(s.origin || '?')} → ${esc(s.destination || '?')}</td>
          <td>${esc(s.mode || '—')}</td>
          <td class="mono">${esc(s.currency || '')} ${esc(s.value || '')}</td>
          <td><span class="badge ${s.status || 'pending'}">${STATUS_LABEL[s.status] || s.status || 'Pending'}</span></td>
          <td class="mono">${esc(s.eta || '—')}</td>
          <td>
            <button class="icon-btn" onclick="editShipment('${s.id}')">Edit</button>
            <button class="icon-btn danger" onclick="deleteShipment('${s.id}')">Delete</button>
          </td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

function shipmentFormHtml(record) {
  const buyerOpts = cache.buyers.map(b => `<option value="${b.id}" ${record?.buyerId === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
  const sellerOpts = cache.sellers.map(b => `<option value="${b.id}" ${record?.sellerId === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
  const supplierOpts = cache.suppliers.map(b => `<option value="${b.id}" ${record?.supplierId === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
  const clientOpts = cache.clients.length
    ? cache.clients.map(c => `<option value="${c.username}" ${record?.clientUsername === c.username ? 'selected' : ''}>${esc(c.companyName)} (${esc(c.username)})</option>`).join('')
    : '';

  return `
    <div class="grid-2">
      <div class="field"><label>Reference No *</label><input name="refNo" value="${esc(record?.refNo || '')}" required></div>
      <div class="field"><label>Client account</label>
        <select name="clientUsername">
          <option value="">— none —</option>
          ${clientOpts}
        </select>
      </div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Buyer</label><select name="buyerId"><option value="">—</option>${buyerOpts}</select></div>
      <div class="field"><label>Seller</label><select name="sellerId"><option value="">—</option>${sellerOpts}</select></div>
    </div>
    <div class="field"><label>Supplier</label><select name="supplierId"><option value="">—</option>${supplierOpts}</select></div>
    <div class="grid-2">
      <div class="field"><label>Origin</label><input name="origin" value="${esc(record?.origin || '')}"></div>
      <div class="field"><label>Destination</label><input name="destination" value="${esc(record?.destination || '')}"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Mode</label>
        <select name="mode">
          ${['Sea', 'Air', 'Road', 'Rail'].map(m => `<option ${record?.mode === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Container No</label><input name="containerNo" value="${esc(record?.containerNo || '')}"></div>
    </div>
    <div class="field"><label>Goods description</label><input name="goodsDescription" value="${esc(record?.goodsDescription || '')}"></div>
    <div class="grid-2">
      <div class="field"><label>Quantity</label><input name="quantity" value="${esc(record?.quantity || '')}"></div>
      <div class="field"><label>Currency</label><input name="currency" value="${esc(record?.currency || 'USD')}"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Value</label><input name="value" value="${esc(record?.value || '')}"></div>
      <div class="field"><label>Status</label>
        <select name="status">
          ${['pending', 'in_transit', 'delivered'].map(s => `<option value="${s}" ${record?.status === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="grid-2">
      <div class="field"><label>Dispatch date</label><input type="date" name="dispatchDate" value="${esc(record?.dispatchDate || '')}"></div>
      <div class="field"><label>ETA</label><input type="date" name="eta" value="${esc(record?.eta || '')}"></div>
    </div>`;
}

async function openShipmentForm(record) {
  if (!cache.buyers.length && !cache.sellers.length) {
    await Promise.all([
      TBC.request('/admin/buyers').then(d => (cache.buyers = d)),
      TBC.request('/admin/sellers').then(d => (cache.sellers = d)),
      TBC.request('/admin/suppliers').then(d => (cache.suppliers = d))
    ]);
  }
  if (!cache.clients.length) {
    cache.clients = await TBC.request('/admin/clients');
  }
  openModal(record ? 'Edit shipment' : 'New shipment', shipmentFormHtml(record), async (formData) => {
    if (record) {
      await TBC.request(`/admin/shipments/${record.id}`, { method: 'PUT', body: formData });
    } else {
      await TBC.request('/admin/shipments', { method: 'POST', body: formData });
    }
    closeModal();
    await loadShipments();
  });
}

window.editShipment = (id) => openShipmentForm(cache.shipments.find(s => s.id === id));
window.deleteShipment = async (id) => {
  if (!confirm('Delete this shipment record?')) return;
  await TBC.request(`/admin/shipments/${id}`, { method: 'DELETE' });
  await loadShipments();
};

// ---------- interstate trade ----------
const INTERSTATE_FIELDS = [
  { key: 'refNo', label: 'Reference No', required: true },
  { key: 'stateFrom', label: 'From state' },
  { key: 'stateTo', label: 'To state' },
  { key: 'goods', label: 'Goods description' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'value', label: 'Value' },
  { key: 'transporter', label: 'Transporter' },
  { key: 'gstin', label: 'GSTIN' },
  { key: 'ewayBill', label: 'E-Way Bill No' },
  { key: 'date', label: 'Date', type: 'date' }
];

async function loadInterstate() {
  const data = await TBC.request('/admin/interstate-trade');
  cache.interstate = data;
  const el = document.getElementById('interstateTable');
  if (!data.length) {
    el.innerHTML = `<div class="empty-state">No interstate trade records yet.</div>`;
    return;
  }
  el.innerHTML = `<table>
    <thead><tr><th>Ref No</th><th>From</th><th>To</th><th>Goods</th><th>Value</th><th>E-Way Bill</th><th>Date</th><th></th></tr></thead>
    <tbody>
      ${data.map(r => `
        <tr>
          <td class="mono">${esc(r.refNo)}</td>
          <td>${esc(r.stateFrom || '—')}</td>
          <td>${esc(r.stateTo || '—')}</td>
          <td>${esc(r.goods || '—')}</td>
          <td class="mono">${esc(r.value || '—')}</td>
          <td class="mono">${esc(r.ewayBill || '—')}</td>
          <td class="mono">${esc(r.date || '—')}</td>
          <td>
            <button class="icon-btn" onclick="editInterstate('${r.id}')">Edit</button>
            <button class="icon-btn danger" onclick="deleteInterstate('${r.id}')">Delete</button>
          </td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

function openInterstateForm(record) {
  const fieldsHtml = INTERSTATE_FIELDS.map(f => `
    <div class="field">
      <label>${f.label}${f.required ? ' *' : ''}</label>
      <input type="${f.type || 'text'}" name="${f.key}" value="${esc(record?.[f.key] || '')}" ${f.required ? 'required' : ''}>
    </div>`).join('');

  openModal(record ? 'Edit interstate record' : 'New interstate trade record', fieldsHtml, async (formData) => {
    if (record) {
      await TBC.request(`/admin/interstate-trade/${record.id}`, { method: 'PUT', body: formData });
    } else {
      await TBC.request('/admin/interstate-trade', { method: 'POST', body: formData });
    }
    closeModal();
    await loadInterstate();
  });
}

window.editInterstate = (id) => openInterstateForm(cache.interstate.find(r => r.id === id));
window.deleteInterstate = async (id) => {
  if (!confirm('Delete this interstate trade record?')) return;
  await TBC.request(`/admin/interstate-trade/${id}`, { method: 'DELETE' });
  await loadInterstate();
};

// ---------- client accounts ----------
async function loadClients() {
  const data = await TBC.request('/admin/clients');
  cache.clients = data;
  const el = document.getElementById('clientsTable');
  if (!data.length) {
    el.innerHTML = `<div class="empty-state">No client accounts yet. Create the first one.</div>`;
    return;
  }
  el.innerHTML = `<table>
    <thead><tr><th>Company</th><th>User ID</th><th>Email</th><th>Status</th><th></th></tr></thead>
    <tbody>
      ${data.map(c => `
        <tr>
          <td>${esc(c.companyName)}</td>
          <td class="mono">${esc(c.username)}</td>
          <td>${esc(c.email || '—')}</td>
          <td><span class="badge ${c.active ? 'success' : 'fail'}">${c.active ? 'Active' : 'Disabled'}</span></td>
          <td><button class="icon-btn" onclick="toggleClient('${c.id}', ${!c.active})">${c.active ? 'Disable' : 'Enable'}</button></td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

function openClientForm() {
  const fieldsHtml = `
    <div class="field"><label>Company name *</label><input name="companyName" required></div>
    <div class="field"><label>User ID *</label><input name="username" required></div>
    <div class="field"><label>Password *</label><input name="password" type="text" required></div>
    <div class="field"><label>Email</label><input name="email" type="email"></div>`;

  openModal('New client account', fieldsHtml, async (formData) => {
    await TBC.request('/admin/clients', { method: 'POST', body: formData });
    closeModal();
    await loadClients();
  });
}

window.toggleClient = async (id, active) => {
  await TBC.request(`/admin/clients/${id}/active`, { method: 'PUT', body: { active } });
  await loadClients();
};

// ---------- audit log ----------
function renderAuditRows(logs) {
  if (!logs.length) return `<div class="empty-state">No activity yet.</div>`;
  return `<table>
    <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>IP</th><th>Result</th></tr></thead>
    <tbody>
      ${logs.map(l => `
        <tr>
          <td class="mono">${esc(new Date(l.timestamp).toLocaleString())}</td>
          <td>${esc(l.username)}</td>
          <td>${esc(l.role)}</td>
          <td>${esc(l.action)}</td>
          <td class="mono">${esc(l.ip || '—')}</td>
          <td><span class="badge ${l.success ? 'success' : 'fail'}">${l.success ? 'Success' : 'Failed'}</span></td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

async function loadAudit() {
  const logs = await TBC.request('/admin/audit-log');
  document.getElementById('auditTable').innerHTML = renderAuditRows(logs);
}

// ---------- add buttons ----------
function bindAddButtons() {
  document.getElementById('addShipmentBtn').addEventListener('click', () => openShipmentForm(null));
  document.getElementById('addBuyerBtn').addEventListener('click', () => openSimpleForm('buyers', null));
  document.getElementById('addSellerBtn').addEventListener('click', () => openSimpleForm('sellers', null));
  document.getElementById('addSupplierBtn').addEventListener('click', () => openSimpleForm('suppliers', null));
  document.getElementById('addInterstateBtn').addEventListener('click', () => openInterstateForm(null));
  document.getElementById('addClientBtn').addEventListener('click', () => openClientForm());
}

// ---------- modal helpers ----------
function openModal(title, fieldsHtml, onSubmit) {
  const overlay = document.getElementById('modalOverlay');
  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <h2>${esc(title)}</h2>
    <form id="modalForm">
      ${fieldsHtml}
      <p class="form-msg error" id="modalMsg"></p>
      <div style="display:flex; gap:10px; margin-top:6px;">
        <button type="button" class="btn btn-secondary" id="modalCancel">Cancel</button>
        <button type="submit" class="btn">Save</button>
      </div>
    </form>`;
  overlay.classList.add('open');

  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    try {
      await onSubmit(data);
    } catch (err) {
      document.getElementById('modalMsg').textContent = err.message;
    }
  });
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') closeModal();
});

// ---------- utils ----------
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
