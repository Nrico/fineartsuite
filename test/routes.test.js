process.env.USE_DEMO_AUTH = 'false';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const querystring = require('node:querystring');
const app = require('../server');
const { db } = require('../models/db');

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
    db.get('SELECT 1 FROM galleries WHERE slug = ?', ['demo-gallery'], () => res());
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
    if (csrfToken) headers['CSRF-Token'] = csrfToken;
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
  assert.match(body, /FineArt Gallery Platform/);
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
    artist_id: 'artist1',
    title: 'NewArt',
    medium: 'Oil',
    dimensions: '1x1',
    price: '$1',
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
    price: '$2',
    imageUrl: 'http://example.com/2'
  }, cookie, token);
  res = await httpGet(`http://localhost:${port}/demo-gallery/artworks/${id}`);
  assert.match(res.body, /UpdatedArt/);

  await httpRequest('DELETE', `http://localhost:${port}/dashboard/artworks/${id}`, null, cookie, token);
  res = await httpGet(`http://localhost:${port}/demo-gallery/artworks/${id}`);
  assert.strictEqual(res.statusCode, 404);
});

// Additional tests for auth-required routes and upload functionality
const fs = require('node:fs');
const path = require('node:path');

function httpPostMultipart(url, fields, filePath, cookies = '', csrfToken = '') {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16);
    const parsed = new URL(url);
    let payloadParts = [];
    for (const [name, value] of Object.entries(fields)) {
      payloadParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    }
    const fileData = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    payloadParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`));
    payloadParts.push(fileData);
    payloadParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const payload = Buffer.concat(payloadParts);

    const headers = {
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'Content-Length': payload.length,
      'Cookie': cookies
    };
    if (csrfToken) headers['CSRF-Token'] = csrfToken;
    const options = {
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      headers
    };
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
test.before(() => {
  fs.rmSync(uploadsDir, { recursive: true, force: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
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

  res = await httpPostForm(`http://localhost:${port}/dashboard/artworks`, { id: 'x', artist_id: 'artist1', title: 't', medium: 'm', dimensions: 'd', price: 'p', imageUrl: 'i', _csrf: token }, cookie);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
  res = await httpRequest('PUT', `http://localhost:${port}/dashboard/artworks/x`, { title: 't' }, cookie, token);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
  res = await httpRequest('DELETE', `http://localhost:${port}/dashboard/artworks/x`, null, cookie, token);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
});

test('upload post requires login', async () => {
  const port = server.address().port;
  const temp = path.join(__dirname, 'temp.jpg');
  fs.writeFileSync(temp, 'data');
  const page = await httpGet(`http://localhost:${port}/login`);
  const token = extractCsrfToken(page.body);
  const cookie = page.headers['set-cookie'][0].split(';')[0];
  const res = await httpPostMultipart(`http://localhost:${port}/dashboard/upload`, {
    title: 't', medium: 'm', dimensions: 'd', price: '1', status: 'available', _csrf: token
  }, temp, cookie, token);
  fs.unlinkSync(temp);
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
  fs.writeFileSync(temp, 'image');
  const page = await httpGet(`http://localhost:${port}/dashboard/upload`, cookie);
  const token = extractCsrfToken(page.body);
  const uploadRes = await httpPostMultipart(`http://localhost:${port}/dashboard/upload`, {
    title: 't', medium: 'm', dimensions: 'd', price: '1', status: 'available', _csrf: token
  }, temp, cookie, token);
  fs.unlinkSync(temp);
  assert.strictEqual(uploadRes.statusCode, 302);
  assert.strictEqual(uploadRes.headers.location, '/dashboard/upload?success=1');
  const files = fs.readdirSync(uploadsDir);
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
  fs.unlinkSync(path.join(uploadsDir, standard));
});
