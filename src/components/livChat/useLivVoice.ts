// ─── Voice: hands-free, dictation, read-aloud ──────────────────────────────────
// Moved out of LivChat.tsx (W3 legibility refactor). Owns the per-message read-aloud state,
// the hands-free toggle, browser SpeechRecognition dictation, and TTS. LivChat calls this hook
// at the same point the handsFreeRef/draftRef sync effects used to sit, so effect order is
// unchanged. `send` is passed in fresh every render, so toggleMic's onend closure calls the
// same render's send() exactly as it did when this code lived inline.
import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { LivChatAdapter } from './types'

// Minimal shape of the experimental Web Speech API (not in the standard TS DOM lib) — just the
// bits the mic uses. Cast the vendor-prefixed constructor to this when dictation is available.
interface SpeechRecResult { readonly isFinal: boolean; readonly 0: { readonly transcript: string } }
interface SpeechRecEvent { readonly resultIndex: number; readonly results: ArrayLike<SpeechRecResult> }
interface SpeechRec {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: (e: SpeechRecEvent) => void; onend: () => void; onerror: () => void
  start(): void; stop(): void
}

export function useLivVoice({ adapter, draft, setDraft, send, onHandsFreeChange, hostOwnsHandsFreeVoice }: {
  adapter: LivChatAdapter
  draft: string
  setDraft: Dispatch<SetStateAction<string>>
  send: (overrideText?: string) => Promise<void>
  onHandsFreeChange?: (on: boolean) => void
  hostOwnsHandsFreeVoice?: boolean
}) {
  // Per-message read-aloud (accessibility): which message is currently being spoken, and the
  // char range of the word currently highlighted (browser speechSynthesis path only — see
  // playMessage below).
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [highlightRange, setHighlightRange] = useState<{ start: number; end: number } | null>(null)

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

  // Read text aloud: the app's own voice if it supplies one, else the browser's speechSynthesis.
  async function speak(text: string) {
    if (!text.trim()) return
    try {
      if (adapter.voice?.speak) { await adapter.voice.speak(text, { surface: 'live' }); return }  // Hands-free: a live turn
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
      adapter.voice.speak(text, { surface: 'readAloud' }).catch((e) => console.error('voice.speak failed', e))
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
  // The composer's Hands-free (speaker) button handler — moved verbatim from its inline onClick.
  function toggleHandsFree() {
    setHandsFree((v) => {
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
    })
  }
  return {
    playingId, highlightRange, handsFree, listening, recognitionRef, speechInSupported,
    speak, stopSpeaking, playMessage, stopPlayingMessage, toggleMic, toggleHandsFree,
  }
}
