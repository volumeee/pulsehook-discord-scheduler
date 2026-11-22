import test from 'node:test';
import assert from 'node:assert/strict';
import { pastedOtpDigits, updateOtpDigits } from './otpDigits';

test('OTP autofill keeps earlier digits and truncates past the sixth input', () => {
  const digits = ['1', '2', '', '', '', ''];
  assert.deepEqual(updateOtpDigits(digits, 2, '3a45678'), ['1', '2', '3', '4', '5', '6']);
  assert.deepEqual(digits, ['1', '2', '', '', '', '']);
  assert.deepEqual(updateOtpDigits(digits, 1, 'x'), ['1', '', '', '', '', '']);
});

test('pasted OTP is normalized into six positions', () => {
  assert.deepEqual(pastedOtpDigits('12-34 56 7'), ['1', '2', '3', '4', '5', '6']);
  assert.deepEqual(pastedOtpDigits('1a2'), ['1', '2', '', '', '', '']);
});
