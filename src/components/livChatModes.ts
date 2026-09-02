// ─── LivChat effort + autonomy-mode helpers ──────────────────────────────────
// Pure definitions for the two Brain-menu controls that sit alongside the model
// picker. Kept out of the component so they're unit-testable and shared.
//
// Both are OPT-IN per hat (hat.enableEffort / hat.enableMode) so a surface only
// shows a control its backend actually consumes — no dead UI. The value is
// persisted through adapter.key.set({effort,mode}); the app's adapter reads it
// back when it builds each request (effort → provider effort param) and when it
// decides how to apply a proposed change (mode → auto-apply vs confirm-gate).

// ── Effort ───────────────────────────────────────────────────────────────────
// Anthropic-native ladder (output_config.effort). Ordinal low→max, so the UI is
// a slider. Providers without 5 levels map on their own side (e.g. OpenAI's
// reasoning_effort has low/medium/high — xhigh/max clamp to high there).
export type LivEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface LivEffortLevel { id: LivEffort; label: string }

export const EFFORT_LEVELS: LivEffortLevel[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'xhigh', label: 'Xhigh' },
  { id: 'max', label: 'Max' },
]

export const DEFAULT_EFFORT: LivEffort = 'high'

const EFFORT_IDS = EFFORT_LEVELS.map((e) => e.id)

export function isEffort(x: unknown): x is LivEffort {
  return typeof x === 'string' && (EFFORT_IDS as string[]).includes(x)
}

// Slider position (0-based index) for an effort id; DEFAULT_EFFORT's index for
// an unknown value so the control never lands off the track.
export function effortIndex(id: unknown): number {
  const i = EFFORT_IDS.indexOf(id as LivEffort)
  return i === -1 ? EFFORT_IDS.indexOf(DEFAULT_EFFORT) : i
}

// The effort id at a (possibly out-of-range) slider index, clamped to the ladder.
export function effortAtIndex(i: number): LivEffort {
  const n = Number.isFinite(i) ? Math.round(i) : 0
  const clamped = Math.min(Math.max(n, 0), EFFORT_IDS.length - 1)
  return EFFORT_IDS[clamped]
}

// ── Autonomy mode ─────────────────────────────────────────────────────────────
// How a proposed state change is applied. The Auto boundary is a HARD rule the
// app must honor (Jeff, 2026-09-03): Auto applies only reversible in-app edits
// directly; money movement, deletes, external sends, and anything an app flags
// irreversible are ALWAYS confirm-gated regardless of mode.
export type LivMode = 'auto' | 'plan' | 'manual'

export interface LivModeOption { id: LivMode; label: string; hint: string }

export const MODES: LivModeOption[] = [
  { id: 'auto', label: 'Auto', hint: 'Applies reversible edits directly — still confirms money, deletes & sends.' },
  { id: 'plan', label: 'Plan', hint: 'Proposes a step-by-step plan first, then executes on your approval.' },
  { id: 'manual', label: 'Manual', hint: 'Nothing changes until you tap Apply.' },
]

export const DEFAULT_MODE: LivMode = 'manual'

const MODE_IDS = MODES.map((m) => m.id)

export function isMode(x: unknown): x is LivMode {
  return typeof x === 'string' && (MODE_IDS as string[]).includes(x)
}
