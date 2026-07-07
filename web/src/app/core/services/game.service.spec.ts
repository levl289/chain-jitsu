import { CardService } from './card.service';
import { GameService } from './game.service';
import { Card, GameNode } from '../models/card.model';
import { loadDeck } from '../../testing/deck-fixture';

const CGB: GameNode = { position: 'Closed Guard', role: 'bottom' };

describe('GameService engine', () => {
  let game: GameService;
  let card: CardService;
  const legal = (t: string): Card => game.legalCards().find((c) => c.technique === t)!;

  beforeEach(async () => {
    ({ card, game } = await loadDeck());
    game.startGame(null); // free-for-all
  });

  it('starts in selecting phase with every start node available', () => {
    expect(game.started()).toBeTrue();
    expect(game.phase()).toBe('selecting');
    const positions = game.availableStartNodes().map((n) => n.node.position);
    expect(positions).toContain('Closed Guard');
    expect(game.availableStartNodes().length).toBe(5);
  });

  it('begins a sequence and lists legal cards alphabetically', () => {
    game.beginSequence(CGB);
    expect(game.phase()).toBe('playing');
    const techs = game.legalCards().map((c) => c.technique);
    expect(techs).toEqual([...techs].sort((a, b) => a.localeCompare(b)));
    expect(techs).toContain('Scissor Sweep');
  });

  it('advances to the next node and accumulates the sequence score', () => {
    game.beginSequence(CGB);
    game.play(legal('Scissor Sweep')); // -> Mount Top (6pt)
    expect(game.phase()).toBe('playing');
    expect(game.currentNode()).toEqual({ position: 'Mount', role: 'top' });
    expect(game.sequenceScore()).toBe(6);
  });

  it('resolves a generic "Top Position" sweep to Side Control via points', () => {
    game.beginSequence(CGB);
    game.play(legal('Trip Sweep')); // Top Position, 2pt -> Side Control Top
    expect(game.currentNode()).toEqual({ position: 'Side Control', role: 'top' });
  });

  it('ends the run on a submission finish', () => {
    game.beginSequence(CGB);
    game.play(legal('Scissor Sweep'));
    game.play(legal('Ezekiel')); // submission
    expect(game.phase()).toBe('ended');
    expect(game.endReason()).toBe('finish');
    expect(game.sequenceScore()).toBe(6);
  });

  it('marks a run played: consumes its cards and resets the score', () => {
    game.beginSequence(CGB);
    game.play(legal('Scissor Sweep'));
    game.play(legal('Ezekiel'));
    game.markPlayed();

    expect(game.phase()).toBe('selecting');
    expect(game.sequenceScore()).toBe(0);
    // Mount Top's only card (Ezekiel) is consumed, so it drops out of the deck.
    const positions = game.availableStartNodes().map((n) => n.node.position);
    expect(positions).not.toContain('Mount');
    expect(game.availableStartNodes().length).toBe(4);
  });

  it('restricts continuations after an open landing to the realistic side', () => {
    game.beginSequence(CGB);
    game.play(legal('Weird Move')); // -> Armbar (unresolved, stays open, bottom side)
    expect(game.endReason()).toBe('open');
    const roles = new Set(game.continuationNodes().map((n) => n.node.role));
    expect([...roles]).toEqual(['bottom']);
  });

  it('mark-played then reset restores the full deck', () => {
    game.beginSequence(CGB);
    game.play(legal('Scissor Sweep'));
    game.play(legal('Ezekiel'));
    game.markPlayed();
    game.resetGame();
    expect(game.availableStartNodes().length).toBe(5);
    expect(card.cards().length).toBe(12);
  });
});
