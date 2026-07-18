# UI Quality — Definition of Done

The bar every Lyf-app screen ships against. Derived from the standing UI-polish
charge and the "clean, intentional, production-ready" handoff. The point of the
design system is that meeting this bar is mostly *adoption*, not per-app design
work: reach for the token/primitive and the standard is met by construction.

**Rule zero:** do not invent a new visual style and do not add decoration to
feel different. The aesthetic is the Field-Notes / heirloom brief already in
`tokens.ts`. This rubric is about *consistency and hierarchy*, not novelty.

## Adopt the system (one-time, per app)

```ts
import { themeStylesheet, componentStylesheet, initTheme } from '@onelyf/design-system'
// inject once (a <style> tag or global CSS): themeStylesheet + '\n' + componentStylesheet
// call initTheme() on boot
```

Without `componentStylesheet` the shared `:hover` / `:focus-visible` / `:disabled`
states won't apply — a screen missing it fails the focus/hover checks below.

## The checklist

### Spacing & layout
- [ ] Every gap/pad/margin comes from `space.*` — no hand-typed pixel values.
- [ ] Related elements are close; unrelated sections are separated by real
      whitespace (`space.lg`+). No weak gaps between related items; no random
      gaps between unrelated ones.
- [ ] Content has a max width and is aligned to a shared edge — nothing floats.
- [ ] One dominant primary action per view. Don't stack many buttons in one area.

### Typography
- [ ] All text uses a `type` role via `textStyle(role)` — no ad-hoc `fontSize`.
- [ ] Headings (serif `h1`–`h3`) are clearly stronger than body. Hierarchy reads
      at a glance.

### Color, shape, depth
- [ ] Colors restrained: foundation palette + at most the space accent. No new
      hexes. Status color only via `Badge` / semantic tokens.
- [ ] Radius from `radius.*`; shadow from `shadow.*` (soft, low). No harsh
      drop-shadows.

### Controls
- [ ] Buttons are `<Button>` (primary / ghost / danger). Inputs are
      `Input` / `Textarea` / `Select`, wrapped in `Field` for label + error.
- [ ] Input text is high-contrast ink (guaranteed by the primitive — never let
      an app override it toward the background).
- [ ] Focus is obvious (keyboard ring) and hover is obvious. Verify by tabbing.
- [ ] Disabled controls read as disabled (dimmed, `not-allowed`) and are
      actually non-interactive.

### Required states (every data-backed surface)
- [ ] **Empty** — `EmptyState` with a title, one calm line, and the next action.
- [ ] **Loading** — `Spinner` or `Skeleton` (skeleton for content-shaped waits).
- [ ] **Error** — `ErrorState` with a retry/recover path.
- [ ] **Disabled** — see Controls.
- [ ] **Success** — confirm meaningful actions (a `Badge tone="success"`, inline
      confirmation, or toast). Don't leave a successful action silent.

### Responsive (test at ~360px, tablet, desktop)
- [ ] No horizontal overflow; no clipped or awkwardly-wrapped text/pills.
- [ ] Buttons and inputs are full-width and comfortably tappable on mobile.
- [ ] Parent flex/grid children set `min-width: 0` so long content can shrink.

## Primitive → standard map

| Standard (handoff)              | Provided by                                  |
|---------------------------------|----------------------------------------------|
| One spacing scale               | `space`                                      |
| One typography scale            | `type` + `textStyle()`                       |
| One button system               | `Button` (primary / ghost / danger)          |
| One card system                 | `Card` (+ `interactive`)                     |
| One input system                | `Input` / `Textarea` / `Select` / `Field`    |
| Obvious focus & hover           | `componentStylesheet` (`ds-*` classes)       |
| Dominant primary action         | `Button variant="primary"` (one per view)    |
| Subtle shadows / consistent radius | `shadow` / `radius`                       |
| Restrained color                | foundation `color` + per-`spaces` accent     |
| Empty / Loading / Error / Success | `EmptyState` / `Spinner`+`Skeleton` / `ErrorState` / `Badge` |

## Process (worst-first, one screen at a time)
1. Inspect the screen. 2. Swap ad-hoc spacing/type/controls for tokens +
primitives. 3. Add the missing states. 4. Fix the worst contrast/overflow bug
first. 5. Strict polish pass: alignment, hierarchy, one primary action.
