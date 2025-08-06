const test = require('node:test');
const assert = require('node:assert');
const { getStepsForRole, getNextStep, getSharedFeatures } = require('../client/userFlow');

test('gallery owner navigation order', () => {
  const steps = getStepsForRole('gallery_owner');
  assert.strictEqual(steps[0].step, 'signup');
  assert.strictEqual(getNextStep('gallery_owner', 'signup'), 'initial_setup');
  assert.strictEqual(getNextStep('gallery_owner', 'initial_setup'), 'add_artists');
});

test('artist navigation reaches end', () => {
  assert.strictEqual(getNextStep('artist', 'track_activity'), null);
});

test('shared features include messaging', () => {
  const features = getSharedFeatures();
  assert.ok(Array.isArray(features));
  assert.ok(features.includes('messaging'));
});
