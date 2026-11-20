---
type: Decision
title: "ADR-0007: A self-hosted Polish word list from OpenSubtitles frequencies (CC BY-SA 4.0) for word prediction"
description: Accepted with spec 016 (2026-11-20). Word prediction needs a list of frequent Polish word forms; we build 20,000 of them once from FrequencyWords (OpenSubtitles 2018, CC BY-SA 4.0), commit the file with its attribution, serve it from our origin and cache it for offline. The author chose it over Leipzig (written language).
tags: [adr, prediction, privacy, licensing]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-20
verified:
  - by: human:Grzegorz Roczniak
    at: 2026-11-20
---

# ADR-0007: A self-hosted Polish word list from OpenSubtitles frequencies (CC BY-SA 4.0) for word prediction

- Status: Accepted (2026-11-20)
- Date: 2026-11-20

## Context
Spec 016 guesses the word he is spelling. Without a list of frequent Polish word forms the guesses start empty, and
his own words (learnt on the device) take weeks to help. The list is third-party data: it must be licensed for our
use, served from our origin (no CDN, `connect-src 'self'`, ADR-0001), small enough for a phone's offline cache, and in
everyday spoken Polish, because he says things like "chcę" (I want), "boli" (it hurts), "jestem" (I am). Polish
inflects, so the list must hold word forms, not lemmas. The repository is public, its code all rights reserved.

## Decision criteria
1. A license that allows shipping the data in a public app, with clear attribution.
2. Spoken, everyday forms (AAC is conversation).
3. Privacy: no request leaves our origin; works offline.
4. Size on the device and in the repo.
5. Effort to build and to replace later.

## Considered options
1. **FrequencyWords, OpenSubtitles 2018, `pl_50k.txt`** (Hermit Dave; content CC BY-SA 4.0, code MIT). Pros: word
   forms ranked by frequency in film and TV dialogue, close to conversation; one plain text file, easy to filter.
   Cons: ShareAlike (our filtered list is adapted material, so it is shared under CC BY-SA 4.0; the app's code is not
   affected); subtitles bring foreign words, names and vulgar forms, so a filter is needed; the repo's LICENSE file
   says MIT while its README says CC BY-SA 4.0 for content, so we follow the stricter one (both checked 2026-11-20:
   "MIT License for code. CC-by-sa-4.0 for content."). The counts come from the OPUS OpenSubtitles 2018 corpus, but the
   README's link to its page (`opus.nlpl.eu/OpenSubtitles2018.php`) returns 404 today, so the corpus's own terms could
   not be read; `pl.LICENSE.txt` therefore credits OpenSubtitles (opensubtitles.org) and OPUS as well.
2. **Leipzig Corpora Collection** (downloadable corpora under CC BY, per the Wiktionary overview). Pros: no
   ShareAlike. Cons: news, web and Wikipedia text (written, third person); the words come inside a corpus archive, so
   the build is heavier; the terms page sits behind a bot check and could not be read for this ADR, so its exact
   license version must be confirmed first.
3. **No list, only his own words.** Pros: no license, nothing to ship. Cons: no help for weeks; useless in the trial.

(NKJP-based lists are lemmas or non-commercial, Kelly is NC, and SJP.pl lists have no frequencies; not considered
further.)

## Decision
Option 1 (accepted by the author, 2026-11-20). The top 20,000 forms after the filter of spec 016 (R2), committed as `src/web/public/words/pl.txt`
with `pl.LICENSE.txt` (source, author, changes, CC BY-SA 4.0), named in "O aplikacji" (About), fetched from our
origin only when prediction is on, cached by a lazy service worker group. Measured on 2026-11-20: about 175 KB, about
77 KB gzipped (10,000 forms: 83 KB / 37 KB; 50,000: 458 KB / 206 KB).

## Consequences
- Easier: useful guesses from the first day, offline, with no new runtime dependency.
- Harder: the attribution must stay with the file and in the app; a later change of source means a new build and a
  check of its license.
- To do: the build script and the exclusion list (spec 016, T1); README credits.

## Revisit when
The trial shows the guesses miss his words, a CC BY or public-domain list of spoken Polish forms appears, or the
author wants no ShareAlike data in the repository.

## Learning resources
- FrequencyWords https://github.com/hermitdave/FrequencyWords
- CC BY-SA 4.0 deed https://creativecommons.org/licenses/by-sa/4.0/ and legal code https://creativecommons.org/licenses/by-sa/4.0/legalcode.en
- Wiktionary, Polish frequency lists https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Polish
- Angular service worker configuration https://angular.dev/ecosystem/service-workers/config
