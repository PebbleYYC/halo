// Re-tapping the current tab scrolls its page to the top. useScrollToTop couldn't reach the Reanimated scroll views,
// so the bar signals here and the focused page scrolls itself.
import * as React from "react";
import type { ScrollView } from "react-native";
import { useNavigation } from "expo-router";

type Listener = () => void;
const listeners = new Set<Listener>();

/** The tab bar: its selected tab was tapped again. */
export function emitTabReselect(): void {
  for (const l of [...listeners]) l();
}

/** A tab page: on a re-tap of its tab while it's showing, scroll `ref` back to the top. */
export function useScrollTopOnReselect(ref: React.RefObject<ScrollView | null>): void {
  const navigation = useNavigation();
  React.useEffect(() => {
    const l: Listener = () => {
      if (!navigation.isFocused()) return;
      ref.current?.scrollTo({ y: 0, animated: true });
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [navigation, ref]);
}
