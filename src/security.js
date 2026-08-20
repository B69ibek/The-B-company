// Application-level protections. This is the realistic "firewall" a piece of
// application code can provide: it hardens the app itself against the most
// common ways data gets stolen or corrupted (brute force, header-based
// attacks, cross-site request forgery). A network firewall in front of the
// server (cloud security group, ufw, etc.) is a separate, infrastructure-
// level layer — see README.md for how to configure that once this is deployed.

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

function applyHelmet(app) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"]
        }
      },
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginEmbedderPolicy: false
    })
  );
}

// Brute-force protection on login endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' }
});

// General API abuse protection
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Slow down.' }
});

// Minimal CSRF protection (double-submit cookie pattern) for mutating requests
function issueCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function verifyCsrfToken(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) return next();
  const headerToken = req.get('X-CSRF-Token');
  if (!headerToken || headerToken !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }
  next();
}

// Strips anything that looks like a script/HTML tag from string inputs to
// reduce stored-XSS / injection risk before data is written to disk.
function sanitizeValue(value) {
  if (typeof value === 'string') {
    return value.replace(/<[^>]*>?/gm, '').trim();
  }
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeValue(v);
    return out;
  }
  return value;
}

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  next();
}

module.exports = {
  applyHelmet,
  loginLimiter,
  apiLimiter,
  issueCsrfToken,
  verifyCsrfToken,
  sanitizeBody
};
