// ─── External-link guard state (livchat-external-link-guard) ───────────────────
// Moved out of LivChat.tsx (W3 legibility refactor). State + tap handler; no effects.
import { useState } from 'react'
import { isSameOrigin } from '../livChatComposer'

export function useLinkGuard() {
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
  return { linkGuardUrl, setLinkGuardUrl, linkGuardSafetyOpen, setLinkGuardSafetyOpen, handleLinkTap }
}
