---
type: Spec
title: "014: The camera stops in the background, starts again on return, and can be turned off by hand"
description: Finding F2 of the security pass. When the page is hidden (another app, another tab, a locked screen) the camera is released at once, so the camera indicator goes off; when the page is visible again the camera starts by itself, and the detector, Kalibracja (Calibration) and Diagnostyka (Diagnostics) begin cleanly. A caregiver can also turn the camera off and on with one button on each of the three screens.
tags: [security, privacy, vision, camera]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-16
---

# Goal

Today the camera stops only when he leaves the page that uses it. When a caregiver switches to another app, or the
screen locks, the stream stays open ([security pass](../../security-review.md), F2). The camera should be on only
while someone can see Blinker. On return it must come back without a tap, because he cannot tap.

A caregiver (or the author, testing) also needs an easy way to turn the camera off right now: for a meal, a visit,
or to rest his eyes. Today Liczenie (Counting) offers only the switch in Ustawienia (Settings), Kalibracja
(Calibration) has no way at all, and in Diagnostyka (Diagnostics) the button scrolls out of view (the author,
2026-11-17). Closing the tab works, but nobody should have to know that.

# Scope

- `FaceTrackerService` (one place, so it holds for Liczenie (Counting), Kalibracja (Calibration) and Diagnostyka
  (Diagnostics)): release the camera when the document is hidden, open it again when it is visible.
- What each of the three pages does on return.
- One button to turn the camera off and on, on each of the three screens (R10–R13).
- No new setting and no new screen.

# Rules

- **R1. Hidden: the camera is released at once.** On `visibilitychange` to `hidden`, a camera that is starting or
  running stops every track of its stream and clears the video element, so the browser's camera indicator goes off.
  No frame is grabbed or analysed while hidden. There is no grace time: a camera that stays on "just for a moment"
  is what this spec removes.
- **R2. Visible: it starts again by itself.** On `visibilitychange` to `visible`, a camera that R1 stopped opens
  again with the same facing (front or rear) and the same video element; no tap is needed. A camera that was off,
  or stopped by the page or by an error before the page was hidden, stays off: only R1's own stop is undone.
- **R3. The worker and the model stay loaded.** R1 releases the camera, not the face worker: the model is not loaded
  again on return, so the wait is only the camera opening. (Leaving the page still ends the worker, as today.)
- **R4. A clean start for his signals.** On return the detector starts from its initial state, so half a blink or
  half a nod from before the gap can never join a movement after it. "Twarz w kadrze" (Face in view) is unknown
  until the first frame, and "Brak twarzy" (No face) again needs its 1.5 s without a face. No tone and no speech is
  made by the return itself.
- **R5. The status says it, in text.** While the camera opens again, Liczenie (Counting) shows the existing
  "starting" status in the top bar chip, then "Widzę twarz" (Face in view) or "Brak twarzy" (No face). When the camera
  cannot be opened again (the permission was taken back meanwhile, another app holds the camera), the existing error
  is shown in text and the buttons keep working; the camera is not retried in a loop.
- **R6. Kalibracja (Calibration).** A step that was being recorded when the page was hidden is recorded again from
  its start on return, and its instruction is said again; steps already finished keep their recordings.
- **R7. Diagnostyka (Diagnostics).** On return the measurement starts again (the counters, the frame statistics,
  the lists of closures, looks and signals), like "Włącz kamerę" (Turn on the camera) does today, so a copied result
  never mixes two runs.
- **R8. Quick changes are safe.** Hidden and visible in any order and at any speed (hidden while the camera is still
  opening, visible before the release finished, hidden twice) end with exactly one open stream when visible and none
  when hidden; a stream that arrives late for a run that was stopped is closed at once.
- **R9. Privacy.** As in specs 010–012: frames stay in the worker, nothing is saved or sent. This spec only shortens
  the time the camera is open.
- **R10. Liczenie (Counting): a camera button in the top bar.** While the setting "Sterowanie kamerą w Liczeniu"
  (Camera control in Counting) is on, the top bar has a toggle button "Kamera" (Camera) next to the camera chip and
  "Pauza" (Pause), built like "Pauza" (Pause): a constant label with an icon, its state in `aria-pressed` (pressed =
  the camera is on). Turning it off releases the camera at once (every track stopped, the video cleared, as R1) and
  the chip says "Kamera wyłączona" (Camera off); the signal buttons and the keyboard keep working. Turning it on opens
  the camera again (R4 and R5 apply). The setting is not changed: the off holds until the button is pressed again or
  Liczenie (Counting) is opened again, where the setting turns the camera on as today.
- **R11. Kalibracja (Calibration): "Wyłącz kamerę" (Turn off the camera).** From the camera step on, every step has
  this button. Off releases the camera; a step being recorded stops and its recording is dropped; steps already
  finished keep their recordings. The step then shows "Włącz kamerę" (Turn on the camera), which opens the camera
  again and records the step from its start, as R6.
- **R12. Diagnostyka (Diagnostics): the button stays in view.** "Włącz kamerę" (Turn on the camera) and "Wyłącz
  kamerę" (Turn off the camera) sit in a bar that stays visible while the page scrolls, so the camera can always be
  turned off without scrolling back up. The bar must not cover content or a focused control: the page keeps room for
  it at the end (SC 2.4.11; [learning](../../knowledge/sticky-bar-covers-controls.md)).
- **R13. Only a person at the screen.** The buttons of R10–R12 are touch and keyboard controls. No face signal, no
  board cell and no key of the signal mapping reaches them: if his signals could turn the camera off, he could not
  turn it on again. A camera turned off by hand stays off when the page comes back from the background (R2).

# UI and accessibility notes

- The chip in the top bar of Liczenie (Counting) already announces its changes politely (SC 4.1.3); the return and
  the button of R10 go through the same states as opening the page, plus "Kamera wyłączona" (Camera off).
- The toggle of R10 follows the APG button pattern: one constant name, the state in `aria-pressed`, never a label
  that flips. The buttons of R11 and R12 are ordinary buttons whose text says the action. Each has a visible text
  label and is at least 44 px high; the top bar is checked at 360 px, portrait and landscape, with the chip, "Kamera"
  (Camera) and "Pauza" (Pause) together.
- He listens rather than reads: nothing is said aloud by the return (R4), so coming back from another app is quiet.
- In Kalibracja (Calibration) the repeated instruction (R6) tells him the step began again.

# Security and privacy notes

- The stream is the sensitive part: `MediaStreamTrack.stop()` on every track is what lets the browser release the
  camera and turn its indicator off. The video element's `srcObject` is cleared too.
- Browsers may already mute or suspend capture for a document that is not in view (Media Capture and Streams, the
  life-cycle section). That differs per browser, so Blinker does not rely on it; stopping and opening again also
  recovers from a stream the system ended while the app was away.
- The camera permission is not asked again within a visit when the browser kept it; when it did not, the browser
  asks, or the error of R5 is shown.

# Acceptance criteria

- [ ] Unit (the tracker, a fake document, camera and worker): hidden → every track stopped, the video cleared, no
      frame sent, the worker kept; visible → the camera opened once with the same facing, frames flow again; a
      camera that was off or in error stays so; the cases of R8; a refusal on return gives the error and no retry.
- [ ] Unit: the camera input starts the detector from its initial state on return, and the face status is unknown
      until a frame comes (R4); Kalibracja (Calibration) restarts the step under way and keeps finished steps (R6);
      Diagnostyka (Diagnostics) restarts its measurement (R7).
- [ ] Unit: the "Kamera" (Camera) toggle of Liczenie (Counting) releases the camera, says "Kamera wyłączona" (Camera
      off), keeps the signal buttons working, leaves the setting unchanged and opens the camera again (R10); a camera
      turned off by hand stays off after hidden → visible (R13); Kalibracja (Calibration) drops the step under way and
      keeps finished ones (R11); no face signal or signal key changes the camera (R13).
- [ ] By hand on a phone (before the first session, noted in `docs/trial/first-session.md`): switching to another
      app turns the camera indicator off; coming back turns the camera on within a moment; "Kamera" (Camera) in
      Liczenie (Counting) turns the indicator off and on.
- [ ] `npm run verify` passes.
- [x] E2E (the paths of the Test plan): written and green in the e2e pass of 2026-11-20.

# Test plan

- **Unit (Vitest):** `face-tracker.service.spec.ts` for R1–R3, R5, R8 with a document fake like the one of
  `wake-lock.ts` (a `visibilityState` and the listener); `camera-input.service.spec.ts` for R4; the calibration and
  diagnostics page specs for R6 and R7; the counting, calibration and diagnostics page specs for R10–R13.
- **e2e (Playwright + axe, fake-camera projects; written in the e2e pass of 2026-11-20):**
  - Liczenie (Counting) with the camera on, the page made hidden → the tracks of the stream are ended and the video
    has no source; made visible → the chip goes through "starting" to a face status without a tap, and the signal
    buttons worked all the time; no third-party request, no CSP violation, axe. A test cannot really hide the page,
    so it overrides `document.visibilityState` and dispatches `visibilitychange` (a helper in `e2e/support`).
  - "Kamera" (Camera) in Liczenie (Counting): off → tracks ended, `aria-pressed="false"`, "Kamera wyłączona" (Camera
    off); on → a face status; the top bar at 360 px portrait and landscape; axe.
  - Diagnostyka (Diagnostics) scrolled to the end: "Wyłącz kamerę" (Turn off the camera) is in view and covers no
    focused control; Kalibracja (Calibration): off and on during a step.

# Out of scope

- What the counting machine does with a number that was being given when the page was hidden: unchanged (its pause
  still takes the number). To decide with him, together with the pause by closed eyes.
- A setting to keep the camera on in the background.
- Stopping the camera after a time without a face while the page is visible.
- Speech and the wake lock: unchanged. The wake lock is released by the browser when hidden and taken again on
  return (spec 007, R8).

# References

- MDN `visibilitychange` (fires on a tab switch, minimizing, or on mobile a switch to another app; "hidden" is the last event a page reliably sees) https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
- MDN Page Visibility API (avoid unnecessary tasks while hidden; background throttling of `requestAnimationFrame` and timers) https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- MDN `MediaStreamTrack.stop()` (the source may be stopped once no track uses it) https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop
- MDN `getUserMedia()`, Privacy and security (browsers must show an indicator while a camera is in use) https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- W3C Media Capture and Streams, life-cycle of a track and documents not in view https://www.w3.org/TR/mediacapture-streams/
- WCAG 2.2, SC 4.1.3 Status Messages https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- WCAG 2.2, SC 2.4.11 Focus Not Obscured (Minimum) https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- APG, Button pattern (toggle buttons: a constant label, the state in `aria-pressed`) https://www.w3.org/WAI/ARIA/apg/patterns/button/
- [Security pass](../../security-review.md), F2; ADR-0006; specs [010](../010-face-spike/spec.md), [011](../011-signals/spec.md), [012](../012-camera-counting/spec.md).
