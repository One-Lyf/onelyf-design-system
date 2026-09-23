// ─── Artifacts panel (livchat-artifacts-system v1) ─────────────────────────────
// Moved out of LivChat.tsx (W3 legibility refactor): panel state, the persisted divider split,
// the auto-open effects, and the copy/download/expand/close/drag actions. LivChat calls this hook
// at the same point its three artifact effects used to sit, so effect order is unchanged.
import { useEffect, useRef, useState } from 'react'
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from 'react'
import { extractArtifact, artifactFilename, type LivArtifact } from '../livChatComposer'
import { ARTIFACT_SPLIT_KEY } from './constants'
import type { LivMessage } from './types'

export function useArtifactPanel({ messages, streaming, setMsg }: {
  messages: LivMessage[]
  streaming: string
  setMsg: Dispatch<SetStateAction<string>>
}) {
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

  // A transcript bubble's "open in the artifacts panel" tap — moved verbatim from its inline
  // onClick (clears the manual-close flag, then opens).
  function openArtifact(a: LivArtifact) {
    artifactUserClosedRef.current = false; setArtifact(a)
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

  return {
    artifact, artifactCopied, splitPct, splitRef,
    openArtifact, closeArtifact, copyArtifact, downloadArtifact, expandArtifact, onArtifactDividerPointerDown,
  }
}
