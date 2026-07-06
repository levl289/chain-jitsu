#!/usr/bin/env node
/**
 * Provision the encrypted deck + credentials for the BJJ card app.
 *
 * Reads your PLAINTEXT technique CSV and a PLAINTEXT user list, and writes two
 * publishable artifacts — neither reveals the curriculum or any password:
 *   - deck.enc    AES-GCM ciphertext of the CSV (opaque; not scrapeable)
 *   - users.json  each user's password wraps a copy of the deck's master key
 *
 * The plaintext inputs never leave your machine. The outputs are safe to publish
 * to a public site, but their security is exactly your password strength (an
 * attacker with the published files can brute-force weak passwords offline).
 * Use a strong instructor passphrase and decent student passwords.
 *
 * Usage:
 *   node scripts/provision.mjs <cards.csv> <users.input.json> [outDir]
 *
 * users.input.json — an array of:
 *   { "username": "prof", "password": "…", "role": "instructor", "displayName": "Professor" }
 *   role defaults to "student"; displayName defaults to username.
 *
 * Default outDir is web/public/data.
 */
import { webcrypto as crypto } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const ITERS = 310_000; // PBKDF2-SHA256, OWASP-ballpark for 2024+
const subtle = crypto.subtle;
const b64 = (buf) => Buffer.from(buf).toString('base64');

const [, , csvPath, usersPath, outDir = 'web/public/data'] = process.argv;
if (!csvPath || !usersPath) {
  console.error('Usage: node scripts/provision.mjs <cards.csv> <users.input.json> [outDir]');
  process.exit(1);
}

const csvBytes = readFileSync(resolve(csvPath));
const userDefs = JSON.parse(readFileSync(resolve(usersPath), 'utf8'));
if (!Array.isArray(userDefs) || userDefs.length === 0) {
  console.error('users.input.json must be a non-empty array of { username, password, role }');
  process.exit(1);
}

// Random master key K, exported raw so we can wrap it per user.
const masterKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
  'encrypt',
  'decrypt',
]);
const rawKey = new Uint8Array(await subtle.exportKey('raw', masterKey));

// Encrypt the CSV under K.
const iv = crypto.getRandomValues(new Uint8Array(12));
const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, masterKey, csvBytes));
const deck = { v: 1, iv: b64(iv), ct: b64(ct) };

// Wrap K for each user under a key derived from their password.
const users = [];
for (const u of userDefs) {
  if (!u.username || !u.password) {
    console.error('Each user needs a username and password:', JSON.stringify(u));
    process.exit(1);
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await subtle.importKey('raw', new TextEncoder().encode(u.password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  const kek = await subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const wrappedKey = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: wrapIv }, kek, rawKey));
  users.push({
    username: u.username,
    displayName: u.displayName || u.username,
    role: u.role === 'instructor' ? 'instructor' : 'student',
    salt: b64(salt),
    wrapIv: b64(wrapIv),
    wrappedKey: b64(wrappedKey),
  });
}
const usersFile = { v: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iters: ITERS }, users };

const deckOut = resolve(outDir, 'deck.enc');
const usersOut = resolve(outDir, 'users.json');
mkdirSync(dirname(deckOut), { recursive: true });
writeFileSync(deckOut, JSON.stringify(deck));
writeFileSync(usersOut, JSON.stringify(usersFile, null, 2));

console.log(`✓ Wrote ${deckOut} (${csvBytes.length} bytes of CSV, encrypted)`);
console.log(`✓ Wrote ${usersOut} (${users.length} user${users.length === 1 ? '' : 's'})`);
console.log('  Publish these two files. Keep the plaintext CSV + user list private.');
