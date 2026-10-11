import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmountToPaise, paiseToRupees } from './amount.js';

test('converts rupees to exact paise without floating-point arithmetic', () => {
  assert.equal(parseAmountToPaise('123.45'), 12345);
  assert.equal(parseAmountToPaise('500'), 50000);
  assert.equal(paiseToRupees(12345), 123.45);
});

test('rejects invalid or unsafe monetary values', () => {
  for (const value of ['0', '-1', '1.234', '1e3', '90071992547409.92', '']) {
    assert.throws(() => parseAmountToPaise(value), { message: /Amount/ });
  }
});