---
type: Task List
title: "015: The look at his hand is a quick turn of the head - tasks"
description: Five tasks - the detector and the profile, the fitting, Kalibracja (Calibration), Diagnostyka (Diagnostics), and the docs with the interaction model.
tags: [vision, signals, calibration, interaction]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-17
---

Branch: `feat/015-hand-by-head`. Gates: `npm run verify -- --quick`; CI runs `npm run verify`. The e2e paths
of the spec's Test plan were written in the e2e pass of 2026-11-20 (`e2e/calibration.e2e.ts`,
`e2e/diagnostics.e2e.ts`). Spec 014 also changes the Kalibracja (Calibration) and
Diagnostyka (Diagnostics) pages; whichever lands second rebases on the other.

- [x] **T1 [opus]: The hand from the head, in the detector and the profile.** `HAND` from a turn to his left past
      the amplitude and back within the window, after a 300 ms settle; the other side within the settle makes it a
      shake; a sent hand clears the shake sides; a nod with the yaw past half the hand amplitude is not sent; a
      closure during the turn is `atHand`; the eye rule goes (R1–R6). The head-movement report with signed peaks
      replaces the look report (R9). `profile.ts`: the new `hand` fields, defaults (direction = −`right.direction`)
      and reading his old stored profile (R7). Tests: detector and profile units from his numbers.
      _To understand:_ a gesture as a small state machine (out, back, settle); why a settle time tells a hand from
      the first half of a shake; reading old stored data without a version bump.
- [x] **T2 [opus]: Kalibracja (Calibration) learns the hand's head angle.** `fit.ts`: one step `hand` instead of
      `handLeft`/`handRight`; signed yaw peak → amplitude and direction, signed pitch; not learnt under 6° or on the
      side of head right (R8). Tests: fit units (glances of 44° and 65°, a step too small, a step on the wrong side).
      _To understand:_ a signed peak (size from a percentile, sign from the median); why calibration refuses a side
      that another signal already uses.
- [x] **T3 [sonnet]: The hand step in the wizard.** One step "Ręka (+5)" (Hand (+5)) with its instruction shown and
      said, "Wykryto n z 2" (Detected n of 2) and his last 2 head movements with signed angles and the verdict;
      `handRight` strings go; en and pl (R8). Tests: calibration page unit.
      _To understand:_ nothing new beyond T1 and T2.
- [x] **T4 [sonnet]: Diagnostyka (Diagnostics) copies the whole profile and signed angles.** The copy: the profile
      JSON, calibrated or not, his left and right in words, the last 10 head movements; the page: the last head
      movement and the hand rule instead of the look down, live yaw and pitch also from neutral (R10). Strings in en
      and pl. Tests: diagnostics page unit (the copied text).
      _To understand:_ why a copy with signs and the whole profile is enough to tune him from a distance.
- [x] **T5 [haiku]: Docs.** `interaction-model.md` (`LOOK_AT_HAND`, `HEAD_LEFT`, the detection notes; R11), the
      first-session checklist (the checks with him), architecture if it names the eye rule, README, backlog, log,
      specs index, Polish copies.
      _To understand:_ nothing new.
