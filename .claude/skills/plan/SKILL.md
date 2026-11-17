---
name: plan
description: Step 1 of the Compound Engineering loop in Blinker. Turns a stage or feature into docs/specs/NNN-slug/{spec,tasks}.md for the author to approve. Use when the author says "zaplanuj", "nowy etap", "nowa funkcja", "/plan <topic>".
model: opus
effort: high
---

# /plan: write a spec and tasks (no code)

1. Read `docs/index.md`, then only what is relevant: `docs/backlog.md`, the related ADRs, `docs/interaction-model.md`, and **the learnings in `docs/knowledge/` whose tags match the topic**.
2. Ask the author **at most 3–4 questions** about the unclear points. Propose defaults for the rest.
3. Pick the next number `NNN` (the highest folder in `docs/specs/` + 1) and create `docs/specs/NNN-slug/spec.md`:
   - frontmatter: `type: Spec`, `title`, `description`, `tags`, `status: draft`, `generated: {by: agent:<model>, at: <date>}`;
   - sections: Goal · Scope · Rules R1…Rn · UI and accessibility notes · Security and privacy notes · Acceptance criteria (testable checklist) · **Test plan** (unit cases per rule, e2e paths + axe) · Out of scope · **References** (the official docs and best-practice sources behind the rules: WCAG success criteria, APG patterns, angular.dev, MDN, OWASP, vendor docs). Verify the links. Don't write them from memory.
4. Create `tasks.md` (`type: Task List`). Use 3–8 tasks. Start each task line with a **difficulty label**, `**T1 [sonnet]: …**`, chosen by the criteria in `docs/conventions/ai-workflow.md` (Model routing). `/work` picks the model from it. Make each task:
   - one commit, with its own unit tests (the e2e paths stay in the Test plan for the next e2e pass);
   - followed by a line *"To understand:"* naming the concepts the author will learn.
5. If an architectural decision comes up, use `/new-adr` (status Proposed) and let the author decide.
6. Add the spec to `docs/specs/index.md`. Propose the branch name `feat/NNN-slug`.
7. **Stop.** The author approves the spec and the tasks before `/work`. Then write the Polish summary for this step (see `/compound`, point 1).
