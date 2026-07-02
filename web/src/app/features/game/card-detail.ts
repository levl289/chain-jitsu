import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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

/**
 * Card detail dialog. The simplified CSV carries no generated coaching prompts,
 * so the dialog derives its content from the graph row (position → end position,
 * points, belt) plus the optional instructor Notes and a personal, device-local note.
 */
@Component({
  selector: 'app-card-detail',
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
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
