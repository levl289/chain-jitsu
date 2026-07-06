import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ProvisioningService } from '../../core/services/provisioning.service';

/**
 * Shown when the site has no technique library / credentials yet. It doesn't
 * expose any admin controls — provisioning is done out-of-band by whoever holds
 * the CSV + credentials (see the deploy/provision process) — it just explains
 * the state and lets a visitor re-check after the admin has deployed the data.
 */
@Component({
  selector: 'app-setup-needed',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <div class="setup-wrap">
      <mat-card appearance="outlined" class="setup-card">
        @if (checking()) {
          <mat-progress-bar mode="indeterminate" />
        }
        <div class="setup-icon"><mat-icon>construction</mat-icon></div>
        <h1 class="setup-title">This site isn’t set up yet</h1>

        <p class="setup-lead">
          It needs to be provisioned by someone with the academy’s technique
          library and credentials before anyone can sign in.
        </p>

        <ol class="setup-steps">
          <li [class.done]="prov.csvPresent()">
            <mat-icon>{{ prov.csvPresent() ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
            <span>Load the <strong>technique library</strong> (CSV)</span>
          </li>
          <li [class.done]="prov.usersPresent()">
            <mat-icon>{{ prov.usersPresent() ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
            <span>Load the <strong>credentials file</strong> (locks the setup)</span>
          </li>
        </ol>

        <p class="setup-hint">{{ hint() }}</p>

        <button mat-flat-button color="primary" (click)="recheck()" [disabled]="checking()">
          <mat-icon>refresh</mat-icon>
          Check again
        </button>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .setup-wrap {
        display: flex;
        justify-content: center;
        padding: 32px 16px;
      }
      .setup-card {
        max-width: 460px;
        width: 100%;
        padding: 24px;
        text-align: center;
      }
      .setup-icon mat-icon {
        font-size: 44px;
        width: 44px;
        height: 44px;
        color: var(--mat-sys-primary);
      }
      .setup-title {
        margin: 12px 0 8px;
        font-size: 1.3rem;
      }
      .setup-lead {
        color: var(--mat-sys-on-surface-variant);
        margin: 0 0 20px;
      }
      .setup-steps {
        list-style: none;
        padding: 0;
        margin: 0 0 16px;
        text-align: left;
      }
      .setup-steps li {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 0;
        color: var(--mat-sys-on-surface-variant);
      }
      .setup-steps li.done {
        color: var(--mat-sys-on-surface);
      }
      .setup-steps li.done mat-icon {
        color: var(--mat-sys-primary);
      }
      .setup-hint {
        font-size: 0.85rem;
        color: var(--mat-sys-on-surface-variant);
        margin: 0 0 20px;
      }
    `,
  ],
})
export class SetupNeededComponent {
  readonly prov = inject(ProvisioningService);
  private readonly router = inject(Router);

  readonly checking = signal(false);

  readonly hint = computed(() => {
    if (this.prov.csvPresent() && !this.prov.usersPresent()) {
      return 'Technique library detected — awaiting the credentials file to finish.';
    }
    return 'Once both are deployed, this page will let you continue to sign in.';
  });

  async recheck(): Promise<void> {
    this.checking.set(true);
    const ok = await this.prov.recheck();
    this.checking.set(false);
    if (ok) {
      this.router.navigate(['/login']);
    }
  }
}
