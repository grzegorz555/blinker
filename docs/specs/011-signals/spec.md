---
type: Spec
title: "011: His signals from the camera - detection, calibration profile, Kalibracja (Calibration)"
description: Stage 4. A pure detector turns face frames into his signals (long blink, look at his hand, nod, head shake, head right) with a calibrated profile kept on the device; Diagnostyka (Diagnostics) shows the detected signals live; Kalibracja (Calibration) learns his profile in a step-by-step wizard.
tags: [stage-4, vision, signals, calibration]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-15
---

# Goal

Turn the values of spec 010 (`FaceFrame`: eye blendshapes and head angles) into the signals he already uses, so stage 5
can drive Liczenie (Counting) with his face. The thresholds differ per person and per day, so a calibration wizard
learns them from his own movements, and every threshold stays editable by recalibrating.

The author can't try it with him soon (2026-11-15): the defaults are reasonable guesses, the calibration and the
Diagnostyka (Diagnostics) signal log make the first session with him productive.

# Rules

- **R1. A pure detector.** `detect(state, frame, profile)` → new state and signals, no clock and no timers (time comes
  from the frame's timestamp), like the counting machine. Signals are the existing `InputSignal` types: `BLINK`,
  `HAND`, `NOD`, `SHAKE`, `RIGHT`.
  - **Long blink** (`BLINK`): both eyes closed (`min(eyeBlinkLeft, eyeBlinkRight)` at or above the threshold) for at
    least `minMs` (default 600 ms) and at most `maxMs` (2500 ms), sent when the eyes open again (so one closure is
    one signal). Shorter closures are involuntary and ignored. A closure that starts while he looks down is the look
    at his hand, not a blink (looking down lowers the lids).
  - **Look at his hand** (`HAND`): `max(eyeLookDownLeft, eyeLookDownRight)` at or above the threshold, held for
    `holdMs` (400 ms); once per look; again only after the eyes come back up.
  - **Nod** (`NOD`): head pitch away from neutral by the amplitude (default 12°) and back within `windowMs` (1200 ms);
    the direction is learnt in calibration (default: either).
  - **Shake** (`SHAKE`): head yaw past the amplitude (default 10°) to one side and then to the other within
    `windowMs` (1500 ms).
  - **Head right** (`RIGHT`): yaw past the amplitude (default 20°) to his right, held for `holdMs` (300 ms), sent
    when the head comes back; the side is learnt in calibration.
  - After any signal, `refractoryMs` (400 ms) passes before the next one. Without a face every half-done signal is
    dropped.
- **R2. A profile on the device.** `SignalProfile` (version 1) with the neutral head pose and every threshold, stored
  in `localStorage` (`blinker.profile.v1`), validated when read back like the settings; a broken value falls back to
  the defaults and says so.
- **R3. Signals in Diagnostyka (Diagnostics).** While the camera runs, the detector runs with the stored profile and
  the screen lists the last signals with their time, so a caregiver sees what Blinker would do.
- **R4. Kalibracja (Calibration).** A wizard as in the mock-up (`design/calibrate-wizard.html`): what will happen;
  the camera (explained before the browser asks); look straight ahead (neutral); 3 long blinks; look at his hand
  twice (left, then optionally right); nod twice; shake twice; head right twice; the result. Each step records the
  frames while it is open, says the instruction aloud (he listens), and shows "Wykryto n z k" (Detected n of k) by
  running the detector with the profile fitted so far. "Pomiń ten krok" (Skip this step) keeps that part of the
  previous profile. "Zapisz kalibrację" (Save the calibration) stores it; nothing is saved before. Kalibracja
  (Calibration) joins the navigation.
- **R5. Fitting is pure and conservative.** `fitProfile(steps, previous)`: thresholds halfway between his resting
  value and the median of his deliberate peaks; amplitudes half of his median movement; clamped to safe ranges; the
  directions of the nod and the head right from his movements. Unit-tested with synthetic recordings.
- **R6. Privacy.** Calibration keeps numbers only (thresholds, angles), never a picture.

# Acceptance criteria

- [x] Unit: each signal from synthetic frame streams, including what must not fire (short blink, look down with
      closing lids, a slow turn, a face lost halfway); the refractory time; fitting from synthetic steps.
- [x] The profile is validated when read back; a broken one falls back to the defaults with a notice.
- [x] Diagnostyka (Diagnostics) lists detected signals (unit with a fake tracker).
- [x] Kalibracja (Calibration): the steps, skip, back, save; without a face "Wykryto 0 z 3" (Detected 0 of 3) and the
      step can be skipped; e2e with the fake camera in Chromium; axe on every step.
- [x] `npm run verify -- --lighthouse` passes.

# Out of scope

- Driving Liczenie (Counting) with the camera, audio cues, `VERY_LONG_CLOSE` as pause: stage 5 (spec 012).
- More than one profile (profiles per person or per position): later, if he needs it.

# References

- MediaPipe Face Landmarker blendshapes: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker
- `docs/interaction-model.md` (signals), mock-up `src/web/design/calibrate-wizard.html`, spec
  [010](../010-face-spike/spec.md), ADR-0006.
- WCAG 2.2: Timing Adjustable (no step times out) https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html;
  Status Messages https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
