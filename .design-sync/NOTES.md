# design-sync notes — onelyf-design-system

- **Shape: package** (no Storybook). Component list comes from `src/index.ts` PascalCase exports; props extracted from `src/*.tsx` via ts-morph using `tsconfig.app.json`.
- **Build**: `npm run build` (`tsc -b && vite build`, Vite *library* build) emits a single ES bundle `dist/onelyf-design-system.js`. No `.d.ts` is emitted (no dts plugin) and no `index.es.js` — pass `--entry ./dist/onelyf-design-system.js` to the converter.
- **Node >=22** (`engines.node`); no `.nvmrc`. Built clean on Node 22.22.2.
- **Self-styling / inline-style DS**: components style themselves via inline `style` props driven by `src/tokens.ts` (e.g. `buttonStyle()`); there are NO `.css` files. Expect `[CSS_RUNTIME]` from validate — non-blocking, the bundle is self-styling. Do NOT set `cfg.cssEntry`.
- The hand-authored `ds/*.html` pages are the author's own preview pages and are NOT used by the converter — it generates its own previews.
- Components (5): Glyph, Button, Card, JunctionCard, SpaceNode. `buttonStyle` is a helper export, not a component (should not appear as a card).
- claude.ai/design project: "OneLyf Design System" — id `e34c055d-60e7-4c8e-8654-b2aa9a842887`.
