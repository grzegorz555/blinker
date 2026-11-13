---
type: Backlog
title: Stages and backlog
description: The stage-by-stage delivery plan and ideas that are not specified yet.
tags: [work, planning]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
---

# Stages
| # | Stage | Outcome |
|---|---|---|
| 0 | Bootstrap ✅ (PR #1) | repo, conventions, OKF bundle, skills, CI skeleton |
| 1 | Angular skeleton + CI/CD: specs **001-app-skeleton**, **002-ci-verify**, **003-deploy** (Azure SWA, ADR-0003) | PWA, Transloco en/pl, Tailwind, ESLint with template a11y rules, Vitest, Playwright + axe. A versioned pre-push hook runs the gates locally, because branch protection isn't available on the Free plan. **CI:** `npm ci`, `npm audit`, lint, unit, build, `dist/` check (no `.md`/`.map`), e2e + axe. **CD:** preview deploy per PR (URL commented on the PR), header test on the preview, production deploy on merge to `main`. **Local verification:** `npm run verify` runs the same gates as CI. Dependabot for npm. |
| 1.5 | Mock-ups: spec **004-mockups** | Clickable HTML/Tailwind mock-ups in `docs/design/`, viewed on a real phone; we iterate on them with the author. Output: the visual direction and the final tokens. Free: no design tool is needed. |
| 2 | Board and input **without a camera** | board model and import, the friend's board, the **counting** machine (the default and the PoC mode; scanning comes after the PoC), Space/button input, text and TTS. Already usable with a switch. |
| 3 | Face-tracking spike | MediaPipe in a worker, a diagnostic screen with live blendshapes and head pose, measurements on Android Chrome and iOS Safari (FPS, battery, light, glasses). Ends with an ADR. |
| 4 | Signal detection + calibration | PoC signals first: LONG_BLINK, LOOK_AT_HAND, HEAD_NOD, HEAD_SHAKE; other head turns later; calibration wizard; profiles |
| 5 | Integration and UX | signals → actions, undo, confirmations, pause, audio mode for the "caregiver holds the phone" setup |
| 6 | Trial with the friend | tune the thresholds, capture learnings |

# Ideas (not specified)
- Board editor; importing a board from a photo.
- **Shortcuts for frequent words** (author, 2026-11-12: "do rozważenia" (to consider)): a word picked with one number instead of
  letter by letter. To design after the PoC, together with him.
- Word prediction for Polish; favorite phrases; sentence history.
- Capacitor build for Android and iOS.
- Better TTS voices. This would need a backend, so it requires a new ADR.
