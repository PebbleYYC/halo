// "How hard did it feel?" on a strength session (src/lib/sessionRpe.ts): five capsules, the answer kept on the phone.
import * as React from "react";
import { View } from "react-native";
import { RPE_LEVELS, setRpe, useRpe } from "@/lib/sessionRpe";
import { Chips } from "@/screens/journal/controls";
import { SectionShell } from "@/ui";
import { Sentence } from "./calmKit";

export function EffortCard({ session }: { session: string }) {
  const rpe = useRpe(session);
  return (
    <SectionShell variant="card" title="How hard did it feel?">
      <View style={{ gap: 10 }}>
        <Chips label="Effort" options={RPE_LEVELS.map(([v, l]) => [String(v), l] as const)} value={rpe == null ? "" : String(rpe)} onChange={(v) => void setRpe(session, typeof v === "string" && v ? Number(v) : null)} />
        <Sentence size={13}>Heart rate undercounts lifting. Your rating helps the Coach read the session.</Sentence>
      </View>
    </SectionShell>
  );
}
