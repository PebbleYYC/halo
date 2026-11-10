// Pure mapping between the router's live path and the tab bar's tabs. The bar's lit tab and its navigation are driven
// by the router (see TabBarHost), not the handed-in navigator snapshot, which can detach and go stale.
import type { Href } from "expo-router";

/** A tab route's name to its href. The tabs sit in a pathless group, so each is at the root: "index" is "/". */
export const hrefOf = (name: string): Href => (name === "index" ? "/" : (`/${name}` as Href));

/** The live active tab route name from the router's path, or null for a path that isn't one of the bar's tabs. */
export function activeTabName(pathname: string, routeNames: string[]): string | null {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (!seg) return routeNames.includes("index") ? "index" : null;
  return routeNames.includes(seg) ? seg : null;
}
