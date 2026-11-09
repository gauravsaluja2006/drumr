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
  --fg-2: #8a92a2;        /* tertiary text; ≥ 4.5:1 on --bg-3 hover (was #6b7280, then #7d8595; both failed) */
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

Desktop (≥ 1024 px), single screen, no scrolling for the instrument (side columns scroll inside themselves):

```
┌──────────────────────────────────────────────────────────────────────┐
│ ▦ Drumr  live drum sampler          MIDI: ● Maschine MK3  [Settings]│  status bar 56px
├───────────────────────┬──────────────────────────────┬───────────────┤
│  KITS                 │         ┌───┬───┬───┬───┐    │  SOUND        │
│  [⟳ Rotate] every 15s │         │   │   │   │   │    │ [Room][Hall]  │
│  ▬▬▬▬▬▬▬▬ countdown   │         ├───┼───┼───┼───┤    │ [Plate][Echo] │
│  ● SM Drums           │         │   │   │   │   │    │ Tune & fx…    │
│    Muldjord           │         ├───┼───┼───┼───┤    │               │
│    Roland TR-808      │         │   │   │   │   │    │  HI-HAT       │
│    … (scrolls)        │         └───┴───┴───┴───┘    │  openness     │
│  ─────────────        │        [● Record loop]       │  meter (vert) │
│  Kit name and         │   M ▮ │ K  S  H  T  C  P     │               │
│  description          │   ┃ ┃ │ ┃  ┃  ┃  ┃  ┃  ┃     │               │
├───────────────────────┴──────────────────────────────┴───────────────┤
│ About · Sources & licenses · GitHub                      v1.0.0       │  footer 40px
└──────────────────────────────────────────────────────────────────────┘
```

Left column 340 px (long kit names fit), right column 240 px, centre flexible. Pad grid is a square sized to `min(centreWidth, viewportHeight − 400)` on desktop (room for the looper row and mixer strip; `− 340` under 800 px tall), `viewportHeight − 220` below.

Tablet (768–1023 px): side columns collapse into two tabs below the grid ("Kit & mixer" with the Sound toggles, and "Hi-hat"); the kit list sits in the first tab and the mixer there uses horizontal sliders.
Phone (< 768 px): grid full width, status bar condensed to icons, columns become a bottom sheet. Keyboard hints hidden; touch is the input.

## 4. Components

### 4.1 Pad
- Square, `--bg-2` fill, 1 px `--line` border, `--radius-m`, inner shadow `--shadow-pad`.
- Content: label (14 px, `--fg-0`) top-left; note number (mono 12 px, `--fg-2`) bottom-left; group dot (8 px, `--group-*` of the sound the pad plays now) top-right; keyboard key hint (mono 11 px, `--fg-2`) bottom-right on desktop.
- States:
  - **idle**: as above.
  - **hit**: fill flashes to the pad's group colour (`--accent` when it has none) with opacity = `0.35 + 0.65 × velocity/127`, outer glow `0 0 24px var(--accent)` at same opacity, scale 0.97 → 1.0. Decay 180 ms ease-out. Implemented with CSS custom property `--v` set per hit and a `data-hit` attribute toggled via `requestAnimationFrame`; no React state per hit.
  - **sounding-open-hat**: thin `--accent-2` ring persists while an open hi-hat voice is active, cleared on choke.
  - **unavailable** (voice not in kit): `--fg-2` label, diagonal hatch background at 6 % opacity, tooltip "Not in this kit".
  - **learning** (mapping editor): dashed `--accent` border, pulsing 1 s, label "Hit a pad…".
  - **focused** (keyboard a11y): 2 px `--accent` outline offset 2 px.

### 4.2 Status bar
- Left: logo dot + name. Right: MIDI status pill (kits are chosen in the kit list, §4.3a): `● Connected · <device>` green; `○ No device` grey with "Choose…" if several; `⚠ Not supported` amber on Safari. Clicking opens device list.
- Audio-suspended overlay (full screen, `--bg-0` at 85 %): "Tap anywhere to start audio". Disappears on first gesture.

### 4.3 Kit loading
- Loading shows a determinate progress bar under the status bar (bytes received / totalBytes) and the pads are disabled until decoded. Disabled pads use the `--bg-1` fill and a wait cursor; they are not faded, because 50 % opacity pushed note numbers below 4.5:1 contrast. (The status-bar kit dropdown was removed in favour of the kit list, ADR-34.)

### 4.3a Kit list and rotation (left column)
- Every kit in one scrolling list: playing kit marked with an `--accent` dot and `aria-current`; click loads; "local" badge for kits built on this machine. The current kit's name and description sit below the list (licence and author are in the About panel, §4.8).
- While rotation runs (only then), a checkbox per kit ticks it for rotation; with none ticked, rotation uses every kit. Ticks persist. Ticking only the playing kit keeps rotation running on that kit until another is ticked.
- Rotation controls above the list: `⟳ Rotate kits` toggle (pressed: `--accent` border and text, label "Rotating"), "every" select (10/15/30/60 s, 1/2/4/8 bars of 4/4, or 1/2/4 loop passes; turning rotation on while a loop plays, or closing a loop while it rotates, selects "every loop pass"; loop-pass mode shows "Record a loop (L) to start" until a loop plays), and in bars mode a BPM input with a Tap button. While running, a 4 px `--accent` bar on `--bg-3` empties until the next switch (progress indicator, not decoration).
- The controller encoder highlights a row (`--bg-3` fill, `--accent` outline at 60 %) and keeps it in view.

### 4.4 Mixer
- Sidebar and tablet: vertical list of horizontal sliders. Label left, value in mono dB right (e.g. `−6.0 dB`). Double-click resets to 0 dB. Group colour dot before the label. Mute toggle on hover.
- Desktop: a strip of vertical faders under the pads (Master, a divider, then the kit's groups): value in mono 10 px on top, 80 px fader filled in the group colour, mute toggle, label with colour dot below.
- Output meter beside Master: 6 px bar, `--ok` to 70 %, `--warn` to 88 %, `--err` above, on a −48…0 dBFS scale; falls at 24 dB/s; a 6 px clip light (`--err` with glow) holds 1.5 s. Runs only while something sounds (woken by hits, sleeps when settled).

### 4.5 Hi-hat panel (meter on the home screen; controller settings in Settings › Playing)
- Vertical meter showing CC position with the discrete bands as ticks; the active openness level is labelled ("¾ open"). CC number select and invert checkbox below.

### 4.5a Sound panel (right column above Hi-hat; "Kit & mixer" tab on phones)
- Four toggle buttons in a 2 × 2 grid (Room, Hall, Plate, Echo; pressed: `--accent` border, text and dot). Several can be on at once. Caption: "Recommended", "Your mix" or "Same on every kit", and a "Tune & effects…" link that opens Settings › Sound.
- Every kit starts with Room and Hall on at its recommended amounts (ADR-41).

### 4.6 Velocity panel (Settings › Playing)
- 120 × 80 px SVG plot of the curve; input velocity on x, output on y; the last hit is drawn as a dot that fades. Two number inputs: exponent (1.0–4.0 step 0.1), floor (0–64).

### 4.7 Mapping editor (modal panel over the grid)
- Grid stays visible; each pad gets an edit affordance. Click pad → side form: Note (number, with "Learn" button), Voice (searchable select grouped by family), Label (text). "Reset to preset" and "Export JSON" / "Import JSON" at the bottom. Changes apply live.

### 4.8 About / Sources panel (slide-over)
- What it is (3 sentences), tech stack chips, a "How it works" diagram (simple SVG: controller → Web MIDI → mapping → Web Audio → speakers), and a sources table: kit, author, license, link.

### 4.8a MIDI controls (Settings › Controller)
- Rows grouped as Buttons, Knobs, Encoder: action name, current assignment in mono (`CC 102`, `Note 40 · ch 2`, `—`), Learn button (pressed: dashed `--accent` border, text "Cancel"; the assignment cell reads "Move it…"; 10 s timeout), and a clear ✕.
- A `--warn` line under a row whose assignment shadows a pad note or the hi-hat CC.
- Footer: encoder mode select, "Program change selects a kit" checkbox, "Clear all assignments".

### 4.10 Looper (row between the pads and the mixer)
- One main button whose label is the next action: `● Record loop` → (armed) `Hit a pad to start…` with a dashed `--accent` border → (recording) `■ Close loop` with an `--err` border and a mono running time → (playing) `● Overdub` → (overdubbing) `Overdubbing: press to finish` with an `--err` border → (stopped) `▶ Play loop`. Key `L`; `Shift+L` stops/plays. MIDI-learnable: record/close/overdub, play, stop, stop/play (one button), undo, clear; Play never restarts a loop that is already playing.
- While a loop plays: a 4 px position bar (`--accent`, `--err` while overdubbing) and `■ Stop`; `↶ Undo` when there are overdub layers; `✕ Clear` whenever there is something to clear; the loop length and layer count in mono `--fg-2`.
- With no loop: a "Length" select, "As played" or "Whole bars at N BPM" (the rotation tempo).

### 4.11 Settings (slide-over, same Dialog as §4.8; header "Settings" button or `,`)
- Tabs: **Sound** (current kit: Space = effect rows with toggle, description, amount %, 0–100 % slider, "Use on all kits"; Drums = Tune −12…+12 st and Length 10 %…Natural per group in the kit, two columns, double-click resets; Feel = "Natural variation" checkbox; "Reset <kit> to its recommended sound"), **Playing** (Pad feel = §4.6; Hi-hat pedal = §4.5 with settings; Pad layout select and "Edit layout" which closes Settings and opens the editor; Looper length; keyboard shortcut list), **Controller** (§4.8a MIDI learn).
- Tab bar: text tabs with a 2 px `--accent` underline on the selected tab.

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
