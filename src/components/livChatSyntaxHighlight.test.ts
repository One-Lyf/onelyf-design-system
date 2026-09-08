// Run with: node --test src/components/livChatSyntaxHighlight.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { highlightCode } from './livChatSyntaxHighlight.ts'

// Tokens must always concatenate back to the exact original string — the panel
// renders each token as its own <span>, so a dropped/duplicated character here
// would corrupt the artifact's own displayed source.
function reassemble(code: string, language: string): string {
  return highlightCode(code, language).map((t) => t.text).join('')
}

test('tokens concatenate back to the original source exactly (js)', () => {
  const code = 'function add(a, b) {\n  return a + b; // sum\n}'
  assert.equal(reassemble(code, 'javascript'), code)
})

test('tokens concatenate back to the original source exactly (python, hash comments)', () => {
  const code = 'def add(a, b):\n    return a + b  # sum'
  assert.equal(reassemble(code, 'python'), code)
})

test('JS keywords are classified as keyword, not function, even directly before a paren', () => {
  const tokens = highlightCode('if (x) { return; }', 'javascript')
  const ifToken = tokens.find((t) => t.text === 'if')
  assert.equal(ifToken?.kind, 'keyword')
})

test('a call site (identifier directly followed by "(") is classified as function', () => {
  const tokens = highlightCode('add(1, 2)', 'javascript')
  const nameToken = tokens.find((t) => t.text === 'add')
  assert.equal(nameToken?.kind, 'function')
})

test('a bare identifier reference (not followed by a paren) is plain, not function', () => {
  const tokens = highlightCode('const total = a + b;', 'javascript')
  const bare = tokens.find((t) => t.text === 'total')
  assert.equal(bare?.kind, 'plain')
})

test('line comments are classified as comment and stop at the newline', () => {
  const tokens = highlightCode('x = 1 // trailing\ny = 2', 'javascript')
  const comment = tokens.find((t) => t.kind === 'comment')
  assert.equal(comment?.text, '// trailing')
})

test('python uses # for line comments, not //', () => {
  const tokens = highlightCode('x = 1 # trailing', 'python')
  const comment = tokens.find((t) => t.kind === 'comment')
  assert.equal(comment?.text, '# trailing')
})

test('block comments span multiple lines in JS-family languages', () => {
  const tokens = highlightCode('/* a\nb */\nx', 'javascript')
  const comment = tokens.find((t) => t.kind === 'comment')
  assert.equal(comment?.text, '/* a\nb */')
})

test('strings (single, double, template) are classified as string and keep escapes intact', () => {
  const tokens = highlightCode(`a = "x\\"y"; b = 'z'; c = \`t\${1}\``, 'javascript')
  const strings = tokens.filter((t) => t.kind === 'string').map((t) => t.text)
  assert.deepEqual(strings, ['"x\\"y"', "'z'", '`t${1}`'])
})

test('numbers (integer and decimal) are classified as number', () => {
  const tokens = highlightCode('a = 42 + 3.14', 'javascript')
  const numbers = tokens.filter((t) => t.kind === 'number').map((t) => t.text)
  assert.deepEqual(numbers, ['42', '3.14'])
})

test('TS-only keywords (interface, type) are recognized for tsx/ts but not plain js', () => {
  assert.equal(highlightCode('interface Foo {}', 'tsx').find((t) => t.text === 'interface')?.kind, 'keyword')
  assert.equal(highlightCode('interface Foo {}', 'javascript').find((t) => t.text === 'interface')?.kind, 'plain')
})

test('an unrecognized language still highlights comments/strings/numbers, just no keywords', () => {
  const tokens = highlightCode('weird_lang_thing = 1', 'some-made-up-lang')
  assert.equal(tokens.find((t) => t.text === '1')?.kind, 'number')
  assert.equal(tokens.find((t) => t.text === 'weird_lang_thing')?.kind, 'plain')
})

test('an empty string yields no tokens', () => {
  assert.deepEqual(highlightCode('', 'javascript'), [])
})
