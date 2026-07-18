// ─── OneLyf Design System — component stylesheet ────────────────────────────
// The token files carry colours/scales; this carries the INTERACTION states
// that inline styles can't express: :hover, :focus-visible, :disabled. Apps
// inject it ONCE (next to `themeStylesheet`) and the primitives opt in via a
// `ds-*` class. Keeping it here means "obvious focus + hover, everywhere" is a
// one-line adoption, not a per-app re-implementation.
//
//   import { themeStylesheet, componentStylesheet } from '@onelyf/design-system'
//   <style>{themeStylesheet + '\n' + componentStylesheet}</style>
//
// Focus rings read off --ds-primary so they follow the active theme, and use
// :focus-visible (not :focus) so keyboard users get the ring without it firing
// on every mouse click.

const VAR = '--ds-'

export const componentStylesheet = `
/* Shared, obvious keyboard focus ring — one treatment for every control. */
.ds-focusable:focus-visible,
.ds-btn:focus-visible,
.ds-input:focus-visible,
.ds-card-interactive:focus-visible {
  outline: 2px solid var(${VAR}primary);
  outline-offset: 2px;
}
.ds-btn, .ds-input, .ds-card-interactive { outline: none; }

/* Buttons — lift on hover, settle on press, dim + no-lift when disabled. */
.ds-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.03); }
.ds-btn:active:not(:disabled) { transform: translateY(0); filter: brightness(0.98); }
.ds-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; transform: none; }

/* Ghost/secondary buttons get a faint fill on hover rather than a lift only. */
.ds-btn--ghost:hover:not(:disabled) { background: var(${VAR}surface-hi); }

/* Inputs — border brightens on hover, a soft ring joins the outline on focus. */
.ds-input:hover:not(:disabled):not([aria-invalid="true"]) { border-color: var(${VAR}border-bright); }
.ds-input:focus-visible { border-color: var(${VAR}primary); }
.ds-input:disabled { opacity: 0.55; cursor: not-allowed; }
.ds-input[aria-invalid="true"] { border-color: var(${VAR}danger); }
.ds-input[aria-invalid="true"]:focus-visible { outline-color: var(${VAR}danger); }
.ds-input::placeholder { color: var(${VAR}dim); }

/* Interactive cards (whole card is a link/button) — gentle lift. */
.ds-card-interactive { cursor: pointer; transition: transform .18s cubic-bezier(0.4,0,0.2,1), box-shadow .18s cubic-bezier(0.4,0,0.2,1); }
.ds-card-interactive:hover { transform: translateY(-2px); box-shadow: var(${VAR}shadow-soft); }

/* Indeterminate spinner keyframes (Spinner primitive). */
@keyframes ds-spin { to { transform: rotate(360deg); } }
/* Skeleton shimmer (Skeleton primitive). */
@keyframes ds-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

@media (prefers-reduced-motion: reduce) {
  .ds-btn, .ds-card-interactive { transition: none !important; }
  .ds-btn:hover:not(:disabled), .ds-card-interactive:hover { transform: none; }
  .ds-spinner { animation-duration: 1.4s !important; }
  .ds-skeleton { animation: none !important; }
}
`.trim()

export default componentStylesheet
