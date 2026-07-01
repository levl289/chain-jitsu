import { Injectable, computed, inject, signal } from '@angular/core';
import { BeltLevel, Card, GameNode } from '../models/card.model';
import { CardService, Outcome } from './card.service';

export type GamePhase = 'selecting' | 'playing' | 'ended';
export type EndReason = 'finish' | 'stuck' | 'open' | 'stopped';

/** One card played within the current sequence. */
export interface PlayStep {
  card: Card;
  outcome: Outcome;
  points: number;
}

/**
 * Free Draw game engine.
 *
 * A "game" spans one belt selection. Within it the player runs "sequences"
 * (start node -> card -> ... -> finish/dead-end). On ending a sequence the
 * player may Restart it (nothing consumed) or Mark Played (every card in the
 * path is consumed and removed from future draws until the game is Reset).
 */
@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly cardService = inject(CardService);

  private readonly beltSig = signal<BeltLevel | null>(null);
  private readonly startedSig = signal(false);
  private readonly phaseSig = signal<GamePhase>('selecting');
  private readonly playedSig = signal<ReadonlySet<string>>(new Set());
  private readonly totalScoreSig = signal(0);

  private readonly currentNodeSig = signal<GameNode | null>(null);
  private readonly sequenceStartSig = signal<GameNode | null>(null);
  private readonly pathSig = signal<PlayStep[]>([]);
  private readonly endReasonSig = signal<EndReason | null>(null);
  private readonly endOutcomeSig = signal<Outcome | null>(null);

  // --- Public read-only state ---
  readonly belt = this.beltSig.asReadonly();
  readonly started = this.startedSig.asReadonly();
  readonly phase = this.phaseSig.asReadonly();
  readonly played = this.playedSig.asReadonly();
  readonly totalScore = this.totalScoreSig.asReadonly();
  readonly currentNode = this.currentNodeSig.asReadonly();
  readonly path = this.pathSig.asReadonly();
  readonly endReason = this.endReasonSig.asReadonly();
  readonly endOutcome = this.endOutcomeSig.asReadonly();

  readonly isFreeForAll = computed(() => this.beltSig() === null);

  /** Score accumulated in the current (uncommitted) sequence. */
  readonly sequenceScore = computed(() =>
    this.pathSig().reduce((sum, step) => sum + step.points, 0),
  );

  /** Card ids that cannot be drawn right now: committed played set + current path. */
  private readonly blockedIds = computed(() => {
    const blocked = new Set(this.playedSig());
    for (const step of this.pathSig()) {
      blocked.add(step.card.cardId);
    }
    return blocked;
  });

  /** Start nodes that still have at least one drawable card under the current filters. */
  readonly availableStartNodes = computed(() => {
    const belt = this.beltSig();
    const blocked = this.blockedIds();
    return this.cardService
      .startNodes()
      .map(({ node }) => ({
        node,
        count: this.cardService.legalCards(node, belt, blocked).length,
      }))
      .filter((n) => n.count > 0);
  });

  /** Legal cards from the current node under the current filters, sorted A–Z by technique. */
  readonly legalCards = computed<Card[]>(() => {
    const node = this.currentNodeSig();
    if (!node) {
      return [];
    }
    return this.cardService
      .legalCards(node, this.beltSig(), this.blockedIds())
      .sort((a, b) =>
        a.technique.localeCompare(b.technique, undefined, {
          sensitivity: 'base',
        }),
      );
  });

  /** Progress across the belt-scoped deck: how many cards have been marked played. */
  readonly progress = computed(() => {
    const belt = this.beltSig();
    const all = this.cardService
      .cards()
      .filter((c) => this.cardService.matchesBelt(c, belt));
    const played = [...this.playedSig()];
    return { played: played.length, total: all.length };
  });

  // --- Game lifecycle ---

  startGame(belt: BeltLevel | null): void {
    this.beltSig.set(belt);
    this.startedSig.set(true);
    this.playedSig.set(new Set());
    this.totalScoreSig.set(0);
    this.resetSequenceState();
    this.phaseSig.set('selecting');
  }

  /** Reset the played deck and score but keep the current belt and stay in-game. */
  resetGame(): void {
    this.playedSig.set(new Set());
    this.totalScoreSig.set(0);
    this.resetSequenceState();
    this.phaseSig.set('selecting');
  }

  /** Leave the game entirely (back to belt selection). */
  exitGame(): void {
    this.startedSig.set(false);
    this.resetSequenceState();
    this.phaseSig.set('selecting');
  }

  // --- Sequence lifecycle ---

  beginSequence(node: GameNode): void {
    this.sequenceStartSig.set(node);
    this.currentNodeSig.set(node);
    this.pathSig.set([]);
    this.endReasonSig.set(null);
    this.endOutcomeSig.set(null);
    this.phaseSig.set('playing');
  }

  play(card: Card): void {
    const outcome = this.cardService.resolveOutcome(card);
    const step: PlayStep = { card, outcome, points: card.points };
    this.pathSig.update((p) => [...p, step]);

    if (outcome.type === 'finish') {
      this.endSequence('finish', outcome);
      return;
    }
    if (outcome.type === 'open') {
      this.endSequence('open', outcome);
      return;
    }
    // outcome.type === 'node'
    const next = this.cardService.legalCards(
      outcome.node,
      this.beltSig(),
      this.blockedIds(),
    );
    if (next.length > 0) {
      this.currentNodeSig.set(outcome.node);
    } else {
      this.endSequence('stuck', outcome);
    }
  }

  /** Manually stop the current sequence. */
  stopSequence(): void {
    this.endSequence('stopped');
  }

  /**
   * Resume a sequence from a manually chosen node (used after an `open`/`stuck`
   * outcome). Preserves the path and score so far.
   */
  continueFrom(node: GameNode): void {
    this.currentNodeSig.set(node);
    this.endReasonSig.set(null);
    this.endOutcomeSig.set(null);
    this.phaseSig.set('playing');
  }

  /** Re-run the current sequence from its start; nothing is consumed. */
  restartSequence(): void {
    const start = this.sequenceStartSig();
    if (start) {
      this.beginSequence(start);
    } else {
      this.phaseSig.set('selecting');
    }
  }

  /** Commit every card in the current path to the played set and bank the score. */
  markPlayed(): void {
    const next = new Set(this.playedSig());
    for (const step of this.pathSig()) {
      next.add(step.card.cardId);
    }
    this.playedSig.set(next);
    this.totalScoreSig.update((s) => s + this.sequenceScore());
    this.resetSequenceState();
    this.phaseSig.set('selecting');
  }

  private endSequence(reason: EndReason, outcome?: Outcome): void {
    this.currentNodeSig.set(null);
    this.endReasonSig.set(reason);
    this.endOutcomeSig.set(outcome ?? null);
    this.phaseSig.set('ended');
  }

  private resetSequenceState(): void {
    this.currentNodeSig.set(null);
    this.sequenceStartSig.set(null);
    this.pathSig.set([]);
    this.endReasonSig.set(null);
    this.endOutcomeSig.set(null);
  }
}
