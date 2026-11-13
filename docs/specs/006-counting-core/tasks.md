---
type: Task List
title: "006: Counting core tasks"
description: Six tasks, one commit each - board format and validator, sentence, the counting machine, signal input, speech, and the Angular service with docs.
tags: [stage-2, counting, state-machine]
status: draft
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-13
---

Branch: `feat/006-counting-core` (from `main`, worktree `C:/Repozytorium/Blinker/wt/006-counting-core`) · Gates:
`npm run verify -- --quick` locally, full gates in CI.

- [x] **T1 [sonnet]: Board format v1, validator and his board.** `core/boards/board.ts` (types), `validate-board.ts`
      (R1, R2, errors as `{ path, code }`), `public/boards/friend-pl.json`; `docs/board-format.md` finalized with the
      JSON Schema for people and the reason for our own validator. Tests: every invalid case of the test plan; the
      friend board equals the table in `friend-board.md`.
      _To understand:_ validating untrusted JSON, why `__proto__` is dangerous, why Ajv clashes with a strict CSP.
- [ ] **T2 [sonnet]: Sentence with undo.** `core/sentence/sentence.ts` (R3): append char, word, actions; undo of
      what this session added; history cap. Tests: the sentence cases of the test plan.
      _To understand:_ an undo stack, immutable updates.
- [ ] **T3 [opus]: Counting state machine.** `core/counting/counting.ts`: states, signals, `next()` as a pure
      function with an explicit transition table, effects as data, Transloco keys with parameters (R4–R6). Tests: the
      77-row table test and every path of the test plan; a test that the module uses no clock or timers.
      _To understand:_ finite state machines, a transition table, effects as data, why time is injected.
- [ ] **T4 [sonnet]: Signal input and the keyboard mapping.** `core/input/signals.ts` (`Signal`), `keyboard.ts`
      (R7, off by default). Tests: the keyboard cases of the test plan.
      _To understand:_ SC 2.1.4, one input type for every source (buttons, keys, later the face).
- [ ] **T5 [sonnet]: Speech on the device.** `core/speech/speaker.ts` (interface), `web-speaker.ts` (local voices
      only, cancel, `no-local-voice`), `fake-speaker.ts` (R8). Tests: voice choice with fake `speechSynthesis`,
      cancel, no local voice.
      _To understand:_ the Web Speech API, `localService`, why a network voice is a privacy risk.
- [ ] **T6 [sonnet]: CountingService, docs and compound.** `core/counting/counting.service.ts` (R9: state in a
      signal, one `TICK` scheduler, effects to the sentence and the speaker), Transloco keys in `en.json` and
      `pl.json`; `docs/architecture.md` (the core modules), README status, specs index, log, Polish copies, summary.
      Tests: the service with a fake scheduler and speaker, a full path.
      _To understand:_ a thin Angular service around plain TypeScript, signals as state.
