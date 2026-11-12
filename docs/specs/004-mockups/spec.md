---
type: Spec
title: "004: Clickable mock-ups and the visual direction"
description: Static HTML/Tailwind mock-ups of the communicate (counting), calibrate, boards and settings screens, viewed on a computer and on a real phone over the home Wi-Fi; three visual directions, one chosen, final tokens and icon.
tags: [stage-1.5, design, accessibility, mockups]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-12
---

# Goal
Before stage 2 builds the real screens, the author (and, if possible, the friend) sees and clicks through how Blinker
will look and behave, on the devices it will really run on. We pick one visual direction out of three and turn it
into the final design tokens, `theme-color` and the app icon. Changing a mock-up is cheap; changing Angular
components later is not.

# Decisions (author, 2026-11-12)
- **The mock-ups live in the project** (`src/web/design/`). The author opens them on the computer (browser, DevTools
  device mode) and **on the phone over the home Wi-Fi** with `npm run design:serve`. No hosting is needed, so this
  spec does not depend on spec 003 (Azure).
- **Setups:** all of them are considered. The target is **a caregiver holding the phone in front of him**, and at home
  **a stationary device** (phone on a stand or a laptop). The rear-camera case (he doesn't see the screen) gets a
  simplified, audio-first variant.
- **Three visual directions first**, shown on the communicate screen only. The author picks one; the other screens
  are drawn only in the chosen direction.
- **Screens:** communicate (counting), calibrate, boards, settings.
- **Counting** follows [the interaction model](../../interaction-model.md): he gives a number by blinking (+1) and
  looking at his hand (+5); Blinker asks "Kolumna 4?" and he confirms with a nod or rejects with a head shake.

# Scope
- **`src/web/design/`**: plain HTML pages, one CSS entry and one small script file:
  - `index.html`: a catalog with links to every mock-up and every state;
  - `directions.html?direction=a|b|c&scheme=auto|light|dark`: the communicate screen in three directions (T2); one
    page, so the markup can't drift between them, and a switcher below the screen;
  - `communicate.html`, `calibrate.html`, `boards.html`, `settings.html` in the chosen direction (T3, T4);
  - `design.css`: Tailwind + `../src/styles/tokens.css` + per-direction token overrides;
  - `design.js`: switches between states and runs a keyboard simulator of the signals (see R7).
- **`npm run design:build`**: compiles `design.css` with the PostCSS + `@tailwindcss/postcss` already installed, and
  copies the pages to `dist/design/`. No new dependency.
- **`npm run design:serve`**: a static server for `dist/design/` on the local network (port 4310), started **only by
  the author**. It prints the address to open on the phone (`http://192.168.x.x:4310/`).
- **Final tokens** in `src/styles/tokens.css`, `theme-color`, and a real app icon with separate `any` and `maskable`
  variants (debt from spec 001).
- **`docs/design/index.md`** (`type: Design`): the chosen direction and why, the token table with contrast ratios,
  the screen and state inventory, and what we learned from the phone test.

# Rules
- **R1. Mock-ups never ship in the app.** They are not in `public/` and not in the Angular build; `dist/blinker-web/`
  is unchanged. `check-dist` already rejects `.md`; it is extended to fail if a `design/` folder appears in the app
  build.
- **R2. Same security as the app.** `design:serve` sends the same headers as production (it reads `globalHeaders`
  from `public/staticwebapp.config.json` through `scripts/static-config.mjs`). Pages have no inline `<script>`, no
  inline event handlers, no `innerHTML` and nothing from third-party origins; the `check-dist` inline-script rule runs
  on `dist/design/` too.
- **R3. Tokens are the only source of colors.** Mock-ups use token classes (`bg-bg`, `text-fg`, …). A direction
  overrides **token values only**, scoped by `data-direction="a|b|c"` on `<html>`; markup never contains a raw color.
  The chosen values move into `tokens.css` unchanged (T5).
- **R4. AAC rules for what he looks at** (board, counter, question, sentence): cell text at least 32 px, contrast at
  least **7:1** (SC 1.4.6) in light and dark; the active column/row is marked by a **4 px outline plus weight or size**,
  never by color alone (SC 1.4.1); the current state is always written out in text ("Podaj kolumnę", "Kolumna 4?");
  nothing flashes (SC 2.3.1) and transitions respect `prefers-reduced-motion`.
- **R5. WCAG 2.2 AA for the caregiver parts:** text 4.5:1, non-text 3:1 (SC 1.4.3, 1.4.11), targets at least 24 px
  and main actions 44 px (SC 2.5.8), visible focus, keyboard-only use, reflow at 320 px (SC 1.4.10), both
  orientations (SC 1.3.4). **axe reports zero violations** on every page and every state.
- **R6. The communicate screen fits without scrolling** in every target viewport: phone portrait 360×740 and
  390×844, phone landscape 740×360, tablet 768×1024, laptop 1280×800. The board, the counter or question and the
  sentence are visible at once.
- **R7. Clickable states and a signal simulator.** Every state from the interaction model can be reached from the
  catalog by a link (`communicate.html#asking-column`), and the page can be driven from the keyboard: **Space** =
  `LONG_BLINK` (+1), **H** = `LOOK_AT_HAND` (+5), **N** = `HEAD_NOD`, **S** = `HEAD_SHAKE`, **P** = pause. The
  simulator is a few lines of plain DOM code (`textContent`, attributes, `hidden`), not the real state machine,
  which stage 2 builds and tests properly. On-screen buttons do the same, so a phone without a keyboard works too.
- **R8. Communicate states covered:** waiting for a column; counting (with the running number and how it was built,
  e.g. hand + 2 blinks = 7); asking "Kolumna 7?"; rejected (head shake, give it again); waiting for a row in column 7;
  asking "Wiersz 3?"; letter added ("W") and spoken; the sentence with undo; "Przeczytać na głos?"; paused; face not
  visible. Plus the **caregiver-held** layout (screen faces the caregiver, rear camera, large question for the
  caregiver, audio state shown).
- **R9. Fake data only.** The board is the letter layout of [the friend's board](../../boards/friend-board.md)
  (letters only); sentences are invented. No names, no photo of the paper board, nothing about his health.
- **R10. The local server is safe enough for a home network.** It serves only `dist/design/`, read-only, with a
  path-traversal guard and no directory listing; it starts only on the author's command (never in CI, never by the
  agent); it prints a warning to allow it on **private networks only** when the Windows firewall asks.
- **R11. Polish text.** The mock-ups are in Polish (`lang="pl"`), the language he and the caregivers use. They are
  throwaway, so they don't go through Transloco; stage 2 adds the real keys in `en.json` and `pl.json`.

# UI and accessibility notes
- **Three directions (T2), the same content and layout options, different character:**
  - **A, calm light:** light background, dark text, one strong accent for the active column; good in daylight.
  - **B, dark high-contrast:** near-black background, near-white text, a yellow active outline; less glare at
    night and from a distance.
  - **C, warm and soft:** off-white with warm accents, rounded large cells; friendlier, still at least 7:1.

  Each is shown in portrait and landscape and in the system's light and dark mode.
- **Layouts:**
  - Portrait (phone held in front of him): question and counter on top, board in the middle, sentence at the bottom.
  - Landscape (stand, laptop): board on the left, question, counter and sentence on the right.
  - Caregiver-held (rear camera): no board in focus; a huge question and counter for the caregiver and a "Mówię na
    głos" indicator.
- The counter shows how the number was built (✋ = 5, • = 1) as text plus symbols, so it is readable without color.
- Live regions: the question and an added letter are announced with `aria-live="polite"` (SC 4.1.3).
- Settings use native controls: radio groups and checkboxes, or `role="switch"` where on/off reads better
  ([APG radio](https://www.w3.org/WAI/ARIA/apg/patterns/radio/), [APG switch](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)).
  Timing settings (the pause before the question, the blink length) are shown, because SC 2.2.1 requires them to be
  adjustable.

# Security and privacy notes
- `design:serve` binds to all interfaces so the phone can reach it. Anyone on the same Wi-Fi can open the mock-ups
  while it runs. They hold no personal data (R9), so this is acceptable on a home network. Don't run it on public
  Wi-Fi; stop it with Ctrl+C.
- The production CSP and Trusted Types apply to the mock-ups (R2), and the e2e CSP guard from spec 003 runs on them.
  Anything that would break the CSP in the app shows up already in a mock-up.

# Acceptance criteria
- [ ] `npm run design:build` produces `dist/design/` with the catalog, three directions, then four screens; the app
      build has no `design/` folder (R1).
- [ ] `npm run design:serve` prints a LAN URL; the author opens the mock-ups on a phone in portrait and landscape.
- [ ] Every page and every state passes axe with zero violations and raises no CSP or Trusted Types violation (R2, R5).
- [ ] The token contrast test passes: AAC pairs at least 7:1, other text 4.5:1, non-text 3:1, for every direction in
      light and dark (R3, R4).
- [ ] The communicate screen fits without scrolling in all five viewports (R6).
- [ ] Every state in R8 is reachable by a link and by the simulator keys and buttons (R7).
- [ ] The author has picked a direction (recorded in `docs/design/index.md` with the reason).
- [ ] The final tokens are in `tokens.css`, `theme-color` matches them, and the icon has separate `any` and `maskable`
      files; the existing manifest and installability tests pass; Lighthouse accessibility stays 100.

# Test plan
- **Unit (`node --test`, `scripts/*.test.mjs`):**
  - `contrast.mjs`: OKLCH → sRGB → relative luminance → ratio, checked against known pairs (white/black 21:1, a
    WCAG example); then every token pair of every direction and of `tokens.css` against its threshold (R3, R4), with a
    negative case that fails;
  - `design-build`: pages copied, CSS compiled, no raw color in markup (R3), no inline script or handler (R2);
  - `design-serve`: path traversal returns 404, no directory listing, headers equal `globalHeaders`, the LAN address
    list ignores internal and IPv6 link-local addresses (R2, R10);
  - `check-dist`: fails when the app build contains `design/` (R1).
- **e2e (Playwright, new `design` project on Chromium, served from `dist/design/`):**
  - every catalog link opens and passes axe; the CSP guard fixture is active (R2, R5);
  - the five viewports: the communicate region has no vertical overflow (R6);
  - the simulator path: Space ×2 + H → "7"; S → rejected, the counter clears; again, N → rows; Space ×3, N → "W"
    appears in the sentence and is announced; undo removes it (R7, R8);
  - the same path with the on-screen buttons (touch, Pixel 7 viewport);
  - `prefers-reduced-motion: reduce` and dark mode: axe passes.
- **Manual (the author):** the phone over Wi-Fi in both orientations, at arm's length and from about 1 m, in daylight and
  in the evening; if possible, shown to the friend. Findings go into `docs/design/index.md`.

# Out of scope
- Real camera, face tracking, speech and the real counting state machine (stages 2–4).
- Scanning mode (after the PoC) and shortcuts for frequent words (backlog idea, after the PoC).
- Serving the mock-ups from Azure previews. Possible later by adding `dist/design/` to the preview upload, if the author
  wants to share a link.
- English mock-ups.

# References
- WCAG 2.2 Understanding: [1.4.6 Contrast (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html),
  [1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
  [1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html),
  [1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html),
  [1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html),
  [1.3.4 Orientation](https://www.w3.org/WAI/WCAG22/Understanding/orientation.html),
  [2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
  [2.3.1 Three Flashes](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html),
  [2.2.1 Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html),
  [4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
- Relative luminance and contrast ratio: https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
- WAI-ARIA APG: [radio group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/), [switch](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)
- Tailwind CSS v4 with PostCSS: https://tailwindcss.com/docs/installation/using-postcss ·
  source detection (`@source`): https://tailwindcss.com/docs/detecting-classes-in-source-files
- MDN: [`oklch()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch),
  [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion),
  [`prefers-color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme),
  [`theme-color`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/theme-color)
- Web App Manifest, icon `purpose`: https://www.w3.org/TR/appmanifest/#purpose-member · maskable icons:
  https://web.dev/articles/maskable-icon
- OWASP CSP Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- Node.js `net` (`server.listen` host): https://nodejs.org/api/net.html
- Playwright: [accessibility testing](https://playwright.dev/docs/accessibility-testing),
  [emulation and viewports](https://playwright.dev/docs/emulation)
- Chrome DevTools device mode: https://developer.chrome.com/docs/devtools/device-mode
