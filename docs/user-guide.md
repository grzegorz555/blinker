---
type: Guide
title: Blinker user guide
description: How to use Blinker day to day, for the friend's caregivers and the author; what each tab does, his signals, the first setup and what to do when something goes wrong.
tags: [guide, product]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-21
---

# What Blinker does

Blinker takes over the partner's role at his paper letter board. The phone or tablet watches his face, counts his
signals, picks the column and then the row, and says the chosen letter aloud. Letters build a sentence, which Blinker
reads aloud when he asks for it. Everything happens on the device: no account, no internet needed after the first
visit, and no picture of him is ever sent or kept.

> Blinker is not a medical device. Keep the paper board within reach as a fallback.

# First setup (once per device)

1. Open Blinker in the browser on **his** phone or tablet (the address is in the [README](../README.md)).
2. Add it to the home screen ("Add to Home screen" / "Install app"). From then on it opens like an app and works
   offline. Data stays with that browser on that device: a different browser or address starts empty.
3. Ustawienia (Settings) → Głos (Voice): press "Posłuchaj" (Listen). If Blinker says there is no Polish voice on the
   device, install one in the system speech settings.
4. On the first visit Liczenie (Counting) asks for the camera ("Sterowanie kamerą w Liczeniu" (Camera control in
   Counting) is on by default): allow it. If you refuse, the signal buttons still work and the camera can be allowed later in the browser's site
   settings.
5. Kalibracja (Calibration): go through the steps once with him, at his pace (about 2 minutes), then "Zapisz
   kalibrację" (Save the calibration). Until then Blinker uses default thresholds and shows a hint to calibrate.
6. Put the phone on a stand, facing him as for talking, with his face well lit.

# His signals

| Signal | What he does | In Liczenie (Counting) |
| --- | --- | --- |
| Blink | A strong, deliberate blink (ordinary blinks are ignored) | +1 to the number |
| Hand | A quick turn of the head to his left hand and straight back | +5 to the number |
| Nod | Head down and up | Without a number: a space between words |
| Shake | Head left and right | Undo: removes the last letter |
| Head right | Turns the head to his right | Reads the sentence aloud |

A pause after his blinks takes the column; a pause after the row adds the letter, and only that letter is said.
Blinking again starts the next letter. After reading aloud Blinker asks "Nowe zdanie?" (New sentence?): a nod clears
the sentence, a shake keeps it. A short tone confirms each signal the camera saw. A rising three-note chime means the column is taken: he can
give the row now.

# The tabs

| Tab | What it is for |
| --- | --- |
| **Liczenie (Counting)** | The main screen: his board, the sentence in big letters above it, a short status line with the prompt and the count. The chip at the top says whether the camera sees his face. "Kamera" (Camera) turns the camera off and on by hand, "Pauza" (Pause) stops counting. Buttons below the board: "Cofnij literę" (Undo letter), "Spacja" (Space), "Wyczyść" (Clear, asks first), "Przeczytaj" (Read aloud). A tap on a letter adds it at once. |
| **Zdania (Sentences)** | Every sentence read aloud, grouped by day. "Powiedz jeszcze raz" (Say again) repeats one; you can delete one or all. The history can be turned off in the settings. |
| **Tablice (Boards)** | His built-in board, or a board imported from a `.json` file (checked on the device; errors are shown in text). Preview and delete. |
| **Kalibracja (Calibration)** | A step-by-step wizard that learns his signals: at rest, strong blinks, his hand, a nod, a shake, head right. Each step is said aloud and shows "Wykryto n z k" (Detected n of k). Only numbers are saved, never a picture. |
| **Ustawienia (Settings)** | The pause before the next step, the nod confirmation, the chime before the row, spoken questions, signal buttons and keyboard shortcuts, hints, speech rate and voice, the camera (on or off, preview, a tone per signal, front or rear), language and theme, the sentence history, "Kopia w pliku" (Backup file), and "Usuń wszystkie dane" (Delete all data). Diagnostyka (Diagnostics) is linked from here. |
| **Diagnostyka (Diagnostics)** | For checking and tuning: live eye values and head angles, frames per second, the signals Blinker detects. "Kopiuj wyniki" (Copy the results) copies a text summary (numbers only). |

On a phone the tabs are at the bottom; on a wider screen they are on the left. The current tab has a filled icon and a bold label.

After an operation (an imported board, a deleted sentence, a saved backup) a short message at the bottom confirms
it. After deleting one sentence or one board it offers "Cofnij" (Undo) for 10 seconds; touching or focusing the message
stops the countdown. Errors stay on the page under the button until you try again.

# When something goes wrong

| Problem | What to do |
| --- | --- |
| "Brak twarzy" (No face) | Move the stand so his whole face is in view; add light from the front; avoid a bright window behind him. |
| It misses his blinks or counts extra | Run Kalibracja (Calibration) again in the light he usually has. Check the levels in Diagnostyka (Diagnostics). |
| No sound | Check the volume and the silent switch; Ustawienia (Settings) → "Posłuchaj" (Listen). |
| The camera does not start | Allow the camera for this site in the browser settings; close other apps that use the camera. "Kamera" (Camera) in Liczenie (Counting) starts it again. |
| A wrong letter | A shake removes it; "Cofnij literę" (Undo letter) does the same by tap. Nothing is said aloud without his confirmation. |
| Start over on this device | Ustawienia (Settings) → "Usuń wszystkie dane" (Delete all data), after a confirmation. |
| A new phone, or the browser data was cleared | On the old device: Ustawienia (Settings) → "Zapisz kopię" (Save a backup). On the new one: "Wczytaj kopię" (Restore a backup) with that file. Save a backup after each calibration. |

The camera is used only while Blinker is on screen: it stops when you switch apps or lock the phone and starts again
when you come back.

# Privacy

Camera frames are analysed on the device and never leave it. Settings, boards, his calibration (numbers only) and
the sentence history are kept only in this browser on this device. A backup file ("Zapisz kopię" (Save a backup))
holds his calibration, and his sentences only when "Dołącz historię zdań" (Include the sentence history) is ticked;
keep it to yourself. See [security conventions](conventions/security.md).
