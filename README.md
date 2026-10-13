# SMDrops Web Remake Research

An educational, private-play reconstruction project for studying the systems
behind *Sailor Moon Drops* and rebuilding them as a maintainable browser game.

The current repository contains an original-visual Match-3 web core, a
read-only stage converter, and technical notes derived from analysis of a
locally preserved Android asset dump.

## Current playable core

- Loads the converted `lvl_F_0001_00` stage JSON
- Valid adjacent swaps and invalid-swap rejection
- Horizontal/vertical matches, cascades, gravity, refill, shuffle, and hints
- Four-match line pieces, five-match rainbow pieces, and T/L area bombs
- Score, collect, and obstacle-clearing objectives
- Move limits, star thresholds, skill energy, and a prototype skill
- Local puzzle-piece progress and a wallpaper unlock placeholder
- Responsive desktop/mobile UI using original CSS visuals

## Repository layout

```text
web/                         Playable buildless web prototype
tools/stage-converter/       Read-only SMD binary-to-JSON converter
docs/                        Reverse-engineering and implementation notes
```

## Run locally

Install a recent Node.js, then:

```powershell
cd web
node preview-server.mjs
```

Open `http://127.0.0.1:4173`.

Run the engine tests with:

```powershell
node test-engine.mjs
```

## Convert local stage data

The full generated stage package is intentionally not committed. Given a local
copy of `SMDrops-AssetDump-Full`, regenerate it with:

```powershell
python tools/stage-converter/smd_stage_converter.py `
  --source "E:\SMDrops-AssetDump-Full" `
  --output "stage-json"
```

The verified local conversion produced 7,154 WW base stages, 10 different JP
overrides, and 35 JP-only ADV stages with zero parse errors.

## Project policy

- Do not commit APKs, original game binaries, decompiled DLLs, or the original
  image/audio/Live2D asset dump.
- Keep new UI, characters, artwork, music, and story content original.
- The included converted first-stage JSON is present only as a small technical
  fixture for validating the data adapter and game engine.

This is an independent preservation and learning project and is not affiliated
with or endorsed by the original rights holders.

