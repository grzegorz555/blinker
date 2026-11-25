---
type: Spec
title: "017: A backup of his data in a file - save and restore in Ustawienia (Settings)"
description: Before the first session with him, his calibration must survive a new phone, a cleared browser or a new address. Ustawienia (Settings) saves everything Blinker keeps (the sentence history only when asked) to one .json file, and restores such a file after a confirmation, validated like an imported board.
tags: [settings, storage, privacy, security]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-25
---

# Goal

The first session with him will produce his calibration, the most valuable data Blinker has. Today it lives only in
the browser storage of one device: a new phone, cleared site data or a new address (a custom domain, ADR-0003) and
it is gone. A caregiver must be able to save it to a file and bring it back, without an account and without a
server.

Decided by the author (2026-11-25):
- the sentence history is in the backup **only when asked**: a checkbox, off by default;
- a restore **replaces** the data on the device, after a confirmation; it does not merge.

# Scope

- Two actions in the section "Dane na tym urządzeniu" (Data on this device) of Ustawienia (Settings), above
  "Usuń wszystkie dane" (Delete all data, spec 013): "Zapisz kopię" (Save a backup) and "Wczytaj kopię" (Restore a
  backup).
- One file format, versioned, built only from what Blinker already stores and validated part by part with the
  validators that already guard the storage.
- A `BackupService` in the core: build the file, check a file, apply it.

# Rules

- **R1. Two actions, in Ustawienia (Settings).** In "Dane na tym urządzeniu" (Data on this device), above "Usuń
  wszystkie dane" (Delete all data): a short text ("Kopia w pliku przenosi jego kalibrację, ustawienia i tablice na
  inny telefon albo przeglądarkę." (A backup file moves his calibration, settings and boards to another phone or
  browser.)), a checkbox "Dołącz historię zdań" (Include the sentence history), off, and two buttons: "Zapisz kopię"
  (Save a backup) and "Wczytaj kopię" (Restore a backup).
- **R2. What a backup holds.** Every store of spec 013 that has a value: the settings, the imported boards and the
  active board, his signal profile (calibration), the saved language choice; the sentence history only with the
  checkbox ticked. The checkbox is not remembered: it is off each time the page opens. The sentence being written
  and the undo steps are not saved (they are not stored today either).
- **R3. Saving.** "Zapisz kopię" (Save a backup) downloads `blinker-kopia-YYYY-MM-DD.json` (in English
  `blinker-backup-YYYY-MM-DD.json`, the local date), made on the device (a `Blob` and a link with `download`, as the
  example board of Tablice (Boards)). A status in text says the file name and that it holds his calibration (and his
  sentences, when included), so it should be kept private.
- **R4. The file format.** UTF-8 JSON, one object:
  ```json
  {
    "format": "blinker-backup",
    "version": 1,
    "createdAt": "2026-11-25T10:00:00.000Z",
    "data": {
      "settings": { },
      "boards": [ ],
      "activeBoard": "his-board",
      "profile": { },
      "language": "pl",
      "history": [ ]
    }
  }
  ```
  Every field of `data` is optional (absent = the device had nothing stored there); `history` is present only when
  included. Each value has exactly the shape the store keeps today, so the format follows the stores.
- **R5. Checking a file: untrusted input, all or nothing.** "Wczytaj kopię" (Restore a backup) opens the system file
  picker (`.json`). The file is checked before anything changes, and never throws:
  - at most 4 MiB; strict UTF-8 (a binary file or another encoding is refused; a leading BOM is dropped); JSON;
  - the envelope: `format` is `"blinker-backup"`, `version` is `1` (a newer version is refused with its own
    message), `createdAt` is a valid date not in the future by more than a day; unknown fields and the keys
    `__proto__`, `constructor`, `prototype` are refused at every level the envelope owns;
  - each part goes through the validator its store already uses when it reads itself back: `validateSettings`,
    `validateBoardData` for each board (at most 50 boards; the built-in board is never in the file and never
    replaced), the active board must be the built-in board or one of the file's boards, `validateProfile`,
    `validateHistory`, the language among the supported ones;
  - one invalid part refuses the whole file. The error in text names the part ("Kalibracja w pliku jest
    nieprawidłowa." (The calibration in the file is invalid.)); nothing on the device changes.
- **R6. It asks first, and says what will change.** A valid file opens the confirmation dialog (`ConfirmService`):
  title "Wczytać kopię z 25.11.2026?" (Restore the backup from 25 Nov 2026?), with what the file holds (the settings;
  N boards; his calibration, or "bez kalibracji" (no calibration); N sentences, or "bez historii zdań" (no sentence
  history)) and that it replaces these on this device. The first focus is on "Anuluj" (Cancel); Esc and "Anuluj"
  change nothing.
- **R7. Restoring replaces, predictably.** After "Wczytaj" (Restore), the device holds what the file holds:
  - the settings, the imported boards, the active board, the profile and the language choice are replaced; a part
    absent from the file is reset to its default (so the device matches the device the file came from);
  - **the sentence history is the exception:** a file with a history replaces it; a file without one leaves the
    history on this device as it is. A default backup has no history, and restoring it must not erase his sentences
    without a word; the dialog says which case applies;
  - the running app takes the new data at once, without a reload (the services read their stores again, as after
    the erase of spec 013): the theme, the board, the calibration, the language on screen; the sentence being
    written is cleared and speech under way stops;
  - when the storage refuses a write part way, the values written so far are put back to what they were, the
    running app is not changed, and the error says so ("Nie udało się zapisać danych w pamięci przeglądarki…" (The
    data could not be saved in the browser's storage…)).
- **R8. It says what happened, in text.** A status under the buttons, announced politely (SC 4.1.3): "Wczytano kopię
  z 25.11.2026." (Restored the backup from 25 Nov 2026.), or the error of R5 or R7, with the same icon-and-text
  pattern as the other messages of Ustawienia (Settings).
- **R9. Only a person at the screen can do it.** Touch or keyboard in Ustawienia (Settings); no face signal and no
  board cell reaches these actions (as spec 013, R6).

# UI and accessibility notes

- The checkbox is a Material checkbox with a visible label; the buttons are outlined Material buttons with text
  labels, at least 44 px high. The hidden file input and a button that opens it follow Tablice (Boards).
- The dialog is the existing alert dialog: focus trapped, Esc closes, focus returns to the button.
- SC 3.3.4 Error Prevention: a restore replaces user data, so it is checked (R5) and confirmed (R6); the history,
  the most personal part, is never lost by a default backup (R7). CLAUDE.md rule 13: a restore cannot be undone in
  one signal; the confirmation with the first focus on "Anuluj" (Cancel) is the safeguard, as for spec 013.
- Both languages; the dates in the dialog and the status are formatted for the screen language; the layout is
  checked at 360 px, portrait and landscape.

# Security and privacy notes

- Everything happens on the device. The file leaves the app only where the person saves or sends it; the status of
  R3 says that it holds his calibration (and his sentences, when included).
- The history is off by default (author, 2026-11-25): a backup made "just in case" does not carry his words.
- A restored file is untrusted input (security conventions): size cap, strict decoding, no prototype keys, and each
  part through the same validator as the storage; no part of the file is ever rendered as HTML.
- ASVS V14 (Data Protection): the person in control of the device can take the data along and bring it back.

# Acceptance criteria

- [x] Unit (`BackupService`): build with and without the history; a round trip (build, check, apply) gives the same
      stores; every R5 refusal (too large, not UTF-8, not JSON, wrong format, newer version, future date, unknown
      field, prototype key, each invalid part, too many boards, an active board that is not there) changes nothing;
      R7 with and without a history in the file; a storage that throws part way puts the old values back.
- [x] Unit (Ustawienia (Settings) page): the checkbox off on each visit; the file name; the dialog text for both
      history cases; the statuses.
- [x] e2e (3 device projects): calibrate nothing, change a setting, import a board, read a sentence; save a backup
      (the download's name and content); "Usuń wszystkie dane" (Delete all data); restore the file → the setting and
      the board are back, the history stays empty (the default backup has none); with the checkbox ticked the
      history comes back too; an invalid file shows the error and changes nothing; axe on the section, the dialog
      and the statuses.
- [x] `npm run verify -- --lighthouse` passes.

# Test plan

- **Unit (Vitest):** `backup.ts` (pure: build, check) and `backup.service.ts` (apply, with the in-memory storage fake
  of spec 013 and a storage that throws on the n-th write); a reload method per service where needed (settings,
  boards, profile, history, language), each with its own test; the settings page spec; the translation-keys test.
- **e2e (Playwright + axe):** `settings.e2e.ts`, reading the download with Playwright's `download` event and
  uploading with `setInputFiles`.

# Out of scope

- Merging a backup into the data on the device (author, 2026-11-25: replace).
- Sharing the file through the Web Share API, encrypting it, or saving it automatically.
- Restoring the sentence being written or the undo steps.
- A backup of the built-in board (it ships with the app).

# References

- MDN `Blob` https://developer.mozilla.org/docs/Web/API/Blob, `URL.createObjectURL()` https://developer.mozilla.org/docs/Web/API/URL/createObjectURL_static and `<a download>` https://developer.mozilla.org/docs/Web/HTML/Reference/Elements/a#download
- MDN `<input type="file">` https://developer.mozilla.org/docs/Web/HTML/Reference/Elements/input/file and `TextDecoder` with `fatal` https://developer.mozilla.org/docs/Web/API/TextDecoder/fatal
- OWASP File Upload Cheat Sheet https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- WCAG 2.2, SC 3.3.4 Error Prevention https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html and SC 4.1.3 Status Messages https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- Playwright downloads https://playwright.dev/docs/downloads and `setInputFiles` https://playwright.dev/docs/input#upload-files
- Specs [013](../013-delete-all-data/spec.md) (the stores, the prefix, the reset), [007](../007-screens/spec.md) (R12 storage), the [board format](../../board-format.md); [security conventions](../../conventions/security.md).
