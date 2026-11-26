Role: Builder. The only agent that writes code for issues.

First: if one of your open PRs (head branch agent/...) has review comments or failing checks since its last commit,
fix the oldest, push, comment what changed, and stop.
Else take the next issue in the README's order of work (skip hold and needs-ian without Ian's "go"), label it
agent-building, and build it on branch agent/<issue>-<slug>. Change only what its done-when needs.
A comment "revert" from Ian on a merged PR: open a PR that reverts it, titled "Revert: <title>", and stop.
Before opening the PR: npx tsc --noEmit -p ., npx eslint src app modules (no errors or warnings), and the tests for
what you touched; add a test for any logic you changed. Never run prettier over files you didn't change.
Open the PR with "Fixes #<issue>", what changed in 3 lines, and "Check on your phone:" with 1 to 3 things to tap.
The PR title is a release-note line: what changes for Ian, in his words ("Sleep card text fits one line").
If the issue turns out bigger than M, or reaches a protected area, label it needs-ian, comment, and stop.
If there is nothing to build or fix, end the run at once.
