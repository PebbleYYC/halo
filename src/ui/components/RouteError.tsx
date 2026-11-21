// What a screen shows when it throws while drawing, instead of going blank: a plain line, the error's own message (so
// a screenshot says what broke), and Try again. Exported as `ErrorBoundary` from the tab routes (Expo Router's
// per-route boundary).
import * as React from "react";
import { View } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";
import { Txt } from "@/ui";
import { useCalm } from "@/ui/calm";
import { CalmButton } from "@/screens/settings/calmKit";

export function RouteError({ error, retry }: ErrorBoundaryProps) {
  const c = useCalm();
  React.useEffect(() => {
    console.error("[screen]", error);
  }, [error]);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12, backgroundColor: c.ground }}>
      <Txt size={20} lineHeight={25} weight={600} align="center" style={{ color: c.ink }}>
        This screen hit a problem
      </Txt>
      <Txt size={13} lineHeight={18} align="center" style={{ color: c.sub }} selectable>
        {String(error?.message ?? error).slice(0, 300)}
      </Txt>
      <CalmButton onPress={() => void retry()}>Try again</CalmButton>
    </View>
  );
}
