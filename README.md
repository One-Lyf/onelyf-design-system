# OneLyf Design System

The single brand source for **OneLyf + Liv** and the Lyf apps — design tokens, the
Root Glyph, and a small set of presentational, token-driven React components. Apps
inherit from here; they don't redefine colors or marks.

Built to be uploaded to a **Claude Design** design-system project via the
**`/design-sync`** skill, and to be the foundation Jeff refines the glyph and builds
screens against.

> Authoritative brand spec: `~/onelyf-planning/docs/onelyf-liv-brand-brief-for-gpt.md`
> (v3, "Root Glyph" baseline).

## What's here

```
src/
  tokens.ts          # colors, per-space accents, type, radius, shadow
  Glyph.tsx          # Root Glyph — crest (OneLyf) / live (Liv) / essence
  assets/            # glyph PNGs (raster placeholder; vector swaps in later)
  components/        # Button, Card, JunctionCard, SpaceNode — presentational
  index.ts           # public surface
ds/                  # preview cards for /design-sync (each starts with @dsCard)
```

## Principles

- **Presentational + token-driven only.** No app logic, no data fetching.
- **One glyph, split by state** (not symbol): static engraved **crest = OneLyf**
  (works with the AI off), warm-lit **live = Liv**.
- **Glyph is a raster placeholder.** The `Glyph` API stays stable so a delivered
  vector can swap in later without touching consumers.
- Matches the brief — don't invent colors or marks.

## Use

```ts
import { color, spaces, Glyph, Button, JunctionCard, SpaceNode } from 'onelyf-design-system'
```

## Develop

```sh
npm install
npm run build      # tsc -b && vite build (library mode)
```

## Sync to Claude Design

Run **`/design-sync`** in this folder. It reads the tokens + components and the
`ds/*.html` preview cards (each first line is a `<!-- @dsCard group="…" -->` marker)
and uploads them to a Claude Design design-system project.
