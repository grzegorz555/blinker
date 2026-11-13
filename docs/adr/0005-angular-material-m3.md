---
type: Decision
title: "ADR-0005: Angular Material (Material 3) as the UI library instead of spartan-ng"
description: Proposed after polish round 1 of spec 004; the mock-ups move to Material Design 3, so stage 2 would build the screens with Angular Material, keeping our tokens, icons and security rules.
tags: [adr, ui, design, accessibility]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-12
---

# ADR-0005: Angular Material (Material 3) as the UI library instead of spartan-ng

- Status: Accepted (by the author, 2026-11-13)
- Date: 2026-11-12

## Context

The plan named spartan-ng (the Angular port of shadcn/ui) as the UI library, and spec 004 T3 built the mock-ups in
that style. In polish round 1 the author rejected the look and the layout: things stacked one under another without
order, black and white, no clear split of responsibilities. They asked for ready-made layouts and pointed to a
Material 3 component kit for Angular. The mock-ups now follow
[Material Design 3](https://m3.material.io) (color roles, canonical layouts, navigation bar and rail). Building
stage 2 on a library that implements another design system would mean restyling every component.

## Decision criteria

1. Accessibility of the components (WCAG 2.2 AA, keyboard, screen readers): the person relies on the app to talk.
2. Fit with the chosen visual language and layouts (M3), so the mock-ups carry over with little change.
3. Compatibility with our rules: zoneless Angular, a strict CSP with Trusted Types, no third-party fonts, no
   `innerHTML` or `bypassSecurityTrust*` (`docs/conventions/security.md`).
4. Maintenance: an official, long-lived library that follows Angular releases.
5. Cost: free and open source.

## Considered options

1. **Angular Material (M3) + the CDK.** The Angular team's own library: M3 theming with
   [system tokens as CSS variables](https://material.angular.dev/guide/theming), components with documented
   accessibility, and the [CDK](https://material.angular.dev/cdk/categories) (a11y, overlay, layout). MIT. Trade-offs: its
   defaults load Roboto and the Material Symbols font, and `mat-icon` with registered SVGs goes through the sanitizer
   bypass. We would use the system font stack and our own inline SVG icons instead. It is less flexible to restyle
   than headless components, and the theme is built with Sass.
2. **spartan-ng (shadcn/ui style), as planned.** Headless "brain" primitives with copy-in "helm" styles on
   Tailwind, so restyling to M3 is possible. Trade-offs: we would rebuild M3 components by hand (navigation bar and
   rail, tonal buttons, cards), the result follows no design spec, and the project is younger, with a smaller team.
3. **No library: our own components on the CDK and Tailwind.** Full control, but the most work, and every
   accessibility pattern would be ours to build and test.

## Decision

**Accepted by the author on 2026-11-13: Angular Material for everything it provides, the rest custom.**

- **Angular Material + the CDK** for the components it has: buttons, form fields, selects, radio groups, slide
  toggles (the switches), sliders, dialogs, menus, snack bars, lists, and the CDK a11y helpers (focus, live
  announcer).
- **Custom components on our tokens and Tailwind**, following the spec 004 mock-ups, where Angular Material has no
  component: the M3 **navigation bar** and **navigation rail**, the **letter board**, and the Liczenie (Counting)
  supporting-pane layout.
- Our design tokens (`tokens.css`) map onto the M3 system tokens, so the mock-up colors carry over; the mock-ups
  are the visual reference, not code to copy.

Why not option 3 alone: the author prefers tested, maintained components where they exist; the mock-ups are not
built on Angular Material, so the screens are written as Angular components either way.

## Consequences

- Stage 2 adds `@angular/material` and `@angular/cdk`; spartan-ng, its MCP server (`.mcp.json`) and the mentions in
  `CLAUDE.md`, `docs/conventions/frontend.md`, `accessibility.md` and `ai-workflow.md` are removed or replaced.
- The M3 theme is generated from our tokens; the typography uses the system font stack; icons stay inline SVG
  (no Material Symbols font, no `MatIconRegistry` with the sanitizer bypass).
- Must be checked in stage 2 before relying on it, with a spike and the existing e2e CSP guard: zoneless change
  detection, Trusted Types under our CSP, overlays (menus, dialogs) without inline styles that the CSP blocks.
- Tailwind stays for layout utilities; component styles come from Angular Material.

## Revisit when

- The stage 2 spike shows a CSP, Trusted Types or zoneless problem we can't solve without weakening the rules.
- The author decides on a different visual direction after the polish rounds.

## Learning resources

- Material Design 3: https://m3.material.io · canonical layouts:
  https://m3.material.io/foundations/layout/canonical-layouts/overview
- Angular Material theming (M3): https://material.angular.dev/guide/theming
- Angular CDK: https://material.angular.dev/cdk/categories
- spartan-ng: https://www.spartan.ng
- Angular security (sanitization, Trusted Types): https://angular.dev/best-practices/security
