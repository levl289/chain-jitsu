import { Injectable, signal } from '@angular/core';

/**
 * Per-card notes stored in localStorage, namespaced by username so different
 * users on the same device keep separate notes. Structured as a flat map so a
 * future v2 export can serialise it directly.
 */
export interface NoteMap {
  [cardId: string]: string;
}

const KEY_PREFIX = 'btt.notes.v1.';

@Injectable({ providedIn: 'root' })
export class NotesService {
  private username = 'anon';
  private readonly notesSig = signal<NoteMap>({});

  readonly notes = this.notesSig.asReadonly();

  /** Point the service at a user's note namespace and load their notes. */
  setUser(username: string): void {
    this.username = username || 'anon';
    this.notesSig.set(this.read());
  }

  get(cardId: string): string {
    return this.notesSig()[cardId] ?? '';
  }

  set(cardId: string, text: string): void {
    const next = { ...this.notesSig() };
    if (text.trim()) {
      next[cardId] = text;
    } else {
      delete next[cardId];
    }
    this.notesSig.set(next);
    this.write(next);
  }

  private key(): string {
    return KEY_PREFIX + this.username;
  }

  private read(): NoteMap {
    try {
      const raw = localStorage.getItem(this.key());
      return raw ? (JSON.parse(raw) as NoteMap) : {};
    } catch {
      return {};
    }
  }

  private write(map: NoteMap): void {
    localStorage.setItem(this.key(), JSON.stringify(map));
  }
}
