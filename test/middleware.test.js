const test = require('node:test');
const assert = require('node:assert');
const { authorize } = require('../middleware/auth');

test('authorize redirects when user missing', () => {
  const req = {};
  const res = { redirected: false, url: '', redirect(url) { this.redirected = true; this.url = url; }, status() { return this; }, render() {} };
  let nextCalled = false;
  authorize()(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.redirected, true);
  assert.strictEqual(res.url, '/login');
  assert.strictEqual(nextCalled, false);
});

test('authorize forbids disallowed role', () => {
  const req = { user: { role: 'artist' } };
  const res = { statusCode: 200, view: '', status(code) { this.statusCode = code; return this; }, render(v) { this.view = v; } };
  let nextCalled = false;
  authorize('admin')(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.view, '403');
  assert.strictEqual(nextCalled, false);
});

test('authorize allows permitted role', () => {
  const req = { user: { role: 'admin' } };
  let nextCalled = false;
  authorize('admin')(req, {}, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
});
