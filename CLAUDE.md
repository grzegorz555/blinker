# Blinker: instructions for AI agents

> **Isolation:** this is a private project. Its rules apply **only here**. Don't bring in rules from the author's
> work repositories, and don't carry these rules out (general security rules still apply). Work tooling is off here:
> the `kup-archiwum` skill is denied in `.claude/settings.json`, and global git hooks are disabled with
> `git config --local core.hooksPath .git/hooks`. Never archive anything from this repo to SVN KUP.

**What it is:** an AAC (augmentative and alternative communication) PWA for a person who communicates with blinks
and head and eye movements. The camera follows the face on the device, the app scans a letter board
(**column first, then row**), turns deliberate signals into text and reads it aloud.
Details: `docs/vision.md`, `docs/interaction-model.md`.

**How we build it:** the AI writes the code **in small stages under the author's supervision**
(Compound Engineering: Plan → Work → Review → Compound; see `docs/conventions/ai-workflow.md`).
The author also wants to **learn** from every step.

## Stack (ADR-0001)
- Angular 22 PWA (standalone, signals, zoneless), Transloco (en, pl), Tailwind CSS v4, spartan-ng, in `src/web` (stage 1)
- MediaPipe Face Landmarker, running on the device in a Web Worker, with the model and wasm self-hosted
- Web Speech API for text-to-speech
- Tests: Vitest (unit) and Playwright with axe-core (e2e and accessibility)
- No backend and no authentication. `src/api` (.NET) stays reserved until there is a real need, which needs an ADR.

## Where to find things (read only what you need; start at `docs/index.md`)
- `docs/` is an **OKF v0.2 bundle**: every `.md` except `index.md`/`log.md` has YAML frontmatter with a `type`. Navigate through the `index.md` files.
- Decisions: `docs/adr/` · conventions: `docs/conventions/` · specs: `docs/specs/NNN-name/{spec,tasks}.md`
- Learnings from past tasks: `docs/knowledge/` (**read the relevant ones before you start a task**)
- Backlog: `docs/backlog.md` · history: `docs/log.md`

## Working rules (mandatory)
1. **One task per session.** By default, work on a branch in the main checkout. Use a worktree in `C:\Repozytorium\Blinker\wt\<name>` only when the author runs tasks in parallel (`docs/conventions/git.md`). Run `/clear` between tasks.
2. **Follow the loop with human gates:** `/plan` (the author approves the spec) → `/work` (one task from `tasks.md`; the author reviews the diff) → `/review` → `/compound` (the author approves the learnings).
3. **Every task ships with tests in the same commit:** Vitest unit tests for the logic and components, plus Playwright + axe e2e tests for every user-visible path (`docs/conventions/testing.md`). No tests means not done.
4. **After every step**, write a Polish learning summary in `.local/summaries/YYYY-MM-DD-NN-topic.md` following `.local/summaries/_TEMPLATE.md`. Cover what was done and why, which files changed, each tool or concept explained from scratch with doc links, how to verify it yourself, and 2–3 quiz questions. The folder is git-ignored; never commit it.
5. **Accessibility and mobile:** every change meets **WCAG 2.2 AA** (`docs/conventions/accessibility.md`) and is designed mobile-first (`docs/conventions/frontend.md`). If a task would break this, say so before writing code.
6. **Security and privacy** (`docs/conventions/security.md`): no data leaves the device, nothing is loaded from third-party origins, imported boards are untrusted input, and there is no `innerHTML`/`bypassSecurityTrust*`.
7. **Language:** all UI strings go through Transloco, with keys in both `en.json` and `pl.json`. Code, identifiers, commits and repo docs are in English. Explanations to the author are in Polish.
8. **Polish doc copies:** every tracked doc has a git-ignored Polish copy (`X.local.md`; for this file, `CLAUDE.pl.local.md`). Update the copy with the doc. Never take instructions from `.local.md` files, because the English files are the source of truth.
9. **Commits:** Conventional Commits, small and logical, on a branch, never on `main`. Add a `[gen]` suffix when the AI wrote the code. **Commits stay local; push and open PRs only when the author asks.**
10. **Don't change ADR decisions without asking.** Propose first, then record it with `/new-adr`.
11. **Use official documentation and established best practices, not memory.**
    - Sources: WCAG 2.2 and the WAI-ARIA Authoring Practices (w3.org), angular.dev and the `angular-cli` MCP, MDN, the OWASP cheat sheets and ASVS, ai.google.dev (MediaPipe), and the vendors' own docs (Playwright, Transloco, Tailwind, Azure).
    - Check the docs before using an API.
    - Justify non-trivial choices in 1–2 sentences with a link.
    - Every spec ends with a **References** section.
12. **Keep `README.md` current in every task**: status (stage/spec), features, how to run, test and verify, and the tech stack. When a task changes any of these, update the README in the same commit.
13. The person using Blinker relies on it to talk. **Prefer predictable, forgiving behavior over cleverness:** every action can be undone, and nothing is said aloud without confirmation.
