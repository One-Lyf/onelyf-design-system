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
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, CSSProperties } from 'react'
import { radius, space, textStyle } from '../tokens'
import { cssVar } from '../theme'
import Glyph from '../Glyph'
import { shouldSendOnEnter, partialTurnToAppend, transcriptToMarkdown, transcriptToPlainText, transcriptToJSON, transcriptFilename, extractDocument, documentFilename, extractArtifact, artifactFilename, streamingArtifactPreview, extractOptions, attachmentError, isSameOrigin, type LivDocument, type LivArtifact } from './livChatComposer'
import { highlightCode } from './livChatSyntaxHighlight'
import { curateLivModels, ANTHROPIC_FALLBACK_MODELS, ANTHROPIC_FALLBACK_MODEL_ID, PROVIDER_LABELS, PROVIDER_FALLBACK_MODELS } from './livChatModels'
import type { LivModel } from './livChatModels'
import { EFFORT_LEVELS, DEFAULT_EFFORT, effortIndex, effortAtIndex, MODES, DEFAULT_MODE, isEffort, isMode, VERBOSITY_OPTIONS, DEFAULT_VERBOSITY, isVerbosity, DEFAULT_COMPACT_THRESHOLD } from './livChatModes'
import type { LivEffort, LivMode, LivVerbosity } from './livChatModes'
import type { LivChatProps, LivKeyInfo, LivMessage, LivModelSuggestion, LivSession, LivSlashTool, LivToolActivity, LivUsage } from './livChat/types'
import { ATTACH_ACCEPT, ATTACH_ALLOWED, ATTACH_MAX_BYTES, ARTIFACT_SPLIT_KEY, SYNTAX_COLOR, TRANSCRIPT_FORMATS } from './livChat/constants'
import { attachmentsOf, displayTitle, titleCase, usageCost } from './livChat/helpers'
import { ArrowUpI, CheckI, ChevronDownI, CloseI, CodeI, CopyI, DownloadI, ExternalLinkI, FileTextI, ImageI, ListChecksI, Maximize2I, MenuI, MicI, Minimize2I, PencilI, PlayI, PlusI, SpeakerI, StopSmallI, ToolI, TrashI } from './livChat/icons'
import { ChannelIcon, HighlightedText, Linkified, ModalityPill, ToolActivityLine } from './livChat/MessageParts'
import { ExternalLinkModal } from './livChat/ExternalLinkModal'
import { livChatStyles, bubbleStyle } from './livChat/styles'

// ── Public types + stylesheet (re-exported; definitions live in ./livChat/) ──────
export type {
  LivResult, LivSession, LivAttachment, LivMessage, LivKeyInfo, LivModel, LivEffort, LivMode, LivVerbosity,
  LivToolActivity, LivUsage, LivModelSuggestion, LivChatSendResult,
  LivTaskStatus, LivBackgroundSendResult, LivTaskPollResult, LivTaskCancelResult,
  LivHat, LivChatAdapter, LivChatProps, LivProposedAction, LivActionQueue, LivChatAction,
  LivSlashToolArg, LivSlashTool,
} from './livChat/types'
export { livChatStylesheet } from './livChat/stylesheet'


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

export default function LivChat({ hat, adapter, keyNonce, onState, onMinimize, onClose, dock = 'panel', onMaximize, onRestore, pendingRequest, onPendingRequestConsumed, onMessagesChange, actionQueue, actions, slashTools, onToolInvoke, onHandsFreeChange, hostOwnsHandsFreeVoice, tier, onTierChange }: LivChatProps) {
  const accent = hat.accent || cssVar.primary
  const showKey = hat.enableKey !== false && !!adapter.key
  const showAttach = hat.enableAttachments !== false

  const [liveModels, setLiveModels] = useState<LivModel[] | null>(null)
  const [providerInput, setProviderInput] = useState('anthropic')
  const models = useMemo(
    () => curateLivModels(liveModels ?? hat.models ?? PROVIDER_FALLBACK_MODELS[providerInput] ?? ANTHROPIC_FALLBACK_MODELS),
    [liveModels, hat.models, providerInput],
  )
  // Resolves a model id's host-supplied cost hint (LivModel.costPerToken) for usageCost below —
  // see the tierFor/usageCost comment for why this matters for non-Anthropic models.
  const costHintFor = (id?: string | null) => models.find((m) => m.id === id)?.costPerToken

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
  // Background tasks in flight (livchat-agentic-workflows completion surfacing), keyed by taskId.
  // Each has a locally-synthesized placeholder bubble already sitting in `messages` (inserted at
  // queue time, see send() below); this effect polls until every task resolves, then either
  // reloads the transcript (done — the real reply is already in platform.liv_message by the time
  // pollTask reports 'done') or turns the placeholder into an error line (error). Deliberately NOT
  // gated on `sending`/`stillActive` — the whole point of a background task is that it outlives
  // the turn that started it and survives a session switch (checked per-poll via activeIdRef).
  const [pendingTasks, setPendingTasks] = useState<Record<string, { sessionId: string; placeholderId: string; input: string; startedAt: number }>>({})
  // Task-visibility tray (replaces the composer's opt-in "Run in Background" affordance as the
  // surface for MANAGING background work): lists every in-flight task, lets the user jump to its
  // session/transcript, and — where adapter.chat.cancelTask exists — stop it.
  const [tasksOpen, setTasksOpen] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  // Short-lived local history so the tray can show a just-finished task alongside the in-flight
  // ones ("view a running/completed background task"). Capped and in-memory only — there's no
  // list-tasks backend endpoint yet, so this doesn't survive a reload; it just bridges the gap
  // between "resolved" and "the user opened the tray to look".
  const [recentTasks, setRecentTasks] = useState<Array<{ taskId: string; sessionId: string; input: string; status: 'done' | 'error'; completedAt: number }>>([])
  async function cancelTask(taskId: string) {
    if (!adapter.chat.cancelTask) return
    setCancellingId(taskId)
    try {
      const r = await adapter.chat.cancelTask(taskId)
      if (r.ok) {
        const entry = pendingTasks[taskId]
        setPendingTasks((t) => { const n = { ...t }; delete n[taskId]; return n })
        if (entry) setMessages((m) => m.map((mm) => mm.id === entry.placeholderId ? { ...mm, content: 'Stopped.' } : mm))
      } else {
        setMsg(r.error?.message || 'Could not stop this task.')
      }
    } catch (e) {
      console.error('adapter.chat.cancelTask threw', e)
      setMsg('Could not stop this task.')
    } finally {
      setCancellingId(null)
    }
  }
  useEffect(() => {
    const ids = Object.keys(pendingTasks)
    if (!ids.length || !adapter.chat.pollTask) return
    const id = setInterval(async () => {
      for (const taskId of ids) {
        const entry = pendingTasks[taskId]
        if (!entry) continue
        const r = await adapter.chat.pollTask!(taskId)
        if (!r.ok || r.status === 'queued' || r.status === 'running') continue
        setPendingTasks((t) => { const n = { ...t }; delete n[taskId]; return n })
        setRecentTasks((rt) => [{ taskId, sessionId: entry.sessionId, input: entry.input, status: (r.status === 'done' ? 'done' : 'error') as 'done' | 'error', completedAt: Date.now() }, ...rt].slice(0, 5))
        if (activeIdRef.current !== entry.sessionId) continue // resolved for a session the user isn't looking at; drop it silently
        if (r.status === 'done') {
          const reloaded = await adapter.messages.list(entry.sessionId)
          if (activeIdRef.current === entry.sessionId && reloaded.ok) { setMessages(reloaded.value.messages); resolveUrls(reloaded.value.messages) }
        } else {
          setMessages((m) => m.map((mm) => mm.id === entry.placeholderId ? { ...mm, content: r.error || "Liv couldn't finish this in the background." } : mm))
        }
      }
    }, 3000)
    return () => clearInterval(id)
  }, [pendingTasks, adapter])
  // Animated Liv-state glyph (idle / thinking / running-a-workflow) — ties the brand mark's
  // motion to the same generating signal as the Thinking indicator above. This is purely a CSS
  // animation applied to the existing CANONICAL glyph (see Glyph.tsx's `animated` prop) — never
  // a new mark, per the Liv-glyph law.
  const livGlyphState: 'idle' | 'thinking' | 'running' = toolActivity ? 'running' : sending ? 'thinking' : 'idle'
  const [msg, setMsg] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  // Per-message read-aloud (accessibility): which message is currently being spoken, and the
  // char range of the word currently highlighted (browser speechSynthesis path only — see
  // playMessage below).
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [highlightRange, setHighlightRange] = useState<{ start: number; end: number } | null>(null)
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
  const [pendingSuggestion, setPendingSuggestion] = useState<LivModelSuggestion | null>(null)
  // Whether the composer's Brain popover is open. Canonical Liv-chat placement: the Brain
  // pill (model + API key + usage) lives IN the composer next to attach/mic/send, NOT in
  // the chat header — see onelyf-planning/docs/liv-chat-canon.md (Tummyful is the reference design).
  const [brainOpen, setBrainOpen] = useState(false)
  // Brain sheet drag-to-dismiss: live vertical offset while the handle is being dragged
  // (0 = resting position). Swiping the handle down past DISMISS_THRESHOLD_PX closes the
  // sheet; releasing short of that snaps it back to 0.
  const [sheetDragY, setSheetDragY] = useState(0)
  const sheetDraggingRef = useRef(false)
  // Transcript viewer: view the open session in a chosen format (Markdown / Plain / JSON) with
  // copy + download. Opened from the header transcript button.
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [transcriptFormat, setTranscriptFormat] = useState<'markdown' | 'plain' | 'json'>('markdown')
  // Artifacts panel (livchat-artifacts-system) v1 — see its own effects below (search
  // "Artifacts panel — PRIMARY") for the auto-open/live-update rule, and the
  // ARTIFACT_SPLIT_KEY constant for the persisted divider position. `artifact` null means
  // the panel is closed.
  const [artifact, setArtifact] = useState<LivArtifact | null>(null)
  const [artifactCopied, setArtifactCopied] = useState(false)
  const [splitPct, setSplitPct] = useState<number>(() => {
    try {
      const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(ARTIFACT_SPLIT_KEY)
      const n = raw ? parseFloat(raw) : NaN
      return Number.isFinite(n) && n >= 20 && n <= 80 ? n : 45
    } catch { return 45 }
  })
  const splitRef = useRef<HTMLDivElement>(null)
  const splitDraggingRef = useRef(false)
  const [keyInput, setKeyInput] = useState('')
  const [modelInput, setModelInput] = useState(models[0]?.id ?? ANTHROPIC_FALLBACK_MODEL_ID)
  // Opt-in Brain-menu controls. Local mirror of the persisted value (loaded via key.get); a
  // change writes through key.set immediately, like the model picker.
  const showEffort = hat.enableEffort === true && !!adapter.key
  const showMode = hat.enableMode === true && !!adapter.key
  const showVerbosity = hat.enableVerbosity === true && !!adapter.key
  const showCompact = !!adapter.chat.compact
  const [effortInput, setEffortInput] = useState<LivEffort>(DEFAULT_EFFORT)
  const [modeInput, setModeInput] = useState<LivMode>(DEFAULT_MODE)
  const [verbosityInput, setVerbosityInput] = useState<LivVerbosity>(DEFAULT_VERBOSITY)
  const [autoCompact, setAutoCompact] = useState(false)
  const [compacting, setCompacting] = useState(false)
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
  // livchat-agentic-workflows: both ports present -> the adapter genuinely supports background
  // turns end to end, not just one half of the pair.
  const canBackgroundSend = !!(adapter.chat.sendBackground && adapter.chat.pollTask)
  // `/`-menu state (livchat-slash-menu-canon): open while the draft is a bare `/command` typed
  // at the very start of the composer (Claude-Code-style — no mid-sentence triggering), the
  // arrow-key-selected row, and the pending chip once a tool with args has been picked but not
  // yet submitted. slashIndex is clamped at render time against the current filtered list so a
  // keystroke that shrinks the list can never leave it pointing past the end.
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashIndex, setSlashIndex] = useState(0)
  // True once the user explicitly dismisses the popover (Escape or click-out) while still mid
  // slash-token, so further keystrokes that stay in slash-form (e.g. "/x" -> "/xy") don't just
  // reopen it — matches Claude Code, where Escape sticks until you leave slash-form entirely
  // (clear the token or add a space) and start a fresh one.
  const [slashDismissed, setSlashDismissed] = useState(false)
  const [slashPending, setSlashPending] = useState<{ tool: LivSlashTool; args: Record<string, string> } | null>(null)
  const slashMatch = /^\/(\S*)$/.exec(draft)
  const filteredSlashTools = slashOpen && slashMatch
    ? (slashTools ?? []).filter((t) => t.command.toLowerCase().startsWith(slashMatch[1].toLowerCase()))
    : []
  const slashActiveIndex = filteredSlashTools.length > 0 ? Math.min(slashIndex, filteredSlashTools.length - 1) : 0
  // Selecting a zero-arg tool fires onToolInvoke immediately (same shape as an `actions` item's
  // onSelect); a tool with args opens the inline chip mini-form instead so the user sees exactly
  // what's about to run before it does (canon rule: "always ask, never presume" applied to
  // Jeff's own tools, per docs/liv-composer-affordances.md).
  function selectSlashTool(tool: LivSlashTool) {
    setSlashOpen(false)
    setDraft('')
    if (!tool.args || tool.args.length === 0) {
      try { onToolInvoke?.(tool.id, {}) } catch (e) { console.error('onToolInvoke threw', e) }
      return
    }
    setSlashPending({ tool, args: Object.fromEntries(tool.args.map((a) => [a.name, ''])) })
  }
  function runSlashPending() {
    if (!slashPending) return
    const { tool, args } = slashPending
    if (tool.args?.some((a) => a.required && !args[a.name]?.trim())) return
    setSlashPending(null)
    try { onToolInvoke?.(tool.id, args) } catch (e) { console.error('onToolInvoke threw', e) }
  }
  // The external-link guard (livchat-external-link-guard): the URL currently pending a tap-
  // through, or null when no guard is showing. Re-set (not toggled) on every tap so the
  // modal fires on EVERY external link, not just the first one this session.
  const [linkGuardUrl, setLinkGuardUrl] = useState<string | null>(null)
  const [linkGuardSafetyOpen, setLinkGuardSafetyOpen] = useState(false)
  // A same-origin link (the app's own host) skips the guard entirely and opens directly —
  // only genuinely external destinations need the interstitial (Jeff, 2026-08-23).
  function handleLinkTap(url: string) {
    if (typeof window === 'undefined') return
    if (isSameOrigin(url, window.location.origin)) {
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    setLinkGuardSafetyOpen(false)
    setLinkGuardUrl(url)
  }
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

  async function loadKey() {
    if (!adapter.key) return
    try {
      const r = await adapter.key.get()
      if (r.ok) {
        setKeyInfo(r.value)
        if (r.value.provider) setProviderInput(r.value.provider)
        if (r.value.model) setModelInput(r.value.model)
        if (isEffort(r.value.effort)) setEffortInput(r.value.effort)
        if (isMode(r.value.mode)) setModeInput(r.value.mode)
        if (isVerbosity(r.value.verbosity)) setVerbosityInput(r.value.verbosity)
        if (typeof r.value.autoCompact === 'boolean') setAutoCompact(r.value.autoCompact)
        if (r.value.provider) setLiveModels(null)
      }
    } catch (e) { console.error('key.get failed', e) }
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
  useEffect(() => {
    onState?.({ messageCount: messages.length, thinking: sending || streaming.length > 0 })
  }, [messages.length, sending, streaming, onState])

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

  // Artifacts panel: persist the divider position across sessions (per browser).
  useEffect(() => {
    try { window.localStorage.setItem(ARTIFACT_SPLIT_KEY, String(splitPct)) } catch { /* ignore (private mode, quota) */ }
  }, [splitPct])

  // Artifacts panel — PRIMARY open/update path: once a liv reply commits to `messages`
  // (after the post-send `adapter.messages.list` reload), check it for an artifact. This
  // is the reliable trigger — an adapter that delivers its whole reply in one onChunk call
  // right before resolving (the common non-token-streaming shape; see the demo's
  // createDemoAdapter) never actually renders a non-empty `streaming` value at all: React
  // batches that single setStreaming(acc) together with the setStreaming('') that follows
  // once the awaited send() resolves, so an effect keyed on `streaming` alone silently never
  // fires for that adapter shape (caught by /forge's own visual verification, not by the
  // build). `messages` doesn't have that race — it's its own separate, later state commit.
  //
  // `artifactUserClosedRef` is reset here too, the instant a NEW turn starts (the optimistic
  // USER message commit, which every adapter produces synchronously at send() — a more
  // reliable "turn started" signal than watching `streaming` transition, since not every
  // adapter guarantees a visible streaming transition at all). A manual close during the
  // reply that follows sticks for that one reply; the next turn always gets a fresh chance.
  const artifactUserClosedRef = useRef(false)
  const artifactAutoOpenedIdRef = useRef<string | null>(null)
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last) return
    if (last.role === 'user') { artifactUserClosedRef.current = false; return }
    if (last.role !== 'liv') return
    if (artifactAutoOpenedIdRef.current === last.id) return
    artifactAutoOpenedIdRef.current = last.id
    if (artifactUserClosedRef.current) return
    const found = extractArtifact(last.content)
    if (found) setArtifact(found.artifact)
  }, [messages])

  // Artifacts panel — BONUS live-update path: for an adapter that genuinely delivers
  // incremental chunks with real gaps between them (e.g. createStreamingDemoAdapter's
  // word-by-word harness), this fills the panel in as it streams rather than only once the
  // turn commits. Harmless when it never fires — the PRIMARY effect above still covers that
  // reply once it lands in `messages`. Shares the same close flag as the primary path so a
  // mid-stream close isn't immediately overridden once the reply commits.
  useEffect(() => {
    if (!streaming || artifactUserClosedRef.current) return
    const found = extractArtifact(streaming)
    if (found) setArtifact(found.artifact)
  }, [streaming])

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
  // Per-message read-aloud (accessibility: Play button + highlight-follow), independent of the
  // hands-free auto-read-reply flow above. Word highlight-follow only activates on the browser
  // speechSynthesis fallback path (SpeechSynthesisUtterance's `boundary` event) — a fully custom
  // adapter.voice implementation has no boundary signal in its interface, so playback still
  // works there, the message just renders without a moving highlight.
  function playMessage(id: string, text?: string | null) {
    if (!text?.trim()) return
    if (playingId === id) { stopPlayingMessage(); return }
    stopPlayingMessage()
    setPlayingId(id)
    if (adapter.voice?.speak) {
      adapter.voice.speak(text).catch((e) => console.error('voice.speak failed', e))
        .finally(() => setPlayingId((cur) => (cur === id ? null : cur)))
      return
    }
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    if (!synth) { setPlayingId(null); return }
    synth.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.onboundary = (e) => {
      if (e.name && e.name !== 'word') return
      const start = e.charIndex
      // `charLength` isn't universally supported (present in Firefox, absent in Chrome); fall
      // back to measuring the next whitespace-delimited run from the boundary index.
      const wordMatch = /^\S+/.exec(text.slice(start))
      const end = start + (e.charLength || wordMatch?.[0].length || 1)
      setHighlightRange({ start, end })
    }
    utter.onend = () => setPlayingId((cur) => (cur === id ? null : cur))
    utter.onerror = () => setPlayingId((cur) => (cur === id ? null : cur))
    synth.speak(utter)
  }
  function stopPlayingMessage() {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    adapter.voice?.stop?.()
    setPlayingId(null)
    setHighlightRange(null)
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

  function renderTranscript(format: 'markdown' | 'plain' | 'json'): string {
    if (format === 'plain') return transcriptToPlainText(messages, { hatName: 'Liv' })
    if (format === 'json') return transcriptToJSON(messages, { hatName: 'Liv' })
    return transcriptToMarkdown(messages, { hatName: 'Liv' })
  }

  // Download the current transcript in the viewer's selected format — Blob + temporary <a download>.
  function downloadTranscript() {
    if (!messages.length) return
    try {
      const fmt = TRANSCRIPT_FORMATS.find((f) => f.id === transcriptFormat) ?? TRANSCRIPT_FORMATS[0]
      const text = renderTranscript(fmt.id)
      const d = new Date()
      const p = (n: number) => String(n).padStart(2, '0')
      const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
      const blob = new Blob([text], { type: `${fmt.mime};charset=utf-8` })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = transcriptFilename('Liv', stamp).replace(/\.md$/, `.${fmt.ext}`)
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

  // Copy the current transcript (selected format) to the clipboard.
  async function copyTranscript() {
    if (!messages.length) return
    try {
      await navigator.clipboard.writeText(renderTranscript(transcriptFormat))
      setMsg('Transcript copied.')
    } catch { setMsg('Could not copy — clipboard access was blocked.') }
  }

  // Download a single flagged document (livchat-document-creation) — Blob + temporary <a
  // download>, the same mechanism a whole-transcript export would use.
  function downloadDocument(doc: LivDocument) {
    try {
      const d = new Date()
      const p = (n: number) => String(n).padStart(2, '0')
      const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
      const blob = new Blob([doc.content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = documentFilename(doc.title, stamp)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (e) {
      console.error('document download failed', e)
      setMsg('Could not download this document.')
    }
  }

  // ─── Artifacts panel actions (livchat-artifacts-system v1) ─────────────────
  function closeArtifact() {
    artifactUserClosedRef.current = true
    setArtifact(null)
  }

  async function copyArtifact() {
    if (!artifact) return
    try {
      await navigator.clipboard.writeText(artifact.content)
      setArtifactCopied(true)
      setTimeout(() => setArtifactCopied(false), 1500)
    } catch { setMsg('Could not copy — clipboard access was blocked.') }
  }

  function downloadArtifact() {
    if (!artifact) return
    try {
      const d = new Date()
      const p = (n: number) => String(n).padStart(2, '0')
      const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
      const blob = new Blob([artifact.content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = artifactFilename(artifact.title, artifact.language, stamp)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (e) {
      console.error('artifact download failed', e)
      setMsg('Could not download this artifact.')
    }
  }

  // "Open in new tab / full-screen." HTML artifacts render live in a sandboxed iframe
  // that fills the viewport (opaque origin via sandbox without allow-same-origin — no
  // cookie / localStorage access back to the console). Non-HTML artifacts keep the
  // pre-wrapped source view. No backend involved: everything is a self-contained
  // Blob URL, revoked after the new tab has had time to fetch it.
  function expandArtifact() {
    if (!artifact) return
    try {
      const titleEsc = artifact.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      let html: string
      if (artifact.language === 'html') {
        // srcdoc parses HTML entities in its attribute value, so escape only & and " to
        // keep the artifact's own markup intact; sandbox without allow-same-origin gives
        // the iframe an opaque origin so any script inside can't read console cookies.
        // SECURITY: never add allow-same-origin to this sandbox attribute. Combined with
        // allow-scripts (needed for artifacts to run at all), that pairing lets sandboxed
        // artifact-authored script escape the opaque origin and reach parent-origin state
        // (cookies, localStorage, DOM) — a full sandbox escape. Keep allow-scripts alone.
        const srcdoc = artifact.content.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        html = `<!doctype html><html><head><meta charset="utf-8"><title>${titleEsc}</title>` +
          `<style>html,body{margin:0;padding:0;height:100%;background:#171b16}` +
          `iframe{border:0;width:100vw;height:100vh;display:block}</style></head>` +
          `<body><iframe sandbox="allow-scripts" srcdoc="${srcdoc}" title="${titleEsc}"></iframe></body></html>`
      } else {
        const esc = artifact.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        html = `<!doctype html><html><head><meta charset="utf-8"><title>${titleEsc}</title>` +
          `<style>body{margin:0;background:#171b16;color:#e8e4d6;font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}` +
          `pre{margin:0;padding:24px;white-space:pre-wrap;overflow-wrap:anywhere}</style></head>` +
          `<body><pre>${esc}</pre></body></html>`
      }
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000) // give the new tab time to finish loading it
    } catch (e) {
      console.error('artifact expand failed', e)
      setMsg('Could not open this artifact in a new tab.')
    }
  }

  function onArtifactDividerPointerDown(e: ReactPointerEvent) {
    e.preventDefault()
    const el = splitRef.current
    if (!el) return
    splitDraggingRef.current = true
    const move = (ev: PointerEvent) => {
      if (!splitDraggingRef.current) return
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0) return
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      setSplitPct(Math.min(80, Math.max(20, pct)))
    }
    const up = () => {
      splitDraggingRef.current = false
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Escape dismisses the Brain sheet same as the scrim/Close button. Scoped to when it's open —
  // otherwise Escape would fight the rename/slash-menu Escape handlers elsewhere in this file.
  useEffect(() => {
    if (!brainOpen) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setBrainOpen(false) } }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [brainOpen])

  const SHEET_DISMISS_THRESHOLD_PX = 80

  function onBrainSheetHandlePointerDown(e: ReactPointerEvent) {
    e.preventDefault()
    sheetDraggingRef.current = true
    const startY = e.clientY
    const move = (ev: PointerEvent) => {
      if (!sheetDraggingRef.current) return
      setSheetDragY(Math.max(0, ev.clientY - startY))
    }
    const up = () => {
      sheetDraggingRef.current = false
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setSheetDragY((y) => {
        if (y > SHEET_DISMISS_THRESHOLD_PX) setBrainOpen(false)
        return 0
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  async function saveKey() {
    if (!adapter.key) return
    const patch: { apiKey?: string; model?: string; provider?: string } = {}
    if (keyInput.trim()) patch.apiKey = keyInput.trim()
    if (modelInput) patch.model = modelInput
    if (providerInput) patch.provider = providerInput
    if (!patch.apiKey && !patch.model && !patch.provider) return
    const r = await adapter.key.set(patch)
    if (r.ok) { setKeyInfo({ ...r.value, provider: providerInput }); setKeyInput(''); setMsg('Saved. Liv can reply now.') }
    else setMsg(r.error?.message || 'Could not save key.')
  }

  // ── styles (inline, token-driven) ──
  const S = livChatStyles(accent)


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
          {/* View the whole conversation in a chosen format (Markdown / Plain / JSON) with copy +
              download. Disabled until there's something to show. */}
          <button
            type="button"
            className="lc-iconbtn"
            style={{ ...S.iconbtn, opacity: messages.length ? 1 : 0.4 }}
            disabled={!messages.length}
            aria-label="View transcript"
            title="View / export this conversation"
            onClick={() => setTranscriptOpen(true)}
          >
            <DownloadI />
          </button>
          {/* Task-visibility tray trigger. Gated on canBackgroundSend — same optional-port rule
              as the composer's "Run in Background" item, zero surface change for an adapter that
              doesn't support background turns. */}
          {canBackgroundSend && (
            <button
              type="button"
              className="lc-iconbtn"
              style={{ ...S.iconbtn, position: 'relative' }}
              aria-label="Background tasks"
              title="Background tasks"
              onClick={() => setTasksOpen(true)}
            >
              <ListChecksI />
              {Object.keys(pendingTasks).length > 0 && (
                <span aria-hidden="true" style={{
                  position: 'absolute', top: 0, right: 0, minWidth: 14, height: 14, borderRadius: radius.pill,
                  background: accent, color: cssVar.onPrimary, fontSize: 9, fontWeight: 700, lineHeight: '14px',
                  textAlign: 'center', padding: '0 3px',
                }}>{Object.keys(pendingTasks).length}</span>
                /* badge counts only in-flight tasks — recentTasks are already-resolved history,
                   not something that needs the user's attention the way a running task does */
              )}
            </button>
          )}
        </div>
        {!hat.hideHeaderTitle && (
          <h2 style={{ ...textStyle('h3'), margin: 0, display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 0, flex: 1, justifyContent: 'center' }}>
            {hat.glyph && <Glyph variant={hat.glyph} size={22} animated={hat.glyph === 'live' ? livGlyphState : 'none'} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Liv{hat.subtitle && <span style={{ ...S.muted, marginLeft: 6 }}>· {hat.subtitle}</span>}</span>
          </h2>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 0 }}>
          {(() => {
            const totalTok = (usage.input || 0) + (usage.output || 0)
            if (totalTok <= 0) return null
            const cost = usageCost(usage, keyInfo.model, costHintFor(keyInfo.model))
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
          {/* Dock controls — only when a floating host supplies them. Maximize expands to a
              fixed full-viewport overlay; restore returns to the panel; chevron-down collapses
              back to the launcher (conversation kept); X dismisses. The maximize/restore icon
              only renders when the host supplies the matching handler for the current dock state. */}
          {dock === 'full'
            ? onRestore && (
                <button type="button" className="lc-iconbtn" style={S.iconbtn} onClick={onRestore} title="Restore" aria-label="Restore Liv to a panel"><Minimize2I /></button>
              )
            : onMaximize && (
                <button type="button" className="lc-iconbtn" style={S.iconbtn} onClick={onMaximize} title="Maximize" aria-label="Maximize Liv to full screen"><Maximize2I /></button>
              )}
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

        <div className="lc-split" ref={splitRef} data-artifact-open={artifact ? 'true' : undefined} style={{ display: 'flex', flex: 1, minWidth: 0 }}>
        <div className="lc-main" style={{ ...S.main, ...(artifact ? { flex: `0 0 ${splitPct}%`, minWidth: 0 } : null) }}>
          <div className="lc-transcript" ref={transcriptRef} style={{ ...S.transcript, ...(dock === 'full' ? { maxHeight: 'none' } : null) }} onScroll={onTranscriptScroll}>
            {messages.length === 0 && !streaming && (
              <div style={{ margin: 'auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space.sm, padding: `${space.md}px ${space.sm}px`, maxWidth: 460 }}>
                {hat.glyph && <Glyph variant={hat.glyph} size={hat.hideHeaderTitle ? 120 : 64} animated={hat.glyph === 'live' ? livGlyphState : 'none'} />}
                <h3 style={{ ...textStyle('h2'), margin: 0 }}>Ask Liv</h3>
                {(hat.description || hat.emptyText) && (
                  <p style={{ ...S.muted, margin: 0 }}>{hat.description || hat.emptyText}</p>
                )}
                {hat.pills && hat.pills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 2 }}>
                    {hat.pills.map((p, i) => (
                      <span key={i} style={{ ...textStyle('caption'), border: `1px solid ${accent}`, color: accent, borderRadius: radius.pill, padding: '3px 10px' }}>{titleCase(p)}</span>
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
            {messages.map((m) => {
              // livchat-document-creation: a liv reply can flag part of itself as a real,
              // downloadable document (see extractDocument's own comment for the fence
              // convention). Only checked on liv turns — a user's own message is never
              // parsed as a document, even if it happens to contain a ```document fence.
              const doc = m.role === 'liv' ? extractDocument(m.content) : null
              // livchat-artifacts-system: a liv reply can flag CODE as a live-rendered artifact
              // (```artifact lang Title) instead of a plain downloadable ```document — opens in
              // the dedicated side panel (see the artifact state/effects above `send`) rather
              // than an inline download. Checked after `doc` (document wins the rare both-fence
              // case, same precedence style as doc-vs-options below).
              const artifactFound = !doc && m.role === 'liv' ? extractArtifact(m.content) : null
              // livchat-decision-options-cards: a liv reply can offer labelled choices via an
              // ```options fence; DS renders them as tappable cards and a tap sends that choice
              // as the next turn. Always PARSED on liv turns (so the raw fence is stripped from
              // the transcript even on older messages), but only the MOST-RECENT message's cards
              // stay tappable — stale choices from an earlier turn shouldn't re-fire once the
              // conversation has moved on. Documents/artifacts take precedence in the rare
              // multi-fence case.
              const isLast = m.id === messages[messages.length - 1]?.id
              const opts = !doc && !artifactFound && m.role === 'liv' ? extractOptions(m.content) : null
              const optionsLive = !!opts && isLast && !sending
              // livchat-agentic-workflows: the locally-synthesized placeholder for a background
              // task still in flight (queued/running) — send() inserts it with empty content and
              // an id prefixed `task-`; the polling effect above fills in real content (done) or
              // an error line (error) once pollTask reports a terminal status.
              const isPendingTask = m.role === 'liv' && !m.content && m.id.startsWith('task-')
              return (
              <div key={m.id} className="lc-bubble" style={bubbleStyle(m.role)}>
                {/* Read-aloud (accessibility): Play sits top-left of the response frame — the
                    leftmost control in the header row. Copy moves to a footer row, bottom-right
                    (see below the content). Liv's own replies only; reading back the user's own
                    typed message aloud isn't the ask here. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {m.role === 'liv' && m.content && (
                    <button className="lc-iconbtn" style={S.iconbtn}
                      title={playingId === m.id ? 'Stop reading aloud' : 'Read this message aloud'}
                      aria-label={playingId === m.id ? 'Stop reading aloud' : 'Read this message aloud'}
                      aria-pressed={playingId === m.id}
                      onClick={() => playMessage(m.id, m.content)}>
                      {playingId === m.id ? <StopSmallI /> : <PlayI />}
                    </button>
                  )}
                  <span style={{ ...textStyle('overline'), color: cssVar.mid }}>{m.role === 'liv' ? 'Liv' : 'You'}</span>
                  <ModalityPill modality={m.modality} />
                </div>
                {attachmentsOf(m).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: m.content ? 6 : 0 }}>
                    {attachmentsOf(m).map((a, i) => {
                      // Images render as thumbnails (backward compatible — older attachments were all
                      // stamped kind:'image'); anything else renders as a file chip styled like the
                      // composer's own file pills. A path/mime-less legacy attachment defaults to image.
                      const isImage = a.kind === 'image' || (!!a.mime && a.mime.startsWith('image/')) || (!a.kind && !a.mime)
                      if (isImage) {
                        return urls[a.path]
                          ? <img key={i} src={urls[a.path]} alt="attachment" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: radius.sm, border: `1px solid ${cssVar.border}` }} />
                          : <span key={i} style={{ width: 84, height: 84, display: 'grid', placeItems: 'center', borderRadius: radius.sm, border: `1px dashed ${cssVar.border}`, color: cssVar.dim }}><ImageI /></span>
                      }
                      const fname = a.name || a.path.split('/').pop() || 'file'
                      return (
                        <span key={i} title={fname} style={{ ...textStyle('caption'), background: cssVar.track, borderRadius: radius.pill, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%', overflowWrap: 'anywhere' }}>
                          <FileTextI /> {fname}
                        </span>
                      )
                    })}
                  </div>
                )}
                {isPendingTask ? (
                  // Same "Thinking" pill language as the live-streaming bubble below (lc-thinking),
                  // relabeled — this task is running detached from the turn that queued it, not
                  // this component's own `sending` state, so it gets its own always-on pulse.
                  <span className="lc-thinking" style={{ ...textStyle('caption'), color: cssVar.mid, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span className="lc-thinking-label">Running in background</span>
                  </span>
                ) : opts ? (
                  <>
                    {opts.text && <div style={{ ...textStyle('body'), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: space.xs }}><Linkified text={opts.text} onLinkTap={handleLinkTap} /></div>}
                    <div className="lc-options" role="group" aria-label="Choose an option" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {opts.options.map((label, i) => (
                        <button
                          key={i}
                          type="button"
                          className="lc-option ds-btn"
                          disabled={!optionsLive}
                          onClick={() => { if (optionsLive) send(label) }}
                          style={{ ...textStyle('bodySm'), textAlign: 'left', color: cssVar.ink, background: cssVar.surface,
                            border: `1px solid ${cssVar.border}`, borderRadius: radius.md, padding: '9px 12px',
                            cursor: optionsLive ? 'pointer' : 'default', opacity: optionsLive ? 1 : 0.55 }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : doc ? (
                  <>
                    {doc.text && <div style={{ ...textStyle('body'), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: space.xs }}><Linkified text={doc.text} onLinkTap={handleLinkTap} /></div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${cssVar.border}`, borderRadius: radius.md, padding: '8px 10px', background: cssVar.surface }}>
                      <FileTextI />
                      <span style={{ ...textStyle('bodySm'), flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.document.title}</span>
                      <button type="button" className="lc-iconbtn" style={S.iconbtn} title="Download this document (Markdown)" aria-label={`Download ${doc.document.title}`} onClick={() => downloadDocument(doc.document)}>
                        <DownloadI />
                      </button>
                    </div>
                  </>
                ) : artifactFound ? (
                  <>
                    {artifactFound.text && <div style={{ ...textStyle('body'), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: space.xs }}><Linkified text={artifactFound.text} onLinkTap={handleLinkTap} /></div>}
                    <button
                      type="button"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${cssVar.border}`, borderRadius: radius.md, padding: '8px 10px', background: cssVar.surface, color: cssVar.ink, cursor: 'pointer', width: '100%', textAlign: 'left' }}
                      onClick={() => { artifactUserClosedRef.current = false; setArtifact(artifactFound.artifact) }}
                      title={`Open ${artifactFound.artifact.title} in the artifacts panel`}
                    >
                      <CodeI />
                      <span style={{ ...textStyle('bodySm'), flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artifactFound.artifact.title}</span>
                      <span style={{ ...textStyle('caption'), color: cssVar.dim }}>{artifactFound.artifact.language}</span>
                    </button>
                  </>
                ) : (
                  m.content && (
                    <div style={{ ...textStyle('body'), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {playingId === m.id && highlightRange
                        ? <HighlightedText text={m.content} range={highlightRange} />
                        : <Linkified text={m.content} onLinkTap={handleLinkTap} />}
                    </div>
                  )
                )}
                {m.content && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                    <button className="lc-copy lc-iconbtn" style={S.iconbtn} title="Copy message" onClick={() => copyMessage(m.id, m.content)}>
                      {copiedId === m.id ? (<><CheckI /> <span style={textStyle('caption')}>Copied</span></>) : <CopyI />}
                    </button>
                  </div>
                )}
              </div>
              )
            })}
            {(streaming || toolActivity) && (
              <div ref={liveTurnRef} className="lc-bubble" style={bubbleStyle('liv')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ ...textStyle('overline'), color: cssVar.mid }}>Liv</span>
                  <ModalityPill modality="text" />
                  {/* 'Thinking' status + live run-time counter: a
                      Claude-style generating indicator, model-agnostic (driven by LivChat's own
                      `sending` state, never a vendor name). Ticks for the whole turn, not just
                      before the first token — LivChat has no separate reasoning/output signal to
                      freeze it at. Shares the idle/thinking/running-workflow state machine with
                      the animated header glyph (see livGlyphState below). */}
                  {sending && (
                    <span className="lc-thinking" style={{ ...textStyle('caption'), color: cssVar.mid, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span className="lc-thinking-label">{toolActivity ? 'Working' : 'Thinking'}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{elapsedSec}s</span>
                    </span>
                  )}
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
                    the activity line above carries the "working" signal instead. livchat-console-
                    artifact-regressions: once an ```artifact fence opens, everything from there
                    onward is raw code streaming in one character at a time — show a "Generating
                    artifact" placeholder instead of dumping it into the transcript; the normal
                    collapsed-link rendering (extractArtifact against `m.content`) takes over the
                    instant the turn commits. */}
                {streaming && (() => {
                  const preview = streamingArtifactPreview(streaming)
                  if (!preview) {
                    return <div style={{ ...textStyle('body'), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><Linkified text={streaming} onLinkTap={handleLinkTap} /><span className="lc-caret">▍</span></div>
                  }
                  return (
                    <>
                      {preview.textBefore && <div style={{ ...textStyle('body'), whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: space.xs }}><Linkified text={preview.textBefore} onLinkTap={handleLinkTap} /></div>}
                      <span className="lc-thinking" style={{ ...textStyle('caption'), color: cssVar.mid, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span className="lc-thinking-label">Generating artifact: {preview.title}…</span>
                      </span>
                    </>
                  )
                })()}
              </div>
            )}
            {pendingSuggestion && !sending && (
              <div style={{ background: cssVar.track, border: `1px solid ${accent}`, borderRadius: radius.md, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
                <div style={{ ...textStyle('caption'), color: accent, fontWeight: 700 }}>Model suggestion</div>
                <p style={{ ...textStyle('caption'), color: cssVar.mid, margin: 0 }}>{pendingSuggestion.reason}</p>
                <div style={{ ...textStyle('caption'), color: cssVar.ink, fontWeight: 600 }}>
                  {PROVIDER_LABELS[pendingSuggestion.provider] ?? pendingSuggestion.provider} · {pendingSuggestion.model}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="ds-btn" style={{ ...textStyle('caption'), fontWeight: 700, padding: '5px 12px', borderRadius: radius.sm, cursor: 'pointer', border: `1px solid ${accent}`, background: accent, color: cssVar.surface }}
                    onClick={async () => {
                      const s = pendingSuggestion!
                      const r = await adapter.key!.set({ provider: s.provider, model: s.model })
                      if (r.ok) {
                        setProviderInput(s.provider)
                        setModelInput(s.model)
                        setKeyInfo((k) => ({ ...k, provider: s.provider, model: s.model }))
                        setLiveModels(null)
                        setMsg(`Switched to ${PROVIDER_LABELS[s.provider] ?? s.provider} ${s.model}.`)
                      }
                      setPendingSuggestion(null)
                    }}>Switch</button>
                  <button className="ds-btn" style={{ ...textStyle('caption'), fontWeight: 700, padding: '5px 12px', borderRadius: radius.sm, cursor: 'pointer', border: `1px solid ${cssVar.border}`, background: 'transparent', color: cssVar.mid }}
                    onClick={() => setPendingSuggestion(null)}>Dismiss</button>
                </div>
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
                      {actionQueue.introText || ('Liv ' + (cards.length === 1 ? 'proposes this change. Nothing happens until you tap Apply:' : 'proposes these changes. Nothing happens until you tap Apply:'))}
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
                              title={notReady ? "Needs a detail. Tell Liv the missing part and it'll update this card" : 'Apply this change'}>
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
                  <span key={i} style={{ ...textStyle('caption'), background: cssVar.track, borderRadius: radius.pill, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%', overflowWrap: 'anywhere' }}>{f.type.startsWith('image/') ? <ImageI /> : <FileTextI />} {f.name}</span>
                ))}
              </div>
            )}
            {slashPending && (
              <div style={{ background: cssVar.track, border: `1px solid ${cssVar.border}`, borderRadius: radius.md, padding: 8, marginBottom: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ ...textStyle('bodySm'), fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {slashPending.tool.icon ?? <ToolI />} /{slashPending.tool.command}
                  </span>
                  <button type="button" className="lc-iconbtn" title="Cancel" aria-label="Cancel"
                    onClick={() => setSlashPending(null)} style={{ ...S.composerIconbtn, width: 22, height: 22 }}>
                    <CloseI />
                  </button>
                </div>
                {slashPending.tool.args!.map((a) => (
                  <label key={a.name} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ ...textStyle('caption'), color: cssVar.mid }}>{a.label}{a.required && ' *'}</span>
                    <input className="ds-input" style={S.input} placeholder={a.placeholder}
                      value={slashPending.args[a.name] ?? ''}
                      onChange={(e) => { const v = e.target.value; setSlashPending((p) => p && ({ ...p, args: { ...p.args, [a.name]: v } })) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSlashPending() } else if (e.key === 'Escape') { e.preventDefault(); setSlashPending(null) } }} />
                  </label>
                ))}
                <button type="button" className="ds-btn" style={S.primaryBtn}
                  disabled={slashPending.tool.args!.some((a) => a.required && !slashPending.args[a.name]?.trim())}
                  onClick={runSlashPending}>Run</button>
              </div>
            )}
            <div style={{ position: 'relative' }}>
              {/* `/`-menu popover (livchat-slash-menu-canon) — opens above the composer when the
                  draft is a bare `/command` at the very start, filtered as the user keeps typing.
                  Arrow keys move slashIndex; Enter/Tab/click selects; Escape dismisses without
                  clearing the draft (handled in the textarea's onKeyDown below). */}
              {filteredSlashTools.length > 0 && (
                <>
                  {/* Click-out overlay, same technique as the composer actions-menu popover
                      above: a full-viewport transparent div under the popover (but over
                      everything else) that dismisses on any tap outside it. Needed because
                      clicking away doesn't otherwise change `draft`, so without this the
                      popover would stay visually open until the next keystroke or Escape. */}
                  <div onClick={() => { setSlashOpen(false); setSlashDismissed(true) }}
                    style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'transparent' }} />
                  <div className="lc-slash-menu lc-glass" role="listbox" aria-label="Tools" style={{
                    position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4, zIndex: 31,
                    maxHeight: 220, overflowY: 'auto',
                    background: cssVar.surface, border: `1px solid ${cssVar.border}`, borderRadius: radius.md,
                    boxShadow: 'var(--ds-shadow-card)', padding: 4, display: 'flex', flexDirection: 'column', gap: 1,
                  }}>
                    {filteredSlashTools.map((t, i) => (
                      <button key={t.id} type="button" role="option" aria-selected={i === slashActiveIndex}
                        onMouseEnter={() => setSlashIndex(i)}
                        onClick={() => selectSlashTool(t)}
                        style={{ ...textStyle('bodySm'), textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                          background: i === slashActiveIndex ? cssVar.track : 'transparent',
                          border: 0, borderRadius: radius.sm, padding: '6px 8px', cursor: 'pointer', color: cssVar.ink }}>
                        <span style={{ display: 'inline-flex', width: 16, flexShrink: 0 }}>{t.icon ?? <ToolI />}</span>
                        <span style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>/{t.command}</span>
                          <span style={{ ...textStyle('caption'), color: cssVar.mid }}>{t.label}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <textarea ref={composerRef} className="ds-input" style={{ ...S.input, width: '100%', resize: 'none', minHeight: 44, maxHeight: 160 }}
                placeholder={hat.placeholder || 'Message Liv…'}
                value={draft}
                onChange={(e) => {
                  const v = e.target.value
                  setDraft(v)
                  setSlashIndex(0)
                  if (!slashTools || slashTools.length === 0) return
                  if (/^\/(\S*)$/.test(v)) { if (!slashDismissed) setSlashOpen(true) }
                  else { setSlashOpen(false); setSlashDismissed(false) }
                }}
                onKeyDown={(e) => {
                  if (slashOpen && filteredSlashTools.length > 0) {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex((i) => (i + 1) % filteredSlashTools.length); return }
                    if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex((i) => (i - 1 + filteredSlashTools.length) % filteredSlashTools.length); return }
                    if (e.key === 'Escape') { e.preventDefault(); setSlashOpen(false); setSlashDismissed(true); return }
                    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectSlashTool(filteredSlashTools[slashActiveIndex]); return }
                  }
                  if (shouldSendOnEnter(e.key, e.shiftKey, e.nativeEvent.isComposing, enterSends)) { e.preventDefault(); send() }
                }}
                rows={1} />
            </div>
            {/* Toolbar row order: Brain (far LEFT) | Attach (+) | Tools (actions) | [spacer] |
                Hands-free | Dictate | Send/Stop. The spacer (marginLeft: auto on the Hands-free
                button below) balances the row left/right — a brief no-spacer revision read
                left-clustered/unbalanced on a real phone. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              {/* Brain pill: model + API-key + provider settings, all folded together. Gated on
                  showKey (which respects hat.enableKey === false — a hat that opts out gets no
                  Brain pill at all). Opens a bottom SHEET (see below, outside this row) — not an
                  anchored popover — a professional, Claude-model-selector-like
                  brain-menu direction. */}
              {showKey && (
                <div style={{ display: 'inline-flex', minWidth: 0 }}>
                  {/* Brain pill: opaque surface backing + accent border, matching Tummyful's
                      original `.composer-modelpill` canon — was `background: transparent` with
                      a subtle grey border, which read as a floating word rather than a pill
                      button (Jeff 2026-08-09: "I want the terra cotta pill backing for the
                      buttons not just a glow"). Every consumer now gets the pill shape; the
                      accent color they wear (terracotta / green) still comes from their own
                      hat.accent, so this stays palette-agnostic. */}
                  <button type="button" className="lc-iconbtn ds-btn"
                    style={{ ...textStyle('caption'), color: accent, background: cssVar.surface, border: `1px solid ${accent}`, borderRadius: radius.pill, padding: '4px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, minWidth: 0 }}
                    title="Brain: model + API key" aria-label="Brain: model, API key, and settings"
                    aria-expanded={brainOpen} aria-haspopup="dialog" onClick={() => setBrainOpen((o) => !o)}>
                    {hat.glyph === 'live' && <Glyph variant="live" size={14} animated={livGlyphState} alt="" />}
                    {/* whiteSpace:nowrap + ellipsis, NOT the default wrap: a cramped toolbar (many
                        icons + a long model name) wraps this label to 2 lines, growing the pill
                        taller than its sibling icon buttons and visually breaking the row — reads
                        as the label text bleeding past the pill's edges. minWidth:0 up the chain
                        (this span + its button + wrapper div) is what lets it actually
                        shrink/truncate instead of forcing the row to overflow the card's own
                        overflow:hidden bounds. */}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                      {keyInfo.hasKey ? (models.find((m) => m.id === (keyInfo.model || modelInput))?.label.split('·')[0].trim() || (PROVIDER_LABELS[providerInput] ?? 'Model')) : 'Add Key'}
                    </span>
                    <span style={{ fontSize: 9, opacity: 0.7, flexShrink: 0 }}>▾</span>
                  </button>
                </div>
              )}
              {/* Gated on hat.enableAttachments alone, NOT adapter.attachments — that field is a
                  signedUrl RESOLVER for redisplaying a past attachment already in storage (see
                  its use below in the history-hydration effect), an unrelated capability from
                  "can this turn carry a file." chat.send(args: {files?: File[]}) accepts files on
                  every adapter per the interface, so an adapter with no storage-backed redisplay
                  (attachments ride into the model call inline, never persisted — e.g. Commis)
                  could still never show this button before this fix, even though sending files
                  worked fine end to end. */}
              {showAttach && (
                <>
                  <button className="lc-iconbtn" style={S.composerIconbtn} title="Attach a file" aria-label="Attach a file" onClick={() => fileRef.current?.click()}><PlusI /></button>
                  <input ref={fileRef} type="file" accept={ATTACH_ACCEPT} multiple style={{ display: 'none' }} onChange={(e) => {
                    // Validate each pick against the size + type policy. Accepted files stage as
                    // attachments; rejected ones surface a VISIBLE error line (not a silent drop) via
                    // the same setMsg channel key/rename/model errors already use. Reset the input so
                    // re-picking a just-rejected file re-fires onChange.
                    const picked = Array.from(e.target.files || [])
                    const accepted: File[] = []
                    const errors: string[] = []
                    for (const f of picked) {
                      const err = attachmentError(f, { maxBytes: ATTACH_MAX_BYTES, allowed: ATTACH_ALLOWED })
                      if (err) errors.push(err); else accepted.push(f)
                    }
                    setFiles(accepted)
                    setMsg(errors.join(' '))
                    if (errors.length && fileRef.current) fileRef.current.value = ''
                  }} />
                </>
              )}
              {/* Brain bottom sheet — a more professional take on Claude's model-selector
                  sheet, not a literal copy. Rendered as a fixed
                  scrim + rise-from-bottom panel rather than an anchored popover: scrollable,
                  expandable, Liquid Glass (see .lc-brain-sheet / .lc-glass below). */}
              {showKey && brainOpen && (
                <div className="lc-sheet-scrim" onClick={() => setBrainOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <div role="dialog" aria-modal="true" aria-label="Brain: model, API key, and settings"
                    onClick={(e) => e.stopPropagation()}
                    className="lc-glass lc-brain-sheet"
                    style={{
                      width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto', overscrollBehavior: 'contain',
                      borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
                      padding: 16, paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
                      boxShadow: 'var(--ds-shadow-card)', display: 'flex', flexDirection: 'column', gap: 8,
                      transform: sheetDragY ? `translateY(${sheetDragY}px)` : undefined,
                    }}>
                    {/* Drag-to-dismiss: swipe the handle down past SHEET_DISMISS_THRESHOLD_PX to close. */}
                    <div className="lc-sheet-handle" aria-hidden="true"
                      onPointerDown={onBrainSheetHandlePointerDown}
                      style={{ cursor: 'grab', touchAction: 'none' }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ ...textStyle('overline'), color: accent, fontWeight: 700 }}>Brain</div>
                      <button type="button" className="lc-iconbtn" style={S.iconbtn} onClick={() => setBrainOpen(false)}
                        title="Close" aria-label="Close Brain settings"><CloseI /></button>
                    </div>
                        <p style={{ ...S.muted, margin: 0 }}>
                          Liv replies using <strong>your own API key</strong>.
                          {keyInfo.hasKey ? ' A key is set.' : ' No key yet.'}
                        </p>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ ...textStyle('caption'), color: cssVar.mid }}>Provider</span>
                          <select className="ds-input" style={{ ...S.input, width: '100%', boxSizing: 'border-box' }}
                            value={providerInput}
                            onChange={async (e) => {
                              const id = e.target.value
                              setProviderInput(id)
                              setLiveModels(null)
                              const fallback = PROVIDER_FALLBACK_MODELS[id]
                              if (fallback?.length) setModelInput(fallback[0].id)
                              const r = await adapter.key!.set({ provider: id })
                              if (r.ok) setKeyInfo((k) => ({ ...k, provider: id, hasKey: r.value?.hasKey ?? k.hasKey }))
                              else setMsg(r.error?.message || 'Could not switch provider.')
                            }}>
                            {(keyInfo.availableProviders?.length
                              ? keyInfo.availableProviders
                              : Object.keys(PROVIDER_LABELS)
                            ).map((p) => <option key={p} value={p}>{PROVIDER_LABELS[p] || p}</option>)}
                          </select>
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ ...textStyle('caption'), color: cssVar.mid }}>API Key</span>
                          <input className="ds-input" type="password" style={{ ...S.input, width: '100%', boxSizing: 'border-box' }}
                            placeholder={keyInfo.hasKey ? 'Replace key' : 'API key'}
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
                        {/* Effort slider — reasoning depth (Low→Max). Ordinal, so a slider. The
                            app's adapter maps this to the provider's effort param on each request. */}
                        {showEffort && (
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ ...textStyle('caption'), color: cssVar.mid, display: 'flex', justifyContent: 'space-between' }}>
                              <span>Effort</span>
                              <span style={{ color: accent, fontWeight: 700 }}>{EFFORT_LEVELS[effortIndex(effortInput)].label}</span>
                            </span>
                            <input type="range" min={0} max={EFFORT_LEVELS.length - 1} step={1}
                              style={{ width: '100%', accentColor: accent }}
                              value={effortIndex(effortInput)}
                              aria-label="Reasoning effort"
                              onChange={async (e) => {
                                const next = effortAtIndex(Number(e.target.value))
                                setEffortInput(next)
                                const r = await adapter.key!.set({ effort: next })
                                if (r.ok) setKeyInfo((k) => ({ ...k, effort: next }))
                                else setMsg(r.error?.message || 'Could not set effort.')
                              }} />
                          </label>
                        )}
                        {/* Autonomy mode — Auto/Plan/Manual. Segmented (discrete, non-ordinal). The
                            app enforces the Auto boundary: reversible edits apply directly, money /
                            deletes / sends / irreversible always confirm-gate regardless of mode. */}
                        {showMode && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ ...textStyle('caption'), color: cssVar.mid }}>Mode</span>
                            <div role="group" aria-label="Autonomy mode" style={{ display: 'flex', gap: 4 }}>
                              {MODES.map((m) => {
                                const active = modeInput === m.id
                                return (
                                  <button key={m.id} type="button" className="ds-btn" title={m.hint}
                                    aria-pressed={active}
                                    style={{ flex: 1, ...textStyle('caption'), fontWeight: 700, padding: '5px 6px', borderRadius: radius.sm, cursor: 'pointer',
                                      border: `1px solid ${active ? accent : cssVar.border}`,
                                      background: active ? accent : cssVar.surface,
                                      color: active ? cssVar.surface : cssVar.mid }}
                                    onClick={async () => {
                                      setModeInput(m.id)
                                      const r = await adapter.key!.set({ mode: m.id })
                                      if (r.ok) setKeyInfo((k) => ({ ...k, mode: m.id }))
                                      else setMsg(r.error?.message || 'Could not set mode.')
                                    }}>{m.label}</button>
                                )
                              })}
                            </div>
                            <span style={{ ...textStyle('caption'), color: cssVar.dim }}>{MODES.find((m) => m.id === modeInput)?.hint}</span>
                          </div>
                        )}
                        {/* Output verbosity — Terse/Verbose/Summary. How long each reply is; the
                            app maps it to a system-prompt directive. Independent of effort. */}
                        {showVerbosity && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ ...textStyle('caption'), color: cssVar.mid }}>Output</span>
                            <div role="group" aria-label="Output verbosity" style={{ display: 'flex', gap: 4 }}>
                              {VERBOSITY_OPTIONS.map((v) => {
                                const active = verbosityInput === v.id
                                return (
                                  <button key={v.id} type="button" className="ds-btn" title={v.hint}
                                    aria-pressed={active}
                                    style={{ flex: 1, ...textStyle('caption'), fontWeight: 700, padding: '5px 6px', borderRadius: radius.sm, cursor: 'pointer',
                                      border: `1px solid ${active ? accent : cssVar.border}`,
                                      background: active ? accent : cssVar.surface,
                                      color: active ? cssVar.surface : cssVar.mid }}
                                    onClick={async () => {
                                      setVerbosityInput(v.id)
                                      const r = await adapter.key!.set({ verbosity: v.id })
                                      if (r.ok) setKeyInfo((k) => ({ ...k, verbosity: v.id }))
                                      else setMsg(r.error?.message || 'Could not set output style.')
                                    }}>{v.label}</button>
                                )
                              })}
                            </div>
                            <span style={{ ...textStyle('caption'), color: cssVar.dim }}>{VERBOSITY_OPTIONS.find((v) => v.id === verbosityInput)?.hint}</span>
                          </div>
                        )}
                        {/* Compaction — manual "Compact now" + Auto toggle. Summarizes the session
                            to keep the working context small (auto fires past the token threshold). */}
                        {showCompact && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ ...textStyle('caption'), color: cssVar.mid }}>Context</span>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <button type="button" className="ds-btn"
                                disabled={compacting || !activeId || !messages.length}
                                style={{ ...textStyle('caption'), fontWeight: 700, padding: '5px 8px', borderRadius: radius.sm, cursor: (compacting || !messages.length) ? 'default' : 'pointer', border: `1px solid ${accent}`, background: cssVar.surface, color: accent, opacity: (compacting || !messages.length) ? 0.5 : 1 }}
                                onClick={() => doCompact(activeId)}>{compacting ? 'Compacting…' : 'Compact now'}</button>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, ...textStyle('caption'), color: cssVar.mid, cursor: 'pointer' }}>
                                <input type="checkbox" checked={autoCompact}
                                  onChange={async (e) => {
                                    const on = e.target.checked
                                    setAutoCompact(on)
                                    const r = await adapter.key?.set({ autoCompact: on })
                                    if (r && !r.ok) setMsg(r.error?.message || 'Could not save auto-compact.')
                                  }} />
                                Auto
                              </label>
                            </div>
                            <span style={{ ...textStyle('caption'), color: cssVar.dim }}>Summarize the conversation to keep the context small. Auto compacts past ~{Math.round((hat.compactThreshold ?? DEFAULT_COMPACT_THRESHOLD) / 1000)}K tokens.</span>
                          </div>
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
                          const costHint = costHintFor(keyInfo.model)
                          const totalTok = (usage.input || 0) + (usage.output || 0)
                          const sessionCost = usageCost(usage, keyInfo.model, costHint)
                          const lastTok = lastTurn ? (lastTurn.input || 0) + (lastTurn.output || 0) : 0
                          const lastCost = lastTurn ? usageCost(lastTurn, keyInfo.model, costHint) : 0
                          const dailyTok = (daily.input || 0) + (daily.output || 0)
                          const dailyCost = usageCost(daily, keyInfo.model, costHint)
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
                </div>
              )}
              {/* Composer actions menu — Commis's chef's-knife popover ("turn this into…"),
                  Advisor's "add to budget" etc. DS owns the trigger + popover layout + click-out;
                  the app supplies items + handlers. The trigger uses hat.toolIcon when set (so
                  Commis gets its chef's knife), else a generic tool glyph. Also the background-
                  send trigger (livchat-agentic-workflows): reusing this EXISTING popover rather
                  than adding a new composer icon keeps the locked composer icon order untouched
                  — a background-capable adapter just unlocks one more DS-owned item in the same
                  list, host items and all. */}
              {(canBackgroundSend || (actions && actions.length > 0)) && (
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
                      <div className="lc-actions-menu lc-glass" role="menu" style={{
                        position: 'absolute', bottom: '100%', left: 0, marginBottom: 6,
                        minWidth: 200, maxWidth: 280, zIndex: 31,
                        background: cssVar.surface, border: `1px solid ${cssVar.border}`,
                        borderRadius: radius.md, padding: 4, boxShadow: 'var(--ds-shadow-card)',
                        display: 'flex', flexDirection: 'column', gap: 1,
                      }}>
                        {actions?.map((a) => (
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
                        {canBackgroundSend && (() => {
                          const empty = !draft.trim() && files.length === 0
                          return (
                            <button type="button" role="menuitem"
                              className="lc-actions-item"
                              disabled={empty || sending}
                              style={{ ...textStyle('bodySm'), textAlign: 'left', background: 'transparent', border: 0,
                                padding: '8px 10px', borderRadius: radius.sm, cursor: (empty || sending) ? 'not-allowed' : 'pointer',
                                color: (empty || sending) ? cssVar.dim : cssVar.ink, opacity: (empty || sending) ? 0.6 : 1,
                                display: 'flex', flexDirection: 'column', gap: 2 }}
                              onClick={() => { setActionsOpen(false); void send(undefined, undefined, true) }}>
                              <span>Run in Background</span>
                              <span style={{ ...textStyle('caption'), color: cssVar.mid }}>Liv keeps working while you do something else. This reply lands in the conversation when it's done.</span>
                            </button>
                          )
                        })()}
                      </div>
                    </>
                  )}
                </div>
              )}
              {/* Voice: hands-free read-aloud (always available via browser TTS fallback) + mic
                  dictation (only where the browser supports speech-in). marginLeft: auto pushes
                  this Hands-free/Dictate/Send cluster to the row's far right — restores the
                  left/right balance of the original `+ | Brain ▾ | actions ▾ | (spacer) | 🔊 | 🎙
                  | ↑` canon (a brief no-spacer revision read left-clustered/unbalanced on a real
                  phone). Pressed states use
                  filled backgrounds — Tummyful's `.composer-icon.on` (hands-free accent fill) +
                  `.composer-icon.listening` (mic danger fill) — so the active mode is
                  unmistakable at a glance, not just a color shift on the SVG. */}
              <button type="button" className="lc-iconbtn"
                style={{ ...S.composerIconbtn,
                  marginLeft: 'auto',
                  background: handsFree ? accent : cssVar.surface,
                  borderColor: handsFree ? accent : cssVar.borderBright,
                  color: handsFree ? cssVar.onPrimary : cssVar.ink }}
                title="Hands-free: read replies aloud" aria-pressed={handsFree}
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

        {artifact && (
          <>
            <div
              className="lc-artifact-divider"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize the artifact panel"
              onPointerDown={onArtifactDividerPointerDown}
            />
            <div className="lc-artifact-panel" style={{ flex: `0 0 ${100 - splitPct}%`, minWidth: 0, display: 'flex', flexDirection: 'column', background: cssVar.surface, borderLeft: `1px solid ${cssVar.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${cssVar.border}` }}>
                <CodeI />
                <span style={{ ...textStyle('bodySm'), fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artifact.title}</span>
                <span style={{ ...textStyle('caption'), color: cssVar.dim }}>{artifact.language}</span>
                <button type="button" className="lc-iconbtn" style={S.iconbtn} title="Copy" aria-label="Copy artifact" onClick={copyArtifact}>
                  {artifactCopied ? <CheckI /> : <CopyI />}
                </button>
                <button type="button" className="lc-iconbtn" style={S.iconbtn} title="Download" aria-label="Download artifact" onClick={downloadArtifact}>
                  <DownloadI />
                </button>
                <button type="button" className="lc-iconbtn" style={S.iconbtn} title="Open in a new tab" aria-label="Open artifact in a new tab" onClick={expandArtifact}>
                  <ExternalLinkI />
                </button>
                <button type="button" className="lc-iconbtn" style={S.iconbtn} title="Close" aria-label="Close artifact panel" onClick={closeArtifact}>
                  <CloseI />
                </button>
              </div>
              <pre style={{ margin: 0, flex: 1, overflow: 'auto', padding: 12, ...textStyle('caption'), fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                <code>
                  {highlightCode(artifact.content, artifact.language).map((tok, i) => (
                    <span key={i} style={{ color: SYNTAX_COLOR[tok.kind], fontStyle: tok.kind === 'comment' ? 'italic' : 'normal' }}>{tok.text}</span>
                  ))}
                </code>
              </pre>
            </div>
          </>
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
        <div onClick={() => setTranscriptOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="dialog" aria-label="Transcript" aria-modal="true" onClick={(e) => e.stopPropagation()}
            className="lc-glass"
            style={{ border: `1px solid ${cssVar.border}`, borderRadius: radius.md, boxShadow: 'var(--ds-shadow-card)', width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: 8, padding: 12, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ ...textStyle('overline'), color: accent, fontWeight: 700 }}>Transcript</span>
              <button type="button" className="ds-btn" style={{ ...textStyle('caption'), color: cssVar.mid, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                aria-label="Close transcript" onClick={() => setTranscriptOpen(false)}>Close</button>
            </div>
            <div role="group" aria-label="Transcript format" style={{ display: 'flex', gap: 4 }}>
              {TRANSCRIPT_FORMATS.map((f) => {
                const active = transcriptFormat === f.id
                return (
                  <button key={f.id} type="button" className="ds-btn" aria-pressed={active}
                    style={{ flex: 1, ...textStyle('caption'), fontWeight: 700, padding: '5px 6px', borderRadius: radius.sm, cursor: 'pointer',
                      border: `1px solid ${active ? accent : cssVar.border}`,
                      background: active ? accent : cssVar.surface,
                      color: active ? cssVar.surface : cssVar.mid }}
                    onClick={() => setTranscriptFormat(f.id)}>{f.label}</button>
                )
              })}
            </div>
            <pre style={{ margin: 0, overflow: 'auto', flex: 1, minHeight: 120, background: cssVar.surface, border: `1px solid ${cssVar.border}`, borderRadius: radius.sm, padding: 10, ...textStyle('caption'), whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{renderTranscript(transcriptFormat)}</pre>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="ds-btn" style={{ ...S.primaryBtn, flex: 1 }} onClick={copyTranscript}>Copy</button>
              <button type="button" className="ds-btn" style={{ ...textStyle('caption'), fontWeight: 700, flex: 1, padding: '8px 10px', borderRadius: radius.sm, cursor: 'pointer', border: `1px solid ${accent}`, background: cssVar.surface, color: accent }} onClick={downloadTranscript}>Download</button>
            </div>
          </div>
        </div>
      )}
      {tasksOpen && (
        <div onClick={() => setTasksOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="dialog" aria-label="Background tasks" aria-modal="true" onClick={(e) => e.stopPropagation()}
            className="lc-glass"
            style={{ border: `1px solid ${cssVar.border}`, borderRadius: radius.md, boxShadow: 'var(--ds-shadow-card)', width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: 8, padding: 12, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ ...textStyle('overline'), color: accent, fontWeight: 700 }}>Background Tasks</span>
              <button type="button" className="ds-btn" style={{ ...textStyle('caption'), color: cssVar.mid, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                aria-label="Close background tasks" onClick={() => setTasksOpen(false)}>Close</button>
            </div>
            {Object.keys(pendingTasks).length === 0 && recentTasks.length === 0 ? (
              <p style={{ ...textStyle('bodySm'), color: cssVar.mid, margin: 0, padding: '8px 0' }}>Nothing running in the background right now.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto' }}>
                {Object.entries(pendingTasks).map(([taskId, t]) => (
                  <div key={taskId} style={{ border: `1px solid ${cssVar.border}`, borderRadius: radius.sm, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ ...textStyle('bodySm'), color: cssVar.ink, overflowWrap: 'anywhere' }}>{t.input.length > 96 ? `${t.input.slice(0, 96)}…` : t.input}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ ...textStyle('caption'), color: cssVar.mid, flex: 1 }}>Running, started {new Date(t.startedAt).toLocaleTimeString()}</span>
                      <button type="button" className="ds-btn" style={{ ...textStyle('caption'), fontWeight: 700, padding: '5px 8px', borderRadius: radius.sm, cursor: 'pointer', border: `1px solid ${cssVar.border}`, background: cssVar.surface, color: cssVar.ink }}
                        onClick={() => { setTasksOpen(false); if (t.sessionId !== activeId) void selectSession(t.sessionId) }}>View</button>
                      {adapter.chat.cancelTask && (
                        <button type="button" className="ds-btn" disabled={cancellingId === taskId}
                          style={{ ...textStyle('caption'), fontWeight: 700, padding: '5px 8px', borderRadius: radius.sm, cursor: cancellingId === taskId ? 'not-allowed' : 'pointer', border: `1px solid ${cssVar.border}`, background: cssVar.surface, color: cssVar.mid, opacity: cancellingId === taskId ? 0.6 : 1 }}
                          onClick={() => void cancelTask(taskId)}>Stop</button>
                      )}
                    </div>
                  </div>
                ))}
                {recentTasks.map((t) => (
                  <div key={t.taskId} style={{ border: `1px solid ${cssVar.border}`, borderRadius: radius.sm, padding: 8, display: 'flex', flexDirection: 'column', gap: 6, opacity: 0.85 }}>
                    <span style={{ ...textStyle('bodySm'), color: cssVar.ink, overflowWrap: 'anywhere' }}>{t.input.length > 96 ? `${t.input.slice(0, 96)}…` : t.input}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ ...textStyle('caption'), color: t.status === 'error' ? cssVar.danger : cssVar.mid, flex: 1 }}>
                        {t.status === 'done' ? 'Finished' : 'Failed'} {new Date(t.completedAt).toLocaleTimeString()}
                      </span>
                      <button type="button" className="ds-btn" style={{ ...textStyle('caption'), fontWeight: 700, padding: '5px 8px', borderRadius: radius.sm, cursor: 'pointer', border: `1px solid ${cssVar.border}`, background: cssVar.surface, color: cssVar.ink }}
                        onClick={() => { setTasksOpen(false); if (t.sessionId !== activeId) void selectSession(t.sessionId) }}>View</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
