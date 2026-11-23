// Opening a route from outside its screen (a notification, Today's links). A tab's own page ("/journal?log=medicine")
// is navigated to, which switches to the one mounted tab and hands it the params; pushing it stacked a second Journal
// over a preloaded one, and that copy drew nothing but black behind the log sheet. Anything else is pushed.
import { router, type Href } from "expo-router";

const TAB_ROOTS = new Set(["/", "/tab-sleep", "/tab-activity", "/health", "/journal"]);

/** "/journal?log=water" → "/journal". */
export const routePath = (href: string) => href.split(/[?#]/)[0] || "/";

export const isTabRoot = (href: string) => TAB_ROOTS.has(routePath(href));

export function openRoute(href: string): void {
  if (isTabRoot(href)) router.navigate(href as Href);
  else router.push(href as Href);
}
