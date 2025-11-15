// Encryption utilities for RememberMe
// Handles all cryptographic operations for data at rest

class EncryptionUtils {
  constructor() {
    this.algorithm = {
      name: 'AES-GCM',
      length: 256
    };
    this.keyDerivationAlgorithm = {
      name: 'PBKDF2',
      salt: null,
      iterations: 100000,
      hash: 'SHA-256'
    };
  }

  /**
   * Generate a random salt
   * @returns {Uint8Array} - Random 16-byte salt
   */
  generateSalt() {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    return salt;
  }

  /**
   * Generate a random initialization vector
   * @returns {Uint8Array} - Random 12-byte IV
   */
  generateIV() {
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    return iv;
  }

  /**
   * Derive encryption key from passcode using PBKDF2
   * @param {string} passcode - User passcode
   * @param {Uint8Array} salt - Salt for key derivation
   * @returns {Promise<CryptoKey>} - Derived encryption key
   */
  async deriveKeyFromPasscode(passcode, salt) {
    const encoder = new TextEncoder();
    const passcodeBuffer = encoder.encode(passcode);

    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      passcodeBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      this.algorithm,
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data
   * @param {string} data - Plaintext data to encrypt
   * @param {CryptoKey} key - Encryption key
   * @param {Uint8Array} iv - Initialization vector
   * @returns {Promise<ArrayBuffer>} - Encrypted data
   */
  async encrypt(data, key, iv) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: this.algorithm.name,
        iv: iv
      },
      key,
      dataBuffer
    );

    return encrypted;
  }

  /**
   * Decrypt data
   * @param {ArrayBuffer} encryptedData - Encrypted data
   * @param {CryptoKey} key - Encryption key
   * @param {Uint8Array} iv - Initialization vector
   * @returns {Promise<string>} - Decrypted plaintext
   */
  async decrypt(encryptedData, key, iv) {
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: this.algorithm.name,
        iv: iv
      },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Encrypt object data (JSON)
   * @param {Object} data - Object to encrypt
   * @param {string} passcode - User passcode
   * @returns {Promise<Object>} - Encrypted data with metadata
   */
  async encryptObject(data, passcode) {
    const salt = this.generateSalt();
    const iv = this.generateIV();
    const key = await this.deriveKeyFromPasscode(passcode, salt);

    const dataString = JSON.stringify(data);
    const encrypted = await this.encrypt(dataString, key, iv);

    return {
      encrypted: this.arrayBufferToBase64(encrypted),
      salt: this.arrayBufferToBase64(salt),
      iv: this.arrayBufferToBase64(iv),
      algorithm: this.algorithm.name,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Decrypt object data (JSON)
   * @param {Object} encryptedData - Encrypted data with metadata
   * @param {string} passcode - User passcode
   * @returns {Promise<Object>} - Decrypted object
   */
  async decryptObject(encryptedData, passcode) {
    const salt = this.base64ToArrayBuffer(encryptedData.salt);
    const iv = this.base64ToArrayBuffer(encryptedData.iv);
    const encrypted = this.base64ToArrayBuffer(encryptedData.encrypted);

    const key = await this.deriveKeyFromPasscode(passcode, salt);
    const decryptedString = await this.decrypt(encrypted, key, iv);

    return JSON.parse(decryptedString);
  }

  /**
   * Hash passcode for authentication (separate from encryption key)
   * @param {string} passcode - Passcode to hash
   * @param {Uint8Array} salt - Salt
   * @returns {Promise<string>} - Base64 encoded hash
   */
  async hashPasscode(passcode, salt) {
    const encoder = new TextEncoder();
    const passcodeBuffer = encoder.encode(passcode);

    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      passcodeBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const hashBuffer = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256 // 256 bits
    );

    return this.arrayBufferToBase64(hashBuffer);
  }

  /**
   * Verify passcode against stored hash
   * @param {string} passcode - Passcode to verify
   * @param {string} storedHash - Stored hash
   * @param {string} storedSalt - Stored salt (base64)
   * @returns {Promise<boolean>} - Whether passcode matches
   */
  async verifyPasscode(passcode, storedHash, storedSalt) {
    const salt = this.base64ToArrayBuffer(storedSalt);
    const hash = await this.hashPasscode(passcode, salt);
    return hash === storedHash;
  }

  /**
   * Generate secure random ID
   * @param {number} length - Length of ID
   * @returns {string} - Random ID
   */
  generateId(length = 16) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Convert ArrayBuffer to Base64
   * @param {ArrayBuffer} buffer
   * @returns {string} - Base64 encoded string
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 to ArrayBuffer
   * @param {string} base64 - Base64 encoded string
   * @returns {ArrayBuffer}
   */
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Generate key pair for sharing (optional advanced feature)
   * @returns {Promise<CryptoKeyPair>}
   */
  async generateKeyPair() {
    return await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['encrypt', 'decrypt']
    );
  }
}

// Export singleton instance
window.encryption = new EncryptionUtils();
