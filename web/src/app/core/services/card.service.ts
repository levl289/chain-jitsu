import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { parseCsv } from '../csv/csv-parser';
import {
  BeltLevel,
  Card,
  GameNode,
  PlayerRole,
  TechniqueClass,
  beltRank,
  nodeKey,
  splitPositionRole,
} from '../models/card.model';

/** Result of resolving a card's End Position into the next state-machine state. */
export type Outcome =
  | { type: 'finish'; label: string } // submission / round-ending finish
  | { type: 'node'; node: GameNode } // End Position matches a real playable node
  | { type: 'open'; label: string }; // reached a state with no concrete follow-up node

const CSV_URL = 'data/cards.csv';

@Injectable({ providedIn: 'root' })
export class CardService {
  private readonly cardsSig = signal<Card[]>([]);
  private readonly loadedSig = signal(false);
  private loadPromise?: Promise<void>;

  readonly cards = this.cardsSig.asReadonly();
  readonly loaded = this.loadedSig.asReadonly();

  /** All distinct playable start nodes present in the deck, with card counts. */
  readonly startNodes = computed<{ node: GameNode; count: number }[]>(() => {
    const counts = new Map<string, { node: GameNode; count: number }>();
    for (const card of this.cardsSig()) {
      const node: GameNode = { position: card.position, role: card.role };
      const key = nodeKey(node);
      const entry = counts.get(key);
      if (entry) {
        entry.count++;
      } else {
        counts.set(key, { node, count: 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  });

  constructor(private readonly http: HttpClient) {}

  /** Loads and parses the bundled CSV exactly once. */
  async load(): Promise<void> {
    if (this.loadPromise) {
      return this.loadPromise;
    }
    this.loadPromise = (async () => {
      const text = await firstValueFrom(
        this.http.get(CSV_URL, { responseType: 'text' }),
      );
      const rows = parseCsv(text);
      this.cardsSig.set(
        rows.map(toCard).filter((c) => c.position && c.technique),
      );
      this.loadedSig.set(true);
    })();
    return this.loadPromise;
  }

  /**
   * Returns cards legal from `node`, filtered by belt (cumulative; null = free-for-all)
   * and excluding any card ids already played this game.
   */
  legalCards(
    node: GameNode,
    belt: BeltLevel | null,
    played: ReadonlySet<string>,
  ): Card[] {
    return this.cardsSig().filter(
      (c) =>
        c.position === node.position &&
        c.role === node.role &&
        this.matchesBelt(c, belt) &&
        !played.has(c.cardId),
    );
  }

  /** True if the card is available under the given belt filter. */
  matchesBelt(card: Card, belt: BeltLevel | null): boolean {
    if (belt === null) {
      return true; // free-for-all shows everything, including supplemental cards
    }
    if (card.beltLevel === '') {
      return false; // supplemental cards are hidden in belt mode
    }
    return beltRank(card.beltLevel) <= beltRank(belt);
  }

  /** Count of legal cards from a node under a belt filter (ignores played set). */
  legalCount(node: GameNode, belt: BeltLevel | null): number {
    return this.cardsSig().filter(
      (c) =>
        c.position === node.position &&
        c.role === node.role &&
        this.matchesBelt(c, belt),
    ).length;
  }

  /**
   * Resolves the next state after playing `card`. Because the simplified CSV's
   * End Position is either "Finish" or (often) a real Start Position like
   * "Mount Top", resolution is a direct node lookup — no alias mapping needed.
   * An End Position that isn't a playable start node (e.g. "Top Position",
   * "Standup", "Armbar") resolves to an `open` outcome the player continues manually.
   */
  resolveOutcome(card: Card): Outcome {
    const label = card.endPosition.trim();
    if (card.class === 'Submission' || label.toLowerCase() === 'finish') {
      return { type: 'finish', label: label || 'Finish' };
    }
    const { position, role } = splitPositionRole(label);
    if (this.nodeExists(position, role)) {
      return { type: 'node', node: { position, role } };
    }
    return { type: 'open', label };
  }

  private nodeExists(position: string, role: PlayerRole): boolean {
    return this.cardsSig().some(
      (c) => c.position === position && c.role === role,
    );
  }
}

function toCard(r: Record<string, string>): Card {
  const { position, role } = splitPositionRole(r['Start Position'] ?? '');
  const beltLevel = (r['Belt Level'] ?? '').trim() as Card['beltLevel'];
  const points = Number.parseInt(r['Points'] ?? '', 10);
  const cls = (r['Class'] ?? '').trim() as TechniqueClass;
  const technique = (r['Technique'] ?? '').trim();
  const endPosition = (r['End Position'] ?? '').trim();
  return {
    cardId: `${position}|${role}|${cls}|${technique}|${endPosition}`,
    position,
    role,
    class: cls,
    technique,
    endPosition,
    points: Number.isFinite(points) ? points : 0,
    beltLevel,
    notes: (r['Notes'] ?? '').trim(),
    supplemental: beltLevel === '',
  };
}
