import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  DeckEnvelope,
  UsersFile,
  bytesToB64,
} from '../core/crypto/deck-crypto';
import { AuthService } from '../core/services/auth.service';
import { CardService } from '../core/services/card.service';
import { GameService } from '../core/services/game.service';

const enc = new TextEncoder();
const bs = (b: Uint8Array): BufferSource => b as BufferSource;
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** Low iteration count — these are throwaway test keys, keep the suite fast. */
const TEST_ITERS = 1000;

/** A compact, self-consistent deck exercising every resolveOutcome branch. */
export const TEST_CSV = [
  'Start Position,Class,Technique,End Position,Points,Belt Level,Notes',
  'Closed Guard Bottom,Sweep,Scissor Sweep,Mount Top,6,White->Blue,',
  'Closed Guard Bottom,Sweep,Trip Sweep,Top Position,2,White->Blue,',
  'Closed Guard Bottom,Sweep,Big Sweep,Top Position,6,Purple->Brown,',
  'Closed Guard Bottom,Sweep,Knee Sweep,Top Position,4,Blue->Purple,',
  'Closed Guard Bottom,Sweep,Stand Up,Standup,2,White->Blue,',
  'Closed Guard Bottom,Submission,Triangle,Finish,0,White->Blue,',
  'Closed Guard Bottom,Transition,Weird Move,Armbar,0,,',
  'Mount Top,Submission,Ezekiel,Finish,0,White->Blue,',
  'Side Control Top,Submission,Americana,Finish,0,White->Blue,',
  'Side Control Top,Transition,To Mount,Mount Top,4,,',
  'Knee on Belly Top,Submission,Baseball Choke,Finish,0,,',
  'Open Guard Top,Pass,Knee Cut,Side Control Top,3,,',
].join('\n');

/** Encrypt a CSV under a fresh random key; returns the deck envelope + raw key (base64). */
export async function makeDeck(
  csv: string,
): Promise<{ envelope: DeckEnvelope; keyB64: string }> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  const iv = rand(12);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(iv) }, key, bs(enc.encode(csv))),
  );
  return {
    envelope: { v: 1, iv: bytesToB64(iv), ct: bytesToB64(ct) },
    keyB64: bytesToB64(raw),
  };
}

/**
 * Full envelope provisioning (mirrors scripts/provision.mjs): encrypts the CSV
 * and wraps the master key under each user's password. Used to test the login/
 * decrypt round-trip against the app's deck-crypto helpers.
 */
export async function provisionDeck(
  csv: string,
  users: { username: string; password: string; role: 'instructor' | 'student' }[],
): Promise<{ deck: DeckEnvelope; usersFile: UsersFile }> {
  const master = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', master));
  const iv = rand(12);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(iv) }, master, bs(enc.encode(csv))),
  );
  const deck: DeckEnvelope = { v: 1, iv: bytesToB64(iv), ct: bytesToB64(ct) };

  const out = [];
  for (const u of users) {
    const salt = rand(16);
    const material = await crypto.subtle.importKey('raw', bs(enc.encode(u.password)), 'PBKDF2', false, [
      'deriveKey',
    ]);
    const kek = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: bs(salt), iterations: TEST_ITERS, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    );
    const wrapIv = rand(12);
    const wrappedKey = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(wrapIv) }, kek, bs(raw)),
    );
    out.push({
      username: u.username,
      displayName: u.username,
      role: u.role,
      salt: bytesToB64(salt),
      wrapIv: bytesToB64(wrapIv),
      wrappedKey: bytesToB64(wrappedKey),
    });
  }
  return {
    deck,
    usersFile: { v: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iters: TEST_ITERS }, users: out },
  };
}

/**
 * Configures a TestBed with a CardService + GameService backed by an in-memory
 * encrypted deck (no real HTTP / auth), loads it, and returns both services.
 */
export async function loadDeck(
  csv = TEST_CSV,
): Promise<{ card: CardService; game: GameService }> {
  const { envelope, keyB64 } = await makeDeck(csv);
  TestBed.configureTestingModule({
    providers: [
      CardService,
      GameService,
      { provide: HttpClient, useValue: { get: () => of(envelope) } },
      { provide: AuthService, useValue: { deckKeyB64: () => keyB64 } },
    ],
  });
  const card = TestBed.inject(CardService);
  await card.load();
  return { card, game: TestBed.inject(GameService) };
}
