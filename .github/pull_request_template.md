## What and why
<!-- Stage / spec: docs/specs/NNN-… · task(s) from tasks.md -->

## How to verify
<!-- commands, URLs, expected result -->

## Checklist
- [ ] One stage/spec per PR, on a feature branch; commits are small Conventional Commits (`[gen]` if AI-written)
- [ ] Unit tests (Vitest) for every rule touched; e2e (Playwright) + axe for every user-visible path
- [ ] Gates green: lint, unit, build, e2e, `node scripts/check-okf.mjs`
- [ ] WCAG 2.2 AA + AAC rules (`docs/conventions/accessibility.md`); checked at 360/390 px portrait and landscape
- [ ] Privacy/security (`docs/conventions/security.md`): nothing leaves the device, no third-party origins, board input validated, no personal data about the user in the repo
- [ ] UI strings in `en.json` and `pl.json`
- [ ] Docs/ADRs/learnings updated; `docs/log.md` entry
