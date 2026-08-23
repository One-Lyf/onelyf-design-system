import { useEffect, useState } from 'react'

// Reorderable tile grid, persisted to localStorage. Reordering happens in an explicit
// "rearrange" mode (toggled by a button) using per-tile up/down move controls — NOT a
// long-press or drag. Long-press on a link tile in an iOS PWA pops the Safari share/context
// menu (a real bug we hit), and a drag on near-full-width tiles fights page scrolling. A
// mode toggle + move buttons is gesture-free and reliable, and single-tap keeps opening tiles
// instantly (which you can't do if tap were overloaded for double-tap-to-reorder).
//
// Canonical home: synthesized here from Tummyful's original (homlyf-tummyful
// src/lib/useTileReorder.ts) so every app's dashboard reorders the same way. Consumed via the
// <ReorderableTiles> component; the hook is exported too for apps that want to own the render.

// Reconcile a saved tile order against the current tile set. Pure (and exported) so the
// merge rules are unit-testable without a DOM: saved order wins for tiles that still exist,
// stale ids are dropped, and a NEW tile is slotted in at its DEFAULT position rather than
// always appended — a tile that ships at the top of the dashboard should show up at the top
// for someone who already has a saved order, not banished to the bottom of it.
export function mergeOrder(saved: unknown, def: string[]): string[] {
  const arr = Array.isArray(saved) ? (saved as unknown[]).filter((x): x is string => typeof x === 'string') : []
  const known = arr.filter((id, i) => def.includes(id) && arr.indexOf(id) === i) // drop stale + dupes
  if (!known.length) return def
  const merged = [...known]
  def.forEach((id, i) => { if (!merged.includes(id)) merged.splice(Math.min(i, merged.length), 0, id) })
  return merged
}

function loadOrder(key: string, def: string[]): string[] {
  try {
    const raw = localStorage.getItem(key)
    return mergeOrder(raw ? JSON.parse(raw) : [], def)
  } catch { return def }
}

export function useTileReorder(storageKey: string, defaultOrder: string[]) {
  const [order, setOrder] = useState<string[]>(() => loadOrder(storageKey, defaultOrder))
  const [reorderMode, setReorderMode] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(order)) } catch { /* private mode */ }
  }, [storageKey, order])

  // Move a tile one slot earlier (dir -1) or later (dir +1) in the order.
  const moveTile = (id: string, dir: -1 | 1) => setOrder((o) => {
    const i = o.indexOf(id); const j = i + dir
    if (i < 0 || j < 0 || j >= o.length) return o
    const a = [...o]; [a[i], a[j]] = [a[j], a[i]]
    return a
  })

  return { order, reorderMode, setReorderMode, moveTile }
}
