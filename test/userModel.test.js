process.env.DB_FILE = ':memory:';
const test = require('node:test');
const assert = require('node:assert');
const { createUser, findUserByUsername } = require('../models/userModel');
const { db } = require('../models/db');

test('createUser stores hashed password and retrievable user', async () => {
  const id = await createUser('Test User', 'testuser', 'secret', 'artist', 'taos');
  assert.ok(id);
  const user = await findUserByUsername('testuser');
  assert.strictEqual(user.username, 'testuser');
  assert.notStrictEqual(user.password, 'secret');
});

test('findUserByUsername returns undefined for missing user', async () => {
  const user = await findUserByUsername('missing');
  assert.strictEqual(user, undefined);
});

test.after(async () => {
  await new Promise(resolve => db.close(resolve));
});
