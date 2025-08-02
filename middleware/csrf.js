const crypto = require('node:crypto');

function csrf() {
  return function(req, res, next) {
    if (!req.session) {
      throw new Error('CSRF protection requires session');
    }
    if (!req.session.csrfSecret) {
      req.session.csrfSecret = crypto.randomBytes(16).toString('hex');
    }
    req.csrfToken = function() {
      return crypto.createHmac('sha256', req.session.csrfSecret).update('token').digest('hex');
    };
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    const token = req.body?._csrf || req.headers['csrf-token'] || req.query._csrf;
    if (token !== req.csrfToken()) {
      const err = new Error('invalid csrf token');
      err.code = 'EBADCSRFTOKEN';
      return next(err);
    }
    next();
  };
}

module.exports = csrf;
