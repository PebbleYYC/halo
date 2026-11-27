# The Halo team

Four Claude agents improve Halo and ship it on their own: they find the work, build it, review it, merge it, and
the merge releases it (build-apk.yml). Ian uses the released app and steers through issues and comments.
Each agent runs as a scheduled task with `shared.md` followed by its own file. Changing how an agent works is a PR here.

| Agent | Runs (America/Regina) | Produces |
| --- | --- | --- |
| [Scout](scout.md) | Mon–Sat 04:41 | Tops the `todo` queue up to 3; never code |
| [Builder](builder.md) | Tue–Sat 05:47 | One PR for one issue |
| [Reviewer](reviewer.md) | Tue–Sat 08:53 | Reviews; merges what passes, which releases it |
| [Polisher](polisher.md) | Wed, Sat 11:37 | One small `polish` PR, or a `todo` issue |

Labels: `todo` (Builder may take it) → `agent-building` → PR → merged and released by the Reviewer.
`needs-ian`: the change is in a protected area (below); it waits until Ian comments "go".
`hold`: Ian's stop sign on an issue or PR; agents leave it alone. `polish`: copy, layout or visual fixes.

Order of work: an issue Ian filed himself, first (a bug he hit in a release above all); then fixes the Reviewer asked
for; then `todo` bugs, polish, features, oldest first.

Ian's part: use the app; file what's wrong as an issue in a line or two (a screenshot helps); comment "revert" on a
merged PR to have it undone; label anything `hold` to stop it.

Protected areas, never merged without Ian's "go": scoring and health math, deleting or migrating stored data,
Health Connect import and sync, Android permissions, new dependencies, notifications' scheduling, release and CI.

Budget: no money; under half of Ian's weekly usage. Check Settings › Usage on day 3 and 7 of each week:
35–50% → Reviewer 3 runs a week, Scout 1; over 50% → pause the Polisher, halve the Builder.
