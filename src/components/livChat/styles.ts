// ─── LivChat inline styles (token-driven) ─────────────────────────────────────
// Moved verbatim out of LivChat.tsx's render body (W3 legibility refactor). Built per render
// from the hat accent exactly as before; passed down to the sub-components as `S`.
import type { CSSProperties } from 'react'
import { radius, space, textStyle } from '../../tokens'
import { cssVar } from '../../theme'

// ── styles (inline, token-driven) ──
export function livChatStyles(accent: string) {
  return {
    // The chat is a FLEX COLUMN: header (fixed) + body (flex, holds the scrolling transcript) +
    // composer (fixed). `overflow: hidden` + `max-height: 100%` mean that when a parent constrains
    // the height (the Tummyful dock, or the viewport shrinking as the mobile keyboard opens) the
    // TRANSCRIPT shrinks and scrolls — the header (Minimize/Close) and composer stay framed, instead
    // of the whole card scrolling as one block (which hid the header until you scrolled up, and
    // pushed the composer off-screen). With no parent height (inline) it sizes to content as before.
    card: { background: cssVar.surface, border: `1px solid ${cssVar.border}`, borderRadius: radius.lg, padding: space.md, boxSizing: 'border-box', maxWidth: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: '100%', overflow: 'hidden' } as CSSProperties,
    head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flex: '0 0 auto' } as CSSProperties,
    muted: { ...textStyle('caption'), color: cssVar.mid } as CSSProperties,
    // Body is a single-column stack now — the sessions rail is a slide-in drawer over
    // the transcript (Tummyful canon), not a permanent left column. `position: relative`
    // is what the drawer + scrim (both `position: absolute`) anchor to.
    body: { position: 'relative', marginTop: space.md, flex: '1 1 auto', minHeight: 0 } as CSSProperties,
    rail: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } as CSSProperties,
    sessionRow: { display: 'flex', alignItems: 'center', gap: 4, borderRadius: radius.sm, padding: 2 } as CSSProperties,
    sessionOpen: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, background: 'transparent', border: 0, cursor: 'pointer', color: cssVar.ink, padding: '6px 8px', borderRadius: radius.sm } as CSSProperties,
    sessionTitle: { ...textStyle('bodySm'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as CSSProperties,
    iconbtn: { background: 'transparent', border: 0, color: cssVar.mid, cursor: 'pointer', borderRadius: radius.sm, padding: '4px 6px', display: 'inline-flex', alignItems: 'center', lineHeight: 0 } as CSSProperties,
    // Composer-specific icon buttons: outlined circles with an opaque surface backing —
    // matches Tummyful's `.composer-icon` canon (Jeff 2026-08-09: pill backing, not just
    // glow). Used for attach / actions / speaker / mic; distinct from the base `iconbtn`
    // above which powers rail/header/copy micro-buttons where a flat treatment is right.
    composerIconbtn: {
      background: cssVar.surface, border: `1px solid ${cssVar.borderBright}`, color: cssVar.ink,
      cursor: 'pointer', borderRadius: radius.pill, width: 32, height: 32, padding: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0,
      flex: '0 0 auto',
    } as CSSProperties,
    main: { display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, height: '100%' } as CSSProperties,
    // flex-basis auto + min-height 0: sizes to content when inline (capped at 460), but shrinks and
    // scrolls when the column is height-constrained (dock / keyboard) so the composer stays visible.
    // Negative left/right margin cancels the root card's own padding so the transcript alone bleeds
    // to the card's edge (clipped clean by the card's overflow:hidden + border-radius) while header
    // and composer keep their normal inset — reads full width instead of boxed inside the card frame.
    transcript: { flex: '1 1 auto', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: space.sm, padding: space.xs, marginLeft: -space.md, marginRight: -space.md, minHeight: 0, maxHeight: 460 } as CSSProperties,
    input: { ...textStyle('body'), width: '100%', boxSizing: 'border-box', color: cssVar.ink, background: cssVar.bg, border: `1px solid ${cssVar.border}`, borderRadius: radius.md, padding: '9px 12px' } as CSSProperties,
    primaryBtn: { ...textStyle('label'), background: accent, color: cssVar.onPrimary, border: 0, borderRadius: radius.md, padding: '9px 14px', cursor: 'pointer' } as CSSProperties,
    ghostBtn: { ...textStyle('label'), background: 'transparent', color: cssVar.ink, border: `1px solid ${cssVar.border}`, borderRadius: radius.md, padding: '7px 10px', cursor: 'pointer' } as CSSProperties,
  }
}
export type LivChatStyles = ReturnType<typeof livChatStyles>

export function bubbleStyle(role: string): CSSProperties {
  const liv = role === 'liv'
  return {
    maxWidth: '86%', alignSelf: liv ? 'flex-start' : 'flex-end',
    borderRadius: radius.md, padding: '8px 12px', border: `1px solid ${cssVar.border}`,
    background: liv ? cssVar.surface : 'color-mix(in srgb, var(--lc-accent) 12%, ' + cssVar.surface + ')',
  }
}
