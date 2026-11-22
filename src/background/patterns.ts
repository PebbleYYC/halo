// After a scoring run, when the Coach is set up: the Coach's daily look for patterns (src/coach/discover.ts), so Home
// has them when it opens, and, with Settings › Notifications' "Patterns" on, a new one sent as a notification: at most
// one a week, in the day (09:00–20:00), never one already sent or dismissed. Never throws.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { coachReady, discover, dismissedFindings, savedFindings } from "@/coach/discover";
import type { Store } from "@/data/store";
import type { Profile } from "@/data/types";
import { localDay, localMinutes } from "@/lib/time";
import type { QueryCtx } from "@/queries/ctx";
import { isOwnData } from "./decide";
import { readSource } from "./alerts";
import { notificationPermission, sendNow } from "./notify";
import { patternDue, type Sent } from "./patternDue";
import { readSettings } from "./settings";

const SENT_KEY = "pulse.patterns.sent";

/** `look`: run the Coach's look (the app only: a long AI call, with no timer to cut it short in a headless task, must
 *  never run there). Without it, only what the last look saved is considered for the notification. */
export async function patternsAfterRun(store: Store, profile: Profile, timeZone: string, look: boolean): Promise<void> {
  try {
    if (!(await coachReady())) return;
    const now = Math.floor(Date.now() / 1000);
    const ctx: QueryCtx = { store, profile, timeZone, today: localDay(now, timeZone), now, sync: await store.getSyncState() };
    const saved = look ? await discover(ctx) : await savedFindings();
    if (!saved?.findings.length || saved.day !== ctx.today || saved.failedAt != null) return;
    const settings = await readSettings();
    if (!settings.patterns || !isOwnData(await readSource()) || (await notificationPermission()) !== "granted") return;
    let sent: Sent = { at: 0, keys: [] };
    try {
      const raw = await AsyncStorage.getItem(SENT_KEY);
      if (raw) sent = { ...sent, ...(JSON.parse(raw) as Partial<Sent>) };
    } catch {}
    const f = patternDue({ patterns: saved.findings, sent, dismissed: await dismissedFindings(now), now, minuteOfDay: localMinutes(now, timeZone) });
    if (!f) return;
    if (await sendNow({ title: f.title, body: f.body, url: `pulse://${f.href.replace(/^\//, "")}` })) {
      await AsyncStorage.setItem(SENT_KEY, JSON.stringify({ at: now, keys: [...sent.keys, f.key].slice(-50) } satisfies Sent)).catch(() => {});
    }
  } catch (e) {
    console.warn("[patterns]", e instanceof Error ? e.message : String(e));
  }
}
