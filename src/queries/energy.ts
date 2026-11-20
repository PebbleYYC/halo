// Energy balance: what you ate against what the day burns (Fitbit's total calories), as a deficit, maintenance or a
// surplus (NOOP Forge's day card). Today is judged against what it's on course to burn, not what it has burned so
// far: by the afternoon the food is most of a day and the burn half of one, so every afternoon would read as a
// surplus. While the forecast's range still reaches both sides of maintenance it says "too early to call".
// Maintenance is ±5 % of the day's burn. Pure.

export type Balance = { verdict: "deficit" | "maintenance" | "surplus" | "early"; balance: number; burn: number };

export const MAINTENANCE_SHARE = 0.05;
/** How far the rest of today's burn may stray from the usual day's. */
const REST_SPREAD = 0.15;

const verdictOf = (balance: number, burn: number): Balance["verdict"] => (Math.abs(balance) <= burn * MAINTENANCE_SHARE ? "maintenance" : balance < 0 ? "deficit" : "surplus");

/** A finished day. */
export function dayBalance(eaten: number | null, burned: number | null): Balance | null {
  if (eaten == null || burned == null || eaten <= 0 || burned <= 0) return null;
  const balance = eaten - burned;
  return { verdict: verdictOf(balance, burned), balance, burn: burned };
}

/**
 * Today so far: `burnedSoFar` plus the usual day's burn over the part of the day still to come (`dayFraction` gone).
 * The verdict holds only if it's the same at both ends of the rest of the day's spread.
 */
export function todayBalance(eaten: number | null, burnedSoFar: number | null, usualBurn: number | null, dayFraction: number): Balance | null {
  if (eaten == null || eaten <= 0 || burnedSoFar == null || usualBurn == null || usualBurn <= 0) return null;
  const rest = Math.max(0, usualBurn * (1 - dayFraction));
  const burn = Math.max(burnedSoFar + rest, burnedSoFar);
  const lo = burnedSoFar + rest * (1 - REST_SPREAD);
  const hi = burnedSoFar + rest * (1 + REST_SPREAD);
  const v = verdictOf(eaten - burn, burn);
  const sure = verdictOf(eaten - lo, lo) === v && verdictOf(eaten - hi, hi) === v;
  return { verdict: sure ? v : "early", balance: eaten - burn, burn };
}

/** "a deficit of about 450 kcal", "maintenance", "a surplus of about 300 kcal". */
export function balanceWords(b: Balance): string {
  const n = Math.round(Math.abs(b.balance) / 50) * 50;
  return b.verdict === "maintenance" ? "maintenance" : b.verdict === "deficit" ? `a deficit of about ${n.toLocaleString("en-US")} kcal` : `a surplus of about ${n.toLocaleString("en-US")} kcal`;
}
