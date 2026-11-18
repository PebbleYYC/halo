// Today's "Coach spotted": once the Coach is set up, the patterns its model found in the person's own nights and journal
// and the app confirmed (src/coach/discover.ts), as the same carousel card as the day's insights with "Ask Coach" and
// "Dismiss" under each. Nothing shows without the Coach or without a finding that held up. Opening Home on a day the
// Coach hasn't looked yet starts its look; the card appears when it's done.
import * as React from "react";
import { Brain, Flame, HeartPulse, Moon, type LucideIcon } from "lucide-react-native";
import { discover, dismissedFindings, dismissFinding, lookedToday, savedFindings, SHOW_DAYS, subscribeFindings } from "@/coach/discover";
import type { FindingSubject } from "@/coach/discoverText";
import { useHasCoachKey } from "@/coach/session";
import { addDays } from "@/lib/time";
import type { QueryCtx } from "@/queries/ctx";
import { useQuery } from "@/state/app";
import { HomeInsight, type HomeInsightItem } from "@/ui/components/HomeInsight";
import type { CalmTint } from "@/ui/calm";

const TINT: Record<FindingSubject, CalmTint> = { recovery: "mint", sleep: "lavender", strain: "peach", stress: "sky" };
const ICON: Record<FindingSubject, LucideIcon> = { recovery: HeartPulse, sleep: Moon, strain: Flame, stress: Brain };

async function findingCards(ctx: QueryCtx) {
  const [saved, dismissed] = await Promise.all([savedFindings(), dismissedFindings(ctx.now)]);
  // Not looked today: look now (once; discover() shares a run in flight), show what's saved meanwhile.
  if (!lookedToday(saved, ctx.today)) void discover(ctx);
  const fresh = saved && saved.day >= addDays(ctx.today, -SHOW_DAYS) ? saved.findings : [];
  return fresh.filter((f) => !(f.key in dismissed));
}

export function PatternsCard({ day, go }: { day: string; go: (href: string) => void }) {
  const coach = useHasCoachKey();
  if (!coach) return null;
  return <Cards day={day} go={go} />;
}

function Cards({ day, go }: { day: string; go: (href: string) => void }) {
  const [runs, setRuns] = React.useState(0);
  React.useEffect(() => subscribeFindings(() => setRuns((n) => n + 1)), []);
  const q = useQuery(findingCards, [day, runs], `findings:${day}:${runs}`);
  const [gone, setGone] = React.useState<string[]>([]);
  const findings = React.useMemo(() => (q.data ?? []).filter((f) => !gone.includes(f.key)), [q.data, gone]);
  const items = React.useMemo<HomeInsightItem[]>(() => findings.map((f) => ({ key: f.key, title: f.title, body: f.body, tint: TINT[f.subject], icon: ICON[f.subject] })), [findings]);
  const actions = React.useMemo(
    () => [
      {
        label: "Ask Coach",
        primary: true,
        onPress: (it: HomeInsightItem) => go(`/coach?q=${encodeURIComponent(findings.find((f) => f.key === it.key)?.ask ?? it.title)}`),
      },
      {
        label: "Dismiss",
        onPress: (it: HomeInsightItem) => {
          setGone((g) => [...g, it.key]);
          void dismissFinding(it.key);
        },
      },
    ],
    [findings, go],
  );
  if (!items.length) return null;
  // Keyed by the set, so a dismissal never leaves the carousel on an index past the end.
  return <HomeInsight key={items.map((it) => it.key).join()} items={items} label="Coach spotted" eyebrow="Coach spotted" actions={actions} />;
}
