// public/js/crypto/vault.js
// Master key & session passphrase management.
//
// The vault holds the passphrase in memory only for the duration of the
// session. A verification token (a known plaintext encrypted with the
// passphrase) is persisted server-side so we can validate future unlocks
// without ever storing the passphrase itself.

import { encrypt, decrypt, isEncrypted, verifyPassphrase } from './encryption.js';
import { api } from '../storage/api-client.js';

const VERIFY_PLAINTEXT = 'waymark-vault-verify-v1';

class Vault {
  constructor() {
    this._passphrase = null;
    this._verifyToken = null;
    this._listeners = new Set();
  }

  get isUnlocked() {
    return this._passphrase !== null;
  }

  get isInitialized() {
    return Boolean(this._verifyToken);
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    for (const fn of this._listeners) fn(this.isUnlocked);
  }

  /** Load persisted vault settings (verification token) from the server. */
  async load() {
    try {
      const { settings } = await api.get('/api/vault/settings');
      this._verifyToken = settings?.verifyToken || null;
    } catch {
      this._verifyToken = null;
    }
    return this.isInitialized;
  }

  /** First-time setup: establish the master passphrase. */
  async initialize(passphrase) {
    if (!passphrase || passphrase.length < 4) {
      throw new Error('Passphrase must be at least 4 characters.');
    }
    const token = await encrypt(VERIFY_PLAINTEXT, passphrase);
    await api.post('/api/vault/settings', { verifyToken: token });
    this._verifyToken = token;
    this._passphrase = passphrase;
    this._emit();
  }

  /** Unlock an already-initialized vault. */
  async unlock(passphrase) {
    if (!this.isInitialized) {
      throw new Error('Vault not initialized. Set a passphrase first.');
    }
    const ok = await verifyPassphrase(this._verifyToken, passphrase);
    if (!ok) throw new Error('Incorrect passphrase.');
    this._passphrase = passphrase;
    this._emit();
  }

  lock() {
    this._passphrase = null;
    this._emit();
  }

  /** Change the master passphrase and re-key the verification token. */
  async changePassphrase(current, next) {
    await this.unlock(current);
    if (!next || next.length < 4) {
      throw new Error('New passphrase must be at least 4 characters.');
    }
    const token = await encrypt(VERIFY_PLAINTEXT, next);
    await api.post('/api/vault/settings', { verifyToken: token });
    this._verifyToken = token;
    this._passphrase = next;
    this._emit();
  }

  _requireUnlocked() {
    if (!this.isUnlocked) {
      throw new Error('Vault is locked. Unlock it to access encrypted fields.');
    }
  }

  /** Encrypt a plaintext value using the active session passphrase. */
  async encryptValue(plaintext) {
    this._requireUnlocked();
    return encrypt(plaintext, this._passphrase);
  }

  /** Decrypt a tagged payload using the active session passphrase. */
  async decryptValue(payload) {
    this._requireUnlocked();
    if (!isEncrypted(payload)) return payload;
    return decrypt(payload, this._passphrase);
  }
}

export const vault = new Vault();
export { isEncrypted };
