---
type: Spec
title: "018: Toasts that confirm what happened, with Cofnij (Undo) after a delete"
description: A short message at the bottom of the screen (an M3 snackbar) confirms each operation in Tablice (Boards), Zdania (Sentences), Ustawienia (Settings), Kalibracja (Calibration) and Diagnostyka (Diagnostics); after deleting a sentence or a board it offers Cofnij (Undo). Errors stay as text under their control. Not in Liczenie (Counting), not for each switch.
tags: [ui, accessibility, feedback]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-25
---

# Goal

A caregiver taps "Wczytaj kopię" (Restore a backup), "Usuń" (Delete) or "Zapisz kalibrację" (Save the calibration)
and should see at once that it worked. Today some operations say it in a line of text under the button, which is easy
to miss on a phone, and some say nothing at all (deleting a board or a sentence, choosing a board). One consistent,
visible confirmation for every operation, and a way back after a delete.

Decided by the author (2026-11-25):
- a success is a toast; the success texts under the buttons go; **errors stay as text** under their control;
- after deleting **one sentence** or **one board**, the toast offers **"Cofnij" (Undo)**; the dialog before the delete
  stays;
- **no toasts in Liczenie (Counting)** (it has its own notice line and he works there), and **none for a switch** (a
  switch shows its own state).

# Scope

- A `ToastService` in `shared/` on Angular Material's `MatSnackBar` (M3 snackbar), with our placement, timing and
  announcement rules.
- Each operation listed in R5 shows its toast; R6 adds Cofnij (Undo) to two of them.
- The services gain what Cofnij (Undo) needs: put a deleted sentence or board back.

# Rules

- **R1. One look, one place.** An M3 snackbar: one line or two of text, at most one action, at the bottom center of
  `<main>`. Below 600 px it sits **above the navigation bar** and never covers it (the bar is how you leave; SC 2.4.11
  Focus Not Obscured); from 600 px (the rail) it sits at the bottom of the content area. It never covers the focused
  control: a toast shown while the keyboard focus is in its area moves up. One toast at a time; a new one replaces
  the old.
- **R2. Announced once, politely.** The toast text is announced through a polite live region (Material's
  `LiveAnnouncer`, SC 4.1.3). The inline success texts it replaces are removed, so nothing is announced twice. Errors
  are not toasts: they stay as persistent text under their control, as today (SC 3.3.1), and keep their own
  `role="status"` or `role="alert"`.
- **R3. Timing that can be read.** A toast without an action stays 6 s; one with Cofnij (Undo) stays 10 s. The timer
  **pauses while the pointer is over the toast or the keyboard focus is in it**, and starts again when it leaves
  (SC 2.2.1: the time can be extended). The action is reachable with Tab, as the last element of the page. Esc while
  the focus is in the toast closes it. With `prefers-reduced-motion: reduce` it appears and disappears without the
  slide.
  **The time left is visible** (author, 2026-11-25): a ring in `inverse-primary` runs around the edge of the toast and
  shrinks to nothing as the toast goes. While the toast is held (pointer or focus), the ring stands still, so it is
  plain that the time does not run; nothing else in the toast changes (no mark, no change of size: the author,
  2026-11-25). The ring is decorative (`aria-hidden`): the live region does not change while the toast is shown. A CSS
  animation as long as the toast's time draws it smoothly and is paused while held; with `prefers-reduced-motion` it
  moves in steps of a second.
- **R4. Words, not only color.** The text says what happened in full ("Usunięto tablicę „Kuchnia”." (Deleted the
  board "Kuchnia".)); an icon is decorative (`aria-hidden`). Contrast of the text and the action on the M3
  inverse-surface colors of our tokens at least 4.5:1, checked by the token contrast test.
- **R5. Which operations, and what they say.**

  | Screen | Operation | Toast |
  |---|---|---|
  | Tablice (Boards) | import | "Zaimportowano tablicę „{name}”." (Imported the board "{name}".), or "Zastąpiono tablicę „{name}” nowym plikiem." when an imported board was replaced; the hint "Wybierz ją powyżej…" (Choose it above…) stays as text on the page |
  | Tablice (Boards) | choose the active board | "Wybrana tablica: {name}." (Active board: {name}.) |
  | Tablice (Boards) | delete a board (after the dialog) | "Usunięto tablicę „{name}”." + Cofnij (Undo) |
  | Zdania (Sentences) | delete one sentence (after the dialog) | "Usunięto zdanie." + Cofnij (Undo) |
  | Zdania (Sentences) | "Usuń historię" (Delete history) (after the dialog) | "Usunięto historię zdań." |
  | Zdania (Sentences) | the history turned off (after the dialog) or on | "Historia zdań wyłączona i usunięta." / "Historia zdań włączona." |
  | Ustawienia (Settings) | "Zapisz kopię" (Save a backup) | "Zapisano plik {file}. Trzymaj go tylko u siebie." (Saved {file}. Keep it to yourself.) |
  | Ustawienia (Settings) | "Wczytaj kopię" (Restore a backup) | "Wczytano kopię z {date}." (Restored the backup from {date}.) |
  | Ustawienia (Settings) | "Usuń wszystkie dane" (Delete all data) | "Usunięto wszystkie dane z tego urządzenia." |
  | Kalibracja (Calibration) | "Zapisz kalibrację" (Save the calibration) | "Zapisano kalibrację. Blinker używa jej od teraz." |
  | Diagnostyka (Diagnostics) | "Kopiuj wyniki" (Copy the results) | "Skopiowano wyniki (bez obrazu)." |

  Not a toast: Liczenie (Counting) (its notice line and voice stay as they are), each switch, field and radio in
  Ustawienia (Settings) (the control shows its state), "Posłuchaj" (Listen) and "Powiedz jeszcze raz" (Say again)
  (they speak).
- **R6. Cofnij (Undo) after deleting one sentence or one board.** Cofnij (Undo) puts back exactly what was deleted:
  - the sentence returns to its place in the history (same text, language and time), and is saved again;
  - the board returns to the list and, if it was the active board, becomes active again;
  - then a toast says "Przywrócono zdanie." (Restored the sentence.) / "Przywrócono tablicę „{name}”." (Restored the
    board "{name}".);
  - Cofnij (Undo) works once and only while its toast is shown; a later delete, a new toast or leaving the screen ends
    it. "Usuń historię" (Delete history) and "Usuń wszystkie dane" (Delete all data) have no Cofnij (Undo): they stay
    behind their dialog with the first focus on "Anuluj" (Cancel), as specs 007 and 013 say.
- **R7. Only a person at the screen.** Toasts and Cofnij (Undo) are touch, pointer and keyboard only; no face signal
  reaches them (his signals drive only Liczenie (Counting), where there are no toasts).

# UI and accessibility notes

- Angular Material snackbar (`MatSnackBar.openFromComponent` with our small component, so the action has our label and
  the timer can pause); styled by our M3 tokens (inverse surface), not by default colors. https://material.angular.dev/components/snack-bar/overview
- M3 snackbar guidance: one action at most, no icon-only action, not for errors that need a fix. https://m3.material.io/components/snackbar/guidelines
- APG and WCAG: status messages without moving focus (SC 4.1.3); the time is extendable (SC 2.2.1); the toast never
  covers the focused element or the navigation (SC 2.4.11); targets at least 24 px, ours 44 px (SC 2.5.8).
- Both languages; checked at 320 and 360 px portrait and in landscape, with a wider font (`docs/knowledge/layout-fits-with-a-wider-font.md`).

# Security and privacy notes

- A toast shows only what the screen already showed (a board name, a file name, a date); no sentence text is shown in
  a toast ("Usunięto zdanie." (Deleted the sentence.), not the sentence).
- Board names come from imported files: they are already validated and are rendered as text, never as HTML.

# Acceptance criteria

- [x] Unit (`ToastService`): the durations (6 s, 10 s), the pause and restart on pointer and focus, Esc, one toast at
      a time, the action called once, the polite announcement; the ring of time left, standing still while held.
- [x] Unit (services): `HistoryService` and `BoardsService` put a deleted sentence or board back (place, active board,
      storage), once.
- [x] Unit (pages): each operation of R5 opens its toast and no longer shows the inline success text; errors still
      show inline; Cofnij (Undo) restores and says so.
- [x] e2e (3 device projects): delete a board → toast with Cofnij (Undo) above the navigation bar at 360 × 640 →
      Cofnij (Undo) brings it back and active; delete a sentence → Cofnij (Undo); restore a backup → toast; the timer
      pauses with the focus in the toast; axe with a toast shown; no toast in Liczenie (Counting).
- [x] `npm run verify -- --lighthouse` passes.

# Test plan

- **Unit (Vitest):** `toast.service.spec.ts` with fake timers; the history and boards service specs for the undo;
  the page specs of Tablice (Boards), Zdania (Sentences), Ustawienia (Settings), Kalibracja (Calibration) and
  Diagnostyka (Diagnostics) with a fake `ToastService`.
- **e2e (Playwright + axe):** `e2e/toasts.e2e.ts`; the existing e2e that read the removed inline texts read the
  toast instead.

# Out of scope

- Toasts in Liczenie (Counting) or for each setting (author, 2026-11-25).
- Cofnij (Undo) for "Usuń historię" (Delete history), "Usuń wszystkie dane" (Delete all data), an import that replaced
  a board, or a restored backup.
- A history of past toasts.

# References

- Angular Material snack bar https://material.angular.dev/components/snack-bar/overview and `LiveAnnouncer` https://material.angular.dev/cdk/a11y/overview#liveannouncer
- M3 snackbar https://m3.material.io/components/snackbar/guidelines
- WCAG 2.2: SC 2.2.1 Timing Adjustable https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html, SC 2.4.11 Focus Not Obscured (Minimum) https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html, SC 3.3.1 Error Identification https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html, SC 4.1.3 Status Messages https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- `prefers-reduced-motion` https://developer.mozilla.org/docs/Web/CSS/@media/prefers-reduced-motion
- Specs [007](../007-screens/spec.md) (the screens, the confirmations), [013](../013-delete-all-data/spec.md), [017](../017-backup/spec.md); `docs/knowledge/sticky-bar-covers-controls.md`.
