/**
 * Client-Side Cryptography Module
 * Implements PBKDF2 key derivation & AES-256-GCM encryption/decryption
 * using the native browser Web Cryptography API (crypto.subtle).
 */

const SENTINEL_AUTH_MESSAGE = "CLIENT_SECRETS_VAULT_AUTH_VALID_V1";
const DEFAULT_PBKDF2_ITERATIONS = 600000; // OWASP recommendation for PBKDF2-HMAC-SHA256
const SALT_BYTE_LENGTH = 16; // 128-bit salt
const IV_BYTE_LENGTH = 12; // 96-bit standard AES-GCM IV

const getCrypto = () => (typeof window !== "undefined" ? window.crypto : globalThis.crypto);

/**
 * Convert ArrayBuffer or Uint8Array to Base64 string
 */
export function bufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
export function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a cryptographically random salt (16 bytes)
 */
export function generateSalt() {
  const salt = new Uint8Array(SALT_BYTE_LENGTH);
  getCrypto().getRandomValues(salt);
  return bufferToBase64(salt);
}

/**
 * Derive an AES-GCM 256-bit CryptoKey from a master password and salt using PBKDF2.
 * The derived key is marked as extractable: false so it cannot be extracted from browser memory.
 * 
 * @param {string} masterPassword 
 * @param {string} saltBase64 
 * @param {number} iterations 
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKeyFromPassword(masterPassword, saltBase64, iterations = DEFAULT_PBKDF2_ITERATIONS) {
  const crypto = getCrypto();
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterPassword),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const saltBuffer = base64ToBuffer(saltBase64);

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: iterations,
      hash: "SHA-256",
    },
    passwordKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false, // extractable: false for security
    ["encrypt", "decrypt"]
  );

  return derivedKey;
}

/**
 * Encrypt arbitrary JSON serializable data using AES-GCM with a fresh random 12-byte IV.
 * 
 * @param {any} data 
 * @param {CryptoKey} key 
 * @returns {Promise<{ ciphertext: string, iv: string }>}
 */
export async function encryptData(data, key) {
  const crypto = getCrypto();
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(JSON.stringify(data));

  // Generate unique 12-byte IV for this specific entry
  const iv = new Uint8Array(IV_BYTE_LENGTH);
  crypto.getRandomValues(iv);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    plaintextBytes
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
  };
}

/**
 * Decrypt AES-GCM ciphertext package using the provided CryptoKey.
 * 
 * @param {{ ciphertext: string, iv: string }} encryptedPackage 
 * @param {CryptoKey} key 
 * @returns {Promise<any>} Parsed JSON object
 */
export async function decryptData(encryptedPackage, key) {
  const crypto = getCrypto();
  const { ciphertext, iv } = encryptedPackage;
  if (!ciphertext || !iv) {
    throw new Error("Invalid encrypted package format");
  }

  const ciphertextBuffer = base64ToBuffer(ciphertext);
  const ivBuffer = base64ToBuffer(iv);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBuffer,
    },
    key,
    ciphertextBuffer
  );

  const decoder = new TextDecoder();
  const jsonString = decoder.decode(decryptedBuffer);
  return JSON.parse(jsonString);
}

/**
 * Create an encrypted authentication verifier token
 * Used to verify master password during unlocking without storing any hash of the password.
 * 
 * @param {CryptoKey} key 
 * @returns {Promise<{ ciphertext: string, iv: string }>}
 */
export async function createAuthVerifier(key) {
  return await encryptData({ sentinel: SENTINEL_AUTH_MESSAGE }, key);
}

/**
 * Verify whether a derived key is valid against the stored auth verifier
 * 
 * @param {{ ciphertext: string, iv: string }} authVerifier 
 * @param {CryptoKey} key 
 * @returns {Promise<boolean>}
 */
export async function verifyAuthVerifier(authVerifier, key) {
  try {
    const decrypted = await decryptData(authVerifier, key);
    return decrypted?.sentinel === SENTINEL_AUTH_MESSAGE;
  } catch {
    return false;
  }
}
