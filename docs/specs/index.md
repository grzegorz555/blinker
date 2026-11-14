# Specs

One folder per feature: `NNN-slug/spec.md` (`type: Spec`) and `NNN-slug/tasks.md` (`type: Task List`), created with `/plan`.

# Specs
* [001: Application skeleton](001-app-skeleton/spec.md) - Stage 1. Angular PWA shell, i18n, a11y, Vitest, Playwright + axe. [Tasks](001-app-skeleton/tasks.md).
* [002: CI and local verification](002-ci-verify/spec.md) - Stage 1. `npm run verify`, pre-push hook, full CI, Lighthouse CI (a11y = 100), installability e2e, Dependabot for npm. [Tasks](002-ci-verify/tasks.md).
* [003: Deploy to Azure Static Web Apps](003-deploy/spec.md) - Stage 1. Headers from one config file served locally and by Azure, CSP-clean build, preview per PR with a remote header test, production on main after green gates. [Tasks](003-deploy/tasks.md).
* [004: Clickable mock-ups and the visual direction](004-mockups/spec.md) - Stage 1.5. Static HTML/Tailwind mock-ups viewed on a computer and on the phone over the home Wi-Fi; Material 3 style (ADR-0005 proposed), Liczenie (Counting) as the main screen in the M3 supporting-pane layout, a navigation bar on phones and a rail from 600 px; final M3 tokens in tokens.css, theme-color from --bg and separate any/maskable icons; outcome in [design](../design/index.md). Done. [Tasks](004-mockups/tasks.md).
* [006: Counting core](006-counting-core/spec.md) - Stage 2, part 1. Board format v1 with a validator and his board as the default, the sentence with undo, the counting state machine (every state and signal explicit, time injected), signal input with keys off by default, on-device speech; no UI (spec 007). Done. [Tasks](006-counting-core/tasks.md).
* [007: Screens](007-screens/spec.md) - Stage 2, part 2. Angular Material on our tokens (spike first), the shell with our navigation bar and rail, Liczenie (Counting) with signal buttons and touch through the machine, settings, boards with import, the sentence history, all on the device. Done. [Tasks](007-screens/tasks.md).
* [008: Liczenie (Counting) for a listener](008-listener/spec.md) - Stage 2 follow-up. He builds words by ear, not by reading: head shortcuts said aloud (a nod without a number = space, which says the word; a shake = undo, said), after reading aloud Blinker asks "Nowe zdanie?" (New sentence?), the sentence big and the prompts small. In progress. [Tasks](008-listener/tasks.md).
* [005: Model routing and a faster pre-push](005-model-routing/spec.md) - Tooling. A model per loop step plus a difficulty label per task; the pre-push hook runs only the fast gates. [Tasks](005-model-routing/tasks.md).

