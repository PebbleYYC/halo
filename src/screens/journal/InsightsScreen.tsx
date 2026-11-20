// Behaviour insights `/journal/insights?m=` (spec §7.12, journey 7), ported from the web's
// src/app/(app)/journal/insights/{page,Impacts,loading}.tsx, in the iOS look: the heading and explainer over the
// Recovery / HRV / Sleep segmented control, the impact list (a row opens its detail sheet: the effect as a Health
// number over an inset list of the figures behind it), then "Not enough days yet" as Health cards, each with a
// capsule that grows to how many of the ten days are logged, and the footnote.
import * as React from "react";
import { StyleSheet, View } from "react-native";
import { Lock } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { formatValue } from "@/lib/format";
import { AMOUNT_MIN_DAYS } from "@/lib/behaviours";
import { getAmountImpact, getJournalInsights, getMedicineTiming } from "@/queries/journal";
import type { ImpactMetricKey, JournalInsightsVM } from "@/queries/types";
import { useQuery } from "@/state/app";
import { useMedicines } from "@/state/medicines";
import { CompareBars, type CompareRow } from "./CompareBars";
import { medicineTag } from "@/lib/medicine";
import { BottomSheet, DriverList, DriverListSkeleton, Txt } from "@/ui";
import { font } from "@/ui/fonts";
import { ActivityCostSection } from "@/screens/detail/ActivityCost";
import { DetailScreen, LoadError } from "@/screens/detail/DetailScreen";
import { useBack, useRefresh } from "@/screens/detail/nav";
import { CapsuleMeter } from "@/ui/components/CapsuleMeter";
import { CalmSegmented, Num, Sentence, Surface, Title, useCalm } from "../settings/calmKit";
import { openCheckIn, useJournalVersion } from "./state";

const METRICS: { key: ImpactMetricKey; label: string; word: string }[] = [
  { key: "recovery", label: "Recovery", word: "Recovery" },
  { key: "hrv", label: "HRV", word: "HRV" },
  { key: "sleep", label: "Sleep", word: "sleep performance" },
];
const WORD: Record<ImpactMetricKey, string> = { recovery: "Recovery", hrv: "HRV", sleep: "sleep performance" };
const TITLE: Record<ImpactMetricKey, string> = { recovery: "Recovery", hrv: "HRV", sleep: "Sleep" };
const FOOTER = "Averages, not proof of cause.";
const parseMetric = (raw: string | string[] | undefined): ImpactMetricKey => {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "hrv" || v === "sleep" ? v : "recovery";
};

export default function InsightsScreen() {
  const router = useRouter();
  const onBack = useBack("/journal");
  const { refreshing, onRefresh, retry } = useRefresh();
  const params = useLocalSearchParams<{ m?: string }>();
  const metric = parseMetric(params.m);
  const version = useJournalVersion();
  const q = useQuery((ctx) => getJournalInsights(metric, ctx), [metric, version]);
  // The last metric's list stays in useQuery while the next loads: show the skeleton instead.
  const vm = q.data?.metric === metric ? q.data : undefined;
  const setMetric = (m: ImpactMetricKey) => router.setParams({ m: m === "recovery" ? undefined : m });

  const common = { title: "Behaviour insights", onBack, refreshing, onRefresh } as const;
  if (q.error && !vm) return <DetailScreen {...common} primary={<LoadError onRetry={retry} />} />;

  return (
    <DetailScreen
      {...common}
      hero={
        // Top-aligned and full width, as the web's hero column on a phone.
        <View style={{ alignSelf: "stretch", gap: 16 }}>
          <View style={{ gap: 6 }}>
            <Title size={22} header>{`${TITLE[metric]} impact analysis`}</Title>
            <Sentence>{`Next-day ${WORD[metric]}, last 90 days.`}</Sentence>
          </View>
          {/* Recovery / HRV / Sleep, kept in `?m=` (spec §7.12). */}
          <CalmSegmented value={metric} onChange={setMetric} on="ground" items={METRICS.map((m) => ({ value: m.key, label: m.label }))} accessibilityLabel="Outcome" />
        </View>
      }
      summary={vm ? <ImpactList vm={vm} /> : <DriverListSkeleton rows={6} unit={metric === "hrv" ? "SD" : "%"} />}
      footer={
        <View style={{ gap: 28 }}>
          {vm && vm.needsMore.length > 0 && <Unlock needsMore={vm.needsMore} word={WORD[metric]} />}
          {/* Mobile: not only whether you drank, but how much. */}
          <AmountSection metric={metric} version={version} />
          {/* Mobile: not only whether a medicine was taken, but when. */}
          <MedTimingSection metric={metric} version={version} />
          {/* Mobile: workouts are behaviours too; what each kind costs next-day Recovery. */}
          {metric === "recovery" && <ActivityCostSection />}
          <Sentence size={13} style={{ paddingHorizontal: 4 }}>
            {FOOTER}
          </Sentence>
        </View>
      }
    />
  );
}

/** The impact list; a row opens its detail sheet. */
function ImpactList({ vm }: { vm: JournalInsightsVM }) {
  const c = useCalm();
  const [open, setOpen] = React.useState<string | null>(null);
  const [last, setLast] = React.useState<JournalInsightsVM["items"][number] | null>(null);
  const current = vm.items.find((i) => i.key === open);
  // The sheet keeps its content while it slides out.
  const item = current ?? last;
  const sd = vm.unit === "SD";
  const fx = (v: number, signed = true) => (sd ? `${formatValue(signed ? "signed1" : "decimal1", v)} SD` : `${formatValue(signed ? "signedInt" : "int", v)}%`);
  const avg = (v: number | null) => (v === null ? "--" : sd ? `${formatValue("signed1", v)} SD` : `${formatValue("int", v)}%`);
  const tone = item?.effect === "positive" ? c.tintInk.mint : item?.effect === "negative" ? c.tintInk.sand : c.ink;
  const word = METRICS.find((m) => m.key === vm.metric)!.word;

  return (
    <>
      <DriverList
        variant="impact"
        unit={vm.unit}
        data={{ value: vm.items, reason: null, provisional: false }}
        selectedKey={current?.key}
        onSelect={(k) => {
          setOpen(k);
          setLast(vm.items.find((i) => i.key === k) ?? null);
        }}
        outcome={word}
        onCheckIn={() => openCheckIn()}
      />
      <BottomSheet open={!!current} onClose={() => setOpen(null)} title={item?.label ?? "Behaviour"}>
        {item && (
          <View style={{ gap: 18 }}>
            {/* The effect as the headline number, its unit small beside it, the outcome under it. */}
            <View accessible accessibilityLabel={`${fx(item.delta)} next-day ${word}`} style={{ gap: 2 }}>
              <Num value={sd ? formatValue("signed1", item.delta) : formatValue("signedInt", item.delta)} unit={sd ? "SD" : "%"} size={40} color={tone} />
              <Txt size={15} lineHeight={20} style={{ color: c.sub }}>
                {`Next-day ${word}`}
              </Txt>
            </View>
            <View style={{ borderRadius: 14, backgroundColor: c.sheetFill, paddingHorizontal: 16 }}>
              {(
                [
                  ["Days with", String(item.yes ?? "--")],
                  ["Days without", String(item.no ?? "--")],
                  ["90% confidence", item.ci ? `${fx(item.ci[0], false)} to ${fx(item.ci[1], false)}` : "--"],
                  ["Average with", avg(item.avgWith)],
                  ["Average without", avg(item.avgWithout)],
                ] as const
              ).map(([k, v], i) => (
                <React.Fragment key={k}>
                  {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />}
                  {/* The name and the number share their first line, whichever wraps. */}
                  <View style={{ minHeight: 48, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingVertical: (48 - 22) / 2 }}>
                    <Txt size={16} lineHeight={21} style={{ color: c.ink, flexShrink: 1, marginTop: 0.5 }}>
                      {k}
                    </Txt>
                    <Txt size={16} lineHeight={22} align="right" style={[font.numeric(500), { color: c.sub, flexShrink: 1, maxWidth: "50%" }]}>
                      {v}
                    </Txt>
                  </View>
                </React.Fragment>
              ))}
            </View>
            <Sentence size={13}>{FOOTER}</Sentence>
          </View>
        )}
      </BottomSheet>
    </>
  );
}

/** The "Not enough days yet" group: one Health card per behaviour, its capsule growing to its days logged of ten. */
function Unlock({ needsMore, word }: { needsMore: JournalInsightsVM["needsMore"]; word: string }) {
  const c = useCalm();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 4, paddingHorizontal: 4 }}>
        <Title header size={22}>
          Not enough days yet
        </Title>
        <Sentence>{`Needs 5 Yes and 5 No days.`}</Sentence>
      </View>
      <View style={{ gap: 10 }}>
        {needsMore.map((n) => {
          const have = Math.min(5, n.yes) + Math.min(5, n.no);
          return (
            <Surface key={n.key} padding={16}>
              <View style={{ gap: 10 }} accessibilityLabel={`${n.label}: ${have} of 10 days logged`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <Lock size={16} color={c.tintInk.lavender} strokeWidth={2.4} />
                  <Txt size={16} lineHeight={21} weight={600} style={{ color: c.tintInk.lavender, flex: 1, minWidth: 0 }}>
                    {n.label}
                  </Txt>
                  <Num value={String(have)} unit="/ 10" size={20} />
                </View>
                <CapsuleMeter frac={have / 10} color={c.tintInk.lavender} height={8} track={c.fill} grow />
                <Txt size={13} lineHeight={18} style={{ color: c.sub, fontVariant: ["tabular-nums"] }}>
                  {`${Math.min(5, n.yes)} of 5 days with, ${Math.min(5, n.no)} of 5 without`}
                </Txt>
              </View>
            </Surface>
          );
        })}
      </View>
    </View>
  );
}

/**
 * "By amount": a counted behaviour (alcohol) as none, a little and a lot, and the next day's metric after each. The
 * yes/no impact above averages one drink with dinner and a night out into one number; this is the two apart. An
 * amount shows its average from AMOUNT_MIN_DAYS nights; before that, how many it has.
 */
function AmountSection({ metric, version }: { metric: ImpactMetricKey; version: number }) {
  const q = useQuery((ctx) => getAmountImpact(metric, ctx), [metric, version]);
  const rows = q.data;
  if (!rows?.length) return null;
  const f = outcomeFormat(metric);
  return (
    <View style={{ gap: 12 }}>
      <SectionHead title="By amount" line={`Next-day ${WORD[metric]} by how much.`} />
      <Surface padding={16} gap={0}>
        {rows.map((r, i) => {
          const arms = [r.none, r.light, r.heavy];
          // The clearest difference from none, if any: the headline, and the only coloured bar.
          const clear = [r.light, r.heavy].filter((x) => x.vsNone && x.avg != null && r.none.avg != null).sort((x, y) => Math.abs(y.avg! - r.none.avg!) - Math.abs(x.avg! - r.none.avg!))[0];
          const headline = clear
            ? `${f.Word} is ${f.gap(clear.avg! - r.none.avg!)} ${clear.vsNone === "higher" ? "higher" : "lower"} after ${clear.label.toLowerCase()} than none.`
            : "No clear difference yet.";
          const rowsOut: CompareRow[] = arms.map((x) => ({
            label: x.label,
            sub: x.avg == null ? `${x.n} of ${AMOUNT_MIN_DAYS} nights` : `${x.n} ${x.n === 1 ? "night" : "nights"}`,
            value: x.avg,
            display: x.avg == null ? "" : f.v(x.avg),
            mark: x === clear ? (clear.vsNone === "higher" ? "better" : "worse") : undefined,
          }));
          return (
            <React.Fragment key={r.tag}>
              <CompareBars first={i === 0} title={r.label} headline={headline} rows={rowsOut} domain={f.domain(arms.map((x) => x.avg))} signed={f.signed} />
              {r.unknown > 0 && <Sentence size={13} style={{ marginTop: -6, paddingBottom: 8 }}>{`${r.unknown} ${r.unknown === 1 ? "night" : "nights"} without a count left out.`}</Sentence>}
            </React.Fragment>
          );
        })}
      </Surface>
    </View>
  );
}

/**
 * "When you take it": each medicine's earlier doses against its later ones (split at its median time), and the next
 * day's metric after each. Shown once a medicine has 10 timed doses spread over more than half an hour.
 */
function MedTimingSection({ metric, version }: { metric: ImpactMetricKey; version: number }) {
  const q = useQuery((ctx) => getMedicineTiming(metric, ctx), [metric, version]);
  const meds = useMedicines();
  const rows = q.data;
  if (!rows?.length) return null;
  const f = outcomeFormat(metric);
  // The evening time a medicine is scheduled for (Settings › Medicines), to say what the better time replaces.
  const scheduled = (tags: string[]) => meds.find((x) => tags.includes(medicineTag(x.name)))?.times.filter((t) => t >= "15:00").pop() ?? null;
  return (
    <View style={{ gap: 12 }}>
      <SectionHead title="When you take it" line={`Evening dose time against next-day ${WORD[metric]}.`} />
      <Surface padding={16} gap={0}>
        {rows.map((r, i) => {
          const names = [r.label, ...r.with];
          const title = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : r.label;
          const late = r.clear === "late";
          const sched = scheduled([r.tag, ...r.with.map(medicineTag)]);
          // The schedule is named only when it sits on the worse side of the split.
          const instead = sched && (late ? sched < r.split : sched >= r.split) ? ` instead of ${sched} as scheduled` : "";
          const headline = r.clear ? `${f.Word} is ${f.gap(r.late.avg - r.early.avg)} higher when you take it ${late ? "after" : "before"} ${r.split}${instead}.` : "No clear difference yet.";
          const evenings = (n: number) => `${n} ${n === 1 ? "evening" : "evenings"}`;
          const bars: CompareRow[] = [
            { label: `Before ${r.split}`, sub: evenings(r.early.n), value: r.early.avg, display: f.v(r.early.avg), mark: r.clear === "early" ? "better" : undefined },
            { label: `After ${r.split}`, sub: evenings(r.late.n), value: r.late.avg, display: f.v(r.late.avg), mark: late ? "better" : undefined },
          ];
          return <CompareBars key={r.tag} first={i === 0} title={r.with.length ? `${title} · logged together` : title} headline={headline} rows={bars} domain={f.domain([r.early.avg, r.late.avg])} signed={f.signed} />;
        })}
      </Surface>
    </View>
  );
}

function SectionHead({ title, line }: { title: string; line: string }) {
  return (
    <View style={{ gap: 4, paddingHorizontal: 4 }}>
      <View accessibilityRole="header">
        <Title>{title}</Title>
      </View>
      <Sentence>{line}</Sentence>
    </View>
  );
}

/** How an outcome reads: its values, a gap between two ("19 points", "0.4 SD") and the bars' scale. */
function outcomeFormat(metric: ImpactMetricKey) {
  const sd = metric === "hrv";
  const word = WORD[metric];
  return {
    Word: word.charAt(0).toUpperCase() + word.slice(1),
    signed: sd,
    v: (x: number) => (sd ? `${formatValue("signed1", x)}` : `${formatValue("int", x)}%`),
    gap: (d: number) => (sd ? `${(Math.round(Math.abs(d) * 10) / 10).toFixed(1)} SD` : `${Math.round(Math.abs(d))} points`),
    domain: (xs: (number | null)[]): [number, number] => {
      if (!sd) return [0, 100];
      const m = Math.max(0.5, ...xs.filter((x): x is number => x != null).map(Math.abs));
      return [-m, m];
    },
  };
}
