import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type Role = 'instructor' | 'student';

export interface AppUser {
  username: string;
  displayName: string;
  role: Role;
}

interface UserRecord extends AppUser {
  password: string;
}

const USERS_URL = 'data/users.json';
const SESSION_KEY = 'btt.session.v1';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSig = signal<AppUser | null>(readSession());

  readonly user = this.userSig.asReadonly();
  readonly isLoggedIn = computed(() => this.userSig() !== null);
  readonly isInstructor = computed(() => this.userSig()?.role === 'instructor');

  constructor(private readonly http: HttpClient) {}

  /** Validates credentials against the bundled users.json. Returns null on success, else an error message. */
  async login(username: string, password: string): Promise<string | null> {
    let records: UserRecord[];
    try {
      const data = await firstValueFrom(
        this.http.get<{ users: UserRecord[] }>(USERS_URL),
      );
      records = data.users ?? [];
    } catch {
      return 'Could not load user list. Please try again.';
    }

    const match = records.find(
      (u) =>
        u.username.toLowerCase() === username.trim().toLowerCase() &&
        u.password === password,
    );
    if (!match) {
      return 'Incorrect username or password.';
    }

    const user: AppUser = {
      username: match.username,
      displayName: match.displayName || match.username,
      role: match.role,
    };
    this.userSig.set(user);
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return null;
  }

  logout(): void {
    this.userSig.set(null);
    localStorage.removeItem(SESSION_KEY);
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
