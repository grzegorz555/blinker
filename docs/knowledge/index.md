# Knowledge (learnings)

Learnings captured by the `/compound` step, one concept per file (`type: Learning`).
Read the ones relevant to your task before starting. A learning without `verified` is not yet approved by the author.

File frontmatter:
```yaml
---
type: Learning
title: <one-line lesson>
description: <when it applies>
tags: [<area>]
status: draft | stable | deprecated
generated: { by: agent:<model>, at: YYYY-MM-DD }
verified: [{ by: human:Grzegorz Roczniak, at: YYYY-MM-DD }]   # added only after the author approves
stale_after: YYYY-MM-DD                                 # for facts that age (devices, versions)
---
```
Body: **Context** (what happened), **Lesson** (the rule), **How to apply** (where it changes our work).

# Learnings

## Testing
* [Use expect.poll, not waitForFunction, for async checks](playwright-async-predicates.md) - An async predicate in waitForFunction always passes.
* [An active Angular service worker is not yet a cached app](angular-sw-ready-is-not-cached.md) - Wait for every file of the app group (from ngsw.json) before going offline.
* [Page.getInstallabilityErrors is always empty; use Page.getAppManifest](cdp-installability-errors-always-empty.md) - Every automated check needs a negative test that proves it can fail.
* [Check the Lighthouse report language by the page text](lighthouse-language-by-text.md) - One marker element breaks when the layout changes; match node labels against the translations.
* [A layout that fits to the pixel breaks on another system font](layout-fits-with-a-wider-font.md) - The CI font (DejaVu Sans) is wider; repeat fit checks with a wider font.

## Interaction
* ["No" means a different thing in every state](no-depends-on-context.md) - Map every state and signal explicitly; a second "no" must not delete.

## Security
* [Ajv compiles schemas with new Function, which our CSP blocks](ajv-needs-unsafe-eval.md) - Check a dependency for run-time code generation before adding it.

## Accessibility
* [A visible skip link must not overlap other targets](skip-link-must-not-overlap.md) - SC 2.5.8; never cover another control; scan focused states with axe.
* [Content under a sticky bar counts as covered](sticky-bar-covers-controls.md) - Keep the shell the viewport high and let only main scroll.

## Tooling
* [Start Claude Code in the repo root](claude-session-start-directory.md) - Otherwise project agents (code-reviewer) are not loaded.
* [`node -e` template strings eat backslashes](node-e-template-eats-backslashes.md) - Use Write/Edit or String.raw for regexes and paths.
* [After a rebase merge, git branch -d says the branch is not merged](rebased-branch-is-not-merged-for-git.md) - Compare the trees with git diff before deleting.
