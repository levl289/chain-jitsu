import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { formatBelt } from '../core/models/card.model';

/** Belt colours. White gets a border via the swatch so it stays visible. */
const BELT_COLORS: Record<string, string> = {
  White: '#ECEFF1',
  Blue: '#1669C1',
  Purple: '#7B1FA2',
  Brown: '#5D4037',
  Black: '#1A1A1A',
};

/**
 * Renders a belt-test section (e.g. "White->Blue") as two separate colour swatches
 * with a right-pointing arrow toward the higher belt. The readable label is exposed
 * via title/aria-label for accessibility.
 */
@Component({
  selector: 'app-belt-bar',
  imports: [MatIconModule],
  template: `
    <span class="belt-bar" [title]="label()" [attr.aria-label]="label()" role="img">
      @for (color of colors(); track $index; let first = $first) {
        @if (!first) {
          <mat-icon class="belt-arrow" aria-hidden="true">arrow_right_alt</mat-icon>
        }
        <span class="swatch" [style.background-color]="color"></span>
      }
    </span>
  `,
  styles: [
    `
      .belt-bar {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        vertical-align: middle;
      }
      .swatch {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        border: 1px solid rgba(0, 0, 0, 0.25);
        flex-shrink: 0;
      }
      .belt-arrow {
        font-size: 16px;
        width: 16px;
        height: 16px;
        line-height: 16px;
        overflow: visible;
        color: var(--mat-sys-on-surface-variant);
      }
    `,
  ],
})
export class BeltBarComponent {
  /** Belt transition string, e.g. "Purple->Brown". */
  readonly belt = input.required<string>();

  readonly label = computed(() => formatBelt(this.belt()));

  readonly colors = computed(() =>
    this.belt()
      .split('->')
      .map((part) => BELT_COLORS[part.trim()] ?? '#9E9E9E'),
  );
}
