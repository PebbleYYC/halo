// Detected activities, reviewed (src/lib/detectedReview.ts): the Activity tab's "To review" card when the last week has
// some nobody has looked at, and the sheet that asks what each one was: a sport to confirm it as, or "Not a workout"
// (a hot shower, a stressful call), which also sets aside new ones like it once it has seen two.
import * as React from "react";
import { View } from "react-native";
import { Activity } from "lucide-react-native";
import { setReview, type ReviewKind } from "@/lib/detectedReview";
import { RPE_LEVELS, setRpe } from "@/lib/sessionRpe";
import { clock, formatValue } from "@/lib/format";
import { localMinutes } from "@/lib/time";
import { getToReview } from "@/queries/activityCost";
import type { DetectedItem } from "@/queries";
import { useApp, useQuery } from "@/state/app";
import { BottomSheet, Txt } from "@/ui";
import { useCalm } from "@/ui/calm";
import { HomeCard } from "@/screens/home/controls";
import { CalmButton, Sentence } from "@/screens/settings/calmKit";
import { Chips, toast } from "@/screens/journal/controls";

const SPORTS: readonly (readonly [ReviewKind, string])[] = [
  ["walk", "Walking"],
  ["run", "Running"],
  ["ride", "Cycling"],
  ["strength", "Strength"],
  ["cardio", "Other cardio"],
];

const summary = (it: DetectedItem, timeZone: string) =>
  `${clock(it.start, timeZone)} – ${clock(it.end, timeZone)} · ${it.avgHr} bpm avg${it.steps ? ` · ${formatValue("grouped", it.steps)} steps` : ""}`;

/** What one detected activity was. Opens on the sport its steps suggest. */
export function ReviewSheet({ item, timeZone, onClose }: { item: DetectedItem | null; timeZone: string; onClose: () => void }) {
  const app = useApp();
  const [sport, setSport] = React.useState<ReviewKind>(item?.kind ?? "cardio");
  const [rpe, setRpeChoice] = React.useState<number | null>(null);
  const [shown, setShown] = React.useState(item);
  if (item && item !== shown) {
    setShown(item);
    setSport(item.kind);
    setRpeChoice(null);
  }
  const it = item ?? shown;
  const done = async (verdict: "workout" | "not") => {
    if (!it) return;
    const start = Math.floor(it.start / 1000);
    await setReview(
      start,
      verdict === "workout" ? { verdict, kind: sport } : { verdict, detected: it.detected, startMin: localMinutes(start, timeZone), minutes: it.minutes },
    );
    if (verdict === "workout" && sport === "strength" && rpe != null) await setRpe(`d:${start}`, rpe);
    onClose();
    app.dataChanged();
    toast(verdict === "workout" ? "Saved" : "Dismissed");
  };
  return (
    <BottomSheet open={!!item} onClose={onClose} title="What was this?" description={it ? summary(it, timeZone) : undefined} done={{ label: "Confirm", onPress: () => void done("workout") }}>
      <View style={{ gap: 18, paddingTop: 4 }}>
        <Chips label="Sport" options={SPORTS} value={sport} onChange={(v) => typeof v === "string" && v && setSport(v as ReviewKind)} />
        {sport === "strength" && (
          <Chips label="How hard did it feel?" options={RPE_LEVELS.map(([v, l]) => [String(v), l] as const)} value={rpe == null ? "" : String(rpe)} onChange={(v) => setRpeChoice(typeof v === "string" && v ? Number(v) : null)} />
        )}
        <CalmButton variant="danger" onPress={() => void done("not")} style={{ alignSelf: "stretch" }}>
          Not a workout
        </CalmButton>
        <Sentence style={{ paddingHorizontal: 4 }}>Detected from your heart rate. Halo learns from what you dismiss.</Sentence>
      </View>
    </BottomSheet>
  );
}

/** Activity's "To review": the latest unreviewed detection and how many more, until there are none. */
export function ToReviewCard({ day, timeZone }: { day: string; timeZone: string }) {
  const c = useCalm();
  const q = useQuery((ctx) => getToReview(ctx), [day], `toreview:${day}`);
  const [open, setOpen] = React.useState<DetectedItem | null>(null);
  const items = q.data ?? [];
  if (!items.length) return null;
  const first = items[0];
  return (
    <>
      <HomeCard
        icon={Activity}
        iconTint="peach"
        title={items.length === 1 ? "1 activity to review" : `${items.length} activities to review`}
        right={
          <CalmButton size="sm" variant="secondary" onPress={() => setOpen(first)}>
            Review
          </CalmButton>
        }
        gap={6}
      >
        <Txt size={15} lineHeight={20} style={{ color: c.sub, fontVariant: ["tabular-nums"] }}>
          {`Likely ${first.label.toLowerCase()} · ${summary(first, timeZone)}`}
        </Txt>
      </HomeCard>
      <ReviewSheet item={open} timeZone={timeZone} onClose={() => setOpen(null)} />
    </>
  );
}
