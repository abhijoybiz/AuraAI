import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for mobile asset bundling
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Inline assets under 10kb for fewer network requests
    assetsInlineLimit: 10240,
  },
  server: {
    port: 3001,
    cors: true,
  },
})

