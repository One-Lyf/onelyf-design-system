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
export type LivChatSendResult =
  | { ok: true; usage?: LivUsage }
  | { ok: false; error?: { message?: string; detail?: string } }

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
// renders the in-flight `start`.
function ToolActivityLine({ activity, brandIcon }: { activity: LivToolActivity; brandIcon?: ReactNode }) {
  const isWeb = activity.name === 'web_search' || activity.name === 'fetch_url'
  const label = activity.name === 'web_search' ? 'Searching the web'
    : activity.name === 'fetch_url' ? 'Reading a page'
    : 'Working'
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
.lc-caret { animation: lc-blink 1s step-end infinite; }
@keyframes lc-blink { 50% { opacity: 0; } }
.lc-tool { animation: lc-fade-in .18s ease; }
@keyframes lc-fade-in { from { opacity: 0; } to { opacity: 1; } }
.lc-ellipsis { animation: lc-pulse 1.2s ease-in-out infinite; }
@keyframes lc-pulse { 50% { opacity: .3; } }
.lc-session:hover { background: var(--ds-surface-hi); }
.lc-session[data-active="true"] { background: color-mix(in srgb, var(--lc-accent) 14%, transparent); }
.lc-iconbtn:hover:not(:disabled) { background: var(--ds-track); }
.lc-copy { opacity: 0; transition: opacity .12s ease; }
.lc-bubble:hover .lc-copy, .lc-copy:focus-visible { opacity: 1; }
/* Below 620px the two-column grid collapses to one column and the session
   rail stops taking up permanent vertical space above the transcript —
   instead it's a toggleable sheet, shown/hidden via the .lc-rail-toggle
   button and overlaid above the transcript when open. */
@media (max-width: 620px) {
  .lc-body { grid-template-columns: 1fr !important; position: relative; }
  .lc-rail-toggle { display: inline-flex !important; }
  .lc-rail {
    display: none !important;
    position: absolute; top: 0; left: 0; right: 0; z-index: 20;
    max-height: 70vh; overflow-y: auto;
    background: var(--ds-surface); border: 1px solid var(--ds-border);
    border-radius: ${radius.md}px; padding: 8px;
    box-shadow: var(--ds-shadow-card);
  }
  .lc-rail[data-open="true"] { display: flex !important; }
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

export default function LivChat({ hat, adapter, onState, onMinimize, onClose }: LivChatProps) {
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
  function addUsage(u: LivUsage) {
    setUsage((p) => ({
      input: (p.input || 0) + (u.input || 0),
      output: (p.output || 0) + (u.output || 0),
      cacheCreate: (p.cacheCreate || 0) + (u.cacheCreate || 0),
      cacheRead: (p.cacheRead || 0) + (u.cacheRead || 0),
    }))
  }

  const [keyInfo, setKeyInfo] = useState<LivKeyInfo>({ hasKey: false, model: null })
  const [showSettings, setShowSettings] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [modelInput, setModelInput] = useState(models[0]?.id ?? 'claude-opus-4-8')

  const transcriptRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Mirrors activeId synchronously so in-flight async work can tell — the instant
  // it resolves — whether the user is STILL on the session it was fired for.
  const activeIdRef = useRef<string | null>(null)
  function setActive(id: string | null) { activeIdRef.current = id; setActiveId(id) }

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
    const el = transcriptRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streaming])

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

  async function selectSession(id: string) {
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

  async function send() {
    const text = draft.trim()
    if ((!text && files.length === 0) || sending) return
    setSending(true); setMsg('')

    let sessionId = activeId
    const stillActive = () => activeIdRef.current === sessionId
    // The backend names an untitled session from the FIRST exchange; if this send
    // is that first exchange, refresh the rail again shortly after so the smart
    // title (generated in the background, server-side) appears without a reload.
    const isFirstExchange = messages.length === 0

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
      const sentFiles = files
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
      let acc = ''
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
          if (handsFree && acc.trim()) speak(acc)
        } else {
          const em = res.error?.message
          if (em === 'NO_KEY' || res.error?.detail?.includes('Anthropic key')) {
            if (showKey) setShowSettings(true)
            setMsg('Add your Anthropic key so ' + hat.name + ' can reply. Your message is saved either way.')
          } else {
            setMsg(em || (hat.name + " couldn't reply."))
          }
        }
      }
      const r = await adapter.messages.list(sessionId)
      if (stillActive() && r.ok) { setMessages(r.value.messages); resolveUrls(r.value.messages) }
      loadSessions()
      // Pick up the server-generated summary title for a brand-new thread.
      if (isFirstExchange) setTimeout(() => { loadSessions() }, 2500)
    } catch (e: unknown) {
      console.error('chat send threw', e)
      if (stillActive()) {
        setStreaming(''); setToolActivity(null)
        setMsg((e as Error)?.message || 'Something went wrong sending your message. Please try again.')
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
    rec.onend = () => { setListening(false); recognitionRef.current = null }
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
    card: { background: cssVar.surface, border: `1px solid ${cssVar.border}`, borderRadius: radius.lg, padding: space.md, boxSizing: 'border-box', maxWidth: '100%', minWidth: 0, overflowX: 'hidden' } as CSSProperties,
    head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.sm } as CSSProperties,
    muted: { ...textStyle('caption'), color: cssVar.mid } as CSSProperties,
    body: { display: 'grid', gridTemplateColumns: 'minmax(140px, 200px) 1fr', gap: space.md, marginTop: space.md, minHeight: 320 } as CSSProperties,
    rail: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } as CSSProperties,
    sessionRow: { display: 'flex', alignItems: 'center', gap: 4, borderRadius: radius.sm, padding: 2 } as CSSProperties,
    sessionOpen: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, background: 'transparent', border: 0, cursor: 'pointer', color: cssVar.ink, padding: '6px 8px', borderRadius: radius.sm } as CSSProperties,
    sessionTitle: { ...textStyle('bodySm'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as CSSProperties,
    iconbtn: { background: 'transparent', border: 0, color: cssVar.mid, cursor: 'pointer', borderRadius: radius.sm, padding: '4px 6px', display: 'inline-flex', alignItems: 'center', lineHeight: 0 } as CSSProperties,
    main: { display: 'flex', flexDirection: 'column', minWidth: 0 } as CSSProperties,
    transcript: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: space.sm, padding: space.xs, minHeight: 200, maxHeight: 460 } as CSSProperties,
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
        <h2 style={{ ...textStyle('h3'), margin: 0, display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 0 }}>
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
                onClick={() => setUsage({ input: 0, output: 0, cacheCreate: 0, cacheRead: 0 })}
                style={{ background: 'transparent', border: `1px solid ${cssVar.border}`, borderRadius: radius.sm, padding: '3px 7px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, lineHeight: 1.1 }}
              >
                <span style={{ ...textStyle('overline'), color: accent, fontWeight: 700 }}>${cost.toFixed(4)}</span>
                <span style={{ ...textStyle('overline'), color: cssVar.dim }}>{totalTok.toLocaleString()} tok</span>
              </button>
            )
          })()}
          {showKey && (
            <button className="lc-iconbtn ds-btn" style={S.ghostBtn} onClick={() => setShowSettings((s) => !s)}>
              {keyInfo.hasKey ? 'Brain' : 'Add key'}
            </button>
          )}
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

      {showKey && showSettings && (
        <div style={{ border: `1px solid ${cssVar.border}`, borderRadius: radius.md, padding: space.sm + 2, margin: `${space.sm}px 0` }}>
          <p style={S.muted}>
            {hat.name} replies using <strong>your own Anthropic key</strong> (reading past chats needs no key).
            {keyInfo.hasKey ? ' A key is set.' : ' No key yet.'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.sm, marginTop: 6 }}>
            <input className="ds-input" type="password" style={{ ...S.input, flex: 1, minWidth: 160 }}
              placeholder={keyInfo.hasKey ? 'Replace key (sk-ant-…)' : 'Anthropic key (sk-ant-…)'}
              value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
            <select className="ds-input" style={{ ...S.input, width: 'auto' }} value={modelInput} onChange={(e) => setModelInput(e.target.value)}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <button className="ds-btn" style={S.primaryBtn} onClick={saveKey}>Save</button>
          </div>
        </div>
      )}

      <div className="lc-body" style={S.body}>
        <button
          type="button"
          className="lc-rail-toggle ds-btn"
          style={{ ...S.ghostBtn, display: 'none', width: '100%', marginBottom: space.xs, alignItems: 'center', justifyContent: 'center', gap: 6 }}
          aria-expanded={railOpen}
          onClick={() => setRailOpen((o) => !o)}
        >
          <MenuI /> History{sessions.length ? ` (${sessions.length})` : ''}
        </button>
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

        <div style={S.main}>
          <div className="lc-transcript" ref={transcriptRef} style={S.transcript}>
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
                </div>
                {toolActivity && <ToolActivityLine activity={toolActivity} brandIcon={hat.toolIcon} />}
                {/* The caret only trails live text; while a tool runs (no text yet)
                    the activity line above carries the "working" signal instead. */}
                {streaming && (
                  <div style={{ ...textStyle('body'), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{streaming}<span className="lc-caret">▍</span></div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: space.sm, borderTop: `1px solid ${cssVar.border}`, paddingTop: space.sm }}>
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
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              rows={1} />
            {/* Toolbar row (Commis parity): attach + inline model on the left, send circle on the
                right. Voice controls (mic / hands-free) land here next, gated on adapter capability. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              {showAttach && adapter.attachments && (
                <>
                  <button className="lc-iconbtn" style={S.iconbtn} title="Attach image" aria-label="Attach image" onClick={() => fileRef.current?.click()}><PlusI /></button>
                  <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                </>
              )}
              {/* Gated on showKey (not just adapter.key) — this selector persists the
                  model choice via adapter.key.set(), so it's part of the bring-your-own-key
                  settings the `enableKey` flag controls. A hat that sets enableKey: false
                  to hide that surface (see the Brain/Add-key button + settings panel above)
                  had it reappear here regardless, letting a user silently change the saved
                  model through a control the hat explicitly opted out of. */}
              {showKey && models.length > 1 && (
                <select
                  className="ds-input"
                  style={{ ...textStyle('caption'), color: accent, background: 'transparent', border: `1px solid ${cssVar.border}`, borderRadius: radius.pill, padding: '4px 8px', cursor: 'pointer', maxWidth: 150 }}
                  title="Model"
                  value={keyInfo.model || modelInput}
                  onChange={async (e) => {
                    const id = e.target.value
                    setModelInput(id)
                    const r = await adapter.key!.set({ model: id })
                    if (r.ok) setKeyInfo((k) => ({ ...k, model: id }))
                  }}
                >
                  {models.map((m) => <option key={m.id} value={m.id}>{m.label.split('·')[0].trim()}</option>)}
                </select>
              )}
              {/* Voice: hands-free read-aloud (always available via browser TTS fallback) + mic
                  dictation (only where the browser supports speech-in). */}
              <button type="button" className="lc-iconbtn" style={{ ...S.iconbtn, color: handsFree ? accent : cssVar.mid }}
                title="Hands-free — read replies aloud" aria-pressed={handsFree}
                onClick={() => setHandsFree((v) => { const next = !v; if (!next) stopSpeaking(); return next })}><SpeakerI /></button>
              {speechInSupported && (
                <button type="button" className="lc-iconbtn" style={{ ...S.iconbtn, color: listening ? cssVar.danger : cssVar.mid }}
                  title={listening ? 'Stop dictation' : 'Dictate'} aria-pressed={listening} onClick={toggleMic}><MicI /></button>
              )}
              <div style={{ flex: 1 }} />
              <button
                className="ds-btn"
                style={{ ...S.primaryBtn, width: 40, height: 40, borderRadius: '50%', padding: 0, display: 'grid', placeItems: 'center',
                  background: `linear-gradient(180deg, ${accent}, ${cssVar.primaryDeep})`,
                  opacity: (sending || (!draft.trim() && files.length === 0)) ? 0.5 : 1 }}
                title="Send" aria-label="Send"
                disabled={sending || (!draft.trim() && files.length === 0)} onClick={send}>
                {sending ? '…' : <ArrowUpI />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {msg && <p style={{ ...textStyle('caption'), color: accent, marginTop: space.sm }}>{msg}</p>}
    </section>
  )
}
