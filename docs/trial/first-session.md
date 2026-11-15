---
type: Guide
title: "Stage 6: the first session with him - a checklist"
description: What to prepare, do and write down at the first session with the friend, so one visit settles the open questions of stages 3-5 (ADR-0006 measurements, his calibration, the thresholds, the tones, the letter by ear). Numbers only; no photos or recordings of him without his consent.
tags: [stage-6, trial, calibration, measurements]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-15
---

# Goal

One visit should answer what only he can answer: does the camera see his signals reliably on his device, which
thresholds suit him, and does the way Blinker talks (only the letter, a tone per signal) help him. Everything below
is written as numbers or short notes; no picture of him is taken or kept (`docs/conventions/security.md`).

# Before the visit

- [ ] The latest version is deployed; open it on **his** phone or tablet and add it to the home screen (PWA).
- [ ] Ustawienia (Settings): a Polish on-device voice is reported ("Posłuchaj" (Listen) speaks); speech rate as he
      likes it.
- [ ] Bring: a phone stand, his paper board (the fallback), a charger.
- [ ] Battery charged to a known level (for the battery measurement).

# 1. Diagnostyka (Diagnostics), 10 minutes (ADR-0006)

- [ ] Phone on the stand, facing him as for talking; Diagnostyka (Diagnostics) → "Włącz kamerę" (Turn on the camera).
- [ ] Note: "Twarz w kadrze" (Face in view) yes most of the time? FPS, analysis median and p95, engine (GPU or CPU).
- [ ] Ask for a few strong blinks and watch both meters: "Mrugnięcie" (Blink) and "Zaciśnięcie powiek" (Lids squeezed). Then let him
      blink normally for a while: his ordinary blinks should squeeze clearly less. Note both levels.
- [ ] Ask for a look at his hand, a nod, a shake, head right; watch the eye meters and the head
      angles move, and the "Wykryte sygnały" (Detected signals) list.
- [ ] After 10 minutes: "Kopiuj wyniki" (Copy the results) → paste into the ADR-0006 table (device, browser, light).
- [ ] Repeat with other light (evening lamp) and, if he wears them, with glasses.

# 2. Kalibracja (Calibration), about 2 minutes

- [ ] Kalibracja (Calibration): go through the steps at his pace; each step is said aloud.
- [ ] Note per step "Wykryto n z k" (Detected n of k). A step at 0: repeat it once; if still 0, skip it and note why.
- [ ] "Zapisz kalibrację" (Save the calibration); then check in Diagnostyka (Diagnostics) that his signals appear.

# 3. Liczenie (Counting) with the camera

- [ ] Ustawienia (Settings) → Kamera (Camera): "Sterowanie kamerą w Liczeniu" (Camera control in Counting) on.
- [ ] Let him spell a short word he chooses (for example "TAK"); note how many signals were missed or extra.
- [ ] Ask (yes/no): do the tones help him count? Is "only the letter" enough, or should Blinker say more (the
      switches "Mów pytania i komunikaty" (Say the questions and notices) and "Potwierdzaj kolumnę i wiersz skinieniem"
      (Confirm the column and the row with a nod))?
- [ ] Is a pause of 1.2 s before the next step right, or too short or long ("Pauza przed pytaniem" (The pause before
      the question))?
- [ ] After reading aloud: is "Nowe zdanie?" (New sentence?) welcome or in the way?
- [ ] Rear camera: a caregiver holds the phone towards him; does it work as well?

# 4. Still open (from the interaction model)

- [ ] Eyes closed for about 3 s as "pause" (`VERY_LONG_CLOSE`): does he want it?
- [ ] Which hand does he look at (left, right, both)?
- [ ] Shortcuts for frequent words: worth designing now?

# After the visit

- Put the numbers into ADR-0006 and, if they are good, accept it.
- Write the answers into `docs/interaction-model.md` and the backlog; new learnings via `/compound`.
- Anything that needs code becomes the next spec.
