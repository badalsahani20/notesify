import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const FALLBACK_API_ORIGIN = 'https://api.notesify.in'

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

/**
 * Android WebView builds get a different `interactive-widget` value.
 *
 * With `resizes-visual` (the browser default) Chrome shrinks the visual
 * viewport and scrolls the page itself when an input is focused. That page
 * scroll stacks with the manual --keyboard-offset lift in useCapacitorApp(),
 * shifting everything up by a full keyboard height.
 *
 * `overlays-content` tells the WebView to leave the viewport alone, so the
 * manual offset is the only thing that moves. Browsers keep `resizes-visual`
 * because they derive the offset from visualViewport.
 *
 * Build-time (not an inline script) because production CSP forbids inline
 * scripts.
 */
const androidViewportPlugin = (mode: string): Plugin => ({
  name: 'notesify-android-viewport',
  apply: 'build',
  transformIndexHtml(html) {
    if (mode !== 'android') return html
    return html.replace(
      'interactive-widget=resizes-visual',
      'interactive-widget=overlays-content',
    )
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // Use relative path ONLY for desktop builds; use '/' for web to ensure nested routes (/shared/:slug) resolve assets correctly
    base: process.env.VITE_APP_TARGET === 'desktop' ? './' : '/',
    plugins: [react(), tailwindcss(), cspPlugin(env), androidViewportPlugin(mode)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('mermaid') || id.includes('cytoscape') || id.includes('d3') || id.includes('dagre')) {
                return 'vendor-diagrams';
              }
              if (id.includes('@tiptap') || id.includes('prosemirror')) {
                return 'vendor-tiptap';
              }
              if (id.includes('katex')) {
                return 'vendor-katex';
              }
              if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
                return 'vendor-charts';
              }
              if (id.includes('html2canvas') || id.includes('jspdf')) {
                return 'vendor-export';
              }
              if (id.includes('dexie')) {
                return 'vendor-db';
              }
              if (id.includes('lucide-react') || id.includes('@tabler')) {
                return 'vendor-icons';
              }
              if (
                id.includes('react') ||
                id.includes('react-dom') ||
                id.includes('react-router-dom') ||
                id.includes('zustand') ||
                id.includes('@tanstack') ||
                id.includes('framer-motion') ||
                id.includes('motion')
              ) {
                return 'vendor-framework';
              }
            }
          },
        },
      },
      chunkSizeWarningLimit: 900,
    },
  }
})
