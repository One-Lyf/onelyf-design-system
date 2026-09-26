// render-wav.mjs — renders the film's score (FILM.score) offline in Chrome and writes score.wav.
// Same encoding as the page's "export score.wav" button. Usage: node render-wav.mjs onelyf.html
// PLAYWRIGHT and CHROME override the Mac defaults (same variables as render-pw.mjs).
const { chromium } = await import(process.env.PLAYWRIGHT || '/Users/eziergoing/homlyf-tummyful/node_modules/playwright-core/index.mjs');
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const file = process.argv[2] || 'onelyf.html';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.resolve(file)).href + '?bare=1&frame=0', { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const b64 = await page.evaluate(async () => {
    const FILM = window.__FILM, sr = 48000, oac = new OfflineAudioContext(2, Math.ceil(sr * FILM.DUR), sr);
    FILM.score(oac, 0, oac.destination); const buf = await oac.startRendering();
    const n = buf.length, out = new DataView(new ArrayBuffer(44 + n * 4)), ws = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
    out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); ws(36, 'data'); out.setUint32(40, n * 4, true);
    const L = buf.getChannelData(0), R = buf.getChannelData(1), cl = v => Math.max(-1, Math.min(1, v)); let o = 44;
    for (let i = 0; i < n; i++) { out.setInt16(o, cl(L[i]) * 32767, true); out.setInt16(o + 2, cl(R[i]) * 32767, true); o += 4; }
    const u8 = new Uint8Array(out.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s);
  });
  writeFileSync(path.join(path.dirname(path.resolve(file)), 'score.wav'), Buffer.from(b64, 'base64'));
  console.log('score.wav written');
} finally { await browser.close(); }
