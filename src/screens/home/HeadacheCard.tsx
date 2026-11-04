// Today's headache-risk card: only on a Medium or High day (today's, else tomorrow's), with the main reason. Opens
// the Headache risk page.
import * as React from "react";
import { CloudRain } from "lucide-react-native";
import { getHeadache } from "@/queries/headache";
import { useQuery } from "@/state/app";
import { Txt } from "@/ui";
import { useCalm } from "@/ui/calm";
import { LEVEL } from "../health/Headache";
import { HomeCard } from "./controls";

export function HeadacheCard({ onOpen }: { onOpen: () => void }) {
  const c = useCalm();
  const { data: vm } = useQuery((ctx) => getHeadache(ctx), [], "headache");
  const pick = vm?.today && vm.today.level !== "low" ? { when: "today", r: vm.today } : vm?.tomorrow && vm.tomorrow.level !== "low" ? { when: "tomorrow", r: vm.tomorrow } : null;
  if (!pick) return null;
  const l = LEVEL[pick.r.level];
  const title = `Headache risk: ${l.word} ${pick.when}`;
  const why = pick.r.reasons.slice(0, 2).join(". ");
  return (
    <HomeCard icon={CloudRain} iconTint={l.tint} title={title} onPress={onOpen} accessibilityLabel={`${title}. ${why}. Opens Headache risk.`} gap={8}>
      {why ? (
        <Txt size={15} lineHeight={20} style={{ color: c.ink }}>
          {`${why}.`}
        </Txt>
      ) : null}
    </HomeCard>
  );
}
