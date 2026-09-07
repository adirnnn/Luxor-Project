/// <reference types="vitest/config" />
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
  },
  // configuracion de vitest. correr con `npm run test`.
  test: {
    // simula un DOM de navegador para poder renderizar componentes de react.
    environment: 'jsdom',
    // expone describe/it/expect/vi como globales, sin importarlos en cada test.
    globals: true,
    // se ejecuta antes de cada archivo de test (matchers de jest-dom, cleanup).
    setupFiles: './src/test/setup.ts',
    // los tests viven al lado del codigo que prueban: src/**/*.test.ts(x).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
})
