// Settings › Medicines `/settings?s=medicines`: each medicine's dose, times and days, and its reminders (Taken and
// Snooze right on the notification, src/background/medReminders.ts). The doses themselves live in the journal.
import * as React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BellRing, Minus, Pill, Plus, X } from "lucide-react-native";
import { askNotificationPermission } from "@/background/notify";
import { syncMedReminders } from "@/background/medReminders";
import { newMedId, removeMedicine, saveMedicine, scheduleText, useMedicines, type MedSchedule } from "@/state/medicines";
import { BottomSheet, SheetSection, Txt } from "@/ui";
import { AlertDialog } from "@/ui/components/Alert";
import { useCalm } from "@/ui/calm";
import { haptic } from "@/ui/motion/haptics";
import { CalmChip, CalmInput } from "./calmKit";
import { ButtonRow, InsetGroup, NavRow, SwitchRow } from "./list";
import { toast } from "./toast";

const STEP_MIN = 15;
const MAX_TIMES = 6;
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => {
  const v = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};

/** Reminders need notifications allowed; asks once, then puts the whole schedule on the system's. */
async function applyReminders(list: MedSchedule[]): Promise<void> {
  if (list.some((m) => m.remind && m.times.length) && (await askNotificationPermission()) !== "granted") {
    toast("Allow notifications for Halo to get reminders.");
    return;
  }
  if (!(await syncMedReminders(list))) toast("Couldn’t set the reminders. Try again.");
}

export function MedicinesSection() {
  const meds = useMedicines();
  const [editing, setEditing] = React.useState<MedSchedule | null>(null);
  const [open, setOpen] = React.useState(false);
  const edit = (m: MedSchedule | null) => {
    setEditing(m ?? { id: newMedId(), name: "", dose: "", times: ["08:00"], days: [], remind: true });
    setOpen(true);
  };
  return (
    <>
      <InsetGroup footer="Each medicine’s reminder has Taken and Snooze right on the notification. Taken logs the dose in your journal at that moment, without opening Halo, so Insights can learn from when you took it, not only whether.">
        {meds.map((m) => (
          <NavRow key={m.id} icon={m.remind && m.times.length ? BellRing : Pill} system={m.remind && m.times.length ? "orange" : "green"} label={m.name} description={[m.dose, scheduleText(m)].filter(Boolean).join(" · ")} onPress={() => edit(m)} />
        ))}
        <ButtonRow label="Add a medicine" onPress={() => edit(null)} />
      </InsetGroup>
      {editing && <MedicineSheet key={editing.id} med={editing} isNew={!meds.some((m) => m.id === editing.id)} open={open} onClose={() => setOpen(false)} />}
    </>
  );
}

/** A time of day with − and + either side (15 minutes a step), and a remove button. */
function TimeRow({ time, onChange, onRemove, removable }: { time: string; onChange: (t: string) => void; onRemove: () => void; removable: boolean }) {
  const c = useCalm();
  const step = (d: number) => {
    haptic.select();
    onChange(toTime(toMin(time) + d));
  };
  const round = (icon: typeof Plus, label: string, onPress: () => void) => {
    const Icon = icon;
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: c.fill, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
        <Icon size={18} color={c.teal} strokeWidth={2.6} />
      </Pressable>
    );
  };
  return (
    <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
      {round(Minus, `${time}, 15 minutes earlier`, () => step(-STEP_MIN))}
      <Txt size={20} lineHeight={25} weight={600} align="center" style={{ color: c.ink, minWidth: 72, fontVariant: ["tabular-nums"] }}>
        {time}
      </Txt>
      {round(Plus, `${time}, 15 minutes later`, () => step(STEP_MIN))}
      <View style={{ flex: 1 }} />
      {removable && (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${time}`} hitSlop={8} style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}>
          <X size={20} color={c.tertiary} strokeWidth={2.4} />
        </Pressable>
      )}
    </View>
  );
}

function MedicineSheet({ med, isNew, open, onClose }: { med: MedSchedule; isNew: boolean; open: boolean; onClose: () => void }) {
  const c = useCalm();
  const [m, setM] = React.useState(med);
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const patch = (p: Partial<MedSchedule>) => setM((x) => ({ ...x, ...p }));
  const rule = <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />;

  const save = async () => {
    if (!m.name.trim()) return toast("Enter the medicine’s name.");
    setBusy(true);
    try {
      const list = await saveMedicine({ ...m, times: [...new Set(m.times)].sort() });
      await applyReminders(list);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setConfirm(false);
    const list = await removeMedicine(m.id);
    await syncMedReminders(list);
    onClose();
  };
  const toggleDay = (d: number) => {
    const all = m.days.length ? m.days : [0, 1, 2, 3, 4, 5, 6];
    const next = all.includes(d) ? all.filter((x) => x !== d) : [...all, d].sort();
    if (!next.length) return;
    patch({ days: next.length === 7 ? [] : next });
  };
  const addTime = () => {
    const last = m.times.length ? toMin(m.times[m.times.length - 1]) : 8 * 60 - 12 * 60;
    patch({ times: [...m.times, toTime(last + 12 * 60)].slice(0, MAX_TIMES) });
  };

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={isNew ? "Add a medicine" : m.name || "Medicine"} size="tall" done={{ label: "Save", onPress: () => void save(), disabled: busy || !m.name.trim() }}>
        <View style={{ gap: 18 }}>
          <View style={{ gap: 8 }}>
            <SheetSection>MEDICINE</SheetSection>
            <View style={{ borderRadius: 14, backgroundColor: c.sheetFill, paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
              <CalmInput value={m.name} onChangeText={(t) => patch({ name: t })} placeholder="Name, e.g. Melatonin" autoCapitalize="words" maxLength={32} accessibilityLabel="Name" on="card" />
              <CalmInput value={m.dose} onChangeText={(t) => patch({ dose: t })} placeholder="Dose, e.g. 3 mg" maxLength={40} accessibilityLabel="Dose" on="card" />
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <SheetSection>TIMES</SheetSection>
            <View style={{ borderRadius: 14, backgroundColor: c.sheetFill, paddingHorizontal: 16 }}>
              {m.times.map((t, i) => (
                <React.Fragment key={`${i}`}>
                  {i > 0 && rule}
                  <TimeRow time={t} removable onChange={(v) => patch({ times: m.times.map((x, k) => (k === i ? v : x)) })} onRemove={() => patch({ times: m.times.filter((_, k) => k !== i) })} />
                </React.Fragment>
              ))}
              {m.times.length > 0 && rule}
              {m.times.length < MAX_TIMES && (
                <Pressable onPress={addTime} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 48, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
                  <Txt size={16} lineHeight={21} style={{ color: c.teal }}>
                    {m.times.length ? "Add another time" : "Add a time"}
                  </Txt>
                </Pressable>
              )}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <SheetSection>DAYS</SheetSection>
            <View accessibilityRole="none" style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {DAYS.map((d, i) => (
                <CalmChip key={i} label={d} role="checkbox" selected={!m.days.length || m.days.includes(i)} onPress={() => toggleDay(i)} accessibilityLabel={DAY_NAMES[i]} />
              ))}
            </View>
            <Txt size={13} lineHeight={18} style={{ color: c.sub, paddingHorizontal: 4 }}>
              {scheduleText(m)}
            </Txt>
          </View>
          <View style={{ borderRadius: 14, overflow: "hidden" }}>
            <SwitchRow icon={BellRing} system="orange" label="Remind me" description={m.times.length ? "With Taken and Snooze on the notification" : "Add a time first"} value={m.remind && m.times.length > 0} disabled={!m.times.length} onChange={(v) => patch({ remind: v })} />
          </View>
          {!isNew && (
            <View style={{ borderRadius: 14, overflow: "hidden" }}>
              <ButtonRow label="Delete medicine" danger onPress={() => setConfirm(true)} />
            </View>
          )}
        </View>
      </BottomSheet>
      <AlertDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete ${m.name}?`}
        message="Its reminders stop. Doses already logged stay in your journal."
        actions={[
          { label: "Cancel", style: "cancel", onPress: () => setConfirm(false) },
          { label: "Delete", style: "destructive", onPress: () => void remove() },
        ]}
      />
    </>
  );
}
