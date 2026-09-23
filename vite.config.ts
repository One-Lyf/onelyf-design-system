import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Library build: the design system is consumed by the Lyf apps as a token +
// component library, not shipped as its own app. `npm run build` emits an ES
// bundle of the public surface (src/index.ts). Library mode inlines imported assets by default;
// the glyph SVGs opt out with `?no-inline` and ship as separate files in dist/.
export default defineConfig({
  plugins: [react()],
  // Relative base so the glyph SVGs (imported `?no-inline`, see Glyph.tsx) are referenced from
  // the dist bundle as `new URL("glyph-live.svg", import.meta.url)` instead of a root-absolute
  // "/glyph-live.svg". The consuming app's Vite build picks that pattern up and emits each glyph
  // as its own content-hashed file, so no app ships the four SVGs inside its JS any more.
  base: './',
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'OneLyfDesignSystem',
      formats: ['es'],
      fileName: 'onelyf-design-system',
    },
    rollupOptions: {
      // Don't bundle React — the host app provides it.
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      // Keep EVERY export of the entry (src/index.ts) in the bundle, even ones never
      // referenced internally. Without this, Vite 8's rolldown tree-shakes a re-exported-but-
      // internally-unused symbol out of the dist (it dropped isEffort/isMode on Vercel while a
      // local build happened to keep them), and consumers fail at build with MISSING_EXPORT.
      preserveEntrySignatures: 'strict',
    },
  },
})
