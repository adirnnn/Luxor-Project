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
    coverage: {
      provider: 'v8',
      // text -> tabla en la terminal; html -> coverage/index.html navegable;
      // lcov -> coverage/lcov.info, el formato que consumen las herramientas de CI.
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // sin esto vitest solo mide los archivos que algun test llego a importar,
      // y el reporte da un porcentaje enganosamente alto.
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
      ],
    },
  },
})

