// Today's "From your patterns": once the Coach is set up, the findings in the person's own nights and journal
// (src/queries/patterns.ts), in the Coach's words when it has rewritten them (src/coach/patterns.ts), as the same
// carousel card as the day's insights with "Ask Coach" and "Dismiss" under each. Nothing shows without the Coach or
// without a finding. The words never swap while the card is on screen: a rewrite asked now is shown next time.
import * as React from "react";
import { BedDouble, CalendarDays, Clock, NotebookPen, type LucideIcon } from "lucide-react-native";
import { dismissedPatterns, dismissPattern, patternWords, savedWords } from "@/coach/patterns";
import { useHasCoachKey } from "@/coach/session";
import { getPatterns, type Pattern, type PatternKind } from "@/queries/patterns";
import type { QueryCtx } from "@/queries/ctx";
import { useQuery } from "@/state/app";
import { HomeInsight, type HomeInsightItem } from "@/ui/components/HomeInsight";
import type { CalmTint } from "@/ui/calm";

const TINT: Record<Pattern["subject"], CalmTint> = { recovery: "mint", sleep: "lavender", strain: "peach" };
const ICON: Record<PatternKind, LucideIcon> = { weekday: CalendarDays, bedtime: BedDouble, timing: Clock, behaviour: NotebookPen };

async function patternCards(ctx: QueryCtx) {
  const patterns = await getPatterns(ctx);
  const [words, dismissed] = await Promise.all([savedWords(patterns), dismissedPatterns(ctx.now)]);
  // Not rewritten yet: ask now, show the app's own words until the next open.
  if (!words && patterns.length) void patternWords(patterns);
  return { patterns, words: words ?? {}, dismissed };
}

export function PatternsCard({ day, go }: { day: string; go: (href: string) => void }) {
  const coach = useHasCoachKey();
  if (!coach) return null;
  return <Cards day={day} go={go} />;
}

function Cards({ day, go }: { day: string; go: (href: string) => void }) {
  const q = useQuery(patternCards, [day], `patterns:${day}`);
  const [gone, setGone] = React.useState<string[]>([]);
  const data = q.data;
  const items = React.useMemo<(HomeInsightItem & { ask: string })[]>(() => {
    if (!data) return [];
    return data.patterns
      .filter((p) => !(p.key in data.dismissed) && !gone.includes(p.key))
      .map((p) => ({ key: p.key, title: data.words[p.key]?.title ?? p.title, body: data.words[p.key]?.body ?? p.body, tint: TINT[p.subject], icon: ICON[p.kind], ask: p.ask }));
  }, [data, gone]);
  const actions = React.useMemo(
    () => [
      {
        label: "Ask Coach",
        primary: true,
        onPress: (it: HomeInsightItem) => {
          const ask = items.find((x) => x.key === it.key)?.ask ?? it.title;
          go(`/coach?q=${encodeURIComponent(ask)}`);
        },
      },
      {
        label: "Dismiss",
        onPress: (it: HomeInsightItem) => {
          setGone((g) => [...g, it.key]);
          void dismissPattern(it.key);
        },
      },
    ],
    [items, go],
  );
  if (!items.length) return null;
  // Keyed by the set, so a dismissal never leaves the carousel on an index past the end.
  return <HomeInsight key={items.map((it) => it.key).join()} items={items} label="Patterns" eyebrow="From your patterns" actions={actions} />;
}
