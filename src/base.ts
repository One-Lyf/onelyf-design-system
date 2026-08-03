// ─── OneLyf Design System — base stylesheet ─────────────────────────────────
// Global, element-level polish that every Lyf app should share but that lives
// outside the class-based `componentStylesheet` (which only styles opted-in
// `ds-*` primitives). Apps inject this ONCE alongside themeStylesheet +
// componentStylesheet:
//
//   <style>{themeStylesheet + componentStylesheet + baseStylesheet}</style>
//
// Two things, both extracted as the "best of both" from Cash Stash + Tummyful:
//   1. Headings in the display serif (Fraunces) — the single biggest "this
//      feels premium" tell; both apps do it, the federation home didn't.
//   2. Tabular, lining figures — money/counts line up in columns (Cash Stash's
//      global numeric treatment).
// Plus the semantic status "wash" callouts (Tummyful's warn/danger/success/note
// system), derived with color-mix off the existing --ds-* semantic tokens so
// they stay theme-reactive with no new tokens to keep in sync.

const VAR = '--ds-'
// Kept in sync with tokens.ts `font.serif` (fonts aren't emitted as CSS vars,
// so this static string is the one place the family is repeated).
const SERIF = "'Fraunces', 'Playfair Display', Georgia, 'Times New Roman', serif"

export const baseStylesheet = `
/* Display serif on every heading — the premium tell both flagship apps share. */
h1, h2, h3, h4, .ds-serif {
  font-family: ${SERIF};
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* Tabular, lining numerals everywhere so figures align in columns. */
:root { font-variant-numeric: tabular-nums lining-nums; }
/* Opt a run of text back to proportional (e.g. body prose) if ever needed. */
.ds-pnum { font-variant-numeric: proportional-nums; }

/* Semantic status callouts. Tinted surface + accent border + readable ink, built
   from the shared semantic tokens so they follow light/dark automatically. */
.ds-wash {
  border-radius: 11px;
  padding: 10px 12px;
  border: 1px solid var(${VAR}border);
  background: var(${VAR}surface-hi);
  color: var(${VAR}ink);
}
.ds-wash--success {
  background: color-mix(in srgb, var(${VAR}success) 12%, var(${VAR}surface));
  border-color: color-mix(in srgb, var(${VAR}success) 34%, transparent);
}
.ds-wash--danger {
  background: color-mix(in srgb, var(${VAR}danger) 12%, var(${VAR}surface));
  border-color: color-mix(in srgb, var(${VAR}danger) 34%, transparent);
}
.ds-wash--warning {
  background: color-mix(in srgb, var(${VAR}warning) 14%, var(${VAR}surface));
  border-color: color-mix(in srgb, var(${VAR}warning) 36%, transparent);
}
.ds-wash--note {
  background: color-mix(in srgb, var(${VAR}primary) 10%, var(${VAR}surface));
  border-color: color-mix(in srgb, var(${VAR}primary) 30%, transparent);
}
`.trim()

export default baseStylesheet
