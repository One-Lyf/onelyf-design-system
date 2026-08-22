// Run with: node --experimental-strip-types --test src/components/livChatComposer.test.ts
// (or plain `node --test` on a Node version where TS type-stripping is unflagged).
import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldSendOnEnter, partialTurnToAppend, transcriptToMarkdown, transcriptFilename, extractDocument, documentFilename } from './livChatComposer.ts'

// enterSends = true on a physical keyboard (fine pointer); false on a touch device.
test('plain Enter sends on a physical keyboard (enterSends=true)', () => {
  assert.equal(shouldSendOnEnter('Enter', false, false, true), true)
})

test('on touch (enterSends=false) Enter NEVER sends — it inserts a newline, send is a button tap', () => {
  assert.equal(shouldSendOnEnter('Enter', false, false, false), false)
})

test('Shift+Enter never sends (newline), on either device', () => {
  assert.equal(shouldSendOnEnter('Enter', true, false, true), false)
  assert.equal(shouldSendOnEnter('Enter', true, true, true), false)
  assert.equal(shouldSendOnEnter('Enter', true, false, false), false)
})

test('Enter that confirms an IME composition does not send — the bug this fixes', () => {
  // Before the fix this returned true, so confirming a Japanese/Chinese/Korean
  // candidate via Enter submitted the message mid-composition and cut it off.
  assert.equal(shouldSendOnEnter('Enter', false, true, true), false)
})

test('non-Enter keys never send', () => {
  assert.equal(shouldSendOnEnter('a', false, false, true), false)
  assert.equal(shouldSendOnEnter('Tab', false, false, true), false)
})

// ── partialTurnToAppend — the interrupt-a-turn regression (abort mid-stream) ──
// Gate (livchat-interrupt-turn): the partial reply that already streamed in must
// PERSIST in the transcript when the user hits Stop, not be discarded.
const ID = () => 'partial-fixed-id'

test('abort mid-stream keeps the partial reply as a liv turn (the regression this guards)', () => {
  // Realistic reload state after an aborted stream: the user turn is persisted, the reply is not.
  const existing = [{ role: 'user', content: 'my question' }]
  const r = partialTurnToAppend(true, 'The first half of the answer', existing, ID)
  assert.deepEqual(r, { id: 'partial-fixed-id', role: 'liv', modality: 'text', content: 'The first half of the answer' })
})

test('not aborted → nothing appended (a normal completed/errored turn is handled elsewhere)', () => {
  assert.equal(partialTurnToAppend(false, 'some streamed text', [{ role: 'user', content: 'q' }], ID), null)
})

test('aborted before any token streamed → nothing appended (no empty bubble)', () => {
  assert.equal(partialTurnToAppend(true, '', [{ role: 'user', content: 'q' }], ID), null)
  assert.equal(partialTurnToAppend(true, '   \n ', [{ role: 'user', content: 'q' }], ID), null)
})

test('partial content is trimmed of the surrounding whitespace/caret noise', () => {
  const r = partialTurnToAppend(true, '  half an answer\n', [{ role: 'user', content: 'q' }], ID)
  assert.equal(r?.content, 'half an answer')
})

test('dedup: if the reloaded transcript already ENDS with a liv turn, do NOT add a second bubble', () => {
  // Backend persisted the reply itself (possibly a longer partial than the client received) —
  // keyed on "last message is a liv turn", not exact content, so a longer server copy still dedups.
  const existing = [
    { role: 'user', content: 'my question' },
    { role: 'liv', content: 'half an answer, plus a bit more the client never saw' },
  ]
  assert.equal(partialTurnToAppend(true, 'half an answer', existing, ID), null)
})

test('prior liv turns in history do NOT block the partial — only the LAST message matters', () => {
  // A multi-turn thread whose newest user message is still unanswered ends with that user msg.
  const existing = [
    { role: 'user', content: 'first question' },
    { role: 'liv', content: 'first answer' },
    { role: 'user', content: 'second question' },
  ]
  const r = partialTurnToAppend(true, 'second answer, cut off', existing, ID)
  assert.equal(r?.content, 'second answer, cut off')
  assert.equal(r?.role, 'liv')
})

test('empty transcript (abort on the throw path before reload state) still yields the partial', () => {
  const r = partialTurnToAppend(true, 'a partial', [], ID)
  assert.equal(r?.content, 'a partial')
})

// ── transcriptToMarkdown — whole-conversation export (livchat-transcript-share-export) ──
test('renders every turn in order with role headers and a title', () => {
  const md = transcriptToMarkdown(
    [
      { role: 'user', content: 'What can I cook?' },
      { role: 'liv', content: 'How about a stir-fry?' },
      { role: 'user', content: 'Sounds good' },
    ],
    { hatName: 'Commis' },
  )
  assert.equal(md, [
    '# Conversation with Commis',
    '',
    '**You:**',
    '',
    'What can I cook?',
    '',
    '**Commis:**',
    '',
    'How about a stir-fry?',
    '',
    '**You:**',
    '',
    'Sounds good',
    '',
  ].join('\n').trimEnd() + '\n')
})

test('a custom title overrides the default header', () => {
  const md = transcriptToMarkdown([{ role: 'user', content: 'hi' }], { hatName: 'Liv', title: 'My chat' })
  assert.ok(md.startsWith('# My chat\n'))
})

test('an image-only turn (attachments, no text) is not silently dropped', () => {
  const md = transcriptToMarkdown([{ role: 'user', content: '', attachments: [{ path: 'x' }] }], { hatName: 'Liv' })
  assert.ok(md.includes('_(attachment)_'))
  const mdStr = transcriptToMarkdown([{ role: 'user', content: null, attachments: '[{"path":"x"}]' }], { hatName: 'Liv' })
  assert.ok(mdStr.includes('_(attachment)_'))
})

test('a truly empty turn is marked, not dropped, so turn count is preserved', () => {
  const md = transcriptToMarkdown([{ role: 'liv', content: '' }], { hatName: 'Liv' })
  assert.ok(md.includes('_(no text)_'))
})

test('empty conversation still produces a valid (header-only) document', () => {
  const md = transcriptToMarkdown([], { hatName: 'Liv' })
  assert.equal(md, '# Conversation with Liv\n')
})

test('transcriptFilename is filesystem-safe and slugged from the hat name', () => {
  assert.equal(transcriptFilename('Cash Stash Advisor', '2026-08-21-1930'), 'cash-stash-advisor-conversation-2026-08-21-1930.md')
  assert.equal(transcriptFilename('', '2026-08-21'), 'liv-conversation-2026-08-21.md')
})

// ── extractDocument / documentFilename — livchat-document-creation ──
test('a fenced document block with a title is extracted, and stripped from the surrounding text', () => {
  const content = 'Here you go:\n\n```document Weekly Meal Plan\n# Weekly Meal Plan\n- Mon: stir-fry\n```'
  const r = extractDocument(content)
  assert.equal(r?.text, 'Here you go:')
  assert.equal(r?.document.title, 'Weekly Meal Plan')
  assert.equal(r?.document.content, '# Weekly Meal Plan\n- Mon: stir-fry')
})

test('no fence in the content → null, not an error', () => {
  assert.equal(extractDocument('just a normal reply'), null)
  assert.equal(extractDocument(''), null)
  assert.equal(extractDocument(null), null)
  assert.equal(extractDocument(undefined), null)
})

test('a fence with no title falls back to "Document"', () => {
  const r = extractDocument('```document\nbody text\n```')
  assert.equal(r?.document.title, 'Document')
})

test('text before AND after the fence is preserved (joined, trimmed)', () => {
  const r = extractDocument('intro\n```document Notes\nbody\n```\noutro')
  assert.equal(r?.text, 'intro\n\noutro')
})

test('an empty fence body yields no document (not a blank download)', () => {
  assert.equal(extractDocument('```document Empty\n\n```'), null)
})

test('only the FIRST fence is treated as the document (v1 scope: one per reply)', () => {
  const r = extractDocument('```document First\none\n```\nmore text\n```document Second\ntwo\n```')
  assert.equal(r?.document.title, 'First')
  assert.ok(r?.text.includes('```document Second'))
})

test('documentFilename is filesystem-safe and slugged from the title', () => {
  assert.equal(documentFilename('Weekly Meal Plan', '2026-08-22-0200'), 'weekly-meal-plan-2026-08-22-0200.md')
  assert.equal(documentFilename('', '2026-08-22'), 'document-2026-08-22.md')
  assert.equal(documentFilename('!!!', '2026-08-22'), 'document-2026-08-22.md')
})
