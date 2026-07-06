import {
  Component,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
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
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly loadError = signal<string | null>(null);
  readonly nodeLabel = nodeLabel;
  readonly nodeKey = nodeKey;

  readonly beltOptions: BeltOption[] = [
    { value: null, label: 'Free-for-all', hint: 'Every card, all belts + supplemental' },
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
   * Groups start nodes by position, so a position with both a top and bottom
   * variant renders as one split pill instead of two scattered cards.
   */
  private groupStartNodes(items: RoleEntry[]): StartGroup[] {
    const groups = new Map<string, StartGroup>();
    for (const item of items) {
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
  }

  /** Every available start node (fresh drill can begin anywhere). */
  readonly startGroups = computed<StartGroup[]>(() =>
    this.groupStartNodes(this.game.availableStartNodes()),
  );

  /** Realistic continuations after an open/stuck end (restricted to the side). */
  readonly continuationGroups = computed<StartGroup[]>(() =>
    this.groupStartNodes(this.game.continuationNodes()),
  );

  /**
   * Navigation depth for the device/browser Back button: 0 = level selector,
   * 1 = the deck (start-position picker), 2 = an in-progress run (playing/ended).
   */
  readonly navLevel = computed(() => {
    if (!this.game.started()) {
      return 0;
    }
    return this.game.phase() === 'selecting' ? 1 : 2;
  });

  /** Depth of synthetic history entries pushed to trap the Back button. */
  private guards = 0;
  /** Last sequence id assigned to a trap entry (monotonic). */
  private histSeq = 0;
  /** Sequence id of the history entry currently shown (0 === app's base entry). */
  private histPos = 0;
  /** True while we drive history ourselves (unwind/bounce) — ignore our own popstate. */
  private syncing = false;

  constructor() {
    // Keep per-user notes namespaced to the logged-in user.
    effect(() => {
      const user = this.auth.user();
      this.notes.setUser(user?.username ?? 'anon');
    });

    // Keep synthetic history entries in sync with the nav depth so the Back
    // button walks run → deck → selector instead of leaving the app. Pushing a
    // state never fires popstate; unwinding (history.go) is guarded by `syncing`.
    effect(() => {
      const target = this.navLevel();
      if (this.syncing) {
        return;
      }
      while (this.guards < target) {
        this.pushTrap();
      }
      if (this.guards > target) {
        const excess = this.guards - target;
        this.guards = target;
        this.syncing = true;
        history.go(-excess); // the resulting popstate clears `syncing`
      }
    });
  }

  /** Push a trap entry tagged with a monotonic id so we can tell Back from Forward. */
  private pushTrap(): void {
    this.histSeq += 1;
    this.histPos = this.histSeq;
    this.guards += 1;
    history.pushState({ bttSeq: this.histSeq }, '');
  }

  /**
   * Device/browser navigation. Back steps up one nav level (run → deck →
   * selector). Forward is disabled: since a landed id greater than our current
   * one means the user went forward into an abandoned run/selector entry, we
   * bounce straight back so it can't take effect.
   */
  @HostListener('window:popstate', ['$event'])
  onPopState(e: PopStateEvent): void {
    const landed = (e.state as { bttSeq?: number } | null)?.bttSeq ?? 0;
    if (this.syncing) {
      // This popstate is one we triggered (unwind or forward-bounce). Consume it.
      this.histPos = landed;
      this.syncing = false;
      return;
    }
    if (landed > this.histPos) {
      // Forward pressed — undo it. history.back() fires a popstate that the
      // `syncing` branch above consumes, so the forward never takes effect.
      this.histPos = landed;
      this.syncing = true;
      history.back();
      return;
    }
    this.histPos = landed;
    if (this.guards > 0) {
      this.guards -= 1;
    }
    const level = this.navLevel();
    if (level >= 2) {
      this.game.returnToDeck(); // run → deck
    } else if (level === 1) {
      this.game.exitGame(); // deck → level selector
    }
    // level 0: nothing trapped, let the browser navigate away.
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.cards.load();
    } catch {
      // Any failure to load or unlock the deck means the stored session + key
      // are stale (e.g. the site was re-provisioned under a new key). Dump them
      // and send the user to a clean login instead of a dead error screen.
      this.auth.logout();
      this.router.navigate(['/login']);
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
    const outcome = this.game.endOutcome();
    switch (this.game.endReason()) {
      case 'finish':
        return 'Submission finish! 🎉';
      case 'stuck':
        return 'No further cards from that position.';
      case 'open':
        return outcome?.type === 'open'
          ? `Now in ${outcome.label}.`
          : 'Reached an open position.';
      case 'stopped':
        return 'Sequence stopped.';
      default:
        return '';
    }
  }
}
