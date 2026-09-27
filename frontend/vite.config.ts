import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  // Use relative path ONLY for desktop builds; use '/' for web to ensure nested routes (/shared/:slug) resolve assets correctly
  base: process.env.VITE_APP_TARGET === 'desktop' ? './' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom', 'framer-motion', 'lucide-react', 'sonner'],
        }
      }
    },
    chunkSizeWarningLimit: 800, // Slightly higher limit after chunking
  }
})
