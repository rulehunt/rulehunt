import { defineConfig } from 'vite'

export default defineConfig({
  // Local dev server settings
  server: {
    port: 3000,
  },

  // ✅ Crucial for matching Cloudflare Pages layout
  base: './',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
