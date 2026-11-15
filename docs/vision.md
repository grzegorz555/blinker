---
type: Vision
title: Blinker vision
description: Who Blinker is for, the problem it solves, goals and non-goals.
tags: [product]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
---

# Problem
A friend of the author can't speak or use his hands. He communicates with a paper letter board: another person
points at the board **column by column**, he confirms the right column with a strong blink, then the person points
**row by row** inside that column and he confirms the letter. He also uses shortcuts, such as a head nod or a
look at his hand, so he doesn't have to blink many times (see [interaction model](interaction-model.md)).
This works, but it is slow, needs a trained partner and is tiring for both sides.

# Goal
A phone or tablet takes over the partner's role. It watches his face, recognizes the same deliberate signals,
picks letters from **his own board**, builds sentences and reads them aloud.

# Principles
- **His board, his signals.** The board is a swappable file, and signal-to-action mappings and timings are settings. We adapt to him, not the other way round.
- **Forgiving:** involuntary blinks are ignored, every step can be undone, and nothing is spoken without confirmation.
- **Works anywhere:** any modern phone browser, installable as a PWA, works offline.
- **Private by design:** camera frames are processed on the device and never sent anywhere. No accounts, no backend, no analytics.
- **Accessible to everyone around him:** WCAG 2.2 AA for the caregiver UI. Large, high-contrast text for him.

# Setups to support
1. Phone or tablet on a stand in front of his face (front camera).
2. A caregiver holds the phone towards him (rear camera). He may not see the screen, so audio cues are needed.
3. A tablet or laptop by the bed.

# Non-goals (for now)
- Native app store builds (possible later with Capacitor, see [ADR-0001](adr/0001-pwa-without-backend.md)).
- Cloud sync, accounts, multi-user.
- Medical-device certification. Blinker is a helper; the paper board stays as a fallback.
