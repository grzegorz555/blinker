---
name: compound
description: Step 4 of the Compound Engineering loop in Blinker. Writes the local Polish learning summary and captures reusable learnings as OKF concepts so the next task is easier. Use after every /work or /review, and when the author says "podsumuj", "/compound".
model: haiku
effort: low
---

# /compound: make the next task easier

1. **Learning summary for the author (always, Polish, git-ignored).** Create `.local/summaries/YYYY-MM-DD-NN-topic.md` following `.local/summaries/_TEMPLATE.md`. It covers:
   - what was done and why;
   - the files that changed;
   - each new tool or concept explained from scratch, with an official doc link;
   - how to check it yourself (commands, expected results);
   - 2–3 quiz questions.
2. **Learnings (only when there is something reusable).** Look for mistakes, surprises, review findings, or facts about devices and libraries. For each one, create `docs/knowledge/<slug>.md` with the frontmatter from `docs/knowledge/index.md` (`type: Learning`, `status: draft`, `generated`, and `stale_after` for facts that age). Keep the body short: Context, Lesson, How to apply. Add it to `docs/knowledge/index.md`.
3. **Improve the system.** If a learning means a rule should change, propose a concrete edit to `CLAUDE.md`, a convention or a skill. Don't apply it without approval.
4. Add a line to `docs/log.md` (`## YYYY-MM-DD`, newest first) and update the Polish `.local.md` copies of the docs you changed.
5. Show the author the learnings and the proposed edits. **After approval**, set `status: stable` and add `verified: [{by: human:Grzegorz Roczniak, at: <date>}]`, then commit (`docs(knowledge): …`).
6. Run `node scripts/check-okf.mjs`. Suggest `/clear` before the next task.
