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
      sourcemap: false,
      // Gzipping every chunk a second time is a large, pure-overhead memory spike.
      reportCompressedSize: false,
      rollupOptions: {
        maxParallelFileOps: 2,
        output: {
          // Only React core is pinned. Everything else must be left to Rollup:
          // manual chunks absorb shared helpers (vite/preload-helper, clsx, …),
          // which then makes every chunk statically import the whole bucket.
          manualChunks(id) {
            const pkg = id.replace(/\\/g, '/');
            if (/\/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(pkg)) {
              return 'vendor-react';
            }
          },
        },
      },
      chunkSizeWarningLimit: 900,
    },
  }
})
