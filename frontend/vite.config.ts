import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const FALLBACK_API_ORIGIN = 'https://fullstack-notes-app-xluo.onrender.com'

/**
 * Injects a production Content-Security-Policy meta tag.
 *
 * Only applied to builds: Vite's dev server relies on inline module scripts and
 * a websocket connection, so injecting the strict policy in dev would break HMR.
 */
const cspPlugin = (env: Record<string, string>): Plugin => ({
  name: 'notesify-csp',
  apply: 'build',
  transformIndexHtml(html) {
    const origins = new Set([FALLBACK_API_ORIGIN])
    try {
      if (env.VITE_API_URL) origins.add(new URL(env.VITE_API_URL).origin)
    } catch {
      // Relative API URLs are same-origin and already covered by 'self'.
    }

    const csp = [
      "default-src 'self' file:",
      "script-src 'self' file:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com file:",
      "img-src 'self' data: blob: https: file:",
      "font-src 'self' data: https://fonts.gstatic.com file:",
      `connect-src 'self' ${[...origins].join(' ')} https://fonts.googleapis.com https://fonts.gstatic.com https://api.cloudinary.com https://api.github.com`,
      "media-src 'self' blob: https: file:",
      "frame-src 'self' blob: https: file:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "manifest-src 'self'",
    ].join('; ')

    return html.replace(
      /(<meta charset=[^>]*>)/i,
      `$1\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`,
    )
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // Use relative path ONLY for desktop builds; use '/' for web to ensure nested routes (/shared/:slug) resolve assets correctly
    base: process.env.VITE_APP_TARGET === 'desktop' ? './' : '/',
    plugins: [react(), tailwindcss(), cspPlugin(env)],
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
    },
  }
})
