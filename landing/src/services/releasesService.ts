import type { NormalizedRelease } from '../types/releases';
import { normalizeGitHubRelease, FALLBACK_RELEASES } from '../lib/releaseNormalizer';

const CACHE_KEY = 'notesify_releases_cache_v1';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedData {
  timestamp: number;
  releases: NormalizedRelease[];
}

let inMemoryCache: CachedData | null = null;

export async function fetchReleases(): Promise<NormalizedRelease[]> {
  // 1. Check in-memory cache
  const now = Date.now();
  if (inMemoryCache && now - inMemoryCache.timestamp < CACHE_TTL_MS) {
    return inMemoryCache.releases;
  }

  // 2. Check sessionStorage
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsed: CachedData = JSON.parse(stored);
        if (now - parsed.timestamp < CACHE_TTL_MS && Array.isArray(parsed.releases) && parsed.releases.length > 0) {
          inMemoryCache = parsed;
          return parsed.releases;
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  // 3. Attempt to fetch from landing server API (/api/releases)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('/api/releases', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const normalized = data.map(normalizeGitHubRelease);
        saveToCache(normalized);
        return normalized;
      }
    }
  } catch (err) {
    // Landing server API unavailable; proceed to direct fallback
  }

  // 4. Fallback: Direct GitHub API query
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const ghRes = await fetch('https://api.github.com/repos/badalsahani20/notesify/releases?per_page=10', {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    clearTimeout(timeout);

    if (ghRes.ok) {
      const ghData = await ghRes.json();
      if (Array.isArray(ghData) && ghData.length > 0) {
        const normalized = ghData.map(normalizeGitHubRelease);
        saveToCache(normalized);
        return normalized;
      }
    }
  } catch (err) {
    // Network or rate-limit issue; fall back to static snapshot
  }

  // 5. Ultimate safety net: bundled fallback release dataset
  return FALLBACK_RELEASES;
}

function saveToCache(releases: NormalizedRelease[]) {
  const cached: CachedData = {
    timestamp: Date.now(),
    releases,
  };
  inMemoryCache = cached;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    } catch {
      // Ignore storage quota errors
    }
  }
}
