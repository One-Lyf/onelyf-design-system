# Branch emblems + OneLyf mark (generator)

```
python3 scripts/emblems/build.py
```

Writes `src/assets/emblems/<branch>.svg` (7) and `src/assets/onelyf-{mark-light,mark-dark,app-icon}.svg`.

- `weave.py`: bands as polylines; every crossing is found and assigned alternating over/under, so the woven look comes from geometry, not hand-placed gaps. Paths are simplified (RDP) to 3 decimals.
- `patchweave.py`: renders those bands as embroidery: satin stitches (a dash pattern across the band), an edge thread, a stitched border ring and a twill ground.
- `lyf_emblems.py`, `lyf_emblems2.py`, `set_patch.py`: each branch's shapes. `SET2` in `set_patch.py` is the ring, clockwise from the top. Its accents must match `src/tokens.ts`, and `src/emblems.test.ts` checks that they do.
- `final_mark.py`: the live Liv glyph (`src/assets/glyph-live.svg`, lightened on night grounds) at the centre. Tapered, seeded mycelium hyphae run Liv→branch, branch↔branch, plus faint chords.

Copy: always Title Case. Tagline: `Many Spaces, Woven Together`.
