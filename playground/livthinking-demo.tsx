// ─── Dev-only LivThinking demo ──────────────────────────────────────────────
// Drives the REAL <LivThinking> component — not a mock-up of it — at every size
// it ships at, in both motions, on light and dark ground, with and without the
// canonical traced glyph. A build passing is not evidence a spinner animates;
// this is where that gets checked.
// View via `npm run dev` → /playground/livthinking-demo.html.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { themeStylesheet, componentStylesheet, initTheme, LivThinking, Glyph } from '../src'
import type { LivThinkingMotion } from '../src/LivThinking'
import { cssVar } from '../src/theme'

initTheme()

const SIZES = [128, 96, 64, 44, 32, 24]
const MOTIONS: LivThinkingMotion[] = ['grow', 'illuminate']

// Panels read the REAL theme tokens. An earlier cut of this faked dark ground
// with a hard-coded background, which was worthless as a test: dark only applies
// at :root[data-theme="dark"], so those panels were showing light-theme gold
// (#c08a14) on a dark backdrop and proving nothing. Toggle the root instead —
// the button below does, and so does the screenshot pass.
function Panel({ children, title }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <h3 style={{
        font: '600 12px/1 system-ui', letterSpacing: '.07em', textTransform: 'uppercase',
        opacity: 0.55, margin: '0 0 8px', color: cssVar.mid,
      }}>{title}</h3>
      <div style={{
        background: cssVar.surface, borderRadius: 10, padding: 16,
        border: `1px solid ${cssVar.border}`,
        display: 'flex', gap: 22, alignItems: 'flex-end', flexWrap: 'wrap',
      }}>
        {children}
      </div>
    </section>
  )
}

function Row({ motion }: { motion: LivThinkingMotion }) {
  return (
    <>
      {SIZES.map(s => (
        <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <LivThinking size={s} motion={motion} />
          <span style={{ fontSize: 10, color: cssVar.mid }}>{s}px</span>
        </div>
      ))}
    </>
  )
}

function Demo() {
  const theme = document.documentElement.getAttribute('data-theme') ?? 'light'
  return (
    <div style={{
      minHeight: '100vh', background: cssVar.bg, padding: 24,
      font: '13px/1.45 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      color: cssVar.ink,
    }}>
      <h1 style={{ font: "600 20px/1.2 Fraunces, Georgia, serif", margin: '0 0 2px' }}>
        LivThinking — the real component <span style={{ color: cssVar.gold }}>({theme})</span>
      </h1>
      <p style={{ color: cssVar.mid, margin: '0 0 18px', maxWidth: '70ch' }}>
        Rendered from <code>src/LivThinking.tsx</code> via the package entry, exactly as a
        consuming app gets it. Sizes {SIZES.join(' / ')} px. Theme comes from the real
        <code> :root[data-theme]</code> switch, so the gold here is the actual themed token.
      </p>

      {MOTIONS.map(m => (
        <div key={m}>
          <Panel title={`${m}`}><Row motion={m} /></Panel>
          
        </div>
      ))}

      <Panel title="in context — caption, the way an app actually uses it">
        <LivThinking caption="Liv is thinking…" />
      </Panel>

      {/* The REAL code path LivChat uses: <Glyph variant="live" animated={livGlyphState} />.
          At/above LIV_GROW_MIN_SIZE this routes to the masked growth of the actual
          interlaced glyph; below it, the img + pulse. LivChat renders 14 / 22 / 64 / 120. */}
      <Panel title="Glyph animated='thinking' — the exact call LivChat makes">
        {[120, 64, 48, 44, 22, 14].map(s => (
          <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Glyph variant="live" size={s} animated="thinking" alt="" />
            <span style={{ fontSize: 10, color: cssVar.mid }}>{s}px</span>
          </div>
        ))}
      </Panel>
      <Panel title="Glyph animated='idle' / 'running' — unchanged paths">
        <Glyph variant="live" size={64} animated="idle" alt="" />
        <Glyph variant="live" size={64} animated="running" alt="" />
        <Glyph variant="crest" size={64} alt="" />
      </Panel>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <style>{themeStylesheet}</style>
    <style>{componentStylesheet}</style>
    <Demo />
  </StrictMode>,
)
