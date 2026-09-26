# OneLyf film — "Many Spaces, Woven Together"

The 1:1 brand film, drawn on a canvas. Each `onelyf.vX.Y.html` is one cut; the newest is the current one.

| File | What it is |
| --- | --- |
| `onelyf.vX.Y.html` | the film: brief, beat sheet, scenes, timeline, score |
| `core.js` | hand-drawn canvas core: palettes, marks, camera, timeline runtime, player |
| `assets.js` | design-system art as data URIs (emblems, Liv glyph, hyphae), so the canvas never taints |
| `liv-vo-2.js` | the second voice-over script (v4.8+): opens on the OneLyf thesis, three passages kept whole |
| `liv-vo.js` | Liv's voice-over (ElevenLabs "Mother" voice, one take) as a data URI, with where each line sits in the take; the score places the lines (v4.7+) |
| `fonts/` | Fraunces (SIL Open Font License), served locally so renders don't depend on Google Fonts |
| `render-pw.mjs` | renders every drawn frame and builds a silent mp4 (needs Playwright, Chrome, ffmpeg) |
| `render-wav.mjs` | renders the score to `score.wav` |
| `renders/` | finished cuts with sound |

Open an html file in a browser to scrub and play it (press "sound: on" before play for the score).

## Render

```sh
# PLAYWRIGHT: path to playwright(-core)'s index.mjs, or a package name. CHROME: the browser binary.
PLAYWRIGHT=/path/to/playwright-core/index.mjs CHROME=/path/to/chrome node render-pw.mjs onelyf.v3.4.html
PLAYWRIGHT=... CHROME=... node render-wav.mjs onelyf.v3.4.html
ffmpeg -i out/onelyf.v3.4.mp4 -i score.wav -c:v copy -c:a aac -b:a 192k -shortest renders/onelyf-film-v3.4.mp4
```

`node render-pw.mjs onelyf.v3.4.html --grid 24` writes a labelled contact sheet instead of the full render.
