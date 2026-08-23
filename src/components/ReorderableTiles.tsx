import type { ReactNode } from 'react'
import { useTileReorder } from '../useTileReorder'

// Canonical rearrangeable dashboard tiles. Reordering happens in an explicit "Rearrange" mode
// (a toggle) with per-tile up/down (↑/↓) buttons — deliberately NOT drag/long-press (that
// fights iOS-PWA scroll + pops Safari's context menu; see useTileReorder). Order persists to
// localStorage under `storageKey`. The component styles only the CHROME (toggle, move buttons,
// grid gaps, reorder dimming) using DS tokens with fallbacks, so it drops into any app's
// dashboard regardless of how the tile CONTENT is styled. Synthesized from Tummyful's original
// inline implementation and now consumed by both Tummyful and Cash Stash.

export interface ReorderableTilesProps {
  /** localStorage key the tile order persists under (e.g. 'cs_dash_order'). */
  storageKey: string
  /** Default order of tile ids; also the catalog mergeOrder reconciles a saved order against. */
  defaultOrder: string[]
  /** id → rendered tile. A missing/null value renders an empty (collapsed) slot — use that for
   *  conditional tiles (e.g. Pending Review only when there's a queue). */
  tiles: Record<string, ReactNode>
  /** id → human label for the move buttons' aria-label ("Move Pending Review up"). */
  labels?: Record<string, string>
  /** Grid columns. Default '1fr' (single-column stack). Pass e.g.
   *  'repeat(auto-fill, minmax(220px, 1fr))' for a multi-column dashboard. */
  gridTemplateColumns?: string
  /** Grid gap. Default '1rem'. */
  gap?: number | string
  /** Controlled edit mode. Omit to let the component own it (and render its toggle). */
  editing?: boolean
  onEditingChange?: (v: boolean) => void
  /** Render the built-in Rearrange/Done toggle bar. Default true. */
  showToggle?: boolean
  rearrangeLabel?: string
  doneLabel?: string
  hint?: string
  /** Extra class on the grid, if an app wants to hook it. */
  className?: string
}

export const reorderableTilesStylesheet = `
.ds-rt-bar { display: flex; align-items: center; justify-content: flex-end; gap: 0.6rem; margin: 0 0 0.5rem; flex-wrap: wrap; min-height: 1.75rem; }
.ds-rt-hint { margin-right: auto; font-size: 0.82rem; color: var(--ds-mid, #8a8f98); }
.ds-rt-toggle { background: transparent; border: none; box-shadow: none; cursor: pointer; font: inherit; font-size: 0.82rem; font-weight: 700; letter-spacing: 0.01em; color: var(--ds-mid, #8a8f98); padding: 0.25rem 0.1rem; }
.ds-rt-toggle:hover { color: var(--ds-ink, inherit); }
.ds-rt-grid { display: grid; }
.ds-rt-wrap { position: relative; display: flex; min-width: 0; }
.ds-rt-wrap > .ds-rt-tile { flex: 1; width: 100%; min-width: 0; }
/* Collapse a slot whose tile rendered nothing (conditional tile off, or empty content) — even
   while the move overlay sibling is present, because we test the tile cell itself. */
.ds-rt-wrap:has(> .ds-rt-tile:empty) { display: none; }
.ds-rt-grid.ds-rt-editing .ds-rt-tile { pointer-events: none; opacity: 0.92; }
.ds-rt-move { position: absolute; top: 6px; right: 6px; z-index: 5; display: flex; gap: 0.25rem; }
.ds-rt-move-btn { width: 2rem; height: 2rem; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid var(--ds-border-bright, var(--ds-border, rgba(0,0,0,0.18))); background: var(--ds-surface, #ffffff); color: var(--ds-ink, inherit); font-size: 1rem; line-height: 1; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.18); }
.ds-rt-move-btn:disabled { opacity: 0.35; cursor: default; }
`

export default function ReorderableTiles({
  storageKey, defaultOrder, tiles, labels,
  gridTemplateColumns = '1fr', gap = '1rem',
  editing: editingProp, onEditingChange, showToggle = true,
  rearrangeLabel = 'Rearrange Tiles', doneLabel = 'Done',
  hint = 'Use the arrows to move a tile, then tap Done.',
  className,
}: ReorderableTilesProps) {
  const { order, reorderMode, setReorderMode, moveTile } = useTileReorder(storageKey, defaultOrder)
  const editing = editingProp ?? reorderMode
  const setEditing = (v: boolean) => {
    onEditingChange?.(v)
    if (editingProp === undefined) setReorderMode(v)
  }

  return (
    <>
      <style>{reorderableTilesStylesheet}</style>
      {showToggle && (
        <div className="ds-rt-bar">
          {editing && <span className="ds-rt-hint">{hint}</span>}
          <button type="button" className="ds-rt-toggle" onClick={() => setEditing(!editing)}>
            {editing ? doneLabel : rearrangeLabel}
          </button>
        </div>
      )}
      <div
        className={`ds-rt-grid${editing ? ' ds-rt-editing' : ''}${className ? ` ${className}` : ''}`}
        style={{ gridTemplateColumns, gap }}
      >
        {order.map((id, i) => {
          const label = labels?.[id] ?? id
          const present = tiles[id] != null
          return (
            <div key={id} className="ds-rt-wrap">
              {editing && present && (
                <div className="ds-rt-move">
                  <button type="button" className="ds-rt-move-btn" aria-label={`Move ${label} up`}
                    disabled={i === 0} onClick={() => moveTile(id, -1)}>↑</button>
                  <button type="button" className="ds-rt-move-btn" aria-label={`Move ${label} down`}
                    disabled={i === order.length - 1} onClick={() => moveTile(id, 1)}>↓</button>
                </div>
              )}
              <div className="ds-rt-tile">{tiles[id] ?? null}</div>
            </div>
          )
        })}
      </div>
    </>
  )
}
