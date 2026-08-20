require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');

const db = require('./src/db');
const {
  applyHelmet,
  apiLimiter,
  issueCsrfToken,
  verifyCsrfToken,
  sanitizeBody
} = require('./src/security');
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const clientRoutes = require('./src/routes/clientRoutes');

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes('change-this')) {
  console.error(
    '\n[FATAL] SESSION_SECRET is not set (or still has its placeholder value) in .env.\n' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n'
  );
  process.exit(1);
}

db.ensureDataDir();

const app = express();
app.set('trust proxy', 1);

applyHelmet(app);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use(
  session({
    name: 'tbc.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 1000 * 60 * 60 * 4 // 4 hours
    }
  })
);

app.use('/api', apiLimiter, sanitizeBody);

// Auth routes (login must be reachable without a CSRF token yet)
app.use('/api/auth', authRoutes);

// Everything past this point requires a valid CSRF token on mutating requests
app.use('/api', issueCsrfToken, verifyCsrfToken);
app.use('/api/admin', adminRoutes);
app.use('/api/client', clientRoutes);

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`The B Company platform running at http://localhost:${PORT}`);
});
