import { Component, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from './core/services/auth.service';
import { GameService } from './core/services/game.service';
import {
  ConfirmDialogComponent,
  ConfirmData,
} from './shared/confirm-dialog';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly game = inject(GameService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  /**
   * Brand click → back to the level (test) selector. If a deck pull is in
   * progress, confirm first so the run isn't lost by accident.
   */
  goHome(): void {
    if (!this.auth.user()) {
      return;
    }
    const midPull = this.game.started() && this.game.phase() !== 'selecting';
    if (!midPull) {
      this.game.exitGame();
      return;
    }
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Leave this run?',
          message:
            'You’re in the middle of a pull. Going back to level selection will end it.',
          confirm: 'Leave run',
          cancel: 'Stay',
        } satisfies ConfirmData,
        width: '360px',
        maxWidth: '92vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((ok) => {
        if (ok) {
          this.game.exitGame();
        }
      });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
