---
type: Spec
title: "004: Clickable mock-ups and the visual direction"
description: Static HTML/Tailwind mock-ups viewed on a computer and on a real phone over the home Wi-Fi; Material 3 style; Liczenie (the board) is the main screen in the M3 supporting-pane layout, with a navigation bar on phones and a navigation rail from 600 px; final tokens and icon after visual polish.
tags: [stage-1.5, design, accessibility, mockups]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-12
---

# Goal

Before stage 2 builds the real screens, the author (and, if possible, the friend) sees and clicks through how Blinker
will look and behave, on the devices it will really run on: the whole app, not only the board. The result is a
visual language, the app structure (navigation on phones and large screens), and then the final design tokens,
`theme-color` and the app icon. Changing a mock-up is cheap; changing Angular components later is not.

# Decisions (author, 2026-11-12)

- **The mock-ups live in the project** (`src/web/design/`). The author opens them on the computer (browser, DevTools
  device mode) and **on the phone over the home Wi-Fi** with `npm run design:serve`. No hosting is needed, so this
  spec does not depend on spec 003 (Azure).
- **Setups:** all of them are considered. The target is **a caregiver holding the phone in front of him**, and at home
  **a stationary device** (phone on a stand or a laptop). The rear-camera case (he doesn't see the screen) gets a
  simplified, audio-first variant.
- **Screens:** Liczenie (counting, the main screen), Zdania (sentences), boards, calibrate, settings. Until polish
  round 1 there was also a start dashboard.
- **Counting** follows [the interaction model](../../interaction-model.md): he gives a number by blinking (+1) and
  looking at his hand (+5); Blinker asks "Kolumna 4?" and he confirms with a nod or rejects with a head shake.
- **Revised after T2:** three bespoke directions (T2) did not convince the author. Instead:
  - **One visual language in the style of [shadcn/ui](https://ui.shadcn.com/docs/theming)**, the style that
    [spartan-ng](https://www.spartan.ng) (MIT, our UI library from ADR-0001) ports to Angular: neutral colors, cards
    with subtle borders, clear type, one accent. Stage 2 then swaps the mock-up markup for spartan components with
    little visual change.
  - **A caregiver dashboard** like the admin templates the author pointed to
    ([TailAdmin](https://github.com/TailAdmin/free-angular-tailwind-dashboard),
    [Square UI](https://github.com/zerostaticthemes/square-ui)): a sidebar on large screens, a top bar, cards.
    **Patterns only, no code:** TailAdmin loads a Google font, injects icons with `innerHTML` and
    `bypassSecurityTrustHtml`, hardcodes palette colors and runs on zone.js. All of that breaks our rules.
    Square UI is React and its license forbids publishing its templates in a repository.
  - **Phones get a bottom navigation bar**, within thumb reach; the communicate mode is full screen.
  - **Visual polish comes later**, in rounds with the author, before the final tokens (T6).
- **Revised in polish round 1 (author, 2026-11-12).** The shadcn look and the dashboard felt random: one thing under
  another, black and white, no clear split of responsibilities, an odd menu, and an unclear sentence and undo area.
  Instead:
  - **Material Design 3** ([M3](https://m3.material.io)), the system [Angular Material](https://material.angular.dev)
    implements. [ADR-0005](../../adr/0005-angular-material-m3.md) proposes Angular Material as the UI library
    instead of spartan-ng. The community Figma kit the author pointed to is a reference for the feel only: despite
    its name it is Material 2 (indigo app bar, uppercase buttons, shadows, an icon web font).
  - **Ready-made layouts, not ad hoc stacks:** the M3
    [canonical layouts](https://m3.material.io/foundations/layout/canonical-layouts/overview) and
    [window size classes](https://m3.material.io/foundations/layout/applying-layout/window-size-classes).
  - **Color with restraint:** near-neutral surfaces and one indigo hue in tonal roles. Color marks what is active or
    important, not decoration.
  - **Liczenie is the main screen**; there is no start dashboard. It runs by itself on his signals, and every letter
    and action can also be tapped (by the caregiver, or by him if he can).
  - **One job per destination:** Liczenie (talk), Zdania (what he said, repeat aloud), Tablice (boards), Kalibracja
    (readiness and his signals), Ustawienia (timings, voice, theme).

# Scope

- **`src/web/design/`**: plain HTML pages, one CSS entry and one small script file:
  - `index.html`: a catalog with links to every mock-up and every state;
  - `directions.html`: the three T2 directions, kept for reference until T3 replaces them, then removed;
  - `communicate.html` (Liczenie, the main screen), `sentences.html` (Zdania), `boards.html`, `calibrate.html`,
    `settings.html`; `start.html` (the T3 dashboard) was removed in polish round 1;
  - `design.css`: Tailwind + `../src/styles/tokens.css` + the mock-up style's token values + layout components;
  - `design.js`: the scheme switch, the communicate states and a keyboard simulator of the signals (see R7).
- **`npm run design:build`**: compiles `design.css` with the PostCSS + `@tailwindcss/postcss` already installed, and
  copies the pages to `dist/design/`. No new dependency.
- **`npm run design:serve`**: a static server for `dist/design/` on the local network (port 4310), started **only by
  the author**. It prints the address to open on the phone (`http://192.168.x.x:4310/`).
- **Final tokens** in `src/styles/tokens.css`, `theme-color`, and a real app icon with separate `any` and `maskable`
  variants (debt from spec 001), after the visual polish rounds.
- **`docs/design/index.md`** (`type: Design`): the visual language and why, the token table with contrast ratios,
  the app structure, the screen and state inventory, and what we learned from the phone test.

# Rules

- **R1. Mock-ups never ship in the app.** They are not in `public/` and not in the Angular build; `dist/blinker-web/`
  is unchanged. `check-dist` already rejects `.md`; it is extended to fail if a `design/` folder appears in the app
  build.
- **R2. Same security as the app.** `design:serve` sends the same headers as production (it reads `globalHeaders`
  from `public/staticwebapp.config.json` through `scripts/static-config.mjs`). Pages have no inline `<script>`, no
  inline event handlers, no `innerHTML` and nothing from third-party origins (no web fonts from a CDN: the system font
  stack); the `check-dist` inline-script rule runs on `dist/design/` too. Icons are inline SVG drawn for Blinker,
  `aria-hidden="true"` next to a visible text label.
- **R3. Tokens are the only source of colors.** Mock-ups use token classes (`bg-bg`, `text-fg`, …); markup never
  contains a raw color. A style overrides **token values only**, scoped by an attribute on `<html>`
  (`data-direction="a|b|c"` in T2, `data-style="base"` in T3, `data-style="m3"` from polish round 1), as
  `light-dark(light, dark)` pairs. Token names map to M3 color roles (see `design.css`). The chosen values move into
  `tokens.css` unchanged (T6).
- **R4. AAC rules for what he looks at** (board, counter, question, sentence): cell text at least 32 px, contrast at
  least **7:1** (SC 1.4.6) in light and dark; the **pointer** (polish round 1: the number of the column or row being
  counted and the one cell the count has got to, not the whole column) is marked by a **4 px outline plus weight or
  size**, never by color alone (SC 1.4.1); board cells are squares; empty cells show nothing; the current state is always written out in text ("Podaj kolumnę", "Kolumna 4?");
  nothing flashes (SC 2.3.1) and transitions respect `prefers-reduced-motion`.
- **R5. WCAG 2.2 AA for the caregiver parts:** text 4.5:1, non-text 3:1 (SC 1.4.3, 1.4.11), targets at least 24 px
  and main actions 44 px (SC 2.5.8), visible focus, keyboard-only use, reflow at 320 px (SC 1.4.10), both
  orientations (SC 1.3.4). **axe reports zero violations** on every page and every state. Decorative lines (card
  borders, dividers) may be subtle; borders that identify a control (inputs, toggles) need 3:1.
- **R6. The communicate screen fits without scrolling** in every target viewport: phone portrait 360×740 and
  390×844, phone landscape 740×360, tablet 768×1024, laptop 1280×800. The board, the counter or question and the
  sentence are visible at once. **The board never scrolls and is never covered** by navigation or panels, and no two
  parts overlap. Board cells stay close to square (at most 1.4 times taller than wide), never tall narrow strips.
- **R7. Clickable states and a signal simulator.** Every state from the interaction model can be reached from the
  catalog by a link (`communicate.html#asking-column`), and the page can be driven from the keyboard: **Space** =
  `LONG_BLINK` (+1), **H** = `LOOK_AT_HAND` (+5), **N** = `HEAD_NOD`, **S** = `HEAD_SHAKE`, **P** = pause. The
  simulator is a few lines of plain DOM code (`textContent`, attributes, `hidden`), not the real state machine,
  which stage 2 builds and tests properly. On-screen buttons do the same, so a phone without a keyboard works too.
  **Known exception (review of T4):** the single-key shortcuts can't be turned off, which SC 2.1.4 would require.
  They exist only in the mock-up simulator, as a stand-in for his face signals; he controls Blinker with his head, and
  the keyboard is not a way he uses it. The real app gets no single-key shortcuts unless they can be turned off.
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
- **R12. App structure (revised in polish round 1): one shell, Liczenie first.**
  - **Destinations**, in this order, with one job each: **Liczenie** (the main screen), **Zdania**, **Tablice**,
    **Kalibracja**, **Ustawienia**. The same navigation on every page, in the same order (SC 3.2.3); the current page
    has `aria-current="page"`. Landmarks: `header`, `nav` with a name, `main`.
  - **Navigation by M3 window size class:** below 600 px, a
    [navigation bar](https://m3.material.io/components/navigation-bar/specs) at the bottom (icons with visible labels,
    an active indicator, targets at least 44×44 px, safe-area padding); from 600 px, a
    [navigation rail](https://m3.material.io/components/navigation-rail/specs) on the left (at most 96 px wide), so the
    board keeps the width.
  - **Liczenie** uses the M3 [supporting-pane layout](https://m3.material.io/foundations/layout/canonical-layouts/supporting-pane):
    the board is the main pane; the question (with the counter) and the sentence are the supporting pane. Portrait:
    question, board, sentence from top to bottom. Landscape: the board on the left, the pane on the right.
  - **Automatic, but tappable:** it runs on his signals; every letter is a button that adds it to the sentence. The
    sentence card always shows its actions with labels: **Cofnij literę** (tonal), **Wyczyść** (outlined) and
    **Przeczytaj** (filled, the main action). **Pauza** is a toggle in the top bar next to a status in words
    ("Automat: widzę twarz"). There is no hidden menu.
- **R13. Kalibracja holds readiness and his signals** (the content of the removed start dashboard): calibration,
  camera and voice status, with "Kalibruj ponownie"; and a legend of his signals for new caregivers. One column on a
  phone, two from 840 px (M3 expanded). Recent sentences live in **Zdania**, grouped by day, each with a repeat
  button.

# UI and accessibility notes

- **Visual language (from polish round 1):** Material Design 3. Tonal "filled" cards without borders or shadows,
  pill-shaped buttons with sentence-case labels (filled, tonal, outlined), the M3 type scale, near-neutral surfaces
  and one indigo hue: primary-container for the question and the active column, secondary-container for tonal
  buttons and the navigation indicator. System font stack (Roboto on Android, San Francisco on iOS, Segoe UI on
  Windows); icons are our own inline SVG, not the Material Symbols web font (R2).
- **T3, for the record:** a shadcn/ui style (white cards, thin borders, a near-black primary) with a start
  dashboard; it read as black and white and the layout as random.
- **T2, for the record:** three directions (calm light, high contrast, warm) on the communicate screen; they showed
  the layout works in both orientations but not a convincing look.
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
- Templates are a source of patterns, never of code (decision above): copying them would bring in third-party fonts,
  sanitizer bypasses or license terms we can't meet.

# Acceptance criteria

- [x] `npm run design:build` produces `dist/design/` with the catalog and every screen; the app build has no
      `design/` folder (R1).
- [x] `npm run design:serve` prints a LAN URL; the author opens the mock-ups on a phone in portrait and landscape.
- [x] Every page and every state passes axe with zero violations and raises no CSP or Trusted Types violation (R2, R5).
- [x] The token contrast test passes: AAC pairs at least 7:1, other text 4.5:1, non-text 3:1, for every style in
      light and dark (R3, R4).
- [x] Liczenie fits without scrolling in all five viewports, no part overlaps another, and the cells stay near-square (R6).
- [x] The shell shows a navigation bar below 600 px and a navigation rail from 600 px, with the current page marked;
      no horizontal scroll at 320 px (R12).
- [x] A tap on a letter adds it and "Cofnij literę" removes it, both announced; the sentence actions are labelled and
      at least 44 px (R12).
- [x] Kalibracja and Zdania have the content from R13.
- [x] Every state in R8 is reachable by a link and by the simulator keys and buttons (R7).
- [x] The author has approved the look after the polish rounds (recorded in `docs/design/index.md`).
- [x] The final tokens are in `tokens.css`, `theme-color` matches them, and the icon has separate `any` and `maskable`
      files; the existing manifest and installability tests pass; Lighthouse accessibility stays 100.

# Test plan

- **Unit (`node --test`, `scripts/*.test.mjs`):**
  - `contrast.mjs`: OKLCH → sRGB → relative luminance → ratio, checked against known pairs (white/black 21:1, a
    WCAG example); then every token pair of every style and of `tokens.css` against its threshold (R3, R4), with a
    negative case that fails;
  - `design-build`: pages copied, CSS compiled, no raw color in markup (R3), no inline script or handler (R2);
  - `design-serve`: path traversal returns 404, no directory listing, headers equal `globalHeaders`, the LAN address
    list ignores internal and IPv6 link-local addresses (R2, R10);
  - `check-dist`: fails when the app build contains `design/` (R1).
- **e2e (Playwright, `design` project on Chromium, served from `dist/design/`):**
  - every catalog link opens and passes axe in light and dark; the CSP guard fixture is active (R2, R5);
  - the five viewports: the communicate screen has no overflow, with the caregiver menu closed and open, and the board
    is not covered (R6, R12);
  - the shell: bottom bar below 1024 px, sidebar from 1024 px, `aria-current="page"`, targets at least 44 px, no
    horizontal scroll at 320 px (R12);
  - the start page: the cards from R13, the main action first in the reading order on a phone;
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
- Using a dashboard template's code (decision above).

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
  [3.2.3 Consistent Navigation](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html),
  [4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
- Relative luminance and contrast ratio: https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
- WAI-ARIA APG: [radio group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/), [switch](https://www.w3.org/WAI/ARIA/apg/patterns/switch/),
  [disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/),
  [landmark regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
- Material Design 3: [color roles](https://m3.material.io/styles/color/roles),
  [type scale](https://m3.material.io/styles/typography/type-scale-tokens),
  [canonical layouts](https://m3.material.io/foundations/layout/canonical-layouts/overview),
  [window size classes](https://m3.material.io/foundations/layout/applying-layout/window-size-classes),
  [navigation bar](https://m3.material.io/components/navigation-bar/specs),
  [navigation rail](https://m3.material.io/components/navigation-rail/specs),
  [buttons](https://m3.material.io/components/buttons/specs), [cards](https://m3.material.io/components/cards/specs);
  Angular Material theming: https://material.angular.dev/guide/theming
- MDN: [container query units](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_size_and_style_queries),
  [cascade layers (`@layer`)](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- T3, for the record: shadcn/ui theming (token names and the neutral palette): https://ui.shadcn.com/docs/theming · sidebar pattern:
  https://ui.shadcn.com/docs/components/sidebar · spartan-ng (the Angular port, MIT): https://www.spartan.ng
- Layout references (patterns only): TailAdmin free Angular dashboard (MIT):
  https://github.com/TailAdmin/free-angular-tailwind-dashboard · Square UI (custom license, no redistribution):
  https://github.com/zerostaticthemes/square-ui
- Tailwind CSS v4 with PostCSS: https://tailwindcss.com/docs/installation/using-postcss ·
  source detection (`@source`): https://tailwindcss.com/docs/detecting-classes-in-source-files
- MDN: [`oklch()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch),
  [`light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark),
  [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion),
  [`prefers-color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme),
  [`theme-color`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/theme-color),
  [`<details>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details),
  [`aria-current`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-current)
- Web App Manifest, icon `purpose`: https://www.w3.org/TR/appmanifest/#purpose-member · maskable icons:
  https://web.dev/articles/maskable-icon
- OWASP CSP Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
- Node.js `net` (`server.listen` host): https://nodejs.org/api/net.html
- Playwright: [accessibility testing](https://playwright.dev/docs/accessibility-testing),
  [emulation and viewports](https://playwright.dev/docs/emulation)
- Chrome DevTools device mode: https://developer.chrome.com/docs/devtools/device-mode
