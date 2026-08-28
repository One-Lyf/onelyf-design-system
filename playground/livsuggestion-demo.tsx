// ─── Dev-only LivSuggestionField demo ───────────────────────────────────────
// Exercises the pattern end to end: Liv's suggested values seed three real
// controls, the user can tweak each freely, restore any one knob back to
// Liv's take, and explicitly save the current mix as a named preset.
// Ephemeral by default (in-memory `savedTakes` state only) — a real Waves app
// wires the save action to its own persistence; DS stays presentational.
// View via `npm run dev` → /playground/livsuggestion-demo.html.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  themeStylesheet, componentStylesheet, initTheme,
  space, textStyle, radius, Button, Card, ThemeToggle, Glyph, Badge,
  LivSuggestionField,
} from '../src'
import { cssVar } from '../src/theme'

initTheme()

interface Knob {
  id: string
  label: string
  min: number
  max: number
  step: number
  unit: string
  livSuggestion: number
}

const KNOBS: Knob[] = [
  { id: 'reverbMix', label: 'Reverb Mix', min: 0, max: 100, step: 1, unit: '%', livSuggestion: 32 },
  { id: 'delayTime', label: 'Delay Time', min: 0, max: 800, step: 10, unit: 'ms', livSuggestion: 240 },
  { id: 'filterCutoff', label: 'Filter Cutoff', min: 200, max: 8000, step: 50, unit: 'Hz', livSuggestion: 2200 },
]

interface SavedTake {
  name: string
  values: Record<string, number>
}

function seedFromSuggestions(): Record<string, number> {
  return Object.fromEntries(KNOBS.map((k) => [k.id, k.livSuggestion]))
}

function Demo() {
  // Liv's suggestion is applied to the controls as the starting value — the
  // user tweaks from there. `values` is the session-scoped (ephemeral) state.
  const [values, setValues] = useState<Record<string, number>>(seedFromSuggestions)
  const [savedTakes, setSavedTakes] = useState<SavedTake[]>([])
  const [takeName, setTakeName] = useState('')

  const anyDirty = KNOBS.some((k) => values[k.id] !== k.livSuggestion)

  function restore(id: string, suggestion: number) {
    setValues((v) => ({ ...v, [id]: suggestion }))
  }

  function saveTake() {
    const name = takeName.trim() || `Take ${savedTakes.length + 1}`
    setSavedTakes((t) => [...t, { name, values: { ...values } }])
    setTakeName('')
  }

  function loadTake(take: SavedTake) {
    setValues({ ...take.values })
  }

  return (
    <div
      style={{
        minHeight: '100vh', background: cssVar.bg, color: cssVar.ink, minWidth: 0,
        padding: space.lg, boxSizing: 'border-box', maxWidth: 560, margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: space.sm, marginBottom: space[8] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 0 }}>
          <Glyph variant="live" size={28} />
          <h1 style={{ ...textStyle('h1'), color: cssVar.ink, margin: 0, minWidth: 0, overflowWrap: 'break-word' }}>LivSuggestionField</h1>
        </div>
        <ThemeToggle />
      </div>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: space.lg }}>
        {KNOBS.map((k) => {
          const value = values[k.id]
          const isDirty = value !== k.livSuggestion
          return (
            <LivSuggestionField
              key={k.id}
              label={k.label}
              isDirty={isDirty}
              onRestore={() => restore(k.id, k.livSuggestion)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
                <input
                  type="range"
                  min={k.min}
                  max={k.max}
                  step={k.step}
                  value={value}
                  onChange={(e) => setValues((v) => ({ ...v, [k.id]: Number(e.target.value) }))}
                  style={{ flex: 1, accentColor: cssVar.primary }}
                />
                <span style={{ ...textStyle('bodySm'), color: cssVar.mid, minWidth: 56, textAlign: 'right' }}>
                  {value}{k.unit}
                </span>
              </div>
            </LivSuggestionField>
          )
        })}

        <div
          style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingTop: space.md,
            borderTop: `1px solid ${cssVar.border}`,
          }}
        >
          {anyDirty && <Badge tone="accent">Tweaked from Liv's take</Badge>}
          <input
            type="text"
            placeholder="Name this take…"
            value={takeName}
            onChange={(e) => setTakeName(e.target.value)}
            style={{
              flex: '1 1 160px', minWidth: 0, ...textStyle('bodySm'), color: cssVar.ink, background: cssVar.bg,
              border: `1px solid ${cssVar.border}`, borderRadius: radius.md, padding: '8px 10px',
            }}
          />
          <Button full={false} onClick={saveTake}>Save Liv's Take</Button>
        </div>
      </Card>

      {savedTakes.length > 0 && (
        <Card style={{ marginTop: space.md }}>
          <div style={{ ...textStyle('label'), color: cssVar.ink, marginBottom: space.sm }}>Saved Takes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs }}>
            {savedTakes.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ ...textStyle('bodySm'), color: cssVar.ink }}>{t.name}</span>
                <Button variant="ghost" full={false} onClick={() => loadTake(t)}>Load</Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <style>{themeStylesheet + '\n' + componentStylesheet}</style>
    <Demo />
  </StrictMode>,
)
