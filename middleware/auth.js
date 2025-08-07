function authorize(...roles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.redirect('/login');
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).render('403');
    }
    next();
  };
}

module.exports = { authorize };
