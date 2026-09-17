import { defineConfig } from 'vite'

// GitHub project pages: https://<user>.github.io/human-anatomy-explorer/
export default defineConfig({
  base: '/human-anatomy-explorer/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 700,
  },
})
