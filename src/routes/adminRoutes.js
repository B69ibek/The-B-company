const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireRole('admin'));

// ---- generic CRUD factory for the simple reference-data collections ----
function crud(collection) {
  const r = express.Router();

  r.get('/', (req, res) => {
    res.json(db.readAll(collection));
  });

  r.post('/', (req, res) => {
    const record = { id: uuid(), createdAt: new Date().toISOString(), ...req.body };
    db.insert(collection, record);
    res.status(201).json(record);
  });

  r.put('/:id', (req, res) => {
    const updated = db.update(collection, req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString()
    });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  });

  r.delete('/:id', (req, res) => {
    const ok = db.remove(collection, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  });

  return r;
}

router.use('/buyers', crud('buyers'));
router.use('/sellers', crud('sellers'));
router.use('/suppliers', crud('suppliers'));
router.use('/shipments', crud('shipments'));
router.use('/interstate-trade', crud('interstateTrade'));

// ---- audit / login log (read-only) ----
router.get('/audit-log', (req, res) => {
  const logs = db.readAll('auditLog').sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  res.json(logs.slice(0, 500));
});

// ---- client account management ----
router.get('/clients', (req, res) => {
  const clients = db.readAll('users')
    .filter(u => u.role === 'client')
    .map(({ passwordHash, ...safe }) => safe);
  res.json(clients);
});

router.post('/clients', (req, res) => {
  const { username, password, companyName, email } = req.body || {};
  if (!username || !password || !companyName) {
    return res.status(400).json({ error: 'username, password and companyName are required' });
  }
  const exists = db.findOne('users', u => u.username === username);
  if (exists) return res.status(409).json({ error: 'That username is already taken' });

  const client = {
    id: uuid(),
    username,
    passwordHash: bcrypt.hashSync(password, 12),
    role: 'client',
    companyName,
    email: email || null,
    active: true,
    createdAt: new Date().toISOString()
  };
  db.insert('users', client);
  const { passwordHash, ...safe } = client;
  res.status(201).json(safe);
});

router.put('/clients/:id/active', (req, res) => {
  const { active } = req.body || {};
  const updated = db.update('users', req.params.id, { active: !!active });
  if (!updated) return res.status(404).json({ error: 'Not found' });
  const { passwordHash, ...safe } = updated;
  res.json(safe);
});

// ---- dashboard summary ----
router.get('/stats', (req, res) => {
  const shipments = db.readAll('shipments');
  res.json({
    totalShipments: shipments.length,
    inTransit: shipments.filter(s => s.status === 'in_transit').length,
    delivered: shipments.filter(s => s.status === 'delivered').length,
    pending: shipments.filter(s => s.status === 'pending').length,
    totalBuyers: db.readAll('buyers').length,
    totalSellers: db.readAll('sellers').length,
    totalSuppliers: db.readAll('suppliers').length,
    totalInterstateRecords: db.readAll('interstateTrade').length,
    totalClients: db.readAll('users').filter(u => u.role === 'client').length
  });
});

module.exports = router;
