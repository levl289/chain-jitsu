import {
  beltRank,
  formatBelt,
  nodeKey,
  nodeLabel,
  splitPositionRole,
} from './card.model';

describe('splitPositionRole', () => {
  it('splits a trailing Top/Bottom/Neutral suffix into a role', () => {
    expect(splitPositionRole('Closed Guard Bottom')).toEqual({
      position: 'Closed Guard',
      role: 'bottom',
    });
    expect(splitPositionRole('Mount Top')).toEqual({ position: 'Mount', role: 'top' });
    expect(splitPositionRole('50/50 Neutral')).toEqual({
      position: '50/50',
      role: 'neutral',
    });
  });

  it('keeps compound position names intact', () => {
    expect(splitPositionRole('X Guard / SLX Bottom')).toEqual({
      position: 'X Guard / SLX',
      role: 'bottom',
    });
  });

  it('treats a label with no role suffix as a neutral position', () => {
    expect(splitPositionRole('Top Position')).toEqual({
      position: 'Top Position',
      role: 'neutral',
    });
    expect(splitPositionRole('Standup')).toEqual({ position: 'Standup', role: 'neutral' });
  });
});

describe('formatBelt / beltRank', () => {
  it('renders the arrow', () => {
    expect(formatBelt('White->Blue')).toBe('White → Blue');
    expect(formatBelt('Brown->Black')).toBe('Brown → Black');
  });

  it('ranks belts in order', () => {
    expect(beltRank('White->Blue')).toBe(0);
    expect(beltRank('Brown->Black')).toBe(3);
    expect(beltRank('White->Blue')).toBeLessThan(beltRank('Purple->Brown'));
  });
});

describe('node helpers', () => {
  it('builds a stable key and readable label', () => {
    const node = { position: 'Mount', role: 'top' as const };
    expect(nodeKey(node)).toBe('Mount::top');
    expect(nodeLabel(node)).toBe('Mount / Top');
  });
});
