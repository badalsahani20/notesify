import type { NormalizedRelease, ReleaseHighlight } from '../types/releases';

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `~${Math.round(mb)} MB`;
}

export function formatDate(isoString: string): string {
  if (!isoString) return 'Recent';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Recent';
  }
}

/**
 * Extracts bullet points formatted as `- **Title** — Description` or `* **Title** - Description`
 */
export function extractHighlights(body: string): ReleaseHighlight[] {
  if (!body) return [];

  const highlights: ReleaseHighlight[] = [];
  const lines = body.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    // Match "- **Title** — Description" or "* **Title** - Description"
    const match = trimmed.match(/^[-*]\s+\*\*([^*]+)\*\*\s*[—–-]\s*(.+)$/);
    if (match) {
      const title = match[1].trim();
      const description = match[2].trim();
      let tag = 'Feature';
      const lower = title.toLowerCase();

      if (lower.includes('agentic') || lower.includes('loop')) tag = 'Agentic AI';
      else if (lower.includes('retrieval') || lower.includes('context')) tag = 'Context Engine';
      else if (lower.includes('action') || lower.includes('global')) tag = 'Actions';
      else if (lower.includes('telemetry') || lower.includes('stream')) tag = 'Telemetry';
      else if (lower.includes('constitution') || lower.includes('routing')) tag = 'Architecture';
      else if (lower.includes('offline') || lower.includes('sync')) tag = 'Local First';
      else if (lower.includes('dpi') || lower.includes('installer') || lower.includes('desktop')) tag = 'Desktop UI';
      else if (lower.includes('security') || lower.includes('pkce') || lower.includes('auth')) tag = 'Security';
      else if (lower.includes('search') || lower.includes('web')) tag = 'Live Web';

      highlights.push({ title, tag, description });
    }
  }

  return highlights;
}

export function extractTechnicalNotes(body: string): string[] {
  if (!body) return [];
  const notes: string[] = [];
  const lines = body.split(/\r?\n/);
  let inNotesSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('###') && (trimmed.toLowerCase().includes('technical') || trimmed.toLowerCase().includes('notes') || trimmed.toLowerCase().includes('under the hood'))) {
      inNotesSection = true;
      continue;
    }
    if (inNotesSection && trimmed.startsWith('###') && !trimmed.toLowerCase().includes('notes')) {
      break;
    }
    if (inNotesSection && (trimmed.startsWith('-') || trimmed.startsWith('*'))) {
      const clean = trimmed.replace(/^[-*]\s+/, '').replace(/\*\*/g, '').trim();
      if (clean) notes.push(clean);
    }
  }

  return notes;
}

export function normalizeGitHubRelease(raw: any): NormalizedRelease {
  const body = raw.body || '';
  const assets = (raw.assets || []).map((asset: any) => ({
    name: asset.name,
    size: asset.size,
    sizeFormatted: formatBytes(asset.size),
    downloadUrl: asset.browser_download_url,
  }));

  const highlights = extractHighlights(body);
  const technicalNotes = extractTechnicalNotes(body);

  return {
    id: raw.id,
    version: raw.tag_name || 'v1.2.0',
    tagName: raw.tag_name || 'v1.2.0',
    name: raw.name || `Notesify ${raw.tag_name || 'v1.2.0'}`,
    publishedAt: raw.published_at || '',
    publishedDateFormatted: formatDate(raw.published_at),
    htmlUrl: raw.html_url || `https://github.com/badalsahani20/notesify/releases/tag/${raw.tag_name || 'v1.2.0'}`,
    body,
    highlights: highlights.length > 0 ? highlights : [
      {
        title: 'Bounded Agentic Loop',
        tag: 'Agentic AI',
        description: 'Server-side multi-round reasoning loop with continuous SSE streaming across tool rounds.',
      },
      {
        title: 'On-Demand Contextual Retrieval',
        tag: 'Context Engine',
        description: 'Retrieves complete note context strictly on-demand without stuffing entire documents into every prompt.',
      },
      {
        title: 'Global Note Actions',
        tag: 'Actions',
        description: 'Autonomously create and modify notes directly from Global Chat.',
      },
      {
        title: 'Unified Minimalist Telemetry',
        tag: 'Telemetry',
        description: 'Lightweight ephemeral status indicators that gracefully dissolve into streaming responses.',
      },
    ],
    technicalNotes: technicalNotes.length > 0 ? technicalNotes : [
      'Strict noteId-based contextual retrieval; note discovery remains a separate concern.',
      'Bounded tool execution with a deterministic maximum of 3 agentic rounds.',
      'Local editor context prioritized first, eliminating redundant database roundtrips.',
      'Continuous SSE streaming across tool execution rounds.',
    ],
    assets,
  };
}

// Built-in fallback snapshot if offline or GitHub API is unavailable
export const FALLBACK_RELEASES: NormalizedRelease[] = [
  {
    id: 391800000,
    version: 'v1.2.1',
    tagName: 'v1.2.1',
    name: '🎙️ Notesify v1.2.1 — STT Voice Dictation & Iris Polish',
    publishedAt: '2026-09-21T03:00:00Z',
    publishedDateFormatted: 'Sep 21, 2026',
    htmlUrl: 'https://github.com/badalsahani20/notesify/releases/tag/v1.2.1',
    body: `## 🎙️ Notesify v1.2.1 — STT Voice Dictation & Iris Polish\n\nThis release introduces integrated Speech-to-Text (STT) voice dictation, a streamlined conversation sidebar with instant in-place search, and desktop application enhancements.\n\n### ✨ What's New\n\n- **STT Voice Dictation** — Instant voice transcription in the Iris compose bar powered by OpenRouter Whisper Large V3 Turbo with automatic language detection.\n- **Refined Conversation Sidebar** — Clean, minimalist dark conversation history with instant in-place search and quick session switching.\n- **Uncapped Conversations** — Seamlessly navigate and load your full conversation history without artificial session limits.\n- **Native Desktop App (v1.2.1)** — Standalone DPI-aware Windows installer with full offline-first IndexedDB synchronization.`,
    highlights: [
      {
        title: 'STT Voice Dictation',
        tag: 'Voice Engine',
        description: 'Instant multi-lingual speech-to-text dictation directly inside the Iris compose bar powered by Whisper Large V3 Turbo.',
      },
      {
        title: 'Refined Iris Conversation Sidebar',
        tag: 'Chat UI',
        description: 'Sleek, minimalist dark conversation history with instant in-place search and quick session switching.',
      },
      {
        title: 'Native Windows Desktop Build',
        tag: 'Desktop App',
        description: 'DPI-aware standalone desktop installer with offline Dexie synchronization and local caching.',
      },
    ],
    technicalNotes: [
      'Seamless multi-language speech recognition with Whisper Large V3 Turbo auto-detection.',
      'Decoupled AudioRecorder browser client with MIME candidate negotiation.',
      'Full conversation history without artificial session caps.',
    ],
    assets: [
      {
        name: 'Notesify.Setup.1.2.1.exe',
        size: 138248899,
        sizeFormatted: '~131 MB',
        downloadUrl: 'https://github.com/badalsahani20/notesify/releases/download/v1.2.1/Notesify.Setup.1.2.1.exe',
      },
    ],
  },
  {
    id: 391336472,
    version: 'v1.2.0',
    tagName: 'v1.2.0',
    name: '🚀 Notesify v1.2.0 — Smarter Iris, Smarter Notes',
    publishedAt: '2026-09-18T09:03:29Z',
    publishedDateFormatted: 'Sep 18, 2026',
    htmlUrl: 'https://github.com/badalsahani20/notesify/releases/tag/v1.2.0',
    body: `## 🚀 Notesify v1.2.0 — Smarter Iris, Smarter Notes\n\nThis release brings a major upgrade to Iris, making her more capable of understanding your notes, taking actions, and retrieving information when the current editor context isn't enough.\n\n### ✨ What's New\n\n- **Global Note Actions** — Iris can now create and update notes directly from Global Chat.\n- **Bounded Agentic Loop** — Iris can now perform bounded multi-step reasoning with tool calls in a single continuous stream.\n- **On-Demand Contextual Retrieval** — Added \`get_note_content\`, allowing Iris to retrieve the complete active note only when available editor context is insufficient.\n- **Smarter Context Handling** — Iris prioritizes local editor context, keeping interactions fast and efficient.\n- **Minimalist AI Telemetry** — Reworked AI activity indicators into lightweight ephemeral status messages.\n- **Dynamic Teaching Mode** — Iris routes teaching requests to specialized models while maintaining high speed for general chats.\n- **3-Layer Iris Constitution** — Token-efficient separation of core constitution, tool contracts, and dynamic context.`,
    highlights: [
      {
        title: 'Bounded Agentic Loop',
        tag: 'Agentic AI',
        description: 'Iris executes a server-side multi-round reasoning loop (Round 1/3 → Round 2/3) in a single continuous SSE stream when local editor context is insufficient.',
      },
      {
        title: 'On-Demand Contextual Document Retrieval',
        tag: 'Context Engine',
        description: 'Rather than stuffing massive documents into every prompt, Iris retrieves the active note strictly on demand using its noteId with verified ownership checks.',
      },
      {
        title: 'Global Note Actions',
        tag: 'Direct Actions',
        description: 'Iris can autonomously draft, create, and modify notes directly from Global Chat without forcing you to switch back and forth into the note editor.',
      },
      {
        title: 'Unified Minimalist Telemetry',
        tag: 'Live Streaming',
        description: 'Replaced heavy bordered cards with lightweight ephemeral status indicators that vanish as response text begins streaming.',
      },
      {
        title: 'Dynamic Constitution & Intent Routing',
        tag: 'Architecture',
        description: 'Streamlined Iris into a token-efficient three-layer constitution with intelligent routing between high-speed conversation and pedagogical teaching mode.',
      },
    ],
    technicalNotes: [
      'Strict noteId-based contextual retrieval; note discovery remains a separate concern.',
      'Bounded tool execution with a deterministic maximum of 3 agentic rounds.',
      'Local editor context remains first priority, reducing unnecessary database roundtrips.',
      'Continuous SSE streaming across tool execution rounds without connection teardowns.',
    ],
    assets: [
      {
        name: 'Notesify.Setup.1.2.0.exe',
        size: 138252721,
        sizeFormatted: '~131 MB',
        downloadUrl: 'https://github.com/badalsahani20/notesify/releases/download/v1.2.0/Notesify.Setup.1.2.0.exe',
      },
    ],
  },
  {
    id: 390152696,
    version: 'v1.1.0',
    tagName: 'v1.1.0',
    name: '🚀 Notesify v1.1.0 — Offline-First Desktop & Sync',
    publishedAt: '2026-09-16T18:07:26Z',
    publishedDateFormatted: 'Sep 16, 2026',
    htmlUrl: 'https://github.com/badalsahani20/notesify/releases/tag/v1.1.0',
    body: 'Offline-First Workspace with Dexie IndexedDB and NSIS DPI-Aware native Windows installer.',
    highlights: [
      {
        title: 'Full Offline-First Workspace',
        tag: 'Local First',
        description: 'Desktop client operates locally via bundled assets and Dexie IndexedDB with bidirectional sync.',
      },
      {
        title: 'DPI-Aware Native Windows Installer',
        tag: 'Desktop UI',
        description: 'NSIS installer configured with Per-Monitor V2 DPI awareness, eliminating blurry scaling artifacts.',
      },
      {
        title: 'Smart AI Session Title Generation',
        tag: 'AI Navigation',
        description: 'Autonomous multi-turn title summarization for Global Chat powered by Gemini 3.5 Flash Lite.',
      },
    ],
    technicalNotes: [
      'Bidirectional mutation queue with version-based OCC checks on reconnection.',
      'Declarative state teardown clearing IndexedDB cache and safeStorage keys.',
    ],
    assets: [
      {
        name: 'Notesify.Setup.1.1.0.exe',
        size: 138252404,
        sizeFormatted: '~131 MB',
        downloadUrl: 'https://github.com/badalsahani20/notesify/releases/download/v1.1.0/Notesify.Setup.1.1.0.exe',
      },
    ],
  },
  {
    id: 344902391,
    version: 'v1.0.2',
    tagName: 'v1.0.2',
    name: 'Release v1.0.2 - Native PKCE Security & AI Stability Fixes',
    publishedAt: '2026-06-25T18:30:58Z',
    publishedDateFormatted: 'Jun 25, 2026',
    htmlUrl: 'https://github.com/badalsahani20/notesify/releases/tag/v1.0.2',
    body: 'Native OS Browser PKCE flow with DPAPI/Keychain safeStorage encryption.',
    highlights: [
      {
        title: 'Enterprise-Grade PKCE Authentication',
        tag: 'Security',
        description: 'Google OAuth opens natively in the OS browser with deep linking and safeStorage encrypted tokens.',
      },
      {
        title: 'Quiz State Persistence',
        tag: 'AI Stability',
        description: 'AI-generated interactive quizzes hydrated across page reloads and session switches.',
      },
    ],
    technicalNotes: [
      'Native reasoning token retention for reasoning models.',
    ],
    assets: [
      {
        name: 'Notesify.Setup.1.0.2.exe',
        size: 127867852,
        sizeFormatted: '~121 MB',
        downloadUrl: 'https://github.com/badalsahani20/notesify/releases/download/v1.0.2/Notesify.Setup.1.0.2.exe',
      },
    ],
  },
];
