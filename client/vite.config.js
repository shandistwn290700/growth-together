import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Request ke /api diteruskan ke backend Express, jadi tidak perlu repot soal CORS saat development.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
