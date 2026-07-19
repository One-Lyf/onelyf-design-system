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
import type { CSSProperties } from 'react'
import { radius, space, textStyle } from '../tokens'
import { cssVar } from '../theme'

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
  models?: LivModel[]          // model choices for the key panel
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
      onChunk: (chunk: string) => void,
    ): Promise<LivResult<unknown>>
  }
  attachments?: { signedUrl(path: string): Promise<string> }
  key?: {
    get(): Promise<LivResult<LivKeyInfo>>
    set(patch: { apiKey?: string; model?: string }): Promise<LivResult<LivKeyInfo>>
  }
}

export interface LivChatProps {
  hat: LivHat
  adapter: LivChatAdapter
}

const DEFAULT_MODELS: LivModel[] = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8 · most capable (default)' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 · balanced' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 · fastest / cheapest' },
]

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

// ── Minimal inline icon set (stroke glyphs, inherit currentColor) ────────────
const ic: CSSProperties = { width: 14, height: 14, display: 'inline-block', verticalAlign: '-2px' }
const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style: ic, 'aria-hidden': true }
const MicI = () => <svg {...svg}><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
const KeyboardI = () => <svg {...svg}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="6" y1="13" x2="18" y2="13" /><line x1="6" y1="9" x2="6.01" y2="9" /><line x1="18" y1="9" x2="18.01" y2="9" /></svg>
const PhoneI = () => <svg {...svg}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
const SmartphoneI = () => <svg {...svg}><rect x="7" y="2" width="10" height="20" rx="2" /><line x1="11" y1="18" x2="13" y2="18" /></svg>
const MessageI = () => <svg {...svg}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
const ImageI = () => <svg {...svg}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
const PaperclipI = () => <svg {...svg}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
const PencilI = () => <svg {...svg}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
const TrashI = () => <svg {...svg}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
const CopyI = () => <svg {...svg}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
const CheckI = () => <svg {...svg}><polyline points="20 6 9 17 4 12" /></svg>

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

// Interaction/animation CSS that inline styles can't express. Apps inject this
// once (alongside themeStylesheet + componentStylesheet), same pattern as the
// rest of the design system.
export const livChatStylesheet = `
.lc-caret { animation: lc-blink 1s step-end infinite; }
@keyframes lc-blink { 50% { opacity: 0; } }
.lc-session:hover { background: var(--ds-surface-hi); }
.lc-session[data-active="true"] { background: color-mix(in srgb, var(--lc-accent) 14%, transparent); }
.lc-iconbtn:hover:not(:disabled) { background: var(--ds-track); }
.lc-copy { opacity: 0; transition: opacity .12s ease; }
.lc-bubble:hover .lc-copy, .lc-copy:focus-visible { opacity: 1; }
@media (max-width: 620px) { .lc-body { grid-template-columns: 1fr !important; } .lc-rail { max-height: 180px; } }
`

// ── Component ────────────────────────────────────────────────────────────────

export default function LivChat({ hat, adapter }: LivChatProps) {
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
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

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
    setActive(id); setMessages([]); setStreaming('')
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
    if (r.ok) { await loadSessions(); selectSession(r.value.id) }
  }

  function startRename(s: LivSession) { setConfirmDeleteId(null); setRenamingId(s.id); setRenameDraft(s.title || '') }
  function cancelRename() { setRenamingId(null); setRenameDraft('') }
  async function commitRename(s: LivSession) {
    if (renamingId !== s.id) return // Enter already committed; ignore the follow-up onBlur.
    const title = renameDraft.trim()
    setRenamingId(null)
    if (!title || title === (s.title || '')) return
    await adapter.sessions.rename(s.id, title)
    loadSessions()
  }

  async function confirmDelete(s: LivSession) {
    setConfirmDeleteId(null)
    await adapter.sessions.delete(s.id)
    if (activeId === s.id) { setActive(null); setMessages([]) }
    loadSessions()
  }

  async function send() {
    const text = draft.trim()
    if ((!text && files.length === 0) || sending) return
    setSending(true); setMsg('')

    let sessionId = activeId
    const stillActive = () => activeIdRef.current === sessionId

    try {
      if (!sessionId) {
        const r = await adapter.sessions.create(text.slice(0, 48) || 'New chat')
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

      if (stillActive()) setStreaming('')
      let acc = ''
      const res = await adapter.chat.send({ sessionId, text, files: sentFiles }, (chunk) => {
        acc += chunk
        if (stillActive()) setStreaming(acc)
      })

      if (stillActive()) {
        setStreaming('')
        if (!res.ok) {
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
    } catch (e: unknown) {
      console.error('chat send threw', e)
      if (stillActive()) {
        setStreaming('')
        setMsg((e as Error)?.message || 'Something went wrong sending your message. Please try again.')
      }
    } finally { setSending(false) }
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
    card: { background: cssVar.surface, border: `1px solid ${cssVar.border}`, borderRadius: radius.lg, padding: space.md } as CSSProperties,
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
        <h2 style={{ ...textStyle('h3'), margin: 0 }}>{hat.name}{hat.subtitle && <span style={{ ...S.muted, marginLeft: 6 }}>· {hat.subtitle}</span>}</h2>
        {showKey && (
          <button className="lc-iconbtn ds-btn" style={S.ghostBtn} onClick={() => setShowSettings((s) => !s)}>
            {keyInfo.hasKey ? 'Brain' : 'Add key'}
          </button>
        )}
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
        <aside className="lc-rail" style={S.rail}>
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
                      <span style={S.sessionTitle}>{s.title || 'Untitled'}</span>
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
                        <button className="lc-iconbtn" style={S.iconbtn} title="Delete" onClick={() => { setRenamingId(null); setConfirmDeleteId(s.id) }}><TrashI /></button>
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
              <p style={{ ...S.muted, textAlign: 'center', marginTop: space.lg }}>{hat.emptyText || `Say something to ${hat.name}${showAttach ? ' — or attach an image' : ''}.`}</p>
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
            {streaming && (
              <div className="lc-bubble" style={bubbleStyle('liv')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ ...textStyle('overline'), color: cssVar.mid }}>{hat.name}</span>
                  <ModalityPill modality="text" />
                </div>
                <div style={{ ...textStyle('body'), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{streaming}<span className="lc-caret">▍</span></div>
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
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              {showAttach && adapter.attachments && (
                <>
                  <button className="lc-iconbtn" style={{ ...S.ghostBtn, padding: '8px 10px' }} title="Attach image" onClick={() => fileRef.current?.click()}><PaperclipI /></button>
                  <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                </>
              )}
              <textarea className="ds-input" style={{ ...S.input, flex: 1, resize: 'vertical', minHeight: 38, maxHeight: 160 }}
                placeholder={hat.placeholder || `Message ${hat.name}…`}
                value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                rows={1} />
              <button className="ds-btn" style={{ ...S.primaryBtn, opacity: (sending || (!draft.trim() && files.length === 0)) ? 0.5 : 1 }}
                disabled={sending || (!draft.trim() && files.length === 0)} onClick={send}>
                {sending ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {msg && <p style={{ ...textStyle('caption'), color: accent, marginTop: space.sm }}>{msg}</p>}
    </section>
  )
}
