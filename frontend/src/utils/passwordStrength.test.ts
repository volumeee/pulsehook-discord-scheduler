import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePasswordStrength, isValidEmail, isValidUsername } from './passwordStrength';

test('evaluatePasswordStrength scores empty, weak, strong, and very strong passwords', () => {
  const empty = evaluatePasswordStrength('');
  assert.equal(empty.score, 0);
  assert.equal(empty.isValid, false);

  const weak = evaluatePasswordStrength('abcdefg');
  assert.equal(weak.score, 1);
  assert.equal(weak.isValid, false);

  const strong = evaluatePasswordStrength('PulseHook9');
  assert.equal(strong.score, 3);
  assert.equal(strong.label, 'Strong');
  assert.equal(strong.isValid, true);

  const veryStrong = evaluatePasswordStrength('PulseHook!2026');
  assert.equal(veryStrong.score, 4);
  assert.equal(veryStrong.label, 'Very strong');
  assert.equal(veryStrong.isValid, true);
});

test('isValidUsername and isValidEmail enforce expected rules', () => {
  assert.equal(isValidUsername('bagus_dev'), true);
  assert.equal(isValidUsername('ab'), false);
  assert.equal(isValidUsername('_validstart'), true);
  assert.equal(isValidUsername('bad.name'), false);
  assert.equal(isValidUsername('bad-name'), false);
  assert.equal(isValidUsername('bad space'), false);
  assert.equal(isValidUsername('a'.repeat(32)), true);
  assert.equal(isValidUsername('a'.repeat(33)), false);
  assert.equal(isValidUsername('  valid_user  '), true);

  assert.equal(isValidEmail('bagus251001@gmail.com'), true);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail('user@domain'), false);
});
