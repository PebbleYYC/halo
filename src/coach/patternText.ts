// The Coach's voice for the patterns Home offers (src/queries/patterns.ts): the prompt that asks the model to rewrite
// each finding as a short suggestion, and the check on what comes back. The numbers are the app's, never the model's:
// a rewrite that states a number the finding didn't (or drops the finding's main figure) is thrown away and the
// template stays. Pure, so the guard is tested without a model.
import type { Pattern } from "@/queries/patterns";

export type PatternWords = { title: string; body: string };

export const PATTERN_INSTRUCTIONS = [
  "You are Halo's health coach. Each finding below comes from the person's own wearable and journal data.",
  "Rewrite each one as a short, friendly, specific suggestion in second person: a title of at most 7 words that says what to do, and a body of at most 2 sentences.",
  "Keep every number exactly as given (with its unit) and add no other numbers, dates or times. Don't diagnose, don't promise outcomes, and keep weekday and clock wording as given.",
  'Reply with JSON only: [{"key": "...", "title": "...", "body": "..."}], one object per finding, same keys.',
].join(" ");

export function patternPrompt(patterns: readonly Pick<Pattern, "key" | "title" | "body">[], notes?: string | null): string {
  const lines = patterns.map((p) => JSON.stringify({ key: p.key, title: p.title, body: p.body }));
  return `${notes ? `The person's own notes for their coach: ${notes.slice(0, 500)}\n` : ""}Findings:\n${lines.join("\n")}`;
}

/** Every number in a text: "21:00", "15", "7.5". */
export const numbersIn = (s: string): string[] => s.match(/\d+(?:[.:]\d+)?/g) ?? [];

/** The model's rewrite for each finding it kept honest; findings it got wrong are absent. */
export function parsePatternWords(raw: string, patterns: readonly Pick<Pattern, "key" | "title" | "body">[]): Record<string, PatternWords> {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return {};
  }
  if (!Array.isArray(parsed)) return {};
  const byKey = new Map(patterns.map((p) => [p.key, p]));
  const out: Record<string, PatternWords> = {};
  for (const x of parsed) {
    if (!x || typeof x !== "object") continue;
    const { key, title, body } = x as Record<string, unknown>;
    if (typeof key !== "string" || typeof title !== "string" || typeof body !== "string") continue;
    const p = byKey.get(key);
    const t = title.trim();
    const b = body.trim();
    if (!p || !t || !b || t.length > 60 || b.length > 280) continue;
    const allowed = new Set(numbersIn(`${p.title} ${p.body}`));
    const said = numbersIn(`${t} ${b}`);
    if (said.some((n) => !allowed.has(n))) continue;
    // The finding's first figure (its effect) must survive the rewrite.
    const lead = numbersIn(p.body)[0];
    if (lead && !said.includes(lead)) continue;
    out[key] = { title: t, body: b };
  }
  return out;
}

/** What identifies a set of findings: a rewrite is asked again only when this changes. */
export const patternSig = (patterns: readonly Pick<Pattern, "key" | "body">[]) => patterns.map((p) => `${p.key}=${p.body}`).join("|");
