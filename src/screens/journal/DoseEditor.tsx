// Editing a logged dose (or adding one with its time), inline: the medicine, its dose and when it was taken, then
// Save, and Delete for a logged one. The check-in shows it under a medicine's row; the journal's list, in a sheet.
import * as React from "react";
import { Pressable, View } from "react-native";
import { localDay } from "@/lib/time";
import type { Dose } from "@/queries/log";
import { useMedicines } from "@/state/medicines";
import { Txt } from "@/ui";
import { useCalm } from "@/ui/calm";
import { CalmButton, CalmInput } from "../settings/calmKit";
import { deleteLogEntry, editDose, logEntry, type ActionCtx } from "./actions";
import { wallNow } from "./forms";
import { TimeStepper } from "./TimeStepper";

/** Where a new dose's time starts: now on today, else the medicine's first scheduled time that day (or 08:00). */
export function defaultAt(day: string, name: string, timeZone: string, firstTime?: string): string {
  const now = wallNow(timeZone);
  if (now.startsWith(day)) return now;
  return `${day} ${firstTime ?? "08:00"}`;
}

export function DoseEditor({
  actx,
  dose,
  name: presetName,
  day,
  timeZone,
  onDone,
  onCancel,
}: {
  actx: ActionCtx | null;
  /** The logged dose to change; null to log a new one. */
  dose: Dose | null;
  /** A new dose's medicine. */
  name?: string;
  /** A new dose's day. */
  day: string;
  timeZone: string;
  /** After a save or delete: the day(s) it touched. */
  onDone: (days: string[]) => void;
  onCancel: () => void;
}) {
  const c = useCalm();
  const schedules = useMedicines();
  const plan = schedules.find((m) => m.name.toLowerCase() === (dose?.name ?? presetName ?? "").toLowerCase());
  const [name, setName] = React.useState(dose?.name ?? presetName ?? "");
  const [amount, setAmount] = React.useState(dose?.dose ?? plan?.dose ?? "");
  const [at, setAt] = React.useState(() => (dose ? wallNow(timeZone, dose.ts) : defaultAt(day, name, timeZone, plan?.times[0])));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    if (!actx || busy) return;
    if (!name.trim()) return setError("Enter the medicine’s name.");
    setBusy(true);
    setError(null);
    // The actions' wall-clock form: "YYYY-MM-DDTHH:mm".
    const input = { name: name.trim(), dose: amount.trim() || undefined, at: at.replace(" ", "T") };
    const r = dose ? await editDose(actx, { id: dose.id, ts: dose.ts, ...input }) : await logEntry(actx, { kind: "medicine", ...input });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onDone([...new Set([day, at.slice(0, 10), dose ? localDay(dose.ts, timeZone) : day])]);
  };
  const remove = async () => {
    if (!actx || !dose || busy) return;
    setBusy(true);
    const r = await deleteLogEntry(actx, { id: dose.id });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onDone([localDay(dose.ts, timeZone)]);
  };

  return (
    <View style={{ gap: 12 }}>
      {!presetName && <CalmInput value={name} onChangeText={setName} placeholder="Medicine" autoCapitalize="words" maxLength={32} accessibilityLabel="Medicine" on="card" />}
      <CalmInput value={amount} onChangeText={setAmount} placeholder="Dose, e.g. 3 mg (optional)" maxLength={40} accessibilityLabel="Dose" on="card" />
      <TimeStepper value={at} onChange={setAt} timeZone={timeZone} label="Taken" />
      {error && (
        <Txt size={13} lineHeight={18} style={{ color: c.system.red }}>
          {error}
        </Txt>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {dose && (
          <Pressable onPress={() => void remove()} disabled={busy} accessibilityRole="button" accessibilityLabel="Delete this dose" hitSlop={6} style={({ pressed }) => ({ paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}>
            <Txt size={16} lineHeight={21} style={{ color: c.system.red }}>
              Delete
            </Txt>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        <CalmButton variant="secondary" size="md" onPress={onCancel} disabled={busy}>
          Cancel
        </CalmButton>
        <CalmButton size="md" onPress={() => void save()} disabled={busy || !actx}>
          {busy ? "Saving…" : "Save"}
        </CalmButton>
      </View>
    </View>
  );
}
