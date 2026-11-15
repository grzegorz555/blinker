---
okf_version: "0.2"
---

# Blinker knowledge bundle

This directory is an [OKF v0.2](https://github.com/GoogleCloudPlatform/open-knowledge-format) bundle. Every `.md`
file except `index.md` and `log.md` has YAML frontmatter with a `type`. Read the indexes level by level and open
only what the task needs.

# Product
* [Vision](vision.md) - Who Blinker is for, the problem, goals and non-goals.
* [Interaction model](interaction-model.md) - Signals (blink, head, gaze), input modes (scanning, counting) and their default actions.
* [Board format](board-format.md) - The JSON format of a swappable letter board (draft).
* [Design](design/index.md) - Visual language (Material 3 on our tokens), token table with contrast ratios, app structure, screens and states.
* [The friend's paper board](boards/friend-board.md) - Transcription and photo of the board he uses today (7×5, Polish, SZ/CZ).

# Engineering
* [Architecture](architecture.md) - Modules, data flow from camera to speech, where data is stored.
* [Decisions (ADR)](adr/index.md) - Architecture decision records.
* [Conventions](conventions/index.md) - Frontend, testing, git, AI workflow, accessibility, security.

# Work
* [Specs](specs/index.md) - Feature specs and task lists, one folder per feature.
* [Knowledge](knowledge/index.md) - Learnings captured by the `/compound` step; read the relevant ones before a task.
* [Backlog](backlog.md) - Stages and ideas not yet specified.
* [Trial with the friend](trial/index.md) - Stage 6: the checklist for the first session with him.
