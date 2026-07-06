import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Detects whether the site has been provisioned with its two runtime artifacts:
 * a technique library (data/cards.csv) and a credentials file (data/users.json).
 * Neither is committed to the (public) repo — they're supplied at deploy time —
 * so a fresh deployment is "unprovisioned" until an admin loads them.
 *
 * Checks are content-aware: a static host often answers a missing file with its
 * SPA index.html (HTTP 200), so we reject HTML and empty/placeholder payloads
 * rather than trusting the status code.
 */
@Injectable({ providedIn: 'root' })
export class ProvisioningService {
  private readonly http = inject(HttpClient);
  private cached?: Promise<boolean>;

  /** null = not yet checked. */
  readonly provisioned = signal<boolean | null>(null);
  readonly csvPresent = signal(false);
  readonly usersPresent = signal(false);

  /** Resolves to whether both artifacts are present. Cached after first call. */
  isProvisioned(): Promise<boolean> {
    if (!this.cached) {
      this.cached = this.probe();
    }
    return this.cached;
  }

  /** Force a fresh probe (e.g. the admin just deployed the data). */
  recheck(): Promise<boolean> {
    this.cached = undefined;
    return this.isProvisioned();
  }

  private async probe(): Promise<boolean> {
    const [csv, users] = await Promise.all([
      this.fetchText('data/cards.csv'),
      this.fetchText('data/users.json'),
    ]);

    const csvOk =
      !!csv &&
      !isHtml(csv) &&
      csv.trim().split(/\r?\n/).filter((l) => l.trim()).length > 1;

    let usersOk = false;
    if (users && !isHtml(users)) {
      try {
        const parsed = JSON.parse(users);
        const arr = Array.isArray(parsed) ? parsed : parsed?.users;
        usersOk = Array.isArray(arr) && arr.length > 0;
      } catch {
        usersOk = false;
      }
    }

    this.csvPresent.set(csvOk);
    this.usersPresent.set(usersOk);
    const ok = csvOk && usersOk;
    this.provisioned.set(ok);
    return ok;
  }

  private async fetchText(url: string): Promise<string | null> {
    try {
      return await firstValueFrom(this.http.get(url, { responseType: 'text' }));
    } catch {
      return null;
    }
  }
}

function isHtml(body: string): boolean {
  return /^﻿?\s*<(?:!doctype|html)/i.test(body);
}
