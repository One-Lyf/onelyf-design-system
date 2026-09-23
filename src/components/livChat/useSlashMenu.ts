// ─── `/`-menu state (livchat-slash-menu-canon) ─────────────────────────────────
// Moved out of LivChat.tsx (W3 legibility refactor). State + derived filter + select/run
// handlers; no effects. The composer's textarea onChange/onKeyDown still drive it inline.
import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { LivSlashTool } from './types'

export function useSlashMenu({ draft, setDraft, slashTools, onToolInvoke }: {
  draft: string
  setDraft: Dispatch<SetStateAction<string>>
  slashTools?: LivSlashTool[]
  onToolInvoke?: (toolId: string, args: Record<string, string>) => void
}) {
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
  return {
    slashOpen, setSlashOpen, setSlashIndex, slashDismissed, setSlashDismissed,
    slashPending, setSlashPending, filteredSlashTools, slashActiveIndex,
    selectSlashTool, runSlashPending,
  }
}
export type SlashMenuState = ReturnType<typeof useSlashMenu>
