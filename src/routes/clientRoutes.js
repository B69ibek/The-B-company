const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireRole('client'));

// A client only ever sees shipments tied to their own username — enforced
// server-side so no request from the client portal can read another
// company's data.
router.get('/shipments', (req, res) => {
  const mine = db
    .readAll('shipments')
    .filter(s => s.clientUsername === req.session.user.username);
  res.json(mine);
});

router.get('/profile', (req, res) => {
  const user = db.findOne('users', u => u.id === req.session.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const { passwordHash, ...safe } = user;
  res.json(safe);
});

module.exports = router;
