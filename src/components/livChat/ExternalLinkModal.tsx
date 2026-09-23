// ─── External-link guard modal (livchat-external-link-guard) ──────────────────
// Moved verbatim out of LivChat.tsx (W3 legibility refactor).
import { radius, space, textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import { ChevronDownI, ShieldI } from './icons'

// Splits a URL into styled parts for the guard modal's link block: a green `scheme://`, a bold
// domain, and a muted path/query/hash. An unparseable URL (shouldn't reach here — Linkified only
// ever taps a string linkifySegments already recognized as a URL) falls back to showing the raw
// string as the "domain" part rather than throwing.
function urlParts(raw: string): { scheme: string; domain: string; path: string } {
  try {
    const u = new URL(raw)
    return { scheme: `${u.protocol}//`, domain: u.host, path: u.pathname + u.search + u.hash }
  } catch {
    return { scheme: '', domain: raw, path: '' }
  }
}

// Approximates Jeff's live reference (2026-08-23, via /builders: "violet, matches Claude's") for
// this ONE button — a fixed security-interstitial accent, not a new DS brand token, and
// deliberately NOT `var(--lc-accent)` (this dialog's whole point is to look distinct from the
// app's normal chrome, like an OS-level permission prompt). Jeff's actual reference screenshot
// wasn't attached to the raven that spec'd this — confirm the exact hex against it and adjust
// this one constant if it's off.
const LINK_GUARD_ACCENT = '#6C4FD1'

// The external-link warning interstitial itself — Claude's mobile pattern (header, "you are
// about to visit", styled link block, collapsed safety-info expander, disclaimer footer, Open/
// Close). Fires on every external tap (LivChat re-renders it per `url`, not just the first);
// same-origin links never reach this component at all (Linkified's tap handler routes those
// straight through instead of opening the guard).
export function ExternalLinkModal({ url, safetyOpen, onToggleSafety, onOpen, onClose }: {
  url: string
  safetyOpen: boolean
  onToggleSafety: () => void
  onOpen: () => void
  onClose: () => void
}) {
  const parts = urlParts(url)
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lc-link-guard-title"
        className="lc-glass"
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 101, width: 'min(360px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
          border: `1px solid ${cssVar.border}`, borderRadius: radius.lg,
          boxShadow: 'var(--ds-shadow-card)', padding: space.md, boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', gap: space.sm,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldI />
          <span id="lc-link-guard-title" style={{ ...textStyle('label'), fontWeight: 700, color: cssVar.ink }}>Opening External Link</span>
        </div>
        <p style={{ ...textStyle('bodySm'), color: cssVar.mid, margin: 0 }}>You are about to visit an external website:</p>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, border: `1px solid ${cssVar.border}`, borderRadius: radius.md, padding: '8px 10px', background: cssVar.bg }}>
          <span style={{ flex: '0 0 auto', marginTop: 1 }}><ShieldI /></span>
          <span style={{ ...textStyle('bodySm'), overflowWrap: 'anywhere' }}>
            <span style={{ color: cssVar.success }}>{parts.scheme}</span>
            <strong style={{ color: cssVar.ink }}>{parts.domain}</strong>
            <span style={{ color: cssVar.dim }}>{parts.path}</span>
          </span>
        </div>
        <div>
          <button
            type="button"
            onClick={onToggleSafety}
            aria-expanded={safetyOpen}
            style={{ ...textStyle('caption'), background: 'transparent', border: 0, color: cssVar.ink, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <span style={{ display: 'inline-flex', transform: safetyOpen ? 'rotate(180deg)' : 'none' }}><ChevronDownI /></span>
            Show safety information
          </button>
          {safetyOpen && (
            <ul style={{ ...textStyle('caption'), color: cssVar.mid, margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><strong style={{ color: cssVar.ink }}>https://</strong>: Secure connection (encrypted)</li>
              <li><strong style={{ color: cssVar.ink }}>Domain name</strong>: Check this is the site you expect to visit</li>
              <li>Watch for misspellings (e.g., proton.me vs pr0t0n.me)</li>
              <li>Be cautious of unfamiliar domains or excessive subdomains</li>
            </ul>
          )}
        </div>
        <p style={{ ...textStyle('caption'), color: cssVar.dim, margin: 0 }}>
          External links may pose security risks. We are not responsible for the content of external sites. Please proceed at your own risk.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: space.xs }}>
          <button
            type="button"
            className="ds-btn"
            onClick={onClose}
            style={{ ...textStyle('label'), background: 'transparent', color: cssVar.ink, border: `1px solid ${cssVar.border}`, borderRadius: radius.md, padding: '9px 14px', cursor: 'pointer' }}
          >
            Close
          </button>
          <button
            type="button"
            className="ds-btn"
            onClick={onOpen}
            style={{ ...textStyle('label'), background: LINK_GUARD_ACCENT, color: '#fff', border: 0, borderRadius: radius.md, padding: '9px 14px', cursor: 'pointer' }}
          >
            Open Link
          </button>
        </div>
      </div>
    </>
  )
}
