# 03 — Design Specification

Owner: Designer. Status: Approved. Implementers must follow this; deviations go through a doc change.

## 1. Direction

"Dark studio." A dark, matte surface like a hardware controller; the pads are the hero and the only colourful element. Everything else is restrained, high contrast, and typographically precise. It should read as an instrument first and a web page second. Think Native Instruments hardware, Teenage Engineering web pages, Linear's product UI.

Principles:
1. **Pads first.** The grid is centred and largest. Nothing animates except in response to playing.
2. **Instant feedback.** Every hit produces a visible response within one frame.
3. **Quiet chrome.** Controls are monochrome until hovered/active.
4. **Honest state.** MIDI connection, kit loading, and audio state are always visible in the status bar.

## 2. Tokens (`src/app/theme.css`)

```css
:root {
  --bg-0: #0b0c0f;        /* page */
  --bg-1: #121418;        /* panels */
  --bg-2: #1a1d23;        /* pads idle, inputs */
  --bg-3: #242831;        /* hover */
  --line: #2b303a;        /* borders */
  --fg-0: #f3f4f6;        /* primary text */
  --fg-1: #a6adbb;        /* secondary text */
  --fg-2: #7d8595;        /* tertiary text; ≥ 4.5:1 on --bg-2 (was #6b7280, failed contrast) */
  --accent: #ff7a1a;      /* hits, active, brand (warm amber-orange) */
  --accent-2: #ffb86b;    /* velocity highlight */
  --ok: #3ddc84;          /* connected */
  --warn: #ffcc3d;        /* loading */
  --err: #ff4d4f;         /* error */
  --radius-s: 6px; --radius-m: 10px; --radius-l: 16px;
  --shadow-pad: 0 1px 0 rgba(255,255,255,.04) inset, 0 8px 24px rgba(0,0,0,.45);
  --font-ui: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
```

Group colours (used for pad label dots and mixer strips, never for pad fill):
kick `#ff7a1a`, snare `#ff4d6d`, hihat `#ffd23f`, toms `#4dd4ff`, cymbals `#b48bff`, perc `#3ddc84`.

Typography: Inter 400/500/600 for UI; JetBrains Mono for note numbers, dB values, latency. Sizes: 12 / 14 / 16 / 20 / 28 / 40 px. Line height 1.4. Letter-spacing −0.01em on headings.

Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px.

## 3. Layout

Desktop (≥ 1024 px), single screen, no scrolling for the instrument:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ● Drumr        [Kit: Virtuosity Jazz ▾]      MIDI: ● Maschine MK3   │  status bar 56px
├───────────────────────┬──────────────────────────────┬───────────────┤
│  KIT                  │                              │  HI-HAT       │
│  name, description    │         ┌───┬───┬───┬───┐    │  openness     │
│  license badge        │         │   │   │   │   │    │  meter (vert) │
│                       │         ├───┼───┼───┼───┤    │  CC: 1 ▾      │
│  MIXER                │         │   │   │   │   │    │  invert [x]   │
│  Master ───────●──    │         ├───┼───┼───┼───┤    │               │
│  Kick   ───────●──    │         │   │   │   │   │    │  VELOCITY     │
│  Snare  ───────●──    │         ├───┼───┼───┼───┤    │  curve graph  │
│  Hi-hat ───────●──    │         │   │   │   │   │    │  exp  2.4     │
│  Toms   ───────●──    │         └───┴───┴───┴───┘    │  floor 28     │
│  Cymbals───────●──    │   [Edit mapping] [Preset ▾]  │               │
│  Perc   ───────●──    │                              │  LATENCY      │
│                       │                              │  7.2 ms       │
├───────────────────────┴──────────────────────────────┴───────────────┤
│ About · Sources & licenses · GitHub                      v1.0.0       │  footer 40px
└──────────────────────────────────────────────────────────────────────┘
```

Left column 280 px, right column 240 px, centre flexible. Pad grid is a square sized to `min(centreWidth − 48, viewportHeight − 200)`.

Tablet (768–1023 px): side columns collapse into two tabs below the grid ("Mixer", "Hi-hat & velocity").
Phone (< 768 px): grid full width, status bar condensed to icons, columns become a bottom sheet. Keyboard hints hidden; touch is the input.

## 4. Components

### 4.1 Pad
- Square, `--bg-2` fill, 1 px `--line` border, `--radius-m`, inner shadow `--shadow-pad`.
- Content: label (14 px, `--fg-0`) top-left; note number (mono 12 px, `--fg-2`) bottom-left; group dot (8 px) top-right; keyboard key hint (mono 11 px, `--fg-2`) bottom-right on desktop.
- States:
  - **idle**: as above.
  - **hit**: fill flashes to `--accent` with opacity = `0.35 + 0.65 × velocity/127`, outer glow `0 0 24px var(--accent)` at same opacity, scale 0.97 → 1.0. Decay 180 ms ease-out. Implemented with CSS custom property `--v` set per hit and a `data-hit` attribute toggled via `requestAnimationFrame`; no React state per hit.
  - **sounding-open-hat**: thin `--accent-2` ring persists while an open hi-hat voice is active, cleared on choke.
  - **unavailable** (voice not in kit): `--fg-2` label, diagonal hatch background at 6 % opacity, tooltip "Not in this kit".
  - **learning** (mapping editor): dashed `--accent` border, pulsing 1 s, label "Hit a pad…".
  - **focused** (keyboard a11y): 2 px `--accent` outline offset 2 px.

### 4.2 Status bar
- Left: logo dot + name. Centre: kit selector (Select primitive). Right: MIDI status pill: `● Connected · <device>` green; `○ No device` grey with "Choose…" if several; `⚠ Not supported` amber on Safari. Clicking opens device list.
- Audio-suspended overlay (full screen, `--bg-0` at 85 %): "Tap anywhere to start audio". Disappears on first gesture.

### 4.3 Kit selector
- Dropdown listing kits with name, one-line description, size badge ("24 MB"), license badge ("CC0"). Loading shows a determinate progress bar under the status bar (bytes received / totalBytes) and the pads are disabled with 50 % opacity until decoded.

### 4.4 Mixer
- Vertical list of horizontal sliders. Label left, value in mono dB right (e.g. `−6.0 dB`). Double-click resets to 0 dB. Group colour dot before the label. Mute toggle on hover.

### 4.5 Hi-hat panel
- Vertical meter showing CC position with the discrete bands as ticks; the active openness level is labelled ("¾ open"). CC number select and invert checkbox below.

### 4.6 Velocity panel
- 120 × 80 px SVG plot of the curve; input velocity on x, output on y; the last hit is drawn as a dot that fades. Two number inputs: exponent (1.0–4.0 step 0.1), floor (0–64).

### 4.7 Mapping editor (modal panel over the grid)
- Grid stays visible; each pad gets an edit affordance. Click pad → side form: Note (number, with "Learn" button), Voice (searchable select grouped by family), Label (text). "Reset to preset" and "Export JSON" / "Import JSON" at the bottom. Changes apply live.

### 4.8 About / Sources panel (slide-over)
- What it is (3 sentences), tech stack chips, a "How it works" diagram (simple SVG: controller → Web MIDI → mapping → Web Audio → speakers), and a sources table: kit, author, license, link.

### 4.9 Debug panel (toggle with `` ` `` key or footer link)
- Mono text: AudioContext sampleRate, baseLatency, outputLatency, last 50-hit median and p95 of event-to-schedule time, active voices, decoded buffers, memory estimate.

## 5. Motion

- Pad hit: 180 ms, `cubic-bezier(.2,.8,.2,1)`.
- Panel open/close: 200 ms translate + fade.
- Nothing else animates. `prefers-reduced-motion`: pad flash becomes a 1-frame colour change with no glow or scale.

## 6. Accessibility

- All controls keyboard-operable; pads are `button`s with `aria-label="Pad 5: Snare center, note 25"` and `aria-pressed` during a hit is **not** used (too chatty); instead an `aria-live="polite"` region announces kit and MIDI state changes only.
- Contrast ≥ 4.5:1 for text, ≥ 3:1 for UI boundaries. `--fg-1` on `--bg-1` passes.
- Focus visible everywhere. No colour-only state: unavailable pads also hatch; connected status also has text.
- Touch targets ≥ 44 px.

## 7. Portfolio surface

- `README.md` header with a 10-second GIF of playing, badges for CI and Lighthouse, a "Try it" link, and a short architecture diagram.
- Open Graph meta tags with a 1200×630 social image of the pad grid mid-hit.
- Footer version from `package.json` and commit hash.
