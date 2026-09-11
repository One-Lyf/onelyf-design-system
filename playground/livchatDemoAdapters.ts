// ─── LivChat action-injection demo harness — data layer ────────────────────
// Pure, DOM-free adapter factories that satisfy the real `LivChatAdapter` contract
// (src/components/LivChat.tsx) with in-memory data, plus scripted Commis/Advisor-shaped
// replies. Kept separate from livchat-demo.tsx so this logic is unit-testable with plain
// `node --test` (no React renderer available in this repo — see livChatComposer.test.ts).
//
// This proves the `livchat-action-injection` gate at the wire-protocol level: a hat's
// chat.send can flow app-domain proposed actions back through `extras`, exactly as the
// real Commis/Advisor integrations will. The demo page (livchat-demo.tsx) proves the same
// round trip through the actual rendered `<LivChat>` component.
import type { LivChatAdapter, LivChatSendResult, LivMessage, LivResult, LivSession, LivToolActivity } from '../src'

export interface DemoProposedAction {
  id: string
  type: string
  summary: string
  data?: unknown
}

export interface DemoReply {
  text: string
  toolActivity?: { name: string; summary?: string }
  proposed?: DemoProposedAction[]
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Deterministic canned reply for the Commis (Tummyful, kitchen-domain) hat — mirrors the
// shape `askCommisAuto` returns today: reply text + queued proposed[] in one round trip
// (docs/liv-chat-adapter-v2.md §2.2).
//
// livchat-document-creation demo: a "meal plan document" ask gets a reply whose text
// contains a ```document fence (see livChatComposer.ts's extractDocument) instead of the
// usual proposed[] card — a real per-app use case for the DS's document-flagging primitive,
// round-tripped through the actual rendered <LivChat> (not a hand-copied reimplementation).
export function commisReplyFor(userText: string): DemoReply {
  // livchat-decision-options-cards demo: a "help me decide" ask gets a reply whose text
  // carries an ```options fence (see livChatComposer.ts's extractOptions). DS renders the
  // choices as tappable cards; tapping one sends that choice as the next turn — round-tripped
  // through the real rendered <LivChat>, not a hand-copied reimplementation.
  if (/help me decide|what should i (cook|make)|can't decide/i.test(userText)) {
    return {
      text: 'Happy to help — what kind of night is it?\n\n'
        + '```options\n'
        + '- Weeknight quick dinner (under 30 min)\n'
        + '- Batch-cook for the week\n'
        + '- Something impressive for guests\n'
        + '```',
    }
  }
  // livchat-artifacts-system demo: a "recipe card artifact" ask gets a reply whose text
  // carries a ```artifact fence (see livChatComposer.ts's extractArtifact) — opens in the
  // dedicated side panel instead of an inline download, round-tripped through the actual
  // rendered <LivChat>.
  if (/recipe card artifact/i.test(userText)) {
    return {
      text: 'Here\'s a printable recipe card component — open the panel to see it rendered with syntax highlighting.\n\n'
        + '```artifact tsx Chicken Stir-Fry Card\n'
        + 'export default function RecipeCard() {\n'
        + '  // Serves 4, ready in 25 minutes\n'
        + '  const ingredients = ["chicken breast", "bell pepper", "soy sauce"]\n'
        + '  return (\n'
        + '    <div className="recipe-card">\n'
        + '      <h2>Chicken Stir-Fry</h2>\n'
        + '      {ingredients.map((item) => <li key={item}>{item}</li>)}\n'
        + '    </div>\n'
        + '  )\n'
        + '}\n'
        + '```',
    }
  }
  if (/meal plan document/i.test(userText)) {
    return {
      text: 'Here\'s your plan for the week — download it below to keep on the counter.\n\n'
        + '```document Weekly Meal Plan\n'
        + '# Weekly Meal Plan\n\n'
        + '- **Mon** — Chicken Stir-Fry\n'
        + '- **Tue** — Sheet-Pan Salmon\n'
        + '- **Wed** — Black Bean Tacos\n'
        + '- **Thu** — Leftovers\n'
        + '- **Fri** — Pizza Night\n'
        + '```',
      toolActivity: { name: 'save_recipe', summary: 'Drafted: Weekly Meal Plan' },
    }
  }
  return {
    text: `Here's a plan for "${userText}".`,
    toolActivity: { name: 'save_recipe', summary: 'Saved: Chicken Stir-Fry' },
    proposed: [
      {
        id: 'demo-commis-meal-plan',
        type: 'add_to_meal_plan',
        summary: 'Add Chicken Stir-Fry to Tuesday dinner',
        data: { recipeId: 'r1', date: 'Tue', meal: 'dinner' },
      },
    ],
  }
}

// Deterministic canned reply for the Advisor (Cash Stash, finance-domain) hat — same
// extras.proposed shape, different domain payload (docs/liv-chat-adapter-v2.md §3.1).
export function advisorReplyFor(userText: string): DemoReply {
  return {
    text: `Here's what I found for "${userText}".`,
    toolActivity: { name: 'categorize_transaction', summary: 'Categorized 1 transaction' },
    proposed: [
      {
        id: 'demo-advisor-categorize',
        type: 'categorize_transaction',
        summary: "Categorize \"Trader Joe's $86.20\" as Groceries",
        data: { txnId: 't1', category: 'Groceries' },
      },
      {
        id: 'demo-advisor-envelope',
        type: 'move_envelope',
        summary: 'Move $50 from Dining Out to Groceries',
        data: { from: 'dining', to: 'groceries', amount: 50 },
      },
    ],
  }
}

// A deliberately SLOW, word-by-word streaming adapter with a working abort() port — the harness
// for the `livchat-interrupt-turn` gate. Each word is a separate onChunk delta with a delay, so a
// human (or a Playwright drive) has a real mid-stream window to hit Stop. On abort it swallows the
// cancel and resolves {ok:false} (the canonical adapter shape) and — importantly — does NOT persist
// the assistant reply to the backend, simulating a generation that was cut off server-side. That
// forces the surviving partial in the transcript to come from LivChat's own partial-commit (see
// partialTurnToAppend), which is exactly what the gate requires: "the partial turn persists".
export function createStreamingDemoAdapter(backend: InMemoryLivBackend): LivChatAdapter {
  let ac: AbortController | null = null
  return {
    sessions: backend.sessions,
    messages: backend.messages,
    chat: {
      async send({ sessionId, text }, onChunk): Promise<LivChatSendResult> {
        backend.appendMessage(sessionId, { id: backend.nextMessageId(), role: 'user', content: text })
        ac = new AbortController()
        const signal = ac.signal
        const words = (`You said "${text}". Here is a deliberately slow, word-by-word streamed reply `
          + `so there is time to press Stop mid-stream and watch the partial answer stay put in the `
          + `transcript instead of vanishing.`).split(' ')
        let acc = ''
        let first = true
        for (const w of words) {
          if (signal.aborted) return { ok: false, error: { message: 'ABORT' } }
          const delta = first ? w : ' ' + w
          first = false
          acc += delta
          onChunk(delta)
          await delay(120)
        }
        // Only reached when NOT aborted — persist the full reply like a real backend would.
        backend.appendMessage(sessionId, { id: backend.nextMessageId(), role: 'liv', content: acc })
        return { ok: true, usage: { input: 40, output: words.length } }
      },
      abort() { ac?.abort() },
    },
  }
}

// Deliberately long, multi-paragraph canned reply — the harness for the
// `liv-console-visual-overhaul` gate's item 8 (no-auto-scroll-to-bottom): a reply this long
// overflows the 640px demo panel several times over, so LivChat's top-anchor behavior
// (LivChat.tsx's `scrollIntoView({ block: 'start' })` on the live turn) is actually
// exercised instead of asserted from source alone. Every other demo reply in this file is a
// one-liner, which is why nobody could previously observe this behavior without app-level
// login.
function longReplyParagraphs(userText: string): string[] {
  return [
    `Here's a long answer to "${userText}" so you can watch where the transcript scrolls to when it lands.`,
    'Paragraph one: this reply is intentionally long enough to overflow the chat panel several times over on a typical mobile viewport, the same way a genuinely detailed Liv answer would.',
    'Paragraph two: when a reply this long finishes streaming in, the transcript should anchor at the TOP of this new turn, not jump to the bottom the way most chat UIs do by default.',
    'Paragraph three: that is a deliberate, non-default choice — the reasoning is that a reader wants to start at the beginning of a long answer, not the last line of it, and should be free to scroll down at their own pace instead of being dropped at the end.',
    'Paragraph four: if the panel is instead pinned to the bottom of this message once streaming completes, that is the regression this demo panel exists to catch.',
    'Paragraph five: this is the last paragraph, included so there is a clear, unambiguous bottom edge to compare the anchor position against.',
  ]
}

// Non-streaming version (whole reply in one onChunk call, like the Commis/Advisor demo
// adapters above) — kept for parity with the rest of this file, but NOT representative of a
// real backend for anchor-behavior testing: see createLongReplyStreamingDemoAdapter below,
// which is the one that actually exercises the gate realistically.
export function longReplyFor(userText: string): DemoReply {
  return { text: longReplyParagraphs(userText).join('\n\n') }
}

// Word-by-word streaming version of the long reply, same delivery shape as
// createStreamingDemoAdapter above (real backends stream incrementally; a single big onChunk
// call turned out NOT to give LivChat's top-anchor effect a render tick to fire before the
// ordinary bottom-follow effect wins — caught by driving longReplyFor through the plain
// createDemoAdapter first and watching it land at the BOTTOM, not the top, of the reply. This
// streaming version is the representative one for the gate.
export function createLongReplyStreamingDemoAdapter(backend: InMemoryLivBackend): LivChatAdapter {
  return {
    sessions: backend.sessions,
    messages: backend.messages,
    chat: {
      async send({ sessionId, text }, onChunk): Promise<LivChatSendResult> {
        backend.appendMessage(sessionId, { id: backend.nextMessageId(), role: 'user', content: text })
        const words = longReplyParagraphs(text).join('\n\n').split(' ')
        let acc = ''
        let first = true
        for (const w of words) {
          const delta = first ? w : ' ' + w
          first = false
          acc += delta
          onChunk(delta)
          await delay(15)
        }
        backend.appendMessage(sessionId, { id: backend.nextMessageId(), role: 'liv', content: acc })
        return { ok: true, usage: { input: 40, output: words.length } }
      },
      abort() {},
    },
  }
}

export interface InMemoryLivBackend {
  sessions: LivChatAdapter['sessions']
  messages: LivChatAdapter['messages']
  appendMessage(sessionId: string, message: LivMessage): void
  nextMessageId(): string
}

// A minimal in-memory sessions+messages store shared by every demo hat, so the harness
// exercises LivChat's real adapter contract (list/create/rename/delete + messages.list)
// instead of stubbing it out.
export function createInMemoryLivBackend(): InMemoryLivBackend {
  let nextSessionSeq = 1
  let nextMessageSeq = 1
  const sessions: LivSession[] = []
  const messagesBySession = new Map<string, LivMessage[]>()

  return {
    sessions: {
      async list(): Promise<LivResult<{ sessions: LivSession[] }>> {
        return { ok: true, value: { sessions: [...sessions] } }
      },
      async create(title?: string): Promise<LivResult<{ id: string }>> {
        const id = `demo-session-${nextSessionSeq++}`
        sessions.unshift({ id, title: title ?? null })
        messagesBySession.set(id, [])
        return { ok: true, value: { id } }
      },
      async rename(id: string, title: string): Promise<LivResult> {
        const session = sessions.find((s) => s.id === id)
        if (!session) return { ok: false, error: { message: 'session not found' } }
        session.title = title
        return { ok: true, value: undefined }
      },
      async delete(id: string): Promise<LivResult> {
        const idx = sessions.findIndex((s) => s.id === id)
        if (idx === -1) return { ok: false, error: { message: 'session not found' } }
        sessions.splice(idx, 1)
        messagesBySession.delete(id)
        return { ok: true, value: undefined }
      },
    },
    messages: {
      async list(sessionId: string): Promise<LivResult<{ messages: LivMessage[] }>> {
        return { ok: true, value: { messages: messagesBySession.get(sessionId) ?? [] } }
      },
    },
    appendMessage(sessionId: string, message: LivMessage) {
      const list = messagesBySession.get(sessionId) ?? []
      list.push(message)
      messagesBySession.set(sessionId, list)
    },
    nextMessageId: () => `demo-message-${nextMessageSeq++}`,
  }
}

// Wraps a backend + scripted reply function into a full `LivChatAdapter`. `onProposed`
// fires with each turn's proposed actions — the app-owned side effect that feeds an
// `LivActionQueue`'s `cards`, exactly like Commis's real adapter wrapper would update its
// own `actionCards` state after `askCommisAuto` resolves. LivChat itself never reads
// `extras`; returning it here is just for parity with the real integration shape.
export function createDemoAdapter(
  backend: InMemoryLivBackend,
  replyFor: (userText: string) => DemoReply,
  onProposed: (proposed: DemoProposedAction[]) => void,
): LivChatAdapter {
  return {
    sessions: backend.sessions,
    messages: backend.messages,
    chat: {
      async send({ sessionId, text }, onChunk): Promise<LivChatSendResult> {
        backend.appendMessage(sessionId, { id: backend.nextMessageId(), role: 'user', content: text })
        const reply = replyFor(text)

        if (reply.toolActivity) {
          const start: LivToolActivity = { type: 'tool', phase: 'start', name: reply.toolActivity.name }
          onChunk(start)
        }
        await delay(150)
        if (reply.toolActivity) {
          const end: LivToolActivity = {
            type: 'tool',
            phase: 'end',
            name: reply.toolActivity.name,
            summary: reply.toolActivity.summary,
            ok: true,
          }
          onChunk(end)
        }
        onChunk(reply.text)
        backend.appendMessage(sessionId, { id: backend.nextMessageId(), role: 'liv', content: reply.text })

        const proposed = reply.proposed ?? []
        if (proposed.length) onProposed(proposed)

        return { ok: true, usage: { input: 120, output: 60 }, extras: { proposed } }
      },
    },
  }
}
