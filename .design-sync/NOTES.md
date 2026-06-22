# design-sync notes — onelyf-design-system

- **Shape: package** (no Storybook). Component list comes from `src/index.ts` PascalCase exports; props extracted from `src/*.tsx` via ts-morph using `tsconfig.app.json`.
- **Build**: `npm run build` (`tsc -b && vite build`, Vite *library* build) emits a single ES bundle `dist/onelyf-design-system.js`. No `.d.ts` is emitted (no dts plugin) and no `index.es.js` — pass `--entry ./dist/onelyf-design-system.js` to the converter.
- **Node >=22** (`engines.node`); no `.nvmrc`. Built clean on Node 22.22.2.
- **Self-styling / inline-style DS**: components style themselves via inline `style` props driven by `src/tokens.ts` (e.g. `buttonStyle()`); there are NO `.css` files. Expect `[CSS_RUNTIME]` from validate — non-blocking, the bundle is self-styling. Do NOT set `cfg.cssEntry`.
- The hand-authored `ds/*.html` pages are the author's own preview pages and are NOT used by the converter — it generates its own previews.
- Components (7): **general/** Glyph, Button, Card, JunctionCard, SpaceNode + **brand/** RootGlyphBoard, BrandIdentityBoard. `buttonStyle` is a helper export, not a component (should not appear as a card).
- **Brand reference boards** (RootGlyphBoard, BrandIdentityBoard) are `<img>` of large JPGs in `src/assets/` (~0.5 MB each). They group under **Brand** via `category: Brand` frontmatter in their sibling `src/components/<Name>.md` (which also become their `.prompt.md`). They are REFERENCE-ONLY, not UI building blocks.
- **Large JPG assets inline fine**: Vite *library* mode inlines ALL assets as base64 regardless of `assetsInlineLimit` (single-file output), so the boards carry their images in `_ds_bundle.js` (bundle ~1.46 MB). No separate asset files to upload; boards render correctly.
- The 5 original components emit `[DOCS_UNMAPPED]` — expected, they have no per-component doc; they get synthesized `.prompt.md`. Only the 2 boards have sibling docs.
- `docs/brand-system.md` ships as a guideline (matches default `guidelinesGlob` `docs/*.md`) → `guidelines/`.
- **Two config files exist**: the converter reads the ROOT `design-sync.config.json` (the one passed via `--config`). There is also a hand-added `.design-sync/config.json` (projectId/pkg/shape/entry) that the converter does NOT read — don't rely on it; keep the root config authoritative.
- claude.ai/design project: "OneLyf Design System" — id `e34c055d-60e7-4c8e-8654-b2aa9a842887`.
