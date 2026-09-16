# Method

The parts of this that are not about SVG. Lifted from the practice in
`hand-drawn-canvas-animation` and adapted to still work.

## 1. The loop is the skill

The failure mode this exists to kill: writing drawing code, reasoning about
what it probably looks like, and shipping it. That produces confident,
plausible, wrong artwork, and the only thing catching it is the human on the
other end, who then becomes the render loop. That is expensive and slow.

So: **build, look, judge, change one thing, repeat.** A pass that does not
include opening the picture is not a pass.

```bash
node scripts/build.mjs mymark.js                    # -> out/*.svg + out/*-sheet.html
node scripts/serve.mjs out --port 8933 &            # background it
# open http://127.0.0.1:8933/mymark-sheet.html with the browser tools, screenshot, read it
```

The serve step exists only because the browser tooling refuses `file://` URLs.
Nothing about the deliverable needs a server.

## 2. The sheet answers four questions at once

Each card shows one variant four ways, and each view kills a different class of
bad mark:

| view | question | what it catches |
|---|---|---|
| large | is it any good | proportion, balance, whether the idea works |
| light / dark rows | does it survive both grounds | ink-on-dark invisibility, washed-out tints |
| 128→16 px row | does it survive a favicon | mush, merging strokes, detail that dies |
| silhouette | does the shape read without colour | marks propped up entirely by colour |

The silhouette is the harshest and the most useful. If the black shape is
ambiguous, the mark is not finished, no matter how good the coloured version
looks.

## 3. Explore structurally, then narrow

First pass: 4–8 variants that differ in *construction* — different silhouettes,
different organising idea. Four colourways of one shape is not an exploration,
it is a decision already made.

Second pass: cut to one or two, then change one parameter at a time. Because
every random source is seeded, a change you make is the only thing that moves
between builds — which is what makes iteration converge rather than wander.
This is why `Math.random` is banned: with it, every rebuild reshuffles the
texture and you cannot tell your change from the noise.

## 4. Seeds are the iteration handle

```js
seedShape(21)   // same shape, every build, forever
seedShape(22)   // a different shape from the same rules
```

To explore silhouettes, sweep the seed. To refine one, hold the seed and move a
parameter. Never both at once.

## 5. Contrast is a number

`contrast(a, b)` returns the WCAG ratio. Use it instead of judging by eye —
gold on cream measures 2.65:1, which looks fine at 200 px and fails completely
at 16 px or for anyone with low vision. `goldDeep` is 4.72:1 and is the
text-safe cut. The DS tokens already encode this; the point is to check rather
than assume.

## 6. When the sheet looks wrong

- **Blank card** → the mark used ink on dark ground. Swap for chalk.
- **Mush at 16 px** → the small cut needs to be a different, simpler drawing,
  not the same one scaled. Fewer parts, heavier stroke, drop the fine detail.
- **All variants look alike** → you explored colour, not structure. Go back.
- **Looks flat** → no value structure. Pull 2–3 adjacent steps off `ramp()`.
- **Looks like clipart** → no texture and no line quality. Add a finish
  (`hatchDef`/`dotsDef`/`grainDef`) and replace straight paths with `wobPath`.
- **Looks noisy** → too many finishes. One finish per mark.

## 7. What did NOT come across from the animation skill

Deliberately dropped, because none of it applies to a still image: the timeline
and scene system, the camera, the on-twos frame cadence, the Web Audio score,
and the reveal devices (blot, iris, mosaic, montage). If the ask is motion, use
`hand-drawn-canvas-animation` instead — it is a different pipeline that outputs
mp4 from Canvas 2D, and it is the right tool for that job.
