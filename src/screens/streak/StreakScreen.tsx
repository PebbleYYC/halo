// The wear streak `/streak`, opened from the flame capsule on Today. Its lead card is the ring every tab leads with
// (172 px, centred), here filling toward the next milestone with the run's length rolling into its middle; then the
// record (longest run, the last 30 and 365 days), the milestones the run has passed and the next one, and the months
// as calendars with each run drawn as one band through its days. The rules (what counts as worn, today's grace) are
// src/queries/streak.ts, shared with the capsule's count.
import * as React from "react";
import { View } from "react-native";
import { Flame as FlameIcon } from "lucide-react-native";
import { DAY, formatDay } from "@/lib/format";
import { addDays, daysBetween } from "@/lib/time";
import { alpha } from "@/lib/utils";
import { getStreak, MILESTONES, STREAK_TODAY_MIN, type DayWear, type Run, type StreakVM } from "@/queries/streak";
import { useQuery } from "@/state/app";
import { SectionShell, Skeleton, SkeletonText, Txt } from "@/ui";
import { useCalm } from "@/ui/calm";
import { Card } from "@/ui/components/Card";
import { addMonths, monthGrid, monthLabel, monthOf, weekdayLabels } from "@/ui/components/CalendarSheet";
import { CalmButton } from "@/screens/settings/calmKit";
import { RING_LAND_MS, RollingNumber } from "@/ui/components/Halo";
import { font } from "@/ui/fonts";
import { HERO_RING } from "@/screens/detail/ScoreHero";
import { Sentence } from "@/screens/detail/calmKit";
import { CardHead } from "@/screens/health/kit";
import { DetailScreen, ErrorState } from "@/screens/health/shells";
import { Rows } from "@/screens/health/view";
import { Flame } from "./Flame";
import { flameTier, nextTier } from "./tiers";

const INFO = {
  title: "Wear streak",
  body: `A day counts when your band recorded heart rate that day. Today counts once it has ${STREAK_TODAY_MIN / 60} hours of heart rate; until then it neither adds to your streak nor breaks it, so the count runs to yesterday. A day with no heart rate at all ends the run.`,
};

/** Months shown at first, and added by each "Show earlier". */
const MONTHS_STEP = 3;

/** "Oct 31", with the year when it is not this one. */
const dayText = (day: string, today: string) => formatDay(day, day.slice(0, 4) === today.slice(0, 4) ? DAY.monthDay : { month: "short", day: "numeric", year: "numeric" });
const daysText = (n: number) => `${n.toLocaleString()} ${n === 1 ? "day" : "days"}`;

export default function StreakScreen() {
  const { data, error } = useQuery((ctx) => getStreak(ctx), [], "streak");
  if (error && !data) return <DetailScreen title="Streak" info={INFO} primary={<ErrorState error={error} />} />;
  return (
    <DetailScreen
      title="Streak"
      info={INFO}
      backTo="/"
      hero={<Hero vm={data} />}
      primary={data ? <Record vm={data} /> : <RecordSkeleton />}
      secondary={data ? [<Milestones key="m" vm={data} />, <Calendar key="c" vm={data} />] : []}
      footer={<Sentence size={13}>{INFO.body}</Sentence>}
    />
  );
}

/**
 * The lead card: the flame (in the streak's colour, tiers.ts) lit as you arrive, the run's length rolling in under it,
 * then three figures (when it started, the longest run, the next milestone) and when the flame next changes colour.
 */
function Hero({ vm }: { vm: StreakVM | undefined }) {
  const c = useCalm();
  const days = vm?.current?.days ?? 0;
  const next = vm?.next ?? null;
  const tier = flameTier(days);
  const up = nextTier(days);
  return (
    <Card style={{ alignSelf: "stretch" }}>
      <View style={{ gap: 14, alignItems: "center" }}>
        <View style={{ alignSelf: "stretch" }}>
          <CardHead tint="peach" icon={FlameIcon} title="Wear streak" />
        </View>
        {!vm ? (
          <>
            <Skeleton radius={HERO_RING / 2} style={{ width: HERO_RING, height: HERO_RING }} />
            <SkeletonText role="valueHero" size={54} lineHeight={58} chars={3} />
          </>
        ) : (
          <>
            <Flame tier={tier} box={HERO_RING} accessibilityLabel={`A ${tier.name} flame: a ${days}-day streak`} />
            <View accessible accessibilityLabel={`${days}-day streak`} style={{ alignItems: "center", marginTop: -6 }}>
              <RollingNumber text={days.toLocaleString()} lineHeight={58} duration={RING_LAND_MS} style={[font.numberAt(54, 800), { color: c.ink, letterSpacing: -1.5 }]} />
              <Txt size={13} lineHeight={18} weight={600} style={{ color: c.sub, letterSpacing: 0.8, textTransform: "uppercase" }}>
                Day streak
              </Txt>
            </View>
          </>
        )}
        {vm && (
          <View style={{ alignSelf: "stretch", flexDirection: "row", marginTop: 4 }}>
            <Figure value={vm.current ? dayText(vm.current.from, vm.today) : "–"} label="Started" />
            <Rule />
            <Figure value={vm.longest ? vm.longest.days.toLocaleString() : "0"} label="Longest" />
            <Rule />
            <Figure value={next ? `${(next - days).toLocaleString()} to go` : "–"} label={next ? `To ${next.toLocaleString()} days` : "Every milestone"} />
          </View>
        )}
        {vm && (
          <View style={{ alignItems: "center", gap: 4 }}>
            <Sentence size={13} align="center">
              {!vm.current ? "Wear your band today to light a new streak." : up ? `Turns ${up.name} at ${up.from.toLocaleString()} days.` : "Burning in its hottest colour."}
            </Sentence>
            {vm.todayPending && vm.current && (
              <Sentence size={13} align="center">
                {`Today joins it once your band has ${STREAK_TODAY_MIN / 60} hours of heart rate.`}
              </Sentence>
            )}
          </View>
        )}
      </View>
    </Card>
  );
}

/** One of the lead card's three figures: the value, and what it is under it. */
function Figure({ value, label }: { value: string; label: string }) {
  const c = useCalm();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 2, paddingHorizontal: 4 }}>
      <Txt size={17} lineHeight={22} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[font.numeric(700), { color: c.ink }]}>
        {value}
      </Txt>
      <Txt size={13} lineHeight={18} numberOfLines={1} style={{ color: c.sub }}>
        {label}
      </Txt>
    </View>
  );
}

function Rule() {
  const c = useCalm();
  return <View style={{ width: 0.5, alignSelf: "stretch", marginVertical: 4, backgroundColor: c.line }} />;
}

/** One line of the record: what it is (and when, under it) on the left, the figure on the right. */
function Line({ label, caption, value }: { label: string; caption?: string; value: string }) {
  const c = useCalm();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}${caption ? `, ${caption}` : ""}`} style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt size={17} lineHeight={22} style={{ color: c.ink }}>
          {label}
        </Txt>
        {caption ? (
          <Txt size={13} lineHeight={18} style={{ color: c.sub, fontVariant: ["tabular-nums"] }}>
            {caption}
          </Txt>
        ) : null}
      </View>
      <Txt size={17} lineHeight={22} style={[font.numeric(600), { color: c.ink, flexShrink: 0 }]}>
        {value}
      </Txt>
    </View>
  );
}

const runText = (r: Run, today: string) => `${dayText(r.from, today)} – ${r.to === today || r.to === addDays(today, -1) ? "now" : dayText(r.to, today)}`;

function Record({ vm }: { vm: StreakVM }) {
  const longestIsCurrent = !!vm.longest && !!vm.current && vm.longest.from === vm.current.from;
  const span = daysBetween(vm.firstDay, vm.today) + 1;
  return (
    <SectionShell variant="card" title="Your record" accent={null}>
      <Rows>
        <Line label="Longest streak" caption={vm.longest ? (longestIsCurrent ? "Your streak now" : runText(vm.longest, vm.today)) : "None yet"} value={vm.longest ? daysText(vm.longest.days) : "–"} />
        <Line label="Last 30 days" value={`${vm.last30.worn} of ${vm.last30.of}`} />
        {/* Only once there is more than a month to speak of. */}
        {span > 31 && <Line label={span > 365 ? "Last 365 days" : `Since ${dayText(vm.firstDay, vm.today)}`} value={`${(span > 365 ? vm.last365 : vm.total).worn} of ${(span > 365 ? vm.last365 : vm.total).of}`} />}
        {span > 365 && <Line label="In all" caption={`Since ${dayText(vm.firstDay, vm.today)}`} value={daysText(vm.total.worn)} />}
      </Rows>
    </SectionShell>
  );
}

function RecordSkeleton() {
  return (
    <SectionShell variant="card" title="Your record" accent={null}>
      <View style={{ gap: 18, paddingVertical: 10 }}>
        <SkeletonText size={17} lineHeight={22} width={160} />
        <SkeletonText size={17} lineHeight={22} width={120} />
      </View>
    </SectionShell>
  );
}

/**
 * The milestones: the ones the run has passed (with the day it reached each), the next one (how far), and two beyond
 * it, faint. A run that ends starts the list over: they belong to the run, as the count does.
 */
function Milestones({ vm }: { vm: StreakVM }) {
  const c = useCalm();
  const days = vm.current?.days ?? 0;
  const ink = flameTier(days).accent;
  const ahead = vm.next ? [vm.next, ...nextAfter(vm.next, 2)] : [];
  const items: { n: number; state: "reached" | "next" | "later"; note: string }[] = [
    ...vm.reached.slice(-6).map((r) => ({ n: r.days, state: "reached" as const, note: dayText(r.on, vm.today) })),
    ...ahead.map((n, i) => ({ n, state: i === 0 ? ("next" as const) : ("later" as const), note: i === 0 ? `${n - days} to go` : "days" })),
  ];
  return (
    <SectionShell variant="card" title="Milestones" accent={null}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 16, paddingTop: 4, paddingBottom: 6 }}>
        {items.map((m) => (
          <View
            key={m.n}
            accessible
            accessibilityLabel={m.state === "reached" ? `${m.n} days, reached ${m.note}` : m.state === "next" ? `${m.n} days, next, ${m.note}` : `${m.n} days, ahead`}
            style={{ width: "25%", alignItems: "center", gap: 6 }}
          >
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                alignItems: "center",
                justifyContent: "center",
                // Each one passed in the colour the flame burned in from there: the run's colours, in order.
                backgroundColor: m.state === "reached" ? alpha(flameTier(m.n).accent, 0.2) : "transparent",
                borderWidth: m.state === "later" ? 1 : 2,
                borderColor: m.state === "later" ? c.line : m.state === "reached" ? flameTier(m.n).accent : ink,
                borderStyle: m.state === "next" ? "dashed" : "solid",
              }}
            >
              <Txt size={17} lineHeight={22} style={[font.numeric(700), { color: m.state === "later" ? c.faint : c.ink }]}>
                {m.n.toLocaleString()}
              </Txt>
            </View>
            <Txt size={13} lineHeight={18} align="center" numberOfLines={1} style={{ color: m.state === "next" ? c.tintInk.peach : c.sub, fontVariant: ["tabular-nums"] }}>
              {m.note}
            </Txt>
          </View>
        ))}
      </View>
    </SectionShell>
  );
}

/** The `count` milestones after `n`. */
const nextAfter = (n: number, count: number): number[] => MILESTONES.filter((m) => m > n).slice(0, count);

/** The months, newest first, each a calendar; "Show earlier" adds three more, back to the first day of data. */
function Calendar({ vm }: { vm: StreakVM }) {
  const [shown, setShown] = React.useState(MONTHS_STEP);
  const last = monthOf(vm.today);
  const first = monthOf(vm.firstDay);
  const months: string[] = [];
  for (let m = last; m >= first && months.length < shown; m = addMonths(m, -1)) months.push(m);
  const more = addMonths(months[months.length - 1], -1) >= first;
  return (
    <View style={{ gap: 14 }}>
      {months.map((m) => (
        <Month key={m} month={m} vm={vm} />
      ))}
      {more && (
        <CalmButton variant="quiet" size="md" onPress={() => setShown((n) => n + MONTHS_STEP)}>
          Show earlier months
        </CalmButton>
      )}
    </View>
  );
}

/**
 * One month as a calendar. A worn day sits in the streak's colour, and a run of them is one band across the week
 * (rounded where it starts and ends), so the runs read at a glance; a missed day is its number alone, today while it
 * is pending a dashed ring, and the days before the data or after today faint.
 */
const Month = React.memo(function Month({ month, vm }: { month: string; vm: StreakVM }) {
  const c = useCalm();
  const accent = flameTier(vm.current?.days ?? 0).accent;
  const band = alpha(accent, 0.24);
  const weeks = React.useMemo(() => monthGrid(month), [month]);
  const heads = React.useMemo(() => weekdayLabels(), []);
  const state = (d: string | null): DayWear | null => (d ? (vm.wear[d] ?? null) : null);
  let worn = 0;
  let of = 0;
  for (const w of weeks)
    for (const d of w) {
      const s = state(d);
      if (s && s !== "pending") {
        of++;
        if (s === "worn") worn++;
      }
    }
  return (
    <Card>
      <View accessible accessibilityLabel={`${monthLabel(month, vm.today)}: worn ${worn} of ${of} days`} style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <Txt size={17} lineHeight={22} weight={600} style={{ color: c.ink }}>
            {monthLabel(month, vm.today)}
          </Txt>
          <Txt size={13} lineHeight={18} style={{ color: c.sub, fontVariant: ["tabular-nums"] }}>
            {of ? `${worn} of ${of} days` : ""}
          </Txt>
        </View>
        <View style={{ flexDirection: "row" }}>
          {heads.map((h) => (
            <Txt key={h.long} size={11} lineHeight={13} weight={600} align="center" style={{ flex: 1, color: c.sub, textTransform: "uppercase" }}>
              {h.short}
            </Txt>
          ))}
        </View>
        <View style={{ gap: 4 }}>
          {weeks.map((w, i) => (
            <View key={i} style={{ flexDirection: "row" }}>
              {w.map((d, j) => {
                const s = state(d);
                const prev = s === "worn" && j > 0 && state(w[j - 1]) === "worn";
                const next = s === "worn" && j < 6 && state(w[j + 1]) === "worn";
                const outside = !!d && (d > vm.today || d < vm.firstDay);
                return (
                  <View key={j} style={{ flex: 1, height: 34, justifyContent: "center", alignItems: "center" }}>
                    {s === "worn" && (
                      <View
                        style={{
                          position: "absolute",
                          top: 2,
                          bottom: 2,
                          left: prev ? 0 : 3,
                          right: next ? 0 : 3,
                          backgroundColor: band,
                          borderTopLeftRadius: prev ? 0 : 15,
                          borderBottomLeftRadius: prev ? 0 : 15,
                          borderTopRightRadius: next ? 0 : 15,
                          borderBottomRightRadius: next ? 0 : 15,
                        }}
                      />
                    )}
                    {s === "pending" && <View style={{ position: "absolute", width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderStyle: "dashed", borderColor: accent }} />}
                    {d && (
                      <Txt size={15} lineHeight={20} weight={s === "worn" ? 600 : 400} style={{ color: outside ? c.faint : s === "worn" || s === "pending" ? c.ink : c.sub, fontVariant: ["tabular-nums"] }}>
                        {String(Number(d.slice(8)))}
                      </Txt>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
});
