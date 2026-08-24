// ─── LivChat composer key logic ─────────────────────────────────────────────
// Pulled out of LivChat.tsx as a plain, JSX-free module so this decision can be
// unit-tested with Node's built-in test runner (no test framework / DOM needed
// in this package today) — see livChatComposer.test.ts alongside it.

// Whether the composer's Enter keydown should submit. Plain Enter sends,
// Shift+Enter inserts a newline — but during IME composition (typing Japanese,
// Chinese, Korean, etc. via a candidate picker) the Enter that CONFIRMS the
// selected candidate also fires a native 'Enter' keydown. Without the
// isComposing guard that keydown was indistinguishable from a real submit, so
// every composed word got cut off and sent mid-composition instead of staying
// in the draft. `isComposing` is exactly the signal for "this Enter belongs to
// the IME, not the form" (mirrors e.nativeEvent.isComposing on the DOM event).
// `enterSends` is false on touch-primary devices (phones/tablets): there, the on-screen keyboard's
// Return key should insert a NEWLINE and the user sends with the Send button — Jeff: "my keyboard's
// return button sends the message rather than creating a new row of text." On a physical keyboard
// (fine pointer) plain Enter still sends, Shift+Enter still newlines.
export function shouldSendOnEnter(key: string, shiftKey: boolean, isComposing: boolean, enterSends: boolean): boolean {
  return enterSends && key === 'Enter' && !shiftKey && !isComposing
}

// ─── Interrupt-a-turn: what to keep when the user hits Stop mid-stream ────────
// When the user stops a streaming reply, whatever text already arrived must stay
// in the transcript (matching Claude — the partial answer you already got doesn't
// vanish), instead of being discarded when the stream is cancelled. This is the
// pure decision behind that; LivChat's send() calls it in both abort paths (the
// adapter that resolves {ok:false} on AbortError, and the one that throws).
//
// Returns the assistant "partial turn" to append, or null when nothing should be
// added:
//   - not aborted            → null (a normal completed/errored turn, handled elsewhere)
//   - empty/whitespace text  → null (Stop was hit before any token streamed in —
//                              an empty bubble would be noise)
//   - reply already recorded → null (dedup: on the {ok:false} path we append to the
//                              SERVER-reloaded transcript; if that already ends with a liv
//                              turn the backend persisted the reply itself, so appending
//                              our partial would double the bubble. Keyed on "the last
//                              message is a liv turn", NOT exact-content — a backend that
//                              saved a slightly LONGER partial than the client received
//                              before the abort landed wouldn't match on content, and we'd
//                              paint a near-duplicate. The user message is always persisted
//                              first, so a still-unanswered turn ends with the user's msg.)
// Kept JSX/React-free so it unit-tests under `node --test` like shouldSendOnEnter.
export interface PartialTurn { id: string; role: 'liv'; modality: 'text'; content: string }
export function partialTurnToAppend(
  aborted: boolean,
  streamed: string,
  existing: ReadonlyArray<{ role: string; content?: string | null }>,
  makeId: () => string,
): PartialTurn | null {
  if (!aborted) return null
  const content = streamed.trim()
  if (!content) return null
  const last = existing[existing.length - 1]
  if (last && last.role === 'liv') return null
  return { id: makeId(), role: 'liv', modality: 'text', content }
}

// ─── Export a whole conversation as Markdown ─────────────────────────────────
// Renders the full transcript (all turns, in order) as a readable Markdown document
// for download — the conversation-level counterpart to the per-turn copy button.
// Pure so it unit-tests under `node --test`; LivChat wraps the result in a Blob and
// triggers a download. LivMessage carries no timestamp, so none is emitted (the gate
// asks for timestamps only "if available"); a message with attachments but no text
// gets a bracketed placeholder so the turn isn't silently dropped.
export function transcriptToMarkdown(
  messages: ReadonlyArray<{ role: string; content?: string | null; attachments?: unknown }>,
  opts: { hatName: string; title?: string },
): string {
  const name = opts.hatName || 'Liv'
  const out: string[] = [`# ${opts.title || `Conversation with ${name}`}`, '']
  for (const m of messages) {
    const who = m.role === 'liv' ? name : 'You'
    const text = (m.content || '').trim()
    const hasAttach = Array.isArray(m.attachments) ? m.attachments.length > 0
      : typeof m.attachments === 'string' ? m.attachments.trim().length > 2 // not "" / "[]"
      : false
    const body = text || (hasAttach ? '_(attachment)_' : '_(no text)_')
    out.push(`**${who}:**`, '', body, '')
  }
  return out.join('\n').trimEnd() + '\n'
}

// A filesystem-safe, human-readable filename for a downloaded transcript. `stamp` is
// passed in (not read from Date here — keeps this pure/testable); LivChat supplies it.
export function transcriptFilename(hatName: string, stamp: string): string {
  const slug = (hatName || 'liv').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'liv'
  return `${slug}-conversation-${stamp}.md`
}

// ─── Document creation (livchat-document-creation) — v1: a fenced block convention ──
// Liv flags a reply as a real, downloadable document (a meal plan, a budget summary, a
// generated recipe) rather than a wall of chat text the user has to manually copy and
// reformat, by wrapping it in a fenced block whose info string is `document` followed by
// an optional title on the same line — the same shape a model already reaches for with a
// normal ```lang code fence, so it needs no new output format to learn:
//
//   ```document Weekly Meal Plan
//   # Weekly Meal Plan
//   ...
//   ```
//
// v1 deliberately supports ONE document per reply (the first fence found) — this is the
// "structured export" half the node's own notes called out as shippable first, not the
// full Artifacts-style live-rendered panel (livchat-artifacts-system, still open). Each
// app's backend/system-prompt decides WHEN to emit this fence (that's app business logic,
// outside the DS); LivChat's job is only to notice one and render/download it distinctly.
export interface LivDocument { title: string; content: string }

const DOCUMENT_OPEN = /```document([^\n]*)\n/

// Finds the block opened by `openRegex` (which must match only the OPENING fence line,
// capturing any same-line info string as group 1) and walks forward line-by-line to find
// its balanced close, rather than stopping at the first ``` anywhere in the string. A
// non-greedy regex alone (the original approach) closes on the FIRST ``` it meets — which
// is the nested fence's own close if the document/options body itself contains a code
// sample (```js ... ```), silently truncating everything after it. Any interior line that
// opens a fence WITH an info string (```js, ```python, …) nests one level deeper; only a
// bare ``` line (no info string) closes a level, and the outer block only ends when that
// closes the OUTERMOST level. Malformed/never-closed content returns null, same as before.
function findFencedBlock(content: string, openRegex: RegExp): { index: number; openMatch: RegExpExecArray; body: string; end: number } | null {
  const openMatch = openRegex.exec(content)
  if (!openMatch) return null
  const bodyStart = openMatch.index + openMatch[0].length
  const rest = content.slice(bodyStart)
  const lines = rest.split('\n')
  let depth = 1
  let offset = 0
  for (const line of lines) {
    if (line.startsWith('```')) {
      const info = line.slice(3).trim()
      if (info === '') {
        depth--
        if (depth === 0) {
          return { index: openMatch.index, openMatch, body: rest.slice(0, offset), end: bodyStart + offset + 3 }
        }
      } else {
        depth++
      }
    }
    offset += line.length + 1
  }
  return null // never closed at the outer level — malformed, no document
}

export function extractDocument(content: string | null | undefined): { text: string; document: LivDocument } | null {
  if (!content) return null
  const found = findFencedBlock(content, DOCUMENT_OPEN)
  if (!found) return null
  const body = found.body.trim()
  if (!body) return null // an empty fence is treated as no document, not a blank one
  const title = (found.openMatch[1] || '').trim() || 'Document'
  const text = (content.slice(0, found.index) + content.slice(found.end)).trim()
  return { text, document: { title, content: body } }
}

// A filesystem-safe, human-readable filename for a downloaded document, slugged from its
// title (falls back to "document" for an empty/all-punctuation title, same pattern as
// transcript export's own hat-name fallback).
export function documentFilename(title: string, stamp: string): string {
  const slug = (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'document'
  return `${slug}-${stamp}.md`
}

// ─── Decision / options cards ────────────────────────────────────────────────
// A GENERAL options primitive (livchat-decision-options-cards): Liv can offer a set of
// labelled choices at any conversational decision point — NOT the per-app, pre-registered
// action-card system (ACTIONS[card.type]), which needs an app to know each card type ahead
// of time. Instead Liv emits a fenced ```options block in her reply text (same convention
// family as the ```document fence), one choice per line; DS parses it out and renders the
// choices as tappable cards, and tapping one sends that choice back as the next turn. Any
// hat gets it for free — no app wiring, no registration.
//
//   ```options
//   - Weeknight quick dinners
//   - Batch-cook for the week
//   - Something impressive for guests
//   ```
//
// Returns null (render as normal text) when: no fence, or fewer than 2 real choices — a
// single "option" isn't a decision. Leading bullet markers (-, *, 1.) are stripped so the
// model can write a natural list. Kept JSX-free for node --test.
const OPTIONS_OPEN = /```options[^\n]*\n/
export function extractOptions(content: string | null | undefined): { text: string; options: string[] } | null {
  if (!content) return null
  const found = findFencedBlock(content, OPTIONS_OPEN)
  if (!found) return null
  const options = found.body
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s+/, '').trim()) // strip a leading bullet / "1." marker
    .filter(Boolean)
  if (options.length < 2) return null // 0-1 choices isn't a decision — leave it as plain text
  const text = (content.slice(0, found.index) + content.slice(found.end)).trim()
  return { text, options }
}

// ─── Auto-linkify + external-link guard (livchat-external-link-guard) ────────────────────────
// Jeff live 2026-08-23 (via /builders): pasted URLs rendered as plain text with no tap-through
// warning. This is the pure half — splitting message text into linkable segments, and deciding
// whether a given URL should skip LivChat's external-link interstitial. LivChat.tsx does the
// JSX rendering + the modal; kept out of here so this stays node --test-able like its siblings.

// Bare-URL detector. Deliberately excludes whitespace/angle-brackets/quotes from the match body
// so it doesn't reach across a wrapping `<...>` or "..." — trailing SENTENCE punctuation (a
// period ending the sentence, a closing paren) still needs a separate trim pass below, since it's
// indistinguishable from URL characters by charset alone.
const URL_RE = /https?:\/\/[^\s<>"']+/g
const TRAILING_PUNCT = ".,!?;:'\")]}"

// Trims trailing punctuation off a raw regex match and returns it as separate trailing text, e.g.
// "https://x.com." -> { url: "https://x.com", trail: "." } so the period doesn't get folded into
// the link. A trailing ")" is kept as part of the URL when the URL itself contains an unmatched
// "(" (Wikipedia-style URLs with a parenthetical in the path) — otherwise it's almost always the
// sentence's own closing paren, not the URL's.
function trimTrailingPunct(raw: string): { url: string; trail: string } {
  let url = raw
  let trail = ''
  while (url.length > 0) {
    const ch = url[url.length - 1]
    if (!TRAILING_PUNCT.includes(ch)) break
    if (ch === ')') {
      const opens = (url.match(/\(/g) || []).length
      const closes = (url.match(/\)/g) || []).length
      if (opens >= closes) break // this ')' balances an '(' inside the URL — keep it
    }
    trail = ch + trail
    url = url.slice(0, -1)
  }
  return { url, trail }
}

export type TextSegment = { kind: 'text'; value: string } | { kind: 'url'; value: string }

// Splits `text` into an ordered list of plain-text and bare-URL segments for LivChat to render
// (plain <span>s and tappable <a>s respectively). A no-URL input returns a single text segment.
export function linkifySegments(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0
    if (start > last) segments.push({ kind: 'text', value: text.slice(last, start) })
    const { url, trail } = trimTrailingPunct(m[0])
    if (url) segments.push({ kind: 'url', value: url })
    else segments.push({ kind: 'text', value: m[0] }) // whole match was punctuation (shouldn't happen — URL_RE requires a non-space char after the scheme)
    if (url && trail) segments.push({ kind: 'text', value: trail })
    last = start + m[0].length
  }
  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) })
  return segments
}

// Whether `url` is on the SAME origin as the app itself — same-origin links skip LivChat's
// external-link warning modal (Jeff, 2026-08-23: only genuinely external destinations need the
// interstitial). A malformed/unparseable URL is treated as NOT same-origin (fail closed — show
// the warning rather than silently trust something that isn't even a valid URL).
export function isSameOrigin(url: string, currentOrigin: string): boolean {
  try {
    return new URL(url).origin === currentOrigin
  } catch {
    return false
  }
}

// ─── Attachment validation (livchat-non-image-attachments, DS half) ──────────────────────────
export interface AttachmentPolicy { maxBytes: number; allowed: string[] }
export function attachmentError(
  file: { name?: string; type?: string; size?: number },
  policy: AttachmentPolicy,
): string | null {
  const label = file.name || 'That file'
  const type = (file.type || '').toLowerCase()
  const lowerName = (file.name || '').toLowerCase()
  const size = file.size || 0
  const typeOk = policy.allowed.some((entry) => {
    const a = entry.toLowerCase()
    if (a.startsWith('.')) return lowerName.endsWith(a)
    if (a.endsWith('/*')) return !!type && type.startsWith(a.slice(0, -1))
    return type === a
  })
  if (!typeOk) return `${label} isn't a supported type. Attach an image, PDF, TXT, or CSV.`
  if (size > policy.maxBytes) {
    const mb = Math.round(policy.maxBytes / (1024 * 1024))
    return `${label} is too large (max ${mb} MB).`
  }
  return null
}
