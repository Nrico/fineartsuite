const express = require('express');
const path = require('path');

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();

// view engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// routes
app.use('/', publicRoutes);
app.use('/admin', adminRoutes);

// start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
