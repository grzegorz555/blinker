---
type: Spec
title: "015: The look at his hand is a quick turn of the head to his left and back"
description: His hand signal (+5) is a head movement, not an eye movement - mainly to his left, a little down, and straight back - so Blinker detects it like a nod (out past the amplitude and back within a window, no hold) and tells it apart from a nod, a shake and head right. Kalibracja (Calibration) learns the head angle of his left hand; the right-hand step goes. Diagnostyka (Diagnostics) copies the whole profile and signed head angles.
tags: [vision, signals, calibration, interaction]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-17
---

# Goal

Blinker looks for his hand signal in his eyes (`eyeLookDown` held for 400 ms, spec 011). He does not move his eyes
alone: he turns his **head** to his left, a little down, and **at once back**, and his eyes go with the head, so the
eye values hardly move and the look is seldom found. Measured by the author in Diagnostyka (Diagnostics) on
2026-11-17:

| What | Value |
|---|---|
| His glance at his left hand | head yaw 44–65° and pitch 8–9° from his neutral (sizes; the copy had no sign) |
| His profile | neutral yaw 4.9°, pitch 5.7°; nod 7.7°, direction 1; shake 16°; head right 34°, direction −1 |

The glance is far larger than his shake (16°) and in the other direction from his head right (−1), so the head tells
it apart well. Its pitch (8–9°) is past his nod amplitude (7.7°), so today the same glance could also be read as a
**nod**: R3 stops that.

The author decided (2026-11-17): the head turn **replaces** the eye rule; the **sideways turn decides** (the pitch is
learnt and shown, not required); **only his left hand** for now.

# Scope

- `core/signals/detector.ts`: `HAND` from the head turn (R1–R6), the head-movement report (R9).
- `core/signals/profile.ts`: the new `hand` fields and reading profiles stored before this spec (R7).
- `core/signals/fit.ts` and Kalibracja (Calibration): one hand step that learns the head angle (R8).
- Diagnostyka (Diagnostics): the copy carries the whole profile and signed head angles (R10).
- `docs/interaction-model.md`: `LOOK_AT_HAND`, `HEAD_LEFT` and the detection notes (R11).
- Unchanged: what `HAND` does (+5 in Liczenie (Counting), nothing in scanning), the buttons and keys, the tones.

# Rules

Angles are degrees from his neutral (`head − profile.neutral`), with MediaPipe's sign. **His left** is the sign
`profile.hand.direction`.

- **R1. A hand is a quick turn to his left and back.** `HAND` is sent when the yaw goes past `hand.amplitude` in the
  direction of his left and comes back within half of it, at most `hand.windowMs` after passing the amplitude
  (default 1500 ms). There is no hold (the 400 ms of spec 011 goes). A turn held longer than the window is not a
  hand: he is looking at something or someone. The pitch does not decide (author, 2026-11-17).
- **R2. A hand is one side only; a shake wins.** On the way back the hand waits a short settle time (300 ms, a
  constant) before it is sent. If the yaw passes the shake amplitude on the other side before then, it is a shake
  (`SHAKE` by its own rule) and no `HAND` is sent. A sent `HAND` clears the sides of the shake window, as `RIGHT`
  does, so a later turn to the right is not half a shake. (Why: a shake also starts with one side; the settle is
  the only way to tell them apart without undoing a signal.)
- **R3. A nod has no side.** A nod during which the yaw passed **half the hand amplitude** is not sent: his glance
  tilts the head down (8–9°) past his nod amplitude (7.7°), and that must not answer "yes".
- **R4. Head right is unchanged** and stays apart from the hand by its direction. Calibration refuses a hand side
  equal to the side of head right (R8).
- **R5. A closure of the eyes during the turn is not a blink.** A closure that starts while the head is turned
  towards his hand (past the amplitude), or that is still going on when `HAND` is sent, ends with the verdict
  `atHand`, not `BLINK` (it replaces `lookingDown`).
- **R6. The rest as today.** One signal per frame, the refractory time after it, and without a face every half-done
  movement is dropped. The eye rule for the hand (`eyeLookDown`, `eyeLookIn/Out`, `holdMs`) is removed.
- **R7. The profile.** `hand` becomes `{ amplitude, direction, pitch, windowMs }`: amplitude in the safe range of
  the other amplitudes (4–45°), direction −1 or 1, pitch the learnt signed tilt of his glance (shown, not used to
  decide), window in the safe window range. The profile stays version 1 and a stored profile keeps working, as when
  `blink.squeeze` was added: the old eye fields (`threshold`, `holdMs`, `left`, `right`) are ignored, and a missing
  field takes its default: amplitude 25°, window 1500 ms, pitch 0, and direction **the opposite of `right.direction`**
  (his left is the other way from his right). With his profile today (right −1) the hand works at once with
  direction 1, before he is calibrated again.
- **R8. Kalibracja (Calibration): one hand step.** The steps `handLeft` and `handRight` become one step `hand`
  ("Ręka (+5)" (Hand (+5))): "turn your head to your left hand and back, twice". It learns, like head right, the
  signed peak of the yaw (the largest size among the top 5 %, with the sign of their median): amplitude = half of it,
  clamped; direction = its sign. The pitch is the median of the pitch in the frames past the amplitude, signed. Not
  learnt (the old values stay, the step says "Nie zapamiętano" (Not learnt)) when the peak is under 6° (as the other
  angles) or when its sign equals a learnt `right.direction`. The step shows his last 2 head movements with signed
  angles and the verdict (R9), and "Wykryto n z 2" (Detected n of 2).
- **R9. The head-movement report.** The detector reports each movement of the head when it comes back: a movement
  starts when the yaw or the pitch is at least 6° from neutral and ends when both are under 80 % of it. The report
  has its length in ms, the **signed** peak yaw and pitch (the value with the largest size), the signal sent during
  it (or none), and the hand verdict: `hand`, `small` (towards his hand, under the amplitude), `slow` (past the
  window), `shake` (R2), `otherSide`. It replaces the look report of spec 011.
- **R10. Diagnostyka (Diagnostics) copies everything needed to tune him.** "Kopiuj wyniki" (Copy the results) adds:
  the whole profile as JSON (neutral, blink, hand, nod, shake, right, refractory), whether it is calibrated, the
  sign of his left and right in words ("his left = yaw +1"), and the last 10 head movements of R9 with signed
  angles. The page shows the last head movement and the hand rule ("Ręka się liczy, gdy …" (The hand counts when …))
  instead of the last look down; the live yaw and pitch keep their sign and gain the value from his neutral.
  Only numbers, as before: no picture, nothing that identifies him.
- **R11. The interaction model.** `docs/interaction-model.md` describes `LOOK_AT_HAND` as the head turn of R1–R3
  (to his left only for now; the right hand later), `HEAD_LEFT` as taken by the hand (no longer an alternative
  "no"), and the detection notes as this spec.

# UI and accessibility notes

- New and changed strings in en and pl: the hand step (title, what to ask, what is said aloud), the head-movement
  line and its verdicts, the hand rule. Every Polish label in English docs and test titles carries its translation.
- The Kalibracja (Calibration) step keeps no time limit (SC 2.2.1) and says its instruction aloud, as the others.
- The head-movement lines are text in a list, like the closures; nothing new is announced live (SC 4.1.3 applies
  only to the existing status chip, which is unchanged).
- The wizard has one step less; "Krok n z k" (Step n of k) follows.

# Security and privacy notes

- Nothing new leaves the device. The copy (R10) adds only the profile numbers and angles, written by the author's
  tap to the clipboard (secure context), as today. The stored profile is still checked field by field; an old one
  is read, not trusted blindly (R7).

# Acceptance criteria

- [ ] Unit (detector, synthetic frames): a turn of 50° to his left and back within 1.5 s sends one `HAND` after the
      settle; with a 4° wobble of pitch or 9° of pitch down, the same; a turn held 2 s sends nothing; a turn under
      the amplitude sends nothing (`small`); a turn to his right (head right) sends `RIGHT`, not `HAND`.
- [ ] Unit: left past the amplitude then right past the shake amplitude within the settle sends `SHAKE` only (R2);
      after a `HAND`, a turn right within the shake window is not a shake.
- [ ] Unit: his glance from the data (yaw 50°, pitch 9° down, nod 7.7° direction 1) sends `HAND` and not `NOD`; a
      plain nod (pitch 12°, yaw under 3°) still sends `NOD` (R3).
- [ ] Unit: a closure that starts during the turn is `atHand`, not `BLINK` (R5); the eye look down alone sends no
      `HAND` (R6); without a face the turn is dropped.
- [ ] Unit (profile): his stored profile of 2026-11-17 (old eye fields, right −1) is read, and its hand is amplitude
      25°, direction 1, window 1500 ms; a hand field out of range refuses the profile (R7).
- [ ] Unit (fit): a hand step of two glances of 44° and 65° learns amplitude ≈ 30°, direction 1 and the pitch with
      its sign; a step under 6° or on the side of head right is not learnt (R8).
- [ ] Unit (pages): Kalibracja (Calibration) has one hand step, records it, shows signed head movements; Diagnostyka
      (Diagnostics) copies the whole profile, the sides in words and signed head movements (R10).
- [ ] By hand with him (`docs/trial/first-session.md`): ten glances at his hand → at least eight `HAND` and no `NOD`;
      five nods, five shakes, two head rights → no `HAND`.
- [ ] `npm run verify` passes.
- [x] E2E (the paths of the Test plan): written and green in the e2e pass of 2026-11-20.

# Test plan

- **Unit (Vitest):** `detector.spec.ts` for R1–R6 and R9, with `synthetic.ts` frames built from his numbers
  (neutral 4.9/5.7, glance 44–65° and 8–9°, nod 7.7° direction 1, shake 16°, right 34° direction −1);
  `profile.spec.ts` for R7 (his old stored profile as a fixture); `fit.spec.ts` for R8; `calibration-page.spec.ts`
  and `diagnostics-page.spec.ts` for R8 and R10.
- **e2e (Playwright + axe, fake-camera projects; written in the e2e pass of 2026-11-20):** Kalibracja (Calibration) walks through
  one hand step (the wizard has no `handRight`), no axe violation; Diagnostyka (Diagnostics) "Kopiuj wyniki" (Copy
  the results) puts a text with `Profile:` JSON containing `"hand":{"amplitude"` on the clipboard.

# Out of scope

- **His right hand.** It would turn the head the way of head right (`RIGHT`, "finish"). To decide after the trial:
  for example by the pitch (the hand goes down, head right does not) or by the hold (head right is held).
- Learning the window from his movements: the head report (R9) gives their length, so the trial can set it.
- A face lost at a large turn: the movement is dropped (R6). Diagnostyka (Diagnostics) shows the share of frames
  with a face; if he loses the face at 60°, a later spec looks at it.
- The tones, the counting machine and the mapping of signals to actions.

# References

- MediaPipe Face Landmarker, the facial transformation matrix ("3D canonical-to-observed face pose transformation
  matrix") behind yaw and pitch https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker
- MDN `Clipboard.writeText()` (writes text to the clipboard; secure context only) https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText
- WCAG 2.2, SC 2.2.1 Timing Adjustable (no time limit in the calibration steps) https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html
- WCAG 2.2, SC 4.1.3 Status Messages https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- [Interaction model](../../interaction-model.md); specs [011](../011-signals/spec.md) (the detector, the profile,
  Kalibracja (Calibration)) and [012](../012-camera-counting/spec.md) (the signals drive Liczenie (Counting)).
