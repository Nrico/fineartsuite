module.exports = function flashFallback() {
  let connectFlash;
  try {
    connectFlash = require('connect-flash');
  } catch (err) {
    connectFlash = null;
  }

  if (connectFlash) {
    return connectFlash();
  }

  return (req, res, next) => {
    if (!req.session) throw new Error('flash requires sessions');
    const flash = req.session.flash || {};

    req.flash = function (type, msg) {
      if (type && msg) {
        flash[type] = flash[type] || [];
        flash[type].push(msg);
        req.session.flash = flash;
        return flash[type];
      }

      if (type) {
        const msgs = flash[type] || [];
        delete flash[type];
        req.session.flash = flash;
        return msgs;
      }

      req.session.flash = {};
      return flash;
    };

    next();
  };
};
