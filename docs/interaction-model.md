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
| `HEAD_NOD` | head pitch down and back up within a time window (facial transformation matrix) | **confirmed: he uses it today to confirm ("yes")** |
| `HEAD_LEFT` / `HEAD_RIGHT` | head yaw past the threshold, then back to neutral | possible |
| `HEAD_SHAKE` | yaw left-right-left | **confirmed: he uses it today for "no"** |
| `LOOK_AT_HAND` | gaze held down towards his hand, usually to his left, sometimes to his right (`eyeLook*` blendshapes, both directions calibrated) | **confirmed: he uses it today, it means "5" (counting only)** |
| `GAZE_UP` | `eyeLookUp*` held | possible |
| `SWITCH` | Space key, on-screen button or Bluetooth switch | always available (caregiver, tests, accessibility) |

# Input modes
The board is the same in both modes. The mode decides **how a column or a row number is chosen**.

**Decided by the author on 2026-11-11:**
- **Counting (mode B) is the default mode**, because it is how he communicates today.
- **The proof of concept (PoC) is counting only:** `LONG_BLINK` (+1), `LOOK_AT_HAND` (+5), and `HEAD_NOD` / `HEAD_SHAKE` to confirm or reject each number. Scanning (mode A) is built and tested **after** the PoC.

## Mode A: scanning (after the PoC)
The app highlights the columns one by one at a configurable pace (optionally with an audio cue).
`LONG_BLINK` selects the highlighted column. The app then scans the rows inside that column, and `LONG_BLINK` selects the cell.

## Mode B: counting (default, and the PoC; how he works today; confirmed by the author on 2026-11-11)
This mode copies the way a caregiver works with him today: he gives a **number**, the caregiver says it aloud, and he
confirms it with a nod or rejects it by shaking his head. Blinker takes the caregiver's role.

1. **Column first, then row.** The column numbers (1–7) are printed above the paper board and the row numbers (1–5) on its left.
2. While he gives a number:
   - each `LONG_BLINK` adds **1**;
   - `LOOK_AT_HAND` adds **5**, so he doesn't have to blink five times (7 = hand + 2 blinks). He looks **down at his hand, usually to his left, sometimes to his right**, so calibration must accept either side.
3. When no signal comes for a short while (configurable), **the pause takes the number** (spec 009, the default): the
   column is fixed and he gives the row the same way; the pause after the row adds the letter, and Blinker **says only
   the letter** ("K"). Blinking again is the next letter; a shake right after it undoes it, so he gives it again.
4. With "Potwierdzaj kolumnę i wiersz skinieniem" (Confirm the column and the row with a nod) on, Blinker asks instead,
   on screen (and aloud with "Mów pytania i komunikaty" (Say the questions and notices) on): "Column 4?":
   - `HEAD_NOD` = yes: the column is fixed, and he gives the row number the same way ("Row 2?");
   - `HEAD_SHAKE` = no: the number is discarded and he gives it again.
5. After the row, Blinker says the letter ("K") and appends it to the text. Undo is still one signal away.

`LOOK_AT_HAND` = 5 is used **only in counting**. In scanning it means nothing (decided on 2026-11-11), so a glance at
his hand can never make the scan jump.

**How he gives numbers (author, 2026-11-12):** he gives a number by **blinking**, and today **the caregiver
confirms it** (says it aloud and waits for his answer). In Blinker the confirmation should be done **with his head**
(`HEAD_NOD` / `HEAD_SHAKE`, steps 3–4 above), so no caregiver is needed.

**He listens, he does not read (author, 2026-11-14):** he knows the digits and which letter is under each column and
row, and he **puts words together by ear**, not by reading. The screen shows the sentence in big letters for the
people around him, and the prompts small (spec 008). **The voice says only the chosen letter, and the whole sentence
when he asks for it** (author, 2026-11-14, spec 009): questions and notices are shown and announced to screen
readers, and said aloud only with "Mów pytania i komunikaty" (Say the questions and notices) on.

**Shortcuts by head (spec 008):**
- **space** = a nod without a number while Blinker waits for a column;
- **undo** = a shake while Blinker waits for a column (right after a letter: the letter starts over; it also brings
  back a cleared sentence);
- **read aloud** = head right, then a nod on "Przeczytać na głos?" (Read it aloud?);
- **new sentence** = a nod on "Nowe zdanie?" (New sentence?), which Blinker asks when a reading ends; a shake keeps
  the sentence, a blink or a hand goes on with it.

**Still open:**
- The pace and the pauses between signals, and what happens after a miscount: tuned during the trial (stage 6).
- How long the pause before "Column 4?" should be: we tune it during the trial with him (stage 6).
- Whether the pause alone (spec 009, the default) or the nod per number suits him better: the setting is there, the
  trial (stage 6) decides.

# Default actions (all remappable in settings)

| Signal | While scanning or counting | In a yes/no question |
|---|---|---|
| `LONG_BLINK` | select (scanning) / +1 (counting) | — |
| `LOOK_AT_HAND` | +5 (counting only; ignored in scanning) | — |
| `HEAD_NOD` | confirm the number Blinker asked about (with the nod confirmation on); **without a number, while Blinker waits for a column: a space** (the end of a word; author, 2026-11-13) | **yes** |
| `HEAD_SHAKE` or `HEAD_LEFT` | **no / back one step (−1)**: in counting, discard the number Blinker asked about; otherwise from rows back to columns, and at columns delete the last character | **no** |
| `HEAD_RIGHT` | finish the sentence and ask "Read it aloud?"; after reading, Blinker asks "New sentence?" | — |
| `VERY_LONG_CLOSE` | pause or resume input (rest mode) | — |

The board can also contain **action cells** (space, delete, read aloud, clear). That way he can do everything
with `LONG_BLINK` alone on a day when head movements are not reliable.

# Safety rules
- The sentence is never read aloud or cleared without a yes/no confirmation; a chosen letter is said at once and
  undone by one shake.
- Undo is always one signal away.
- The current state ("scanning columns", "column 3: rows", "paused") is always visible and can be heard.
