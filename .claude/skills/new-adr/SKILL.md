---
name: new-adr
description: Creates a new Architecture Decision Record in docs/adr/ (OKF type Decision) from the template. Use when a technology or architecture decision is being made or proposed.
---

# New ADR

1. Find the next number: the highest `docs/adr/NNNN-*.md` + 1.
2. Copy `docs/adr/0000-template.md` to `docs/adr/NNNN-short-slug.md` and fill in the frontmatter:
   - `type: Decision`;
   - `status: draft` while it is Proposed, `stable` once Accepted;
   - `generated`.
3. Present 2–3 options with pros and cons and a recommendation. **The author decides.** Never mark the ADR Accepted without them.
4. Once it is accepted, add `verified: [{by: human:grzegorz555, at: <date>}]`. If it supersedes an older ADR, set the old one to `status: deprecated` and "Superseded by ADR-NNNN".
5. Add it to `docs/adr/index.md`. If the architecture changes, update `docs/architecture.md`.
6. Keep it on one screen. Fill in "Revisit when" and "Learning resources" (official docs).
