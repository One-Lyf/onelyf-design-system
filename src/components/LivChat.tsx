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
//
// W3 legibility refactor: this file is now the composing shell — state, effects (in their
// original order), the session/send logic, and the top-level layout. The pieces it composes
// live in ./livChat/ (types, styles, hooks, and one file per visual block). Every public
// export below is unchanged, so no consumer import moves.
import { useEffect, useMemo, useRef, useState } from 'react'
import { space, textStyle } from '../tokens'
import { cssVar } from '../theme'
import { partialTurnToAppend, type LivArtifact, type LivDocument } from './livChatComposer'
import { DEFAULT_COMPACT_THRESHOLD } from './livChatModes'
import type { LivChatProps, LivMessage, LivModelSuggestion, LivSession, LivToolActivity } from './livChat/types'
import { livChatStyles } from './livChat/styles'
import { attachmentsOf } from './livChat/helpers'
import { useBrainSettings } from './livChat/useBrainSettings'
import { useBackgroundTasks } from './livChat/useBackgroundTasks'
import { useLivVoice } from './livChat/useLivVoice'
import { useUsageMeter } from './livChat/useUsageMeter'
import { useTranscriptExport } from './livChat/useTranscriptExport'
import { useActionCards } from './livChat/useActionCards'
import { useSlashMenu } from './livChat/useSlashMenu'
import { useLinkGuard } from './livChat/useLinkGuard'
import { useArtifactPanel } from './livChat/useArtifactPanel'
import { useBrainSheetDrag } from './livChat/useBrainSheetDrag'
import { ChatHeader } from './livChat/ChatHeader'
import { SessionRail } from './livChat/SessionRail'
import { EmptyState } from './livChat/EmptyState'
import { MessageBubble } from './livChat/MessageBubble'
import { LiveTurnBubble } from './livChat/LiveTurnBubble'
import { ModelSuggestionCard } from './livChat/ModelSuggestionCard'
import { ActionCardStack } from './livChat/ActionCardStack'
import { Composer } from './livChat/Composer'
import { BrainSheet } from './livChat/BrainSheet'
import { ArtifactPanel } from './livChat/ArtifactPanel'
import { ExternalLinkModal } from './livChat/ExternalLinkModal'
import { TranscriptViewer } from './livChat/TranscriptViewer'
import { BackgroundTasksDialog } from './livChat/BackgroundTasksDialog'

// ── Public types + stylesheet (re-exported; definitions live in ./livChat/) ──────
export type {
  LivResult, LivSession, LivAttachment, LivMessage, LivKeyInfo, LivModel, LivEffort, LivMode, LivVerbosity,
  LivToolActivity, LivUsage, LivModelSuggestion, LivChatSendResult,
  LivTaskStatus, LivBackgroundSendResult, LivTaskPollResult, LivTaskCancelResult,
  LivHat, LivChatAdapter, LivChatProps, LivProposedAction, LivActionQueue, LivChatAction,
  LivSlashToolArg, LivSlashTool,
} from './livChat/types'
export { livChatStylesheet } from './livChat/stylesheet'

// ── Component ────────────────────────────────────────────────────────────────

export default function LivChat({ hat, adapter, keyNonce, onState, onMinimize, onClose, dock = 'panel', onMaximize, onRestore, pendingRequest, onPendingRequestConsumed, onMessagesChange, actionQueue, actions, slashTools, onToolInvoke, onHandsFreeChange, hostOwnsHandsFreeVoice, tier, onTierChange }: LivChatProps) {
  const accent = hat.accent || cssVar.primary
  const showKey = hat.enableKey !== false && !!adapter.key
  const showAttach = hat.enableAttachments !== false

  // Shared status line under the composer. Declared first because the hooks below report into it.
  const [msg, setMsg] = useState('')

  // Brain settings: provider / model list / key / effort / mode / verbosity / compaction state.
  const brain = useBrainSettings({ hat, adapter, setMsg })
  const {
    liveModels, setLiveModels, setProviderInput, models, keyInfo, setKeyInfo, setModelInput,
    autoCompact, compacting, setCompacting, costHintFor, loadKey,
  } = brain

  const [sessions, setSessions] = useState<LivSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<LivMessage[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState<File[]>([])
  // Composer auto-grow. The textarea starts pinned at minHeight (one row); without this, any
  // draft/placeholder that wraps past ~1.8 lines exceeds that fixed height and the browser's
  // native caret-follow scroll kicks in, scrolling the box's TOP line half out of view (it reads
  // as clipped/cut-off text, not a clean scroll) instead of the box growing to show it. Runs off
  // `draft` (not just onChange) so it also re-measures on a programmatic clear (send, slash-tool
  // select) and shrinks back down to minHeight.
  const composerRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(160, Math.max(44, el.scrollHeight))}px`
  }, [draft])
  // Enter sends only on a physical keyboard (fine pointer). On a touch device the Return key inserts
  // a newline instead, and the user sends with the Send button. Device-static, so read once.
  const [enterSends] = useState(() => typeof window === 'undefined' || !window.matchMedia?.('(pointer: coarse)')?.matches)
  const [streaming, setStreaming] = useState('')
  // The tool round currently running, shown as an activity line above the
  // streaming text. Null when no tool is mid-flight.
  const [toolActivity, setToolActivity] = useState<LivToolActivity | null>(null)
  const [sending, setSending] = useState(false)
  // Live run-time counter for the 'Thinking' status: elapsed seconds
  // since the current turn started sending, ticking up for as long as `sending` is true —
  // model-agnostic, driven purely by LivChat's own generating state (see the animated-glyph
  // state machine below: idle / thinking / running-a-workflow all key off sending/toolActivity).
  const [elapsedSec, setElapsedSec] = useState(0)
  useEffect(() => {
    if (!sending) { setElapsedSec(0); return }
    const start = Date.now()
    const id = setInterval(() => setElapsedSec(Math.round((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [sending])

  // Mirrors activeId synchronously so in-flight async work can tell — the instant
  // it resolves — whether the user is STILL on the session it was fired for.
  const activeIdRef = useRef<string | null>(null)
  function setActive(id: string | null) { activeIdRef.current = id; setActiveId(id) }

  // Background tasks (livchat-agentic-workflows): in-flight map, tray state, polling effect.
  const { pendingTasks, setPendingTasks, tasksOpen, setTasksOpen, cancellingId, recentTasks, cancelTask } =
    useBackgroundTasks({ adapter, activeIdRef, setMessages, setMsg, resolveUrls })
  // Animated Liv-state glyph (idle / thinking / running-a-workflow) — ties the brand mark's
  // motion to the same generating signal as the Thinking indicator above. This is purely a CSS
  // animation applied to the existing CANONICAL glyph (see Glyph.tsx's `animated` prop) — never
  // a new mark, per the Liv-glyph law.
  const livGlyphState: 'idle' | 'thinking' | 'running' = toolActivity ? 'running' : sending ? 'thinking' : 'idle'
  const [copiedId, setCopiedId] = useState<string | null>(null)
  // Voice: per-message read-aloud, hands-free, dictation, TTS.
  const {
    playingId, highlightRange, handsFree, listening, recognitionRef, speechInSupported,
    speak, stopSpeaking, playMessage, stopPlayingMessage, toggleMic, toggleHandsFree,
  } = useLivVoice({ adapter, draft, setDraft, send, onHandsFreeChange, hostOwnsHandsFreeVoice })
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  // Narrow-viewport session rail: hidden by default, toggled open as an
  // overlay sheet (see .lc-rail-toggle / .lc-rail in livChatStylesheet).
  // Irrelevant above the 620px breakpoint, where the rail is always visible.
  const [railOpen, setRailOpen] = useState(false)

  // Token/cost meter: session total, last turn, daily (localStorage) total.
  const { usage, setUsage, lastTurn, setLastTurn, daily, addUsage } = useUsageMeter(hat.name)

  const [pendingSuggestion, setPendingSuggestion] = useState<LivModelSuggestion | null>(null)
  // Whether the composer's Brain popover is open. Canonical Liv-chat placement: the Brain
  // pill (model + API key + usage) lives IN the composer next to attach/mic/send, NOT in
  // the chat header — see onelyf-planning/docs/liv-chat-canon.md (Tummyful is the reference design).
  const [brainOpen, setBrainOpen] = useState(false)
  // Transcript viewer (Markdown / Plain / JSON) + copy/download, and single-document download.
  const {
    transcriptOpen, setTranscriptOpen, transcriptFormat, setTranscriptFormat,
    renderTranscript, downloadTranscript, copyTranscript, downloadDocument,
  } = useTranscriptExport({ messages, setMsg })

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
  // No-auto-scroll-to-bottom: a new Liv reply anchors at its TOP once, instead of
  // being chased to the bottom on every streamed token. liveTurnRef points at the in-flight
  // streaming/tool-activity bubble; turnAnchoredRef flips false when a turn starts (in send())
  // and locks true right after the one-time top-anchor scroll so later tokens don't re-fire it;
  // suppressBottomJamAtLenRef tells the ordinary bottom-follow effect below to skip the run that
  // corresponds to THIS messages.length — otherwise the server-reload that commits the finished
  // reply into `messages` would jam the scroll straight back down a moment after we anchored it
  // to the top. It holds a messages.length snapshot rather than a plain boolean because a
  // sufficiently fast first token (no network round-trip before it) lands in the SAME React
  // commit as the optimistic user-message append: both effects then fire back-to-back in that
  // one commit, and a plain "consume on next run" flag gets eaten right there by the bottom-
  // follow effect reacting to the user's own message, before the real (later, separate-commit)
  // reply-finished change it was meant for ever arrives. Comparing against the recorded length
  // lets the bottom-follow effect recognize "this run is for the same length that was already
  // current when we armed it" and defer instead of consuming — it only actually consumes the
  // arm on a run where messages.length has since moved to something new.
  const liveTurnRef = useRef<HTMLDivElement>(null)
  const turnAnchoredRef = useRef(true)
  const suppressBottomJamAtLenRef = useRef<number | null>(null)


  // Flipped true by the Stop button (or by an auto-abort on session switch mid-send) so the
  // catch/error clauses in send() know a subsequent failure is user-initiated and shouldn't
  // paint an error banner. Reset at the start of every new send.
  const userAbortedRef = useRef(false)

  // Action-card lifecycle (apply / dismiss / apply-all) layered over `actionQueue.cards`.
  const { cardState, applyAllBusy, applyCard, dismissCard, applyAllCards } = useActionCards(actionQueue)
  // The composer's actions menu open/close (Commis's chef's-knife popover).
  const [actionsOpen, setActionsOpen] = useState(false)
  // livchat-agentic-workflows: both ports present -> the adapter genuinely supports background
  // turns end to end, not just one half of the pair.
  const canBackgroundSend = !!(adapter.chat.sendBackground && adapter.chat.pollTask)
  // `/`-menu (livchat-slash-menu-canon).
  const slash = useSlashMenu({ draft, setDraft, slashTools, onToolInvoke })
  // External-link guard (livchat-external-link-guard).
  const { linkGuardUrl, setLinkGuardUrl, linkGuardSafetyOpen, setLinkGuardSafetyOpen, handleLinkTap } = useLinkGuard()
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

  async function loadSessions(selectFirst = false) {
    try {
      const r = await adapter.sessions.list()
      if (r.ok) {
        setSessions(r.value.sessions)
        if (selectFirst && r.value.sessions.length) selectSession(r.value.sessions[0].id)
      }
    } catch (e) { console.error('sessions.list failed', e) }
  }

  // Compact the given session: the app summarizes its history and replaces it with a compact
  // summary; we then reload the (shorter) transcript. Manual (Compact button) or auto (threshold).
  async function doCompact(sessionId: string | null) {
    const sid = sessionId ?? activeId
    if (!sid || !adapter.chat.compact || compacting) return
    setCompacting(true)
    try {
      const r = await adapter.chat.compact(sid)
      if (r.ok) {
        const m = await adapter.messages.list(sid)
        if (m.ok) { setMessages(m.value.messages); resolveUrls(m.value.messages) }
        setMsg('Conversation compacted.')
      } else {
        setMsg(r.error?.message || 'Could not compact the conversation.')
      }
    } catch (e) {
      console.error('compact failed', e)
      setMsg('Could not compact the conversation.')
    } finally {
      setCompacting(false)
    }
  }

  useEffect(() => { loadSessions(true) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-reads on mount and whenever the host bumps keyNonce (a key saved elsewhere, e.g.
  // liv-console's LivBrain tab) — otherwise the pill is stuck on this instance's first fetch.
  useEffect(() => { loadKey() }, [keyNonce]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live model discovery: the first time the Brain menu opens, ask the host's backend for the
  // real provider model list (adapter.key.listModels → provider GET /v1/models). Lazy (only on
  // open, once) so we don't spend a call on chats where the user never touches the picker. A
  // failed/empty result leaves liveModels null → the curated fallback stays. curateLivModels in
  // the `models` memo drops Fable/Mythos + relabels, so we can trust the raw list here.
  useEffect(() => {
    if (!brainOpen || liveModels || !adapter.key?.listModels) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await adapter.key!.listModels!()
        if (!cancelled && r.ok && r.value?.models?.length) setLiveModels(r.value.models)
      } catch (e) { console.error('key.listModels failed', e) }
    })()
    return () => { cancelled = true }
  }, [brainOpen, liveModels, adapter.key])

  // Report chat state to a persistent host (LivDock) so its bubble can show an unread dot / thinking
  // pulse. thinking = a turn is in flight (sending) or streaming in. No-op when onState is omitted.
  // Keyed on the `thinking` boolean, not `streaming`: keyed on the text, this fired a fresh state
  // object at the host on every streamed token, and hosts that store it (Tummyful's CommisDock,
  // Cash Stash's AdvisorDock) re-rendered themselves and this chat a second time per token.
  const thinking = sending || streaming.length > 0
  useEffect(() => {
    onState?.({ messageCount: messages.length, thinking })
  }, [messages.length, thinking, onState])

  useEffect(() => {
    onMessagesChange?.(messages, activeId)
  }, [messages, activeId, onMessagesChange])

  // Anchor a new Liv turn's TOP into view exactly once, the moment it starts producing
  // something visible (first streamed token or a tool round beginning) — not on every
  // subsequent token, which is what used to chase the scroll position to the bottom.
  useEffect(() => {
    const livTurnStarted = streaming.length > 0 || !!toolActivity
    if (livTurnStarted && !turnAnchoredRef.current) {
      turnAnchoredRef.current = true
      // Record the length current AS OF THIS COMMIT, not just "true" — see the ref's
      // declaration comment for why a plain boolean loses this race on a fast first token.
      suppressBottomJamAtLenRef.current = messages.length
      liveTurnRef.current?.scrollIntoView({ block: 'start' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately NOT keyed on
    // messages.length: this must fire only on a streaming/toolActivity change (the "turn
    // started" signal), reading whatever messages.length is current at that moment. Adding it
    // as a dependency would re-run this effect on every message-count change too, which is
    // exactly the coincidental-commit scenario the length-snapshot fix above exists to survive.
  }, [streaming, toolActivity])

  // Ordinary "keep the reader on the newest line" behavior for everything that ISN'T a live Liv
  // turn completing: the user's own outgoing bubble, opening/switching a session, history
  // loading. Defers (without consuming the arm) on a run whose messages.length still matches
  // what was current when the top-anchor effect armed it above — that run is the optimistic
  // user-message echo landing in the SAME commit as the anchor, not the later reply-finished
  // change the arm exists to suppress. Only a run where the length has since moved on actually
  // consumes it and skips the jam.
  useEffect(() => {
    const el = transcriptRef.current
    if (!el) return
    if (suppressBottomJamAtLenRef.current === messages.length) return
    if (suppressBottomJamAtLenRef.current !== null) { suppressBottomJamAtLenRef.current = null; return }
    if (pinnedRef.current) el.scrollTop = el.scrollHeight
  }, [messages.length])

  // Artifacts panel (livchat-artifacts-system): state, persisted split, and its three effects
  // (split persist → PRIMARY auto-open → BONUS live-update), called here to keep effect order.
  const {
    artifact, artifactCopied, splitPct, splitRef,
    openArtifact, closeArtifact, copyArtifact, downloadArtifact, expandArtifact, onArtifactDividerPointerDown,
  } = useArtifactPanel({ messages, streaming, setMsg })

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
    // A message from the just-abandoned session shouldn't keep reading aloud into the newly
    // opened one.
    stopPlayingMessage()
    // Reset the top-anchor bookkeeping too — otherwise a suppress flag left over from a turn
    // abandoned mid-stream (by the abort just above) could wrongly skip the bottom-jump that
    // should land this newly-opened session's history at its latest message.
    turnAnchoredRef.current = true
    suppressBottomJamAtLenRef.current = null
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
  async function send(overrideText?: string, overrideFiles?: File[], background?: boolean) {
    const text = (overrideText ?? draft).trim()
    const draftFiles = overrideFiles ?? files
    if ((!text && draftFiles.length === 0) || sending) return
    // Fresh send — any prior abort flag from an earlier turn is stale, don't let it silence
    // a legitimate error this turn.
    userAbortedRef.current = false
    // The user just sent a turn — jump to and follow the newest message even if they'd scrolled
    // up to re-read earlier (the auto-follow effect only scrolls when pinned).
    pinnedRef.current = true
    turnAnchoredRef.current = false
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
        content: text, attachments: sentFiles.map((f, i) => ({ kind: f.type.startsWith('image/') ? 'image' : 'file', path: localPath(i), mime: f.type, name: f.name })),
      }
      if (stillActive()) {
        setMessages((m) => [...m, optimistic])
        setUrls((u) => ({ ...u, ...Object.fromEntries(sentFiles.map((f, i) => [localPath(i), URL.createObjectURL(f)])) }))
      }
      setDraft(''); setFiles([])
      if (fileRef.current) fileRef.current.value = ''

      // Background path: kick the turn off and return immediately — no streaming, no blocking
      // the rest of the conversation. A pending placeholder bubble stands in for the reply until
      // the polling effect above resolves it (see pendingTasks).
      if (background && adapter.chat.sendBackground && adapter.chat.pollTask) {
        const bg = await adapter.chat.sendBackground({ sessionId, text, files: sentFiles })
        if (!bg.ok) {
          if (stillActive()) setMsg(bg.error?.message || 'Could not start the background task.')
          return
        }
        const placeholderId = `task-${bg.taskId}`
        if (stillActive()) {
          setMessages((m) => [...m, { id: placeholderId, role: 'liv', modality: 'text', channel: 'console', content: '' }])
        }
        setPendingTasks((t) => ({ ...t, [bg.taskId]: { sessionId: sessionId!, placeholderId, input: text, startedAt: Date.now() } }))
        loadSessions()
        return
      }

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
          if (res.modelSuggestion) setPendingSuggestion(res.modelSuggestion)
          if (handsFree && !hostOwnsHandsFreeVoice && acc.trim()) speak(acc)
        } else if (!userAbortedRef.current) {
          // Suppress this branch entirely on a user-initiated Stop — the message shape can vary
          // per adapter (some resolve with {ok:false, error:{message:'ABORT'}} instead of throwing),
          // and painting a "couldn't reply" banner for something the user just told us to cancel
          // reads as a failure they didn't cause.
          const em = res.error?.message
          if (em === 'NO_KEY' || res.error?.detail?.toLowerCase().includes('key')) {
            if (showKey) setBrainOpen(true)
            setMsg('Add your API key so Liv can reply. Your message is saved either way.')
          } else {
            setMsg(em || "Liv couldn't reply.")
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
      // Auto-compact: once this session's cumulative tokens cross the threshold, summarize it down.
      // `usage` is the running total BEFORE this turn; add this turn's tokens for the new total.
      if (res.ok && autoCompact && adapter.chat.compact && !compacting) {
        const total = (usage.input || 0) + (usage.output || 0) + (res.usage ? (res.usage.input || 0) + (res.usage.output || 0) : 0)
        if (total > (hat.compactThreshold ?? DEFAULT_COMPACT_THRESHOLD)) void doCompact(sessionId)
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

  async function copyMessage(id: string, text?: string | null) {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500)
    } catch { setMsg('Could not copy — clipboard access was blocked.') }
  }

  // Brain sheet Escape + drag-to-dismiss (its Escape effect was the last effect in this file).
  const { sheetDragY, onBrainSheetHandlePointerDown } = useBrainSheetDrag(brainOpen, setBrainOpen)

  // Message rows are memoized (see MessageBubble) so a streamed token re-renders only the live
  // turn, not the whole transcript. That only works if the handlers the rows get keep one identity
  // across renders, so each stable wrapper below forwards to the handler from the LATEST render
  // (a row can never call a stale closure, e.g. an old `send`).
  const bubbleHandlersRef = useRef({ playMessage, copyMessage, handleLinkTap, send, downloadDocument, openArtifact })
  bubbleHandlersRef.current = { playMessage, copyMessage, handleLinkTap, send, downloadDocument, openArtifact }
  const bubbleHandlers = useMemo(() => ({
    playMessage: (id: string, text?: string | null) => bubbleHandlersRef.current.playMessage(id, text),
    copyMessage: (id: string, text?: string | null) => bubbleHandlersRef.current.copyMessage(id, text),
    handleLinkTap: (url: string) => bubbleHandlersRef.current.handleLinkTap(url),
    send: (overrideText?: string) => bubbleHandlersRef.current.send(overrideText),
    downloadDocument: (doc: LivDocument) => bubbleHandlersRef.current.downloadDocument(doc),
    openArtifact: (a: LivArtifact) => bubbleHandlersRef.current.openArtifact(a),
  }), [])
  const lastMessageId = messages[messages.length - 1]?.id

  // ── styles (inline, token-driven) ──
  // Memoized on the accent: same values as before, but a stable object, so memoized children
  // that take `S` don't re-render just because the parent did.
  const S = useMemo(() => livChatStyles(accent), [accent])

  return (
    <section className="lc-root" data-dock={dock} style={{
      ...S.card, ['--lc-accent' as string]: accent,
      // Full-dock touches the physical screen edges (position:fixed, inset:0 — see the
      // .lc-root[data-dock="full"] rule above), so the header/composer need real safe-area
      // padding on top of the card's normal space.md padding, or the header sits under the
      // iOS notch/status bar and the composer sits under the home indicator — the exact bug
      // citadel PR #140 (WaveRider) hit and fixed for its own header close button.
      ...(dock === 'full' ? {
        borderRadius: 0,
        maxHeight: '100dvh',
        paddingTop: `calc(${space.md}px + env(safe-area-inset-top, 0px))`,
        paddingBottom: `calc(${space.md}px + env(safe-area-inset-bottom, 0px))`,
      } : null),
    }}>

      <ChatHeader S={S} hat={hat} accent={accent} livGlyphState={livGlyphState}
        railOpen={railOpen} setRailOpen={setRailOpen} sessions={sessions} messages={messages}
        setTranscriptOpen={setTranscriptOpen} canBackgroundSend={canBackgroundSend} setTasksOpen={setTasksOpen}
        pendingTasks={pendingTasks} usage={usage} setUsage={setUsage} setLastTurn={setLastTurn}
        keyInfo={keyInfo} costHintFor={costHintFor}
        dock={dock} onRestore={onRestore} onMaximize={onMaximize} onMinimize={onMinimize} onClose={onClose} />
      {hat.intro && <p style={{ ...S.muted, marginTop: 6 }}>{hat.intro}</p>}

      {/* Header BYO-key settings panel removed — API key + model select now live inside the
          composer's Brain popover (search `brainOpen` in the composer block below), per canon. */}

      <div className="lc-body" data-rail-open={railOpen || undefined} style={S.body}>
        {railOpen && (
        <SessionRail S={S} accent={accent} railOpen={railOpen} sessions={sessions} activeId={activeId}
          newSession={newSession} selectSession={selectSession} renamingId={renamingId} renameDraft={renameDraft}
          setRenameDraft={setRenameDraft} startRename={startRename} commitRename={commitRename} cancelRename={cancelRename}
          setRenaming={setRenaming} confirmDeleteId={confirmDeleteId} setConfirmDeleteId={setConfirmDeleteId}
          confirmDelete={confirmDelete} />
        )}

        <div className="lc-split" ref={splitRef} data-artifact-open={artifact ? 'true' : undefined} style={{ display: 'flex', flex: 1, minWidth: 0 }}>
        <div className="lc-main" style={{ ...S.main, ...(artifact ? { flex: `0 0 ${splitPct}%`, minWidth: 0 } : null) }}>
          <div className="lc-transcript" ref={transcriptRef} style={{ ...S.transcript, ...(dock === 'full' ? { maxHeight: 'none' } : null) }} onScroll={onTranscriptScroll}>
            {messages.length === 0 && !streaming && (
              <EmptyState S={S} hat={hat} accent={accent} livGlyphState={livGlyphState} setDraft={setDraft} />
            )}
            {messages.map((m) => {
              // Per-row primitives instead of the shared `messages` / `playingId` / `copiedId` /
              // `sending`, so a change only re-renders the rows it actually affects.
              const isLast = m.id === lastMessageId
              const isPlaying = playingId === m.id
              return (
                <MessageBubble key={m.id} S={S} m={m} isLast={isLast} sendingLast={isLast && sending} urls={urls}
                  isPlaying={isPlaying} highlightRange={isPlaying ? highlightRange : null}
                  isCopied={copiedId === m.id} {...bubbleHandlers} />
              )
            })}
            {(streaming || toolActivity) && (
              <LiveTurnBubble S={S} hat={hat} adapter={adapter} liveTurnRef={liveTurnRef} sending={sending}
                elapsedSec={elapsedSec} toolActivity={toolActivity} streaming={streaming} stop={stop}
                handleLinkTap={handleLinkTap} />
            )}
            {pendingSuggestion && !sending && (
              <ModelSuggestionCard accent={accent} adapter={adapter} pendingSuggestion={pendingSuggestion}
                setPendingSuggestion={setPendingSuggestion} setProviderInput={setProviderInput}
                setModelInput={setModelInput} setKeyInfo={setKeyInfo} setLiveModels={setLiveModels} setMsg={setMsg} />
            )}
            {/* Action-card stack — moved to render AFTER the streaming bubble so cards from the
                LAST completed turn sit closest to the composer (where the user's attention is
                after they read the reply). Only rendered when the app supplies actionQueue. */}
            {actionQueue && actionQueue.cards.length > 0 && (
              <ActionCardStack S={S} actionQueue={actionQueue} cardState={cardState} applyAllBusy={applyAllBusy}
                applyAllCards={applyAllCards} applyCard={applyCard} dismissCard={dismissCard} />
            )}
          </div>

          <Composer S={S} hat={hat} accent={accent} adapter={adapter} draft={draft} setDraft={setDraft}
            files={files} setFiles={setFiles} setMsg={setMsg} composerRef={composerRef} fileRef={fileRef}
            enterSends={enterSends} send={send} stop={stop} sending={sending} slash={slash} slashTools={slashTools}
            showKey={showKey} showAttach={showAttach} brainOpen={brainOpen} setBrainOpen={setBrainOpen}
            keyInfo={keyInfo} models={models} modelInput={brain.modelInput} providerInput={brain.providerInput}
            livGlyphState={livGlyphState}
            brainSheet={showKey && brainOpen && (
              <BrainSheet S={S} hat={hat} accent={accent} adapter={adapter} brain={brain} setBrainOpen={setBrainOpen}
                sheetDragY={sheetDragY} onBrainSheetHandlePointerDown={onBrainSheetHandlePointerDown} setMsg={setMsg}
                activeId={activeId} messages={messages} doCompact={doCompact} tier={tier} onTierChange={onTierChange}
                usage={usage} lastTurn={lastTurn} daily={daily} />
            )}
            canBackgroundSend={canBackgroundSend} actions={actions} actionsOpen={actionsOpen} setActionsOpen={setActionsOpen}
            handsFree={handsFree} toggleHandsFree={toggleHandsFree} listening={listening}
            speechInSupported={speechInSupported} toggleMic={toggleMic} />
        </div>

        {artifact && (
          <ArtifactPanel S={S} artifact={artifact} splitPct={splitPct} artifactCopied={artifactCopied}
            onArtifactDividerPointerDown={onArtifactDividerPointerDown} copyArtifact={copyArtifact}
            downloadArtifact={downloadArtifact} expandArtifact={expandArtifact} closeArtifact={closeArtifact} />
        )}
        </div>
      </div>

      {msg && <p style={{ ...textStyle('caption'), color: accent, marginTop: space.sm }}>{msg}</p>}

      {linkGuardUrl && (
        <ExternalLinkModal
          url={linkGuardUrl}
          safetyOpen={linkGuardSafetyOpen}
          onToggleSafety={() => setLinkGuardSafetyOpen((v) => !v)}
          onOpen={() => {
            window.open(linkGuardUrl, '_blank', 'noopener,noreferrer')
            setLinkGuardUrl(null)
          }}
          onClose={() => setLinkGuardUrl(null)}
        />
      )}

      {/* Transcript viewer — view the open session in a chosen format (Markdown / Plain / JSON),
          with copy + download. Read-only overlay; click-out or Close dismisses. */}
      {transcriptOpen && (
        <TranscriptViewer S={S} accent={accent} setTranscriptOpen={setTranscriptOpen} transcriptFormat={transcriptFormat}
          setTranscriptFormat={setTranscriptFormat} renderTranscript={renderTranscript}
          copyTranscript={copyTranscript} downloadTranscript={downloadTranscript} />
      )}
      {tasksOpen && (
        <BackgroundTasksDialog accent={accent} adapter={adapter} setTasksOpen={setTasksOpen} pendingTasks={pendingTasks}
          recentTasks={recentTasks} cancellingId={cancellingId} cancelTask={cancelTask} activeId={activeId}
          selectSession={selectSession} />
      )}
    </section>
  )
}
