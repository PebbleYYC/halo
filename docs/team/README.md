# The Halo team

Four Claude agents improve Halo through GitHub; Ian approves issues and merges PRs. Nothing ships until he merges.
Each agent runs as a scheduled task with `shared.md` followed by its own file. Changing how an agent works is a PR here.

| Agent | Runs (America/Regina) | Produces |
| --- | --- | --- |
| [Scout](scout.md) | Mon, Thu 06:41 | Up to 3 `proposal` issues |
| [Builder](builder.md) | Tue–Sat 05:47 | One PR for one `approved` issue |
| [Reviewer](reviewer.md) | Tue–Sat 08:53 | Reviews; `ready-for-you` on what passes |
| [Polisher](polisher.md) | Wed, Sat 11:37 | One small `polish` PR, or a proposal |

Labels: `proposal` (waiting for Ian) → `approved` (Builder may take it) → `agent-building` → PR →
`ready-for-you` (reviewed, Ian tests and merges). `polish` marks copy, layout and visual fixes.

Ian's 15 minutes: approve or close proposals with a word on why; merge `ready-for-you` PRs and check the
"Check on your phone" lines; file any bug he sees as an `approved` issue, which goes first.

Budget: no money; under half of Ian's weekly usage. Check Settings › Usage on day 3 and 7 of each week:
35–50% → Reviewer 3 runs a week, Scout 1; over 50% → pause the Polisher, halve the Builder.
