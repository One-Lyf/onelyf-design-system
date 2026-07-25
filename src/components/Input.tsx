// ─── Input / Textarea / Select + Field ──────────────────────────────────────
// The one input system. Every text control in every Lyf app should be one of
// these — that's what makes forms feel like one product. Token-driven, always
// high-contrast ink on surface (this is the fix for the "invisible input text"
// class of bug: text colour is never left to the browser default), with the
// shared focus ring + error/disabled states from componentStylesheet.
//
// Wrap any control in <Field> to get a label, optional hint, and an error slot
// wired for accessibility (aria-invalid + aria-describedby).
import { useId } from 'react'
import type {
  CSSProperties, InputHTMLAttributes, TextareaHTMLAttributes,
  SelectHTMLAttributes, ReactNode,
} from 'react'
import { radius, space, textStyle } from '../tokens'
import { cssVar } from '../theme'

// Shared control surface — the single source of truth for how a field looks.
function controlStyle(invalid?: boolean): CSSProperties {
  return {
    ...textStyle('body'),
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    color: cssVar.ink,                 // never inherit — the contrast guarantee
    background: cssVar.surface,
    border: `1px solid ${invalid ? cssVar.danger : cssVar.border}`,
    borderRadius: radius.md,
    padding: `${space.sm + 2}px ${space.md - 4}px`,  // 10px / 12px — 44px+ tall
    transition: 'border-color .18s ease',
    appearance: 'none',
    WebkitAppearance: 'none',
  }
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}
export function Input({ invalid, className, style, ...rest }: InputProps) {
  return (
    <input
      className={['ds-input', className].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      style={{ ...controlStyle(invalid), ...style }}
      {...rest}
    />
  )
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}
export function Textarea({ invalid, className, style, rows = 4, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={['ds-input', className].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      style={{ ...controlStyle(invalid), resize: 'vertical', minHeight: space[10], ...style }}
      {...rest}
    />
  )
}

// controlStyle() sets appearance:none (needed so Input/Textarea never show
// browser chrome) — but on a <select> that also strips the native dropdown
// chevron in every major browser, leaving no visual indicator that the
// control opens a menu. Draw one back in as a background image (the classic
// custom-select pattern); `currentColor` makes it track the control's own
// text color, so it already follows cssVar.ink per theme with no extra var.
const SELECT_CHEVRON = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l5 5 5-5"/></svg>',
)}")`

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}
export function Select({ invalid, className, style, children, ...rest }: SelectProps) {
  return (
    <select
      className={['ds-input', className].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      style={{
        ...controlStyle(invalid),
        paddingRight: space[7],
        cursor: 'pointer',
        backgroundImage: SELECT_CHEVRON,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: `right ${space.sm}px center`,
        backgroundSize: 14,
        ...style,
      }}
      {...rest}
    >
      {children}
    </select>
  )
}

// ── Field: label + control + hint/error, correctly associated ───────────────
export interface FieldProps {
  label?: ReactNode
  /** Helper text under the control (hidden when `error` is present). */
  hint?: ReactNode
  /** Error message; also flips the control into its invalid state. */
  error?: ReactNode
  /** Mark the label with a required asterisk. */
  required?: boolean
  htmlFor?: string
  children: (props: { id: string; invalid: boolean; 'aria-describedby'?: string }) => ReactNode
  style?: CSSProperties
}

export function Field({ label, hint, error, required, htmlFor, children, style }: FieldProps) {
  const auto = useId()
  const id = htmlFor ?? auto
  const msgId = `${id}-msg`
  const invalid = Boolean(error)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs, minWidth: 0, ...style }}>
      {label != null && (
        <label htmlFor={id} style={{ ...textStyle('label'), color: cssVar.ink }}>
          {label}
          {required && <span style={{ color: cssVar.danger }}> *</span>}
        </label>
      )}
      {children({ id, invalid, 'aria-describedby': hint || error ? msgId : undefined })}
      {(error || hint) && (
        <span
          id={msgId}
          role={error ? 'alert' : undefined}
          style={{ ...textStyle('caption'), color: error ? cssVar.danger : cssVar.mid }}
        >
          {error || hint}
        </span>
      )}
    </div>
  )
}

export default Input
