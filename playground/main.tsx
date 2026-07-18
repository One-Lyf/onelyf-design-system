// ─── Dev-only playground ─────────────────────────────────────────────────
// NOT part of the published package (excluded from the lib build — see
// vite.config.ts). Renders every token/primitive live so changes are
// visible via `npm run dev`, without needing Claude Design or a consuming
// app. Delete freely if a real Storybook-equivalent replaces it later.
import { StrictMode, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import {
  themeStylesheet, componentStylesheet, initTheme,
  space, type, textStyle, radius, shadow,
  Button, Card, ThemeToggle, Glyph,
  Input, Textarea, Select, Field,
  EmptyState, Spinner, Skeleton, ErrorState, Badge,
} from '../src'
import { cssVar } from '../src/theme'
import ControlPanel from './ControlPanel'

initTheme()

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: space[9] }}>
      <h2 style={{ ...textStyle('h3'), color: cssVar.ink, marginBottom: space.md }}>{title}</h2>
      {children}
    </section>
  )
}

function Row({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: 'flex', gap: space.md, flexWrap: 'wrap', alignItems: 'flex-start', ...style }}>{children}</div>
}

function Playground() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: cssVar.bg,
        color: cssVar.ink,
        fontFamily: type.body.family,
        padding: space.lg,
        paddingRight: 260 + space.lg,
        boxSizing: 'border-box',
      }}
    >
      <ControlPanel />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: space[8] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
          <Glyph variant="crest" size={28} />
          <h1 style={{ ...textStyle('h1'), color: cssVar.ink, margin: 0 }}>OneLyf Design System</h1>
        </div>
        <ThemeToggle />
      </div>

      <Section title="Type scale">
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
          {(Object.keys(type) as (keyof typeof type)[]).map((role) => (
            <div key={role} style={{ ...textStyle(role), color: cssVar.ink }}>
              {role} — the quick brown fox ({type[role].size}px)
            </div>
          ))}
        </div>
      </Section>

      <Section title="Spacing scale">
        <Row>
          {(['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const).map((k) => (
            <div key={k} style={{ textAlign: 'center' }}>
              <div style={{ width: space[k], height: space[k], background: cssVar.primary, borderRadius: radius.sm }} />
              <div style={{ ...textStyle('caption'), color: cssVar.mid, marginTop: space.xs }}>{k} ({space[k]}px)</div>
            </div>
          ))}
        </Row>
      </Section>

      <Section title="Color">
        <Row>
          {(['bg', 'surface', 'ink', 'mid', 'primary', 'gold', 'success', 'danger', 'warning'] as const).map((k) => (
            <div key={k} style={{ textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, background: cssVar[k], borderRadius: radius.md, border: `1px solid ${cssVar.border}`, boxShadow: shadow.soft }} />
              <div style={{ ...textStyle('caption'), color: cssVar.mid, marginTop: space.xs }}>{k}</div>
            </div>
          ))}
        </Row>
      </Section>

      <Section title="Buttons">
        <Row>
          <div style={{ width: 220 }}><Button variant="primary">Primary</Button></div>
          <div style={{ width: 220 }}><Button variant="ghost">Ghost</Button></div>
          <div style={{ width: 220 }}><Button variant="danger">Danger</Button></div>
          <div style={{ width: 220 }}><Button variant="primary" disabled>Disabled</Button></div>
        </Row>
      </Section>

      <Section title="Cards">
        <Row>
          <Card style={{ width: 260 }}>
            <div style={{ ...textStyle('title'), color: cssVar.ink }}>Static card</div>
            <div style={{ ...textStyle('bodySm'), color: cssVar.mid, marginTop: space.xs }}>framed hairline, soft shadow.</div>
          </Card>
          <Card style={{ width: 260 }} interactive>
            <div style={{ ...textStyle('title'), color: cssVar.ink }}>Interactive card</div>
            <div style={{ ...textStyle('bodySm'), color: cssVar.mid, marginTop: space.xs }}>hover / tab to it — lift + focus ring.</div>
          </Card>
        </Row>
      </Section>

      <Section title="Inputs">
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.md, maxWidth: 340 }}>
          <Field label="Email" hint="We'll never share this.">
            {(p) => <Input {...p} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Password" error="Must be at least 8 characters." required>
            {(p) => <Input {...p} type="password" />}
          </Field>
          <Field label="Notes">
            {(p) => <Textarea {...p} placeholder="Anything else?" />}
          </Field>
          <Field label="Space">
            {(p) => (
              <Select {...p}>
                <option>HomLyf</option>
                <option>FinLyf</option>
                <option>HlthLyf</option>
              </Select>
            )}
          </Field>
          <Field label="Disabled">
            {(p) => <Input {...p} disabled value="Can't touch this" />}
          </Field>
        </div>
      </Section>

      <Section title="States">
        <Row>
          <Card style={{ width: 280 }}>
            <EmptyState title="No recipes yet" description="Add your first one to get started." action={<Button full={false}>Add recipe</Button>} />
          </Card>
          <Card style={{ width: 280, display: 'flex', flexDirection: 'column', gap: space.sm }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
              <Spinner /> <span style={{ ...textStyle('bodySm'), color: cssVar.mid }}>Loading…</span>
            </div>
            <Skeleton height={14} />
            <Skeleton height={14} width="70%" />
          </Card>
          <Card style={{ width: 280 }}>
            <ErrorState description="Couldn't reach the server." action={<Button variant="ghost" full={false}>Retry</Button>} />
          </Card>
        </Row>
        <Row style={{ marginTop: space.md }}>
          <Badge tone="success">Success</Badge>
          <Badge tone="danger">Danger</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="accent">Accent</Badge>
          <Badge tone="neutral">Neutral</Badge>
        </Row>
      </Section>

      <Button variant="ghost" full={false} onClick={() => setLoading((v) => !v)}>
        {loading ? 'Stop' : 'Toggle a loading demo'}
      </Button>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <style>{themeStylesheet + '\n' + componentStylesheet}</style>
    <Playground />
  </StrictMode>,
)
