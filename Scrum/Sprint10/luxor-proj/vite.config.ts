/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// SFTWRKEY-451: el navegador llama al backend por el mismo dominio del sitio (/api), así la
// cookie de sesión es del mismo sitio. En local (dev y preview) lo reenvía este proxy y en
// Vercel el rewrite de vercel.json. BACKEND_URL cambia el destino (docker-compose usa
// http://backend:3000 y las pruebas e2e su propio puerto).
// SFTWRKEY-457: las fotos subidas desde el panel también las sirve el backend.
const backend = process.env.BACKEND_URL || 'http://localhost:3000'
const proxyAlBackend = {
  '/api': {
    target: backend,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
  '/product-images': { target: backend, changeOrigin: true },
}

export default defineConfig({
  plugins: [react()],
  server: {
    // en docker (windows/mac) los cambios de archivos del volumen montado no llegan
    // como eventos, asi que vite no se entera. docker-compose define VITE_USE_POLLING.
    watch: process.env.VITE_USE_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
    proxy: proxyAlBackend,
  },
  preview: {
    proxy: proxyAlBackend,
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