---
name: brand-mark
description: Draw a still brand artefact as SVG — a logo, app icon, favicon, space emblem, empty-state illustration, poster or social card — built from code on the OneLyf design tokens, then reviewed on a sheet that shows every variant on light and dark ground, at favicon sizes, and as a silhouette. Output is scalable SVG, not a raster mockup, and every colour is linted against tokens.ts. Use when the user asks for a logo, icon, mark, emblem, crest, favicon, app icon, illustration, poster, OG image, or "design me a X" for any OneLyf app or space. Not for animation (see hand-drawn-canvas-animation), charts (see dataviz), or UI component work.
---

# Brand mark

You are drawing a still artefact in code and shipping the `.svg`. The picture is
built by a plain Node module, so there is no browser in the delivery path — the
browser exists only so you can look at what you made.

**You cannot judge a mark from its source.** Every "does this read" question is
answered by building the sheet and opening it, never by reasoning about the code.
That is the whole reason this skill exists.

## Files

| path | use it for |
|---|---|
| `assets/marks.js` | the vocabulary: seeded `rng`, `wobPath`/`smoothPath` (baked hand-drawn line), `crayon`, hatch/dot patterns, grain/rough/bleed filters, `svg()` and `g()` wrappers. Import, never edit per mark. |
| `assets/palette.js` | tokens imported straight from `src/tokens.ts` (Node strips the types), plus `ramp`, `tint`/`shade`/`mix`, `contrast`, and `lint`. |
| `scripts/build.mjs` | `node build.mjs <module.js>` → writes the `.svg` files, lints each against canon, and generates the review sheet. |
| `scripts/serve.mjs` | serves a directory on `127.0.0.1` so the sheet can be opened by the browser tools, which refuse `file://`. |
| `examples/seed-mark.js` | a worked module using every part of the vocabulary. Copy this to start. |
| `references/method.md` | the review loop, the variation strategy, and what to do when the sheet looks wrong. |

## The module contract

```js
export const meta = { name: 'thing-mark', w: 512, h: 512 }
export function variants(ground) { return [{ id, label, svg }] }   // ground: 'light' | 'dark'
```

`variants` is called once per ground. **Take the argument seriously**: `color.ink`
`#1c2b21` on `colorDark.bg` `#171b16` is a 1.1:1 ratio — a mark that ignores the
ground is invisible in dark mode, and the sheet will show it as a blank card.

## Procedure

1. **Brief.** One line: what it marks, where it will sit (app icon? favicon?
   page header? printed?), and the smallest size it must survive. Ask at most
   one round of questions. Invent the rest.
2. **Folder.** One file per mark, next to `examples/`. Copy `seed-mark.js`.
3. **Explore wide, first pass.** Emit 4–8 variants that differ *structurally* —
   not four colourways of one idea. Different silhouettes, different
   constructions. Build and look:
   ```bash
   node scripts/build.mjs mymark.js
   ```
4. **Look at the sheet.** Serve it and screenshot it:
   ```bash
   node scripts/serve.mjs <outdir> --port 8933   # background it
   ```
   then open `http://127.0.0.1:8933/<name>-sheet.html` with the browser tools
   and read the image. Judge against the checklist below.
5. **Narrow, then refine.** Cut to the one or two that survive. Iterate by
   changing *one* parameter at a time — seeds are stable, so a change you make
   is the only thing that moves.
6. **Check contrast as a number**, not by eye: `contrast(fg, bg)` ≥ 4.5 for
   anything carrying meaning, ≥ 3.0 for a large mark.
7. **Deliver** the `.svg` files, the sheet, and one line per variant saying what
   it is. Say which sizes you verified.

## Non-negotiable rules

1. **SVG, scalable.** `viewBox` always; no `width`/`height` on the root.
2. **Every colour from `tokens.ts`**, or a tint/shade of one. `lint()` enforces it.
3. **Gold `#c08a14` is Liv's accent** suite-wide. The only orange in the system is
   HomLyf terracotta `#bf6b49`. Text-safe gold is `goldDeep #8a630e`.
4. **Never pure white or pure black** as a ground or a fill. Use `bg`/`surface`/`ink`.
5. **`Math.random` is banned.** Everything through `rng(seed)`, so the same brief
   produces the same mark and iteration converges instead of wandering.
6. **The small cut is a different drawing**, not the large one scaled down. Below
   ~24 px, detail is noise: fewer parts, heavier stroke.
7. **Ground-aware.** Ink becomes chalk on dark. Build both cuts.
8. **No emoji, ever.** Brand marks or text only.
9. **No text in the artwork** beyond a deliberate wordmark. Display face is
   Fraunces; body is the system sans.
10. **Prefer baked geometry to filters.** `wobPath` over `roughDef` for anything
    that will be scaled, printed, or opened in a vector editor.

## Review checklist

Read these off the sheet. Each one found is a defect:

- a card that is blank or near-blank on either ground;
- the mark vanishing on dark ground (ink not swapped for chalk);
- silhouette that does not read — if the black shape is ambiguous, colour is
  propping the mark up and it will fail on a sticker, a favicon, or an emboss;
- mush at 24 px or 16 px, or strokes that merge into a blob;
- detail that only exists at the large size (nobody will ever see it);
- two variants that look the same — the sheet is for structural choices;
- a colour `lint()` flagged, or contrast below 4.5:1 for a meaning-carrying part;
- a hard `width`/`height` on the root `<svg>`;
- filters used where geometry would do;
- a shape that reads as a generic blob rather than as the thing it marks.

## Known limits

- `lint()` catches *saturated* off-brand colour reliably. Near-neutral greys can
  pass, because the dark-mode neutrals are so desaturated that their tint lines
  run within ~2/255 of pure grey. Judge greys by eye.
- The sheet inlines each SVG several times and namespaces `<defs>` ids per copy;
  if you hand-edit a built sheet, ids will not match the source files.
- Filters (`grainDef`, `roughDef`, `bleedDef`) are rasterised by the renderer.
  They look right in a browser and may flatten differently in print or in Figma.
