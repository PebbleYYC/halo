// The Coach's discovery, the parts without a model or storage (tested): the instructions, the prompt, the tool the
// model tests its own ideas with, and the check on its answer. The model chooses what to look at and what is worth
// saying; the app decides whether it's true. A finding is kept only when the test it cites clears the bar across the
// whole run (src/queries/discovery.ts `passes`) and every number it states comes from the tests it cites.
import { tool } from "ai";
import { z } from "zod";
import { adjust, describeResult, DISCOVERY, numbersOf, passes, runTest, weekdayName, type TestResult, type Variable } from "@/queries/discovery";

export type FindingSubject = "recovery" | "sleep" | "strain" | "stress";
export type Finding = { key: string; title: string; body: string; ask: string; subject: FindingSubject; href: string; tests: string[] };

export const DISCOVER_INSTRUCTIONS = [
  "You are Halo's health coach, looking through one person's own wearable and journal data for patterns worth telling them about before they ask.",
  "You get the list of daily variables and the strongest results of a screen that tested every pairing of something they do (a day's strain, steps or stress, their bedtime, a medicine's dose time, a journal answer, the weekday) against the night after, and every night against the day it starts.",
  "Use test_relationship to check your own ideas: any two variables, lag 1 (x on a day, y the night after) or lag 0 (same day), optionally only on one weekday (for example steps against the next night's REM sleep, only on Saturdays). At lag 0, x must be a night or weekday variable, so the cause comes first. Each test is added to the same multiple-comparison correction, so test what you think is plausible, not everything.",
  "Then pick at most 3 findings that are actionable and not obvious (time asleep raising the sleep score is obvious; a weekday that runs low, a behaviour, a timing, or a habit with a clear effect is not). Prefer findings with large effects, and combine tests when one explains another.",
  "Only cite results whose clearsBar is true. State only numbers that appear in the cited results, exactly as given, with their units. No diagnoses, no promises, no other numbers or dates.",
  'Finish with JSON only: [{"tests": ["<id>", ...], "title": "<at most 7 words, what to do>", "body": "<at most 2 sentences, second person>", "ask": "<a question they could ask you to dig deeper>"}]. The first test id is the main evidence. Reply [] if nothing clears the bar or is worth saying.',
].join(" ");

/** The variable list and the screen's shortlist, for the prompt. */
export function discoverPrompt(vars: readonly Variable[], shortlist: readonly TestResult[], notes?: string | null): string {
  const byKey = new Map(vars.map((v) => [v.key, v]));
  const catalogue = vars.map((v) => ({ key: v.key, label: v.label, group: v.group, unit: v.unit, yesNo: v.flag, days: v.values.size }));
  return [
    notes ? `The person's own notes for their coach: ${notes.slice(0, 500)}` : null,
    `Variables:\n${JSON.stringify(catalogue)}`,
    `Strongest screen results (${shortlist.length}):\n${shortlist.map((r) => JSON.stringify(describeResult(r, byKey))).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The screen's best results to start from: the smallest q among those with a usable effect. */
export function shortlistOf(results: readonly TestResult[]): TestResult[] {
  return results
    .filter((r) => Math.abs(r.d) >= 0.2)
    .sort((a, b) => (a.q ?? 1) - (b.q ?? 1) || Math.abs(b.d) - Math.abs(a.d))
    .slice(0, DISCOVERY.shortlist);
}

/** The run's family of tests: the screen's, then the model's own as it asks; re-corrected after each one. */
export class TestFamily {
  readonly byKey: ReadonlyMap<string, Variable>;
  private readonly all = new Map<string, TestResult>();
  private asked = 0;
  constructor(vars: readonly Variable[], screened: readonly TestResult[]) {
    this.byKey = new Map(vars.map((v) => [v.key, v]));
    for (const r of screened) this.all.set(r.id, r);
  }
  get results(): TestResult[] {
    return [...this.all.values()];
  }
  get(id: string): TestResult | undefined {
    return this.all.get(id);
  }
  /** The model's test, added to the family (a repeat returns the earlier result without counting twice). */
  test(x: string, y: string, lag: 0 | 1, weekday: number | null): ReturnType<typeof describeResult> | { error: string } {
    const vx = this.byKey.get(x);
    if (!vx || !this.byKey.has(y)) return { error: "Unknown variable key: use one from the list." };
    if (lag === 0 && vx.group !== "night" && vx.group !== "weekday") return { error: "At lag 0 the outcome comes before x: use lag 1, or a night or weekday x." };
    const r = runTest(this.byKey, x, y, lag, weekday);
    if (!r) return { error: "Not enough days on each side to compare (8 needed)." };
    if (!this.all.has(r.id)) {
      if (this.asked >= DISCOVERY.maxModelTests) return { error: "No more tests this time: write up what clears the bar." };
      this.asked++;
      this.all.set(r.id, r);
      adjust(this.results);
    }
    return describeResult(this.all.get(r.id)!, this.byKey);
  }
}

export function discoverTools(family: TestFamily) {
  return {
    test_relationship: tool({
      description: "Compare y between days with and without x (yes/no x) or with x at or above its median against below. Returns both averages, the difference, the effect size, the corrected q and whether it clears the bar to be shown.",
      inputSchema: z.object({
        x: z.string().describe("Variable key of what happened first"),
        y: z.string().describe("Variable key of the outcome"),
        lag: z.union([z.literal(0), z.literal(1)]).default(1).describe("1: y on the night after x's day; 0: the same day"),
        onlyWeekday: z.enum(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]).optional().describe("Only x days on this weekday"),
      }),
      execute: async ({ x, y, lag, onlyWeekday }) => family.test(x, y, lag, onlyWeekday ? [0, 1, 2, 3, 4, 5, 6].find((w) => weekdayName(w) === onlyWeekday)! : null),
    }),
  };
}

/** Every number in a text: "21:00", "15", "7.5". */
export const numbersIn = (s: string): string[] => s.match(/\d+(?:[.:]\d+)?/g) ?? [];

const SUBJECT: Record<string, FindingSubject> = { recovery: "recovery", hrv: "recovery", rhr: "recovery", strain: "strain", stress: "stress" };
const HREF: Record<FindingSubject, string> = { recovery: "/recovery", sleep: "/sleep", strain: "/strain", stress: "/health/stress" };

/** The last JSON array in a text (the model may write a few words before it, brackets included). */
function lastArray(raw: string): unknown[] | null {
  const end = raw.lastIndexOf("]");
  for (let i = raw.indexOf("["); i >= 0 && i < end; i = raw.indexOf("[", i + 1)) {
    try {
      const v: unknown = JSON.parse(raw.slice(i, end + 1));
      if (Array.isArray(v)) return v;
    } catch {}
  }
  return null;
}

/** The findings in the model's answer that hold up; the rest are dropped. */
export function checkFindings(raw: string, family: TestFamily): Finding[] {
  const parsed = lastArray(raw);
  if (!parsed) return [];
  const out: Finding[] = [];
  for (const f of parsed) {
    if (!f || typeof f !== "object") continue;
    const { tests, title, body, ask } = f as Record<string, unknown>;
    if (!Array.isArray(tests) || !tests.length || typeof title !== "string" || typeof body !== "string") continue;
    const cited = tests.map((id) => (typeof id === "string" ? family.get(id) : undefined));
    if (cited.some((r) => !r)) continue;
    const results = cited as TestResult[];
    const main = results[0];
    if (!passes(main)) continue;
    const [t, b] = [title.trim(), body.trim()];
    if (!t || !b || t.length > 70 || b.length > 300) continue;
    const allowed = new Set(results.flatMap((r) => numbersOf(r, family.byKey)));
    const said = numbersIn(`${t} ${b}`);
    if (said.some((n) => !allowed.has(n))) continue;
    // It must state the main result's own figures, not only a supporting test's.
    const mainNums = new Set(numbersOf(main, family.byKey));
    if (!said.some((n) => mainNums.has(n))) continue;
    const key = main.id;
    if (out.some((o) => o.key === key)) continue;
    const subject = SUBJECT[main.y] ?? "sleep";
    out.push({ key, title: t, body: b, ask: typeof ask === "string" && ask.trim() ? ask.trim().slice(0, 300) : `Tell me more about: ${t}`, subject, href: HREF[subject], tests: results.map((r) => r.id) });
    if (out.length >= 3) break;
  }
  return out;
}
