// ─── Brain sheet dismissal: Escape + drag-to-dismiss ───────────────────────────
// Moved out of LivChat.tsx (W3 legibility refactor). LivChat calls this hook last, where its
// Escape effect used to sit, so effect order is unchanged.
import { useEffect, useRef, useState } from 'react'
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from 'react'

const SHEET_DISMISS_THRESHOLD_PX = 80

export function useBrainSheetDrag(brainOpen: boolean, setBrainOpen: Dispatch<SetStateAction<boolean>>) {
  // Brain sheet drag-to-dismiss: live vertical offset while the handle is being dragged
  // (0 = resting position). Swiping the handle down past DISMISS_THRESHOLD_PX closes the
  // sheet; releasing short of that snaps it back to 0.
  const [sheetDragY, setSheetDragY] = useState(0)
  const sheetDraggingRef = useRef(false)

  // Escape dismisses the Brain sheet same as the scrim/Close button. Scoped to when it's open —
  // otherwise Escape would fight the rename/slash-menu Escape handlers elsewhere in this file.
  useEffect(() => {
    if (!brainOpen) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setBrainOpen(false) } }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [brainOpen])

  function onBrainSheetHandlePointerDown(e: ReactPointerEvent) {
    e.preventDefault()
    sheetDraggingRef.current = true
    const startY = e.clientY
    const move = (ev: PointerEvent) => {
      if (!sheetDraggingRef.current) return
      setSheetDragY(Math.max(0, ev.clientY - startY))
    }
    const up = () => {
      sheetDraggingRef.current = false
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setSheetDragY((y) => {
        if (y > SHEET_DISMISS_THRESHOLD_PX) setBrainOpen(false)
        return 0
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return { sheetDragY, onBrainSheetHandlePointerDown }
}
