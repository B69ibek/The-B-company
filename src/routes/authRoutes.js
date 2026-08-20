const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { loginLimiter, issueCsrfToken } = require('../security');

const router = express.Router();

function logAttempt({ username, role, action, ip, success }) {
  db.insert('auditLog', {
    id: uuid(),
    timestamp: new Date().toISOString(),
    username: username || 'unknown',
    role: role || 'unknown',
    action,
    ip,
    success
  });
}

function login(expectedRole) {
  return (req, res) => {
    const { username, password } = req.body || {};
    const ip = req.ip;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.findOne('users', u => u.username === username && u.role === expectedRole);

    if (!user || !user.active) {
      logAttempt({ username, role: expectedRole, action: 'login', ip, success: false });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = bcrypt.compareSync(password, user.passwordHash);
    if (!ok) {
      logAttempt({ username, role: expectedRole, action: 'login', ip, success: false });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.regenerate(err => {
      if (err) return res.status(500).json({ error: 'Could not start session' });
      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        companyName: user.companyName || null
      };
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      logAttempt({ username, role: expectedRole, action: 'login', ip, success: true });
      res.json({
        user: req.session.user,
        csrfToken: req.session.csrfToken
      });
    });
  };
}

router.post('/admin/login', loginLimiter, login('admin'));
router.post('/client/login', loginLimiter, login('client'));

router.get('/session', issueCsrfToken, (req, res) => {
  res.json({
    user: req.session.user || null,
    csrfToken: res.locals.csrfToken
  });
});

router.post('/logout', (req, res) => {
  const user = req.session.user;
  req.session.destroy(() => {
    if (user) {
      logAttempt({ username: user.username, role: user.role, action: 'logout', ip: req.ip, success: true });
    }
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

module.exports = router;
