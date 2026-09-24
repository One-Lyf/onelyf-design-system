// ─── LivChat public types ─────────────────────────────────────────────────────
// Moved verbatim out of LivChat.tsx (W3 legibility refactor). LivChat.tsx re-exports every
// type here, so `import { type LivChatProps } from './components/LivChat'` keeps working.
import type { ReactNode } from 'react'
import type { GlyphVariant } from '../../Glyph'
import type { LivModel } from '../livChatModels'
import type { LivEffort, LivMode, LivVerbosity } from '../livChatModes'

export type LivResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error?: { message?: string; detail?: string } }

export interface LivSession { id: string; title?: string | null; channel?: string }
// `kind` distinguishes an image (rendered as a thumbnail) from any other file (rendered as a
// chip). `name` is the original filename for the chip label; optional so a backend that only
// stores a storage path still renders (the chip falls back to the path's basename).
export interface LivAttachment { kind?: string; path: string; mime?: string; name?: string }
export interface LivMessage {
  id: string
  role: 'user' | 'liv'
  modality?: 'voice' | 'text'
  channel?: string
  content?: string | null
  attachments?: LivAttachment[] | string | null
}
export interface LivKeyInfo {
  hasKey: boolean
  model?: string | null
  provider?: string | null
  availableProviders?: string[]
  effort?: LivEffort | null
  mode?: LivMode | null
  verbosity?: LivVerbosity | null
  autoCompact?: boolean | null
}
// What adapter.spend.get() resolves to (see LivChatAdapter.spend).
export interface LivSpendInfo {
  limitUsd: number | null
  monthSpendUsd: number
  canEdit: boolean
}
// LivModel lives in ./livChatModels; LivEffort/LivMode in ./livChatModes. Re-exported here so
// the public surface stays single-import.
export type { LivModel } from '../livChatModels'
export type { LivEffort, LivMode, LivVerbosity } from '../livChatModes'

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
export interface LivModelSuggestion {
  provider: string
  model: string
  reason: string
}

export type LivChatSendResult =
  | { ok: true; usage?: LivUsage; extras?: unknown; modelSuggestion?: LivModelSuggestion | null }
  | { ok: false; error?: { message?: string; detail?: string }; extras?: unknown }

// livchat-agentic-workflows: a turn Liv runs in the background, outliving this chat turn instead
// of streaming inline. `sendBackground` only kicks the work off (the model call hasn't
// necessarily even started yet); `pollTask` is how LivChat learns it finished.
export type LivTaskStatus = 'queued' | 'running' | 'done' | 'error'
export type LivBackgroundSendResult =
  | { ok: true; taskId: string }
  | { ok: false; error?: { message?: string; detail?: string } }
export type LivTaskPollResult =
  | { ok: true; status: LivTaskStatus; result?: string | null; error?: string | null }
  // `code: 'not_found'` (the backend's HTTP 404 for an unknown task) tells LivChat to stop
  // polling that task and settle it as an error; any other failure is retried.
  | { ok: false; error?: { message?: string; code?: string } }
export type LivTaskCancelResult =
  | { ok: true }
  | { ok: false; error?: { message?: string } }

// The one identity knob. `accent` themes the avatar/active states to the hat's
// space (Cash Stash gold, Tummyful terracotta …); everything else falls back to
// the design-system defaults so a hat is a few lines, not a restyle.
export interface LivHat {
  // Internal id only (Commis/Advisor/etc., or storage-key scoping) — naming law
  // (onelyf-planning/docs/liv-chat-canon.md) requires every user-facing render to say
  // "Liv" regardless of this value; never interpolate it directly into rendered copy.
  name: string
  subtitle?: string            // shown muted next to the name ("sessions")
  accent?: string              // hat accent (defaults to --ds-primary)
  placeholder?: string         // composer placeholder
  emptyText?: string           // transcript empty-state line
  intro?: string               // muted blurb under the header
  enableAttachments?: boolean  // show the image attach control (default true)
  enableKey?: boolean          // show the bring-your-own-key settings (default true)
  models?: LivModel[]          // model choices for the key panel + inline composer selector
  // Opt-in Brain-menu controls (default OFF): a reasoning-EFFORT slider and an autonomy-MODE
  // selector (Auto/Plan/Manual). A hat turns these on only once its adapter actually consumes
  // them — effort feeds the provider request, mode gates how a proposed change is applied — so
  // no surface shows a control that does nothing. The value persists via adapter.key.set.
  enableEffort?: boolean
  enableMode?: boolean
  enableVerbosity?: boolean     // Terse/Verbose/Summary output selector
  compactThreshold?: number     // auto-compact token trigger (default DEFAULT_COMPACT_THRESHOLD)
  glyph?: GlyphVariant         // brand mark shown in the header ('live' for Liv); omit for none
  hideHeaderTitle?: boolean   // drop the header glyph+"Liv" <h2> entirely (empty-state glyph
                               // becomes the single Liv mark) — opt-in per app, Jeff-approved
                               // default OFF so apps that want the header title keep it
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
    // Optional compaction. When present, LivChat shows a "Compact" control (+ an Auto-compact
    // toggle) and, on auto, calls this once a session's cumulative token usage crosses the
    // threshold. The app summarizes the session's history and replaces it with a compact summary
    // so later turns carry less context. On success LivChat reloads the (now shorter) transcript.
    // Provider-agnostic: the app decides HOW to summarize. Absent → no compaction UI.
    compact?(sessionId: string): Promise<LivResult>
    // Optional background-turn port (livchat-agentic-workflows). When BOTH sendBackground and
    // pollTask are present, LivChat offers "Run in Background" in the composer's actions popover
    // (no new composer icon — reuses the existing chef's-knife/tools popover, so the locked
    // composer icon order is untouched). sendBackground kicks the turn off and returns
    // immediately with a taskId instead of streaming; LivChat then polls pollTask on an interval
    // and resolves the pending bubble to the real reply (re-fetched via messages.list, same as
    // any other turn) or an error, without blocking the rest of the conversation in the meantime.
    // Either or both absent → no background affordance, zero behavior change for every existing
    // adapter (Commis, Advisor, ...).
    sendBackground?(args: { sessionId: string; text: string; files?: File[] }): Promise<LivBackgroundSendResult>
    pollTask?(taskId: string): Promise<LivTaskPollResult>
    // Optional: stop an in-flight background task (task-visibility tray). Same optional-port
    // pattern as sendBackground/pollTask — absent means the tray still lists tasks and lets the
    // user jump to their transcript, it just doesn't render a Stop control. Never fake a stop
    // button with nothing behind it.
    cancelTask?(taskId: string): Promise<LivTaskCancelResult>
  }
  attachments?: { signedUrl(path: string): Promise<string> }
  key?: {
    get(): Promise<LivResult<LivKeyInfo>>
    // `effort` / `mode` are only sent when the hat enables those controls; adapters that don't
    // support them can ignore the fields (they stay optional on the patch).
    set(patch: { apiKey?: string; model?: string; provider?: string; effort?: LivEffort; mode?: LivMode; verbosity?: LivVerbosity; autoCompact?: boolean }): Promise<LivResult<LivKeyInfo>>
    // Optional live model discovery. When present, LivChat calls this the first time the
    // Brain menu opens and populates the picker from the result — real ids + display names.
    // The host wires it to its own backend, which calls the provider's `GET /v1/models`
    // (server-side, where the user's key lives) so new provider releases appear on their own,
    // no redeploy. Absent (or a failed/empty call) → the picker uses hat.models / the static
    // fallback. The returned list is run through curateLivModels() before display.
    listModels?(): Promise<LivResult<{ models: LivModel[] }>>
  }
  // Optional monthly AI spend limit (BYOK). There is no platform key and no platform cap: the
  // key's OWNER may set an optional monthly USD limit, blank/null = no limit (the default), and
  // it also bounds household members the owner shares the key with. When present, the Brain
  // sheet renders an embedded SpendLimitField (no button of its own): it calls get() each time
  // the sheet opens, and the sheet's single Save calls setLimit() once, only when the limit
  // changed (an invalid entry shows inline and blocks the Save). Absent → no spend UI at all.
  // Renders only where the Brain sheet does (hat.enableKey !== false and adapter.key present).
  //   get():      `limitUsd` null = no limit; `monthSpendUsd` = this UTC month's ESTIMATED spend
  //               on the key (src/spend's getSpendSummary); `canEdit` false when the user is on
  //               someone else's shared key (read-only; the organizer manages it). Reject on
  //               failure; the sheet shows a neutral load error.
  //   setLimit(): persist the limit (null clears it); the DS validates first (positive, cents).
  //               Reject on failure; the error shows inline and the sheet stays open.
  // The server side (check before a call, record after) lives in src/spend (checkSpendLimit /
  // recordSpend), which is dependency-free so edge functions can import it directly.
  spend?: {
    get(): Promise<LivSpendInfo>
    setLimit(limitUsd: number | null): Promise<void>
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
  // Bump (any new value) whenever the host saves/changes the API key OUTSIDE this instance
  // (e.g. liv-console's LivBrain tab) so the Brain pill/sheet re-reads adapter.key.get() instead
  // of showing stale "Add Key" from its one-time mount fetch. Omit for hosts where LivChat's own
  // Brain sheet is the only place a key is ever set.
  keyNonce?: number | string
  // Optional: report chat state up to a host that keeps this instance mounted across navigation
  // (e.g. a persistent LivDock/bubble) — it drives the launcher's unread dot + thinking pulse.
  // Omitted by inline hosts that don't need it.
  onState?: (s: { messageCount: number; thinking: boolean }) => void
  // Optional dock controls. When a host floats this chat in a bubble/panel it passes these to
  // render a chevron-down (minimize) and X (close) in THIS header — so the card has one header
  // with its controls, not a separate dock chrome bar stacked on top. Omit for an inline host.
  onMinimize?: () => void
  onClose?: () => void
  // Optional full-screen (maximize) dock state. `dock` is the geometry the component renders now:
  // 'panel' (default) sizes within its host box; 'full' escapes to a fixed, full-viewport overlay
  // (position:fixed inset:0 — so it clears any host/LivDock box without either side changing). The
  // HOST owns the state and flips it via onMaximize/onRestore; LivChat stays mounted across the
  // change, so the conversation, draft, scroll position, and streaming reply all survive. The
  // maximize/restore icon renders only when at least one handler is supplied.
  dock?: 'panel' | 'full'
  onMaximize?: () => void
  onRestore?: () => void
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
  // `/`-menu primitive (livchat-slash-menu-canon, docs/liv-composer-affordances.md) — a
  // Claude-Code-style command popover fed by the app's tool registry. NOT a fallback for NL
  // auto-call; a second entry point into the SAME tools for discoverability/precision/speed/
  // accountability (see the doc's "why both" section). Typing `/` at the start of the composer
  // opens a filterable popover of `slashTools`; selecting one with `args` opens an inline chip
  // mini-form; submitting calls `onToolInvoke` with the tool id + filled args — the host
  // dispatches through whatever handler its NL path already uses for that same registry entry.
  slashTools?: LivSlashTool[]
  onToolInvoke?: (toolId: string, args: Record<string, string>) => void
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

// One field in a slash-tool's argument mini-form (livchat-slash-menu-canon). Text-only for v1 —
// covers every registered tool surfaced so far (subscriptions, budget line-items, etc.); a
// typed/select variant can extend this later without breaking existing registries.
export interface LivSlashToolArg {
  name: string          // key passed back in the args map onToolInvoke receives
  label: string         // shown above the field in the chip's mini-form
  placeholder?: string
  required?: boolean
}

// One entry in the `/`-menu's tool registry — the SAME registry entry the app's NL auto-call
// path already dispatches through; this is just the manual, typed entry point into it. DS owns
// the trigger detection + popover + chip UI; the app supplies the list + `onToolInvoke` handler.
export interface LivSlashTool {
  id: string                // registry key handed back to onToolInvoke, e.g. 'subscriptions.list_recurring'
  command: string           // typed after `/` to match, e.g. 'subscriptions' -> `/subscriptions`
  label: string             // short description shown in the popover row
  icon?: ReactNode
  args?: LivSlashToolArg[]  // omit for a zero-arg tool that fires immediately on selection
}
