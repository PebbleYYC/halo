// Medicine reminders with Taken and Snooze on the notification; Taken logs the dose without opening Halo.
// Buttons run in expo-notifications' background task (task.ts) or, with Halo open, links.ts. No React: imported headless.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { localDay } from "@/lib/time";
import { logEntry } from "@/screens/journal/actions";
import { medicineTag } from "@/lib/medicine";
import { readMedicines, type MedSchedule } from "@/state/medicines";
import { backgroundStore } from "./runSync";
import { CHANNEL_ID, ensureChannel } from "./notify";

export const MED_CATEGORY = "pulse.med";
export const MED_TASK = "pulse.med.action";
const ID_PREFIX = "pulse.med.";
export const SNOOZE_MIN = 10;
const HANDLED_KEY = "halo.med.handled";
const THROUGH_KEY = "halo.med.scheduledThrough";
/** Reminders are set one by one this many days ahead, so one can be skipped; topped up as the days pass. */
const HORIZON_DAYS = 10;
/** A dose logged up to this long before a reminder's time answers it: that reminder doesn't fire. */
export const COVER_S = 3 * 3600;

/** What a reminder carries, for its buttons. */
type MedData = { url: string; med: { id: string; name: string; dose: string }; /** When it fires, ms. */ at?: number };

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

const contentOf = (m: Pick<MedSchedule, "id" | "name" | "dose">, at?: number): Notifications.NotificationContentInput => ({
  title: `Time for ${m.name}`,
  body: m.dose ? `${m.dose}. Tap Taken to log it.` : "Tap Taken to log it.",
  data: { url: medLink(m.name), med: { id: m.id, name: m.name, dose: m.dose }, ...(at != null && { at }) } satisfies MedData,
  categoryIdentifier: MED_CATEGORY,
});

/**
 * A dose was logged (from anywhere: a stack, the sheet, Log anything, the Coach) at `ts` (seconds): its reminder showing
 * in the shade goes, so does a snooze still waiting, and so does the next reminder if it is due within three hours of
 * the dose. Matched by the medicine's name. Never throws.
 */
export async function clearMedReminder(name: string, ts = Math.floor(Date.now() / 1000)): Promise<void> {
  const key = medicineTag(name);
  const dataOf = (data: unknown) => data as Partial<MedData> | undefined;
  const isIt = (data: unknown) => medicineTag(String(dataOf(data)?.med?.name ?? "")) === key;
  const covered = (data: unknown) => {
    const at = dataOf(data)?.at;
    return typeof at === "number" && at > Date.now() && at >= ts * 1000 && at - ts * 1000 <= COVER_S * 1000;
  };
  try {
    const [shown, waiting] = await Promise.all([Notifications.getPresentedNotificationsAsync(), Notifications.getAllScheduledNotificationsAsync()]);
    await Promise.all([
      ...shown.filter((n) => n.request.identifier.startsWith(ID_PREFIX) && isIt(n.request.content.data)).map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
      ...waiting
        .filter((n) => n.identifier.startsWith(ID_PREFIX) && isIt(n.content.data) && (n.identifier.startsWith(`${ID_PREFIX}snooze.`) || covered(n.content.data)))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    ]);
  } catch {
    // Best effort: the reminder stays until swiped.
  }
}

/** Each reminder in the next `days` days, as its medicine, time and fire time (ms, device clock), after `now`. */
export function reminderSlots(meds: readonly MedSchedule[], now: Date, days = HORIZON_DAYS): { m: MedSchedule; t: string; at: Date; day: string }[] {
  const out: { m: MedSchedule; t: string; at: Date; day: string }[] = [];
  for (let k = 0; k < days; k++) {
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
    const day = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
    for (const m of meds) {
      if (!m.remind || (m.days.length && !m.days.includes(base.getDay()))) continue;
      for (const t of m.times) {
        const [hour, minute] = t.split(":").map(Number);
        const at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute);
        if (at.getTime() > now.getTime()) out.push({ m, t, at, day });
      }
    }
  }
  return out;
}

/** Whether a dose of `name` logged at one of `doses` (seconds) answers a reminder at `atMs`: within three hours before it. */
export function coveredBy(doses: readonly { name: string; ts: number }[], name: string, atMs: number): boolean {
  const tag = medicineTag(name);
  return doses.some((d) => medicineTag(d.name) === tag && d.ts * 1000 <= atMs && atMs - d.ts * 1000 <= COVER_S * 1000);
}

/** Doses logged in the last three hours, which may answer the next reminders. */
async function recentDoses(): Promise<{ name: string; ts: number }[]> {
  try {
    const store = await backgroundStore();
    const rows = await store.loggedEntries(Math.floor(Date.now() / 1000) - COVER_S, 500);
    return rows.filter((r) => r.type === "medication").map((r) => ({ name: String((r.data as { name?: unknown }).name ?? ""), ts: r.ts }));
  } catch {
    return [];
  }
}

/** Sets the next days' reminders again once fewer than five are left ahead. Cheap otherwise; never throws. */
export async function topUpMedReminders(): Promise<void> {
  const through = await AsyncStorage.getItem(THROUGH_KEY).catch(() => null);
  if (through && Number(through) - Date.now() > 5 * 86_400_000) return;
  await syncMedReminders();
}

/**
 * Replaces every scheduled reminder to match `list`: each one set on its own for the next ten days (daily, or on the
 * chosen weekdays), so a dose logged up to three hours early skips it. Never throws; false on failure.
 */
export async function syncMedReminders(list?: MedSchedule[]): Promise<boolean> {
  try {
    const meds = list ?? (await readMedicines());
    await ensureChannel();
    await ensureMedCategory();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    // A snooze outlives this resync only while its medicine still reminds: deleting the medicine, or turning its
    // reminder off, used to leave "Time for X" to arrive ten minutes later anyway.
    const reminding = meds.filter((m) => m.remind).map((m) => `${ID_PREFIX}snooze.${m.id}`);
    const keep = (id: string) => id.startsWith(`${ID_PREFIX}snooze.`) && reminding.some((p) => id === p || id.startsWith(`${p}.`));
    await Promise.all(scheduled.filter((n) => n.identifier.startsWith(ID_PREFIX) && !keep(n.identifier)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    const now = new Date();
    const doses = await recentDoses();
    for (const s of reminderSlots(meds, now)) {
      if (coveredBy(doses, s.m.name, s.at.getTime())) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}${s.m.id}.${s.t}.${s.day}`,
        content: contentOf(s.m, s.at.getTime()),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: s.at, channelId: CHANNEL_ID },
      });
    }
    await AsyncStorage.setItem(THROUGH_KEY, String(now.getTime() + HORIZON_DAYS * 86_400_000)).catch(() => {});
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
