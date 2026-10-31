# Drumr — Project Overview

Name: **Drumr**. Repository: https://github.com/gauravsaluja2006/drumr. GitHub Pages base path: `/drumr/`.

A browser-based finger-drumming instrument. Plug in a USB MIDI pad controller, pick an acoustic drum kit, play. No install, no DAW, no account. It replaces a Logic Pro + Drum Kit Designer + Scripter setup (see `../logic.js`) with a free, open, portfolio-quality web app.

## Documents

| # | File | Owner role | Purpose |
|---|------|-----------|---------|
| 01 | `01-PRD.md` | Product manager | What we build and why, users, scope, user stories, non-goals |
| 02 | `02-ARCHITECTURE.md` | Tech lead | Stack, module layout, data schemas, audio graph, MIDI flow, decisions |
| 03 | `03-DESIGN.md` | Designer | Visual language, layout, components, states, motion, accessibility |
| 04 | `04-ROADMAP.md` | Project manager | Phases, tasks, acceptance criteria, tests required per phase, Definition of Done |
| 05 | `05-TESTING.md` | QA lead | Test pyramid, tooling, mocks for Web MIDI and Web Audio, CI gates, regression policy |
| 06 | `06-METRICS.md` | Tech lead | Performance budgets, how each metric is measured, pass/fail thresholds |
| 07 | `07-KIT-PIPELINE.md` | Developer | How source sample libraries become app kits; manifest schema; licensing |
| – | `../KITS.md` | Research | Verified free sample libraries and download links |
| – | `../CLAUDE.md` | Tech lead | Operating rules for any AI or human implementing a phase |

## How to use these docs

1. Read `CLAUDE.md` first. It is the contract for how work gets done.
2. Read `01` and `02` fully before Phase 0. Skim `03`, `05`, `06`.
3. Implement phases strictly in the order in `04-ROADMAP.md`. Each phase ends with every test from every earlier phase still passing in CI.
4. When a decision in these docs turns out to be wrong, change the doc in the same pull request as the code, and add an entry to the Decision Log at the end of `02-ARCHITECTURE.md`.

## One-paragraph pitch (for the portfolio page)

Drumr turns any MIDI pad controller into an acoustic drum kit inside the browser. It uses the Web MIDI and Web Audio APIs with no plugins, loads multi-velocity, round-robin sampled kits released under open licenses, and models real hi-hat behaviour: continuous openness from a controller strip, and closed hits that choke ringing open hits. It was built to replace a paid DAW workflow with something free, fast, and shareable.
