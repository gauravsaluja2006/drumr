# Drumr

Play acoustic drum kits in the browser with any USB MIDI pad controller. Web MIDI + Web Audio, no plugins, no DAW, no install.

> Status: specification complete, implementation not started. See `docs/00-OVERVIEW.md`.

## What it does

- Loads multi-velocity, round-robin sampled acoustic kits (open licenses, see `KITS.md`).
- Detects your MIDI controller and maps pads to drum voices with a layout you control (default: Maschine 4×4 layout ported from `logic.js`).
- Models hi-hat behaviour: openness from a CC strip, closed hits choke ringing open hats.
- Works without hardware too: click, tap, or use the keyboard.

## Documentation

| Doc | Content |
|---|---|
| `docs/00-OVERVIEW.md` | Index and how to use the docs |
| `docs/01-PRD.md` | Product requirements and user stories |
| `docs/02-ARCHITECTURE.md` | Stack, module layout, schemas, audio graph, decisions |
| `docs/03-DESIGN.md` | Visual design specification |
| `docs/04-ROADMAP.md` | Phases, tasks, acceptance criteria, required tests |
| `docs/05-TESTING.md` | Test strategy, fakes, CI |
| `docs/06-METRICS.md` | Performance budgets and how they are measured |
| `docs/07-KIT-PIPELINE.md` | Turning sample libraries into app kits |
| `CLAUDE.md` | Rules for implementing a phase |
| `KITS.md` | Researched sample libraries |

## Licensing

Application code: MIT. Each kit under `public/kits/<id>/` carries its own license (CC0 or CC-BY-SA) as stated in its manifest and `LICENSE.txt`.
