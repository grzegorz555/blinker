---
type: Learning
title: "No" means a different thing in every state; handle each state explicitly
description: A head shake rejects a number, goes back a step, or deletes a letter, depending on the state; a fall-through branch can turn a habitual second "no" into a lost letter.
tags: [interaction, state-machine, aac]
status: stable
generated:
  by: agent:claude-opus-5-5
  at: 2026-11-13
verified:
  - by: human:Grzegorz Roczniak
    at: 2026-11-13
---

# Context
In the spec 004 simulator (T4), `shake()` handled "asking" and "counting" first and let every other state fall
through to "at the columns, no deletes the last letter". The review found that right after "Jeszcze raz" (a
rejected number) a second shake, which he might do out of habit, deleted a letter he had not asked to delete.

# Lesson
In `docs/interaction-model.md`, `HEAD_SHAKE` is "no / back one step", and what "one step" is depends on the state.
The destructive meaning (delete a letter) must be reached only from the states where the author expects it, never
by falling through. A repeated "no" must not escalate from "reject" to "delete".

# How to apply
- In the stage 2 state machine, map every (state, signal) pair explicitly, with a table test that lists each pair
  and its result; no default branch for signals that change the text.
- Add a test for "the same signal twice in a row" for every signal that can delete or speak.
- Undo removes only what this session added, never text it did not write.
- Let the compiler hold the table (spec 006): `TRANSITIONS: Record<StateName, Record<SignalType, Handler>>` makes a
  missing pair a type error, and the table test iterates `STATE_NAMES × SIGNAL_TYPES`, so a new state or signal
  cannot be added without deciding every pair.
