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

# Engineering
* [Architecture](architecture.md) - Modules, data flow from camera to speech, where data is stored.
* [Decisions (ADR)](adr/index.md) - Architecture decision records.
* [Conventions](conventions/index.md) - Frontend, testing, git, AI workflow, accessibility, security.

# Work
* [Specs](specs/index.md) - Feature specs and task lists, one folder per feature.
* [Knowledge](knowledge/index.md) - Learnings captured by the `/compound` step; read the relevant ones before a task.
* [Backlog](backlog.md) - Stages and ideas not yet specified.
