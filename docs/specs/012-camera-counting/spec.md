---
type: Spec
title: "012: The camera drives Liczenie (Counting) - his face signals as input, a sound for each signal, the rear camera"
description: Stage 5. With "Sterowanie kamerą" (Camera control) on, Liczenie (Counting) watches his face and sends the detected signals to the counting machine, like the buttons do; a short sound confirms each signal; the screen says when his face is not in view; a caregiver can use the rear camera.
tags: [stage-5, vision, signals, counting]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-15
---

# Goal

Stage 4 gives his signals from the camera; stage 5 connects them to Liczenie (Counting), so he can spell with his face
alone. Everything else stays as it is: the counting machine of specs 006–009 does not know where a signal comes from.

# Rules

- **R1. A switch, off by default.** Ustawienia (Settings): "Sterowanie kamerą w Liczeniu" (Camera control in
  Counting), off by default (the camera starts only when someone chose it). On: Liczenie (Counting) starts the camera
  when it opens and stops it when it closes, like the screen wake lock.
- **R2. One input path.** Each detected signal goes to `CountingService.send()` exactly like a button or a key. The
  detector uses his calibrated profile (spec 011), or the defaults with a hint to calibrate.
- **R3. He hears each signal.** A short sound per detected signal (a different tone per kind: blink, hand, nod,
  shake, head right), made on the device with the Web Audio API (no audio files), so he knows Blinker counted it.
  "Dźwięk przy sygnale" (A sound for each signal), on by default. The chosen letter is still said (spec 009).
- **R4. Face in view, in words.** A small status: "Widzę twarz" (Face in view) or "Brak twarzy" (No face) after
  1.5 s without a face, as a chip in the top app bar next to "Pauza" (Pause), so the board keeps its height; the change is announced politely.
  A small preview can be shown or hidden ("Podgląd kamery" (Camera preview)), off by default so the board keeps its
  size; errors (no permission, no camera) are said in text and the buttons keep working.
- **R5. Rear camera.** "Kamera" (Camera): "przednia" (front) or "tylna" (rear), for a caregiver holding the phone
  towards him (setup 2 of the vision); the preview is mirrored only for the front camera.
- **R6. Privacy.** As in specs 010–011: the picture stays in the worker, nothing is saved or sent.

# Acceptance criteria

- [x] Unit: frames → signals → `send()` (a fake tracker with synthetic frames); "no face" after 1.5 s and back; the
      sound per signal (a fake audio context); the settings (validated, defaults off/on).
- [x] e2e (Chromium, fake camera): the switch in Ustawienia (Settings) → Liczenie (Counting) shows "Brak twarzy" (No face,
      the test pattern), the buttons still work, no third-party request, no CSP violation, axe; the board
      still fits at 360 × 640 with the camera status; the camera stops when leaving.
- [x] `npm run verify -- --lighthouse` passes.

# Out of scope

- Pause by closing the eyes for 3 s (`VERY_LONG_CLOSE`): to confirm with him first.
- Scanning mode (mode A): after the PoC.

# References

- MDN Web Audio API, `OscillatorNode`: https://developer.mozilla.org/docs/Web/API/OscillatorNode
- MDN `MediaTrackConstraints.facingMode`: https://developer.mozilla.org/docs/Web/API/MediaTrackConstraints/facingMode
- Chrome autoplay policy (audio needs a user gesture or engagement): https://developer.chrome.com/blog/autoplay
- WCAG 2.2: Status Messages https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- Specs [009](../009-letter-by-ear/spec.md), [010](../010-face-spike/spec.md), [011](../011-signals/spec.md).
