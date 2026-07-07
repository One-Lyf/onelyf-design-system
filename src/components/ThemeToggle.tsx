// ─── ThemeToggle ────────────────────────────────────────────────────────────
// Cycles light → dark → system. Presentational + self-contained: reads/writes
// theme state itself (initTheme/setThemeMode) so a consuming app only needs
// to render <ThemeToggle /> once `themeStylesheet` is on the page.
import { useEffect, useState } from 'react'
import { cssVar, initTheme, setThemeMode, type ThemeMode } from '../theme'

const ORDER: ThemeMode[] = ['dark', 'light', 'system']
const LABEL: Record<ThemeMode, string> = { dark: 'Dark', light: 'Light', system: 'System' }

export interface ThemeToggleProps {
  className?: string
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const [mode, setMode] = useState<ThemeMode>('dark')

  useEffect(() => {
    setMode(initTheme())
  }, [])

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]
    setThemeMode(next)
    setMode(next)
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className={className}
      aria-label={`Theme: ${LABEL[mode]}. Click to change.`}
      style={{
        background: cssVar.surface,
        color: cssVar.ink,
        border: `1px solid ${cssVar.borderBright}`,
        borderRadius: 999,
        padding: '6px 12px',
        fontSize: 12.5,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      {LABEL[mode]}
    </button>
  )
}
