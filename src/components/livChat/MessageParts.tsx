// ─── Small presentational pieces of a message bubble ──────────────────────────
// Moved verbatim out of LivChat.tsx (W3 legibility refactor).
import type { ReactNode } from 'react'
import { radius, textStyle } from '../../tokens'
import { cssVar } from '../../theme'
import { linkifySegments, isSameOrigin } from '../livChatComposer'
import type { LivToolActivity } from './types'
import { GlobeI, KeyboardI, MessageI, MicI, PhoneI, SearchI, SmartphoneI, ToolI } from './icons'

export function ChannelIcon({ channel }: { channel?: string }) {
  if (channel === 'phone') return <PhoneI />
  if (channel === 'app') return <SmartphoneI />
  return <MessageI />
}

// Voice-vs-text tag on every bubble.
export function ModalityPill({ modality }: { modality?: string }) {
  const voice = modality === 'voice'
  return (
    <span className="lc-pill" data-voice={voice ? '' : undefined} style={{
      ...textStyle('overline'), display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 6px', borderRadius: radius.pill, letterSpacing: '0.04em',
      background: voice ? 'color-mix(in srgb, var(--lc-accent) 22%, transparent)' : cssVar.track,
      color: voice ? 'var(--lc-accent)' : cssVar.mid,
    }}>
      {voice ? <MicI /> : <KeyboardI />}{voice ? 'Voice' : 'Text'}
    </span>
  )
}

// Highlight-follow for the per-message read-aloud Play button: wraps the currently-spoken word
// in <mark>. Plain text only — while a message is playing, its content renders without
// Linkified's link-tap handling for that render (links resume the instant playback stops); a
// deliberate trade-off, not a silent regression.
export function HighlightedText({ text, range }: { text: string; range: { start: number; end: number } }) {
  const { start, end } = range
  return <>{text.slice(0, start)}<mark className="lc-tts-highlight">{text.slice(start, end)}</mark>{text.slice(end)}</>
}

// ── Auto-linkify + external-link guard (livchat-external-link-guard) ──────────────────────────
// Jeff live 2026-08-23 (via /builders): a bare URL in ANY message's rendered content (liv, user,
// options text, document text, even the live-streaming bubble) becomes a tappable link; tapping
// one that leaves the app's own origin is intercepted by ExternalLinkModal below instead of
// navigating straight out. Pure segmenting/origin logic lives in livChatComposer.ts so it's
// node --test-able; this just renders those segments and wires the tap.
export function Linkified({ text, onLinkTap }: { text: string; onLinkTap: (url: string) => void }) {
  const segments = linkifySegments(text)
  if (segments.length === 1 && segments[0].kind === 'text') return <>{text}</>
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return <>{segments.map((s, i) => {
    if (s.kind !== 'url') return <span key={i}>{s.value}</span>
    // Same-origin links get a real href — no guard applies to them, so native middle-click /
    // "open in new tab" is fine. External links get NO real href: a bare <a onClick> is
    // trivially bypassed by middle-click or the context menu's "open in new tab", which act on
    // the href directly and never run our onClick handler (Ships, PR #65 review). Omitting href
    // means the browser has no destination to act on outside our handler, so every external tap
    // — mouse, middle-click, or keyboard — is forced through the guard. tabIndex/role/onKeyDown
    // restore the keyboard-focusability an <a> normally gets for free from having an href.
    const external = !isSameOrigin(s.value, origin)
    return (
      <a
        key={i}
        href={external ? undefined : s.value}
        target={external ? undefined : '_blank'}
        rel={external ? undefined : 'noopener noreferrer'}
        role={external ? 'link' : undefined}
        tabIndex={external ? 0 : undefined}
        className="lc-link"
        style={{ color: 'var(--lc-accent)', textDecoration: 'underline', overflowWrap: 'anywhere', cursor: 'pointer' }}
        onClick={(e) => { e.preventDefault(); onLinkTap(s.value) }}
        onAuxClick={external ? (e) => {
          // Middle-click without href is otherwise a silent no-op — route it through the same
          // guard instead of leaving the tap looking like it did nothing.
          if (e.button === 1) { e.preventDefault(); onLinkTap(s.value) }
        } : undefined}
        onKeyDown={external ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLinkTap(s.value) }
        } : undefined}
      >
        {s.value}
      </a>
    )
  })}</>
}

// The "Liv is doing something" line shown while a tool round runs, in place of a
// caret with no text behind it. Maps the tool name to a human verb; the `end`
// phase's summary is never shown here (the activity clears on end), so this only
// renders the in-flight `start`. A hat's `toolLabels` map wins when the tool name
// is in it — so an app can name its own tools ("Writing your recipe…") without
// forking this file; unmapped names fall back to the web-search/fetch defaults and
// then to a generic "Working…".
export function ToolActivityLine({ activity, brandIcon, labels }: { activity: LivToolActivity; brandIcon?: ReactNode; labels?: Record<string, string> }) {
  const isWeb = activity.name === 'web_search' || activity.name === 'fetch_url'
  const hatLabel = labels?.[activity.name]
  const label = hatLabel
    || (activity.name === 'web_search' ? 'Searching the web'
      : activity.name === 'fetch_url' ? 'Reading a page'
      : 'Working')
  // Web search/fetch keep their universal icons; the app's own tools show the hat's brand icon
  // (e.g. a chef's knife) when supplied, else a generic tool glyph.
  const icon = isWeb ? (activity.name === 'fetch_url' ? <GlobeI /> : <SearchI />) : (brandIcon ?? <ToolI />)
  return (
    <div className="lc-tool" style={{
      ...textStyle('caption'), display: 'inline-flex', alignItems: 'center', gap: 6,
      color: cssVar.mid, padding: '2px 8px', borderRadius: radius.pill,
      background: cssVar.track, marginBottom: 4,
    }}>
      {icon}<span>{label}<span className="lc-ellipsis" aria-hidden="true">…</span></span>
    </div>
  )
}
