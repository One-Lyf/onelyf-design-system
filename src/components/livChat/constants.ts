// ─── LivChat constants ─────────────────────────────────────────────────────────
// Moved out of LivChat.tsx (W3 legibility refactor).
import { cssVar } from '../../theme'
import type { SyntaxTokenKind } from '../livChatSyntaxHighlight'

// Attachment policy — what the composer's file picker will accept. Images render as thumbnails;
// PDF / TXT / CSV render as a file chip (DS half; the app backend handles model delivery of the
// non-image bytes). `allowed` mixes mime patterns ('image/*', exact mimes) and extensions ('.csv')
// so a file whose browser-reported mime is blank (common for CSV) still passes by its extension.
// A file that busts the size cap or isn't an allowed type is surfaced as a visible error line
// (setMsg), never silently dropped — the check lives in attachmentError() so it can be unit-tested.
export const ATTACH_MAX_BYTES = 20 * 1024 * 1024 // 20 MB
export const ATTACH_ALLOWED = ['image/*', 'application/pdf', 'text/plain', 'text/csv', '.pdf', '.txt', '.csv']
export const ATTACH_ACCEPT = 'image/*,.pdf,application/pdf,.txt,.csv,text/plain,text/csv'
// Artifacts panel divider position, persisted across sessions per browser (Jeff, artifacts-panel
// decision #1: "user-draggable divider, persist last position, default ~45/55").
export const ARTIFACT_SPLIT_KEY = 'onelyf-livchat-artifact-split'
// Artifacts panel syntax colors, derived from the existing DS token palette (Jeff, artifacts-panel
// decision #4) rather than an off-the-shelf highlight theme. Each is already theme-reactive
// (cssVar resolves to the light/dark CSS variable), so the panel follows the app's theme with no
// separate dark-mode palette to maintain here.
export const SYNTAX_COLOR: Record<SyntaxTokenKind, string> = {
  keyword: cssVar.primary,
  string: cssVar.warning,
  number: cssVar.gold,
  comment: cssVar.dim,
  function: cssVar.danger,
  plain: cssVar.ink,
}

// Render the open conversation in the selected format. Pure — feeds both the viewer and the
// copy/download actions, so what you see is exactly what you get.
export const TRANSCRIPT_FORMATS = [
  { id: 'markdown' as const, label: 'Markdown', ext: 'md', mime: 'text/markdown' },
  { id: 'plain' as const, label: 'Plain text', ext: 'txt', mime: 'text/plain' },
  { id: 'json' as const, label: 'JSON', ext: 'json', mime: 'application/json' },
]
export type TranscriptFormat = 'markdown' | 'plain' | 'json'
