---
type: Spec
title: "013: Delete all data from this device - one action in Ustawienia (Settings)"
description: Finding F1 of the security pass. One button in Ustawienia (Settings) removes everything Blinker keeps on the device (settings, imported boards, his signal profile, the sentence history, the language choice, the sentence being written) after a confirmation, and says what it did.
tags: [security, privacy, settings, storage]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-16
---

# Goal

Blinker keeps what he says and how his face moves on the device. Today a caregiver can delete the sentences and
remove imported boards one by one, but not his signal profile or the settings, and not everything in one step
([security pass](../../security-review.md), F1). When Blinker ran on a borrowed phone, or on a caregiver's phone that
goes to someone else, one action must leave nothing of him behind.

# Scope

- A section "Dane na tym urządzeniu" (Data on this device) in Ustawienia (Settings), with one button.
- One service that erases every store and puts every service back to its defaults, without a reload.
- A rule, kept by a test, that everything Blinker stores sits under one key prefix, so a store added later cannot be
  forgotten.

# Rules

- **R1. One action, in Ustawienia (Settings).** A new section "Dane na tym urządzeniu" (Data on this device), placed
  before "O aplikacji" (About). A short text lists what is kept: the settings, imported boards, his calibration, the
  sentences read aloud, the language. One button: "Usuń wszystkie dane" (Delete all data).
- **R2. It asks first.** The button opens the existing confirmation dialog (`ConfirmService`, an alert dialog):
  title "Usunąć wszystkie dane z tego urządzenia?" (Delete all data from this device?); the message names what goes
  (the list of R1) and says that it cannot be undone and that his built-in board stays. The first focus is on
  "Anuluj" (Cancel); Esc and "Anuluj" change nothing.
- **R3. Everything goes, in storage and in memory.** After "Usuń" (Delete):
  - every key that starts with `blinker.` is removed from `localStorage`: the settings, the imported boards and the
    active board, his signal profile, the sentence history, the language choice;
  - the running app goes back to its defaults at once, with no reload: the default settings (so the camera switch is
    off and the theme follows the device), only his built-in board and it is the active one, the default signal
    profile ("not calibrated"), an empty history, and an empty sentence with nothing left to undo; speech that is
    under way stops;
  - the language of the screen stays as it is until the app is opened again (the caregiver is reading the screen);
    only the saved choice is forgotten.
- **R4. It says what happened, in text.** A status message under the button: "Usunięto wszystkie dane z tego
  urządzenia." (All data was deleted from this device.), announced politely (SC 4.1.3). When the storage refuses
  (blocked or unavailable), the message is an error in text: "Nie udało się usunąć danych z pamięci przeglądarki…"
  (The data could not be deleted from the browser's storage…), with what to do (clear the site data in the browser);
  the running app is still reset.
- **R5. One prefix for every key.** Every key Blinker writes starts with `blinker.`. The erase removes by prefix (a
  sweep over the storage), and the services reset themselves; a unit test fills every store, erases, and expects no
  `blinker.` key left and every service at its defaults. A new store that forgets its reset fails that test.
- **R6. Only a person at the screen can do it.** The action is a touch or keyboard action in Ustawienia (Settings).
  No face signal and no cell of a board can reach it: his signals drive only Liczenie (Counting).
- **R7. What it does not remove, said honestly.** The text of the section says that the camera permission is taken
  back in the browser's site settings (a page cannot revoke it), and that the app itself stays installed. The
  service worker's cache holds only the app's own files, no data of his, and stays, so Blinker keeps working offline.

# UI and accessibility notes

- The section follows the other groups of Ustawienia (Settings): an `h2`, a paragraph, a button. The button is an
  outlined Material button in the error color with a text label (not an icon alone), at least 44 px high.
- The dialog is the one used for "Wyczyść" (Clear) and for deleting a board: `role="alertdialog"`, focus trapped,
  Esc closes, focus returns to the button (APG modal dialog; first focus on the least destructive action).
- SC 3.3.4 Error Prevention: deleting user data must be reversible, checked or confirmed; this one is confirmed, and
  the dialog says it cannot be undone. CLAUDE.md rule 13 ("every action can be undone") cannot hold for an erase by
  its nature; the confirmation with the first focus on "Anuluj" (Cancel) is the safeguard, as for "Usuń historię"
  (Delete history).
- The status of R4 is `role="status"`; the error variant uses the same icon-and-text pattern as the store problems.
  Color is never the only sign.
- Both languages (en, pl); the layout is checked at 360 px, portrait and landscape.

# Security and privacy notes

- ASVS V14 (Data Protection): the person in control of the device can remove the data kept on it.
- The erase runs on the device only; nothing is sent anywhere.
- Removing by prefix keeps other sites' data out of reach by construction (the storage is per origin) and leaves
  nothing of Blinker behind even when a key name changes between versions.
- Another open tab or window of Blinker still holds its state in memory and could write it back. Blinker is used
  as one installed app; this is noted under "Out of scope".

# Acceptance criteria

- [ ] Unit: with every store filled (settings, two imported boards and one active, a calibrated profile, a history,
      a language choice) and a sentence being written, the erase leaves no `blinker.` key, and every service reports
      its defaults; a key of another name in the storage is untouched.
- [ ] Unit: a storage that throws on removal gives the error result, and the services are still at their defaults.
- [ ] Unit: every exported storage key constant starts with `blinker.`.
- [ ] e2e (3 device projects): import a board, change a setting, read a sentence aloud; "Usuń wszystkie dane" (Delete
      all data) → the dialog with focus on "Anuluj" (Cancel); "Anuluj" changes nothing; again, "Usuń" (Delete) → the
      status in text; Tablice (Boards) shows only his board, Zdania (Sentences) is empty, the changed setting is
      back at its default; after a reload it is still so; `localStorage` has no `blinker.` key.
- [ ] axe: no violations on Ustawienia (Settings) with the section, with the dialog open, and with the status shown.
- [ ] `npm run verify -- --lighthouse` passes.

# Test plan

- **Unit (Vitest):** a `DeviceData` service spec for R3–R5 with the in-memory storage fake used by the other service
  specs (extended with `key` and `length`); a reset case in each of the specs of `SettingsService`, `BoardsService`,
  `ProfileService`, `HistoryService`, `CountingService` and `LanguageService`; the settings page spec for R1, R2, R4
  (dialog result true and false, both status variants); the translation-keys test covers the new strings.
- **e2e (Playwright + axe):** `settings.e2e.ts` gains the path of the acceptance criteria; the storage is read with
  `page.evaluate`.

# Out of scope

- Deleting single kinds of data from this section ("Usuń kalibrację" (Delete the calibration) alone): the history
  and the boards already have their own delete; the calibration can be done again. A later spec if he needs it.
- Exporting the data before deleting (a backup file).
- Telling other open tabs of Blinker to reset (a `storage` event listener).
- Clearing the service worker cache or uninstalling the app.

# References

- WCAG 2.2, SC 3.3.4 Error Prevention (Legal, Financial, Data) https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html
- WCAG 2.2, SC 4.1.3 Status Messages https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- APG, Alert and Message Dialogs https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/ and Dialog (Modal), on the first focus for a destructive step https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- MDN `Storage.removeItem()` https://developer.mozilla.org/en-US/docs/Web/API/Storage/removeItem and `Storage.key()` (the order of keys is not defined) https://developer.mozilla.org/en-US/docs/Web/API/Storage/key
- OWASP ASVS 5.0.0 https://asvs.owasp.org/
- [Security pass](../../security-review.md), F1; [security conventions](../../conventions/security.md); spec [007](../007-screens/spec.md) (R5 the confirmation, R12 storage).
