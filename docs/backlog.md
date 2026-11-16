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
| 1 | Angular skeleton + CI/CD: specs **001-app-skeleton**, **002-ci-verify**, **003-deploy** (Azure SWA, ADR-0003) | PWA, Transloco en/pl, Tailwind, ESLint with template a11y rules, Vitest, Playwright + axe. A versioned pre-push hook runs the fast gates locally; since the repo went public (2026-11-15) `main` is also protected by the required CI checks. **CI:** `npm ci`, `npm audit`, lint, unit, build, `dist/` check (no `.md`/`.map`), e2e + axe. **CD:** preview deploy per PR (URL commented on the PR), header test on the preview, production deploy on merge to `main`. **Local verification:** `npm run verify` runs the same gates as CI. Dependabot for npm. |
| 1.5 | Mock-ups: spec **004-mockups** | Clickable HTML/Tailwind mock-ups in `docs/design/`, viewed on a real phone; we iterate on them with the author. Output: the visual direction and the final tokens. Free: no design tool is needed. |
| 2 | Board and input **without a camera** ✅: specs **006-counting-core**, **007-screens** | board model and import, the friend's board, the **counting** machine (the default and the PoC mode; scanning comes after the PoC), Space/button input, text and TTS. Already usable with a switch. |
| 3 | Face-tracking spike | MediaPipe in a worker, a diagnostic screen with live blendshapes and head pose, measurements on Android Chrome and iOS Safari (FPS, battery, light, glasses). Ends with an ADR. Built (spec 010); ADR-0006 proposed, measurements on his devices pending. |
| 4 | Signal detection + calibration | PoC signals first: LONG_BLINK, LOOK_AT_HAND, HEAD_NOD, HEAD_SHAKE; other head turns later; calibration wizard; profiles. Built (spec 011): the five signals incl. head right, one profile; thresholds to check with him. |
| 5 | Integration and UX | signals → actions, undo, confirmations, pause, audio mode for the "caregiver holds the phone" setup. Built (spec 012): the camera drives Liczenie (Counting), a tone per signal, the face status, the rear camera; pause by closed eyes waits for him. |
| 6 | Trial with the friend | tune the thresholds, capture learnings. Checklist ready: `docs/trial/first-session.md`. |

# Ideas (not specified)
- From the [security pass](security-review.md) (2026-11-16), to decide with the author: one action that deletes
  all data from the device (F1); stopping the camera while the app is in the background (F2).
- Board editor; importing a board from a photo.
- **Shortcuts for frequent words** (author, 2026-11-12: "do rozważenia" (to consider)): a word picked with one number instead of
  letter by letter. To design after the PoC, together with him.
- Word prediction for Polish; favorite phrases; sentence history.
- Capacitor build for Android and iOS.
- Better TTS voices. This would need a backend, so it requires a new ADR.
