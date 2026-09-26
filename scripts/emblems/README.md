# Branch emblems + OneLyf mark (generator)

```
python3 scripts/emblems/build.py
```

Writes `src/assets/emblems/<branch>.svg` (7), the flat `src/assets/onelyf-{mark-light,mark-dark,app-icon}.svg`, and the woven cut below. `build.py woven` writes only the woven cut and leaves the flat canon untouched.

## The woven cut

```
python3 scripts/emblems/build.py woven
PLAYWRIGHT=<path to playwright/index.mjs> CHROMIUM=<browser, optional> node scripts/emblems/export_png.mjs
```

`woven_mark.py` stitches the mark the way the brand film's woven cut does (film/onelyf.v4.8-woven.html): linen ground (a baked plain-weave tile with slubs and mottling), the Liv glyph in satin inside a darker split-stitch edge, hyphae as couched two-ply cord with ties every ~14 px, stem-stitch twigs, French-knot junctions and running-stitch rings round the patches. Patterns and dash arrays, not a path per stitch, keep each file under ~140 KB. Every colour is a token or a tint/shade of one (checked with the brand-mark skill's `lint`).

| File | What |
| --- | --- |
| `src/assets/onelyf-mark-woven-dark.svg` | night: the live glyph in gold, on a round night-linen patch |
| `src/assets/onelyf-mark-woven-light.svg` | day: the crest in bronze (OneLyf at rest), on cream linen |
| `src/assets/onelyf-app-icon-woven.svg` | the glyph inside one couched cord ring, full-bleed night linen, inside the maskable safe zone |
| `src/assets/onelyf-favicon.svg` | the small cut: glyph + the seven branch dots, no texture, heavier strands |
| `src/assets/icons/*.png` | `export_png.mjs`: app icon 1024/512/192, `apple-touch-icon.png` 180, favicon 48/32/16, `og-card.png` 1200x630 |

The social card sets its lettering in Fraunces from `fonts/fraunces-latin.woff2` (SIL Open Font License), inlined at export, so ship the PNG rather than the SVG source.

- `weave.py`: bands as polylines; every crossing is found and assigned alternating over/under, so the woven look comes from geometry, not hand-placed gaps. Paths are simplified (RDP) to 3 decimals.
- `patchweave.py`: renders those bands as embroidery: satin stitches (a dash pattern across the band), an edge thread, a stitched border ring and a twill ground.
- `lyf_emblems.py`, `lyf_emblems2.py`, `set_patch.py`: each branch's shapes. `SET2` in `set_patch.py` is the ring, clockwise from the top. Its accents must match `src/tokens.ts`, and `src/emblems.test.ts` checks that they do.
- `final_mark.py`: the live Liv glyph (`src/assets/glyph-live.svg`, lightened on night grounds) at the centre. Tapered, seeded mycelium hyphae run Liv→branch, branch↔branch, plus faint chords.

Copy: always Title Case. Tagline: `Many Spaces, Woven Together`.
