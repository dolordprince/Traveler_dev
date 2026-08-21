import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@web': path.resolve(__dirname, './src'),
      '@': path.resolve(__dirname, './src'),
      '@vibe/ui/components/CrashScreen': path.resolve(__dirname, './src/stubs/vibe-ui/components/CrashScreen.jsx'),
      '@vibe/ui': path.resolve(__dirname, './src/stubs/vibe-ui'),
      '@vibe/web-core/project-search': path.resolve(__dirname, './src/stubs/vibe-web-core/project-search.js'),
      '@vibe/web-core': path.resolve(__dirname, './src/stubs/vibe-web-core'),
    }
  },
  build: { outDir: 'dist' }
})
