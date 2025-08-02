process.env.USE_DEMO_AUTH = 'false';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const querystring = require('node:querystring');
const app = require('../server');
const { db } = require('../models/db');

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

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

function httpRequest(method, url, data = null, cookies = '') {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = data ? JSON.stringify(data) : null;
    const options = {
      method,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + (parsed.search || ''),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload ? Buffer.byteLength(payload) : 0,
        'Cookie': cookies
      }
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

test('login succeeds with correct credentials', async () => {
  const port = server.address().port;
  const res = await httpPostForm(`http://localhost:${port}/login`, {
    username: 'admin',
    password: 'password'
  });
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/dashboard');
  assert.ok(res.headers['set-cookie']);
  const cookie = res.headers['set-cookie'][0].split(';')[0];
  const dash = await httpRequest('GET', `http://localhost:${port}/dashboard`, null, cookie);
  assert.strictEqual(dash.statusCode, 200);
});

test('login fails with bad credentials', async () => {
  const port = server.address().port;
  const res = await httpPostForm(`http://localhost:${port}/login`, {
    username: 'admin',
    password: 'wrong'
  });
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
});

test('logout destroys session', async () => {
  const port = server.address().port;
  const login = await httpPostForm(`http://localhost:${port}/login`, {
    username: 'admin',
    password: 'password'
  });
  const cookie = login.headers['set-cookie'][0].split(';')[0];
  const out = await httpRequest('GET', `http://localhost:${port}/logout`, null, cookie);
  assert.strictEqual(out.statusCode, 302);
  assert.strictEqual(out.headers.location, '/login');
  const dash = await httpRequest('GET', `http://localhost:${port}/dashboard`, null, cookie);
  assert.strictEqual(dash.statusCode, 302);
  assert.strictEqual(dash.headers.location, '/login');
});

test('admin artist routes allow CRUD after login', async () => {
  const port = server.address().port;
  const login = await httpPostForm(`http://localhost:${port}/login`, { username: 'admin', password: 'password' });
  const cookie = login.headers['set-cookie'][0].split(';')[0];

  const id = `testartist${Date.now()}`;
  let res = await httpPostForm(`http://localhost:${port}/dashboard/artists`, { id, gallery_slug: 'demo-gallery', name: 'Tester', bio: 'Bio' }, cookie);
  assert.strictEqual(res.statusCode, 302);

  res = await httpGet(`http://localhost:${port}/demo-gallery/artists/${id}`);
  assert.strictEqual(res.statusCode, 200);
  assert.match(res.body, /Tester/);

  await httpRequest('PUT', `http://localhost:${port}/dashboard/artists/${id}`, { name: 'Edited', bio: 'Bio' }, cookie);
  res = await httpGet(`http://localhost:${port}/demo-gallery/artists/${id}`);
  assert.match(res.body, /Edited/);

  await httpRequest('DELETE', `http://localhost:${port}/dashboard/artists/${id}`, null, cookie);
  res = await httpGet(`http://localhost:${port}/demo-gallery/artists/${id}`);
  assert.strictEqual(res.statusCode, 404);
});

test('admin artwork routes allow CRUD after login', async () => {
  const port = server.address().port;
  const login = await httpPostForm(`http://localhost:${port}/login`, { username: 'admin', password: 'password' });
  const cookie = login.headers['set-cookie'][0].split(';')[0];

  const id = `testartwork${Date.now()}`;
  let res = await httpPostForm(`http://localhost:${port}/dashboard/artworks`, {
    id,
    artist_id: 'artist1',
    title: 'NewArt',
    medium: 'Oil',
    dimensions: '1x1',
    price: '$1',
    image: 'http://example.com'
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
    image: 'http://example.com/2'
  }, cookie);
  res = await httpGet(`http://localhost:${port}/demo-gallery/artworks/${id}`);
  assert.match(res.body, /UpdatedArt/);

  await httpRequest('DELETE', `http://localhost:${port}/dashboard/artworks/${id}`, null, cookie);
  res = await httpGet(`http://localhost:${port}/demo-gallery/artworks/${id}`);
  assert.strictEqual(res.statusCode, 404);
});

// Additional tests for auth-required routes and upload functionality
const fs = require('node:fs');
const path = require('node:path');

function httpPostMultipart(url, fields, filePath, cookies = '') {
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

    const options = {
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': payload.length,
        'Cookie': cookies
      }
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
  let res = await httpPostForm(`http://localhost:${port}/dashboard/artists`, { id: 'x', gallery_slug: 'demo-gallery', name: 'n', bio: 'b' });
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
  res = await httpRequest('PUT', `http://localhost:${port}/dashboard/artists/x`, { name: 'n', bio: 'b' });
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
  res = await httpRequest('DELETE', `http://localhost:${port}/dashboard/artists/x`);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');

  res = await httpPostForm(`http://localhost:${port}/dashboard/artworks`, { id: 'x', artist_id: 'artist1', title: 't', medium: 'm', dimensions: 'd', price: 'p', image: 'i' });
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
  res = await httpRequest('PUT', `http://localhost:${port}/dashboard/artworks/x`, { title: 't' });
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
  res = await httpRequest('DELETE', `http://localhost:${port}/dashboard/artworks/x`);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
});

test('upload post requires login', async () => {
  const port = server.address().port;
  const temp = path.join(__dirname, 'temp.jpg');
  fs.writeFileSync(temp, 'data');
  const res = await httpPostMultipart(`http://localhost:${port}/dashboard/upload`, {
    title: 't', medium: 'm', dimensions: 'd', price: '1', status: 'available'
  }, temp);
  fs.unlinkSync(temp);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.location, '/login');
});

test('authenticated upload stores file, DB entry, and is served', async () => {
  const port = server.address().port;
  const login = await httpPostForm(`http://localhost:${port}/login`, { username: 'admin', password: 'password' });
  const cookie = login.headers['set-cookie'][0].split(';')[0];
  const temp = path.join(__dirname, 'upload.jpg');
  fs.writeFileSync(temp, 'image');
  const uploadRes = await httpPostMultipart(`http://localhost:${port}/dashboard/upload`, {
    title: 't', medium: 'm', dimensions: 'd', price: '1', status: 'available'
  }, temp, cookie);
  fs.unlinkSync(temp);
  assert.strictEqual(uploadRes.statusCode, 302);
  assert.strictEqual(uploadRes.headers.location, '/dashboard/upload?success=1');
  const files = fs.readdirSync(uploadsDir);
  assert.ok(files.length > 0);
  const row = await new Promise(resolve => {
    db.get('SELECT * FROM artworks WHERE image=?', [files[0]], (err, r) => resolve(r));
  });
  assert.ok(row);
  assert.strictEqual(row.title, 't');
  assert.strictEqual(row.status, 'available');
  const fileRes = await httpGet(`http://localhost:${port}/uploads/${files[0]}`);
  assert.strictEqual(fileRes.statusCode, 200);
  fs.unlinkSync(path.join(uploadsDir, files[0]));
});
