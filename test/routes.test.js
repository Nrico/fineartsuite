process.env.USE_DEMO_AUTH = 'false';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
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
