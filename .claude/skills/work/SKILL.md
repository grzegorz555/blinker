---
name: work
description: Step 2 of the Compound Engineering loop in Blinker. Implements exactly one task from an approved tasks.md, with unit and e2e tests, runs the gates and commits locally. Use for "/work", "zrób następny task", "zaimplementuj zadanie N".
---

# /work: implement one approved task

1. Make sure the spec in `docs/specs/NNN-*/` is approved. If unsure, ask.
2. Check the branch with `git branch --show-current`. It must be `feat/NNN-slug` (or the type the spec names), never `main`. If the branch doesn't exist, create it from an up-to-date `main`. Check that `git status` contains nothing unrelated; if it does, stop and ask.
3. Read the task and the relevant learnings in `docs/knowledge/`. For non-trivial tasks, outline the approach in 3–5 bullets first.
4. Implement **only this task**:
   - follow `docs/conventions/frontend.md`, `accessibility.md`, `security.md`;
   - put new UI strings in both `en.json` and `pl.json`;
   - keep the domain logic in plain TypeScript, with time injected.
4a. Update `README.md` (status, features, how to run, test and verify) in the same commit if the task changes any of them.
5. Write the tests in the same change (`docs/conventions/testing.md`):
   - Vitest unit tests for every rule the task touches;
   - Playwright e2e tests with an axe scan for every user-visible path.
6. Run the gates and report honestly what passed, what failed, and what was not run: `ng lint`, `ng test --watch=false`, `ng build`, `npx playwright test`, `node scripts/check-okf.mjs`.
7. Commit locally: one Conventional Commit for the task, with the ` [gen]` suffix. **Don't push.**
8. Tick the task in `tasks.md`. Show the author a short diff summary and ask them to review it. Then suggest `/review`.
