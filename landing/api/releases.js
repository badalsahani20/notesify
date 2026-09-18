// Serverless API endpoint for Vercel: /api/releases
let memoryCache = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const now = Date.now();
  if (memoryCache && now - lastFetchTime < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(memoryCache);
  }

  try {
    const ghResponse = await fetch('https://api.github.com/repos/badalsahani20/notesify/releases?per_page=10', {
      headers: {
        'User-Agent': 'Notesify-Landing-Release-Proxy',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!ghResponse.ok) {
      if (memoryCache) {
        // Serve stale on error
        return res.status(200).json(memoryCache);
      }
      return res.status(ghResponse.status).json({
        error: `GitHub API error: ${ghResponse.statusText}`,
      });
    }

    const data = await ghResponse.json();
    memoryCache = data;
    lastFetchTime = now;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (error) {
    if (memoryCache) {
      return res.status(200).json(memoryCache);
    }
    return res.status(500).json({ error: error.message || 'Failed to fetch releases' });
  }
}
