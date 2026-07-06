/**
 * Client-side decryption for the encrypted technique deck.
 *
 * The deck is published as ciphertext only (`deck.enc`); it is never readable
 * without a valid login. We use envelope encryption: a random AES-GCM master
 * key encrypts the CSV, and each user's password (via PBKDF2) wraps a copy of
 * that master key in `users.json`. Logging in = unwrapping the master key, which
 * both proves the password and yields the key to decrypt the deck. All of this
 * runs in the browser via Web Crypto; the provisioning script uses the identical
 * primitives so the formats are guaranteed compatible.
 */

/** Encrypted deck container (data/deck.enc). */
export interface DeckEnvelope {
  v: number;
  iv: string; // base64, 12-byte AES-GCM IV
  ct: string; // base64, AES-GCM ciphertext (+tag) of the CSV
}

/** A user's wrapped-key record inside data/users.json. */
export interface WrappedUser {
  username: string;
  displayName: string;
  role: 'instructor' | 'student';
  salt: string; // base64, PBKDF2 salt
  wrapIv: string; // base64, IV used to wrap the master key
  wrappedKey: string; // base64, master key encrypted under the password-derived key
}

export interface UsersFile {
  v: number;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iters: number };
  users: WrappedUser[];
}

const enc = new TextEncoder();
const dec = new TextDecoder();

// Web Crypto's BufferSource typing varies across TS lib versions; a Uint8Array
// is always a valid one, so funnel crypto inputs through this cast.
const bs = (bytes: Uint8Array): BufferSource => bytes as BufferSource;

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin);
}

/** Derive the password-based key-encryption key (KEK). */
async function deriveKek(
  password: string,
  salt: Uint8Array,
  iters: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    bs(enc.encode(password)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bs(salt), iterations: iters, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

/**
 * Attempt to recover the raw master key from a user's wrapped key using the
 * supplied password. Throws if the password is wrong (AES-GCM tag mismatch).
 */
export async function unwrapMasterKey(
  user: WrappedUser,
  password: string,
  iters: number,
): Promise<Uint8Array> {
  const kek = await deriveKek(password, b64ToBytes(user.salt), iters);
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bs(b64ToBytes(user.wrapIv)) },
    kek,
    bs(b64ToBytes(user.wrappedKey)),
  );
  return new Uint8Array(raw);
}

/** Decrypt the deck envelope with the raw master key, returning the CSV text. */
export async function decryptDeck(
  envelope: DeckEnvelope,
  rawMasterKey: Uint8Array,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    bs(rawMasterKey),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bs(b64ToBytes(envelope.iv)) },
    key,
    bs(b64ToBytes(envelope.ct)),
  );
  return dec.decode(plain);
}
