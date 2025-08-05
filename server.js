const express = require('express');
const session = require('express-session');
let SQLiteStore;
try {
  SQLiteStore = require('connect-sqlite3')(session);
} catch (err) {
  console.warn('connect-sqlite3 not installed, falling back to default session store');
}
const bodyParser = require('body-parser');
const path = require('path');
const flash = require('./middleware/flashFallback');
require('./models/db');

function simulateAuth(req, res, next) {
  if (!req.session.user) {
    if (req.path === '/artist' || req.path.startsWith('/artist/')) {
      req.session.user = { username: 'demoArtist', role: 'artist', id: 'artist1' };
    } else if (req.path.startsWith('/gallery')) {
      req.session.user = { username: 'demoGallery', role: 'gallery' };
    } else {
      req.session.user = { username: 'demoAdmin', role: 'admin' };
    }
  }
  next();
}

// Read session secret from environment variables and require it to be set
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set to a secure value');
}

const app = express();
// Ensure secure cookies work correctly behind reverse proxies
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const sessionOptions = {
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
};
if (SQLiteStore) {
  sessionOptions.store = new SQLiteStore();
}
app.use(session(sessionOptions));

// Flash messages using connect-flash or fallback implementation
app.use(flash());
if (process.env.USE_DEMO_AUTH === 'true') {
  app.use('/dashboard', simulateAuth);
}
app.use((req, res, next) => {
  req.user = req.session.user;
  res.locals.user = req.user;
  res.locals.flash = req.flash();
  next();
});

// Database is initialized (and migrations applied) on module load

// Route modules
const authRoutes = require('./routes/auth');
const artistRoutes = require('./routes/dashboard/artist');
const adminRoutes = require('./routes/dashboard/admin');
const accountRoutes = require('./routes/account');
const publicRoutes = require('./routes/public');

// Mount routes
app.use(authRoutes);
app.use('/dashboard/artist', artistRoutes);
app.use('/dashboard', adminRoutes);
app.use('/account', accountRoutes);
app.use(publicRoutes);

// Render custom 404 page for any unmatched routes
app.use((req, res) => {
  res.status(404).render('404');
});

// Handle CSRF token errors
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.error('CSRF token mismatch', err);
    return res.status(403).render('403');
  }
  console.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).send(err.message || 'Server error');
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
