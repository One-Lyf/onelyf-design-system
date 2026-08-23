// ─── LivDock — the shared floating chat launcher ────────────────────────────
// Canon shape ported from Tummyful's CommisDock (homlyf-tummyful/src/components/
// CommisDock.tsx) — the first app to build a persistent, draggable, dismissible
// floating launcher for its Liv chat. DS rule 9 (synthesis, not per-app bespoke):
// every OneLyf app needs this same chrome, so it lives here once and each app
// wires its own chat instance in.
//
// This component owns the bubble/panel CHROME ONLY — drag-to-reposition, the
// thinking pulse, the unread dot, and the collapse/expand shell. It does NOT own
// mount lifecycle, route-based visibility, or portaling a single persistent chat
// instance between an inline host and this floating panel — those are app
// architecture decisions (see CommisDock's `dockBody`/`inlineHost` dance) and
// stay out of DS. `visible` is fully controlled so the app can fold its own
// route/dismiss logic into one boolean.
//
// `children` is expected to be a <LivChat> (or similar) that renders its own
// header — pass LivChat's `onMinimize`/`onClose` so the panel has ONE header,
// matching the "no separate dock-chrome bar" canon.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Glyph from '../Glyph'

export interface LivDockProps {
  /** Show the bubble/panel at all. The app computes route + dismiss logic and passes the result. Default true. */
  visible?: boolean
  /** Floating panel expanded? Controlled by the app. */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pulses the bubble while a reply streams. */
  thinking?: boolean
  /** Shows the unread dot on the collapsed bubble. */
  unread?: boolean
  ariaLabel?: string
  /** Hover/long-press title on the bubble. */
  title?: string
  /** Defaults to the canonical Liv glyph — never invent a new mark (design law #4). */
  icon?: ReactNode
  /** Rendered inside the floating panel when open — own its header (LivChat's onMinimize/onClose). */
  children: ReactNode
  className?: string
  panelClassName?: string
}

// Travel (px) a press must cover before it counts as a drag rather than a tap.
const DRAG_THRESHOLD = 6
const BUBBLE_SIZE = 56

const SHEET_ID = 'ds-livdock-stylesheet'

const livDockCss = `
.ds-livdock { position: fixed; z-index: 89; right: max(16px, env(safe-area-inset-right, 0px));
  bottom: calc(76px + env(safe-area-inset-bottom, 0px)); }
.ds-livdock-bubble { position: relative; width: ${BUBBLE_SIZE}px; height: ${BUBBLE_SIZE}px; border-radius: 50%; padding: 0;
  display: grid; place-items: center; background: var(--ds-surface); color: var(--ds-ink);
  border: 1px solid var(--ds-border-bright); box-shadow: var(--ds-shadow-card);
  cursor: grab; touch-action: none; user-select: none; }
.ds-livdock-bubble:active { cursor: grabbing; }
.ds-livdock-bubble[data-thinking] { animation: ds-livdock-pulse 1.4s ease-in-out infinite; }
@keyframes ds-livdock-pulse {
  0%, 100% { box-shadow: var(--ds-shadow-card); }
  50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--ds-gold) 32%, transparent); }
}
.ds-livdock-dot { position: absolute; top: 2px; right: 2px; width: 12px; height: 12px;
  border-radius: 50%; background: var(--ds-gold); border: 2px solid var(--ds-surface); }
/* Collapsed panel is out of the layout entirely; the body div inside it stays mounted (display
   toggles, it is never unmounted) so an app can portal a persistent chat instance into it and
   have that instance survive the bubble collapsing/expanding. */
.ds-livdock-panel { display: none; }
.ds-livdock-panel[data-open] { display: flex; flex-direction: column; box-sizing: border-box;
  position: fixed; left: auto; z-index: 89;
  right: max(12px, env(safe-area-inset-right, 0px));
  bottom: max(12px, env(safe-area-inset-bottom, 0px));
  width: min(400px, calc(100vw - 24px)); max-height: min(76vh, 680px);
  background: var(--ds-bg); border: 1px solid var(--ds-border-bright); border-radius: 16px;
  box-shadow: 0 12px 34px rgba(28, 43, 33, 0.22);
  padding: 0.4rem 0.6rem calc(0.5rem + env(safe-area-inset-bottom, 0px)); }
.ds-livdock-body { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
@media (prefers-reduced-motion: reduce) { .ds-livdock-bubble[data-thinking] { animation: none; } }
`.trim()

function useLivDockStylesheet() {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(SHEET_ID)) return
    const el = document.createElement('style')
    el.id = SHEET_ID
    el.textContent = livDockCss
    document.head.appendChild(el)
  }, [])
}

export default function LivDock({
  visible = true, open, onOpenChange, thinking, unread, ariaLabel = 'Open Liv chat',
  title = 'Liv — drag to move, tap to open', icon, children, className, panelClassName,
}: LivDockProps) {
  useLivDockStylesheet()

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const drag = useRef<{ offX: number; offY: number; sx: number; sy: number; moved: boolean } | null>(null)

  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
  const onPointerDown = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    drag.current = { offX: e.clientX - r.left, offY: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (!d.moved && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < DRAG_THRESHOLD) return
    d.moved = true
    setPos({
      x: clamp(e.clientX - d.offX, 8, window.innerWidth - BUBBLE_SIZE - 8),
      y: clamp(e.clientY - d.offY, 8, window.innerHeight - BUBBLE_SIZE - 8),
    })
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (d && !d.moved) onOpenChange(true) // a tap (not a drag) opens the chat
  }

  // Once dragged, anchor the collapsed bubble to that spot; otherwise it rests bottom-right (CSS).
  const dockStyle: CSSProperties | undefined = !open && pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined
  const bodyVisible = visible && open

  return (
    <div className={className ? `ds-livdock ${className}` : 'ds-livdock'} style={dockStyle}>
      {visible && !open && (
        <button
          type="button"
          className="ds-livdock-bubble"
          data-thinking={thinking || undefined}
          aria-label={ariaLabel}
          title={title}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {icon ?? <Glyph variant="live" size={30} alt="" />}
          {unread && <span className="ds-livdock-dot" aria-hidden="true" />}
        </button>
      )}
      {/* Panel + body are never conditionally unmounted (only their `display` toggles) — an app
          that portals a persistent chat instance into the body needs that portal target to stay
          valid across every open/close, or the instance (and its conversation) gets torn down. */}
      <div
        className={panelClassName ? `ds-livdock-panel ${panelClassName}` : 'ds-livdock-panel'}
        data-open={bodyVisible || undefined}
        aria-hidden={!bodyVisible}
      >
        <div className="ds-livdock-body">{children}</div>
      </div>
    </div>
  )
}
