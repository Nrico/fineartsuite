const test = require('node:test');
const assert = require('node:assert');
const { requireAuth, requireRole } = require('../middleware/auth');

test('requireAuth redirects when user missing', () => {
  const req = {};
  const res = { redirected: false, url: '', redirect(url) { this.redirected = true; this.url = url; } };
  let nextCalled = false;
  requireAuth(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.redirected, true);
  assert.strictEqual(res.url, '/login');
  assert.strictEqual(nextCalled, false);
});

test('requireAuth calls next when user exists', () => {
  const req = { user: {} };
  const res = { redirect() { throw new Error('should not redirect'); } };
  let nextCalled = false;
  requireAuth(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
});

test('requireRole redirects when user missing', () => {
  const req = {};
  const res = { redirected: false, url: '', redirect(url) { this.redirected = true; this.url = url; }, status() { return this; }, render() {} };
  let nextCalled = false;
  requireRole('admin')(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.redirected, true);
  assert.strictEqual(res.url, '/login');
  assert.strictEqual(nextCalled, false);
});

test('requireRole forbids disallowed role', () => {
  const req = { user: { role: 'artist' } };
  const res = { statusCode: 200, view: '', status(code) { this.statusCode = code; return this; }, render(v) { this.view = v; } };
  let nextCalled = false;
  requireRole('admin')(req, res, () => { nextCalled = true; });
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.view, '403');
  assert.strictEqual(nextCalled, false);
});

test('requireRole allows permitted role', () => {
  const req = { user: { role: 'admin' } };
  let nextCalled = false;
  requireRole('admin')(req, {}, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
});
