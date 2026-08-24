// public/js/crypto/encryption.js
// Web Crypto API wrapper: AES-GCM-256 with PBKDF2 key derivation.
//
// Storage payload format:
//   enc:v1:<salt_b64>:<iv_b64>:<ciphertext_b64>
//
// - PBKDF2: SHA-256, 100,000 iterations, 16-byte random salt
// - AES-GCM: 256-bit key, 12-byte random IV

export const ENC_PREFIX = 'enc:v1:';
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_LENGTH = 256;

const subtle = globalThis.crypto?.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

// ── base64 helpers (work in browser and Node) ───────────────────────────

export function bytesToB64(bytes) {
  let binary = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

export function b64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── Key derivation ───────────────────────────────────────────────────────

async function importPassphrase(passphrase) {
  return subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
}

/**
 * Derive an AES-GCM CryptoKey from a passphrase and salt.
 * @param {string} passphrase
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKey(passphrase, salt) {
  const baseKey = await importPassphrase(passphrase);
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// ── Encrypt / decrypt ─────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string with a passphrase.
 * A fresh random salt + IV is generated per call.
 * @returns {Promise<string>} tagged payload string
 */
export async function encrypt(plaintext, passphrase) {
  if (plaintext == null) plaintext = '';
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(String(plaintext))
  );
  return (
    ENC_PREFIX +
    [bytesToB64(salt), bytesToB64(iv), bytesToB64(new Uint8Array(ciphertext))].join(
      ':'
    )
  );
}

/**
 * Decrypt a tagged payload string with a passphrase.
 * @returns {Promise<string>} plaintext
 * @throws if the payload is malformed or the passphrase is wrong
 */
export async function decrypt(payload, passphrase) {
  if (!isEncrypted(payload)) {
    throw new Error('Value is not an encrypted payload.');
  }
  const body = payload.slice(ENC_PREFIX.length);
  const [saltB64, ivB64, ctB64] = body.split(':');
  if (!saltB64 || !ivB64 || !ctB64) {
    throw new Error('Malformed encrypted payload.');
  }
  const salt = b64ToBytes(saltB64);
  const iv = b64ToBytes(ivB64);
  const ciphertext = b64ToBytes(ctB64);
  const key = await deriveKey(passphrase, salt);
  try {
    const plaintext = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return dec.decode(plaintext);
  } catch {
    throw new Error('Decryption failed — wrong passphrase or corrupted data.');
  }
}

/** @returns {boolean} whether a value is a tagged encrypted payload */
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

/**
 * Verify a passphrase can decrypt a known payload (used for unlock checks).
 * @returns {Promise<boolean>}
 */
export async function verifyPassphrase(payload, passphrase) {
  try {
    await decrypt(payload, passphrase);
    return true;
  } catch {
    return false;
  }
}
