process.env.USE_DEMO_AUTH = 'false';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const querystring = require('node:querystring');
const app = require('../server');
const { db } = require('../models/db');
const { createUser } = require('../models/userModel');
const { createArtist } = require('../models/artistModel');
const bcrypt = require('../utils/bcrypt');

function extractCsrfToken(html) {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  if (match) return match[1];
  const meta = html.match(/<meta name="csrf-token" content="([^"]+)"/);
  return meta ? meta[1] : null;
}

let server;

// Start server before tests
test.before(async () => {
  server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  // Wait for the demo data to be seeded
  await new Promise(res => {
    const check = () => {
      db.get('SELECT 1 FROM galleries WHERE slug = ?', ['demo-gallery'], (err, row) => {
        if (row) return res();
        setTimeout(check, 50);
      });
    };
    check();
  });
});

// Close server after tests
test.after(async () => {
  await new Promise(resolve => server.close(resolve));
});

function httpRequest(method, url, data = null, cookies = '', csrfToken = '') {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = data ? JSON.stringify(data) : null;
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': payload ? Buffer.byteLength(payload) : 0,
      'Cookie': cookies
    };
    if (csrfToken) headers['csrf-token'] = csrfToken;
    const options = {
      method,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + (parsed.search || ''),
      headers
    };
    const req = http.request(options, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function httpGet(url, cookies = '') {
  return httpRequest('GET', url, null, cookies);
}

function httpPostForm(url, data, cookies = '') {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify(data);
    const parsed = new URL(url);
    const options = {
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': cookies
      }
    };
    const req = http.request(options, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

test('homepage responds with welcome text', async () => {
  const port = server.address().port;
  const { statusCode, body } = await httpGet(`http://localhost:${port}/`);
  assert.strictEqual(statusCode, 200);
  assert.match(body, /FineArtSuite/);
});

test('homepage lists gallery names instead of slugs', async () => {
  const port = server.address().port;
  const { body } = await httpGet(`http://localhost:${port}/`);
  assert.ok(body.includes('>Demo Gallery</a>'));
  assert.doesNotMatch(body, />demo-gallery<\/a>/);
});

test('gallery page responds with gallery name', async () => {
  const port = server.address().port;
  const { statusCode, body } = await httpGet(`http://localhost:${port}/demo-gallery`);
  assert.strictEqual(statusCode, 200);
  assert.match(body, /Demo Gallery/);
});

test('gallery page lists multiple artists', async () => {
  const port = server.address().port;
  const { statusCode, body } = await httpGet(`http://localhost:${port}/demo-gallery`);
  assert.strictEqual(statusCode, 200);
  const matches = body.match(/demo-gallery\/artists\//g) || [];
  assert.ok(matches.length >= 2);
});

test('western gallery exposes contact info', async () => {
  const port = server.address().port;
  const { statusCode, body } = await httpGet(`http://localhost:${port}/western-gallery`);
  assert.strictEqual(statusCode, 200);
  assert.match(body, /Western Gallery/);
  assert.match(body, /hello@western\.example/);
  assert.match(body, /555-867-5309/);
});

test('dashboard redirects to login when not authenticated', async () => {
  const port = server.address().port;
  const { statusCode, headers } = await httpGet(`http://localhost:${port}/dashboard`);
  assert.strictEqual(statusCode, 302);
  assert.strictEqual(headers.location, '/login');
});

test('upload page redirects to login when not authenticated', async () => {
  const port = server.address().port;
  const { statusCode, headers } = await httpGet(`http://localhost:${port}/dashboard/upload`);
  assert.strictEqual(statusCode, 302);
  assert.strictEqual(headers.location, '/login');
});

test('login rejects requests without CSRF token', async () => {
  const port = server.address().port;
  const res = await httpPostForm(`http://localhost:${port}/login`, {
    username: 'admin',
    password: 'password'
  });
  assert.strictEqual(res.statusCode, 403);
});

test('login succeeds with correct credentials', async () => {
  const port = server.address().port;
  const page = await httpGet(`http://localhost:${port}/login`);
  const csrf = extractCsrfToken(page.body);
  const cookie = page.headers['set-cookie'][0].split(';')[0];
  const res = await httpPostForm(`http://localhost:${port}/login`, {
    username: 'admin',
    password: 'password',
    _csrf: csrf
  }, cookie);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/dashboard');
  let authCookie = cookie;
  if (res.headers['set-cookie']) {
    authCookie = res.headers['set-cookie'][0].split(';')[0];
  }
  const dash = await httpRequest('GET', `http://localhost:${port}/dashboard`, null, authCookie);
  assert.strictEqual(dash.statusCode, 200);
});

test('login fails with bad credentials', async () => {
  const port = server.address().port;
  const page = await httpGet(`http://localhost:${port}/login`);
  const csrf = extractCsrfToken(page.body);
  const cookie = page.headers['set-cookie'][0].split(';')[0];
  const res = await httpPostForm(`http://localhost:${port}/login`, {
    username: 'admin',
    password: 'wrong',
    _csrf: csrf
  }, cookie);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
});

test('logout destroys session', async () => {
  const port = server.address().port;
  const page = await httpGet(`http://localhost:${port}/login`);
  const csrf = extractCsrfToken(page.body);
  let cookie = page.headers['set-cookie'][0].split(';')[0];
  const login = await httpPostForm(`http://localhost:${port}/login`, {
    username: 'admin',
    password: 'password',
    _csrf: csrf
  }, cookie);
  if (login.headers['set-cookie']) {
    cookie = login.headers['set-cookie'][0].split(';')[0];
  }
  const out = await httpRequest('GET', `http://localhost:${port}/logout`, null, cookie);
  assert.strictEqual(out.statusCode, 302);
  assert.strictEqual(out.headers.location, '/login');
  const dash = await httpRequest('GET', `http://localhost:${port}/dashboard`, null, cookie);
  assert.strictEqual(dash.statusCode, 302);
  assert.strictEqual(dash.headers.location, '/login');
});

test('non-admin users cannot access admin routes', async () => {
  const port = server.address().port;
  const username = `artist${Date.now()}`;
  await new Promise(resolve => createUser('Artist', username, 'pass', 'artist', 'taos', () => resolve()));
  const stored = await new Promise(resolve => {
    db.get('SELECT password FROM users WHERE username=?', [username], (err, row) => resolve(row));
  });
  assert.ok(stored);
  assert.notStrictEqual(stored.password, 'pass');
  const matches = await new Promise(resolve => {
    bcrypt.compare('pass', stored.password, (err, m) => resolve(m));
  });
  assert.ok(matches);

  const loginPage = await httpGet(`http://localhost:${port}/login`);
  const loginCsrf = extractCsrfToken(loginPage.body);
  let cookie = loginPage.headers['set-cookie'][0].split(';')[0];
  const login = await httpPostForm(`http://localhost:${port}/login`, { username, password: 'pass', _csrf: loginCsrf }, cookie);
  if (login.headers['set-cookie']) {
    cookie = login.headers['set-cookie'][0].split(';')[0];
  }

  let res = await httpGet(`http://localhost:${port}/dashboard/galleries`, cookie);
  assert.strictEqual(res.statusCode, 403);
  res = await httpGet(`http://localhost:${port}/dashboard/artists`, cookie);
  assert.strictEqual(res.statusCode, 403);
  res = await httpGet(`http://localhost:${port}/dashboard/artworks`, cookie);
  assert.strictEqual(res.statusCode, 403);
});

test('admin artist routes allow CRUD after login', async () => {
  const port = server.address().port;
  const loginPage = await httpGet(`http://localhost:${port}/login`);
  const loginCsrf = extractCsrfToken(loginPage.body);
  let cookie = loginPage.headers['set-cookie'][0].split(';')[0];
  const login = await httpPostForm(`http://localhost:${port}/login`, { username: 'admin', password: 'password', _csrf: loginCsrf }, cookie);
  if (login.headers['set-cookie']) {
    cookie = login.headers['set-cookie'][0].split(';')[0];
  }

  const page = await httpGet(`http://localhost:${port}/dashboard/artists`, cookie);
  const token = extractCsrfToken(page.body);

  const id = `testartist${Date.now()}`;
  let res = await httpPostForm(`http://localhost:${port}/dashboard/artists`, { id, gallery_slug: 'demo-gallery', name: 'Tester', bio: 'Bio', _csrf: token }, cookie);
  assert.strictEqual(res.statusCode, 302);

  res = await httpGet(`http://localhost:${port}/demo-gallery/artists/${id}`);
  assert.strictEqual(res.statusCode, 200);
  assert.match(res.body, /Tester/);

  await httpRequest('PUT', `http://localhost:${port}/dashboard/artists/${id}`, { name: 'Edited', bio: 'Bio' }, cookie, token);
  res = await httpGet(`http://localhost:${port}/demo-gallery/artists/${id}`);
  assert.match(res.body, /Edited/);

  await httpRequest('DELETE', `http://localhost:${port}/dashboard/artists/${id}`, null, cookie, token);
  res = await httpGet(`http://localhost:${port}/demo-gallery/artists/${id}`);
  assert.strictEqual(res.statusCode, 404);
});

test('admin artwork routes allow CRUD after login', async () => {
  const port = server.address().port;
  const loginPage = await httpGet(`http://localhost:${port}/login`);
  const loginCsrf = extractCsrfToken(loginPage.body);
  let cookie = loginPage.headers['set-cookie'][0].split(';')[0];
  const login = await httpPostForm(`http://localhost:${port}/login`, { username: 'admin', password: 'password', _csrf: loginCsrf }, cookie);
  if (login.headers['set-cookie']) {
    cookie = login.headers['set-cookie'][0].split(';')[0];
  }

  const artPage = await httpGet(`http://localhost:${port}/dashboard/artworks`, cookie);
  const token = extractCsrfToken(artPage.body);

  const id = `testartwork${Date.now()}`;
  let res = await httpPostForm(`http://localhost:${port}/dashboard/artworks`, {
    id,
    gallery_slug: 'demo-gallery',
    artist_id: 'artist1',
    title: 'NewArt',
    medium: 'Oil',
    dimensions: '1x1',
    price: '1',
    imageUrl: 'http://example.com',
    _csrf: token
  }, cookie);
  assert.strictEqual(res.statusCode, 302);

  res = await httpGet(`http://localhost:${port}/demo-gallery/artworks/${id}`);
  assert.strictEqual(res.statusCode, 200);
  assert.match(res.body, /NewArt/);

  await httpRequest('PUT', `http://localhost:${port}/dashboard/artworks/${id}`, {
    title: 'UpdatedArt',
    medium: 'Acrylic',
    dimensions: '2x2',
    price: '2',
    imageUrl: 'http://example.com/2'
  }, cookie, token);
  res = await httpGet(`http://localhost:${port}/demo-gallery/artworks/${id}`);
  assert.match(res.body, /UpdatedArt/);

  await httpRequest('DELETE', `http://localhost:${port}/dashboard/artworks/${id}`, null, cookie, token);
  res = await httpGet(`http://localhost:${port}/demo-gallery/artworks/${id}`);
  assert.strictEqual(res.statusCode, 404);
});

// Additional tests for auth-required routes and upload functionality
const fs = require('node:fs/promises');
const path = require('node:path');

async function httpPostMultipart(url, fields, filePath, cookies = '', csrfToken = '', fileField = 'image') {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(16);
  const parsed = new URL(url);
  let payloadParts = [];
  for (const [name, value] of Object.entries(fields)) {
    payloadParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  const fileData = await fs.readFile(filePath);
  const filename = path.basename(filePath);
  payloadParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`));
  payloadParts.push(fileData);
  payloadParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  const payload = Buffer.concat(payloadParts);

  const headers = {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': payload.length,
    'Cookie': cookies
  };
  if (csrfToken) headers['csrf-token'] = csrfToken;
  const options = {
    method: 'POST',
    hostname: parsed.hostname,
    port: parsed.port,
    path: parsed.pathname,
    headers
  };
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');

// Clean uploads directory before tests
test.before(async () => {
  await fs.rm(uploadsDir, { recursive: true, force: true });
  await fs.mkdir(uploadsDir, { recursive: true });
});

test('artist and artwork routes require login', async () => {
  const port = server.address().port;
  const page = await httpGet(`http://localhost:${port}/login`);
  const token = extractCsrfToken(page.body);
  const cookie = page.headers['set-cookie'][0].split(';')[0];
  let res = await httpPostForm(`http://localhost:${port}/dashboard/artists`, { id: 'x', gallery_slug: 'demo-gallery', name: 'n', bio: 'b', _csrf: token }, cookie);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
  res = await httpRequest('PUT', `http://localhost:${port}/dashboard/artists/x`, { name: 'n', bio: 'b' }, cookie, token);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
  res = await httpRequest('DELETE', `http://localhost:${port}/dashboard/artists/x`, null, cookie, token);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');

  res = await httpPostForm(`http://localhost:${port}/dashboard/artworks`, { id: 'x', gallery_slug: 'demo-gallery', artist_id: 'artist1', title: 't', medium: 'm', dimensions: 'd', price: 'p', imageUrl: 'i', _csrf: token }, cookie);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
  res = await httpRequest('PUT', `http://localhost:${port}/dashboard/artworks/x`, { title: 't' }, cookie, token);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
  res = await httpRequest('DELETE', `http://localhost:${port}/dashboard/artworks/x`, null, cookie, token);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
});

test('artist artwork submission rejects invalid CSRF token', async () => {
  const port = server.address().port;
  const username = `artist${Date.now()}`;
  const userId = await new Promise(resolve => createUser('Artist', username, 'pass', 'artist', 'taos', (err, id) => resolve(id)));
  await new Promise(resolve => createArtist(userId, 'Artist', 'demo-gallery', () => resolve()));
  const loginPage = await httpGet(`http://localhost:${port}/login`);
  const loginCsrf = extractCsrfToken(loginPage.body);
  let cookie = loginPage.headers['set-cookie'][0].split(';')[0];
  const loginRes = await httpPostForm(`http://localhost:${port}/login`, { username, password: 'pass', _csrf: loginCsrf }, cookie);
  if (loginRes.headers['set-cookie']) {
    cookie = loginRes.headers['set-cookie'][0].split(';')[0];
  }
  const temp = path.join(__dirname, 'art.jpg');
  await fs.writeFile(temp, 'img');
  const res = await httpPostMultipart(`http://localhost:${port}/dashboard/artist/artworks`, {
    title: 'NoCSRF',
    medium: 'm',
    dimensions: 'd'
  }, temp, cookie, '', 'imageFile');
  await fs.unlink(temp);
  assert.strictEqual(res.statusCode, 403);
  assert.match(res.body, /Access Forbidden/);
});

test('artist cannot access admin dashboard', async () => {
  const port = server.address().port;
  const username = `artist${Date.now()}x`;
  const userId = await new Promise(resolve => createUser('Artist2', username, 'pass', 'artist', 'taos', (err, id) => resolve(id)));
  await new Promise(resolve => createArtist(userId, 'Artist2', 'demo-gallery', () => resolve()));
  const loginPage = await httpGet(`http://localhost:${port}/login`);
  const loginCsrf = extractCsrfToken(loginPage.body);
  let cookie = loginPage.headers['set-cookie'][0].split(';')[0];
  const loginRes = await httpPostForm(`http://localhost:${port}/login`, { username, password: 'pass', _csrf: loginCsrf }, cookie);
  if (loginRes.headers['set-cookie']) {
    cookie = loginRes.headers['set-cookie'][0].split(';')[0];
  }
  const res = await httpGet(`http://localhost:${port}/dashboard`, cookie);
  assert.strictEqual(res.statusCode, 403);
  assert.match(res.body, /Access Forbidden/);
});

test('artist artwork submission succeeds with valid CSRF token', async () => {
  const port = server.address().port;
  const username = `artist${Date.now()}`;
  const userId = await new Promise(resolve => createUser('Artist', username, 'pass', 'artist', 'taos', (err, id) => resolve(id)));
  await new Promise(resolve => createArtist(userId, 'Artist', 'demo-gallery', () => resolve()));
  const loginPage = await httpGet(`http://localhost:${port}/login`);
  const loginCsrf = extractCsrfToken(loginPage.body);
  let cookie = loginPage.headers['set-cookie'][0].split(';')[0];
  const loginRes = await httpPostForm(`http://localhost:${port}/login`, { username, password: 'pass', _csrf: loginCsrf }, cookie);
  if (loginRes.headers['set-cookie']) {
    cookie = loginRes.headers['set-cookie'][0].split(';')[0];
  }
  const dash = await httpGet(`http://localhost:${port}/dashboard/artist`, cookie);
  const token = extractCsrfToken(dash.body);
  const temp = path.join(__dirname, 'artvalid.jpg');
  await fs.writeFile(temp, 'img');
  const res = await httpPostMultipart(`http://localhost:${port}/dashboard/artist/artworks`, {
    title: 'GoodCSRF',
    medium: 'm',
    dimensions: 'd',
    _csrf: token
  }, temp, cookie, token, 'imageFile');
  await fs.unlink(temp);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/dashboard/artist');
  const row = await new Promise(resolve => {
    db.get('SELECT id, imageFull, imageStandard, imageThumb FROM artworks WHERE title=?', ['GoodCSRF'], (err, r) => resolve(r));
  });
  assert.ok(row);
  await new Promise(resolve => db.run('DELETE FROM artworks WHERE id=?', [row.id], resolve));
  await Promise.all(['imageFull','imageStandard','imageThumb'].map(async k => {
    const p = path.join(__dirname, '..', 'public', row[k].replace(/^\//, ''));
    try { await fs.unlink(p); } catch {}
  }));
});

test('upload post requires login', async () => {
  const port = server.address().port;
  const temp = path.join(__dirname, 'temp.jpg');
  await fs.writeFile(temp, 'data');
  const page = await httpGet(`http://localhost:${port}/login`);
  const token = extractCsrfToken(page.body);
  const cookie = page.headers['set-cookie'][0].split(';')[0];
  const res = await httpPostMultipart(`http://localhost:${port}/dashboard/upload`, {
    gallery_slug: 'demo-gallery',
    title: 't', medium: 'm', dimensions: 'd', price: '1', status: 'available', _csrf: token
  }, temp, cookie, token);
  await fs.unlink(temp);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
});

test('authenticated upload stores file, DB entry, and is served', async () => {
  const port = server.address().port;
  const loginPage = await httpGet(`http://localhost:${port}/login`);
  const loginCsrf = extractCsrfToken(loginPage.body);
  let cookie = loginPage.headers['set-cookie'][0].split(';')[0];
  const login = await httpPostForm(`http://localhost:${port}/login`, { username: 'admin', password: 'password', _csrf: loginCsrf }, cookie);
  if (login.headers['set-cookie']) {
    cookie = login.headers['set-cookie'][0].split(';')[0];
  }
  const temp = path.join(__dirname, 'upload.jpg');
  await fs.writeFile(temp, 'image');
  const page = await httpGet(`http://localhost:${port}/dashboard/upload`, cookie);
  const token = extractCsrfToken(page.body);
  const uploadRes = await httpPostMultipart(`http://localhost:${port}/dashboard/upload`, {
    gallery_slug: 'demo-gallery',
    title: 't', medium: 'm', dimensions: 'd', price: '1', status: 'available', _csrf: token
  }, temp, cookie, token);
  await fs.unlink(temp);
  assert.strictEqual(uploadRes.statusCode, 302);
  assert.strictEqual(uploadRes.headers.location, '/dashboard/upload?success=1');
  const files = await fs.readdir(uploadsDir);
  assert.ok(files.length > 0);
  const standard = files.find(f => f.includes('_standard'));
  const row = await new Promise(resolve => {
    db.get('SELECT * FROM artworks WHERE imageStandard=?', ['/uploads/' + standard], (err, r) => resolve(r));
  });
  assert.ok(row);
  assert.strictEqual(row.title, 't');
  assert.strictEqual(row.status, 'available');
  const fileRes = await httpGet(`http://localhost:${port}/uploads/${standard}`);
  assert.strictEqual(fileRes.statusCode, 200);
  await fs.unlink(path.join(uploadsDir, standard));
});

test('uploaded gallery logo appears on gallery page', async () => {
  const port = server.address().port;
  const loginPage = await httpGet(`http://localhost:${port}/login`);
  const loginCsrf = extractCsrfToken(loginPage.body);
  let cookie = loginPage.headers['set-cookie'][0].split(';')[0];
  const login = await httpPostForm(
    `http://localhost:${port}/login`,
    { username: 'admin', password: 'password', _csrf: loginCsrf },
    cookie
  );
  if (login.headers['set-cookie']) {
    cookie = login.headers['set-cookie'][0].split(';')[0];
  }
  const page = await httpGet(`http://localhost:${port}/dashboard/galleries`, cookie);
  const token = extractCsrfToken(page.body);
  const temp = path.join(__dirname, 'logo.jpg');
  await fs.writeFile(temp, 'img');
  const res = await httpPostMultipart(
    `http://localhost:${port}/dashboard/galleries`,
    { name: 'Logo Gallery', description: 'desc', _csrf: token },
    temp,
    cookie,
    token,
    'logoFile'
  );
  await fs.unlink(temp);
  assert.strictEqual(res.statusCode, 201);
  const slug = JSON.parse(res.body).slug;
  const gpage = await httpGet(`http://localhost:${port}/${slug}`);
  assert.match(gpage.body, /<img src="\/uploads\//);
  const row = await new Promise(resolve => {
    db.get('SELECT logo_url FROM galleries WHERE slug=?', [slug], (err, r) => resolve(r));
  });
  await new Promise(resolve => db.run('DELETE FROM galleries WHERE slug=?', [slug], resolve));
  if (row && row.logo_url) {
    const base = row.logo_url.replace(/^\/uploads\//, '').replace('_standard', '');
    const ext = path.extname(row.logo_url);
    for (const size of ['_standard', '_full', '_thumb']) {
      try {
        await fs.unlink(path.join(uploadsDir, base + size + ext));
      } catch {}
    }
  }
});

test('gallery uses logo URL when no file uploaded', async () => {
  const port = server.address().port;
  const loginPage = await httpGet(`http://localhost:${port}/login`);
  const loginCsrf = extractCsrfToken(loginPage.body);
  let cookie = loginPage.headers['set-cookie'][0].split(';')[0];
  const login = await httpPostForm(
    `http://localhost:${port}/login`,
    { username: 'admin', password: 'password', _csrf: loginCsrf },
    cookie
  );
  if (login.headers['set-cookie']) {
    cookie = login.headers['set-cookie'][0].split(';')[0];
  }
  const page = await httpGet(`http://localhost:${port}/dashboard/galleries`, cookie);
  const token = extractCsrfToken(page.body);
  const res = await httpPostForm(
    `http://localhost:${port}/dashboard/galleries`,
    {
      name: 'URL Gallery',
      description: 'desc',
      logoUrl: 'http://example.com/logo.png',
      _csrf: token
    },
    cookie
  );
  assert.strictEqual(res.statusCode, 302);
  const slugRow = await new Promise(resolve => {
    db.get('SELECT slug FROM galleries WHERE name=?', ['URL Gallery'], (err, r) => resolve(r));
  });
  const gpage = await httpGet(`http://localhost:${port}/${slugRow.slug}`);
  assert.match(gpage.body, /<img src="http:\/\/example\.com\/logo.png"/);
  await new Promise(resolve => db.run('DELETE FROM galleries WHERE slug=?', [slugRow.slug], resolve));
});

test('gallery settings save contact info', async () => {
  const port = server.address().port;
  const signupPage = await httpGet(`http://localhost:${port}/signup/gallery`);
  const signupCsrf = extractCsrfToken(signupPage.body);
  let cookie = signupPage.headers['set-cookie'][0].split(';')[0];
  let res = await httpPostForm(
    `http://localhost:${port}/signup/gallery`,
    {
      display_name: 'Setting Gallery',
      username: 'setting-gallery',
      password: 'pass',
      passcode: 'taos',
      _csrf: signupCsrf
    },
    cookie
  );
  if (res.headers['set-cookie']) cookie = res.headers['set-cookie'][0].split(';')[0];
  const page = await httpGet(`http://localhost:${port}/dashboard/settings`, cookie);
  const token = extractCsrfToken(page.body);
  res = await httpPostForm(
    `http://localhost:${port}/dashboard/settings`,
    {
      name: 'Setting Gallery',
      phone: '123',
      email: 'a@b.c',
      address: '123 Street',
      description: 'd',
      owner: 'Owner',
      _csrf: token
    },
    cookie
  );
  assert.strictEqual(res.statusCode, 302);
  const row = await new Promise(resolve => {
    db.get(
      'SELECT address, gallarist_name FROM galleries WHERE slug=?',
      ['setting-gallery'],
      (err, r) => resolve(r)
    );
  });
  assert.strictEqual(row.address, '123 Street');
  assert.strictEqual(row.gallarist_name, 'Owner');
  await new Promise(resolve => db.run('DELETE FROM galleries WHERE slug=?', ['setting-gallery'], resolve));
  await new Promise(resolve => db.run('DELETE FROM users WHERE username=?', ['setting-gallery'], resolve));
});

test('demo auth grants access to dashboard routes without login', async () => {
  process.env.USE_DEMO_AUTH = 'true';
  delete require.cache[require.resolve('../server')];
  const demoApp = require('../server');
  const demoServer = await new Promise(resolve => {
    const s = demoApp.listen(0, () => resolve(s));
  });
  const port = demoServer.address().port;

  const routes = [
    '/dashboard',
    '/dashboard/galleries',
    '/dashboard/artists',
    '/dashboard/artworks',
    '/dashboard/upload',
    '/dashboard/artist'
  ];

  for (const r of routes) {
    const res = await httpGet(`http://localhost:${port}${r}`);
    assert.strictEqual(res.statusCode, 200);
  }

  await new Promise(resolve => demoServer.close(resolve));
  delete require.cache[require.resolve('../server')];
  process.env.USE_DEMO_AUTH = 'false';
});
