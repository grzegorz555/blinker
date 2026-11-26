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

- [ ] By hand on **your** phone (spec 014, before the first visit): open Liczenie (Counting) with the camera on,
      switch to another app: the camera indicator goes off. Come back: the camera is on again within a moment, with
      no tap.
- [ ] On the same phone, in Liczenie (Counting): "Kamera" (Camera) turns the camera indicator off, and on again when
      pressed once more; the chip says "Kamera wyłączona" (Camera off) while it is off.

# 1. Diagnostyka (Diagnostics), 10 minutes (ADR-0006)

- [ ] Phone on the stand, facing him as for talking; Diagnostyka (Diagnostics) → "Włącz kamerę" (Turn on the camera).
- [ ] Note: "Twarz w kadrze" (Face in view) yes most of the time? FPS, analysis median and p95, engine (GPU or CPU).
- [ ] Ask for a few strong blinks and watch both meters: "Mrugnięcie" (Blink) and "Zaciśnięcie powiek" (Lids squeezed). Then let him
      blink normally for a while: his ordinary blinks should squeeze clearly less. Note both levels.
- [ ] Ask for a glance at his left hand (a quick turn of the head to his left and back), a nod, a shake, head right;
      watch the head angles move (signed, from his neutral) and the "Wykryte sygnały" (Detected signals) list. Note the
      last head movements with their verdicts (`hand`, `small`, `slow`, `shake`, `otherSide`, `tooSoon`).
- [ ] After 10 minutes: "Kopiuj wyniki" (Copy the results) → paste into the ADR-0006 table (device, browser, light).
- [ ] Repeat with other light (evening lamp) and, if he wears them, with glasses.

# 2. Kalibracja (Calibration), about 2 minutes

- [ ] Kalibracja (Calibration): go through the steps at his pace; each step is said aloud. In "Spokojnie, na wprost"
      (At rest, facing the screen) let him blink as usual for about 10 s: "Zwykłe mrugnięcia" (Ordinary blinks) at least 2.
- [ ] Note the result's message on his blink (a guess, or strong and ordinary look alike) and which cue was chosen.
- [ ] Note per step "Wykryto n z k" (Detected n of k). A step at 0: repeat it once; if still 0, skip it and note why.
- [ ] Step "Ręka (+5)" (Hand (+5)): two glances at his left hand, as he does them ("turn your head to your left hand and
      back, twice"). Note "Wykryto n z 2" (Detected n of 2), the signed angles of his last 2 head movements and their
      verdicts. "Nie zapamiętano" (Not learnt): repeat it once; if still not learnt, note why (under 6°, or the side of
      his head right).
- [ ] "Zapisz kalibrację" (Save the calibration); then check in Diagnostyka (Diagnostics) that his signals appear.
- [ ] Ustawienia (Settings) → "Zapisz kopię" (Save a backup) right after the calibration (spec 017), and keep the file
      off his phone (your phone or computer); it brings his calibration back on a new phone or after cleared data.

# 3. Liczenie (Counting) with the camera

- [ ] Ustawienia (Settings) → Kamera (Camera): "Sterowanie kamerą w Liczeniu" (Camera control in Counting) on.
- [ ] Let him spell a short word he chooses (for example "TAK"); note how many signals were missed or extra.
- [ ] The hand (+5) in Liczenie (Counting): a glance at his left hand gives +5; a nod or a shake does not. Count: ten
      glances → at least eight +5 and no NOD; five nods, five shakes, two head rights → no +5 (spec 015).
- [ ] If the hand fails: "Kopiuj wyniki" (Copy the results) in Diagnostyka (Diagnostics) and note the head movements
      with their verdicts; the copy has the whole profile and the signed angles.
- [ ] Ask (yes/no): do the tones help him count? Is "only the letter" enough, or should Blinker say more (the
      switches "Mów pytania i komunikaty" (Say the questions and notices) and "Potwierdzaj kolumnę i wiersz skinieniem"
      (Confirm the column and the row with a nod))?
- [ ] Is a pause of 1.2 s before the next step right, or too short or long ("Pauza przed pytaniem" (The pause before
      the question))?
- [ ] The chime before the row (spec 012, R7): when the pause takes the column, does he hear the rising three notes,
      and does he start the row after it? Is it loud enough, too long, pleasant? Note whether he started the row
      before the chime (the pause too long) or waited long after it. If it is in the way: "Dźwięk: teraz wiersz"
      (Sound: now the row) in Ustawienia (Settings).
- [ ] After reading aloud: is "Nowe zdanie?" (New sentence?) welcome or in the way?
- [ ] Favorite phrases (spec 019, off by default): with the caregivers, put 3–5 of his frequent phrases on the list
      in Zdania (Sentences) and turn on "Podpowiadaj ulubione zwroty" (Suggest favorite phrases). Does he take "Zmień
      pozycję?" (Change my position?) with a nod, or does the question break his rhythm? Is the pause of 2.5 s right?
      Would a board of phrases chosen by a number suit him better?
- [ ] Rear camera: a caregiver holds the phone towards him; does it work as well?

# 4. Still open (from the interaction model)

- [ ] Eyes closed for about 3 s as "pause" (`VERY_LONG_CLOSE`): does he want it?
- [ ] Which hand does he glance at (left, right, both)? Only his left is detected (spec 015); note whether he also
      turns his head to his right for it, which is head right.
- [ ] Shortcuts for frequent words: worth designing now?
- [ ] Word prediction (spec 016, paused after T2): would a guessed word help him, or get in his way? Ask him
      as the caregiver does at the paper board ("Dziękuję?" (Thank you?)) and note how he takes it. Decide on T3-T6.

# After the visit

- Put the numbers into ADR-0006 and, if they are good, accept it.
- Write the answers into `docs/interaction-model.md` and the backlog; new learnings via `/compound`.
- Anything that needs code becomes the next spec.
