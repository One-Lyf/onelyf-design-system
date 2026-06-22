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
    },
  },
})
