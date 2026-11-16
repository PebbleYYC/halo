// The tab bar, floated over the tab pages so its Liquid Glass can refract them. Glass reads its backdrop from a
// GlassTarget (src/ui/glass.tsx) and must sit outside that target, so the bar can't be drawn by the tab navigator
// itself (it would be inside the target with the pages). Instead the navigator's `tabBar` is TabBarBridge, which
// draws nothing and hands its props (state, navigation, descriptors) to FloatingTabBar, drawn as the target's overlay
// in the tabs layout.
import * as React from "react";
import { usePathname, useRouter } from "expo-router";
import { TabBar, type NavTabBarProps } from "./TabBar";
import { activeTabName, hrefOf } from "./tabRouting";

type Listener = () => void;
let current: NavTabBarProps | null = null;
const listeners = new Set<Listener>();

/** Which bridge published last: only it may clear the bar when it goes. */
let owner: object | null = null;
function publish(props: NavTabBarProps, by: object) {
  current = props;
  owner = by;
  listeners.forEach((l) => l());
}

/** The navigator's `tabBar`: passes the bar's props on and draws nothing in the navigator. */
export function TabBarBridge(props: NavTabBarProps) {
  // Before paint, so a tab press lights its tab in the same frame.
  const [me] = React.useState(() => ({}));
  React.useLayoutEffect(() => {
    publish(props, me);
  });
  // Gone with the tabs (onboarding, a reset): no stale bar on the way back. Only when this bridge is still the one
  // that published: when the tabs remount, the old bridge's cleanup runs after the new one has published, and
  // clearing then took the bar (and every tap on it) away until the navigator next rendered.
  React.useEffect(
    () => () => {
      if (owner !== me) return;
      current = null;
      owner = null;
      listeners.forEach((l) => l());
    },
    [me],
  );
  return null;
}

function useBarProps(): NavTabBarProps | null {
  return React.useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}

/**
 * The bar itself, over the pages at the screen's foot. Render it as the pages' GlassTarget overlay, so its glass is
 * live. The tab list comes from the navigator (via the bridge), but the lit tab and the navigation are driven by the
 * router's live path: the bridged navigator snapshot can detach and go stale, which once left the wrong tab lit and
 * taps dead with no way to recover.
 */
export function FloatingTabBar({ onAction, actionLabel }: { onAction?: () => void; actionLabel?: string }) {
  const props = useBarProps();
  const pathname = usePathname();
  const router = useRouter();
  if (!props) return null;
  const name = activeTabName(pathname, props.state.routes.map((r) => r.name));
  const liveIndex = name ? props.state.routes.findIndex((r) => r.name === name) : -1;
  const state = liveIndex >= 0 ? { ...props.state, index: liveIndex } : props.state;
  const navigate = (routeName: string) => router.navigate(hrefOf(routeName));
  return <TabBar {...props} state={state} navigate={navigate} onAction={onAction} actionLabel={actionLabel} floating />;
}
