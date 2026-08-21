import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@vibe/ui': path.resolve(__dirname, './node_modules/@vibe/ui'),
      '@vibe/web-core': path.resolve(__dirname, './node_modules/@vibe/web-core'),
    }
  },
  build: {
    outDir: 'dist',
  }
})
