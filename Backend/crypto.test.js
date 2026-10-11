import test from 'node:test';
import assert from 'node:assert/strict';
import { createServerKeyPair, decryptInstruction, encryptInstruction, hashCiphertext } from './crypto.js';

const keys = createServerKeyPair();

test('hybrid encryption round-trips a payment instruction', () => {
  const instruction = {
    senderVpa: 'alice@demo',
    receiverVpa: 'bob@demo',
    amountPaise: 12345,
    pinHash: 'digest',
    nonce: 'nonce-1',
    signedAt: Date.now()
  };
  const ciphertext = encryptInstruction(instruction, keys.publicKey);

  assert.deepEqual(decryptInstruction(ciphertext, keys.privateKey), instruction);
  assert.equal(hashCiphertext(ciphertext).length, 64);
});

test('hybrid encryption rejects a modified ciphertext', () => {
  const ciphertext = encryptInstruction({ amountPaise: 50000 }, keys.publicKey);
  const bytes = Buffer.from(ciphertext, 'base64');
  bytes[bytes.length - 1] ^= 1;

  assert.throws(() => decryptInstruction(bytes.toString('base64'), keys.privateKey));
});