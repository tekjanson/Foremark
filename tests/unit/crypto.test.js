// tests/unit/crypto.test.js
// Encryption & decryption verification (runs under `node --test`).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  encrypt,
  decrypt,
  isEncrypted,
  verifyPassphrase,
  ENC_PREFIX,
  bytesToB64,
  b64ToBytes,
} from '../../public/js/crypto/encryption.js';

test('base64 round-trips arbitrary bytes', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 255, 128, 64]);
  const b64 = bytesToB64(bytes);
  const back = b64ToBytes(b64);
  assert.deepEqual([...back], [...bytes]);
});

test('encrypt produces a tagged payload with 3 base64 segments', async () => {
  const payload = await encrypt('hello world', 'correct horse');
  assert.ok(payload.startsWith(ENC_PREFIX), 'has enc:v1: prefix');
  assert.ok(isEncrypted(payload));
  const parts = payload.slice(ENC_PREFIX.length).split(':');
  assert.equal(parts.length, 3, 'salt:iv:ciphertext');
  for (const p of parts) assert.ok(p.length > 0);
});

test('decrypt recovers the original plaintext', async () => {
  const secret = 'S3cr3t-Value! with ünïcode 🔐';
  const payload = await encrypt(secret, 'my-passphrase');
  const recovered = await decrypt(payload, 'my-passphrase');
  assert.equal(recovered, secret);
});

test('decrypt fails with the wrong passphrase', async () => {
  const payload = await encrypt('top secret', 'right-pass');
  await assert.rejects(() => decrypt(payload, 'wrong-pass'), /Decryption failed/);
});

test('each encryption uses a fresh random salt and IV', async () => {
  const a = await encrypt('same', 'pass');
  const b = await encrypt('same', 'pass');
  assert.notEqual(a, b, 'ciphertexts differ due to random salt/IV');
  assert.equal(await decrypt(a, 'pass'), 'same');
  assert.equal(await decrypt(b, 'pass'), 'same');
});

test('verifyPassphrase returns true/false correctly', async () => {
  const payload = await encrypt('verify-token', 'the-pass');
  assert.equal(await verifyPassphrase(payload, 'the-pass'), true);
  assert.equal(await verifyPassphrase(payload, 'nope'), false);
});

test('decrypt rejects malformed payloads', async () => {
  await assert.rejects(() => decrypt('not-encrypted', 'pass'), /not an encrypted/);
  await assert.rejects(() => decrypt(ENC_PREFIX + 'only:two', 'pass'), /Malformed/);
});

test('empty string encrypts and decrypts to empty string', async () => {
  const payload = await encrypt('', 'pass');
  assert.ok(isEncrypted(payload));
  assert.equal(await decrypt(payload, 'pass'), '');
});
