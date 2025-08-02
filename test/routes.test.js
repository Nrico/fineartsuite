process.env.USE_DEMO_AUTH = 'false';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const querystring = require('node:querystring');
const app = require('../server');

let server;

// Start server before tests
test.before(async () => {
  server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
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
