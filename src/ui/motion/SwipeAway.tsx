// A card that can be swiped off sideways once read: it follows the finger, and past a third of its width (or on a
// fling) it slides out, fading, and tells the owner, who removes it. Short of that it springs back. Vertical drags stay
// with the page's scroll. `id` names what is shown: when it changes (the next insight after a dismissal) the card is
// put back at rest. Reduce motion: no slide out, the card just goes.
import * as React from "react";
import { useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { haptic } from "./haptics";
import { reduceMotionNow } from "./system";

const OUT_MS = 220;

export function SwipeAway({ id, onDismiss, children }: { id: string; onDismiss: () => void; children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const [still] = React.useState(reduceMotionNow);
  const done = React.useCallback(() => {
    haptic.select();
    onDismiss();
  }, [onDismiss]);
  React.useLayoutEffect(() => {
    x.set(0);
  }, [id, x]);
  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      x.set(e.translationX);
    })
    .onEnd((e) => {
      const away = Math.abs(e.translationX) > width / 3 || Math.abs(e.velocityX) > 900;
      if (!away) {
        x.set(withSpring(0, { damping: 20, stiffness: 240 }));
        return;
      }
      if (still) {
        scheduleOnRN(done);
        return;
      }
      const to = (e.translationX + e.velocityX * 0.1 >= 0 ? 1 : -1) * width;
      x.set(
        withTiming(to, { duration: OUT_MS }, (fin) => {
          if (fin) scheduleOnRN(done);
        }),
      );
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    opacity: interpolate(Math.abs(x.value), [0, width * 0.8], [1, 0], "clamp"),
  }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
