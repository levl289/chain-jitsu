/**
 * Domain model for a single BJJ position card.
 *
 * One CSV row === one card === one legal action (technique) from one start node.
 * The source CSV is intentionally small — see docs/bjj_position_card_game_simple_csv_handoff_v3.md.
 * Columns: Start Position, Class, Technique, End Position, Points, Belt Level, Notes.
 */
export interface Card {
  /** Synthesized stable id (the CSV has no id column). Used for notes + played-set tracking. */
  cardId: string;
  /** Position without perspective, e.g. "Closed Guard", "Mount", "X Guard / SLX". */
  position: string;
  /** Perspective parsed from the Start Position suffix. */
  role: PlayerRole;
  class: TechniqueClass;
  technique: string;
  /** Optimal resulting position ("End Position"); "Finish" ends the sequence. */
  endPosition: string;
  points: number;
  /** '' when the row is supplemental (not from the belt-test source). */
  beltLevel: BeltLevel | '';
  /** Optional instructor-facing note from the CSV. */
  notes: string;
  /** True when Belt Level is blank — supplemental / broader-curriculum row. */
  supplemental: boolean;
}

export type PlayerRole = 'bottom' | 'top' | 'neutral';

export type TechniqueClass =
  | 'Sweep'
  | 'Submission'
  | 'Guard Open'
  | 'Pass'
  | 'Defense'
  | 'Transition';

export const BELT_LEVELS = [
  'White->Blue',
  'Blue->Purple',
  'Purple->Brown',
  'Brown->Black',
] as const;

export type BeltLevel = (typeof BELT_LEVELS)[number];

/** Ordinal rank of a belt level for cumulative filtering (lower = earlier belt). */
export function beltRank(belt: BeltLevel): number {
  return BELT_LEVELS.indexOf(belt);
}

/** Render a belt label with a real arrow, e.g. "Brown->Black" -> "Brown → Black". */
export function formatBelt(belt: string): string {
  return belt.replace(/\s*->\s*/, ' → ');
}

const ROLE_SUFFIXES: Record<string, PlayerRole> = {
  Top: 'top',
  Bottom: 'bottom',
  Neutral: 'neutral',
};

/**
 * Splits a "Start Position" / "End Position" string into a position + role.
 * Every playable node in the source ends with " Top", " Bottom" or " Neutral"
 * (e.g. "X Guard / SLX Bottom"); anything else is treated as a role-less
 * generic position (e.g. "Top Position", "Standup", "Finish").
 */
export function splitPositionRole(raw: string): {
  position: string;
  role: PlayerRole;
} {
  const trimmed = raw.trim();
  const idx = trimmed.lastIndexOf(' ');
  if (idx > 0) {
    const role = ROLE_SUFFIXES[trimmed.slice(idx + 1)];
    if (role) {
      return { position: trimmed.slice(0, idx).trim(), role };
    }
  }
  return { position: trimmed, role: 'neutral' };
}

/** A concrete state-machine node: a position played from a given role. */
export interface GameNode {
  position: string;
  role: PlayerRole;
}

export function nodeKey(node: GameNode): string {
  return `${node.position}::${node.role}`;
}

export function nodeLabel(node: GameNode): string {
  const roleLabel = node.role.charAt(0).toUpperCase() + node.role.slice(1);
  return `${node.position} / ${roleLabel}`;
}
