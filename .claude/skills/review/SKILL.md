---
name: review
description: Step 3 of the Compound Engineering loop in Blinker. Runs the code-reviewer agent in a fresh context on the current branch and relays findings. Use for "/review", "zrób review", before asking to push.
model: haiku
effort: low
---

# /review: independent review

1. Launch the `code-reviewer` agent. Give it the branch name and the spec folder.
2. Relay its findings to the author **in Polish**, most important first. Don't fix anything yet.
3. The author picks what to apply. Blocking findings go back to `/work`, as a follow-up commit on the same branch.
4. If a finding reveals a pattern that could repeat, note it for `/compound`.
