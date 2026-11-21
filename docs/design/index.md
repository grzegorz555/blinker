---
type: Design
title: "Blinker design: visual language, tokens, app structure and screens"
description: The outcome of spec 004 - Material 3 on our own tokens, Liczenie (Counting: the board) as the main screen, the shell, every screen and state of the mock-ups, the token table with contrast ratios, and what the author decided after viewing them.
tags: [design, accessibility, tokens, mockups]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-13
verified:
  - by: human:Grzegorz Roczniak
    at: 2026-11-13
---

# Who it is for

Two audiences ([accessibility conventions](../conventions/accessibility.md)):

1. **He communicates** with the board, on his own: he looks at the board, the question and the sentence, and
   controls Blinker with **face signals only** (a strong blink +1, a look at his hand +5, a nod = yes, a head shake =
   no, see the [interaction model](../interaction-model.md)). The goal is that he manages **without a caregiver**.
2. **A caregiver** sets things up (calibration, boards, settings) by touch, keyboard or a screen reader.

Everything he looks at follows the AAC rules (7:1, cells at least 32 px, a pointer that never relies on color);
the caregiver parts follow WCAG 2.2 AA.

# Visual language

**Material Design 3** ([M3](https://m3.material.io)), the system that Angular Material implements
([ADR-0005](../adr/0005-angular-material-m3.md), proposed), on **our own tokens** and inline SVG icons (no web fonts,
no third-party origins).

- Tonal "filled" cards without borders or shadows; pill-shaped buttons with sentence-case labels: **filled** for the
  one main action of a view ("Przeczytaj" (Read aloud)), **tonal** for the others, **outlined** for the quiet ones.
- One hue (indigo) on near-neutral surfaces. Color marks what is active or important, never decoration, and never
  carries meaning alone: the pointer has a 4 px outline and bold text, an error has an icon and the word "Błąd" (Error).
- System font stack (Roboto on Android, San Francisco on iOS, Segoe UI on Windows), the M3 type scale.
- Light and dark from the system, or forced by the theme setting: every token is a `light-dark()` pair.

Rejected on the way, for the record: three directions (T2: calm light, high contrast, warm) showed that the layout
works but not a convincing look; a shadcn/ui style with a start dashboard (T3) read as black and white, and the
layout as random.

# Tokens

The only source of colors is [`src/web/src/styles/tokens.css`](../../src/web/src/styles/tokens.css) (R3). Each
token maps to an M3 color role. The ratios below come from `node scripts/contrast.mjs`, which also runs in
`npm run test:scripts` and fails below the threshold.

| Pair | What it is | Needs | Light | Dark |
|---|---|---|---|---|
| `fg` on `bg` | board letters, question and sentence | 7:1 | 17.0:1 | 15.4:1 |
| `fg` on `surface` | board letters on cells, active cell | 7:1 | 15.1:1 | 13.7:1 |
| `on-primary-container` on `primary-container` | the question he reads | 7:1 | 12.6:1 | 9.7:1 |
| `fg` on `primary-container` | letters in the active column | 7:1 | 13.8:1 | 9.3:1 |
| `on-primary` on `primary` | button text | 4.5:1 | 7.8:1 | 8.1:1 |
| `muted` on `bg` | secondary text | 4.5:1 | 7.8:1 | 10.3:1 |
| `muted` on `surface` | secondary text on cells and panels | 4.5:1 | 6.9:1 | 9.2:1 |
| `primary` on `bg` | links and accent text | 4.5:1 | 7.5:1 | 10.2:1 |
| `primary` on `surface` | outlined button text on a card | 4.5:1 | 6.6:1 | 9.1:1 |
| `on-secondary-container` on `secondary-container` | tonal buttons, current navigation item | 4.5:1 | 12.0:1 | 9.3:1 |
| `error` on `bg` | form error text, invalid field border | 4.5:1 | 6.9:1 | 10.7:1 |
| `error` on `surface` | form error text on a card | 4.5:1 | 6.1:1 | 9.5:1 |
| `border` on `bg` | control borders | 3:1 | 4.9:1 | 5.5:1 |
| `border` on `surface` | control borders on panels | 3:1 | 4.3:1 | 4.9:1 |
| `highlight` on `bg` | active column or row outline, focus ring | 3:1 | 7.5:1 | 10.2:1 |
| `highlight` on `surface` | active outline next to a cell | 3:1 | 6.6:1 | 9.1:1 |
| `highlight` on `primary-container` | active outline inside the active cell | 3:1 | 6.0:1 | 6.1:1 |

`line` (decorative dividers) and `subtle` (the navigation indicator) are not text and carry no meaning, so they
have no threshold. `theme-color` is `--bg` (`#f9fafe` light, `#0c0e14` dark), the color of the top app bar, checked by
`scripts/theme-color.mjs`. The app icon (an open eye in `on-primary` on `primary`) has separate `any` and `maskable`
files, generated from the tokens by `npm run icons`.

# App structure

One shell on every page (R12): a small top app bar, and the same navigation in the same order (SC 3.2.3) with the
current page marked by `aria-current="page"`:

**Liczenie** (Counting) · **Zdania** (Sentences) · **Tablice** (Boards) · **Kalibracja** (Calibration) · **Ustawienia** (Settings)

In the app Kalibracja (Calibration) joined the navigation in spec 011 (stage 4), between Tablice (Boards) and
Ustawienia (Settings). Before that (spec 007) the
navigation has four items. The shell is exactly the viewport high and only the main area scrolls, so nothing slides
under the navigation bar; the skip link appears in the top app bar over the page title.

- Below 600 px: an M3 **navigation bar** at the bottom (icons with labels, 44 px targets, safe-area padding).
- From 600 px: an M3 **navigation rail** on the left, so the board keeps the width.
- Navigation states (both): the current page has the `subtle` pill, a **filled** icon and a bold label; the others an
  outline icon. Hover (only on devices that can hover) adds the M3 state layer, the content color at 8% over the pill.

**Spec 008 (he listens, he does not read):** on Liczenie (Counting) the prompt and the counter are a small status line at
the top, **the sentence is the biggest text, above the board** (beside it in landscape), and the step label is gone.

**Liczenie** (Counting), the main screen, uses the M3 supporting-pane layout: the board is the main pane and is never covered or
scrolled; the question with the counter and the sentence with its actions are the supporting pane. Portrait:
question, board, sentence from top to bottom. Landscape: the board on the left, the pane on the right. It runs on his
signals, and every letter and action can also be tapped. On a narrow phone held upright the step label goes and
the hint gets smaller, so the board keeps its height in any system font
([learning](../knowledge/layout-fits-with-a-wider-font.md)).

# Screens and states

The mock-ups live in `src/web/design/` (`npm run design:build`, `npm run design:serve` to view them on a phone);
they never ship in the app.

| Page | What it shows |
|---|---|
| `communicate.html` (Liczenie: Counting) | the board, the question and counter, the sentence with "Cofnij literę" (Undo letter), "Wyczyść" (Clear), "Przeczytaj" (Read aloud); "Pauza" (Pause) and the mode status in the top bar |
| `sentences.html` (Zdania: Sentences) | sentences by day, each with a repeat-aloud button |
| `boards.html` (Tablice: Boards) | the active board (radio group), a preview of his layout, a JSON import with errors in text |
| `calibrate.html` (Kalibracja: Calibration) | readiness (calibration, camera, voice) and his signals for new caregivers; "Kalibruj ponownie" (Calibrate again) |
| `calibrate-wizard.html` | eight steps: intro, camera (explained before the prompt), blink, left hand, right hand (can be skipped), nod, shake, result |
| `settings.html` (Ustawienia: Settings) | mode, timings with range errors (SC 2.2.1), signal mapping, voice and speech rate, "Podpowiedzi w Liczeniu" (Hints in Counting), language, theme |

Liczenie (Counting) states (R8), each at `communicate.html#<state>`, linked from the catalog: `waiting-column`, `counting`
(hand + 2 blinks = 7), `asking-column` ("Kolumna 7?" (Column 7?)), `rejected` ("Jeszcze raz" (Again)), `waiting-row`, `asking-row`
("Wiersz 3?" (Row 3?)), `letter-added` ("Dodano W" (Added W), spoken), `confirm-speak` ("Przeczytać na głos?" (Read it aloud?)), `speaking`, `paused`,
`no-face` and `caregiver` (the phone held by a caregiver, rear camera, no board in focus).

The signal simulator (`?sim=1` for buttons; keys Space, H, N, S, R, P, F) plays his signals in the mock-up only. Its
behavior follows the interaction model: Blinker asks after a short pause, a shake rejects the number, a second shake
right after a rejection changes nothing, a shake at the columns undoes the last letter added, and nothing is read
aloud without a nod ([learning](../knowledge/no-depends-on-context.md)).

# What the author decided after viewing the mock-ups

- **The look is approved** after polish round 1 and T4–T6 (2026-11-13: "jest ok", "elegancko").
- **He should manage the board on his own, without a caregiver.** Caregiver features (the caregiver-held layout, the
  hints for new caregivers) are optional extras, and the author may hide the hints on Liczenie (Counting), on the phone and on
  the desktop; the "Podpowiedzi w Liczeniu" (Hints in Counting) switch is ready for that.
- **He controls Blinker with his head**; keyboard control matters little. The simulator's single-key shortcuts are a
  stand-in for his signals and a known exception to SC 2.1.4 in the mock-up only (spec 004, R7).
- Still to do with him: the trial at stage 6 (pace, the pause before the question, what happens after a miscount).

# References

- Material Design 3: color roles https://m3.material.io/styles/color/roles, canonical layouts
  https://m3.material.io/foundations/layout/canonical-layouts/supporting-pane, navigation bar and rail
  https://m3.material.io/components/navigation-bar/specs
- WCAG 2.2: contrast SC 1.4.3 and 1.4.6, non-text contrast SC 1.4.11, use of color SC 1.4.1, timing adjustable
  SC 2.2.1, character key shortcuts SC 2.1.4 https://www.w3.org/TR/WCAG22/
- `light-dark()` https://developer.mozilla.org/docs/Web/CSS/color_value/light-dark; `theme-color`
  https://developer.mozilla.org/docs/Web/HTML/Reference/Elements/meta/name/theme-color; maskable icons
  https://web.dev/articles/maskable-icon
- Spec [004](../specs/004-mockups/spec.md) and its [tasks](../specs/004-mockups/tasks.md).
