---
type: Convention
title: Frontend conventions (Angular 22)
description: Angular, Tailwind, Transloco and mobile-first rules for src/web; adapted from WordWise.
tags: [convention, frontend, angular]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-10
---

Source: the Angular Style Guide (https://angular.dev/style-guide) and the best practices from the Angular CLI MCP server.

# Angular
- Standalone components, signals (`signal`, `computed`, `input()`, `output()`), zoneless change detection, and the `@if/@for/@switch` control flow.
- `inject()` instead of constructor injection. Keep state in signals.
- File names: `name.ts`, `name.html`, `name.css` (only if needed), `name.spec.ts`.
- Folders:
  - `core/`: singletons (vision, signals, input, scanning, boards, speech, i18n);
  - `features/<feature>/`: pages;
  - `shared/`: presentational components (for example the confirmation dialog).
- **Domain logic is plain TypeScript** (state machines, the signal detector, the board validator) with no Angular imports. A thin Angular service wraps it. This keeps the logic fast to unit-test and reusable in a Web Worker.
- Heavy work (MediaPipe inference) runs in a **Web Worker** so the UI thread stays responsive (https://angular.dev/ecosystem/web-workers).

# Angular Material (ADR-0005)
- Use Angular Material for the components it has (buttons with `matButton="filled|tonal|outlined"`, form fields,
  selects, radio groups, slide toggles, dialogs); the M3 theme in `src/material.scss` maps the system tokens to
  `tokens.css`, so never set colors on a Material component directly.
- Our own components where Material has none (navigation bar and rail, the board, the Liczenie (Counting) layout),
  styled with the tokens in a component CSS file; Tailwind utilities for page layout.
- No icon font and no `MatIconRegistry`: icons are inline SVG with `aria-hidden="true"` next to a visible label.
- A destructive action goes through `ConfirmService` (`shared/confirm-dialog`): "Anuluj" (Cancel) first.
- A success is confirmed with `ToastService.show(key, params, action?)` (`shared/toast`, an M3 snack bar, spec 018),
  never with a bare `MatSnackBar`: our service owns the timing, the placement and the single announcement. Deleting
  one item offers `{ label: 'toast.undo', run }`, where `run` puts back exactly what was deleted. No toasts in
  Liczenie (Counting) or for a switch.

# i18n (Transloco)
- No hardcoded UI strings. Keys follow `feature.element` (for example `communicate.scanningColumns`), and every key is added to both `public/i18n/en.json` and `public/i18n/pl.json`.
- The default language comes from the browser, with `pl` as the fallback. The language switch shows each language's own name (English, Polski).
- **Board content is not translated.** It comes from the board file and has its own `locale`, which is applied as `lang` on the board container.

# Styling (Tailwind CSS v4)
- Utility classes in templates. Design tokens live only in `src/styles/tokens.css` (OKLCH, light and dark).
- Never build class names dynamically (`'bg-' + color`); map state to full class names instead.
- State styling: ARIA or `data-*` attribute variants first (`aria-selected:`, `data-active:`), then `[class.x]`, with one class per binding.

# Mobile first
- Base styles target a phone; `sm:`, `md:` and `lg:` only extend the layout. Check the views at 360, 390, 768 and 1280 px, in **both portrait and landscape**: a phone on a stand is often in landscape.
- Use `min-h-dvh` and `env(safe-area-inset-*)`. Keep the screen awake while communicating (Screen Wake Lock API: https://developer.mozilla.org/docs/Web/API/Screen_Wake_Lock_API).
- Caregiver actions sit within thumb reach. Gestures are never the only way to do something.
