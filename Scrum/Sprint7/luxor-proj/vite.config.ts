import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // ojo: este proxy solo funciona con `npm run dev`. en el build de produccion
  // (vercel) no existe, ahi el frontend pega directo a VITE_API_URL.
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})