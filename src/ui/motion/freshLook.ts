// Which screens have just been looked at. Tabs stay mounted for the life of the app, so motion that explains an
// arrival (rings drawing on) would otherwise play once per launch and never again. A look is "fresh" when the last one
// was a while ago: coming back to a tab after a few minutes draws the rings on, flicking between tabs does not.
// Nothing here loops — each look animates once and settles (DESIGN.md: motion explains a change).

/** How long a screen stays just-looked-at. */
export const FRESH_MS = 5 * 60_000;

const seen = new Map<string, number>();

/** True on the first look at `key`, or when the last was over `within` ago; records this look either way. */
export function freshLook(key: string, within = FRESH_MS, at = Date.now()): boolean {
  const last = seen.get(key);
  seen.set(key, at);
  return last === undefined || at - last >= within;
}

/** Forget every look, so the next is fresh (tests). */
export function forgetLooks(): void {
  seen.clear();
}
