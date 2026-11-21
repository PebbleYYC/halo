// The Coach looking for patterns on its own, once a day while it's set up: the day's variables and screen
// (src/queries/discovery.ts), the person's own model free to run its own tests (discoverText.ts), and only the findings
// that hold up kept in AsyncStorage for Home's card and the weekly notification. No React here, so the background task
// runs it after a sync and the app runs it when Home opens on a day without one. Never throws.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isStepCount, streamText } from "ai";
import { loadDiscovery, passes, screen } from "@/queries/discovery";
import type { QueryCtx } from "@/queries/ctx";
import { checkFindings, DISCOVER_INSTRUCTIONS, discoverPrompt, discoverTools, proposedCount, shortlistOf, TestFamily, type Finding } from "./discoverText";
import { deviceFetch } from "./net";
import { modelFor } from "./providers";
import { apiKey, coachSetup } from "./storage";

const FINDINGS_KEY = "pulse.discover.findings";
const DISMISSED_KEY = "pulse.discover.dismissed";
/** A dismissed finding stays away this long, then may come back if it still holds. */
export const DISMISS_DAYS = 30;
/** A failed run is retried after this long (a bad key or no network would otherwise ask on every sync). */
const RETRY_MS = 6 * 3600_000;
/** Findings older than this aren't shown: they may no longer hold. */
export const SHOW_DAYS = 7;

/** `day` the findings were made; `tried` the last day a run was attempted, `failedAt` when it failed (ms). */
export type SavedFindings = {
  day: string;
  at: number;
  findings: Finding[];
  tried?: string;
  failedAt?: number;
  /** The last look, for Settings › Coach: what was compared, what cleared the bar, what the model proposed and kept. */
  stats?: { at: number; variables: number; tested: number; cleared: number; proposed: number; kept: number };
  /** Why the last look failed (an error's name or message), cleared on success. */
  error?: string;
};

/** Whether today needs no run: it already succeeded, or failed less than RETRY_MS ago. */
export const lookedToday = (s: SavedFindings | null, today: string, nowMs = Date.now()) =>
  !!s && (s.tried ?? s.day) === today && (s.failedAt == null || nowMs - s.failedAt < RETRY_MS);

/** Whether the Coach can be asked: consent, a provider and model, and a key. */
export async function coachReady(): Promise<boolean> {
  const s = await coachSetup();
  return !!(s.consent && s.provider && s.model && s.last4);
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const savedFindings = () => readJson<SavedFindings>(FINDINGS_KEY);

const listeners = new Set<() => void>();
/** Called when a run saves new findings; returns the unsubscribe. */
export function subscribeFindings(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

let inflight: Promise<SavedFindings | null> | null = null;
/** The day this process last finished a run: a write that didn't stick never makes Home ask again in a loop. */
let ranOn = { day: "", at: 0 };

/** Today's findings: the saved ones when today already ran (or failed recently), else one run now. */
export function discover(ctx: QueryCtx, force = false): Promise<SavedFindings | null> {
  inflight ??= run(ctx, force).finally(() => {
    inflight = null;
    ranOn = { day: ctx.today, at: Date.now() };
  });
  return inflight;
}

async function run(ctx: QueryCtx, force: boolean): Promise<SavedFindings | null> {
  try {
    const saved = await savedFindings();
    if (!force && (lookedToday(saved, ctx.today) || (ranOn.day === ctx.today && Date.now() - ranOn.at < RETRY_MS))) return saved;
    const s = await coachSetup();
    const key = s.consent && s.provider && s.model ? await apiKey() : null;
    const model = key && s.provider && s.model ? modelFor(s.provider, s.model, key, deviceFetch) : null;
    if (!model) return saved;
    const vars = await loadDiscovery(ctx);
    const screened = screen(vars);
    const family = new TestFamily(vars, screened);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 90_000);
    let next: SavedFindings;
    try {
      // Streamed like the chat (the same path on the phone's fetch); the answer is the last step's text.
      let failure: unknown = null;
      const result = streamText({
        model,
        instructions: DISCOVER_INSTRUCTIONS,
        prompt: discoverPrompt(vars, shortlistOf(screened), s.instructions),
        tools: discoverTools(family),
        stopWhen: isStepCount(12),
        maxOutputTokens: 4000,
        maxRetries: 0,
        abortSignal: ctl.signal,
        onError: ({ error }) => {
          failure ??= error;
        },
      });
      const text = await result.text;
      if (failure) throw failure;
      // Out of steps while still testing: no answer, which isn't "nothing found".
      if (!text.trim()) throw new Error("no answer");
      const findings = checkFindings(text, family);
      const all = family.results;
      next = {
        day: ctx.today,
        at: Date.now(),
        findings,
        tried: ctx.today,
        stats: { at: Date.now(), variables: vars.length, tested: all.length, cleared: all.filter(passes).length, proposed: proposedCount(text), kept: findings.length },
      };
    } catch (e) {
      console.warn("[discover]", e instanceof Error ? `${e.name}: ${e.message}` : "error");
      // Keep the last findings, still dated when they were made; mark the attempt so the retry waits.
      const why = whyFailed(e);
      next = { day: saved?.day ?? "", at: saved?.at ?? Date.now(), findings: saved?.findings ?? [], tried: ctx.today, failedAt: Date.now(), error: why.slice(0, 80), stats: { at: Date.now(), variables: vars.length, tested: family.results.length, cleared: family.results.filter(passes).length, proposed: 0, kept: 0 } };
    } finally {
      clearTimeout(timer);
    }
    await AsyncStorage.setItem(FINDINGS_KEY, JSON.stringify(next)).catch(() => {});
    listeners.forEach((f) => f());
    return next;
  } catch (e) {
    console.warn("[discover]", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** A failed look in a few plain words: the kind of failure, never the provider's raw reply (it can echo the request). */
export function whyFailed(e: unknown): string {
  if (!(e instanceof Error)) return "something went wrong";
  const status = (e as { statusCode?: number }).statusCode;
  if (e.name === "AbortError" || /abort/i.test(e.message)) return "took too long";
  if (status === 429) return "the provider’s rate limit";
  if (status === 401 || status === 403) return "the key was refused";
  if (status != null && status >= 500) return "the provider had an error";
  if (/network|failed to fetch|connection/i.test(e.message)) return "no connection";
  if (e.message === "no answer") return "no answer";
  return `${e.name}: ${e.message}`.slice(0, 80);
}

/** Keys dismissed and still inside their DISMISS_DAYS, with when each ends (unix seconds). */
export async function dismissedFindings(now = Math.floor(Date.now() / 1000)): Promise<Record<string, number>> {
  const all = (await readJson<Record<string, number>>(DISMISSED_KEY)) ?? {};
  return Object.fromEntries(Object.entries(all).filter(([, until]) => until > now));
}

export async function dismissFinding(key: string, now = Math.floor(Date.now() / 1000)): Promise<void> {
  const next = { ...(await dismissedFindings(now)), [key]: now + DISMISS_DAYS * 86_400 };
  await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(next)).catch(() => {});
}
