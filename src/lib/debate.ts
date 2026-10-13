/** Live debate format. The database stores rounds_total = ROUNDS.length (7). */
export type RoundSide = "a" | "b" | "open";
export interface Round { name: string; side: RoundSide; seconds: number }

export const ROUNDS: Round[] = [
  { name: "Opening statement", side: "a", seconds: 120 },
  { name: "Opening statement", side: "b", seconds: 120 },
  { name: "Rebuttal", side: "a", seconds: 90 },
  { name: "Rebuttal", side: "b", seconds: 90 },
  { name: "Audience questions", side: "open", seconds: 300 },
  { name: "Closing statement", side: "a", seconds: 60 },
  { name: "Closing statement", side: "b", seconds: 60 },
];

export const MAX_DEBATERS_PER_SIDE = 3;

type P = { role: "host" | "speaker" | "listener"; side: "a" | "b" | null };
type S = { mode: "space" | "debate"; status: "scheduled" | "live" | "ended"; round_index: number };

/** Who may have their microphone on right now. Used for LiveKit tokens and live permission updates. */
export function canSpeak(space: S, p: P | null | undefined): boolean {
  if (!p || space.status !== "live") return false;
  if (p.role === "host") return true;
  if (p.role !== "speaker") return false;
  if (space.mode === "space") return true;
  const round = ROUNDS[space.round_index];
  if (!round) return false; // not started yet: only the moderator talks
  if (round.side === "open") return true; // invited audience and debaters
  return p.side === round.side;
}

export interface VoteTally { before: { a: number; b: number }; after: { a: number; b: number } }

/** Winner = side that gained the bigger share between the before and after votes. */
export function debateResult(t: VoteTally): { winner: "a" | "b" | "tie" | null; swingA: number; beforeA: number; afterA: number } {
  const bt = t.before.a + t.before.b, at = t.after.a + t.after.b;
  if (!at) return { winner: null, swingA: 0, beforeA: bt ? t.before.a / bt : 0.5, afterA: 0.5 };
  const beforeA = bt ? t.before.a / bt : 0.5;
  const afterA = t.after.a / at;
  const swingA = afterA - beforeA;
  const winner = Math.abs(swingA) < 0.005 ? (t.after.a === t.after.b ? "tie" : t.after.a > t.after.b ? "a" : "b") : swingA > 0 ? "a" : "b";
  return { winner, swingA, beforeA, afterA };
}
