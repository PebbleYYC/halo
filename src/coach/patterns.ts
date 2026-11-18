// The patterns Home offers once the Coach is set up: the findings (src/queries/patterns.ts) in the Coach's words, asked
// of the person's own model only when the findings change and kept in AsyncStorage, plus the ones the person dismissed.
// No React here, so the background task can read the same words for its weekly notification.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateText } from "ai";
import type { Pattern } from "@/queries/patterns";
import { deviceFetch } from "./net";
import { parsePatternWords, PATTERN_INSTRUCTIONS, patternPrompt, patternSig, type PatternWords } from "./patternText";
import { modelFor } from "./providers";
import { apiKey, coachSetup } from "./storage";

const WORDS_KEY = "pulse.patterns.words";
/** A failed ask isn't retried for this long (a bad key or no network would ask on every run and Home open). */
const RETRY_MS = 6 * 3600_000;
const DISMISSED_KEY = "pulse.patterns.dismissed";
/** A dismissed finding stays away this long, then may come back if it still holds. */
export const DISMISS_DAYS = 30;

/** Whether the Coach can be asked: consent, a provider and model, and a key. */
export async function coachReady(): Promise<boolean> {
  const s = await coachSetup();
  return !!(s.consent && s.provider && s.model && s.last4);
}

/** A failed ask is kept too (words empty), so neither the app nor the background task asks again for RETRY_MS. */
type Saved = { sig: string; words: Record<string, PatternWords>; at: number; failed?: boolean };

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** The saved rewrite for exactly these findings, or null. */
export async function savedWords(patterns: readonly Pattern[]): Promise<Record<string, PatternWords> | null> {
  const s = await readJson<Saved>(WORDS_KEY);
  if (!s || s.sig !== patternSig(patterns)) return null;
  return s.failed && Date.now() - s.at > RETRY_MS ? null : s.words;
}

let inflight: Promise<Record<string, PatternWords>> | null = null;
let inflightSig = "";

/**
 * The findings in the Coach's words: the saved rewrite when the findings haven't changed, else one request to the
 * person's model (20 s at most). Findings the model got wrong keep the app's own words. Never throws.
 */
export async function patternWords(patterns: readonly Pattern[]): Promise<Record<string, PatternWords>> {
  if (!patterns.length) return {};
  const sig = patternSig(patterns);
  const saved = await savedWords(patterns);
  if (saved) return saved;
  if (inflight && inflightSig === sig) return inflight;
  inflightSig = sig;
  inflight = (async () => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20_000);
    try {
      const s = await coachSetup();
      const key = s.consent && s.provider && s.model ? await apiKey() : null;
      const model = key && s.provider && s.model ? modelFor(s.provider, s.model, key, deviceFetch) : null;
      if (!model) return {};
      const result = await generateText({
        model,
        instructions: PATTERN_INSTRUCTIONS,
        prompt: patternPrompt(patterns, s.instructions),
        // Thinking models count their reasoning here too.
        maxOutputTokens: 2000,
        maxRetries: 0,
        abortSignal: ctl.signal,
      });
      const words = parsePatternWords(result.text, patterns);
      await AsyncStorage.setItem(WORDS_KEY, JSON.stringify({ sig, words, at: Date.now() } satisfies Saved)).catch(() => {});
      return words;
    } catch (e) {
      await AsyncStorage.setItem(WORDS_KEY, JSON.stringify({ sig, words: {}, at: Date.now(), failed: true } satisfies Saved)).catch(() => {});
      console.warn("[patterns]", e instanceof Error ? e.name : "error");
      return {};
    } finally {
      clearTimeout(timer);
      inflight = null;
    }
  })();
  return inflight;
}

/** Keys dismissed and still inside their DISMISS_DAYS, with when each ends (unix seconds). */
export async function dismissedPatterns(now = Math.floor(Date.now() / 1000)): Promise<Record<string, number>> {
  const all = (await readJson<Record<string, number>>(DISMISSED_KEY)) ?? {};
  return Object.fromEntries(Object.entries(all).filter(([, until]) => until > now));
}

export async function dismissPattern(key: string, now = Math.floor(Date.now() / 1000)): Promise<void> {
  const next = { ...(await dismissedPatterns(now)), [key]: now + DISMISS_DAYS * 86_400 };
  await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(next)).catch(() => {});
}
