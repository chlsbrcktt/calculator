import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/evaluate':     { target: 'http://localhost:8001', changeOrigin: true },
      '/analyze':      { target: 'http://localhost:8001', changeOrigin: true },
      '/differentiate':{ target: 'http://localhost:8001', changeOrigin: true },
      '/convert-form': { target: 'http://localhost:8001', changeOrigin: true },
      '/surface':      { target: 'http://localhost:8001', changeOrigin: true },
      '/calculate':    { target: 'http://localhost:8001', changeOrigin: true },
      '/health':       { target: 'http://localhost:8001', changeOrigin: true },
    },
  },
})
