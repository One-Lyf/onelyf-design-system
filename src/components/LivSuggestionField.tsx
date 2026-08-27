// ─── LivSuggestionField ─────────────────────────────────────────────────────
// Jeff live 2026-08-24 (APPROVED, node livchat-snapshot-compare-pattern): for
// Waves Suite parameter control, Liv suggests a value, the user can tweak the
// real control freely, and can restore Liv's suggestion per-knob — like
// Ableton's A/B compare, but the B side is Liv's take. The user always owns
// the knob: Liv proposes, this component never applies a value itself.
//
// Presentational only, per this package's contract (no app logic, no data
// fetching) — it wraps whatever control the app already renders (slider,
// knob, dropdown...) and adds the suggestion badge + restore affordance.
// Ephemeral-vs-persisted state is the consumer's call: DS doesn't own
// storage, so `onSaveTake` is a plain callback the app wires to its own
// preset persistence. Omit it to hide the "save" action entirely.
import type { CSSProperties, ReactNode } from 'react'
import { space, radius, textStyle } from '../tokens'
import { cssVar } from '../theme'
import Glyph from '../Glyph'

const ic: CSSProperties = { width: 13, height: 13 }
const svg = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style: ic, 'aria-hidden': true,
}
const RestoreI = () => (
  <svg {...svg}><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
)
const BookmarkI = () => (
  <svg {...svg}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
)

export interface LivSuggestionFieldProps {
  /** Field label, shown above the control (Title Case). */
  label: string
  /** The actual control UI (slider / knob / dropdown / etc.) — DS doesn't own control widgets. */
  children: ReactNode
  /** True when the current value differs from Liv's suggestion for this field. */
  isDirty: boolean
  /** Reset this one field to Liv's suggested value. Only rendered while `isDirty`. */
  onRestore: () => void
  /** Persist the current value as a named "Liv's take" preset. Omit to hide the action. */
  onSaveTake?: () => void
  restoreLabel?: string
  saveLabel?: string
  style?: CSSProperties
}

export default function LivSuggestionField({
  label, children, isDirty, onRestore, onSaveTake,
  restoreLabel = 'Restore Liv’s Suggestion',
  saveLabel = 'Save Liv’s Take',
  style,
}: LivSuggestionFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[1], minWidth: 0, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.xs }}>
        <span style={{ ...textStyle('label'), color: cssVar.ink }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
          {isDirty && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                ...textStyle('overline'), color: cssVar.gold, whiteSpace: 'nowrap',
              }}
            >
              <Glyph variant="live" size={12} alt="" />
              Liv Suggests
            </span>
          )}
          {isDirty && (
            <button
              type="button"
              onClick={onRestore}
              aria-label={restoreLabel}
              title={restoreLabel}
              style={iconBtnStyle}
            >
              <RestoreI />
            </button>
          )}
          {onSaveTake && (
            <button
              type="button"
              onClick={onSaveTake}
              aria-label={saveLabel}
              title={saveLabel}
              style={iconBtnStyle}
            >
              <BookmarkI />
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

// Matches LivChat's `iconbtn` convention (flat micro-buttons for rail/header/copy
// actions) — this is the same class of control: small, secondary, not a CTA.
const iconBtnStyle: CSSProperties = {
  background: 'transparent', border: 0, color: cssVar.mid, cursor: 'pointer',
  borderRadius: radius.sm, padding: '4px 6px', display: 'inline-flex',
  alignItems: 'center', lineHeight: 0,
}
