# Moonlit Match — SMD Web Core

An original-visual, buildless Match-3 prototype that reads the converted SMD
stage JSON format. The included first stage is `lvl_F_0001_00` from the local,
read-only conversion output.

## Run locally

Use the bundled Node runtime or any recent Node.js:

```powershell
node preview-server.mjs
```

Then open `http://127.0.0.1:4173`.

## Test

```powershell
node test-engine.mjs
```

The test covers the score, collect, and clean modes, including stable initial
boards, legal-move detection, swapping, scoring, and move consumption.

## Current scope

- Real converted stage-data adapter
- Legal adjacent swaps and invalid-swap rejection
- Horizontal and vertical match detection
- Cascades, gravity, refill, no-move shuffle, and hinting
- Four-match line pieces, five-match rainbow pieces, and T/L bombs
- Score, collect, and obstacle-clearing objectives
- Move limits, star thresholds, skill energy, and a prototype character skill
- Local puzzle-piece progress and wallpaper unlock placeholder
- Responsive desktop/mobile UI with original CSS visuals

Character progression, the complete reward tables, wallpaper media mapping,
and event scheduling remain separate future data modules.

