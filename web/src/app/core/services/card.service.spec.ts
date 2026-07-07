import { CardService } from './card.service';
import { Card } from '../models/card.model';
import { loadDeck } from '../../testing/deck-fixture';

describe('CardService.resolveOutcome', () => {
  let svc: CardService;
  const byTech = (t: string): Card => svc.cards().find((c) => c.technique === t)!;

  beforeEach(async () => {
    ({ card: svc } = await loadDeck());
  });

  it('loads and parses the decrypted deck', () => {
    expect(svc.loaded()).toBeTrue();
    expect(svc.cards().length).toBe(12);
  });

  it('finishes on a submission', () => {
    expect(svc.resolveOutcome(byTech('Triangle'))).toEqual({
      type: 'finish',
      label: 'Finish',
    });
  });

  it('resolves an End Position that is a real node', () => {
    expect(svc.resolveOutcome(byTech('Scissor Sweep'))).toEqual({
      type: 'node',
      node: { position: 'Mount', role: 'top' },
    });
  });

  it('maps a generic 2pt "Top Position" sweep to Side Control (points +0)', () => {
    expect(svc.resolveOutcome(byTech('Trip Sweep'))).toEqual({
      type: 'node',
      node: { position: 'Side Control', role: 'top' },
    });
  });

  it('maps a 4pt "Top Position" sweep to Knee on Belly (points +2)', () => {
    expect(svc.resolveOutcome(byTech('Knee Sweep'))).toEqual({
      type: 'node',
      node: { position: 'Knee on Belly', role: 'top' },
    });
  });

  it('maps a 6pt "Top Position" sweep to Mount (points +4)', () => {
    expect(svc.resolveOutcome(byTech('Big Sweep'))).toEqual({
      type: 'node',
      node: { position: 'Mount', role: 'top' },
    });
  });

  it('maps "Standup" to the top of open guard', () => {
    expect(svc.resolveOutcome(byTech('Stand Up'))).toEqual({
      type: 'node',
      node: { position: 'Open Guard', role: 'top' },
    });
  });

  it('leaves an unresolvable landing open', () => {
    const outcome = svc.resolveOutcome(byTech('Weird Move'));
    expect(outcome.type).toBe('open');
  });
});

describe('CardService.matchesBelt', () => {
  let svc: CardService;
  const byTech = (t: string): Card => svc.cards().find((c) => c.technique === t)!;

  beforeEach(async () => {
    ({ card: svc } = await loadDeck());
  });

  it('shows everything in free-for-all (null belt), including supplemental', () => {
    expect(svc.matchesBelt(byTech('Scissor Sweep'), null)).toBeTrue();
    expect(svc.matchesBelt(byTech('Knee Cut'), null)).toBeTrue(); // supplemental
  });

  it('is cumulative up to the selected belt', () => {
    expect(svc.matchesBelt(byTech('Scissor Sweep'), 'White->Blue')).toBeTrue();
    expect(svc.matchesBelt(byTech('Big Sweep'), 'White->Blue')).toBeFalse(); // Purple->Brown
    expect(svc.matchesBelt(byTech('Big Sweep'), 'Brown->Black')).toBeTrue();
  });

  it('hides supplemental (blank-belt) cards in belt mode', () => {
    expect(svc.matchesBelt(byTech('Knee Cut'), 'White->Blue')).toBeFalse();
  });
});
