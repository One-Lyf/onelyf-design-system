// ─── A failed send: what to say, and whether the message is still in the thread ───────
// Pure (no React) so it's unit-testable.
import type { LivMessage } from './types'

export const NO_KEY_CODE = 'NO_KEY'

// The status line for a failed send. An adapter that returns `error.code` is taken at its word:
// only NO_KEY is "add your key", every other code shows the adapter's own message (a key the
// provider REJECTED is not a missing key, Tummyful audit 2026-09-24). An adapter without codes
// keeps the old guess (message NO_KEY, or a detail that mentions "key").
// `saved` = the backend saved the sent message (else LivChat holds it in the thread with Retry).
export function sendFailureNotice(
  error: { message?: string; detail?: string; code?: string } | undefined,
  saved: boolean,
): { noKey: boolean; text: string } {
  const code = error?.code
  const noKey = code
    ? code === NO_KEY_CODE
    : error?.message === NO_KEY_CODE || !!error?.detail?.toLowerCase().includes('key')
  if (noKey) {
    return {
      noKey,
      text: saved
        ? 'Add your API key so Liv can reply. Your message is saved either way.'
        : 'Add your API key so Liv can reply, then tap Retry.',
    }
  }
  const em = error?.message && error.message !== NO_KEY_CODE ? error.message : ''
  return { noKey, text: em || "Liv couldn't reply." }
}

// Did the backend save the message this send added? True when the reloaded thread has a user
// message with the sent text that wasn't there before the send.
export function sentMessageSaved(reloaded: LivMessage[], before: ReadonlySet<string>, text: string): boolean {
  return reloaded.some((m) => m.role === 'user' && !before.has(m.id) && (m.content ?? '') === text)
}
