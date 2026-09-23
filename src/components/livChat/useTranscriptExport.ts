// ─── Transcript viewer + document export ───────────────────────────────────────
// Moved out of LivChat.tsx (W3 legibility refactor). Viewer open/format state, the format
// renderer, and the copy/download actions (whole transcript + a single flagged document);
// no effects.
import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { transcriptToMarkdown, transcriptToPlainText, transcriptToJSON, transcriptFilename, documentFilename, type LivDocument } from '../livChatComposer'
import { TRANSCRIPT_FORMATS, type TranscriptFormat } from './constants'
import type { LivMessage } from './types'

export function useTranscriptExport({ messages, setMsg }: {
  messages: LivMessage[]
  setMsg: Dispatch<SetStateAction<string>>
}) {
  // Transcript viewer: view the open session in a chosen format (Markdown / Plain / JSON) with
  // copy + download. Opened from the header transcript button.
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [transcriptFormat, setTranscriptFormat] = useState<TranscriptFormat>('markdown')

  function renderTranscript(format: TranscriptFormat): string {
    if (format === 'plain') return transcriptToPlainText(messages, { hatName: 'Liv' })
    if (format === 'json') return transcriptToJSON(messages, { hatName: 'Liv' })
    return transcriptToMarkdown(messages, { hatName: 'Liv' })
  }

  // Download the current transcript in the viewer's selected format — Blob + temporary <a download>.
  function downloadTranscript() {
    if (!messages.length) return
    try {
      const fmt = TRANSCRIPT_FORMATS.find((f) => f.id === transcriptFormat) ?? TRANSCRIPT_FORMATS[0]
      const text = renderTranscript(fmt.id)
      const d = new Date()
      const p = (n: number) => String(n).padStart(2, '0')
      const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
      const blob = new Blob([text], { type: `${fmt.mime};charset=utf-8` })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = transcriptFilename('Liv', stamp).replace(/\.md$/, `.${fmt.ext}`)
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Revoke on the next tick so the download has grabbed the blob first.
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (e) {
      console.error('transcript export failed', e)
      setMsg('Could not export the conversation.')
    }
  }

  // Copy the current transcript (selected format) to the clipboard.
  async function copyTranscript() {
    if (!messages.length) return
    try {
      await navigator.clipboard.writeText(renderTranscript(transcriptFormat))
      setMsg('Transcript copied.')
    } catch { setMsg('Could not copy — clipboard access was blocked.') }
  }

  // Download a single flagged document (livchat-document-creation) — Blob + temporary <a
  // download>, the same mechanism a whole-transcript export would use.
  function downloadDocument(doc: LivDocument) {
    try {
      const d = new Date()
      const p = (n: number) => String(n).padStart(2, '0')
      const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
      const blob = new Blob([doc.content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = documentFilename(doc.title, stamp)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (e) {
      console.error('document download failed', e)
      setMsg('Could not download this document.')
    }
  }

  return {
    transcriptOpen, setTranscriptOpen, transcriptFormat, setTranscriptFormat,
    renderTranscript, downloadTranscript, copyTranscript, downloadDocument,
  }
}
