# Original Lemmings assets and 120-level Amiga campaign

Collected and decoded on 2026-09-30 for the authorised private Lemming Rescue update. All coordinates and exported pixels remain at native size; no generative imagery, repainting, or resampling was used.

## Authoritative asset sources

- Original Amiga level rip by Mindless: https://www.camanis.net/lemmings/files/rips/levels/amiga_lemmings_levels.zip
- Extractor's announcement: https://www.lemmingsforums.net/index.php?topic=712.0
- Original decrunched Amiga disk data, SPS set 0132: https://www.camanis.net/lemmings/files/rips/disks/amiga_lemmings_disk_rips_decrunched.7z
- Archive context and release variants: https://www.camanis.net/lemmings/lemmings.php
- DOS reference files and native decoders: https://github.com/VorticonCmdr/lemmings (local checkout in ../reference-repo). These were used for comparisons and an initial bootstrap decode. The final terrain/object atlases use the actual Amiga files, not that repository's DOS artwork.
- DOS MAIN.DAT layout for finding homologous original bitmap/mask records: https://www.camanis.net/lemmings/files/docs/lemmings_main_dat_file_format.txt

## Integration files

Character frame mappings and anchors were re-audited against the original SPS 0132 Code sprite and transparency records on 2026-09-30. See `SPRITE-AUDIT.md` and `scripts/map-sprites.py` for exact source offsets and reproducibility. The supplied Megasis sheet is unchanged; four damaged rip frames were recovered from the original binary. Both game routes share the corrected atlas.

`levels.json` contains 120 single-player campaign slots reconstructed from the original Amiga level records. The original game has 80 unique single-player layouts reused with changed skill settings, plus a separate 20-level two-player set which this single-player browser game does not include. The levels use the native 1600×160 world. Five Amiga special-graphics variants remain to be independently matched to their original special screens. Skills use the exact original order: Climber, Floater, Bomber, Blocker, Builder, Basher, Miner, Digger. `required` is a count, not a percentage. `camera` is the original initial horizontal scroll coordinate. Source record filenames are physical storage names and do not identify rating/order.

| Fun | Name | Original source file | Total | Required | Rate | Minutes | Skills |
|---|---|---|---:|---:|---:|---:|---|
| 1 | Just dig! | Level018-2.lvl | 10 | 1 | 50 | 5 | 10 Diggers |
| 2 | Only floaters can survive this | Level019-2.lvl | 10 | 1 | 50 | 5 | 10 Floaters |
| 3 | Tailor-made for blockers | Level019-3.lvl | 50 | 5 | 50 | 5 | 10 Blockers |
| 4 | Now use miners and climbers | Level018-3.lvl | 10 | 10 | 1 | 5 | 10 Climbers, 1 Miner |
| 5 | You need bashers this time | Level018-4.lvl | 50 | 5 | 50 | 5 | 50 Bashers |

First three raw 2048-byte Amiga records are byte-identical to corresponding DOS records. Fun 4 differs in 50 bytes, affecting terrain and object positions. Fun 5 differs in 34 bytes in its object section. The Amiga source positions were retained. Detailed comparison is included in each level's `dosComparison`.

`atlas.json` describes `style-0.png` to `style-4.png`, respectively Dirt, Fire, Marble, Pillar, Crystal. `terrain` entries contain `{id,x,y,w,h}`. `objects` entries contain `frames`, exact trigger metadata, animation first/preview frame, loop flag and source sound id. Placement flags mean vertical flip, behind existing terrain, erase pixels, or object clipped to existing terrain. The composition order in `levels.json` is the original order and matters. Transparent black pixels must be decided by PNG alpha, not RGB.

The original Amiga palette colour 0 is dark navy (#000033). Terrain uses eight per-style colours; object pixels use the 16-colour in-level palette. The 4-bit Amiga palette components were expanded to 8 bits by multiplying by 17.

Original trigger effects are 1=exit, 4=trap, 5=water, 6=fire, 7=one-way-left, 8=one-way-right. Object id 1 is the entrance. Object metadata coordinates are relative to object placement; x and dimensions are stored in four-pixel units. The exported trigger top uses the documented foot-coordinate convention `topUnits*4-4`. Effect 11 remains marked `unknown-special`; it is an extra small six-frame Amiga object not used by these five original levels. Do not assign it an invented gameplay effect.

All 273 original Amiga terrain masks were compared pixel by pixel with the DOS masks: all shapes/alpha pixels match. Actual Amiga palette values were retained, so this does not imply that VGA colours were copied. The original Amiga object metadata was decoded independently, including an extra object in each set and the Crystal exit's distinct trigger offset.

`fun-1-preview.png` ... `fun-5-preview.png` are separately baked original Amiga terrain references for renderer QA. They have transparent background and contain terrain only; entrance, exit, decorations, hazards, and lemmings must be drawn as separate layers. They must not replace the editable terrain-piece renderer.

## Exact Amiga destruction masks and additional sprites

`masks.json` uses 1 for a removed pixel. Every Bash/Mine/Explosion mask is now from the decrunched Amiga `0132/1/Code` binary. Dimensions are native pixels. Its `rows` are binary strings and `frames` are flat 0/1 arrays.

| Name | Code byte offset | Frames | Native size |
|---|---:|---:|---|
| bash-right | 0x13cec | 4 | 16×10 |
| bash-left | 0x13d8c | 4 | 16×10 |
| mine-right | 0x13e2c | 2 | 16×13 |
| mine-left | 0x13e94 | 2 | 16×13 |
| explode | 0x141c2 | 1 | 16×22 |

Amiga Bash/Mine records store inverted 32-bit AND masks. The low 16 bits of each row give the native 16-pixel action mask. All Mine frames and Bash frames 1–3 in both directions match the DOS masks byte for byte after inversion; the first Bash frame has original Amiga differences, retained here. The original Amiga explosion mask also differs from DOS in one pixel in its penultimate row (Amiga 0x1ff8, DOS 0x1ff0). The countdown font remains explicitly labelled DOS MAIN.DAT, because its original Amiga Code offset has not been identified.

`extra-sprites.png` with `extra-sprites.json` contains genuine Amiga bitmap records: jump-right 16×10 (Code 0xcd26), jump-left 16×10 (Code 0xcf42), explosion 32×32 (Code 0xe15e). All three raw bitmap records match the homologous DOS records byte for byte. They are coloured with the actual Amiga in-level palette; palette index 0 is transparent. Exported anchors follow the documented classic foot-coordinate convention; their placement still needs gameplay/browser verification.

`panel1-640.png` and `panel2-640.png` are native 640×40 four-plane Amiga panel records. Their candidate palette is the last 16 words of each 112-byte Amiga style palette block. This palette selection has NOT been checked against a matching original screenshot, so these panels are optional reference material and should not be described as fully verified. `icons-original-reference.png` is the original ILBM menu atlas decoded with its own embedded CMAP. An exact original Amiga HUD font was not located during the bounded investigation; a readable custom bitmap/monospace font is preferable to calling an unverified font original.

## Optional original-style audio already available

The reference repository has ready browser files in `../reference-repo/upgrade/lemmings/sounds/*.ogg` and `music/track-NN.mp3` (with corresponding `.mod` modules). Track 01 is CanCan; 02 is Canon; 03 is Smile If You Love Lemmings; 04 Lend A Helping Hand; 05 Postcard From Lemmingland. The maintainer documents the Amiga module conversion and track naming in https://github.com/VorticonCmdr/lemmings/blob/main/docs/music-engine-naming.md . These audio files are separate conversions, not raw disk-record exports from this investigation. Event/sound mapping and pause/mute behaviour need browser verification.

## Reproducibility

The four Amiga special-level backdrops are converted from the original `special0`–`special3` ILBM files on the Lemmings disk image. Their native 960×256, 3-plane indexed artwork and eight-colour palettes are retained as PNGs; campaign `graphicSet2` values 1–4 select the corresponding backdrop. The 120-level campaign data is paired with the original Amiga records, and `two-player-levels.json` is decoded from the 20 original `Level020`–`Level024` records.

Extraction scripts are `../decode.mjs`, `../decode-amiga.py`, `../extras-amiga.py`, `../pack.py`, `../unpack7z.py`. Do not rerun `pack.py` alone after finalisation: it deliberately packs current atlases but its provisional reference-preview step was written for the bootstrap decode. Run `decode-amiga.py` afterwards to restore the independently rendered authentic Amiga reference previews. `extras-amiga.py` must run last to restore the final authentic Amiga masks.
