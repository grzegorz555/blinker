---
type: Interaction Model
title: Signals, input modes and actions
description: Which face signals Blinker recognizes, the two input modes (scanning and counting) and the default mapping of signals to actions.
tags: [product, interaction, signals]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
---

# Signals
Every signal has a **calibrated threshold**, so it is recognized only when it is clearly deliberate.
Blendshape names come from MediaPipe Face Landmarker (https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker).

| Signal | How it is detected | Status |
|---|---|---|
| `LONG_BLINK` | both `eyeBlinkLeft/Right` above the threshold for at least ~0.6 s (calibrated). Shorter closures are **ignored as involuntary**. | confirmed |
| `VERY_LONG_CLOSE` | eyes closed for at least ~3 s | to confirm with him |
| `HEAD_NOD` | head pitch down and back up within a time window (facial transformation matrix) | **confirmed: he uses it today** |
| `HEAD_LEFT` / `HEAD_RIGHT` | head yaw past the threshold, then back to neutral | possible |
| `HEAD_SHAKE` | yaw left-right-left | possible |
| `LOOK_AT_HAND` | gaze held in the direction of his hand (`eyeLook*` blendshapes, direction calibrated) | **confirmed: he uses it today, it means "5"** |
| `GAZE_UP` | `eyeLookUp*` held | possible |
| `SWITCH` | Space key, on-screen button or Bluetooth switch | always available (caregiver, tests, accessibility) |

# Input modes
The board is the same in both modes. The mode decides **how a column or a row number is chosen**.

## Mode A: scanning (default)
The app highlights the columns one by one at a configurable pace (optionally with an audio cue).
`LONG_BLINK` selects the highlighted column. The app then scans the rows inside that column, and `LONG_BLINK` selects the cell.

## Mode B: counting (how he partly works today; to confirm)
He gives a **number** for the column and then for the row:
- each `LONG_BLINK` adds **1**;
- `LOOK_AT_HAND` adds **5**, so he doesn't have to blink five times (7 = hand + 2 blinks);
- the number is committed after a pause with no signal (configurable, for example 1.5 s) or with an explicit "done" signal (to decide).

The app always shows, and can speak aloud, the running number ("column 7"), so a wrong count can be undone.

**Open questions for the author:**
1. What does `HEAD_NOD` mean today: "yes / confirm", "next", or a number?
2. Is "5" from `LOOK_AT_HAND` only for counting, or is it also a shortcut in scanning ("jump 5 columns ahead")?
3. How does he say "that's the end of the number" today: a pause, or a nod?
4. Which hand or direction does he look at (left, right or down)? This matters for calibration.

# Default actions (all remappable in settings)

| Signal | While scanning or counting | In a yes/no question |
|---|---|---|
| `LONG_BLINK` | select (scanning) / +1 (counting) | — |
| `LOOK_AT_HAND` | +5 (counting) | — |
| `HEAD_NOD` | confirm (to confirm with him) | **yes** |
| `HEAD_SHAKE` or `HEAD_LEFT` | **back one step (−1)**: from rows back to columns; at columns, delete the last character | **no** |
| `HEAD_RIGHT` | finish the sentence and ask "Read it aloud?" | — |
| `VERY_LONG_CLOSE` | pause or resume input (rest mode) | — |

The board can also contain **action cells** (space, delete, read aloud, clear). That way he can do everything
with `LONG_BLINK` alone on a day when head movements are not reliable.

# Safety rules
- Nothing is spoken and the text is never cleared without a yes/no confirmation.
- Undo is always one signal away.
- The current state ("scanning columns", "column 3: rows", "paused") is always visible and can be heard.
