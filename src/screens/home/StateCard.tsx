// Today's state card: how you are right now (calm, focused, stressed or active) and the day's minutes in each, from the
// Stress Monitor's still minutes and the minutes on the move. Opens the Stress screen.
import * as React from "react";
import { View } from "react-native";
import { Footprints, Gauge, Leaf, Target, type LucideIcon } from "lucide-react-native";
import { clock } from "@/lib/format";
import type { DayState, StateKey } from "@/queries/types";
import { minutesText } from "@/queries/outlook";
import { Txt } from "@/ui";
import { useCalm, type CalmTint } from "@/ui/calm";
import { ActionPill, HomeCard } from "./controls";

const ORDER: StateKey[] = ["calm", "focused", "stressed", "active"];
const LOOK: Record<StateKey, { label: string; tint: CalmTint; icon: LucideIcon; line: string }> = {
  calm: { label: "Calm", tint: "mint", icon: Leaf, line: "Your heart rate is near your resting level." },
  focused: { label: "Focused", tint: "sky", icon: Target, line: "Your heart rate is a little raised while still: concentration, caffeine or mild stress." },
  stressed: { label: "Stressed", tint: "peach", icon: Gauge, line: "Your heart rate is well above your resting level while still. A few slow breaths can help." },
  active: { label: "Active", tint: "sand", icon: Footprints, line: "You’re on the move." },
};

export function StateCard({ state, timeZone, onOpen, onBreathe }: { state: DayState; timeZone: string; onOpen: () => void; onBreathe: () => void }) {
  const c = useCalm();
  const total = ORDER.reduce((n, k) => n + state.mix[k], 0);
  const now = state.now ? LOOK[state.now.key] : null;
  if (!now && total < 15) return null;
  const title = now ? `Right now: ${now.label}` : "Your day so far";
  const spoken = ORDER.filter((k) => state.mix[k] > 0).map((k) => `${LOOK[k].label} ${minutesText(state.mix[k])}`).join(", ");
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
            {ORDER.map((k) => (state.mix[k] > 0 ? <View key={k} style={{ flexGrow: state.mix[k], backgroundColor: c.vivid[LOOK[k].tint][0] }} /> : null))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 6, columnGap: 16 }}>
            {ORDER.map((k) => (
              <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.vivid[LOOK[k].tint][0] }} />
                <Txt size={13} lineHeight={18} style={{ color: c.sub }}>
                  {LOOK[k].label}
                </Txt>
                <Txt size={13} lineHeight={18} weight={600} style={{ color: c.ink, fontVariant: ["tabular-nums"] }}>
                  {minutesText(state.mix[k])}
                </Txt>
              </View>
            ))}
          </View>
        </View>
      )}
    </HomeCard>
  );
}
