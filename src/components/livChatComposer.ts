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
