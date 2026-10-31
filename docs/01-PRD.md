# 01 — Product Requirements (PRD)

Owner: Product manager. Status: Approved for Phase 0.

## 1. Problem

Finger drummers who practise on a MIDI pad controller need (a) good acoustic drum sounds, (b) a pad layout they control, (c) realistic hi-hat behaviour. Today this requires a DAW (Logic Pro, Ableton) or a paid drum plugin. The author previously used Logic Pro with a custom Scripter mapping (`logic.js`) and lost access when the subscription ended.

## 2. Goal

A free web app that does only those three things, well, with a UI good enough to show in a portfolio.

## 3. Users

| Persona | Needs | How they arrive |
|---|---|---|
| **Primary: the author** | Plug in Maschine pad, pick a kit, play with the exact layout from `logic.js`, hi-hat openness on CC1 | Chrome on macOS, USB controller |
| **Secondary: other finger drummers** | Same, with their own controller and layout; mapping editor; save mappings | Chrome/Edge/Firefox, any class-compliant USB MIDI pad |
| **Tertiary: portfolio visitors** (recruiters, developers) | Understand what it is in 10 seconds, try it without hardware (keyboard/mouse), see it is well engineered | Any browser including Safari and mobile |

Tertiary users matter: the app must be fully demonstrable with no MIDI device.

## 4. Scope

### 4.1 In scope (v1, all phases of `04-ROADMAP.md`)

1. **Kits.** At least 3 acoustic kits bundled (jazz, rock, lightweight starter). Each kit: multiple velocity layers and round robins where the source provides them. Kit switch without page reload, with loading progress.
2. **MIDI input.** Detect USB MIDI devices via Web MIDI, let the user choose a device, show connection state, hot-plug support.
3. **Pad mapping.** 16-pad grid (4×4) by default. Each pad maps to a *logical voice* (kick, snare center, hi-hat open, ride bell, ...). Default preset reproduces `logic.js` for Maschine (notes 24–39). Mapping editor with MIDI learn. Mappings persist locally and export/import as JSON.
4. **Velocity.** Configurable curve (exponent + floor) defaulting to the `logic.js` values (exponent 2.4, floor 28). Velocity selects sample layer and scales gain.
5. **Hi-hat model.**
   - Openness from a MIDI CC (default CC1, invertible) selects which open-ness sample the "open hi-hat" pad plays (closed, half, ¾, open, as available in the kit).
   - Dedicated closed pads always play closed regardless of CC.
   - **Choke:** a closed or pedal hi-hat hit stops any ringing open/half hi-hat within ~40 ms. Also applies to crash chokes where the kit provides them.
6. **Sound controls (simple).** Master volume, per-group volume (kick, snare, hi-hat, toms, cymbals, percussion), mute. Nothing more in v1.
7. **No-hardware mode.** On-screen pads are clickable/tappable; computer keyboard triggers pads. Works in Safari and on phones.
8. **Visual feedback.** Pads light proportional to velocity; hi-hat openness shown live; latency readout available.
9. **Portfolio polish.** Landing/about section, attribution for sample libraries, responsive layout, accessible, installable as PWA with kits cached offline.

### 4.2 Out of scope (v1)

- Recording, sequencing, looping, metronome.
- Effects beyond volume (reverb, EQ, compression). May come in v2.
- Multiple simultaneous kits, layering, custom user-uploaded samples.
- Accounts, cloud sync, analytics.
- MIDI output.
- Electronic/808 kits.

## 5. User stories and acceptance criteria

IDs are referenced by tests (`05-TESTING.md`) and phases (`04-ROADMAP.md`).

| ID | Story | Acceptance criteria |
|---|---|---|
| US-01 | As a player I open the app and see a kit loaded and a pad grid, so I can play immediately | Default kit auto-loads; progress bar shown; first pad audible within 3 s on a 50 Mbps connection |
| US-02 | As a player I click/tap a pad or press a keyboard key and hear the voice | Pad lights, sound plays, keyboard keys `1234/qwer/asdf/zxcv` map to the 4×4 grid top-to-bottom, left-to-right |
| US-03 | As a player I plug in a MIDI controller and the app detects it | Device appears in the device list within 1 s of plug-in; selected automatically if it is the only one; status indicator shows "Connected: <name>" |
| US-04 | As a player I hit a pad on my controller and hear the mapped voice | Note-on triggers the voice; velocity affects loudness and layer; added software latency ≤ 10 ms (see `06-METRICS.md`) |
| US-05 | As the author my Maschine layout works out of the box | Preset "Maschine 4×4 (Logic)" reproduces the `PAD_ALIASES` table in `logic.js` exactly |
| US-06 | As a player I move my hi-hat strip/knob and the open hi-hat pad changes openness | CC1 value in 7 bands (as `updateHiHat` in `logic.js`) maps to the nearest available openness level in the current kit; UI shows current openness |
| US-07 | As a player I hit closed hi-hat after open hi-hat and the open hat stops ringing | Any sounding open/half/¾ hi-hat voice fades to silence within 40 ms of a closed or pedal hit |
| US-08 | As a player I switch kits and my mapping still works | Mapping is by logical voice; the new kit resolves voices with documented fallbacks; switch completes without audio glitches on already-loaded kits |
| US-09 | As a player I change the mapping of a pad with MIDI learn | Click pad → "Listening…" → hit controller pad → pad shows new note; choose voice from a list; saved to localStorage; survives reload |
| US-10 | As a player I export my mapping and import it on another machine | JSON file download/upload; schema validated; invalid file shows a clear error |
| US-11 | As a player I adjust master and per-group volume | Sliders in dB, −60 to +6, changes apply to the next hit without clicks; persisted |
| US-12 | As a visitor without MIDI I still get the full experience | No-device banner explains keyboard/touch; Safari shows "MIDI not supported in this browser" with keyboard mode active |
| US-13 | As a visitor I understand the project and its sources | About panel: what it is, tech used, sample library attributions with links and licenses |
| US-14 | As a player I can see the latency I am getting | Debug panel shows AudioContext base + output latency and measured event-to-schedule time |
| US-15 | As a returning player the app loads offline | PWA: app shell and last-used kit are cached; works with network off |

## 6. Constraints

- **Browser support.** Full: Chrome 110+, Edge 110+, Firefox 115+ (Web MIDI). Degraded (no MIDI): Safari 17+, iOS Safari, Android Chrome (Android Chrome does support Web MIDI with USB OTG; treat as bonus).
- **Licensing.** Only kits with CC0, CC-BY, or CC-BY-SA licenses. Attribution shown in-app and in README. See `07-KIT-PIPELINE.md`.
- **Hosting cost.** Zero. Static hosting only (GitHub Pages or Cloudflare Pages).
- **Size.** Per-kit payload ≤ 30 MB; total repo audio ≤ 120 MB.
- **Privacy.** No analytics, no network calls other than fetching static assets.

## 7. Success criteria for v1

- All user stories above have passing automated tests in CI.
- All metrics in `06-METRICS.md` meet their targets on the deployed site.
- Author uses it as the daily practice tool instead of a DAW.
- Lighthouse ≥ 95 in Performance, Accessibility, Best Practices.

## 8. Alternatives considered (browser DAWs, checked 2026-10-31)

| Product | Free? | Live USB MIDI | Acoustic kits | Pad remap / hi-hat choke / CC openness | Verdict |
|---|---|---|---|---|---|
| openDAW (opendaw.org) | Yes, AGPL v3 or commercial licence; self-hostable | Yes via Web MIDI (press coverage; site is JS-rendered, not verified first-hand) | No bundled acoustic kits found; "Playfield" is a sample drum computer you load yourself | Not documented | Full DAW, prototype status, Node 23 + Rust toolchain. Useful as a reference for Web Audio/Web MIDI engineering, not as a replacement. AGPL means no copying code into this MIT project. |
| Soundtrap (Spotify) | Free tier exists; some sounds and kits gated behind paid plans; account required | Yes (MIDI keyboard/controller via Chrome) | "100s of virtual drum kits" incl. jazz/rock, names and sampling depth unknown | None found; drums are a step-sequencer "Patterns Beatmaker" | Closed, account-based, no mapping control. Not a fit. |
| Audiotool | Free, no ads, no track limits; account required; Chrome/Firefox only | Yes ("Play live with MIDI", MIDI learn) | No: Machiniste (sampler), Beatbox 8/9 (808/909 style) | Machiniste has per-slot choke groups; no note remap or CC hi-hat documented | Electronic-focused. Choke-group UX is a good reference for our hi-hat choke. Not a replacement. |

Conclusion: none provides multi-velocity acoustic kits plus user-controlled pad mapping plus CC-driven hi-hat openness without an account. The custom app remains justified. Sources: openDAW GitHub README, audiotool.com product and manual pages, soundtrap.com product pages and support articles.
