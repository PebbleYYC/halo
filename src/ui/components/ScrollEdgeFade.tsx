// The scroll edge at a screen's foot, as iOS draws it under floating controls (the tab bar, a workout's round
// buttons): the page fades into its ground colour, so content that scrolls under the controls never fights their
// labels. Put it inside the GlassTarget's content, after the page, so the glass above bends the faded page rather
// than the raw text. One static gradient: nothing moves and nothing redraws.
import * as React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { alpha } from "@/lib/utils";
import { useCalm } from "@/ui/calm";

/** `height`: from the screen's bottom edge to `fade` px above the controls' top; solid ground below that. */
export function ScrollEdgeFade({ height, fade }: { height: number; fade?: number }) {
  const c = useCalm();
  const soft = fade ? Math.min(1, fade / height) : 0.45;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[alpha(c.ground, 0), alpha(c.ground, 0.92), c.ground]}
      locations={[0, soft, 1]}
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, height }}
    />
  );
}
