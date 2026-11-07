// Medicine reminders with Taken and Snooze on the notification; Taken logs the dose without opening Halo.
// Buttons run in expo-notifications' background task (task.ts) or, with Halo open, links.ts. No React: imported headless.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { localDay } from "@/lib/time";
import { logEntry } from "@/screens/journal/actions";
import { readMedicines, type MedSchedule } from "@/state/medicines";
import { backgroundStore } from "./runSync";
import { CHANNEL_ID, ensureChannel } from "./notify";

export const MED_CATEGORY = "pulse.med";
export const MED_TASK = "pulse.med.action";
const ID_PREFIX = "pulse.med.";
export const SNOOZE_MIN = 10;
const HANDLED_KEY = "halo.med.handled";

/** What a reminder carries, for its buttons. */
type MedData = { url: string; med: { id: string; name: string; dose: string } };

export const medLink = (name: string) => `pulse://journal?log=medicine&med=${encodeURIComponent(name)}`;

let category: Promise<void> | null = null;
/** The Taken / Snooze buttons. Neither opens Halo: the press is handled in the background. */
export function ensureMedCategory(): Promise<void> {
  category ??= Notifications.setNotificationCategoryAsync(MED_CATEGORY, [
    { identifier: "taken", buttonTitle: "Taken", options: { opensAppToForeground: false } },
    { identifier: "snooze", buttonTitle: `Snooze ${SNOOZE_MIN} min`, options: { opensAppToForeground: false } },
  ])
    .then(() => undefined)
    .catch(() => {
      category = null;
    });
  return category ?? Promise.resolve();
}

const contentOf = (m: Pick<MedSchedule, "id" | "name" | "dose">): Notifications.NotificationContentInput => ({
  title: `Time for ${m.name}`,
  body: m.dose ? `${m.dose}. Tap Taken to log it.` : "Tap Taken to log it.",
  data: { url: medLink(m.name), med: { id: m.id, name: m.name, dose: m.dose } } satisfies MedData,
  categoryIdentifier: MED_CATEGORY,
});

/** Replaces every scheduled reminder to match `list`: daily, or weekly on chosen days. Never throws; false on failure. */
export async function syncMedReminders(list?: MedSchedule[]): Promise<boolean> {
  try {
    const meds = list ?? (await readMedicines());
    await ensureChannel();
    await ensureMedCategory();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter((n) => n.identifier.startsWith(ID_PREFIX) && !n.identifier.startsWith(`${ID_PREFIX}snooze.`)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    for (const m of meds) {
      if (!m.remind) continue;
      for (const t of m.times) {
        const [hour, minute] = t.split(":").map(Number);
        if (!m.days.length) {
          await Notifications.scheduleNotificationAsync({
            identifier: `${ID_PREFIX}${m.id}.${t}`,
            content: contentOf(m),
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL_ID },
          });
          continue;
        }
        // expo's weekday runs 1 (Sunday) to 7 (Saturday).
        for (const d of m.days)
          await Notifications.scheduleNotificationAsync({
            identifier: `${ID_PREFIX}${m.id}.${t}.${d}`,
            content: contentOf(m),
            trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: d + 1, hour, minute, channelId: CHANNEL_ID },
          });
      }
    }
    return true;
  } catch (e) {
    console.warn("[med reminders]", e instanceof Error ? e.message : String(e));
    return false;
  }
}

/** Whether a press was handled already: Android may hand the same one to the task and to the open app. */
async function firstTime(key: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(HANDLED_KEY).catch(() => null);
  const seen: string[] = raw ? (JSON.parse(raw) as string[]) : [];
  if (seen.includes(key)) return false;
  await AsyncStorage.setItem(HANDLED_KEY, JSON.stringify([...seen.slice(-49), key])).catch(() => {});
  return true;
}

/** Taken logs the dose now and marks the day for rescoring; Snooze re-shows it in 10 minutes. True for a reminder button,
 *  so the caller doesn't also open its link. */
export async function handleMedResponse(r: Notifications.NotificationResponse): Promise<boolean> {
  const action = r.actionIdentifier;
  if (action !== "taken" && action !== "snooze") return false;
  const req = r.notification.request;
  const med = (req.content.data as Partial<MedData> | null)?.med;
  if (!med?.name) return false;
  if (!(await firstTime(`${req.identifier}@${r.notification.date}:${action}`))) return true;
  await Notifications.dismissNotificationAsync(req.identifier).catch(() => {});
  if (action === "snooze") {
    await ensureChannel();
    await ensureMedCategory();
    await Notifications.scheduleNotificationAsync({
      identifier: `${ID_PREFIX}snooze.${med.id}.${Date.now()}`,
      content: contentOf({ id: med.id, name: med.name, dose: med.dose ?? "" }),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: SNOOZE_MIN * 60, channelId: CHANNEL_ID },
    }).catch(() => {});
    return true;
  }
  try {
    const store = await backgroundStore();
    const profile = await store.getProfile();
    if (!profile) return true;
    const r2 = await logEntry({ store, profile, timeZone: profile.timeZone }, { kind: "medicine", name: med.name, dose: med.dose || undefined });
    // The day's behaviour answer changed: its scores rerun at the next sync, or when Halo next opens.
    if (r2.ok) await store.markIntradayDirty([localDay(Math.floor(Date.now() / 1000), profile.timeZone)]);
    afterTaken?.();
  } catch (e) {
    console.warn("[med reminders] taken", e instanceof Error ? e.message : String(e));
  }
  return true;
}

let afterTaken: (() => void) | null = null;
/** The open app: refresh the journal after a Taken press (the background has no screens to refresh). */
export function onMedTaken(fn: (() => void) | null): void {
  afterTaken = fn;
}
