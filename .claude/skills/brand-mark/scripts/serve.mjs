// Static file server for the review sheet. Loopback only, read only.
//
//   node serve.mjs [dir] [--port 8931]
//
// Exists because the review step drives a browser through the Playwright MCP
// tools, and those refuse file:// URLs. Serving the sheet over 127.0.0.1 is the
// whole workaround. Ctrl-C or kill the background task when the review is done.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const argv = process.argv.slice(2)
const flag = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined }
const port = +(flag('--port') ?? 8931)
const root = path.resolve(argv.find(a => !a.startsWith('--') && a !== String(port)) ?? '.')

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
}

createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '')
    const file = path.join(root, rel || 'index.html')
    if (!file.startsWith(root)) { res.writeHead(403); return res.end('forbidden') }
    const s = await stat(file)
    const target = s.isDirectory() ? path.join(file, 'index.html') : file
    const body = await readFile(target)
    res.writeHead(200, { 'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
    res.end(body)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
  }
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`))
