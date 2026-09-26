# Handoff: the woven OneLyf mark and icon

**For:** the onelyf.net session (website and design).
**From:** the film session, 2026-09-26. The source is on `One-Lyf/onelyf-design-system` `main`
(merged in PR #121).

## The ask

The tagline is **Many Spaces, Woven Together**. The canonical OneLyf logo and app icon should carry the
same woven-fabric (embroidery) look as the brand film's woven cut (v4.8), not the flat vector hyphae
they use today. The branch emblems are already woven, stitched patches. The rest of the mark (Liv's
glyph, the hyphae between the branches, and the ground) still needs to be made to match them.

## Ownership: build it in the design system, then consume it

The logo, icon and emblems are **canon, and they live in this repo**. The site should not draw its own.

1. **Design system:** extend the generator (`scripts/emblems/`) so it writes the woven variants into
   `src/assets/`, and export them through `MARK_URLS` / `<OneLyfMark>` like the current ones.
2. **Website:** bump the design-system dependency and swap the favicon, app icons and OG image to the new
   exports. No hand-copied SVGs.

If the website session makes step 1 itself, it should open a PR against this repo rather than
committing the art into the site.

## What exists today (the flat canon)

| Asset | Path | Notes |
| --- | --- | --- |
| Mark, light ground | `src/assets/onelyf-mark-light.svg` | 512×512, about 173 KB: the live glyph at the centre, the 7 emblem patches, tapered flat hyphae |
| Mark, dark ground | `src/assets/onelyf-mark-dark.svg` | same, on `#171b16` |
| App icon | `src/assets/onelyf-app-icon.svg` | 512×512, night ground |
| Branch emblems (already woven) | `src/assets/emblems/{finlyf,homlyf,hlthlyf,gudlyf,wrklyf,skoollyf,waves}.svg` | satin bands, edge thread, stitched border, twill ground |
| Liv glyph, all states | `src/assets/glyph-{crest,live,essence,rooted}.svg` (+ `.png`) | crest = OneLyf (dormant), live = Liv (lit) |
| Component and URLs | `src/components/SpaceEmblem.tsx` (`OneLyfMark`, `MARK_URLS`, `EMBLEM_URLS`, `ONELYF_TAGLINE`), exported from `src/index.ts` | |
| Generator | `scripts/emblems/build.py` → `final_mark.py` (the mark), `patchweave.py` (embroidery for the patches), `weave.py` (over/under geometry), `set_patch.py` (`SET2`: ring order and accents) | `python3 scripts/emblems/build.py` |
| Tests | `src/emblems.test.ts` | keeps the emblem accents in step with `src/tokens.ts` |
| Brand rules | `docs/brand-system.md`, `src/tokens.ts` | tokens are canon; Title Case copy |
| Mark-drawing skill | `.claude/skills/brand-mark/` | SVG from code, linted against tokens, reviewed on a light/dark/favicon/silhouette sheet |

## The woven reference (what "woven" means here)

All of this is in `film/`. The film draws on a canvas, so it's a **reference for the look**, not the
deliverable (see "Approach" below).

| What | Where |
| --- | --- |
| The woven cut (source) | `film/onelyf.v4.8-woven.html` |
| Rendered film | `film/renders/onelyf-film-v4.8-woven-vo.mp4` |
| Stills | `film/stills/woven-mark-from-film.png` (the whole mark, woven, on night linen) |
| | `film/stills/woven-lockup-final-frame.png` (mark + OneLyf + tagline, 1080²) |
| | `film/stills/woven-wordmark-tagline.png` (satin wordmark, French-knot dots, cream tagline) |
| | `film/stills/woven-glyph-roots-closeup.png` (satin glyph, stem-stitch roots, couched cord) |
| | `film/stills/woven-cord-and-patch-closeup.png` (cord couched against a patch, cord ring) |
| | `film/stills/woven-day-ground-crest.png` (light ground: cream linen, bronze satin crest, green backstitch hex) |

The techniques, by function name in `onelyf.v4.8-woven.html`:

| Element | Technique | Function |
| --- | --- | --- |
| Ground | plain-weave linen, each float shaded, per-thread tone, a few thicker patches of thread, loose fibres | `makeLinen` (`DAY_LINEN` / `NIGHT_LINEN`) |
| Any stitch | thread with a contact shadow, rounded shading lit from the top left (`LIGHT`), a twist in its strands, sheen by stitch direction | `threadSeg`, `sheenAt` |
| Liv glyph | satin laid across each strand (along the inward normal of the outline) inside a darker outline stitch | `makeSatin` |
| Hyphae | twisted two-ply gold cord, tied down with dark couching stitches | `cord` |
| Roots | stem stitch | `stemStitch` |
| Rings | running stitch | `runningRing` |
| Dots | French knots | `knot` |
| Lettering | satin fill, darker split-stitch edge | `stitchedText`, `makeStripes` |
| Thread colours | derived shades per token (dark / mid / highlight) | `GOLD`, `BRONZE`, `INK`, `GREEN`, `CREAM`, `TH(col)` |

## Assets needed

| # | Asset | Size / format | Ground | Notes |
| --- | --- | --- | --- | --- |
| 1 | Woven mark, dark | SVG, 512 viewBox | night `#171b16` linen | the hero; closest to `woven-mark-from-film.png` |
| 2 | Woven mark, light | SVG, 512 viewBox | cream `#f4efe1` linen | glyph in bronze satin with a soft gold glow under the stitches; see decision (a) |
| 3a | Woven app icon, onelyf.net | SVG + PNG 1024, 512, 192 | night linen, full-bleed | the full mandala; PWA `maskable`: keep the 7 patches inside the 80% safe zone |
| 3b | Woven app icon, Liv Console | SVG + PNG 1024, 512, 192 | night linen, full-bleed | the satin Liv glyph alone, inside the 80% safe zone |
| 4 | Apple touch icon | PNG 180 | night linen | from 3a (onelyf.net) and 3b (Liv Console) |
| 5 | Favicon | SVG + PNG 32, 16 (+ `.ico`) | transparent or night | **simplified**: at 16–32 px thread texture is noise. The Liv glyph alone (decision (b)), with no linen and no cord detail |
| 6 | Woven wordmark lockups | SVG: horizontal and stacked, light and dark | both | "OneLyf" satin in gold on dark (goldDeep on light), tagline in cream (ink on light), two knot dots between. Fraunces (vendored in `film/fonts/`); outline the text so the site doesn't need the font |
| 7 | OG / social card | PNG 1200×630 | night linen | mark on the left, lockup on the right; `woven-lockup-final-frame.png` is the 1:1 version of this |
| 8 | Flat fallback | keep today's `onelyf-mark-*.svg` | | for print, very small sizes and reduced-texture contexts |

## Approach for the SVGs

- **Extend `final_mark.py`; don't trace the film.** The film is raster, and the mark must stay vector.
- **Ground:** tile a small woven cell as an SVG `<pattern>` (warp/weft rects with gradients), plus a very
  light noise filter (`feTurbulence`) for thread-to-thread variation. Keep the linen low-contrast so the
  mark reads first.
- **Hyphae as couched cord:** the generator already has each hypha as a tapered Bézier (`tapered()`,
  `hyphae()` in `final_mark.py`).
  - Draw the cord body along it.
  - Add the twist as a dash pattern of short lit diagonals along the path; `stroke-dasharray` on a
    parallel offset path works.
  - Add the couching ties every ~14 px as short dark strokes across the cord.
- **Glyph in satin:** clip a rotated stripe `<pattern>` (a satin dash) to the glyph path from
  `glyph-live.svg`, and edge it with a darker stroke. The film lays stitches along each strand's normal;
  in SVG a single stripe angle plus 2–3 stripe patterns per region is an acceptable approximation.
- **Patches:** reuse the existing emblem SVGs unchanged. Add the gold cord ring each branch gets in the
  film (`runningRing` / `cord` around r≈90 at film scale).
- **Colours:** every thread colour must come from `src/tokens.ts`, or be a `tint`/`shade`/`mix` of a
  token via `.claude/skills/brand-mark/assets/palette.js`. The film's thread shades were derived by eye,
  so re-derive them from `gold` / `goldDeep` (light) and dark-mode `gold #d8a83c` so the lint passes.
- **File size:** today's mark SVGs are about 173 KB. Keep the woven ones at or under ~250 KB by using
  patterns and dash arrays, not a path per stitch. Export PNGs from the SVG with Playwright, which is
  already used by `film/render-pw.mjs`.

## Verify before shipping

- `brand-mark` review sheet: every variant on light and dark, at 16/32/48/180/512 px, and as a silhouette.
  The favicon must still read as Liv at 16 px.
- `npm test` (includes `src/emblems.test.ts`) and `npm run build`.
- Side-by-side with `film/stills/woven-mark-from-film.png`: same cord weight relative to the patches,
  and the glyph clearly the brightest thing.

## Guardrails (from `docs/brand-system.md`)

- Keep: heirloom-paper / field-journal / atlas warmth. Avoid: neon glow, AI gradients, SaaS gloss. Liv's
  glow stays soft, under the stitches.
- One glyph, split by state: **crest = OneLyf** (dormant, works with the AI off), **live = Liv** (lit).
- Copy is always Title Case. Tagline constant: `ONELYF_TAGLINE` = `Many Spaces, Woven Together`.

## Decisions (Jeff, 2026-09-26)

- **(a) Light-ground glyph:** the glyph in **bronze** satin (the crest's thread) **with a golden glow**.
  Under the brand rule a glow means Liv is lit, so this reads as the live state sewn in bronze; keep
  the glow soft and under the stitches.
- **(b) Favicon:** the **glyph alone**.
- **(c) App icon:** **onelyf.net** gets the **full mandala**; **Liv Console** gets the **glyph alone**.
