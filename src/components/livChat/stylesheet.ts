// ─── livChatStylesheet ─────────────────────────────────────────────────────────
// Moved verbatim out of LivChat.tsx (W3 legibility refactor); re-exported from there.
import { radius, space } from '../../tokens'

// Max width of the desktop reading column (composer width; see the >620px block below).
const LC_COLUMN_MAX = 720

// Interaction/animation CSS that inline styles can't express. Apps inject this
// once (alongside themeStylesheet + componentStylesheet), same pattern as the
// rest of the design system.
export const livChatStylesheet = `
/* Low-specificity fallbacks for the DS color tokens LivChat reads via var(--ds-*). A consumer
   that also injects themeStylesheet will override these (higher specificity in :root); a
   consumer that DOESN'T (e.g. an app with its own palette that only wants the LivChat
   structure) still gets opaque popover backgrounds instead of transparent see-throughs.
   Dark values by default; the @media block below re-applies light values when the user's
   OS prefers light AND the consumer didn't force a data-theme. */
:where(.lc-root) {
  --ds-bg: #171b16;
  --ds-surface: #20251f;
  --ds-surface-hi: #262c24;
  --ds-track: #2c322a;
  --ds-border: rgba(232,228,214,0.10);
  --ds-border-bright: rgba(232,228,214,0.22);
  --ds-shadow-card: 0 1px 2px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.45);
}
@media (prefers-color-scheme: light) {
  :where(:root:not([data-theme="dark"]) .lc-root) {
    --ds-bg: #f4efe1;
    --ds-surface: #fffdf7;
    --ds-surface-hi: #fffefb;
    --ds-track: #ece4d0;
    --ds-border: rgba(31,90,60,0.14);
    --ds-border-bright: rgba(31,90,60,0.28);
    --ds-shadow-card: 0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.10);
  }
}
.lc-caret { animation: lc-blink 1s step-end infinite; }
@keyframes lc-blink { 50% { opacity: 0; } }
.lc-tool { animation: lc-fade-in .18s ease; }
@keyframes lc-fade-in { from { opacity: 0; } to { opacity: 1; } }
.lc-card { animation: lc-fade-in .2s ease; }
.lc-actions-menu { animation: lc-fade-in .12s ease; }
.lc-actions-item:hover:not(:disabled) { background: var(--ds-track); }
.lc-ellipsis { animation: lc-pulse 1.2s ease-in-out infinite; }
@keyframes lc-pulse { 50% { opacity: .3; } }
.lc-session:hover { background: var(--ds-surface-hi); }
.lc-session[data-active="true"] { background: color-mix(in srgb, var(--lc-accent) 14%, transparent); }
.lc-iconbtn:hover:not(:disabled) { background: var(--ds-track); }
.lc-option { transition: border-color .12s ease, background .12s ease; }
.lc-option:hover:not(:disabled) { border-color: var(--lc-accent); background: var(--ds-surface-hi); }
.lc-option { animation: lc-fade-in .18s ease; }
.lc-copy { opacity: 0; transition: opacity .12s ease; }
.lc-bubble:hover .lc-copy, .lc-copy:focus-visible { opacity: 1; }
/* Sessions rail is an expandable left SIDEBAR (Tummyful canon — Jeff 2026-08-09:
   "I wanted the History menu as it was before as an expandable sidebar menu off to
   the left not something that blankets the whole chat window"). Closed by default;
   the History (N) pill in the header opens it. When open, the transcript column
   shifts right — the sidebar sits ALONGSIDE the transcript, not over it. No scrim,
   no blanket. On the narrowest viewports the sidebar takes most of the width
   because the transcript would be too narrow otherwise. */
/* grid-template-rows: minmax(0, 1fr) makes the sole grid row fill the flex-1 body height
   (min 0 so it can shrink). Without it the row is auto (child min-content), and the
   rail collapses to 0 because its own overflow-y:auto reports 0 min-content. */
.lc-body { display: grid; grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr); gap: 0; transition: grid-template-columns .18s ease; }
.lc-body[data-rail-open="true"] { grid-template-columns: minmax(200px, 260px) 1fr; gap: 12px; min-height: 0; }
.lc-rail {
  overflow-y: auto;
  background: var(--ds-surface); border: 1px solid var(--ds-border-bright);
  border-radius: ${radius.md}px; padding: 10px;
  box-shadow: var(--ds-shadow-card);
  animation: lc-fade-in .14s ease;
  min-width: 0;
  height: 100%;
}
@media (max-width: 620px) {
  .lc-body[data-rail-open="true"] { grid-template-columns: 1fr; }
  .lc-body[data-rail-open="true"] .lc-main { display: none; }
  .lc-body[data-rail-open="true"] .lc-rail { max-height: 100%; overflow-y: auto; }
}
/* Desktop reading column. .lc-main is a flex item of the row-flex .lc-split with no flex-grow, so
   on a wide card it shrank to its content's width and the chat filled ~1/3 of the card (hugging the
   left edge). Above the phone breakpoint it now fills the split, and the transcript content + the
   composer share one centered, readable column (composer <= 720px; the transcript's bubbles keep
   their existing 12px bleed past the composer on each side, as on narrow cards). The transcript
   itself stays full width so its scrollbar sits at the card edge; only its inline padding grows.
   Percent padding resolves against .lc-main's width W: padding = xs + max(0, (W - 720px) / 2).
   The artifact split's inline flex-basis still wins over the flex-grow here. Scoped to >620px so
   phone layouts are untouched. */
@media (min-width: 621px) {
  .lc-main { flex: 1 1 auto; }
  .lc-main > .lc-transcript {
    padding-left: max(${space.xs}px, calc(50% - ${LC_COLUMN_MAX / 2}px + ${space.xs}px)) !important;
    padding-right: max(${space.xs}px, calc(50% - ${LC_COLUMN_MAX / 2}px + ${space.xs}px)) !important;
  }
  .lc-composer { width: 100%; max-width: ${LC_COLUMN_MAX}px; margin-left: auto; margin-right: auto; box-sizing: border-box; }
}
/* Full-screen (maximize) dock state. position:fixed + inset:0 lift the card out of any host /
   LivDock box to cover the viewport — no host change needed. The z-index sits above the composer's
   own popovers (Brain / actions use 30–31). border-radius:0 + max-height are also set inline on the
   root/transcript (an inline style a plain stylesheet selector can't override), so this rule's role
   is the positioning escape; the inline overrides handle the size/corner clamp. 100dvh (not 100vh)
   so mobile Safari's collapsing address bar doesn't clip the bottom composer — same fix as citadel
   PR #140 (WaveRider). Safe-area padding for the header/composer against the physical screen edge
   lives on the inline overrides below, for the same reason max-height does. */
.lc-root[data-dock="full"] { position: fixed; inset: 0; width: auto; max-width: 100%; max-height: 100dvh; border-radius: 0; z-index: 60; }
.lc-root[data-dock="full"] .lc-transcript { max-height: none; }
/* Artifacts panel (livchat-artifacts-system) — a draggable vertical split inside the same grid
   cell .lc-main used to fill alone; .lc-main and .lc-artifact-panel's flex-basis percentages are
   set inline (the live drag value), this stylesheet only handles the divider's own look/feel and
   the narrow-viewport fallback below. */
.lc-artifact-divider {
  width: 6px; flex: 0 0 auto; cursor: col-resize; background: transparent;
  position: relative; touch-action: none;
}
.lc-artifact-divider::after {
  content: ''; position: absolute; inset: 0 2px; border-radius: 2px; background: var(--ds-border-bright);
  transition: background .12s ease;
}
.lc-artifact-divider:hover::after, .lc-artifact-divider:active::after { background: var(--lc-accent); }
.lc-artifact-panel { animation: lc-fade-in .14s ease; }
.lc-artifact-panel pre { animation: none; }
/* Mobile overflow guard: a side-by-side 45/55 split has no room to breathe under ~620px (each
   pane would land under 180px). Stack instead — chat on top, artifact below, drag disabled (a
   fiddly touch-drag on a phone-width divider isn't worth shipping over a plain 50/50 stack). The
   !important pair overrides the live drag value that JS sets inline at wider viewports. */
@media (max-width: 620px) {
  .lc-split[data-artifact-open="true"] { flex-direction: column; }
  .lc-split[data-artifact-open="true"] .lc-main,
  .lc-split[data-artifact-open="true"] .lc-artifact-panel { flex: 1 1 50% !important; min-height: 160px; min-width: 0; }
  .lc-split[data-artifact-open="true"] .lc-artifact-divider { display: none; }
  .lc-split[data-artifact-open="true"] .lc-artifact-panel { border-left: 0; border-top: 1px solid var(--ds-border); }
}
/* ── Liquid Glass ─────────────────────────────────────────────────────────────────────────
   iOS-26-style translucent frosted material for every popover/sheet/menu that renders ABOVE the
   chat transcript (Brain sheet, actions menu, slash menu, transcript viewer, link-guard modal —
   the app's own side panel + Chat/Builder dropdown apply this same class at the app level).
   !important on background/backdrop-filter because these elements also set an opaque
   background: cssVar.surface inline (kept as a graceful fallback for the rare browser with no
   backdrop-filter support at all — the !important here only wins where the property IS
   supported, per the @supports guard). */
.lc-glass {
  border: 1px solid var(--ds-border-bright);
}
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .lc-glass {
    background: color-mix(in srgb, var(--ds-surface) 72%, transparent) !important;
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
  }
}
/* ── Brain bottom sheet ───────────────────────────────────────────────────────────────────── */
.lc-sheet-scrim { animation: lc-fade-in .16s ease; }
.lc-brain-sheet { animation: lc-sheet-up .22s cubic-bezier(0.2, 0.8, 0.2, 1); }
@keyframes lc-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
/* The visible bar stays 36x4 (canon size); the element's own box is padded taller so the
   drag/tap target is comfortably touchable without changing how the handle looks. */
.lc-sheet-handle {
  width: 100%; height: 20px; margin: 0 0 -8px; flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center;
}
.lc-sheet-handle::before {
  content: ''; width: 36px; height: 4px; border-radius: 2px; background: var(--ds-border-bright);
}
@media (prefers-reduced-motion: reduce) {
  .lc-sheet-scrim, .lc-brain-sheet { animation: none; }
}
/* ── Animated Liv-state glyph (idle / thinking / running-a-workflow) ─────────────────────────
   The SAME canonical mark (never a new one), motion-only. Idle breathes slowly; thinking
   pulses faster; running-a-workflow adds a steady rotation, reading as active work in
   progress. Respects prefers-reduced-motion (a static glyph is always a safe fallback). */
.lc-glyph-idle { animation: lc-glyph-breathe 3s ease-in-out infinite; }
.lc-glyph-thinking { animation: lc-glyph-breathe 1.1s ease-in-out infinite; }
.lc-glyph-running { animation: lc-glyph-spin 2.2s linear infinite; }
@keyframes lc-glyph-breathe { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .72; transform: scale(0.94); } }
@keyframes lc-glyph-spin { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(18deg); } }
@media (prefers-reduced-motion: reduce) {
  .lc-glyph-idle, .lc-glyph-thinking, .lc-glyph-running { animation: none; }
}
/* 'Thinking'/'Working' status label (pairs with the run-time counter next to it) — same pulse
   technique as the existing .lc-ellipsis caret dots. */
.lc-thinking-label { animation: lc-pulse 1.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .lc-thinking-label { animation: none; }
}
/* ── iOS auto-zoom fix ────────────────────────────────────────────────────────────────────
   Safari zooms the whole viewport on focusing any input/textarea/select under 16px. LivChat's
   body-text scale is 15px (tokens.ts), so every composer/Brain-sheet field was tripping it.
   !important because these all also carry an inline font-size from textStyle('body') (15px) —
   the style-attribute/stylesheet precedence rule means only an !important stylesheet rule can
   win over that. Scoped to .lc-root so it can't leak into an app's own unrelated inputs. */
.lc-root input, .lc-root textarea, .lc-root select { font-size: 16px !important; }
/* ── Read-aloud highlight-follow (accessibility) ─────────────────────────────────────────── */
.lc-tts-highlight { background: color-mix(in srgb, var(--lc-accent) 35%, transparent); color: inherit; border-radius: 3px; padding: 0 1px; }
`
