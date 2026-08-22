// ─── LivChat — the one Liv chat window ──────────────────────────────────────
// A single, shared chat surface for every Liv "hat": Liv in the OneLyf Console,
// Commis in Tummyful, the Advisor in Cash Stash. The UI lives here once; each app
// injects a `hat` (name / accent / options) and a backend `adapter`. The app owns
// WHERE the data comes from (its own broker/edge functions) and WHAT Liv can read
// (the grant seam); this component owns how a conversation looks and behaves —
// session rail, bubbles, streaming, copy, inline rename/delete, attachments, and
// the bring-your-own-key settings.
//
// Ported + generalized from the federation shell's LivChat (itself from
// liv-voice/console), keeping its hard-won async correctness: every post-await
// state write is guarded by an activeId ref so a slow reply for session A can
// never paint over session B.
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { radius, space, textStyle } from '../tokens'
import { cssVar } from '../theme'
import Glyph, { type GlyphVariant } from '../Glyph'
import { shouldSendOnEnter, partialTurnToAppend, transcriptToMarkdown, transcriptFilename } from './livChatComposer'

// ── Public types ────────────────────────────────────────────────────────────

export type LivResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error?: { message?: string; detail?: string } }

export interface LivSession { id: string; title?: string | null; channel?: string }
export interface LivAttachment { kind?: string; path: string; mime?: string }
export interface LivMessage {
  id: string
  role: 'user' | 'liv'
  modality?: 'voice' | 'text'
  channel?: string
  content?: string | null
  attachments?: LivAttachment[] | string | null
}
export interface LivKeyInfo { hasKey: boolean; model?: string | null }
export interface LivModel { id: string; label: string }

// A tool the assistant invokes mid-reply (web search, page fetch). The adapter
// surfaces these through the same `onChunk` callback as text, so a chat can show
// "Searching…" instead of a frozen caret while a tool round runs. Backward-
// compatible: an adapter that only ever passes strings keeps working unchanged.
export interface LivToolActivity {
  type: 'tool'
  phase: 'start' | 'end'
  name: string            // e.g. 'web_search', 'fetch_url'
  summary?: string        // human line from the `end` phase ("Searched: …")
  ok?: boolean
}

// Per-turn token usage, as the backend reports it on the chat stream's `done`
// event (Anthropic's native field names, flattened). Powers the token/cost
// meter. All optional so an adapter that doesn't surface usage simply shows no
// meter — never a crash.
export interface LivUsage {
  input?: number
  output?: number
  cacheCreate?: number
  cacheRead?: number
}

// What `adapter.chat.send` resolves to. Flat (not LivResult<T>) to mirror the
// federation `liv` client's existing shape; `usage` rides along on success.
// `extras` is a passthrough for whatever app-domain data the adapter wants to
// hand back to itself alongside the reply — Commis flows its `proposed[]`
// action-cards this way, without requiring the DS to know what an action card
// is. LivChat doesn't read `extras`; it only widens the type so the app's own
// adapter code can consume it in its onSend hook.
export type LivChatSendResult =
  | { ok: true; usage?: LivUsage; extras?: unknown }
  | { ok: false; error?: { message?: string; detail?: string }; extras?: unknown }

// The one identity knob. `accent` themes the avatar/active states to the hat's
// space (Cash Stash gold, Tummyful terracotta …); everything else falls back to
// the design-system defaults so a hat is a few lines, not a restyle.
export interface LivHat {
  name: string                 // "Liv", "Commis", "Advisor"
  subtitle?: string            // shown muted next to the name ("sessions")
  accent?: string              // hat accent (defaults to --ds-primary)
  placeholder?: string         // composer placeholder
  emptyText?: string           // transcript empty-state line
  intro?: string               // muted blurb under the header
  enableAttachments?: boolean  // show the image attach control (default true)
  enableKey?: boolean          // show the bring-your-own-key settings (default true)
  models?: LivModel[]          // model choices for the key panel + inline composer selector
  glyph?: GlyphVariant         // brand mark shown in the header ('live' for Liv); omit for none
  // ── Open branding layer ────────────────────────────────────────────────────
  // The structure/navigation is identical across every app; a hat overrides
  // whatever expresses that app's identity. All optional — omit for the shared
  // Liv defaults. (e.g. Tummyful's "Commis" wears kitchen framing + chef pills.)
  description?: string         // empty-state blurb under "Ask {name}"
  pills?: string[]             // capability pills in the empty state
  suggestions?: string[]      // starter prompts (chips) shown when the thread is empty
  toolIcon?: ReactNode         // brand icon for THIS app's own tool calls (e.g. Tummyful's chef's
                               // knife); web search/fetch keep their universal icons.
  // Human labels for THIS hat's own tool calls, keyed by the tool name the backend
  // emits on the stream (LivToolActivity.name). Complements `toolIcon`: the icon
  // is one glyph for all app tools; this map picks the per-tool phrasing so the
  // in-flight line reads "Writing your recipe…" instead of a generic "Working…".
  // Falls through to the built-in web_search/fetch_url defaults for those two, and
  // to "Working" for any unmapped tool name.
  toolLabels?: Record<string, string>
  // Optional persona-tier selector shown in the Brain menu (Cash Stash Advisor's Standard vs
  // Premium pattern — Standard = shallower prompt, Premium = deeper). Consumer supplies the
  // list AND the current selection via LivChatProps.tier + onTierChange (below). Omit both
  // to hide the row entirely.
  tiers?: { id: string; label: string }[]
}

// Backend-agnostic data port. Its shape mirrors the federation `liv` client so an
// app can pass that object almost verbatim.
export interface LivChatAdapter {
  sessions: {
    list(): Promise<LivResult<{ sessions: LivSession[] }>>
    create(title?: string): Promise<LivResult<{ id: string }>>
    rename(id: string, title: string): Promise<LivResult>
    delete(id: string): Promise<LivResult>
  }
  messages: {
    list(sessionId: string): Promise<LivResult<{ messages: LivMessage[] }>>
  }
  chat: {
    send(
      args: { sessionId: string; text: string; files?: File[] },
      // A plain string is a text delta (appended to the streaming reply); a
      // LivToolActivity is a tool round starting/ending. Widened from
      // `string`-only, so existing text-only adapters are unaffected.
      onChunk: (chunk: string | LivToolActivity) => void,
    ): Promise<LivChatSendResult>
    // Optional cancel port. When present, LivChat renders a Stop button in the streaming bubble
    // and auto-invokes on a mid-send session switch — so a slow reply for the just-abandoned
    // session stops burning tokens instead of running to completion behind the scenes. The
    // adapter's send() should catch its own AbortError and resolve; LivChat treats the
    // user-cancelled case silently (no error banner). Backward compatible: an adapter without
    // abort() gets the old behavior (no Stop button, no auto-cancel — same as before).
    abort?(): void
  }
  attachments?: { signedUrl(path: string): Promise<string> }
  key?: {
    get(): Promise<LivResult<LivKeyInfo>>
    set(patch: { apiKey?: string; model?: string }): Promise<LivResult<LivKeyInfo>>
  }
  // Optional voice capability. When present, the Hands-free toggle reads Liv's replies aloud
  // through the app's own voice (e.g. Google TTS + FX). When absent, Hands-free falls back to the
  // browser's speechSynthesis, so voice-out works everywhere; the mic (speech-in) is always
  // browser-native and gated only on SpeechRecognition support.
  voice?: {
    speak(text: string): Promise<void>
    stop?(): void
  }
  // Optional: called from a user gesture the exact moment the Hands-free (speaker) toggle
  // flips. `on: true` means the user just enabled hands-free; the consumer can use this
  // moment to unlock iOS audio + audio-session prewarm, start its own wake-word dictation,
  // or run any other one-shot side effect that needs to happen under a user-gesture stack
  // frame. `on: false` on disable. Non-blocking; failures are the consumer's problem.
  onHandsFreeChange?(on: boolean): void
}

export interface LivChatProps {
  hat: LivHat
  adapter: LivChatAdapter
  // Optional: report chat state up to a host that keeps this instance mounted across navigation
  // (e.g. a persistent LivDock/bubble) — it drives the launcher's unread dot + thinking pulse.
  // Omitted by inline hosts that don't need it.
  onState?: (s: { messageCount: number; thinking: boolean }) => void
  // Optional dock controls. When a host floats this chat in a bubble/panel it passes these to
  // render a chevron-down (minimize) and X (close) in THIS header — so the card has one header
  // with its controls, not a separate dock chrome bar stacked on top. Omit for an inline host.
  onMinimize?: () => void
  onClose?: () => void
  // Optional one-shot external ask: pre-fill the composer draft, optionally attach some files,
  // and (typically) auto-open a persistent host that keeps LivChat mounted. `nonce` MUST change
  // per ask — same nonce twice is idempotent and won't re-fire. Used today by Commis's
  // "Critique my plating" dock action; the host builds `{prompt, files, nonce}` and hands it in.
  // The app is responsible for turning image URLs into File objects (a data URL or a fetched
  // blob) before passing them — DS accepts pre-made Files, no URL fetching.
  // `autoSend`: skip the pre-fill-and-wait-for-tap step and send immediately. For a host driving
  // LivChat hands-free (e.g. a wake-word voice gate that decided the utterance IS the message,
  // not a draft) — there's no user left to tap Send. Omit/false preserves the original
  // pre-fill-only behavior.
  pendingRequest?: { prompt: string; files?: File[]; nonce: number; autoSend?: boolean }
  // Fires exactly once per accepted pendingRequest so the host can clear its own state after
  // LivChat has consumed the ask (matches Commis's onRequestConsumed today).
  onPendingRequestConsumed?: () => void
  // Optional: fires whenever the visible transcript or active session changes, so a host that
  // needs the live conversation for its OWN app-owned logic (Commis's save-as-recipe /
  // push-to-shopping / push-to-pantry / log-consumed / propose-changes extraction, which all read
  // "the current chat") doesn't have to duplicate LivChat's session/message state to get it —
  // LivChat is the only thing that actually calls adapter.messages.list. Purely a read-only
  // mirror; the host must not mutate through this.
  onMessagesChange?: (messages: LivMessage[], sessionId: string | null) => void
  // A queue of proposed structured actions the assistant surfaced — rendered as an action-card
  // stack below the last message, above the composer. Adapters typically populate this from
  // the previous send's `extras` (Commis's proposed[]). Each card carries a summary + optional
  // domain body (recipe/pantry/plan-date pickers Commis needs) + apply/dismiss handlers. DS
  // owns the frame + Apply/Dismiss/Apply-all layout + the styling; the app supplies the DOMAIN
  // fields via `renderBody`. This is the FIRST-CLASS primitive — not a rendering escape hatch.
  actionQueue?: LivActionQueue
  // Actions menu items shown as a popover in the composer toolbar (Commis's "turn this into…"
  // chef's-knife menu, Advisor's manual "add to budget" etc.). A canonical popover — DS owns
  // the button + list layout + open/close; the app supplies the LABEL + HANDLER per item.
  actions?: LivChatAction[]
  // Fires from inside the click handler for the Hands-free (speaker) toggle, with the new
  // on/off state. Consumers use this for one-shot side effects that need to happen under a
  // user-gesture stack frame — iOS TTS audio-session unlock, wake-word dictation start,
  // audio-chime prewarm, etc. Purely optional; DS handles the toggle either way.
  onHandsFreeChange?: (on: boolean) => void
  // When true, the HOST owns the hands-free microphone and reply-readback (e.g. Tummyful's Commis
  // runs a wake-word-gated mic + its own Liv-voice TTS). The speaker toggle then becomes a pure
  // signal: it flips state and fires onHandsFreeChange, but LivChat does NOT start its own built-in
  // SpeechRecognition (which auto-sends every utterance ungated) and does NOT read replies aloud.
  // Default false → LivChat's self-contained hands-free (mic + TTS) as before.
  hostOwnsHandsFreeVoice?: boolean
  // Current persona tier + change handler for the Brain menu's tier dropdown. Ignored when
  // hat.tiers is omitted. Consumer typically persists this via `usePersistedState` (Cash
  // Stash) or a Supabase family setting (Tummyful, once Commis wants it).
  tier?: string
  onTierChange?: (id: string) => void
}

// One structured mutation the assistant proposes, awaiting the user's Apply. `data` is opaque
// to LivChat (Commis stashes recipe candidates + resolved ids in there; Advisor stashes finance
// deltas); `renderBody` lets the app draw its own domain pickers inside DS's card frame.
export interface LivProposedAction {
  id: string
  // App-defined action-type slug — informational to DS, drives Commis/Advisor's own routing.
  type: string
  // Human-readable summary shown as the card's headline.
  summary: string
  // Opaque app-state payload; app reads it in renderBody + in the apply handler.
  data?: unknown
  // Optional app-owned body: renders domain pickers (recipe select, plan date, batch scale…)
  // inside the card frame. Omit for a summary-only card with just Apply / Dismiss.
  renderBody?: () => ReactNode
  // Optional note shown muted below the body (Commis's "Opens the log-used-up review before
  // anything is deducted from your pantry" style). Not the same as an error — informational.
  note?: string
  // Whether the card is ready to apply (pickers filled in etc.). Defaults to true. When false
  // the Apply button is disabled with a hint.
  ready?: boolean
  // Post-apply lifecycle. LivChat sets these from the queue's handlers — apps shouldn't
  // populate them directly.
  status?: 'pending' | 'applying' | 'done' | 'error'
  result?: string    // shown as "✓ {result}" when done, or as the error line when error
}

export interface LivActionQueue {
  cards: LivProposedAction[]
  // Apply one card. Resolve with {ok:true, result?} to mark it done; {ok:false, error?} to mark
  // it errored. LivChat handles the visual state transitions.
  onApply(id: string): Promise<{ ok: true; result?: string } | { ok: false; error?: string }>
  // Dismiss one card. LivChat removes it from the visual stack; the app is responsible for
  // discarding it from its own state.
  onDismiss(id: string): void
  // Optional Apply-all. When present AND ≥2 cards are ready, a batch-summary bar appears with
  // an "Apply all (N)" button. The app decides what "all" means (skip mark-cooked cards that
  // open a review, etc.) — DS just calls this.
  onApplyAll?(): Promise<void>
  // Optional label for the intro line above the cards. Defaults to a hat-appropriate default.
  introText?: string
}

// One item in the composer's manual actions menu (Commis's "turn this into…").
export interface LivChatAction {
  id: string
  label: string       // menu item text ("Save as recipe", "Add to shopping list")
  hint?: string       // muted second line ("Extract the recipe from this chat")
  onSelect(): void | Promise<void>
  disabled?: boolean
}

const DEFAULT_MODELS: LivModel[] = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8 · most capable (default)' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 · balanced' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 · fastest / cheapest' },
]

// Approximate Anthropic list prices, dollars PER TOKEN (list $/1M ÷ 1e6), keyed
// by model family. Cache-write = 1.25× input and cache-read = 0.1× input are the
// standard 5-minute-cache multipliers, so they're derived rather than stored.
// Matched by family substring so a dated snapshot id (…-20251001) still resolves;
// unknown models fall back to the Sonnet tier. Unlike Cash Stash's single flat
// rate, this prices Haiku/Opus turns correctly — the meter is an estimate, not a bill.
type Tier = { input: number; output: number }
const PRICE_PER_TOKEN: Record<string, Tier> = {
  opus: { input: 15 / 1e6, output: 75 / 1e6 },
  sonnet: { input: 3 / 1e6, output: 15 / 1e6 },
  haiku: { input: 1 / 1e6, output: 5 / 1e6 },
}
function tierFor(model?: string | null): Tier {
  const id = (model || '').toLowerCase()
  if (id.includes('opus')) return PRICE_PER_TOKEN.opus
  if (id.includes('haiku')) return PRICE_PER_TOKEN.haiku
  return PRICE_PER_TOKEN.sonnet
}
function usageCost(u: LivUsage, model?: string | null): number {
  const t = tierFor(model)
  return (u.input || 0) * t.input
    + (u.output || 0) * t.output
    + (u.cacheCreate || 0) * t.input * 1.25
    + (u.cacheRead || 0) * t.input * 0.1
}

// A message's `attachments` can arrive as an array, a JSON string (jsonb), or be
// missing — always coerce so `.map` never throws (the crash that took the whole
// card down before the error boundary existed).
function attachmentsOf(m: LivMessage): LivAttachment[] {
  const a = m?.attachments
  if (Array.isArray(a)) return a
  if (typeof a === 'string' && a.trim()) {
    try { const p = JSON.parse(a); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}

// A session's display title, with a friendly fallback while it's still being
// named. Sessions are created untitled (title = null) and named server-side by
// an intelligent one-line SUMMARY of the first exchange — never a raw echo of
// the first message, and never left as "Untitled". Until that background title
// lands (it arrives on the next session-list refresh), the rail shows this
// neutral placeholder rather than a truncated copy of what was just typed.
function displayTitle(title?: string | null): string {
  return (title || '').trim() || 'New chat'
}

// ── Minimal inline icon set (stroke glyphs, inherit currentColor) ────────────
const ic: CSSProperties = { width: 14, height: 14, display: 'inline-block', verticalAlign: '-2px' }
const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style: ic, 'aria-hidden': true }
const MicI = () => <svg {...svg}><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
const SpeakerI = () => <svg {...svg}><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>
const KeyboardI = () => <svg {...svg}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="6" y1="13" x2="18" y2="13" /><line x1="6" y1="9" x2="6.01" y2="9" /><line x1="18" y1="9" x2="18.01" y2="9" /></svg>
const PhoneI = () => <svg {...svg}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
const SmartphoneI = () => <svg {...svg}><rect x="7" y="2" width="10" height="20" rx="2" /><line x1="11" y1="18" x2="13" y2="18" /></svg>
const MessageI = () => <svg {...svg}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
const ImageI = () => <svg {...svg}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
const SearchI = () => <svg {...svg}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
const ChevronDownI = () => <svg {...svg}><path d="M6 9l6 6 6-6" /></svg>
const CloseI = () => <svg {...svg}><path d="M18 6L6 18M6 6l12 12" /></svg>
const PlusI = () => <svg {...svg}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
const ArrowUpI = () => <svg {...svg}><line x1="12" y1="19" x2="12" y2="5" /><path d="M5 12l7-7 7 7" /></svg>
const GlobeI = () => <svg {...svg}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
const ToolI = () => <svg {...svg}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.3L3 18l3 3 6.4-6.3a4 4 0 0 0 5.3-5.4l-2.6 2.6-2.4-.6-.6-2.4z" /></svg>
const PencilI = () => <svg {...svg}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
const TrashI = () => <svg {...svg}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
const CopyI = () => <svg {...svg}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
const CheckI = () => <svg {...svg}><polyline points="20 6 9 17 4 12" /></svg>
const MenuI = () => <svg {...svg}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
const DownloadI = () => <svg {...svg}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>

function ChannelIcon({ channel }: { channel?: string }) {
  if (channel === 'phone') return <PhoneI />
  if (channel === 'app') return <SmartphoneI />
  return <MessageI />
}

// Voice-vs-text tag on every bubble.
function ModalityPill({ modality }: { modality?: string }) {
  const voice = modality === 'voice'
  return (
    <span className="lc-pill" data-voice={voice ? '' : undefined} style={{
      ...textStyle('overline'), display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 6px', borderRadius: radius.pill, letterSpacing: '0.04em',
      background: voice ? 'color-mix(in srgb, var(--lc-accent) 22%, transparent)' : cssVar.track,
      color: voice ? 'var(--lc-accent)' : cssVar.mid,
    }}>
      {voice ? <MicI /> : <KeyboardI />}{voice ? 'voice' : 'text'}
    </span>
  )
}

// The "Liv is doing something" line shown while a tool round runs, in place of a
// caret with no text behind it. Maps the tool name to a human verb; the `end`
// phase's summary is never shown here (the activity clears on end), so this only
// renders the in-flight `start`. A hat's `toolLabels` map wins when the tool name
// is in it — so an app can name its own tools ("Writing your recipe…") without
// forking this file; unmapped names fall back to the web-search/fetch defaults and
// then to a generic "Working…".
function ToolActivityLine({ activity, brandIcon, labels }: { activity: LivToolActivity; brandIcon?: ReactNode; labels?: Record<string, string> }) {
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
.lc-copy { opacity: 0; transition: opacity .12s ease; }
.lc-bubble:hover .lc-copy, .lc-copy:focus-visible { opacity: 1; }
/* Sessions rail is an expandable left SIDEBAR (Tummyful canon — Jeff 2026-08-09:
   "I wanted the History menu as it was before as an expandable sidebar menu off to
   the left not something that blankets the whole chat window"). Closed by default;
   the History (N) pill in the header opens it. When open, the transcript column
   shifts right — the sidebar sits ALONGSIDE the transcript, not over it. No scrim,
   no blanket. On the narrowest viewports the sidebar takes most of the width
   because the transcript would be too narrow otherwise. */
.lc-body { display: grid; grid-template-columns: 1fr; gap: 0; transition: grid-template-columns .18s ease; }
.lc-body[data-rail-open="true"] { grid-template-columns: minmax(200px, 260px) 1fr; gap: 12px; }
.lc-rail {
  overflow-y: auto;
  background: var(--ds-surface); border: 1px solid var(--ds-border-bright);
  border-radius: ${radius.md}px; padding: 10px;
  box-shadow: var(--ds-shadow-card);
  animation: lc-fade-in .14s ease;
  min-width: 0;
}
@media (max-width: 620px) {
  .lc-body[data-rail-open="true"] { grid-template-columns: 1fr; }
  .lc-body[data-rail-open="true"] .lc-main { display: none; }
}
`

// Minimal shape of the experimental Web Speech API (not in the standard TS DOM lib) — just the
// bits the mic uses. Cast the vendor-prefixed constructor to this when dictation is available.
interface SpeechRecResult { readonly isFinal: boolean; readonly 0: { readonly transcript: string } }
interface SpeechRecEvent { readonly resultIndex: number; readonly results: ArrayLike<SpeechRecResult> }
interface SpeechRec {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: (e: SpeechRecEvent) => void; onend: () => void; onerror: () => void
  start(): void; stop(): void
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LivChat({ hat, adapter, onState, onMinimize, onClose, pendingRequest, onPendingRequestConsumed, onMessagesChange, actionQueue, actions, onHandsFreeChange, hostOwnsHandsFreeVoice, tier, onTierChange }: LivChatProps) {
  const accent = hat.accent || cssVar.primary
  const models = hat.models || DEFAULT_MODELS
  const showKey = hat.enableKey !== false && !!adapter.key
  const showAttach = hat.enableAttachments !== false

  const [sessions, setSessions] = useState<LivSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<LivMessage[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState<File[]>([])
  // Enter sends only on a physical keyboard (fine pointer). On a touch device the Return key inserts
  // a newline instead, and the user sends with the Send button. Device-static, so read once.
  const [enterSends] = useState(() => typeof window === 'undefined' || !window.matchMedia?.('(pointer: coarse)')?.matches)
  const [streaming, setStreaming] = useState('')
  // The tool round currently running, shown as an activity line above the
  // streaming text. Null when no tool is mid-flight.
  const [toolActivity, setToolActivity] = useState<LivToolActivity | null>(null)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  // Narrow-viewport session rail: hidden by default, toggled open as an
  // overlay sheet (see .lc-rail-toggle / .lc-rail in livChatStylesheet).
  // Irrelevant above the 620px breakpoint, where the rail is always visible.
  const [railOpen, setRailOpen] = useState(false)

  // Voice. handsFree reads Liv's replies aloud (app voice via adapter.voice, else the browser's
  // speechSynthesis). The mic dictates into the composer via the browser SpeechRecognition API —
  // shown only where that's supported. Both live in the composer toolbar.
  const [handsFree, setHandsFree] = useState(false)
  // toggleMic's rec.onend closure captures `handsFree` at the moment the recognizer was created.
  // The toggle turns hands-free ON and starts the mic in the same tick (before the re-render), so
  // that first utterance's closure would see the stale `false` — its auto-send and loop-restart
  // never fired, and hands-free looked dead ("takes my voice as text but I have to hit send").
  // Reading a ref instead keeps onend on the CURRENT value.
  const handsFreeRef = useRef(handsFree)
  useEffect(() => { handsFreeRef.current = handsFree }, [handsFree])
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  // Lets toggleMic's onresult closure notice when `draft` changed for a reason other than its
  // own last write (the user typed while dictating, or send() cleared the composer) so it can
  // rebase onto that instead of silently stomping it on the next speech result.
  const draftRef = useRef('')
  useEffect(() => { draftRef.current = draft }, [draft])
  const speechInSupported = typeof window !== 'undefined' &&
    !!((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
       (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition)

  // Running token/cost total for this console (spans sessions), reset by tapping
  // the meter. Cost is derived at render time from the current model's tier.
  const [usage, setUsage] = useState<LivUsage>({ input: 0, output: 0, cacheCreate: 0, cacheRead: 0 })
  // Most-recent turn's usage. Cleared on meter reset (tap the token cost pill).
  const [lastTurn, setLastTurn] = useState<LivUsage | null>(null)
  // Daily meter — localStorage-backed, rolls over at LOCAL midnight (a saved key from
  // yesterday is dropped, today starts at zero). Matches Cash Stash's canon (see
  // src/App.jsx's advisorDailyMeter). Scoped by hat.name so Commis / Advisor / Liv Console
  // each track their own daily spend. Failures are silent (private-browsing/quota) — worst
  // case the row shows this-session-only totals.
  const localDateKey = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const dailyStorageKey = `ds-liv-daily.${hat.name || 'liv'}.${localDateKey()}`
  const readDaily = (): LivUsage => {
    const zero: LivUsage = { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 }
    if (typeof window === 'undefined' || !window.localStorage) return zero
    try {
      const raw = window.localStorage.getItem(dailyStorageKey)
      if (!raw) return zero
      const p = JSON.parse(raw)
      return { input: p.input | 0, output: p.output | 0, cacheCreate: p.cacheCreate | 0, cacheRead: p.cacheRead | 0 }
    } catch { return zero }
  }
  const [daily, setDaily] = useState<LivUsage>(() => readDaily())
  function addUsage(u: LivUsage) {
    setUsage((p) => ({
      input: (p.input || 0) + (u.input || 0),
      output: (p.output || 0) + (u.output || 0),
      cacheCreate: (p.cacheCreate || 0) + (u.cacheCreate || 0),
      cacheRead: (p.cacheRead || 0) + (u.cacheRead || 0),
    }))
    setLastTurn(u)
    // Rollover-safe: base every daily update on the CURRENT day's storage value (which
    // returns zero if today's key doesn't exist yet — either fresh install, or the day
    // just rolled over past local midnight), NOT on the in-memory `daily` accumulator
    // (which would carry yesterday's cumulative total into today's key on a long-lived
    // tab open across midnight).
    setDaily(() => {
      const today = readDaily()
      const next: LivUsage = {
        input: (today.input || 0) + (u.input || 0),
        output: (today.output || 0) + (u.output || 0),
        cacheCreate: (today.cacheCreate || 0) + (u.cacheCreate || 0),
        cacheRead: (today.cacheRead || 0) + (u.cacheRead || 0),
      }
      try { window.localStorage.setItem(dailyStorageKey, JSON.stringify(next)) } catch { /* quota/private */ }
      return next
    })
  }

  const [keyInfo, setKeyInfo] = useState<LivKeyInfo>({ hasKey: false, model: null })
  // Whether the composer's Brain popover is open. Canonical Liv-chat placement: the Brain
  // pill (model + API key + usage) lives IN the composer next to attach/mic/send, NOT in
  // the chat header — see onelyf-planning/docs/liv-chat-canon.md (Tummyful is the reference design).
  const [brainOpen, setBrainOpen] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [modelInput, setModelInput] = useState(models[0]?.id ?? 'claude-opus-4-8')
  // Set to `Saved` briefly after a successful key save; the Brain popover closes automatically
  // and this leaves a hat-accent status line under the composer (existing `msg` mechanism).

  const transcriptRef = useRef<HTMLDivElement>(null)
  // Auto-follow only when the user is already pinned near the bottom. Without this, every
  // streamed token yanked the transcript back down mid-read, so scrolling up to re-read the top
  // of a long reply was impossible. `onTranscriptScroll` keeps `pinnedRef` in sync with the
  // user's real scroll position; the auto-scroll effect below only follows when pinned.
  const pinnedRef = useRef(true)
  const onTranscriptScroll = () => {
    const el = transcriptRef.current
    if (el) pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }
  const fileRef = useRef<HTMLInputElement>(null)

  // Mirrors activeId synchronously so in-flight async work can tell — the instant
  // it resolves — whether the user is STILL on the session it was fired for.
  const activeIdRef = useRef<string | null>(null)
  function setActive(id: string | null) { activeIdRef.current = id; setActiveId(id) }

  // Flipped true by the Stop button (or by an auto-abort on session switch mid-send) so the
  // catch/error clauses in send() know a subsequent failure is user-initiated and shouldn't
  // paint an error banner. Reset at the start of every new send.
  const userAbortedRef = useRef(false)

  // Per-card lifecycle state layered over `actionQueue.cards` — DS owns the pending/applying/
  // done/error transitions so the app doesn't have to plumb them into its own state. Keyed by
  // card id; entries stay until the card is removed from the incoming queue.
  const [cardState, setCardState] = useState<Record<string, { status: 'pending' | 'applying' | 'done' | 'error'; result?: string }>>({})
  const [applyAllBusy, setApplyAllBusy] = useState(false)
  // The composer's actions menu open/close (Commis's chef's-knife popover).
  const [actionsOpen, setActionsOpen] = useState(false)
  // Nonce of the last pendingRequest we consumed. Guards against re-firing when the SAME
  // {nonce} arrives more than once (React strict-mode double-invoke or a parent re-render).
  const consumedPendingNonceRef = useRef<number | null>(null)

  // Mirrors renamingId synchronously, same reasoning as activeIdRef above.
  // Committing (Enter) or cancelling (Escape) a rename calls setRenamingId(null),
  // which unmounts the rename <input> on the next render — and browsers fire a
  // native `blur` on a focused element the instant it's removed from the DOM.
  // That blur re-invokes this SAME render's onBlur handler, i.e. the exact same
  // commitRename closure that just ran, still closing over the OLD `renamingId`
  // state value (component state is a fixed snapshot per closure — it can never
  // observe the setRenamingId(null) call that closure itself just made). A guard
  // written against that state is therefore a no-op: it reads identically on
  // both the Enter/Escape call and the follow-up blur call, so it can never
  // block the second one. Checking a ref instead works because the ref is
  // mutated synchronously, so the follow-up blur sees the updated value.
  const renamingIdRef = useRef<string | null>(null)
  function setRenaming(id: string | null) { renamingIdRef.current = id; setRenamingId(id) }

  // Consume a one-shot pendingRequest: pre-fill the composer draft, merge any provided Files
  // in, and notify the host so it can clear its side. Keyed on nonce — the same nonce is
  // idempotent (won't re-fire if the parent re-renders with the same request), and a NEW
  // nonce always fires even if prompt/files are identical to the last ask.
  useEffect(() => {
    if (!pendingRequest) return
    if (consumedPendingNonceRef.current === pendingRequest.nonce) return
    consumedPendingNonceRef.current = pendingRequest.nonce
    if (pendingRequest.autoSend) {
      // Bypass draft state entirely — send() takes explicit overrides so this doesn't race the
      // setDraft/setFiles batching below (which wouldn't be committed yet on this same tick).
      send(pendingRequest.prompt, pendingRequest.files)
    } else {
      setDraft(pendingRequest.prompt || '')
      if (pendingRequest.files && pendingRequest.files.length) {
        setFiles((existing) => [...existing, ...pendingRequest.files!])
      }
    }
    onPendingRequestConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `send` is a stable per-render
    // closure (function declaration, not state); adding it would re-fire this on every render.
  }, [pendingRequest, onPendingRequestConsumed])

  // Action-card apply/dismiss handlers. DS owns the visual state transition; the app's
  // onApply/onDismiss handlers own the mutation. On success the card flips to "done" with
  // the returned result; on failure it flips to "error" so a Retry button appears.
  async function applyCard(id: string) {
    if (!actionQueue) return
    setCardState((s) => ({ ...s, [id]: { status: 'applying' } }))
    try {
      const r = await actionQueue.onApply(id)
      if (r.ok) setCardState((s) => ({ ...s, [id]: { status: 'done', result: r.result } }))
      else setCardState((s) => ({ ...s, [id]: { status: 'error', result: r.error || 'Could not apply.' } }))
    } catch (e) {
      console.error('actionQueue.onApply threw', e)
      setCardState((s) => ({ ...s, [id]: { status: 'error', result: (e as Error)?.message || 'Could not apply.' } }))
    }
  }
  function dismissCard(id: string) {
    if (!actionQueue) return
    // Optimistic: drop the local state; the app removes the card from its own list.
    setCardState((s) => { const { [id]: _drop, ...rest } = s; return rest })
    try { actionQueue.onDismiss(id) } catch (e) { console.error('actionQueue.onDismiss threw', e) }
  }
  async function applyAllCards() {
    if (!actionQueue?.onApplyAll) return
    setApplyAllBusy(true)
    try { await actionQueue.onApplyAll() }
    catch (e) { console.error('actionQueue.onApplyAll threw', e) }
    finally { setApplyAllBusy(false) }
  }

  async function loadSessions(selectFirst = false) {
    try {
      const r = await adapter.sessions.list()
      if (r.ok) {
        setSessions(r.value.sessions)
        if (selectFirst && r.value.sessions.length) selectSession(r.value.sessions[0].id)
      }
    } catch (e) { console.error('sessions.list failed', e) }
  }

  async function loadKey() {
    if (!adapter.key) return
    try {
      const r = await adapter.key.get()
      if (r.ok) { setKeyInfo(r.value); if (r.value.model) setModelInput(r.value.model) }
    } catch (e) { console.error('key.get failed', e) }
  }

  useEffect(() => { loadSessions(true); loadKey() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Report chat state to a persistent host (LivDock) so its bubble can show an unread dot / thinking
  // pulse. thinking = a turn is in flight (sending) or streaming in. No-op when onState is omitted.
  useEffect(() => {
    onState?.({ messageCount: messages.length, thinking: sending || streaming.length > 0 })
  }, [messages.length, sending, streaming, onState])

  useEffect(() => {
    onMessagesChange?.(messages, activeId)
  }, [messages, activeId, onMessagesChange])

  useEffect(() => {
    const el = transcriptRef.current
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight
  }, [messages, streaming])

  // A session switch (or a freshly loaded chat) should start pinned to the newest message,
  // regardless of where the user had scrolled in the previous session.
  useEffect(() => { pinnedRef.current = true }, [activeId])

  // Stop any live mic dictation / TTS playback when this chat unmounts (e.g. its
  // host closes the panel) — otherwise the hot mic keeps listening and any
  // in-progress speech keeps talking after the UI is gone.
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      stopSpeaking()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function resolveUrls(msgs: LivMessage[]) {
    if (!adapter.attachments) return
    try {
      const next: Record<string, string> = {}
      await Promise.all(
        msgs.flatMap((m) => attachmentsOf(m).map(async (a) => {
          if (!urls[a.path]) next[a.path] = await adapter.attachments!.signedUrl(a.path)
        })),
      )
      if (Object.keys(next).length) setUrls((u) => ({ ...u, ...next }))
    } catch (e) { console.error('resolveUrls failed', e) }
  }

  // Cancel the in-flight reply (user tap on Stop, or triggered internally on mid-send session
  // switch). No-op when nothing is sending or the adapter doesn't expose an abort port; safe to
  // call redundantly. Marks the abort as user-initiated so the send()'s catch/error handling
  // stays silent instead of painting "Something went wrong".
  function stop() {
    if (!sending || !adapter.chat.abort) return
    userAbortedRef.current = true
    try { adapter.chat.abort() } catch (e) { console.error('adapter.chat.abort threw', e) }
  }

  async function selectSession(id: string) {
    // A slow reply for the just-abandoned session would otherwise keep streaming (and burning
    // tokens) even though its chunks are already ignored via activeIdRef. Cancel it here so the
    // network call actually stops. Silent — the user chose to move on, they don't need a banner.
    if (sending && adapter.chat.abort) {
      userAbortedRef.current = true
      try { adapter.chat.abort() } catch (e) { console.error('adapter.chat.abort threw', e) }
    }
    setActive(id); setMessages([]); setStreaming(''); setRailOpen(false)
    try {
      const r = await adapter.messages.list(id)
      if (activeIdRef.current !== id) return // superseded by a newer click — discard.
      if (r.ok) { setMessages(r.value.messages); resolveUrls(r.value.messages) }
    } catch (e) {
      if (activeIdRef.current !== id) return
      console.error('messages.list failed', e)
    }
  }

  async function newSession() {
    const r = await adapter.sessions.create()
    // Mirrors the rename/delete failure handling below (#22) — a failed create
    // used to be swallowed silently, so "+ New chat" would appear to just do
    // nothing with no feedback. Surface it the same way.
    if (!r.ok) { setMsg(r.error?.message || 'Could not start a new chat.'); return }
    await loadSessions(); selectSession(r.value.id)
  }

  function startRename(s: LivSession) { setConfirmDeleteId(null); setRenaming(s.id); setRenameDraft(s.title || '') }
  function cancelRename() { setRenaming(null); setRenameDraft('') }
  async function commitRename(s: LivSession) {
    if (renamingIdRef.current !== s.id) return // Enter/Escape already handled this; ignore the follow-up onBlur.
    const title = renameDraft.trim()
    setRenaming(null)
    if (!title || title === (s.title || '')) return
    const r = await adapter.sessions.rename(s.id, title)
    if (!r.ok) { setMsg(r.error?.message || 'Could not rename.'); return }
    loadSessions()
  }

  async function confirmDelete(s: LivSession) {
    setConfirmDeleteId(null)
    const r = await adapter.sessions.delete(s.id)
    if (!r.ok) { setMsg(r.error?.message || 'Could not delete.'); return }
    if (activeId === s.id) { setActive(null); setMessages([]) }
    loadSessions()
  }

  // overrideText/overrideFiles let a caller (the pendingRequest autoSend path) send explicit
  // content without round-tripping through draft/files state first — draft/files updates are
  // async (setState), so reading them back via closure on the same tick would see stale values.
  // The composer's own Send button/Enter-key calls send() with no args, falling back to draft/
  // files exactly as before this override was added.
  async function send(overrideText?: string, overrideFiles?: File[]) {
    const text = (overrideText ?? draft).trim()
    const draftFiles = overrideFiles ?? files
    if ((!text && draftFiles.length === 0) || sending) return
    // Fresh send — any prior abort flag from an earlier turn is stale, don't let it silence
    // a legitimate error this turn.
    userAbortedRef.current = false
    // The user just sent a turn — jump to and follow the newest message even if they'd scrolled
    // up to re-read earlier (the auto-follow effect only scrolls when pinned).
    pinnedRef.current = true
    setSending(true); setMsg('')

    let sessionId = activeId
    const stillActive = () => activeIdRef.current === sessionId
    // The backend names an untitled session from the FIRST exchange; if this send
    // is that first exchange, refresh the rail again shortly after so the smart
    // title (generated in the background, server-side) appears without a reload.
    const isFirstExchange = messages.length === 0
    // Declared out here (not inside the try) so the catch/abort path can also read whatever text
    // streamed in before a mid-stream Stop — see partialTurnToAppend below.
    let acc = ''

    try {
      if (!sessionId) {
        // Create the session UNTITLED. The backend names it from an intelligent
        // summary of the first exchange (see displayTitle above); the title
        // arrives on a later session-list refresh, so we never write a raw-echo
        // title here that would pre-empt (and permanently win over) that summary.
        const r = await adapter.sessions.create()
        if (!r.ok) { setMsg('Could not start a conversation.'); return }
        sessionId = r.value.id
        setActive(sessionId)
        await loadSessions()
      }

      const tmpId = `tmp-${Math.round(performance.now())}-${sessions.length}`
      const localPath = (i: number) => `local:${tmpId}:${i}`
      const sentFiles = draftFiles
      const optimistic: LivMessage = {
        id: tmpId, role: 'user', modality: 'text', channel: 'console',
        content: text, attachments: sentFiles.map((f, i) => ({ kind: 'image', path: localPath(i), mime: f.type })),
      }
      if (stillActive()) {
        setMessages((m) => [...m, optimistic])
        setUrls((u) => ({ ...u, ...Object.fromEntries(sentFiles.map((f, i) => [localPath(i), URL.createObjectURL(f)])) }))
      }
      setDraft(''); setFiles([])
      if (fileRef.current) fileRef.current.value = ''

      if (stillActive()) { setStreaming(''); setToolActivity(null) }
      const res = await adapter.chat.send({ sessionId, text, files: sentFiles }, (chunk) => {
        if (!stillActive()) return
        if (typeof chunk === 'string') { acc += chunk; setStreaming(acc) }
        // A tool starting shows the activity line; its end clears it (the next
        // text delta or another tool's start takes over from here).
        else setToolActivity(chunk.phase === 'end' ? null : chunk)
      })

      if (stillActive()) {
        setStreaming(''); setToolActivity(null)
        if (res.ok) {
          // Token + cost meter: accumulate this turn's usage (backend reports it
          // on the stream's `done` event). Independent of which session is open —
          // it's a running total for the console, reset by tapping the meter.
          if (res.usage) addUsage(res.usage)
          // Hands-free: read the reply aloud (app voice, else browser TTS).
          if (handsFree && !hostOwnsHandsFreeVoice && acc.trim()) speak(acc)
        } else if (!userAbortedRef.current) {
          // Suppress this branch entirely on a user-initiated Stop — the message shape can vary
          // per adapter (some resolve with {ok:false, error:{message:'ABORT'}} instead of throwing),
          // and painting a "couldn't reply" banner for something the user just told us to cancel
          // reads as a failure they didn't cause.
          const em = res.error?.message
          if (em === 'NO_KEY' || res.error?.detail?.includes('Anthropic key')) {
            if (showKey) setBrainOpen(true)
            setMsg('Add your Anthropic key so ' + hat.name + ' can reply. Your message is saved either way.')
          } else {
            setMsg(em || (hat.name + " couldn't reply."))
          }
        }
      }
      const r = await adapter.messages.list(sessionId)
      if (stillActive() && r.ok) {
        // If the user hit Stop mid-stream, keep the partial reply that already arrived (matching
        // Claude — the text you already got stays). Appended to the SERVER-reloaded list, with a
        // dedup guard inside partialTurnToAppend so a backend that itself persisted the partial
        // doesn't produce a second identical bubble.
        const partial = partialTurnToAppend(userAbortedRef.current, acc, r.value.messages,
          () => `partial-${sessionId}-${Math.round(performance.now())}`)
        const next = partial ? [...r.value.messages, partial] : r.value.messages
        setMessages(next); resolveUrls(next)
      }
      // The server-confirmed message(s) just replaced the optimistic one above, so
      // its local blob preview URL(s) are no longer referenced anywhere — revoke
      // them instead of leaking them for the life of the session.
      if (sentFiles.length) {
        setUrls((u) => {
          const next = { ...u }
          let changed = false
          sentFiles.forEach((_, i) => {
            const p = localPath(i)
            if (next[p]) { URL.revokeObjectURL(next[p]); delete next[p]; changed = true }
          })
          return changed ? next : u
        })
      }
      loadSessions()
      // Pick up the server-generated summary title for a brand-new thread.
      if (isFirstExchange) setTimeout(() => { loadSessions() }, 2500)
    } catch (e: unknown) {
      // Native DOMException from a fetch abort has name === 'AbortError'; some adapters wrap and
      // re-throw with their own shape. `userAbortedRef` is the reliable signal — set BY the code
      // that called abort() — so we don't have to enumerate every adapter's abort-error variant.
      const aborted = userAbortedRef.current || (e as Error)?.name === 'AbortError'
      if (!aborted) console.error('chat send threw', e)
      if (stillActive()) {
        setStreaming(''); setToolActivity(null)
        if (aborted) {
          // Adapter threw (AbortError) instead of resolving {ok:false}; still keep whatever
          // streamed so far as a partial assistant turn. There's no server reload on this path,
          // so append to the current transcript state.
          setMessages((m) => {
            const partial = partialTurnToAppend(true, acc, m,
              () => `partial-${sessionId}-${Math.round(performance.now())}`)
            return partial ? [...m, partial] : m
          })
        } else {
          setMsg((e as Error)?.message || 'Something went wrong sending your message. Please try again.')
        }
      }
    } finally { setSending(false) }
  }

  // Read text aloud: the app's own voice if it supplies one, else the browser's speechSynthesis.
  async function speak(text: string) {
    if (!text.trim()) return
    try {
      if (adapter.voice?.speak) { await adapter.voice.speak(text); return }
      const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
      if (synth) { synth.cancel(); synth.speak(new SpeechSynthesisUtterance(text)) }
    } catch (e) { console.error('speak failed', e) }
  }
  function stopSpeaking() {
    adapter.voice?.stop?.()
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
  }
  // Browser dictation into the composer. Interim results stream in; final text appends to the draft.
  function toggleMic() {
    if (listening) { recognitionRef.current?.stop(); return }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false
    let base = draft // whatever was already in the composer when dictation started
    let sessionFinal = '' // finalized speech accumulated since the last rebase below
    let lastWritten = draft // what WE last wrote, to detect external changes to draft
    rec.onresult = (e: SpeechRecEvent) => {
      if (draftRef.current !== lastWritten) {
        // The composer changed for a reason other than our own last write (typed manually
        // while listening, or cleared by send()) — respect it as the new base instead of
        // overwriting it with our stale accumulator on this result.
        base = draftRef.current
        sessionFinal = ''
      }
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) sessionFinal = (sessionFinal ? sessionFinal + ' ' : '') + t
        else interim += t
      }
      const dictated = sessionFinal + (interim ? (sessionFinal ? ' ' : '') + interim : '')
      const next = ((base && dictated ? base + ' ' : base) + dictated).trim()
      lastWritten = next
      setDraft(next)
    }
    rec.onend = () => {
      setListening(false); recognitionRef.current = null
      // Hands-free auto-send: when the user pauses long enough that the recognizer ends
      // its utterance (continuous=false means one utterance = one onend), and hands-free
      // is on, send the transcript and restart the mic so it's a natural back-and-forth
      // without tapping Send between turns. This is the whole point of hands-free — Jeff:
      // "hands free takes my voice as text but does not transmit it to the chat I have to
      // hit send" (2026-08-09). Without this the speaker toggle only handled the reply
      // half of hands-free (TTS-on-reply), not the send half.
      if (handsFreeRef.current && sessionFinal.trim()) {
        const utter = sessionFinal.trim()
        setDraft(''); // clear the composer immediately
        send(utter)
        // Restart the mic after a short beat so it isn't listening to Liv's TTS reply
        // (via adapter.voice.speak → the browser's own speech-out). The 200ms is a small
        // grace; a proper mic-vs-TTS gate would await voice.speak's end, but this covers
        // the common case where the user's speech is quicker than Liv's reply.
        setTimeout(() => { if (handsFreeRef.current) toggleMic() }, 200)
      }
    }
    rec.onerror = () => { setListening(false); recognitionRef.current = null }
    recognitionRef.current = rec
    setListening(true)
    rec.start()
  }

  async function copyMessage(id: string, text?: string | null) {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500)
    } catch { setMsg('Could not copy — clipboard access was blocked.') }
  }

  // Export the whole open conversation as a downloaded Markdown file (the conversation-level
  // counterpart to per-turn copy). The transcript rendering is the pure transcriptToMarkdown
  // helper; this just wraps it in a Blob and clicks a temporary <a download>. No-op with an
  // empty transcript (the affordance is disabled there anyway).
  function downloadTranscript() {
    if (!messages.length) return
    try {
      const md = transcriptToMarkdown(messages, { hatName: hat.name })
      const d = new Date()
      const p = (n: number) => String(n).padStart(2, '0')
      const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = transcriptFilename(hat.name, stamp)
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Revoke on the next tick so the download has grabbed the blob first.
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (e) {
      console.error('transcript export failed', e)
      setMsg('Could not export the conversation.')
    }
  }

  async function saveKey() {
    if (!adapter.key) return
    const patch: { apiKey?: string; model?: string } = {}
    if (keyInput.trim()) patch.apiKey = keyInput.trim()
    if (modelInput) patch.model = modelInput
    if (!patch.apiKey && !patch.model) return
    const r = await adapter.key.set(patch)
    if (r.ok) { setKeyInfo({ hasKey: r.value.hasKey, model: r.value.model }); setKeyInput(''); setMsg('Saved. ' + hat.name + ' can reply now.') }
    else setMsg(r.error?.message || 'Could not save key.')
  }

  // ── styles (inline, token-driven) ──
  const S = {
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
    transcript: { flex: '1 1 auto', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: space.sm, padding: space.xs, minHeight: 0, maxHeight: 460 } as CSSProperties,
    input: { ...textStyle('body'), width: '100%', boxSizing: 'border-box', color: cssVar.ink, background: cssVar.bg, border: `1px solid ${cssVar.border}`, borderRadius: radius.md, padding: '9px 12px' } as CSSProperties,
    primaryBtn: { ...textStyle('label'), background: accent, color: cssVar.onPrimary, border: 0, borderRadius: radius.md, padding: '9px 14px', cursor: 'pointer' } as CSSProperties,
    ghostBtn: { ...textStyle('label'), background: 'transparent', color: cssVar.ink, border: `1px solid ${cssVar.border}`, borderRadius: radius.md, padding: '7px 10px', cursor: 'pointer' } as CSSProperties,
  }

  function bubbleStyle(role: string): CSSProperties {
    const liv = role === 'liv'
    return {
      maxWidth: '86%', alignSelf: liv ? 'flex-start' : 'flex-end',
      borderRadius: radius.md, padding: '8px 12px', border: `1px solid ${cssVar.border}`,
      background: liv ? cssVar.surface : 'color-mix(in srgb, var(--lc-accent) 12%, ' + cssVar.surface + ')',
    }
  }

  return (
    <section className="lc-root" style={{ ...S.card, ['--lc-accent' as string]: accent }}>
      <div style={S.head}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 0 }}>
          {/* History (N) pill — always visible, opens the slide-in drawer over the transcript.
              Matches Tummyful's `.commis-history-btn`. Text style is subtle so it doesn't
              compete with the hat identity in the header. */}
          <button
            type="button"
            className="lc-iconbtn"
            aria-expanded={railOpen}
            aria-label="Past conversations"
            title="Past conversations"
            onClick={() => setRailOpen((o) => !o)}
            style={{ ...textStyle('caption'), background: 'transparent', border: `1px solid ${cssVar.border}`,
              borderRadius: radius.pill, padding: '3px 10px', color: cssVar.mid, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <MenuI /> History{sessions.length ? ` (${sessions.length})` : ''}
          </button>
          {/* Export the whole conversation as a Markdown download (conversation-level counterpart
              to the per-turn copy button). Disabled until there's something to export. */}
          <button
            type="button"
            className="lc-iconbtn"
            style={{ ...S.iconbtn, opacity: messages.length ? 1 : 0.4 }}
            disabled={!messages.length}
            aria-label="Export conversation"
            title="Export this conversation (Markdown)"
            onClick={downloadTranscript}
          >
            <DownloadI />
          </button>
        </div>
        <h2 style={{ ...textStyle('h3'), margin: 0, display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 0, flex: 1, justifyContent: 'center' }}>
          {hat.glyph && <Glyph variant={hat.glyph} size={22} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{hat.name}{hat.subtitle && <span style={{ ...S.muted, marginLeft: 6 }}>· {hat.subtitle}</span>}</span>
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 0 }}>
          {(() => {
            const totalTok = (usage.input || 0) + (usage.output || 0)
            if (totalTok <= 0) return null
            const cost = usageCost(usage, keyInfo.model)
            return (
              <button
                type="button"
                className="lc-iconbtn"
                title={`${totalTok.toLocaleString()} tokens this session total · estimated ${keyInfo.model || 'model'} list cost — tap to reset`}
                onClick={() => { setUsage({ input: 0, output: 0, cacheCreate: 0, cacheRead: 0 }); setLastTurn(null) }}
                style={{ background: 'transparent', border: `1px solid ${cssVar.border}`, borderRadius: radius.sm, padding: '3px 7px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, lineHeight: 1.1 }}
              >
                <span style={{ ...textStyle('overline'), color: accent, fontWeight: 700 }}>${cost.toFixed(4)}</span>
                <span style={{ ...textStyle('overline'), color: cssVar.dim }}>{totalTok.toLocaleString()} tok</span>
              </button>
            )
          })()}
          {/* Brain pill moved into the composer (see onelyf-planning/docs/liv-chat-canon.md — Tummyful's
              placement is canon). The header now only carries the token/cost meter + optional
              dock controls; API-key entry, model selector, and usage breakdown all live in the
              composer's Brain popover next to attach/mic/send. */}
          {/* Dock controls — only when a floating host supplies them. Chevron-down collapses
              back to the launcher (conversation kept); X dismisses. */}
          {onMinimize && (
            <button type="button" className="lc-iconbtn" style={S.iconbtn} onClick={onMinimize} title="Minimize" aria-label="Minimize Liv"><ChevronDownI /></button>
          )}
          {onClose && (
            <button type="button" className="lc-iconbtn" style={S.iconbtn} onClick={onClose} title="Close" aria-label="Close Liv"><CloseI /></button>
          )}
        </div>
      </div>
      {hat.intro && <p style={{ ...S.muted, marginTop: 6 }}>{hat.intro}</p>}

      {/* Header BYO-key settings panel removed — API key + model select now live inside the
          composer's Brain popover (search `brainOpen` in the composer block below), per canon. */}

      <div className="lc-body" data-rail-open={railOpen || undefined} style={S.body}>
        {railOpen && (
        <aside className="lc-rail" data-open={railOpen} style={S.rail}>
          <button className="ds-btn" style={{ ...S.ghostBtn, width: '100%' }} onClick={newSession}>+ New chat</button>
          {sessions.length === 0 && <p style={S.muted}>No conversations yet.</p>}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sessions.map((s) => (
              <li key={s.id} className="lc-session" data-active={s.id === activeId} style={S.sessionRow}>
                {renamingId === s.id ? (
                  <input className="ds-input" autoFocus style={{ ...S.input, flex: 1, minWidth: 0, padding: '5px 8px', borderColor: accent }}
                    value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitRename(s) } else if (e.key === 'Escape') { e.preventDefault(); cancelRename() } }}
                    onBlur={() => commitRename(s)} />
                ) : (
                  <>
                    <button style={S.sessionOpen} onClick={() => selectSession(s.id)}>
                      <span style={S.sessionTitle}>{displayTitle(s.title)}</span>
                      <span style={{ color: cssVar.dim, lineHeight: 0 }} title={s.channel} aria-label={s.channel}><ChannelIcon channel={s.channel} /></span>
                    </button>
                    {confirmDeleteId === s.id ? (
                      <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        <button className="lc-iconbtn" style={{ ...S.iconbtn, ...textStyle('caption'), color: cssVar.danger }} onClick={() => confirmDelete(s)}>Delete</button>
                        <button className="lc-iconbtn" style={{ ...S.iconbtn, ...textStyle('caption') }} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                      </span>
                    ) : (
                      <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        <button className="lc-iconbtn" style={S.iconbtn} title="Rename" onClick={() => startRename(s)}><PencilI /></button>
                        <button className="lc-iconbtn" style={S.iconbtn} title="Delete" onClick={() => { setRenaming(null); setConfirmDeleteId(s.id) }}><TrashI /></button>
                      </span>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </aside>
        )}

        <div className="lc-main" style={S.main}>
          <div className="lc-transcript" ref={transcriptRef} style={S.transcript} onScroll={onTranscriptScroll}>
            {messages.length === 0 && !streaming && (
              <div style={{ margin: 'auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space.sm, padding: `${space.md}px ${space.sm}px`, maxWidth: 460 }}>
                {hat.glyph && <Glyph variant={hat.glyph} size={64} />}
                <h3 style={{ ...textStyle('h2'), margin: 0 }}>Ask {hat.name}</h3>
                {(hat.description || hat.emptyText) && (
                  <p style={{ ...S.muted, margin: 0 }}>{hat.description || hat.emptyText}</p>
                )}
                {hat.pills && hat.pills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 2 }}>
                    {hat.pills.map((p, i) => (
                      <span key={i} style={{ ...textStyle('caption'), border: `1px solid ${accent}`, color: accent, borderRadius: radius.pill, padding: '3px 10px' }}>{p}</span>
                    ))}
                  </div>
                )}
                {hat.suggestions && hat.suggestions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: space.xs }}>
                    {hat.suggestions.slice(0, 4).map((sug, i) => (
                      <button key={i} type="button" className="ds-btn ds-btn--ghost" style={{ ...S.ghostBtn, ...textStyle('caption'), padding: '6px 10px', textAlign: 'left' }}
                        onClick={() => setDraft(sug)}>{sug}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className="lc-bubble" style={bubbleStyle(m.role)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ ...textStyle('overline'), color: cssVar.mid }}>{m.role === 'liv' ? hat.name : 'You'}</span>
                  <ModalityPill modality={m.modality} />
                  {m.content && (
                    <button className="lc-copy lc-iconbtn" style={{ ...S.iconbtn, marginLeft: 'auto' }} title="Copy message" onClick={() => copyMessage(m.id, m.content)}>
                      {copiedId === m.id ? (<><CheckI /> <span style={textStyle('caption')}>Copied</span></>) : <CopyI />}
                    </button>
                  )}
                </div>
                {attachmentsOf(m).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: m.content ? 6 : 0 }}>
                    {attachmentsOf(m).map((a, i) => (
                      urls[a.path]
                        ? <img key={i} src={urls[a.path]} alt="attachment" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: radius.sm, border: `1px solid ${cssVar.border}` }} />
                        : <span key={i} style={{ width: 84, height: 84, display: 'grid', placeItems: 'center', borderRadius: radius.sm, border: `1px dashed ${cssVar.border}`, color: cssVar.dim }}><ImageI /></span>
                    ))}
                  </div>
                )}
                {m.content && <div style={{ ...textStyle('body'), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.content}</div>}
              </div>
            ))}
            {(streaming || toolActivity) && (
              <div className="lc-bubble" style={bubbleStyle('liv')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ ...textStyle('overline'), color: cssVar.mid }}>{hat.name}</span>
                  <ModalityPill modality="text" />
                  {/* Stop — only when the adapter exposes an abort port; a click cancels the
                      in-flight reply so a slow answer stops burning tokens. Placed right of the
                      pill in the streaming bubble's own header so it sits with the "in flight"
                      signal, not in the composer where the send arrow already lives. */}
                  {adapter.chat.abort && (
                    <button
                      type="button"
                      className="lc-iconbtn"
                      style={{ ...S.iconbtn, marginLeft: 'auto', ...textStyle('caption'), color: cssVar.mid, padding: '2px 8px', border: `1px solid ${cssVar.border}`, borderRadius: radius.pill }}
                      onClick={stop}
                      title="Stop generating"
                      aria-label="Stop generating"
                    >
                      Stop
                    </button>
                  )}
                </div>
                {toolActivity && <ToolActivityLine activity={toolActivity} brandIcon={hat.toolIcon} labels={hat.toolLabels} />}
                {/* The caret only trails live text; while a tool runs (no text yet)
                    the activity line above carries the "working" signal instead. */}
                {streaming && (
                  <div style={{ ...textStyle('body'), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{streaming}<span className="lc-caret">▍</span></div>
                )}
              </div>
            )}
            {/* Action-card stack — moved to render AFTER the streaming bubble so cards from the
                LAST completed turn sit closest to the composer (where the user's attention is
                after they read the reply). Only rendered when the app supplies actionQueue. */}
            {actionQueue && actionQueue.cards.length > 0 && (() => {
              const cards = actionQueue.cards.map((c) => {
                const overlay = cardState[c.id]
                return { ...c, status: overlay?.status ?? c.status ?? 'pending', result: overlay?.result ?? c.result }
              })
              const readyCount = cards.filter((c) => c.status !== 'done' && c.ready !== false).length
              const showBatch = cards.length > 1 && !!actionQueue.onApplyAll
              return (
                <div className="lc-cards" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: space.sm }}>
                  {actionQueue.introText !== '' && (
                    <p style={{ ...S.muted, margin: 0 }}>
                      {actionQueue.introText || (hat.name + (cards.length === 1 ? ' proposes this change. Nothing happens until you tap Apply:' : ' proposes these changes. Nothing happens until you tap Apply:'))}
                    </p>
                  )}
                  {showBatch && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', border: `1px solid ${cssVar.border}`, borderRadius: radius.md, background: cssVar.surface }}>
                      <ul style={{ ...textStyle('caption'), color: cssVar.mid, listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                        {cards.map((c) => (
                          <li key={c.id} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: c.status === 'done' ? 'line-through' : undefined }}>
                            {c.summary}{c.status === 'done' ? ' — done' : ''}
                          </li>
                        ))}
                      </ul>
                      <button className="ds-btn" style={{ ...S.primaryBtn, whiteSpace: 'nowrap' }}
                        disabled={!readyCount || applyAllBusy} onClick={applyAllCards}
                        title={readyCount ? 'Apply every ready change above in one tap' : 'No cards are ready yet'}>
                        {applyAllBusy ? 'Applying all…' : `Apply all (${readyCount})`}
                      </button>
                    </div>
                  )}
                  {cards.map((c) => {
                    const done = c.status === 'done', err = c.status === 'error', applying = c.status === 'applying'
                    const notReady = c.ready === false
                    return (
                      <div key={c.id} className="lc-card" style={{
                        border: `1px solid ${cssVar.border}`, borderRadius: radius.md,
                        background: cssVar.surface, padding: 10,
                        opacity: done ? 0.72 : 1,
                        display: 'flex', flexDirection: 'column', gap: 6,
                      }}>
                        <div style={{ ...textStyle('bodySm'), color: cssVar.ink }}>{c.summary}</div>
                        {!done && c.renderBody && <div>{c.renderBody()}</div>}
                        {!done && c.note && <p style={{ ...S.muted, margin: 0 }}>{c.note}</p>}
                        {done ? (
                          <p style={{ ...textStyle('caption'), color: cssVar.mid, margin: 0 }}>{c.result ? `✓ ${c.result}` : '✓ Applied'}</p>
                        ) : err ? (
                          <>
                            <p style={{ ...textStyle('caption'), color: cssVar.danger, margin: 0 }}>{c.result || 'Could not apply.'}</p>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="ds-btn" style={S.primaryBtn} disabled={notReady} onClick={() => applyCard(c.id)}>Retry</button>
                              <button className="ds-btn" style={S.ghostBtn} onClick={() => dismissCard(c.id)}>Dismiss</button>
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="ds-btn" style={{ ...S.primaryBtn, opacity: (notReady || applying) ? 0.6 : 1 }}
                              disabled={notReady || applying} onClick={() => applyCard(c.id)}
                              title={notReady ? "Needs a detail — tell " + hat.name + " the missing part and it'll update this card" : 'Apply this change'}>
                              {applying ? 'Applying…' : 'Apply'}
                            </button>
                            <button className="ds-btn" style={S.ghostBtn} onClick={() => dismissCard(c.id)}>Dismiss</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          <div style={{ marginTop: space.sm, borderTop: `1px solid ${cssVar.border}`, paddingTop: space.sm, flex: '0 0 auto' }}>
            {files.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {files.map((f, i) => (
                  <span key={i} style={{ ...textStyle('caption'), background: cssVar.track, borderRadius: radius.pill, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%', overflowWrap: 'anywhere' }}><ImageI /> {f.name}</span>
                ))}
              </div>
            )}
            <textarea className="ds-input" style={{ ...S.input, width: '100%', resize: 'none', minHeight: 44, maxHeight: 160 }}
              placeholder={hat.placeholder || `Message ${hat.name}…`}
              value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (shouldSendOnEnter(e.key, e.shiftKey, e.nativeEvent.isComposing, enterSends)) { e.preventDefault(); send() } }}
              rows={1} />
            {/* Toolbar row — canonical order per onelyf-planning/docs/liv-chat-canon.md:
                `+ | Brain ▾ | actions ▾ | (spacer) | 🔊 | 🎙 | ↑`. Speaker + mic sit right
                next to the send button. Brain pill holds model + API key + settings that
                previously lived in the header. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              {showAttach && adapter.attachments && (
                <>
                  <button className="lc-iconbtn" style={S.composerIconbtn} title="Attach image" aria-label="Attach image" onClick={() => fileRef.current?.click()}><PlusI /></button>
                  <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                </>
              )}
              {/* Brain pill: model + API-key + provider settings, all folded together. Gated on
                  showKey (which respects hat.enableKey === false — a hat that opts out gets no
                  Brain pill at all). Popover mirrors Tummyful/Cash Stash's Brain menus. */}
              {showKey && (
                <div style={{ position: 'relative', display: 'inline-flex' }}>
                  {/* Brain pill: opaque surface backing + accent border, matching Tummyful's
                      original `.composer-modelpill` canon — was `background: transparent` with
                      a subtle grey border, which read as a floating word rather than a pill
                      button (Jeff 2026-08-09: "I want the terra cotta pill backing for the
                      buttons not just a glow"). Every consumer now gets the pill shape; the
                      accent color they wear (terracotta / green) still comes from their own
                      hat.accent, so this stays palette-agnostic. */}
                  <button type="button" className="lc-iconbtn ds-btn"
                    style={{ ...textStyle('caption'), color: accent, background: cssVar.surface, border: `1px solid ${accent}`, borderRadius: radius.pill, padding: '4px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                    title="Brain — model + API key" aria-label="Brain — model, API key, and settings"
                    aria-expanded={brainOpen} onClick={() => setBrainOpen((o) => !o)}>
                    <span>{keyInfo.hasKey ? (models.find((m) => m.id === (keyInfo.model || modelInput))?.label.split('·')[0].trim() || 'Model') : 'Add Key'}</span>
                    <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
                  </button>
                  {brainOpen && (
                    <>
                      {/* Click-out overlay — same pattern the actions popover below uses. */}
                      <div onClick={() => setBrainOpen(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'transparent' }} />
                      <div role="menu" style={{
                        position: 'absolute', bottom: '100%', left: 0, marginBottom: 6,
                        minWidth: 240, maxWidth: 320, zIndex: 31,
                        background: cssVar.surface, border: `1px solid ${cssVar.border}`,
                        borderRadius: radius.md, padding: 10, boxShadow: 'var(--ds-shadow-card)',
                        display: 'flex', flexDirection: 'column', gap: 8,
                      }}>
                        <div style={{ ...textStyle('overline'), color: accent, fontWeight: 700 }}>Brain</div>
                        <p style={{ ...S.muted, margin: 0 }}>
                          {hat.name} replies using <strong>your own Anthropic key</strong>.
                          {keyInfo.hasKey ? ' A key is set.' : ' No key yet.'}
                        </p>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ ...textStyle('caption'), color: cssVar.mid }}>API Key</span>
                          <input className="ds-input" type="password" style={{ ...S.input, width: '100%', boxSizing: 'border-box' }}
                            placeholder={keyInfo.hasKey ? 'Replace key (sk-ant-…)' : 'Anthropic key (sk-ant-…)'}
                            value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
                        </label>
                        {models.length > 1 && (
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ ...textStyle('caption'), color: cssVar.mid }}>Model</span>
                            <select className="ds-input" style={{ ...S.input, width: '100%', boxSizing: 'border-box' }}
                              value={keyInfo.model || modelInput}
                              onChange={async (e) => {
                                const id = e.target.value
                                setModelInput(id)
                                const r = await adapter.key!.set({ model: id })
                                if (r.ok) setKeyInfo((k) => ({ ...k, model: id }))
                                else setMsg(r.error?.message || 'Could not switch model.')
                              }}>
                              {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                            </select>
                          </label>
                        )}
                        {/* Persona tier selector — Cash Stash Advisor's Standard/Premium pattern.
                            Only rendered when the hat opts in via hat.tiers + LivChatProps.tier
                            /onTierChange. Ignored for hats without a tier concept (Commis today). */}
                        {hat.tiers && hat.tiers.length > 0 && onTierChange && (
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ ...textStyle('caption'), color: cssVar.mid }}>Tier</span>
                            <select className="ds-input" style={{ ...S.input, width: '100%', boxSizing: 'border-box' }}
                              value={tier ?? hat.tiers[0].id}
                              onChange={(e) => onTierChange(e.target.value)}>
                              {hat.tiers.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                          </label>
                        )}
                        {/* Usage rows — Today / Session / Last Turn / Balance, matching Tummyful
                            + Cash Stash canon. Today is localStorage-backed, rolls over at local
                            midnight. Session + Last Turn + Balance are this-tab-only. Rendered
                            ALWAYS (even at zero) so the Brain menu doesn't look empty on a cold
                            session — Jeff 2026-08-09: "Brain menu still lacking". Empty rows
                            show a dimmed em-dash instead of hiding. */}
                        {(() => {
                          const totalTok = (usage.input || 0) + (usage.output || 0)
                          const sessionCost = usageCost(usage, keyInfo.model)
                          const lastTok = lastTurn ? (lastTurn.input || 0) + (lastTurn.output || 0) : 0
                          const lastCost = lastTurn ? usageCost(lastTurn, keyInfo.model) : 0
                          const dailyTok = (daily.input || 0) + (daily.output || 0)
                          const dailyCost = usageCost(daily, keyInfo.model)
                          const row = { display: 'flex', justifyContent: 'space-between', gap: 8, ...textStyle('caption') } as CSSProperties
                          const val = (cost: number, tok: number) => tok > 0
                            ? { text: `$${cost.toFixed(4)} · ${tok.toLocaleString()} tok`, color: cssVar.ink }
                            : { text: '—', color: cssVar.dim }
                          const today = val(dailyCost, dailyTok)
                          const session = val(sessionCost, totalTok)
                          const last = val(lastCost, lastTok)
                          const balText = totalTok > 0
                            ? `${(usage.input || 0).toLocaleString()} in · ${(usage.output || 0).toLocaleString()} out`
                            : '—'
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: `1px solid ${cssVar.border}`, paddingTop: 8 }}>
                              <div style={row}><span style={{ color: cssVar.mid }}>Today</span><span style={{ color: today.color, fontVariantNumeric: 'tabular-nums' }}>{today.text}</span></div>
                              <div style={row}><span style={{ color: cssVar.mid }}>Session</span><span style={{ color: session.color, fontVariantNumeric: 'tabular-nums' }}>{session.text}</span></div>
                              <div style={row}><span style={{ color: cssVar.mid }}>Last Turn</span><span style={{ color: last.color, fontVariantNumeric: 'tabular-nums' }}>{last.text}</span></div>
                              <div style={row}><span style={{ color: cssVar.mid }}>Balance</span><span style={{ color: cssVar.dim, fontVariantNumeric: 'tabular-nums' }}>{balText}</span></div>
                            </div>
                          )
                        })()}
                        <button className="ds-btn" style={S.primaryBtn} onClick={async () => { await saveKey(); setBrainOpen(false); }}>Save</button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {/* Composer actions menu — Commis's chef's-knife popover ("turn this into…"),
                  Advisor's "add to budget" etc. DS owns the trigger + popover layout + click-out;
                  the app supplies items + handlers. The trigger uses hat.toolIcon when set (so
                  Commis gets its chef's knife), else a generic tool glyph. */}
              {actions && actions.length > 0 && (
                <div style={{ position: 'relative', display: 'inline-flex' }}>
                  <button type="button" className="lc-iconbtn"
                    style={{ ...S.composerIconbtn,
                      background: actionsOpen ? accent : cssVar.surface,
                      borderColor: actionsOpen ? accent : cssVar.borderBright,
                      color: actionsOpen ? cssVar.onPrimary : cssVar.ink }}
                    title="Actions" aria-label="Actions" aria-expanded={actionsOpen} aria-haspopup="menu"
                    onClick={() => setActionsOpen((o) => !o)}>
                    {hat.toolIcon ?? <ToolI />}
                  </button>
                  {actionsOpen && (
                    <>
                      {/* Click-out overlay — a full-viewport transparent div under the popover
                          that dismisses on any tap outside. Under (z-index-wise) the popover
                          itself so items still receive their own clicks. */}
                      <div onClick={() => setActionsOpen(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'transparent' }} />
                      <div className="lc-actions-menu" role="menu" style={{
                        position: 'absolute', bottom: '100%', left: 0, marginBottom: 6,
                        minWidth: 200, maxWidth: 280, zIndex: 31,
                        background: cssVar.surface, border: `1px solid ${cssVar.border}`,
                        borderRadius: radius.md, padding: 4, boxShadow: 'var(--ds-shadow-card)',
                        display: 'flex', flexDirection: 'column', gap: 1,
                      }}>
                        {actions.map((a) => (
                          <button key={a.id} type="button" role="menuitem"
                            className="lc-actions-item"
                            disabled={a.disabled}
                            style={{ ...textStyle('bodySm'), textAlign: 'left', background: 'transparent', border: 0,
                              padding: '8px 10px', borderRadius: radius.sm, cursor: a.disabled ? 'not-allowed' : 'pointer',
                              color: a.disabled ? cssVar.dim : cssVar.ink, opacity: a.disabled ? 0.6 : 1,
                              display: 'flex', flexDirection: 'column', gap: 2 }}
                            onClick={async () => { setActionsOpen(false); try { await a.onSelect() } catch (e) { console.error('action.onSelect threw', e) } }}>
                            <span>{a.label}</span>
                            {a.hint && <span style={{ ...textStyle('caption'), color: cssVar.mid }}>{a.hint}</span>}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              <div style={{ flex: 1 }} />
              {/* Voice: hands-free read-aloud (always available via browser TTS fallback) + mic
                  dictation (only where the browser supports speech-in). Right-cluster placement
                  next to send, per canon. Pressed states use filled backgrounds — Tummyful's
                  `.composer-icon.on` (hands-free accent fill) + `.composer-icon.listening`
                  (mic danger fill) — so the active mode is unmistakable at a glance, not
                  just a color shift on the SVG. */}
              <button type="button" className="lc-iconbtn"
                style={{ ...S.composerIconbtn,
                  background: handsFree ? accent : cssVar.surface,
                  borderColor: handsFree ? accent : cssVar.borderBright,
                  color: handsFree ? cssVar.onPrimary : cssVar.ink }}
                title="Hands-free — read replies aloud" aria-pressed={handsFree}
                onClick={() => setHandsFree((v) => {
                  const next = !v
                  // Fire onHandsFreeChange inside this user-gesture click handler so a consumer
                  // (Commis) can unlock iOS audio / prewarm the TTS session / start its own
                  // wake-word dictation. Must run BEFORE the state flip's re-render, or the
                  // gesture stack frame is already gone by the time the callback would fire.
                  try { onHandsFreeChange?.(next) } catch (e) { console.error('onHandsFreeChange threw', e) }
                  if (!next) stopSpeaking()
                  // Turning ON: also auto-start the mic so hands-free is one-tap. Turning OFF:
                  // stop the mic if it was running. Both under this same click, so any browser
                  // that requires a user gesture to grant mic sees this exact tap. Skipped entirely
                  // when the HOST owns the mic (hostOwnsHandsFreeVoice) — Commis then runs its own
                  // wake-word-gated recognizer, and LivChat's built-in ungated mic must stay off.
                  if (!hostOwnsHandsFreeVoice) {
                    if (next && !listening) toggleMic()
                    if (!next && listening) recognitionRef.current?.stop()
                  }
                  return next
                })}><SpeakerI /></button>
              {speechInSupported && (
                <button type="button" className="lc-iconbtn"
                  style={{ ...S.composerIconbtn,
                    background: listening ? cssVar.danger : cssVar.surface,
                    borderColor: listening ? cssVar.danger : cssVar.borderBright,
                    color: listening ? '#fff' : cssVar.ink }}
                  title={listening ? 'Stop dictation' : 'Dictate'} aria-pressed={listening} onClick={toggleMic}><MicI /></button>
              )}
              {/* Send button: flat accent fill (canon). While streaming, swap in a red stop
                  square so the abort control lives IN the send slot — matches Tummyful's
                  `.composer-send.stop` behavior, not a separate "Stop" pill floating above
                  the transcript. Only wired to an abort when the adapter supports it. */}
              {sending && adapter.chat.abort ? (
                <button
                  type="button"
                  className="ds-btn"
                  style={{ width: 40, height: 40, borderRadius: '50%', padding: 0, display: 'grid', placeItems: 'center',
                    background: cssVar.danger, color: '#fff', border: 0, cursor: 'pointer' }}
                  title="Stop" aria-label="Stop"
                  onClick={stop}>
                  <span style={{ fontSize: 12, lineHeight: 1 }}>■</span>
                </button>
              ) : (
                <button
                  className="ds-btn"
                  style={{ ...S.primaryBtn, width: 40, height: 40, borderRadius: '50%', padding: 0, display: 'grid', placeItems: 'center',
                    background: accent, color: cssVar.onPrimary,
                    opacity: (sending || (!draft.trim() && files.length === 0)) ? 0.5 : 1 }}
                  title="Send" aria-label="Send"
                  disabled={sending || (!draft.trim() && files.length === 0)} onClick={() => send()}>
                  {sending ? '…' : <ArrowUpI />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {msg && <p style={{ ...textStyle('caption'), color: accent, marginTop: space.sm }}>{msg}</p>}
    </section>
  )
}
