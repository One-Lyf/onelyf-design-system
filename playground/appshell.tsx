// ─── Dev-only AppShell demo ──────────────────────────────────────────────
// Full-screen harness for the AppShell chrome (its fixed bottom nav needs a
// page to itself). View via `npm run dev` → /playground/appshell.html.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  themeStylesheet, componentStylesheet, baseStylesheet, initTheme,
  AppShell, ThemeToggle, Button, Card,
  type SpaceKey,
} from '../src'
import { cssVar } from '../src/theme'

initTheme()

const NAV = [
  { key: 'home', label: 'Home' },
  { key: 'advisor', label: 'Advisor' },
  { key: 'envelopes', label: 'Envelopes' },
  { key: 'ledger', label: 'Ledger' },
  { key: 'debt', label: 'Debt' },
  { key: 'calendar', label: 'Calendar' },
]

const SPACES: SpaceKey[] = ['finlyf', 'homlyf', 'hlthlyf', 'gudlyf']

function Demo() {
  const [active, setActive] = useState('home')
  const [space, setSpace] = useState<SpaceKey>('finlyf')
  const [liv, setLiv] = useState(false)

  return (
    <>
      <style>{themeStylesheet + '\n' + baseStylesheet + '\n' + componentStylesheet}</style>
      <AppShell
        brand={{ wordmark: 'Cash Stash', space, livActive: liv, onClick: () => setActive('home') }}
        headerActions={<ThemeToggle />}
        nav={{ items: NAV, activeKey: active, onSelect: setActive }}
      >
        <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', color: cssVar.ink, marginTop: 0 }}>
          {NAV.find((n) => n.key === active)?.label}
        </h1>
        <p style={{ color: cssVar.mid }}>
          One sticky header, one bottom nav (a top rail at ≥820px), crest→live mark, per-space accent.
        </p>
        <Card padding={16} style={{ marginBottom: 12 }}>
          <div style={{ color: cssVar.dim, fontSize: 12, marginBottom: 8 }}>Demo controls</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button variant={liv ? 'primary' : 'ghost'} onClick={() => setLiv((v) => !v)}>
              Liv: {liv ? 'active (glow)' : 'dormant (crest)'}
            </Button>
            {SPACES.map((s) => (
              <Button key={s} variant={s === space ? 'primary' : 'ghost'} onClick={() => setSpace(s)}>
                {s}
              </Button>
            ))}
          </div>
        </Card>
        <Card padding={16}>
          <div style={{ color: cssVar.ink }}>Active tab: <strong>{active}</strong></div>
        </Card>
      </AppShell>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
)
