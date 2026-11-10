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
| 0 | Bootstrap (done when merged) | repo, conventions, OKF bundle, skills, CI skeleton |
| 1 | Angular skeleton + CI/CD | PWA, Transloco en/pl, Tailwind, spartan, ESLint with template a11y rules, Vitest, Playwright + axe; hosting ADR accepted. **CI:** `npm ci`, `npm audit`, lint, unit, build, `dist/` check (no `.md`/`.map`), e2e + axe. **CD:** preview deploy per PR (URL commented on the PR), header test on the preview, production deploy on merge to `main`. **Local verification:** `npm run verify` runs the same gates as CI. Dependabot for npm. |
| 2 | Board and input **without a camera** | board model and import, the friend's board, scanning and counting machines, Space/button input, text and TTS. Already usable with a switch. |
| 3 | Face-tracking spike | MediaPipe in a worker, a diagnostic screen with live blendshapes and head pose, measurements on Android Chrome and iOS Safari (FPS, battery, light, glasses). Ends with an ADR. |
| 4 | Signal detection + calibration | LONG_BLINK, HEAD_NOD, LOOK_AT_HAND, head turns; calibration wizard; profiles |
| 5 | Integration and UX | signals → actions, undo, confirmations, pause, audio mode for the "caregiver holds the phone" setup |
| 6 | Trial with the friend | tune the thresholds, capture learnings |

# Ideas (not specified)
- Board editor; importing a board from a photo.
- Word prediction for Polish; favorite phrases; sentence history.
- Capacitor build for Android and iOS.
- Better TTS voices. This would need a backend, so it requires a new ADR.
