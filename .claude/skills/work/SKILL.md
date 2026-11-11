---
name: work
description: Step 2 of the Compound Engineering loop in Blinker. Implements exactly one task from an approved tasks.md, with unit and e2e tests, runs the gates and commits locally. Use for "/work", "zrób następny task", "zaimplementuj zadanie N".
model: sonnet
effort: medium
---

# /work: implement one approved task

1. Make sure the spec in `docs/specs/NNN-*/` is approved. If unsure, ask.
2. Check the branch with `git branch --show-current`. It must be `feat/NNN-slug` (or the type the spec names), never `main`. If the branch doesn't exist, create it from an up-to-date `main`. Check that `git status` contains nothing unrelated; if it does, stop and ask.
3. **Route by the task's label** (`docs/conventions/ai-workflow.md`, Model routing):
   - `[sonnet]` or no label: do it here, inline (steps 4–8). Inline keeps the context, so nothing is read twice.
   - `[haiku]`: launch the `implementer-haiku` agent; `[opus]`: launch the `implementer-opus` agent. Give it a self-contained brief: branch, spec folder, task id and text. Then relay its report and go to step 8.
   - If a task fails its gates twice, **stop** and propose moving it up one level (haiku → sonnet → opus). Never switch silently.

   Read the task and the relevant learnings in `docs/knowledge/`. For non-trivial tasks, outline the approach in 3–5 bullets first.
4. Implement **only this task**:
   - follow `docs/conventions/frontend.md`, `accessibility.md`, `security.md`;
   - put new UI strings in both `en.json` and `pl.json`;
   - keep the domain logic in plain TypeScript, with time injected.
4a. Update `README.md` (status, features, how to run, test and verify) in the same commit if the task changes any of them.
5. Write the tests in the same change (`docs/conventions/testing.md`):
   - Vitest unit tests for every rule the task touches;
   - Playwright e2e tests with an axe scan for every user-visible path.
6. Run the gates and report honestly what passed, what failed, and what was not run: `cd src/web && npm run verify -- --quick`, and for app changes also `npm run build && npm run e2e:only`. CI runs the full `npm run verify` on the PR.
7. Tick the task in `tasks.md`. **Don't commit yet:** leave the changes uncommitted, so the author sees them in the IDE.
   Show a short diff summary and the proposed commit message (Conventional Commit, ` [gen]` suffix).
8. **Commit only after the author's OK**, one commit per task. Push and open a PR only when the author asks. Then suggest `/review`.
