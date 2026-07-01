/**
 * Domain model for a single BJJ position card.
 *
 * One CSV row === one card === one legal action from one (position, role) node.
 * Field names mirror the source CSV columns so the CSV stays the source of truth.
 */
export interface Card {
  cardId: string;
  techniqueSlug: string;
  cardType: string; // test_atomic | supplemental_atomic | defense
  deck: string;
  gamePile: string;
  position: string;
  subposition: string;
  role: PlayerRole;
  class: TechniqueClass;
  technique: string;
  leadsTo: string;
  points: number;
  pointBasis: string;
  scoreComponents: string;
  requiresStabilization: string; // Yes | No | N/A
  beltLevel: BeltLevel | ''; // '' === AI-generated / supplemental (no belt source)
  testPriority: string;
  frontText: string;
  backGoal: string;
  setupPrompt: string;
  keyControls: string;
  executionPrompt: string;
  opponentReactionPrompt: string;
  commonFailures: string;
  followUpPrompt: string;
  skillCheck: string;
  safetyNote: string;
  backText: string;
  videoSearchQuery: string;
  videoUrl: string;
  instructorNotes: string;
  detailStatus: string;
  tags: string;
  /** True when beltLevel is blank — i.e. this row was AI-generated, not from belt-test source material. */
  aiGenerated: boolean;
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
