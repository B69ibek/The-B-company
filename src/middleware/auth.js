function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not signed in' });
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Not signed in' });
    }
    if (req.session.user.role !== role) {
      return res.status(403).json({ error: 'You do not have access to this resource' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
