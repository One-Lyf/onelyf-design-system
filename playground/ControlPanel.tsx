// ─── Live token control panel ───────────────────────────────────────────
// Edits write directly to the --ds-* CSS custom properties theme.ts already
// establishes on :root — every component already reads through cssVar/
// shadowVar, so this needs zero component changes to work live. Only
// `color` is wired this way today; `space`/`type`/`radius` are still plain
// JS constants baked in at render time, not CSS-var-driven yet — that's the
// honest scope of what's live-editable right now, not a full token studio.
import { useState } from 'react'
import { color as defaultColor } from '../src/tokens'
import { space, textStyle } from '../src/tokens'
import { cssVar } from '../src/theme'

const toKebab = (key: string) => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
const VAR_PREFIX = '--ds-'

type ColorKey = keyof typeof defaultColor

function setVar(key: ColorKey, value: string) {
  document.documentElement.style.setProperty(`${VAR_PREFIX}${toKebab(key)}`, value)
}

function resetVar(key: ColorKey) {
  document.documentElement.style.removeProperty(`${VAR_PREFIX}${toKebab(key)}`)
}

export default function ControlPanel() {
  const [overrides, setOverrides] = useState<Partial<Record<ColorKey, string>>>({})
  const [copied, setCopied] = useState(false)

  const keys = Object.keys(defaultColor) as ColorKey[]

  function onChange(key: ColorKey, value: string) {
    setVar(key, value)
    setOverrides((o) => ({ ...o, [key]: value }))
  }

  function onReset() {
    keys.forEach(resetVar)
    setOverrides({})
  }

  function copyAsCode() {
    const lines = Object.entries(overrides).map(([k, v]) => `  ${VAR_PREFIX}${toKebab(k)}: ${v};`)
    const block = lines.length
      ? `:root {\n${lines.join('\n')}\n}`
      : '/* no overrides yet — drag a color first */'
    navigator.clipboard?.writeText(block)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 260,
        overflowY: 'auto',
        background: cssVar.surface,
        borderLeft: `1px solid ${cssVar.border}`,
        padding: space.md,
        boxSizing: 'border-box',
        zIndex: 1000,
      }}
    >
      <div style={{ ...textStyle('label'), color: cssVar.ink, marginBottom: space.sm }}>
        Live color tokens
      </div>
      <p style={{ ...textStyle('caption'), color: cssVar.mid, marginTop: 0, marginBottom: space.md }}>
        Every color, live — space/type/radius aren't wired to CSS vars yet.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
        {keys.map((k) => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
            <input
              type="color"
              value={overrides[k] ?? defaultColor[k]}
              onChange={(e) => onChange(k, e.target.value)}
              style={{ width: 28, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }}
            />
            <span style={{ ...textStyle('bodySm'), color: cssVar.ink }}>{k}</span>
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs, marginTop: space.lg }}>
        <button
          onClick={copyAsCode}
          style={{
            ...textStyle('label'), padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
            background: cssVar.primary, color: cssVar.onPrimary, border: 'none',
          }}
        >
          {copied ? 'Copied!' : 'Copy as code'}
        </button>
        <button
          onClick={onReset}
          style={{
            ...textStyle('label'), padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
            background: 'transparent', color: cssVar.mid, border: `1px solid ${cssVar.border}`,
          }}
        >
          Reset
        </button>
      </div>
    </div>
  )
}
