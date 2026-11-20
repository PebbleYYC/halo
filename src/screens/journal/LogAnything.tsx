// "Log anything": one line typed the way you'd say it, read into entries as you type (src/lib/logParse.ts) and shown
// before anything is saved, each with its time and a way to drop it. What the rules can't place is offered to the
// Coach when it's set up (src/coach/logAnything.ts), or as a new behaviour of your own; food goes on to Halo's food
// estimate; workouts are noted as coming from the band. "Add" saves everything shown.
import * as React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { CalendarCheck, Droplet, HeartPulse, Pill, Scale, Smile, Thermometer, Utensils, Watch, X, type LucideIcon } from "lucide-react-native";
import { coachParse } from "@/coach/logAnything";
import { useHasCoachKey } from "@/coach/session";
import { parseLog, type ParseCtx, type Parsed } from "@/lib/logParse";
import { weightText, type Units } from "@/lib/units";
import { MOODS, SEVERITIES, SYMPTOMS } from "@/queries/log";
import { tagRows } from "@/queries/journal";
import { useQuery } from "@/state/app";
import { useMedicines } from "@/state/medicines";
import { useUnits } from "@/state/units";
import { BottomSheet, Txt } from "@/ui";
import { IconTile, LIST_RADIUS, Sentence, useCalm, type CalmTint } from "../settings/calmKit";
import { addCustomTag, logEntry, saveJournalEntry, type ActionCtx } from "./actions";
import { useActionCtx } from "./AddBehaviour";
import { TextField, toast } from "./controls";
import { bumpJournal } from "./state";

const LOOK: Record<Parsed["kind"], { icon: LucideIcon; tint: CalmTint }> = {
  water: { icon: Droplet, tint: "sky" },
  medicine: { icon: Pill, tint: "mint" },
  weight: { icon: Scale, tint: "sand" },
  spo2: { icon: HeartPulse, tint: "rose" },
  symptoms: { icon: Thermometer, tint: "peach" },
  mood: { icon: Smile, tint: "lavender" },
  behaviour: { icon: CalendarCheck, tint: "lavender" },
  food: { icon: Utensils, tint: "sand" },
  workout: { icon: Watch, tint: "peach" },
  unknown: { icon: CalendarCheck, tint: "sky" },
};

const label = (list: readonly (readonly [string, string, ...unknown[]])[], v: string) => list.find((x) => x[0] === v)?.[1] ?? v;
const clock = (at: string) => at.slice(11, 16);

/** A row's words: what it is, and its amount or detail. */
function describe(p: Parsed, units: Units, today: string): { title: string; detail: string } {
  const day = (d: string) => (d === today ? "" : " · yesterday");
  switch (p.kind) {
    case "water":
      return { title: "Water", detail: `${units.fluid === "ml" ? `${p.ml} ml` : `${Math.round(p.ml / 29.5735)} fl oz`} · ${clock(p.at)}` };
    case "medicine":
      return { title: p.name, detail: `${p.dose ? `${p.dose} · ` : ""}${clock(p.at)}${p.at.slice(0, 10) === today ? "" : " yesterday"}` };
    case "weight":
      return { title: "Weight", detail: `${units.weight === "kg" ? `${p.kg} kg` : weightText(p.kg, units)} · ${clock(p.at)}` };
    case "spo2":
      return { title: "Blood oxygen", detail: `${p.pct}% · ${clock(p.at)}` };
    case "symptoms":
      return { title: "Symptoms", detail: `${p.symptoms.map((s) => (s === "HEADACHE" && p.headache ? `${label(SEVERITIES, p.headache)} headache` : label(SYMPTOMS, s))).join(", ")} · ${clock(p.at)}${day(p.at.slice(0, 10))}` };
    case "mood":
      return { title: "Mood", detail: `${p.moods.map((m) => label(MOODS, m)).join(", ")} · ${clock(p.at)}` };
    case "behaviour":
      return { title: p.label, detail: `${p.tag === "alcohol" ? `${p.value} ${p.value === 1 ? "drink" : "drinks"}` : "Yes"}${p.day === today ? " today" : day(p.day)}` };
    case "food":
      return { title: p.text.charAt(0).toUpperCase() + p.text.slice(1), detail: "Food · estimated next" };
    case "workout":
      return { title: p.text.charAt(0).toUpperCase() + p.text.slice(1), detail: "Workouts come from your band" };
    case "unknown":
      return { title: `“${p.text}”`, detail: "Not sure what to log" };
  }
}

/** Saves one row; false if it failed. */
async function save(actx: ActionCtx, p: Parsed): Promise<boolean> {
  const r =
    p.kind === "water"
      ? await logEntry(actx, { kind: "water", ml: p.ml, at: p.at })
      : p.kind === "medicine"
        ? await logEntry(actx, { kind: "medicine", name: p.name, dose: p.dose, at: p.at })
        : p.kind === "weight"
          ? await logEntry(actx, { kind: "weight", kg: p.kg, fatPct: null, at: p.at })
          : p.kind === "spo2"
            ? await logEntry(actx, { kind: "spo2", pct: p.pct, at: p.at })
            : p.kind === "symptoms"
              ? await logEntry(actx, { kind: "symptoms", symptoms: p.symptoms, headache: p.headache, at: p.at })
              : p.kind === "mood"
                ? await logEntry(actx, { kind: "mood", moods: p.moods, valence: null, at: p.at })
                : p.kind === "behaviour"
                  ? await saveJournalEntry(actx, { day: p.day, tag: p.tag, value: p.tag === "alcohol" ? p.value : true })
                  : { ok: true as const };
  return r.ok;
}

export function LogAnythingSheet({ open, onClose, timeZone, today, known, onFood, onSaved }: {
  open: boolean;
  onClose: () => void;
  timeZone: string;
  today: string;
  /** Medicines logged before (the Medicine sheet's quick picks). */
  known: string[];
  /** A food row, handed to the food sheet after the rest is saved. */
  onFood: (text: string, at: string) => void;
  onSaved: (kinds: Parsed["kind"][]) => void;
}) {
  const c = useCalm();
  const actx = useActionCtx();
  const { units } = useUnits();
  const coach = useHasCoachKey();
  const schedules = useMedicines();
  const tags = useQuery((ctx) => tagRows(ctx.store), [open]).data;
  const [text, setText] = React.useState("");
  const textRef = React.useRef(text);
  React.useLayoutEffect(() => {
    textRef.current = text;
  });
  const [rows, setRows] = React.useState<Parsed[]>([]);
  const [dropped, setDropped] = React.useState<number[]>([]);
  const [asking, setAsking] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // A fresh line each opening.
  const [was, setWas] = React.useState(open);
  if (was !== open) {
    setWas(open);
    if (open) {
      setText("");
      setRows([]);
      setDropped([]);
    }
  }

  const pctx = React.useCallback((): ParseCtx => {
    const meds = [...schedules.map((m) => ({ name: m.name, dose: m.dose || undefined })), ...known.filter((k) => !schedules.some((m) => m.name.toLowerCase() === k.toLowerCase())).map((name) => ({ name }))];
    return { now: Math.floor(Date.now() / 1000), timeZone, medicines: meds, tags: (tags ?? []).filter((t) => !t.hidden).map((t) => ({ tag: t.tag, label: t.label })), weightUnit: units.weight === "kg" ? "kg" : "lb" };
  }, [schedules, known, tags, timeZone, units.weight]);

  const change = (t: string) => {
    setText(t);
    setDropped([]);
    setRows(t.trim().length >= 2 ? parseLog(t, pctx()) : []);
  };
  // The behaviours arrive after the sheet opens: what was typed meanwhile is read again with them.
  const [readWith, setReadWith] = React.useState(tags);
  if (readWith !== tags) {
    setReadWith(tags);
    if (text.trim().length >= 2) setRows(parseLog(text, pctx()));
  }

  // The Coach reads what the rules couldn't place, on the keyboard's Done.
  const unknowns = rows.filter((r): r is Extract<Parsed, { kind: "unknown" }> => r.kind === "unknown");
  const ask = async () => {
    if (!coach || !unknowns.length || asking) return;
    setAsking(true);
    const asked = text;
    const got = await coachParse(unknowns.map((u) => u.text).join(", "), pctx());
    setAsking(false);
    // Typed on meanwhile: the answer is for a line that's gone.
    if (textRef.current !== asked) return;
    if (!got.length) return toast("Your Coach couldn’t place that either");
    // Rows move: what was removed is kept removed by what it was, not where it was.
    setRows((rs) => [...rs.filter((r, i) => r.kind !== "unknown" && !dropped.includes(i)), ...got]);
    setDropped([]);
  };

  // An unknown row as a behaviour of your own ("cold plunge"), answered yes for today.
  const asBehaviour = async (i: number, words: string) => {
    if (!actx) return;
    const name = words.replace(/^\d+\s*/, "").trim();
    const labelText = name.charAt(0).toUpperCase() + name.slice(1, 40);
    const r = await addCustomTag(actx, { label: labelText });
    const tag = r.ok ? r.data.tag : (tags ?? []).find((t) => t.label.toLowerCase() === labelText.toLowerCase())?.tag;
    if (!tag) return toast(r.ok ? "Couldn’t add that" : r.error.startsWith("Too many") ? "Too many behaviours" : "Couldn’t add that");
    setRows((rs) => rs.map((x, k) => (k === i ? { kind: "behaviour", tag, label: labelText, value: 1, day: today } : x)));
  };

  const kept = rows.filter((_, i) => !dropped.includes(i));
  const savable = kept.filter((r) => r.kind !== "unknown" && r.kind !== "workout");
  const add = async () => {
    if (!actx || saving || !savable.length) return;
    setSaving(true);
    let failed = 0;
    for (const r of savable) if (r.kind !== "food" && !(await save(actx, r))) failed++;
    setSaving(false);
    const logged = savable.filter((r) => r.kind !== "food").length - failed;
    bumpJournal();
    onSaved(savable.map((r) => r.kind));
    onClose();
    if (logged) toast(failed ? `Logged ${logged}, ${failed} couldn’t be saved` : `Logged ${logged} ${logged === 1 ? "entry" : "entries"}`);
    const food = savable.find((r): r is Extract<Parsed, { kind: "food" }> => r.kind === "food");
    if (food) setTimeout(() => onFood(food.text, food.at), 300);
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => !saving && onClose()}
      title="Log anything"
      // Full height: the list grows as you type, and a sheet sized to its content drops taps while it resizes.
      size="tall"
      done={{ label: saving ? "Adding…" : savable.length ? `Add ${savable.length}` : "Add", onPress: () => void add(), disabled: saving || !savable.length }}
    >
      <View style={{ gap: 14, paddingTop: 4 }}>
        <TextField
          value={text}
          onChangeText={change}
          placeholder="e.g. 2 beers and a headache last night"
          autoFocus
          autoCapitalize="none"
          autoComplete="off"
          multiline
          submitBehavior="blurAndSubmit"
          returnKeyType="done"
          onSubmitEditing={() => void ask()}
          accessibilityLabel="What you did"
        />
        {kept.length > 0 && (
          <View style={{ borderRadius: LIST_RADIUS, backgroundColor: c.card, overflow: "hidden" }}>
            {rows.map((r, i) => {
              if (dropped.includes(i)) return null;
              const d = describe(r, units, today);
              const muted = r.kind === "unknown" || r.kind === "workout";
              return (
                <View key={`${i}-${r.kind}`} style={[{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 14, paddingRight: 4, paddingVertical: 8 }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}>
                  <IconTile icon={LOOK[r.kind].icon} tint={LOOK[r.kind].tint} size={30} />
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <Txt size={16} lineHeight={21} weight={600} style={{ color: muted ? c.sub : c.ink }} numberOfLines={2}>
                      {d.title}
                    </Txt>
                    <Txt size={13} lineHeight={18} style={{ color: c.sub, fontVariant: ["tabular-nums"] }}>
                      {d.detail}
                    </Txt>
                    {r.kind === "unknown" && (
                      <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
                        <Pressable onPress={() => void asBehaviour(i, r.text)} hitSlop={8} accessibilityRole="button">
                          <Txt size={15} lineHeight={20} weight={600} style={{ color: c.teal }}>
                            Add as a behaviour
                          </Txt>
                        </Pressable>
                        {coach && (
                          <Pressable onPress={() => void ask()} hitSlop={8} accessibilityRole="button" disabled={asking}>
                            <Txt size={15} lineHeight={20} weight={600} style={{ color: c.teal, opacity: asking ? 0.5 : 1 }}>
                              Ask Coach
                            </Txt>
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                  <Pressable
                    onPress={() => setDropped((x) => [...x, i])}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${d.title}`}
                    style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? c.fill : "transparent" })}
                  >
                    <X size={18} color={c.sub} strokeWidth={2} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
        {asking && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4 }}>
            <ActivityIndicator color={c.sub} />
            <Sentence>Asking your Coach…</Sentence>
          </View>
        )}
        {!text.trim() && <Sentence style={{ paddingHorizontal: 4 }}>Water, medicines, drinks, symptoms, mood, weight, food and your behaviours.</Sentence>}
        {kept.some((r) => r.kind === "food") && !asking && <Sentence style={{ paddingHorizontal: 4 }}>Food opens its estimate after you add.</Sentence>}
      </View>
    </BottomSheet>
  );
}
