# Free acoustic drum kits (researched 2026-10-31)

Shortlist for a self-built pad sampler. All verified against the source pages or by downloading.

## Tier 1: use these

### Virtuosity Drums (Versilian Studios / Karoryfer) — jazz kit, CC0
- License: CC0-1.0 (LICENSE file in repo)
- Download: https://versilian-studios.com/Distro/Virtuosity_Drums_v0.925.zip (~1.1 GB) or repo https://github.com/sfzinstruments/virtuosity_drums
- Format: FLAC, 44.1 kHz. Folders per mic position: kickmic, snaremic, mid, oh, room, lofi, perc. `Samples/mid/` is a usable stereo mix on its own.
- Hi-hat (verified file list): closed, half, 3/4 ("34"), open, pedal, splash. 4 velocity layers x 3-4 round robins each.
- Snare/toms/kick: up to 36 velocity layers, no round robins. Cymbals: fewer layers, 4 RR.
- Naming: `mid_hh_half_vl2_rr3.flac` (mic_piece_artic_velocityLayer_roundRobin).

### Big Rusty Drums (Karoryfer) — big rock kit, CC0
- License: CC0-1.0
- Download: https://github.com/sfzinstruments/karoryfer.big-rusty-drums/releases/download/v1.100/Big_Rusty_Drums_1100.zip (2.3 GB, 4400+ samples)
- Format: FLAC. Folders: kick_24, snare_14, tom_14, tom_15, tom_18, tom_22, hihat_14, ride_22, ride_sizzle_19, crash_17, crash_sizzle_17, china_18, stack_3_layer.
- Hi-hat: tip hits at 6 openness levels (cl, lc, qo, ho, tc, open = closed, little closed?, quarter, half, three-quarter, open), shank hits at 4 levels (`_s`), chik, footspl, pedal click/return, brush variants. Each articulation has `cl` (close mic) and `oh` (overhead) subfolders, 24 files each (velocity layers x RR).
- Snare: center, edge, rimshot, sidestick, rim click, shell click, brushes, mallets. Toms: center, rim click, shell click, brushes, mallets.
- Naming: `Samples/hihat_14/cl/oh/ht_cl_vl1_rr1.flac`.

### AVL Drumkits (bandshed.net) — small, 5 velocity layers, CC-BY-SA 3.0
- License: CC-BY-SA 3.0 (attribution/share-alike only if you redistribute modified samples)
- Downloads (SFZ zips contain plain WAVs): https://www.bandshed.net/sounds/AVLDrumkits_SFZ/
  - BLACK_PEARL_2023_repack.zip (14 MB), RED_ZEPPELIN_2023_repack.zip (17 MB), BLONDE_BOP_SFZ.zip (18 MB), BLONDE_BOP_HR_SFZ.zip (16 MB), BUSKMANS_HOLIDAY_SFZ.zip (21 MB)
- Format (verified, Black Pearl): 16-bit mono 44.1 kHz WAV, 128 files, 5 velocity layers per piece, no round robins. Already GM-mapped (36 kick, 38 snare, 42/44/46/48 hat closed/pedal/semi/swish, etc.). Keymap: https://www.bandshed.net/pdf/AVL-Drumkits-1.0-Keymap.pdf
- Hi-hat: closed, pedal, semi-open, swish only (3 openness levels).
- Black Pearl pieces: kick, snare + edge + sidestick, 12" tom + edge, 16" floor + edge, 2 crashes + chokes, ride tip/shank/bell/choke, splash, china, clap, cowbell, tambourine, maraca, stick click.

## Tier 2: good but heavier or less convenient

- **Naked Drums (Wilkinson Audio)** — CC-BY-4.0, 1.3 GB FLAC, 10 RR x up to 5 vel layers, 16 mic channels. Hi-hat open/half/closed via CC4 or notes (mapping in Data/keymap.txt). Repo only, no zip: https://github.com/sfzinstruments/WilkinsonAudio.NakedDrums
- **SM Drums / SM MegaReaper** — "public domain" per sfzinstruments, 2.2 GB WAV, up to 127 velocity layers. Google Drive download, multichannel-ish layout, license text unverified. https://sfzinstruments.github.io/drums/sm_drums
- **Salamander Drumkit** — CC-BY-SA 3.0, 370 MB WAV, few velocity layers but many RR. https://archive.org/details/SalamanderDrumkit
- **DrumGizmo kits (DRSKit, MuldjordKit, CrocellKit, Aasimonster)** — CC-BY-4.0, excellent recordings, but per-microphone channel files (13-16 channels) that need mixing down; 2-5.5 GB each. SFZ/FLAC ports of DRSKit and MuldjordKit exist at https://github.com/sfzinstruments/DrumGizmo.DRSKit and https://github.com/sfzinstruments/DrumGizmo.MuldjordKit
- Other Karoryfer CC0 sets: Swirly Drums (brushes, 1.6 GB), Unruly Drums (all snares, 2 GB), Frankensnare (snares, 900 MB), Gogodze Phu Vol II (lo-fi, 133 MB) via https://shop.karoryfer.com
