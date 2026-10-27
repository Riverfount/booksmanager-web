import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Em desenvolvimento o front chama /api no próprio endereço e o Vite repassa ao backend.
// Assim o cookie do refresh token (SameSite=Strict) e o CORS não atrapalham.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_API_PROXY ?? 'http://localhost:8080', changeOrigin: false } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Node cannot build a Request from a relative URL; tests answer through a mocked fetch anyway.
    env: { VITE_API_URL: 'http://localhost' },
  },
})
