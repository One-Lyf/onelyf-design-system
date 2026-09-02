import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Library build: the design system is consumed by the Lyf apps as a token +
// component library, not shipped as its own app. `npm run build` emits an ES
// bundle of the public surface (src/index.ts); PNG glyphs are inlined/copied.
export default defineConfig({
  plugins: [react()],
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
