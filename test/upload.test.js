const test = require('node:test');
const assert = require('node:assert');
const upload = require('../middleware/upload');

test('upload middleware uses 10MB limit', () => {
  assert.strictEqual(upload.limits.fileSize, 10 * 1024 * 1024);
});

test('upload middleware filters file types', async () => {
  await new Promise(resolve => {
    upload.fileFilter({}, { mimetype: 'image/jpeg' }, err => {
      assert.ifError(err);
      resolve();
    });
  });
  await new Promise(resolve => {
    upload.fileFilter({}, { mimetype: 'text/plain' }, err => {
      assert.ok(err);
      assert.strictEqual(err.message, 'Only JPG, PNG, or HEIC images are allowed');
      resolve();
    });
  });
});
