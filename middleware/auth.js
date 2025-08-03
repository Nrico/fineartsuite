function requireAuth(req, res, next) {
  if (!req.user) {
    return res.redirect('/login');
  }
  next();
}

function requireRole(...roles) {
  return function(req, res, next) {
    if (!req.user) {
      return res.redirect('/login');
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).send('Forbidden');
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
