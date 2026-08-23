// ─── LivChat action-injection demo harness ──────────────────────────────────
// Dev-only page (excluded from the lib build, same as playground/main.tsx). Proves the
// `livchat-action-injection` graph node's gate: "LivChat renders app-injected
// actions/tools; a Commis action and an Advisor action both round-trip in a demo harness."
//
// Two real `<LivChat>` instances, side by side, each wired to a scripted in-memory adapter
// (playground/livchatDemoAdapters.ts) shaped like the real Commis (kitchen) and Advisor
// (finance) integrations described in docs/liv-chat-adapter-v2.md. Type a message in either
// panel — the mock adapter replies and queues a proposed action card; Apply/Dismiss on that
// card round-trips through the real `LivActionQueue` prop, not a fake shortcut.
//
// Load with: npm run dev, then open /livchat-demo.html
import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  themeStylesheet, componentStylesheet, initTheme,
  space, textStyle, radius,
  ThemeToggle,
  LivChat, livChatStylesheet,
  type LivHat, type LivProposedAction, type LivActionQueue, type LivChatAction,
} from '../src'
import { cssVar } from '../src/theme'
import {
  advisorReplyFor, commisReplyFor, createDemoAdapter, createInMemoryLivBackend,
  createStreamingDemoAdapter,
  type DemoProposedAction,
} from './livchatDemoAdapters'

initTheme()

function toLivProposedActions(proposed: DemoProposedAction[]): LivProposedAction[] {
  return proposed.map((p) => ({ id: p.id, type: p.type, summary: p.summary, data: p.data, status: 'pending' }))
}

// One hat's worth of demo state: the queued action cards + an actionQueue implementation
// that applies/dismisses against that state, exactly like an app's real adapter wrapper
// would own its own `actionCards` state around the shared DS component.
function useDemoActionQueue(replyFor: (text: string) => ReturnType<typeof commisReplyFor>) {
  const [cards, setCards] = useState<LivProposedAction[]>([])
  const backend = useMemo(() => createInMemoryLivBackend(), [])
  const adapter = useMemo(
    () => createDemoAdapter(backend, replyFor, (proposed) => {
      setCards((prev) => [...prev, ...toLivProposedActions(proposed)])
    }),
    [backend, replyFor],
  )

  const queue: LivActionQueue = {
    cards,
    async onApply(id) {
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'applying' } : c)))
      await new Promise((resolve) => setTimeout(resolve, 500))
      const result = 'Applied'
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'done', result } : c)))
      return { ok: true, result }
    },
    onDismiss(id) {
      setCards((prev) => prev.filter((c) => c.id !== id))
    },
    async onApplyAll() {
      for (const card of cards) {
        if (card.status === 'pending') await queue.onApply(card.id)
      }
    },
  }

  return { adapter, queue }
}

function DemoPanel({ hat, adapter, queue, actions }: {
  hat: LivHat
  adapter: ReturnType<typeof useDemoActionQueue>['adapter']
  queue?: LivActionQueue
  actions?: LivChatAction[]
}) {
  return (
    <div style={{
      flex: '1 1 380px', minWidth: 340, maxWidth: 480, height: 640,
      border: `1px solid ${cssVar.border}`, borderRadius: radius.lg, overflow: 'hidden',
    }}>
      <LivChat hat={hat} adapter={adapter} actionQueue={queue} actions={actions} />
    </div>
  )
}

// Full-screen (maximize) dock harness: ONE <LivChat> whose `dock` toggles between 'panel' and
// 'full' via the header maximize/restore button (wired to onMaximize/onRestore). In 'panel' it
// sits inside this 640px box; in 'full' it escapes to a fixed full-viewport overlay (position:fixed
// inset:0) — proving the geometry clears the host box with no host change. The instance stays
// mounted across the toggle, so the conversation + draft survive the state change.
function DockDemoPanel({ hat, adapter }: {
  hat: LivHat
  adapter: ReturnType<typeof useDemoActionQueue>['adapter']
}) {
  const [dock, setDock] = useState<'panel' | 'full'>('panel')
  return (
    <div style={{
      flex: '1 1 380px', minWidth: 340, maxWidth: 480, height: 640, position: 'relative',
      border: `1px solid ${cssVar.border}`, borderRadius: radius.lg, overflow: 'hidden',
    }}>
      <LivChat
        hat={hat}
        adapter={adapter}
        dock={dock}
        onMaximize={() => setDock('full')}
        onRestore={() => setDock('panel')}
      />
    </div>
  )
}

function LivChatDemo() {
  const commis = useDemoActionQueue(commisReplyFor)
  const advisor = useDemoActionQueue(advisorReplyFor)
  // Full-screen dock demo: an independent backend/adapter so it doesn't share state with the panels.
  const dockBackend = useMemo(() => createInMemoryLivBackend(), [])
  const dockAdapter = useMemo(() => createDemoAdapter(dockBackend, commisReplyFor, () => {}), [dockBackend])
  // Interrupt-a-turn harness: a slow word-by-word stream with a working Stop (abort) port, whose
  // backend does NOT persist a cancelled reply — so the partial that survives in the transcript
  // proves LivChat's own partial-commit (livchat-interrupt-turn gate).
  const streamBackend = useMemo(() => createInMemoryLivBackend(), [])
  const streamAdapter = useMemo(() => createStreamingDemoAdapter(streamBackend), [streamBackend])

  const commisHat: LivHat = {
    name: 'Commis',
    subtitle: 'kitchen',
    accent: '#c96a3f',
    placeholder: 'Ask Commis to plan a meal…',
    emptyText: 'Nothing cooking yet.',
    description: 'Your kitchen co-pilot.',
    pills: ['recipes', 'meal plan', 'pantry'],
    suggestions: ['What can I cook tonight?', 'Write me a meal plan document for the week'],
    toolLabels: { save_recipe: 'Writing your recipe' },
  }

  const advisorHat: LivHat = {
    name: 'Advisor',
    subtitle: 'finance',
    accent: '#b8912f',
    placeholder: 'Ask the Advisor about your budget…',
    emptyText: 'No spending questions yet.',
    description: 'Your household finance co-pilot.',
    pills: ['budget', 'transactions'],
    suggestions: ['Categorize my spending'],
    toolLabels: { categorize_transaction: 'Categorizing' },
  }

  const streamHat: LivHat = {
    name: 'Liv',
    subtitle: 'interrupt demo',
    accent: '#4c8bf5',
    placeholder: 'Send a message, then press Stop mid-reply…',
    emptyText: 'Send anything — the reply streams slowly so you can Stop it.',
    description: 'Slow-stream harness for the interrupt-a-turn gate.',
  }

  const dockHat: LivHat = {
    name: 'Liv',
    subtitle: 'full-screen demo',
    accent: '#6a53d1',
    placeholder: 'Use the header maximize button to go full-screen…',
    emptyText: 'Tap the maximize icon in the header — this card fills the whole viewport.',
    description: 'Full-screen (maximize) dock harness — toggle it with the header maximize/restore button.',
  }

  const advisorActions: LivChatAction[] = [
    {
      id: 'manual-add-to-budget',
      label: 'Add to budget manually',
      hint: "Advisor's manual fallback menu (docs/liv-chat-adapter-v2.md §3.1)",
      onSelect: () => {
        // eslint-disable-next-line no-console
        console.log('manual add-to-budget selected')
      },
    },
  ]

  return (
    <div style={{
      minHeight: '100vh', background: cssVar.bg, color: cssVar.ink,
      padding: space.lg, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.lg }}>
        <div>
          <h1 style={{ ...textStyle('h1'), color: cssVar.ink, margin: 0 }}>LivChat action-injection demo</h1>
          <p style={{ ...textStyle('bodySm'), color: cssVar.mid, marginTop: space.xs }}>
            Two hats, one shared &lt;LivChat&gt;. Send a message in each — a proposed action
            card should appear below the reply; Apply/Dismiss round-trips through the real
            LivActionQueue prop.
          </p>
        </div>
        <ThemeToggle />
      </div>
      <div style={{ display: 'flex', gap: space.lg, flexWrap: 'wrap' }}>
        <DemoPanel hat={commisHat} adapter={commis.adapter} queue={commis.queue} />
        <DemoPanel hat={advisorHat} adapter={advisor.adapter} queue={advisor.queue} actions={advisorActions} />
        <DemoPanel hat={streamHat} adapter={streamAdapter} />
        <DockDemoPanel hat={dockHat} adapter={dockAdapter} />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <style>{themeStylesheet + '\n' + componentStylesheet + '\n' + livChatStylesheet}</style>
    <LivChatDemo />
  </StrictMode>,
)
