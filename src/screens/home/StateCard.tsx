// Today's state card: your stress right now (Low, Medium or High, or on the move) and the day's minutes in each, from the
// Stress Monitor's still minutes and the minutes on the move. Opens the Stress screen.
import * as React from "react";
import { View } from "react-native";
import { Footprints, Gauge, Leaf, Target, type LucideIcon } from "lucide-react-native";
import { clock } from "@/lib/format";
import type { DayState, StateKey } from "@/queries/types";
import { minutesText } from "@/queries/outlook";
import { Txt, useTheme } from "@/ui";
import { STRESS_WORD } from "@/lib/bands";
import type { ColorToken } from "@/ui/theme";
import { useCalm, type CalmTint } from "@/ui/calm";
import { ActionPill, HomeCard } from "./controls";

// The Stress Monitor's own Low, Medium and High, in its colours; the minutes on the move aren't stress (the monitor
// reads only still minutes), so they get a line of their own, not a share of the bar.
const ORDER = ["calm", "focused", "stressed"] as const satisfies readonly StateKey[];
const LOOK: Record<StateKey, { label: string; title: string; tint: CalmTint; color?: ColorToken; icon: LucideIcon; line: string }> = {
  calm: { label: STRESS_WORD.low, title: "Low stress", tint: "sky", color: "stressLow", icon: Leaf, line: "Your heart rate is near your resting level." },
  focused: { label: STRESS_WORD.medium, title: "Medium stress", tint: "lavender", color: "stressMedium", icon: Target, line: "Your heart rate is a little raised while still: concentration, caffeine or mild stress." },
  stressed: { label: STRESS_WORD.high, title: "High stress", tint: "peach", color: "stressHigh", icon: Gauge, line: "Your heart rate is well above your resting level while still. A few slow breaths can help." },
  active: { label: "On the move", title: "On the move", tint: "sand", icon: Footprints, line: "Stress is read while you’re still, so it pauses while you move." },
};

const EMPTY: DayState = { now: null, mix: { calm: 0, focused: 0, stressed: 0, active: 0 } };

/**
 * On today the card always has its place, so stress never seems to vanish: first thing in the morning (Fitbit sends
 * heart rate in batches, and the night doesn't count) it says what it is waiting for. A past day without stress shows nothing.
 */
export function StateCard({ state: given, today, timeZone, onOpen, onBreathe }: { state: DayState | null; today: boolean; timeZone: string; onOpen: () => void; onBreathe: () => void }) {
  const c = useCalm();
  const { c: theme } = useTheme();
  const state = given ?? EMPTY;
  const total = ORDER.reduce((n, k) => n + state.mix[k], 0);
  const now = state.now ? LOOK[state.now.key] : null;
  const waiting = !now && total < 15;
  if (waiting && !today) return null;
  if (waiting)
    return (
      <HomeCard icon={Leaf} iconTint="sky" title="Stress so far today" onPress={onOpen} accessibilityLabel="Stress so far today: not enough still minutes yet. Opens Stress." gap={8}>
        <Txt size={15} lineHeight={20} style={{ color: c.sub }}>
          {state.mix.active > 0
            ? `Stress is read while you’re still; so far today you’ve mostly been on the move (${minutesText(state.mix.active)}).`
            : "Stress is read from your still, awake minutes. It shows here once your band has synced a few of them this morning."}
        </Txt>
      </HomeCard>
    );
  const title = now ? `Right now: ${now.title}` : "Stress so far today";
  const dot = (k: StateKey) => theme[LOOK[k].color ?? "mutedForeground"];
  const moving = state.mix.active;
  const spoken = [...ORDER.filter((k) => state.mix[k] > 0).map((k) => `${LOOK[k].label} ${minutesText(state.mix[k])}`), moving > 0 ? `On the move ${minutesText(moving)}` : ""].filter(Boolean).join(", ");
  return (
    <HomeCard
      icon={now?.icon ?? Leaf}
      iconTint={now?.tint ?? "mint"}
      title={title}
      subtitle={state.now ? `As of ${clock(state.now.at, timeZone)}` : undefined}
      onPress={onOpen}
      right={state.now?.key === "stressed" ? <ActionPill label="Breathe" accessibilityLabel="Open a breathing exercise" onPress={onBreathe} /> : undefined}
      accessibilityLabel={`${title}. Today: ${spoken}. Opens Stress.`}
      gap={12}
    >
      {now && (
        <Txt size={15} lineHeight={20} style={{ color: c.ink }}>
          {now.line}
        </Txt>
      )}
      {total > 0 && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: c.fill }}>
            {ORDER.map((k) => (state.mix[k] > 0 ? <View key={k} style={{ flexGrow: state.mix[k], backgroundColor: dot(k) }} /> : null))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 6, columnGap: 16 }}>
            {ORDER.map((k) => (
              <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot(k) }} />
                <Txt size={13} lineHeight={18} style={{ color: c.sub }}>
                  {LOOK[k].label}
                </Txt>
                <Txt size={13} lineHeight={18} weight={600} style={{ color: c.ink, fontVariant: ["tabular-nums"] }}>
                  {minutesText(state.mix[k])}
                </Txt>
              </View>
            ))}
          </View>
          {moving > 0 && (
            <Txt size={13} lineHeight={18} style={{ color: c.sub }}>
              {`Plus ${minutesText(moving)} on the move, not counted as stress`}
            </Txt>
          )}
        </View>
      )}
    </HomeCard>
  );
}
