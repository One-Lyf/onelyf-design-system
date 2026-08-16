// ─── AppShell ───────────────────────────────────────────────────────────────
// The shared OneLyf app chrome: ONE sticky top bar (brand mark + wordmark +
// actions slot) and ONE tab bar (a fixed bottom bar on mobile, a top rail on
// wide screens). Every Lyf app wraps its screens in this so the header/nav stop
// being reinvented per app (the "vibe-coded" drift). Presentational: the app
// owns routing/state and passes `nav.activeKey` + `nav.onSelect`.
//
// Brand mark follows the brand board's "one crest, two states" (P1): the CREST
// (engraved, dormant) shows by default and swaps to the LIVE glyph (amber glow)
// only when Liv is actually on — i.e. `brand.livActive` (a provider key present
// AND Liv enabled). OneLyf is the asset; Liv is the behavior.
//
// Self-contained: injects its own stylesheet once (so it works in an app that
// injects nothing else), but it reads the DS theme vars (`--ds-*`), so the
// consuming app must still put `themeStylesheet` on the page for colours to
// resolve.
//
// The <nav> is rendered BEFORE <main> in the DOM: on mobile it's `position:
// fixed` (source order doesn't matter) and on wide screens it flows in as a
// static top rail directly under the header. The overflow "More" sheet is a
// child of the <nav> so it anchors to the bar in both states (opens up from the
// bottom bar, down from the top rail).
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { spaces, type SpaceKey } from '../tokens'
import { cssVar } from '../theme'
import Glyph from '../Glyph'

export interface AppNavItem {
  /** Stable key matched against `nav.activeKey`. */
  key: string
  label: string
  /** Optional leading icon (an svg / emoji-free node). */
  icon?: ReactNode
}

export interface AppShellBrand {
  /** App name shown next to the mark, e.g. "Cash Stash". */
  wordmark: string
  /** Life-space key → header accent (finlyf gold, homlyf terracotta, …). */
  space?: SpaceKey
  /** Liv is on (provider key present + enabled) → mark lights to the live glyph. */
  livActive?: boolean
  /** Mark width in px. */
  glyphSize?: number
  /** Tapping the brand goes home / to the primary screen. */
  onClick?: () => void
}

export interface AppShellNav {
  items: AppNavItem[]
  activeKey: string
  onSelect: (key: string) => void
  /** Items shown before collapsing the rest into "More" (default 5). */
  maxVisible?: number
}

export interface AppShellProps {
  brand: AppShellBrand
  /** Right-side header cluster (Lock, Settings, ThemeToggle, avatar, …). */
  headerActions?: ReactNode
  /** Bottom/rail navigation. Omit for chromeless single-screen apps. */
  nav?: AppShellNav
  /** Content column max width in px (default 640). */
  maxWidth?: number
  children?: ReactNode
  className?: string
}

const SHEET_ID = 'ds-appshell-stylesheet'

// Injected once. Mobile-first: nav is a fixed bottom bar; at ≥820px it becomes
// an in-flow top rail under the header and the bottom padding that kept content
// clear of the fixed bar is dropped.
const appShellCss = `
.ds-shell { display: flex; flex-direction: column; min-height: 100dvh; background: var(--ds-bg); color: var(--ds-ink); }
.ds-shell-header { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px max(14px, env(safe-area-inset-left)) 10px max(14px, env(safe-area-inset-right));
  background: color-mix(in srgb, var(--ds-bg) 88%, transparent); backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--ds-border); }
.ds-shell-brand { display: inline-flex; align-items: center; gap: 9px; background: none; border: 0; padding: 4px 6px; margin: -4px -6px;
  cursor: pointer; color: inherit; font-family: inherit; border-radius: 10px; }
.ds-shell-brand:hover { background: var(--ds-surface-hi); }
.ds-shell-brand:disabled { cursor: default; }
.ds-shell-brand:disabled:hover { background: none; }
.ds-shell-wordmark { font-weight: 700; font-size: 17px; letter-spacing: 0.01em; }
.ds-shell-actions { display: inline-flex; align-items: center; gap: 8px; }
.ds-shell-main { flex: 1 1 auto; width: 100%; margin-inline: auto; box-sizing: border-box;
  padding: 16px max(14px, env(safe-area-inset-left)) calc(76px + env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-right)); }
.ds-shell-nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; display: flex; align-items: stretch; gap: 2px;
  padding: 6px max(8px, env(safe-area-inset-left)) calc(6px + env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-right));
  background: color-mix(in srgb, var(--ds-bg) 92%, transparent); backdrop-filter: blur(10px); border-top: 1px solid var(--ds-border); }
.ds-shell-navbtn { flex: 1 1 0; min-width: 0; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  background: none; border: 0; padding: 6px 4px; border-radius: 12px; cursor: pointer; color: var(--ds-dim); font-family: inherit; font-size: 11px; font-weight: 600; }
.ds-shell-navbtn:hover { background: var(--ds-surface-hi); color: var(--ds-mid); }
.ds-shell-navbtn[aria-current="true"] { color: var(--ds-shell-accent); }
.ds-shell-navbtn-label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ds-shell-navicon { display: inline-flex; width: 22px; height: 22px; align-items: center; justify-content: center; }
.ds-shell-more-sheet { position: absolute; left: max(6px, env(safe-area-inset-left)); right: max(6px, env(safe-area-inset-right)); bottom: 100%; margin-bottom: 8px; z-index: 21;
  background: var(--ds-surface); border: 1px solid var(--ds-border); border-radius: 14px; box-shadow: var(--ds-shadow-card); overflow: hidden; }
.ds-shell-more-row { display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: 0; padding: 13px 15px; cursor: pointer;
  color: var(--ds-ink); font-family: inherit; font-size: 15px; text-align: left; border-bottom: 1px solid var(--ds-border); }
.ds-shell-more-row:last-child { border-bottom: 0; }
.ds-shell-more-row:hover { background: var(--ds-surface-hi); }
.ds-shell-more-row[aria-current="true"] { color: var(--ds-shell-accent); font-weight: 700; }
.ds-shell-scrim { position: fixed; inset: 0; z-index: 15; background: transparent; border: 0; }
@media (min-width: 820px) {
  .ds-shell-main { padding-bottom: 24px; }
  .ds-shell-nav { position: relative; justify-content: center; gap: 6px; border-top: 0; border-bottom: 1px solid var(--ds-border);
    background: color-mix(in srgb, var(--ds-bg) 88%, transparent); padding: 6px 12px; }
  .ds-shell-navbtn { flex: 0 0 auto; flex-direction: row; gap: 7px; padding: 8px 14px; font-size: 13px; }
  .ds-shell-more-sheet { top: 100%; bottom: auto; left: auto; right: max(8px, env(safe-area-inset-right)); margin: 8px 0 0; min-width: 220px; }
}
@media (prefers-reduced-motion: reduce) { .ds-shell-header, .ds-shell-nav { backdrop-filter: none; } }
`.trim()

function useAppShellStylesheet() {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(SHEET_ID)) return
    const el = document.createElement('style')
    el.id = SHEET_ID
    el.textContent = appShellCss
    document.head.appendChild(el)
  }, [])
}

export default function AppShell({ brand, headerActions, nav, maxWidth = 640, children, className }: AppShellProps) {
  useAppShellStylesheet()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreId = useId()

  const accent = brand.space ? spaces[brand.space].accent : cssVar.primary
  const glyphSize = brand.glyphSize ?? 22
  const isStaticBrand = !brand.onClick

  // Overflow: when there are more items than fit, keep (maxVisible - 1) up front
  // and fold the remainder behind "More", so the active tab is always reachable
  // even when it lives in the overflow.
  const items = nav?.items ?? []
  const maxVisible = nav?.maxVisible ?? 5
  const overflowed = items.length > maxVisible
  const primary = overflowed ? items.slice(0, maxVisible - 1) : items
  const overflow = overflowed ? items.slice(maxVisible - 1) : []
  const activeInOverflow = overflow.some((i) => i.key === nav?.activeKey)

  function select(key: string) {
    setMoreOpen(false)
    nav?.onSelect(key)
  }

  const rootStyle = { ['--ds-shell-accent' as string]: accent } as CSSProperties

  return (
    <div className={['ds-shell', className].filter(Boolean).join(' ') || undefined} style={rootStyle}>
      <header className="ds-shell-header">
        <button
          type="button"
          className="ds-shell-brand"
          onClick={brand.onClick}
          disabled={isStaticBrand}
          aria-label={isStaticBrand ? undefined : `${brand.wordmark} — home`}
        >
          <Glyph
            variant={brand.livActive ? 'live' : 'crest'}
            size={glyphSize}
            alt={brand.livActive ? 'Liv active' : 'OneLyf'}
          />
          <span className="ds-shell-wordmark">{brand.wordmark}</span>
        </button>
        {headerActions ? <div className="ds-shell-actions">{headerActions}</div> : <span />}
      </header>

      {nav && items.length > 0 && (
        <nav className="ds-shell-nav" aria-label="Main navigation">
          {primary.map((item) => (
            <button
              key={item.key}
              type="button"
              className="ds-shell-navbtn"
              aria-current={item.key === nav.activeKey || undefined}
              onClick={() => select(item.key)}
            >
              {item.icon && <span className="ds-shell-navicon" aria-hidden>{item.icon}</span>}
              <span className="ds-shell-navbtn-label">{item.label}</span>
            </button>
          ))}
          {overflowed && (
            <button
              type="button"
              className="ds-shell-navbtn"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-controls={moreOpen ? moreId : undefined}
              aria-current={activeInOverflow || undefined}
              onClick={() => setMoreOpen((v) => !v)}
            >
              <span className="ds-shell-navicon" aria-hidden>⋯</span>
              <span className="ds-shell-navbtn-label">More</span>
            </button>
          )}
          {moreOpen && (
            <div className="ds-shell-more-sheet" id={moreId} role="menu">
              {overflow.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  className="ds-shell-more-row"
                  aria-current={item.key === nav.activeKey || undefined}
                  onClick={() => select(item.key)}
                >
                  {item.icon && <span className="ds-shell-navicon" aria-hidden>{item.icon}</span>}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </nav>
      )}

      {moreOpen && (
        <button
          type="button"
          className="ds-shell-scrim"
          aria-label="Close menu"
          onClick={() => setMoreOpen(false)}
        />
      )}

      <main className="ds-shell-main" style={{ maxWidth }}>
        {children}
      </main>
    </div>
  )
}
