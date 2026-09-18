import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

function releasesApiPlugin(): Plugin {
  let cache: unknown = null;
  let lastFetch = 0;
  return {
    name: 'releases-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/releases')) {
          res.setHeader('Content-Type', 'application/json');
          const now = Date.now();
          if (cache && now - lastFetch < 5 * 60 * 1000) {
            res.end(JSON.stringify(cache));
            return;
          }
          try {
            const ghRes = await fetch('https://api.github.com/repos/badalsahani20/notesify/releases?per_page=10', {
              headers: {
                'User-Agent': 'Notesify-Vite-Dev-Proxy',
                Accept: 'application/vnd.github.v3+json',
              },
            });
            if (ghRes.ok) {
              const data = await ghRes.json();
              cache = data;
              lastFetch = now;
              res.end(JSON.stringify(data));
              return;
            }
          } catch {
            // fallback
          }
          if (cache) {
            res.end(JSON.stringify(cache));
            return;
          }
          next();
        } else {
          next();
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    releasesApiPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
