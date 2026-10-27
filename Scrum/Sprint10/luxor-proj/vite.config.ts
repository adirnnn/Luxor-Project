/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// SFTWRKEY-457: las fotos subidas desde el panel las sirve el backend. En local (dev y preview)
// las reenvía este proxy; en Vercel las reenvía el rewrite de vercel.json.
const fotosDelBackend = {
  '/product-images': { target: process.env.VITE_API_URL || 'http://localhost:3000', changeOrigin: true },
}

export default defineConfig({
  plugins: [react()],
  // ojo: este proxy solo funciona con `npm run dev`. en el build de produccion
  // (vercel) no existe, ahi el frontend pega directo a VITE_API_URL.
  server: {
    // en docker (windows/mac) los cambios de archivos del volumen montado no llegan
    // como eventos, asi que vite no se entera. docker-compose define VITE_USE_POLLING.
    watch: process.env.VITE_USE_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      ...fotosDelBackend,
    }
  },
  preview: {
    proxy: fotosDelBackend,
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
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
      ],
      // SFTWRKEY-427: cobertura mínima. Si baja de estos valores, `npm run test:coverage`
      // falla y con él el CI. Se dejan un poco por debajo de la cobertura actual.
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 55,
        lines: 60,
      },
    },
  },
})