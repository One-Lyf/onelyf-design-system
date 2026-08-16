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
