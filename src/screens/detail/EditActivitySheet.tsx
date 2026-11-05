// Edit an activity (mobile), as Fitbit's exercise editor: the exercise type from Fitbit's list, its name, when it
// started and how long it lasted, and delete. Edits are kept on this phone apart from what Health Connect sends
// (src/data/exerciseEdits.ts), so a sync never undoes them; "Use Fitbit's version" drops them. Saving rescores the
// day (or both days, when the start moves across midnight).
import * as React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check, ChevronRight, Minus, Plus } from "lucide-react-native";
import { FITBIT_EXERCISES, typeLabel } from "@/lib/activityTypes";
import { clock, hmm } from "@/lib/format";
import { localDay } from "@/lib/time";
import type { ActivityVM } from "@/queries";
import { useApp, useQueryCtx } from "@/state/app";
import { BottomSheet, SheetSection, Txt } from "@/ui";
import { AlertDialog } from "@/ui/components/Alert";
import { useCalm } from "@/ui/calm";
import { haptic } from "@/ui/motion/haptics";
import { CalmInput } from "@/screens/settings/calmKit";
import { useNow } from "@/screens/home/status";

const STEP_S = 5 * 60;
const MIN_LEN_S = 5 * 60;

/** A round − or + beside a value, iOS's stepper halves. */
function StepButton({ icon: Icon, label, disabled, onPress }: { icon: typeof Plus; label: string; disabled?: boolean; onPress: () => void }) {
  const c = useCalm();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: c.fill, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}
    >
      <Icon size={18} color={c.teal} strokeWidth={2.6} />
    </Pressable>
  );
}

/** A labelled value with − and + either side, 5 minutes a step. */
function StepRow({ label, value, spoken, onMinus, onPlus, minusDisabled, plusDisabled }: { label: string; value: string; spoken: string; onMinus: () => void; onPlus: () => void; minusDisabled?: boolean; plusDisabled?: boolean }) {
  const c = useCalm();
  return (
    <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
      <Txt size={16} lineHeight={21} style={{ color: c.ink, flex: 1 }}>
        {label}
      </Txt>
      <StepButton icon={Minus} label={`${label} 5 minutes earlier or shorter`} disabled={minusDisabled} onPress={onMinus} />
      <Txt size={17} lineHeight={22} weight={600} align="center" accessibilityLabel={spoken} style={{ color: c.ink, minWidth: 64, fontVariant: ["tabular-nums"] }}>
        {value}
      </Txt>
      <StepButton icon={Plus} label={`${label} 5 minutes later or longer`} disabled={plusDisabled} onPress={onPlus} />
    </View>
  );
}

const Rule = () => {
  const c = useCalm();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />;
};

export function EditActivitySheet({ vm, open, onClose, onDeleted }: { vm: ActivityVM; open: boolean; onClose: () => void; onDeleted: () => void }) {
  const c = useCalm();
  const app = useApp();
  const ctx = useQueryCtx();
  const nowS = Math.floor(useNow() / 1000);
  const [type, setType] = React.useState(vm.edit.type);
  const [name, setName] = React.useState(vm.edit.name ?? "");
  const [start, setStart] = React.useState(vm.edit.startTs);
  const [length, setLength] = React.useState(vm.edit.endTs - vm.edit.startTs);
  const [picking, setPicking] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Each opening starts from the activity as it stands (reset while rendering, React's pattern for state that follows a prop).
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setType(vm.edit.type);
      setName(vm.edit.name ?? "");
      setStart(vm.edit.startTs);
      setLength(vm.edit.endTs - vm.edit.startTs);
      setPicking(false);
    }
  }

  const tz = app.timeZone;
  const days = (to: string) => [...new Set([vm.day, to])];
  // The new numbers go to the scores: the days the activity sat on and now sits on rerun, then everything re-reads.
  const rescore = async (to: string) => {
    if (!ctx) return;
    await ctx.store.markIntradayDirty(days(to));
    void app.refresh();
  };

  const save = async () => {
    if (!ctx || busy) return;
    setBusy(true);
    try {
      const day = localDay(start, tz);
      await ctx.store.setExerciseEdit({ id: vm.id, type, name: name.trim() || null, startTs: start, endTs: start + length, day, deleted: false });
      await rescore(day);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const restore = async () => {
    if (!ctx || busy) return;
    setBusy(true);
    try {
      await ctx.store.clearExerciseEdit(vm.id);
      await rescore(vm.edit.imported ? localDay(vm.edit.imported.startTs, tz) : vm.day);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!ctx) return;
    setConfirmDelete(false);
    await ctx.store.setExerciseEdit({ id: vm.id, type: null, name: null, startTs: null, endTs: null, day: null, deleted: true });
    await rescore(vm.day);
    onClose();
    onDeleted();
  };

  const shownName = name.trim() || typeLabel(type);

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={picking ? "Exercise type" : "Edit activity"}
        size={picking ? "tall" : "default"}
        done={picking ? { label: "Back", onPress: () => setPicking(false) } : { label: "Save", onPress: () => void save(), disabled: busy || !ctx }}
      >
        {picking ? (
          <View style={{ borderRadius: 14, backgroundColor: c.sheetFill, paddingHorizontal: 16 }}>
            {FITBIT_EXERCISES.map((x, i) => (
              <React.Fragment key={x.type}>
                {i > 0 && <Rule />}
                <Pressable
                  onPress={() => {
                    haptic.select();
                    // A name that only repeated the old type follows the new one.
                    if (!name.trim() || name.trim() === typeLabel(type) || name.trim() === vm.edit.imported?.name) setName("");
                    setType(x.type);
                    setPicking(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: x.type === type }}
                  style={({ pressed }) => ({ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", opacity: pressed ? 0.6 : 1 })}
                >
                  <Txt size={16} lineHeight={21} style={{ color: c.ink }}>
                    {x.label}
                  </Txt>
                  {x.type === type && <Check size={20} color={c.teal} strokeWidth={2.6} />}
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <View style={{ gap: 8 }}>
              <SheetSection>EXERCISE</SheetSection>
              <View style={{ borderRadius: 14, backgroundColor: c.sheetFill, paddingHorizontal: 16 }}>
                <Pressable
                  onPress={() => setPicking(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Exercise type: ${typeLabel(type)}. Change`}
                  style={({ pressed }) => ({ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.6 : 1 })}
                >
                  <Txt size={16} lineHeight={21} style={{ color: c.ink, flex: 1 }}>
                    Type
                  </Txt>
                  <Txt size={16} lineHeight={21} style={{ color: c.sub }}>
                    {typeLabel(type)}
                  </Txt>
                  <ChevronRight size={18} color={c.tertiary} strokeWidth={2.4} />
                </Pressable>
                <Rule />
                <View style={{ paddingVertical: 8 }}>
                  <CalmInput value={name} onChangeText={setName} placeholder={typeLabel(type)} accessibilityLabel="Name" autoCapitalize="sentences" maxLength={60} on="card" />
                </View>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <SheetSection>TIME</SheetSection>
              <View style={{ borderRadius: 14, backgroundColor: c.sheetFill, paddingHorizontal: 16 }}>
                <StepRow
                  label="Start"
                  value={clock(start * 1000, tz)}
                  spoken={`Starts ${clock(start * 1000, tz)}`}
                  onMinus={() => setStart((s) => s - STEP_S)}
                  onPlus={() => setStart((s) => s + STEP_S)}
                  plusDisabled={start + STEP_S + length > nowS}
                />
                <Rule />
                <StepRow
                  label="Duration"
                  value={hmm(length / 60)}
                  spoken={`Lasts ${Math.round(length / 60)} minutes`}
                  onMinus={() => setLength((l) => l - STEP_S)}
                  onPlus={() => setLength((l) => l + STEP_S)}
                  minusDisabled={length - STEP_S < MIN_LEN_S}
                  plusDisabled={start + length + STEP_S > nowS}
                />
              </View>
              <Txt size={13} lineHeight={18} style={{ color: c.sub, paddingHorizontal: 4 }}>
                {`${shownName}, ${clock(start * 1000, tz)} to ${clock((start + length) * 1000, tz)}. Saving rescores the day.`}
              </Txt>
            </View>
            <View style={{ borderRadius: 14, backgroundColor: c.sheetFill, paddingHorizontal: 16 }}>
              {vm.edit.edited && vm.edit.imported && (
                <>
                  <Pressable onPress={() => void restore()} disabled={busy} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 48, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
                    <Txt size={16} lineHeight={21} style={{ color: c.teal }}>
                      {`Use Fitbit’s version (${typeLabel(vm.edit.imported.type)}, ${clock(vm.edit.imported.startTs * 1000, tz)})`}
                    </Txt>
                  </Pressable>
                  <Rule />
                </>
              )}
              <Pressable onPress={() => setConfirmDelete(true)} disabled={busy} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 48, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
                <Txt size={16} lineHeight={21} style={{ color: c.system.red }}>
                  Delete activity
                </Txt>
              </Pressable>
            </View>
          </View>
        )}
      </BottomSheet>
      <AlertDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this activity?"
        message="It leaves your scores, lists and charts on this phone. Fitbit keeps its copy."
        actions={[
          { label: "Cancel", style: "cancel", onPress: () => setConfirmDelete(false) },
          { label: "Delete", style: "destructive", onPress: () => void remove() },
        ]}
      />
    </>
  );
}
