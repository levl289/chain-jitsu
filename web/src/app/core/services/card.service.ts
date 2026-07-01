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
} from '../models/card.model';

/** Result of resolving a card's `leads_to` into the next state-machine state. */
export type Outcome =
  | { type: 'finish'; label: string } // submission / round-ending finish
  | { type: 'node'; node: GameNode } // cleanly resolved to a concrete node
  | { type: 'open'; label: string }; // reached a state with no concrete follow-up node

const CSV_URL = 'data/cards.csv';

/**
 * Aliases mapping a (messy) `leads_to` label to a canonical deck position name.
 * Only the labels that correspond to a real playable position are listed; anything
 * unmapped resolves to an `open` outcome (player continues manually or ends).
 */
const POSITION_ALIASES: Record<string, string> = {
  'side control': 'Side Control',
  'side control / back': 'Side Control',
  'side control / escape': 'Side Control',
  mount: 'Mount',
  's mount': 'Mount',
  'technical mount': 'Mount',
  back: 'Back Control',
  'back control': 'Back Control',
  'north south': 'North South',
  'knee on belly': 'Knee on Belly',
  'knee on belly / side control': 'Knee on Belly',
  'open guard': 'Open Guard',
  'open guard control': 'Open Guard',
  'recover open guard': 'Open Guard',
  'seated guard': 'Open Guard',
  'seated/open guard': 'Open Guard',
  'closed guard': 'Closed Guard',
  'closed guard control': 'Closed Guard',
  'half guard': 'Half Guard',
  'knee shield half': 'Half Guard',
  'side-facing half guard': 'Half Guard',
  'reverse half guard': 'Reverse Half Guard',
  'deep half': 'Deep Half',
  'butterfly guard': 'Butterfly Guard',
  'x guard': 'X Guard / SLX',
  slx: 'X Guard / SLX',
  'spider guard': 'Spider Guard',
  'lasso guard': 'Lasso Guard',
  rdlr: 'Reverse De La Riva',
  'turtle control': 'Turtle',
  'front headlock': 'Front Headlock',
  '50/50': '50/50',
};

/** `leads_to` labels (or classes) that end the round as a finish/submission. */
const FINISH_LABELS = new Set([
  'finish',
  'triangle',
  'armbar',
  'kimura',
  'omoplata',
  'crucifix',
]);

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
      this.cardsSig.set(rows.map(toCard).filter((c) => c.cardId));
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
      return true; // free-for-all shows everything, including AI-generated cards
    }
    if (card.beltLevel === '') {
      return false; // blank/AI cards are hidden in belt mode
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
   * Resolves the next state after playing `card`, mapping its `leads_to` label to a
   * concrete node when possible.
   */
  resolveOutcome(card: Card): Outcome {
    const label = card.leadsTo.trim();
    const key = label.toLowerCase();

    if (card.class === 'Submission' || FINISH_LABELS.has(key)) {
      return { type: 'finish', label: label || 'Finish' };
    }

    // Try to map the label to a canonical position, honouring compound "a / b" labels.
    const position = this.mapPosition(key);
    if (!position) {
      return { type: 'open', label };
    }

    const role = this.resultRole(card, position);
    return { type: 'node', node: { position, role } };
  }

  private mapPosition(key: string): string | null {
    if (POSITION_ALIASES[key]) {
      return POSITION_ALIASES[key];
    }
    // Compound labels like "guard / side control": take the first segment that maps.
    for (const part of key.split('/').map((p) => p.trim())) {
      if (POSITION_ALIASES[part]) {
        return POSITION_ALIASES[part];
      }
    }
    return null;
  }

  /** Determines which role the acting player holds after the card resolves. */
  private resultRole(card: Card, position: string): PlayerRole {
    const offensiveTop: TechniqueClass[] = ['Sweep', 'Pass', 'Guard Open'];
    let role: PlayerRole;
    if (offensiveTop.includes(card.class)) {
      role = 'top';
    } else {
      role = card.role; // transitions/defense keep the acting player's side
    }
    // If the deck has no start node for the computed role but has the opposite,
    // fall back to whichever role actually exists so the chain can continue.
    if (!this.nodeExists(position, role)) {
      const other: PlayerRole = role === 'top' ? 'bottom' : 'top';
      if (this.nodeExists(position, other)) {
        return other;
      }
    }
    return role;
  }

  private nodeExists(position: string, role: PlayerRole): boolean {
    return this.cardsSig().some(
      (c) => c.position === position && c.role === role,
    );
  }
}

function toCard(r: Record<string, string>): Card {
  const beltLevel = (r['belt_level'] ?? '').trim() as Card['beltLevel'];
  const points = Number.parseInt(r['points'] ?? '', 10);
  return {
    cardId: (r['card_id'] ?? '').trim(),
    techniqueSlug: r['technique_slug'] ?? '',
    cardType: r['card_type'] ?? '',
    deck: r['deck'] ?? '',
    gamePile: r['game_pile'] ?? '',
    position: (r['position'] ?? '').trim(),
    subposition: r['subposition'] ?? '',
    role: ((r['player_role'] ?? '').trim() as PlayerRole) || 'neutral',
    class: (r['class'] ?? '').trim() as TechniqueClass,
    technique: r['technique'] ?? '',
    leadsTo: r['leads_to'] ?? '',
    points: Number.isFinite(points) ? points : 0,
    pointBasis: r['point_basis'] ?? '',
    scoreComponents: r['score_components'] ?? '',
    requiresStabilization: r['requires_stabilization'] ?? '',
    beltLevel,
    testPriority: r['test_priority'] ?? '',
    frontText: r['front_text'] ?? '',
    backGoal: r['back_goal'] ?? '',
    setupPrompt: r['setup_prompt'] ?? '',
    keyControls: r['key_controls'] ?? '',
    executionPrompt: r['execution_prompt'] ?? '',
    opponentReactionPrompt: r['opponent_reaction_prompt'] ?? '',
    commonFailures: r['common_failures'] ?? '',
    followUpPrompt: r['follow_up_prompt'] ?? '',
    skillCheck: r['skill_check'] ?? '',
    safetyNote: r['safety_note'] ?? '',
    backText: r['back_text'] ?? '',
    videoSearchQuery: r['video_search_query'] ?? '',
    videoUrl: r['video_url'] ?? '',
    instructorNotes: r['instructor_notes'] ?? '',
    detailStatus: r['detail_status'] ?? '',
    tags: r['tags'] ?? '',
    aiGenerated: beltLevel === '',
  };
}
