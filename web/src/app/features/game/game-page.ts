import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  BELT_LEVELS,
  BeltLevel,
  Card,
  GameNode,
  PlayerRole,
  formatBelt,
  nodeKey,
  nodeLabel,
} from '../../core/models/card.model';
import { CardService } from '../../core/services/card.service';
import { GameService } from '../../core/services/game.service';
import { AuthService } from '../../core/services/auth.service';
import { NotesService } from '../../core/services/notes.service';
import { CardDetailComponent, CardDetailData } from './card-detail';
import { BeltBarComponent } from '../../shared/belt-bar';

/** A belt option in the setup screen; `null` value === free-for-all. */
interface BeltOption {
  value: BeltLevel | null;
  label: string;
  hint: string;
}

/** One playable role within a position group. */
interface RoleEntry {
  node: GameNode;
  count: number;
}

/** A position and its available role(s) — rendered as a single (possibly split) pill. */
interface StartGroup {
  position: string;
  roles: RoleEntry[];
}

@Component({
  selector: 'app-game-page',
  imports: [
    NgTemplateOutlet,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatDialogModule,
    MatTooltipModule,
    BeltBarComponent,
  ],
  templateUrl: './game-page.html',
  styleUrl: './game-page.scss',
})
export class GamePageComponent implements OnInit {
  readonly cards = inject(CardService);
  readonly game = inject(GameService);
  private readonly auth = inject(AuthService);
  private readonly notes = inject(NotesService);
  private readonly dialog = inject(MatDialog);

  readonly loadError = signal<string | null>(null);
  readonly nodeLabel = nodeLabel;
  readonly nodeKey = nodeKey;

  readonly beltOptions: BeltOption[] = [
    { value: null, label: 'Free-for-all', hint: 'Every card, all belts + AI-generated' },
    ...BELT_LEVELS.map((b) => ({
      value: b,
      label: formatBelt(b),
      hint: `Cumulative up to ${formatBelt(b)}`,
    })),
  ];

  readonly selectedBelt = signal<BeltLevel | null>(null);

  /** Human-readable label for the active belt filter. */
  readonly activeBeltLabel = computed(() => {
    const belt = this.game.belt();
    return belt ? formatBelt(belt) : 'Free-for-all';
  });

  readonly formatBelt = formatBelt;

  /** Fixed display order for roles within a position group. */
  private readonly roleOrder: PlayerRole[] = ['bottom', 'top', 'neutral'];

  /**
   * Available start nodes grouped by position, so a position with both a top and
   * bottom variant renders as one split pill instead of two scattered cards.
   */
  readonly startGroups = computed<StartGroup[]>(() => {
    const groups = new Map<string, StartGroup>();
    for (const item of this.game.availableStartNodes()) {
      let group = groups.get(item.node.position);
      if (!group) {
        group = { position: item.node.position, roles: [] };
        groups.set(item.node.position, group);
      }
      group.roles.push({ node: item.node, count: item.count });
    }
    const list = [...groups.values()];
    for (const group of list) {
      group.roles.sort(
        (a, b) =>
          this.roleOrder.indexOf(a.node.role) -
          this.roleOrder.indexOf(b.node.role),
      );
    }
    // Alphabetical by position for a stable, easy-to-scan layout.
    return list.sort((a, b) => a.position.localeCompare(b.position));
  });

  constructor() {
    // Keep per-user notes namespaced to the logged-in user.
    effect(() => {
      const user = this.auth.user();
      this.notes.setUser(user?.username ?? 'anon');
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.cards.load();
    } catch {
      this.loadError.set(
        'Could not load the card deck. Check that data/cards.csv is available.',
      );
    }
  }

  startGame(): void {
    this.game.startGame(this.selectedBelt());
  }

  openCard(card: Card, canPlay: boolean): void {
    const ref = this.dialog.open(CardDetailComponent, {
      data: { card, canPlay } satisfies CardDetailData,
      width: '560px',
      maxWidth: '96vw',
      autoFocus: false,
    });
    ref.afterClosed().subscribe((result) => {
      if (result === 'play') {
        this.game.play(card);
      }
    });
  }

  /**
   * Pick a start node. Begins a fresh sequence when selecting, or continues the
   * current run when resuming after an open/stuck outcome (both grids share this).
   */
  pickStart(node: GameNode): void {
    if (this.game.phase() === 'ended') {
      this.game.continueFrom(node);
    } else {
      this.game.beginSequence(node);
    }
  }

  /** Icon + colour helper for a technique class chip. */
  classIcon(cls: string): string {
    switch (cls) {
      case 'Sweep':
        return 'swap_vert';
      case 'Submission':
        return 'sports_mma';
      case 'Pass':
        return 'directions_run';
      case 'Guard Open':
        return 'open_in_full';
      case 'Defense':
        return 'shield';
      case 'Transition':
        return 'trending_up';
      default:
        return 'style';
    }
  }

  endMessage(): string {
    switch (this.game.endReason()) {
      case 'finish':
        return 'Submission finish! 🎉';
      case 'stuck':
        return 'No further cards from that position.';
      case 'open':
        return 'Reached an open position.';
      case 'stopped':
        return 'Sequence stopped.';
      default:
        return '';
    }
  }
}
