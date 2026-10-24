/**
 * Pune-Flats End-to-End Encryption (E2EE) Module
 *
 * Cryptographic Specifications:
 * - Asymmetric Key Agreement: ECDH (Elliptic Curve Diffie-Hellman) over NIST Curve P-256
 * - Symmetric Authenticated Cipher: AES-256-GCM (Galois/Counter Mode) with 96-bit (12-byte) random IV
 * - Key Derivation: crypto.subtle.deriveKey(ECDH, AES-GCM 256)
 * - Verification Fingerprint: SHA-256 of public key JWK string (formatted in hex blocks)
 *
 * Zero-Knowledge Guarantee:
 * - Private keys are generated and stored exclusively in browser IndexedDB/localStorage.
 * - The backend server, database, and WebSocket relays receive ONLY base64 ciphertext and IVs.
 * - Decryption is mathematically impossible without the recipient's or sender's private key.
 */

import { registerPublicKey as apiRegisterKey, fetchRoomKeys as apiFetchRoomKeys } from './api';

const KEY_PAIR_STORAGE_PREFIX = 'puneflats_e2ee_keypair_';
const SHARED_KEY_CACHE = new Map(); // roomId -> CryptoKey

// Helper: Convert ArrayBuffer to Base64
export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper: Convert Base64 to Uint8Array
export function base64ToBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Compute SHA-256 fingerprint formatted as XX:XX:XX:XX:XX:XX:XX:XX
export async function computeFingerprint(jwk) {
  const canonical = typeof jwk === 'string' ? jwk : JSON.stringify(jwk);
  const encoder = new TextEncoder();
  const hash = await window.crypto.subtle.digest('SHA-256', encoder.encode(canonical));
  const hashArray = Array.from(new Uint8Array(hash));
  // Take first 8 bytes for concise human-verifiable Safety Number
  return hashArray
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

/**
 * Initialize or retrieve the active user's ECDH key pair.
 * Automatically publishes public key to the backend.
 */
export async function initUserKeys(userId) {
  if (!userId) return null;
  const storageKey = `${KEY_PAIR_STORAGE_PREFIX}${userId}`;

  try {
    const saved = localStorage.getItem(storageKey);
    let keyPairJwk;

    if (saved) {
      keyPairJwk = JSON.parse(saved);
    } else {
      // Generate new ECDH P-256 key pair
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        true, // extractable
        ['deriveKey', 'deriveBits']
      );

      const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
      const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

      keyPairJwk = {
        publicKey: publicKeyJwk,
        privateKey: privateKeyJwk,
      };

      localStorage.setItem(storageKey, JSON.stringify(keyPairJwk));
    }

    // Compute public fingerprint
    const fingerprint = await computeFingerprint(keyPairJwk.publicKey);
    keyPairJwk.fingerprint = fingerprint;

    // Register / update on server
    try {
      await apiRegisterKey({
        public_key: JSON.stringify(keyPairJwk.publicKey),
        algorithm: 'ECDH-P256',
        fingerprint,
      });
    } catch (err) {
      console.warn('E2EE: Failed to register public key on server:', err);
    }

    return keyPairJwk;
  } catch (err) {
    console.error('E2EE: Failed to initialize user keys:', err);
    return null;
  }
}

/**
 * Derive shared AES-GCM 256 key between local private key and peer's public key.
 */
export async function deriveSharedKey(localPrivateKeyJwk, peerPublicKeyJwk) {
  try {
    // Import local private key
    const privateKey = await window.crypto.subtle.importKey(
      'jwk',
      localPrivateKeyJwk,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      ['deriveKey']
    );

    // Import peer public key
    const parsedPeerJwk = typeof peerPublicKeyJwk === 'string' ? JSON.parse(peerPublicKeyJwk) : peerPublicKeyJwk;
    const publicKey = await window.crypto.subtle.importKey(
      'jwk',
      parsedPeerJwk,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      false,
      []
    );

    // Derive AES-GCM 256 symmetric cipher key
    const sharedKey = await window.crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: publicKey,
      },
      privateKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false, // non-extractable from memory
      ['encrypt', 'decrypt']
    );

    return sharedKey;
  } catch (err) {
    console.error('E2EE: Key derivation failed:', err);
    return null;
  }
}

/**
 * Get or establish the shared encryption key for a given room.
 */
export async function getRoomSharedKey(roomId, currentUserId) {
  if (!roomId || !currentUserId) return null;

  const cacheKey = `${roomId}_${currentUserId}`;
  if (SHARED_KEY_CACHE.has(cacheKey)) {
    return SHARED_KEY_CACHE.get(cacheKey);
  }

  // Load user local keys
  const localKeys = await initUserKeys(currentUserId);
  if (!localKeys) return null;

  // Fetch room member keys from API
  try {
    const res = await apiFetchRoomKeys(roomId);
    const members = res.data || [];

    // Find peer (the other member)
    const peer = members.find((m) => m.user_id !== currentUserId && m.public_key);
    if (!peer || !peer.public_key) {
      return null; // Peer hasn't published key yet
    }

    const sharedKey = await deriveSharedKey(localKeys.privateKey, peer.public_key);
    if (sharedKey) {
      SHARED_KEY_CACHE.set(cacheKey, {
        key: sharedKey,
        peerFingerprint: peer.fingerprint,
        peerName: peer.display_name,
        myFingerprint: localKeys.fingerprint,
      });
      return SHARED_KEY_CACHE.get(cacheKey);
    }
  } catch (err) {
    console.error('E2EE: Failed to get room shared key:', err);
  }

  return null;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Output envelope format: `e2ee:v1:{"iv":"...","ct":"...","fp":"..."}`
 */
export async function encryptMessage(plaintext, sharedKey, senderFingerprint) {
  if (!sharedKey) {
    throw new Error('Encryption key not initialized');
  }

  // Generate 96-bit (12 bytes) cryptographically secure random IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    sharedKey,
    encoded
  );

  const envelope = {
    v: 1,
    alg: 'AES-GCM-256',
    iv: bufferToBase64(iv),
    ct: bufferToBase64(ciphertextBuffer),
    fp: senderFingerprint || '',
  };

  return `e2ee:v1:${JSON.stringify(envelope)}`;
}

/**
 * Decrypt an incoming message.
 * Returns { text, isEncrypted, verified, rawCiphertext }
 */
export async function decryptMessage(content, sharedKey) {
  if (typeof content !== 'string') {
    return { text: String(content || ''), isEncrypted: false, verified: false, rawCiphertext: '' };
  }

  // Check if content is an E2EE payload
  if (!content.startsWith('e2ee:v1:')) {
    return { text: content, isEncrypted: false, verified: false, rawCiphertext: '' };
  }

  const rawJson = content.slice('e2ee:v1:'.length);
  try {
    const envelope = JSON.parse(rawJson);
    const iv = base64ToBuffer(envelope.iv);
    const ciphertext = base64ToBuffer(envelope.ct);

    if (!sharedKey) {
      return {
        text: '🔒 [Encrypted Message — Key Not Ready]',
        isEncrypted: true,
        verified: false,
        rawCiphertext: content,
      };
    }

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      sharedKey,
      ciphertext
    );

    const decoded = new TextDecoder().decode(decryptedBuffer);
    return {
      text: decoded,
      isEncrypted: true,
      verified: true,
      rawCiphertext: content,
      fingerprint: envelope.fp,
    };
  } catch (err) {
    return {
      text: '🔒 [End-to-End Encrypted Message — Key Mismatch]',
      isEncrypted: true,
      verified: false,
      rawCiphertext: content,
    };
  }
}
