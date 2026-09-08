// ─── Artifacts panel syntax highlighting (livchat-artifacts-system) ─────────
// Jeff live 2026-09-08 (decision #4 of the artifacts-panel batch): highlight colors
// come from the OneLyf DS token palette (light + dark), NOT an off-the-shelf theme
// (Shiki/Prism). This is a small, dependency-free tokenizer — not a full grammar per
// language — because the DS's job is to make code LOOK like it belongs to OneLyf, not
// to be a correctness-graded highlighter for every language Liv might emit. It covers
// the categories common across the languages LivChat artifacts actually ship in v1
// (JS/TS/JSX/TSX, Python, JSON, CSS, bash, SQL, YAML, Markdown): comments, strings,
// numbers, per-language keywords, and a "function name" heuristic (identifier directly
// followed by `(`). Anything else falls through as plain text — under-highlighting a
// language is a cosmetic miss, not a correctness bug, so this deliberately never tries
// to be exhaustive.
//
// Kept JSX/React-free (returns plain data, not elements) so it unit-tests under
// `node --test` like its livChatComposer siblings; LivChat.tsx maps each token's `kind`
// to a cssVar color and renders the spans.

export type SyntaxTokenKind = 'keyword' | 'string' | 'number' | 'comment' | 'function' | 'plain'
export interface SyntaxToken { text: string; kind: SyntaxTokenKind }

// Languages that use `#` as a line-comment marker instead of `//`.
const HASH_COMMENT_LANGS = new Set(['python', 'py', 'bash', 'sh', 'shell', 'yaml', 'yml'])
// Languages with no C-style /* */ block comments (so `/*` inside them, e.g. a CSS
// selector's own bracketed content, isn't misread as opening a comment run — moot
// for CSS itself, but keeps the block-comment path opt-in rather than default-on).
const BLOCK_COMMENT_LANGS = new Set(['javascript', 'js', 'jsx', 'typescript', 'ts', 'tsx', 'css', 'sql'])

const KEYWORDS: Record<string, ReadonlySet<string>> = {
  javascript: new Set(['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'default', 'class', 'extends', 'new', 'this', 'super', 'import', 'export', 'from', 'as', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in', 'of', 'null', 'undefined', 'true', 'false', 'void', 'delete', 'yield', 'static', 'get', 'set']),
  python: new Set(['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'class', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'lambda', 'yield', 'pass', 'global', 'nonlocal', 'assert', 'del', 'is', 'in', 'not', 'and', 'or', 'None', 'True', 'False', 'async', 'await']),
  sql: new Set(['select', 'from', 'where', 'insert', 'into', 'values', 'update', 'set', 'delete', 'create', 'table', 'alter', 'drop', 'join', 'left', 'right', 'inner', 'outer', 'on', 'group', 'by', 'order', 'having', 'limit', 'as', 'and', 'or', 'not', 'null', 'is', 'in', 'distinct', 'union', 'primary', 'key', 'foreign', 'references']),
  bash: new Set(['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function', 'return', 'export', 'local', 'in', 'echo', 'exit']),
  css: new Set(['import', 'media', 'supports', 'keyframes', 'from', 'to']),
  yaml: new Set(['true', 'false', 'null']),
}
// JS-family aliases + TS-only additions share the JS keyword set (v1: not worth a
// separate near-duplicate list for the handful of TS-only keywords like `interface`).
const TS_EXTRA = new Set(['interface', 'type', 'enum', 'implements', 'namespace', 'readonly', 'public', 'private', 'protected', 'abstract', 'declare', 'satisfies'])
for (const alias of ['js', 'jsx']) KEYWORDS[alias] = KEYWORDS.javascript
for (const alias of ['typescript', 'ts', 'tsx']) KEYWORDS[alias] = new Set([...KEYWORDS.javascript, ...TS_EXTRA])
for (const alias of ['py']) KEYWORDS[alias] = KEYWORDS.python
for (const alias of ['sh', 'shell']) KEYWORDS[alias] = KEYWORDS.bash
for (const alias of ['yml']) KEYWORDS[alias] = KEYWORDS.yaml

// One combined regex per call, ordered so the more specific alternatives (comments,
// strings) win over the generic identifier/number/punctuation ones — JS regex
// alternation is first-match-wins at each position, so order encodes precedence.
// The identifier alternatives use named groups (`call` vs `ident`) so classify()
// can tell a function-call site from a bare identifier reference without having to
// re-scan the surrounding text — alternation alone doesn't expose which branch fired.
function buildTokenRegex(language: string): RegExp {
  const parts: string[] = []
  if (BLOCK_COMMENT_LANGS.has(language)) parts.push('/\\*[\\s\\S]*?\\*/')
  if (HASH_COMMENT_LANGS.has(language)) parts.push('#[^\\n]*')
  else parts.push('//[^\\n]*')
  parts.push('`(?:\\\\.|[^`\\\\])*`', '"(?:\\\\.|[^"\\\\])*"', "'(?:\\\\.|[^'\\\\])*'")
  parts.push('\\b\\d+\\.?\\d*\\b')
  parts.push('(?<call>[A-Za-z_$][A-Za-z0-9_$]*)(?=\\s*\\()') // function-call heuristic
  parts.push('(?<ident>[A-Za-z_$][A-Za-z0-9_$]*)')
  return new RegExp(parts.join('|'), 'g')
}

// Tokenizes `code` for `language` into an ordered list of {text, kind} spans that
// concatenate back to the original string exactly (LivChat relies on this to render
// without dropping or duplicating any character, including whitespace runs between
// tokens). An unrecognized language still gets comment/string/number highlighting —
// only the keyword set is empty, so identifiers just render as plain text.
export function highlightCode(code: string, language: string): SyntaxToken[] {
  const lang = (language || 'text').toLowerCase()
  const keywords = KEYWORDS[lang] ?? new Set<string>()
  const regex = buildTokenRegex(lang)
  const tokens: SyntaxToken[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(code))) {
    if (match.index > last) tokens.push({ text: code.slice(last, match.index), kind: 'plain' })
    const text = match[0]
    const isCall = match.groups?.call !== undefined
    tokens.push({ text, kind: classify(text, keywords, isCall) })
    last = match.index + text.length
  }
  if (last < code.length) tokens.push({ text: code.slice(last), kind: 'plain' })
  return tokens
}

function classify(text: string, keywords: ReadonlySet<string>, isCall: boolean): SyntaxTokenKind {
  const first = text[0]
  if (first === '/' && text[1] === '/') return 'comment'
  if (first === '/' && text[1] === '*') return 'comment'
  if (first === '#') return 'comment'
  if (first === '"' || first === "'" || first === '`') return 'string'
  if (/^\d/.test(text)) return 'number'
  if (keywords.has(text) || keywords.has(text.toLowerCase())) return 'keyword'
  if (isCall) return 'function' // an identifier directly followed by `(` — a call/definition site
  return 'plain' // punctuation, whitespace runs, or a bare identifier reference
}
