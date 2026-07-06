import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  UsersFile,
  bytesToB64,
  unwrapMasterKey,
} from '../crypto/deck-crypto';

export type Role = 'instructor' | 'student';

export interface AppUser {
  username: string;
  displayName: string;
  role: Role;
}

const USERS_URL = 'data/users.json';
const SESSION_KEY = 'btt.session.v1';
const DECK_KEY = 'btt.deckkey.v1';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly userSig = signal<AppUser | null>(readSession());

  readonly user = this.userSig.asReadonly();
  readonly isLoggedIn = computed(() => this.userSig() !== null);
  readonly isInstructor = computed(() => this.userSig()?.role === 'instructor');

  /**
   * Validates credentials by unwrapping the deck master key with the supplied
   * password. On success the raw key is cached (so the deck can be decrypted)
   * and null is returned; otherwise an error message.
   */
  async login(username: string, password: string): Promise<string | null> {
    let file: UsersFile;
    try {
      file = await firstValueFrom(this.http.get<UsersFile>(USERS_URL));
    } catch {
      return 'Could not load the credentials file — the site may not be set up yet.';
    }

    const record = (file.users ?? []).find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase(),
    );
    if (!record) {
      return 'Incorrect username or password.';
    }

    let rawKey: Uint8Array;
    try {
      rawKey = await unwrapMasterKey(record, password, file.kdf.iters);
    } catch {
      // AES-GCM tag mismatch === wrong password.
      return 'Incorrect username or password.';
    }

    const user: AppUser = {
      username: record.username,
      displayName: record.displayName || record.username,
      role: record.role,
    };
    this.userSig.set(user);
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    localStorage.setItem(DECK_KEY, bytesToB64(rawKey));
    return null;
  }

  /** Raw master key (base64) recovered at login, used to decrypt the deck. */
  deckKeyB64(): string | null {
    return localStorage.getItem(DECK_KEY);
  }

  logout(): void {
    this.userSig.set(null);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(DECK_KEY);
  }
}

function readSession(): AppUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}
