// What the update dialog lists from a release's notes (UpdatePrompt.tsx).
/** The release's own notes as bullet lines, without the build boilerplate older releases carried. */
export function cleanNotes(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter((l) => l && !/^Built from\b/i.test(l) && !/Install Halo\.apk/i.test(l));
}
