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
