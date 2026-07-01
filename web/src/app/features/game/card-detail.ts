import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { Card } from '../../core/models/card.model';
import { NotesService } from '../../core/services/notes.service';
import { BeltBarComponent } from '../../shared/belt-bar';

export interface CardDetailData {
  card: Card;
  /** When false the dialog is view-only (no "Play" button) — e.g. reviewing a played card. */
  canPlay: boolean;
}

/** A single labelled detail row, rendered only when the value is non-empty. */
interface DetailRow {
  icon: string;
  label: string;
  value: string;
}

@Component({
  selector: 'app-card-detail',
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    BeltBarComponent,
  ],
  templateUrl: './card-detail.html',
  styleUrl: './card-detail.scss',
})
export class CardDetailComponent {
  private readonly notesSvc = inject(NotesService);
  private readonly ref =
    inject<MatDialogRef<CardDetailComponent, 'play' | undefined>>(MatDialogRef);
  readonly data = inject<CardDetailData>(MAT_DIALOG_DATA);

  readonly card = this.data.card;
  readonly note = signal(this.notesSvc.get(this.card.cardId));

  readonly details = computed<DetailRow[]>(() =>
    (
      [
        { icon: 'flag', label: 'Goal', value: this.card.backGoal },
        { icon: 'tips_and_updates', label: 'Setup', value: this.card.setupPrompt },
        { icon: 'pan_tool', label: 'Key controls', value: this.card.keyControls },
        { icon: 'play_arrow', label: 'Execution', value: this.card.executionPrompt },
        {
          icon: 'sync_problem',
          label: 'Opponent reaction',
          value: this.card.opponentReactionPrompt,
        },
        {
          icon: 'report',
          label: 'Common failures',
          value: this.card.commonFailures,
        },
        { icon: 'east', label: 'Follow up', value: this.card.followUpPrompt },
        { icon: 'check_circle', label: 'Skill check', value: this.card.skillCheck },
        {
          icon: 'health_and_safety',
          label: 'Safety',
          value: this.card.safetyNote,
        },
      ] as DetailRow[]
    ).filter((row) => row.value && row.value.trim().length > 0),
  );

  saveNote(text: string): void {
    this.note.set(text);
    this.notesSvc.set(this.card.cardId, text);
  }

  play(): void {
    this.ref.close('play');
  }

  close(): void {
    this.ref.close();
  }
}
