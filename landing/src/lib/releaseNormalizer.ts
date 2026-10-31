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
    id: 393800000,
    version: 'v1.3.4',
    tagName: 'v1.3.4',
    name: '⚡ Notesify Desktop v1.3.4 — Autonomous Web Search, Tool Approval Cards & Live SVG Visuals',
    publishedAt: '2026-10-31T00:00:00Z',
    publishedDateFormatted: 'Oct 31, 2026',
    htmlUrl: 'https://github.com/badalsahani20/notesify/releases/tag/v1.3.4',
    body: `## ⚡ Notesify Desktop v1.3.4 — Autonomous Web Search, Tool Approval Cards & Live SVG Visuals\\n\\nNotesify v1.3.4 brings autonomous web research to the desktop workspace, interactive confirmation cards for safe note mutations, live vector SVG rendering, and 24-hour persistent prompt caching.\\n\\n### ✨ What's New\\n\\n- **Autonomous Web Search & Crawling** — Iris automatically decides when queries need live web facts or public URL crawling without requiring manual toggle switching.\\n- **Interactive Tool Approval Cards** — Note creation and deletion actions require explicit one-click confirmation before execution.\\n- **Live Vector SVG Visualizations** — Clean, sanitized architectural diagrams, schematics, and UI mockups rendered directly in chat responses.\\n- **24-Hour Temporal Prompt Caching** — Date-level temporal anchoring stabilizes system prompt prefixes for 24-hour windows, slashing AI response latency.\\n- **Universal Clipboard Integration** — Seamless copy actions across desktop windows with automatic fallback for unfocused document contexts.\\n- **Offline-First Resilience** — Uninterrupted note taking and flashcard testing with local Dexie storage and automatic reconciliation.`,
    highlights: [
      {
        title: 'Autonomous Web Search',
        tag: 'Live Web',
        description: 'Instant web retrieval and page crawling decided autonomously by Iris based on query context.',
      },
      {
        title: 'Interactive Tool Approvals',
        tag: 'Security',
        description: 'Client-side confirmation cards prevent unintended note creations and deletions.',
      },
      {
        title: 'Live SVG Rendering',
        tag: 'Visualization',
        description: 'High-contrast, sanitized vector graphics and architecture diagrams rendered directly in responses.',
      },
      {
        title: '24-Hour Prompt Caching',
        tag: 'Architecture',
        description: 'Ephemeral prompt caching cuts token overhead and latency on repeated chat sessions.',
      },
      {
        title: 'Offline-First Engine',
        tag: 'Local First',
        description: 'Full Dexie local persistence with optimistic concurrency and side-by-side visual conflict diffing.',
      },
      {
        title: 'Universal Clipboard',
        tag: 'Desktop UI',
        description: 'Reliable cross-window copying for code snippets and Markdown blocks.',
      },
    ],
    technicalNotes: [
      'Eliminated manual enableWeb toggling; Iris agent loop autonomously decides tool invocation with multi-key Exa/Parallel failover.',
      'Constructed client-side ToolApprovalCard component for bounded mutation verification.',
      'Integrated DOMPurify-based vector sanitizer for safe SVG rendering in dark mode.',
      'Stabilized OpenRouter KV prefix caching by switching from second-level timestamps to 24-hour ISO date anchors.',
      'Engineered copyToClipboard with document.execCommand fallback for Electron desktop windows.',
    ],
    assets: [
      {
        name: 'Notesify.Setup.1.3.4.exe',
        size: 104500000,
        sizeFormatted: '99.6 MB',
        downloadUrl: 'https://github.com/badalsahani20/notesify/releases/download/v1.3.4/Notesify.Setup.1.3.4.exe',
      },
    ],
  },
  {
    id: 393700000,
    version: 'v1.3.2',
    tagName: 'v1.3.2',
    name: '⚡ Notesify v1.3.2 — Inline Slash AI, Agentic Note Retrieval & 60 FPS Streaming',
    publishedAt: '2026-10-26T00:00:00Z',
    publishedDateFormatted: 'Oct 26, 2026',
    htmlUrl: 'https://github.com/badalsahani20/notesify/releases/tag/v1.3.2',
    body: `## ⚡ Notesify v1.3.2 — Inline Slash AI, Agentic Note Retrieval & 60 FPS Streaming\\n\\nThis release brings an instant, keyboard-first AI experience into the editor with Inline Slash commands, autonomous cross-note discovery via Iris, a velvety 60/120 FPS streaming engine, and an archival specimen callout design system.\\n\\n### ✨ What's New\\n\\n- **Inline Slash AI (\`/\`) & Palette** — Draft notes, continue writing, summarize, explain, or insert structural blocks directly at your cursor without leaving your keyboard.\\n- **Iris Agentic Note Search & Deep Retrieval (\`search_notes\` & \`get_note_content\`)** — Iris autonomously discovers, searches, and reads other notes directly from within the contextual panel or Global Chat for true cross-document intelligence.\\n- **Inline Ghost Review Bar** — Real-time in-document AI generation previews with immediate Accept (\`⌘/Ctrl + Enter\`), Discard (\`Esc\`), or Try Again controls.\\n- **60 FPS / 120 FPS Fluid Streaming Pipeline** — Velocity-timed reveal buffer completely eliminates token stutter and dropped frames while keeping historical chat at zero re-renders.\\n- **Streaming Mermaid Diagram Interception** — Intercepts midway diagram generation with an animated placeholder, compiling cleanly only upon block completion with resilient auto-repair parsing.\\n- **Archival Specimen Callouts** — Replaced generic side-striped alerts with archival specimen metadata bands and technical glyphs (\`※\`, \`▲\`, \`✦\`, \`Δ\`, \`↳\`).\\n- **Three-Tier AI Router** — Seamless selection across Fast (Qwen 3.7 Flash), Thinking (DeepSeek v4 Flash), and Pro (GLM 5.3 Flash) models with OpenRouter ephemeral prompt caching.`,
    highlights: [
      {
        title: 'Inline Slash AI (/)',
        tag: 'Editor AI',
        description: 'Instant command palette for AI drafting, summarizing, and structural block insertion right at the cursor.',
      },
      {
        title: 'Agentic Note Retrieval',
        tag: 'Workspace Intelligence',
        description: 'Iris searches and reads other workspace notes directly from the editor panel or Global Chat.',
      },
      {
        title: '60 FPS Streaming Engine',
        tag: 'Performance',
        description: 'Velocity-calibrated time-delta reveal buffer eliminates token jitter and dropped frames.',
      },
      {
        title: 'Streaming Mermaid Interception',
        tag: 'Visualization',
        description: 'Eliminates mid-stream compilation errors with an interactive card and resilient syntax auto-repair.',
      },
      {
        title: 'Specimen Callout System',
        tag: 'Design & Taste',
        description: 'Editorial workbench callouts with dedicated metadata header bands and technical specimen glyphs.',
      },
      {
        title: 'Three-Tier Model Router',
        tag: 'AI Orchestration',
        description: 'Fast (Qwen 3.7 Flash), Thinking (DeepSeek v4 Flash), and Pro (GLM 5.3 Flash) tiers with OpenRouter prompt caching.',
      },
    ],
    technicalNotes: [
      'Engineered search_notes and get_note_content agent tools with bounded multi-round execution and HTML sanitization.',
      'Engineered useStreamingTextStore to isolate active streaming tokens from global state arrays.',
      'Replaced ResizeObserver layout thrashing with native hardware-composited GPU scroll anchoring.',
      'Integrated velocity-calibrated time-delta pacing buffer to absorb bursty SSE chunks.',
      'Implemented custom markdown directive parser with AST block sanitization preventing HTML hydration errors.',
      'Container-aware compact mode in LiquidChatCompose automatically adjusts toolbar layout on narrow panels.',
    ],
    assets: [
      {
        name: 'Notesify.Setup.1.3.2.exe',
        size: 104200000,
        sizeFormatted: '99.4 MB',
        downloadUrl: 'https://github.com/badalsahani20/notesify/releases/download/v1.3.2/Notesify.Setup.1.3.2.exe',
      },
    ],
  },
  {
    id: 393600000,
    version: 'v1.3.1',
    tagName: 'v1.3.1',
    name: '🔍 Notesify v1.3.1 — Interactive Diff Viewer & Real-Time Conflict Sync',
    publishedAt: '2026-10-16T00:00:00Z',
    publishedDateFormatted: 'Oct 16, 2026',
    htmlUrl: 'https://github.com/badalsahani20/notesify/releases/tag/v1.3.1',
    body: `## 🔍 Notesify v1.3.1 — Interactive Diff Viewer & Real-Time Conflict Sync\n\nThis release delivers an intelligent, Git-style diffing experience for conflict resolution, paired with robust multi-tab editor synchronization and offline draft protection.\n\n### ✨ What's New\n\n- **Interactive Note Diff Viewer** — Inspect multi-device conflicts with hunk folding, 3-line context preservation, and a unified/split view toggle.\n- **Accurate Conflict Draft Snapshots** — Frozen drafts prevent concurrent autosaves from contaminating local changes during conflict resolution.\n- **Authoritative Online Reload Revalidation** — Reloading notes while connected automatically synchronizes the latest remote state without wiping local un-synced mutations.\n- **Live Cross-Tab Editor Sync** — Conflict resolutions broadcast live across browser sessions via BroadcastChannel, updating open TipTap editors in real time.`,
    highlights: [
      {
        title: 'Interactive Diff Viewer',
        tag: 'UI / UX',
        description: 'Context-aware hunk folding hides large unchanged blocks and isolates changed sentences.',
      },
      {
        title: 'Conflict Draft Snapshots',
        tag: 'Data Reliability',
        description: 'Guarantees the exact frozen draft captured at conflict time is rebased and preserved.',
      },
      {
        title: 'Authoritative Revalidation',
        tag: 'Sync Engine',
        description: 'Fetches latest cloud version on page reload while protecting active offline edits.',
      },
      {
        title: 'Cross-Tab Sync Channel',
        tag: 'Architecture',
        description: 'BroadcastChannel relays resolutions so open tabs update editor state instantly.',
      },
    ],
    technicalNotes: [
      'Implemented NoteDiffViewer using diffLines with 3-line context window and accordion chunk folding.',
      'ConflictResolutionService now consumes conflict.localDraft snapshot in resolveKeepMine.',
      'HybridNoteRepository.getNote revalidates against remoteAPI when online and no pending mutations exist.',
      'TipTap editor listens to notesify:conflict-resolved and BroadcastChannel to sync content live.',
    ],
    assets: [
      {
        name: 'Notesify.Setup.1.3.1.exe',
        size: 102500000,
        sizeFormatted: '97.7 MB',
        downloadUrl: 'https://github.com/badalsahani20/notesify/releases/download/v1.3.1/Notesify.Setup.1.3.1.exe',
      },
    ],
  },
  {
    id: 393500000,
    version: 'v1.3.0',
    tagName: 'v1.3.0',
    name: '⚡ Notesify v1.3.0 — AI Rate Limiting, Token Optimization & Tier Quotas',
    publishedAt: '2026-10-14T00:00:00Z',
    publishedDateFormatted: 'Oct 14, 2026',
    htmlUrl: 'https://github.com/badalsahani20/notesify/releases/tag/v1.3.0',
    body: `## ⚡ Notesify v1.3.0 — AI Rate Limiting, Token Optimization & Tier Quotas\n\nThis release introduces fair-use token budgeting, tiered daily quotas, sliding-window context compression, native LaTeX math rendering, and butter-smooth Iris panel transitions.\n\n### ✨ What's New\n\n- **Fair-Use AI Quotas & Concurrency Limiting** — Daily token tracking with UTC midnight auto-reset across Free (100k), Pro (500k), and Enterprise tiers, paired with concurrency guards.\n- **Token Consumption Optimization** — Token-budget sliding window (8,000 tokens) with multi-provider background summarization for older messages, slashing prompt overhead without sacrificing conversation depth.\n- **Dynamic Tool Gating** — Smarter tool resolution ensuring ask_question remains native while notes, tasks, and study workflows are strictly scoped to user intent.\n- **Native LaTeX Mathematics** — Iris now natively formats math equations in clean LaTeX notation for flawless KaTeX rendering.\n- **Silky-Smooth Iris Panel** — Guarded layout collapse and stable session sync eliminating Global Chat drawer stutter.`,
    highlights: [
      {
        title: 'Tiered Token Quotas & Reset',
        tag: 'Infrastructure',
        description: 'Automatic daily limits (100k Free, 500k Pro) with clean UTC midnight reset and concurrency guards.',
      },
      {
        title: 'Context Window Optimization',
        tag: 'Efficiency',
        description: '8,000-token sliding window with multi-provider background summarization to eliminate prompt bloat.',
      },
      {
        title: 'LaTeX Math Constitution',
        tag: 'Iris AI',
        description: 'Native inline and block LaTeX formatting tailored to KaTeX rendering in chat responses.',
      },
      {
        title: 'Stutter-Free Iris Drawer',
        tag: 'UI / UX',
        description: 'Refined responsive layout collapse and stable session routing eliminating panel opening lag.',
      },
    ],
    technicalNotes: [
      'Built-in rate limiter middleware with UTC midnight boundary reset and concurrency semaphore.',
      'Chat context resolver evaluates messages against an 8,000-token budget with 3-tier background summarization.',
      'Chat compose button gracefully disables with tooltip when daily quota is depleted.',
      'Resolved GlobalChatPage duplicate effect mount and AppLayout resize jitter.',
    ],
    assets: [
      {
        name: 'Notesify.Setup.1.3.0.exe',
        size: 102400000,
        sizeFormatted: '97.6 MB',
        downloadUrl: 'https://github.com/badalsahani20/notesify/releases/download/v1.3.0/Notesify.Setup.1.3.0.exe',
      },
    ],
  },
  {
    id: 393000000,
    version: 'v1.2.3',
    tagName: 'v1.2.3',
    name: '🧠 Notesify v1.2.3 — Agentic Learning Tasks, Native Protocol & Queue UI',
    publishedAt: '2026-10-04T16:00:00Z',
    publishedDateFormatted: 'Oct 4, 2026',
    htmlUrl: 'https://github.com/badalsahani20/notesify/releases/tag/v1.2.3',
    body: `## 🧠 Notesify v1.2.3 — Agentic Learning Tasks, Native Protocol & Queue UI\n\nThis release introduces autonomous learning milestones and practice queues for Iris, a permanent archive lifecycle for mastery tracking, native tool execution protocols, and composer streamlining.\n\n### ✨ What's New\n\n- **Agentic Learning Tasks Queue** — Iris can now create, track, and update concrete practice milestones that dock right above the chat composer with smooth spring animations.\n- **Permanent Archive Lifecycle** — Learning tasks transition smoothly from Pending → In Progress → Completed → Archived. No TTL deletions, retaining your full learning graph for future analytics.\n- **Native Function Calling Protocol** — Strict native assistant tool_calls and tool-result message schemas, eliminating text hallucinations.\n- **Streamlined Composer Bar** — Cleaner input footer with direct access to Study, Web, and Thinking modes while keeping keyboard slash-commands instant and responsive.`,
    highlights: [
      {
        title: 'Docked Learning Tasks Queue',
        tag: 'Agentic Tools',
        description: 'Interactive milestone queue floating directly above the chat composer for active practice tracking.',
      },
      {
        title: 'Permanent Learning Archive',
        tag: 'Learning Graph',
        description: 'Completed tasks graduate into a permanent archive for long-term mastery analytics without context bloat.',
      },
      {
        title: 'Native Tool Calling Protocol',
        tag: 'Iris AI',
        description: 'Native role: "tool" execution eliminating simulated text tags and improving model reliability.',
      },
      {
        title: 'Streamlined Composer Footer',
        tag: 'UI / UX',
        description: 'Cleaned-up composer footer with quick slash-commands preserved and dedicated mode toggles.',
      },
    ],
    technicalNotes: [
      'New LearningTask model with compound user indexes and decoupled active/history queries.',
      'Docked Queue UI built with native custom scrollbar and Framer Motion spring physics.',
      'Native tool execution in chatService.js with role: "tool" schemas.',
      'Cleaned up Tools button from composer bar while preserving / command palette.',
    ],
    assets: [
      {
        name: 'Notesify.Setup.1.2.3.exe',
        size: 100873011,
        sizeFormatted: '96.2 MB',
        downloadUrl: 'https://github.com/badalsahani20/notesify/releases/download/v1.2.3/Notesify.Setup.1.2.3.exe',
      },
    ],
  },
  {
    id: 392500000,
    version: 'v1.2.2',
    tagName: 'v1.2.2',
    name: '⚡ Notesify v1.2.2 — Streaming Iris, Interactive Tools & Citations',
    publishedAt: '2026-09-24T15:30:00Z',
    publishedDateFormatted: 'Sep 24, 2026',
    htmlUrl: 'https://github.com/badalsahani20/notesify/releases/tag/v1.2.2',
    body: `## ⚡ Notesify v1.2.2 — Streaming Iris, Interactive Tools & Citations\n\nThis release delivers an upgraded Iris chat experience featuring smooth streaming animations, interactive question dialogs, a collapsible AI reasoning/thought trace viewer, inline note citations, header navigation polish, and desktop application enhancements.\n\n### ✨ What's New\n\n- **Interactive Question Dialogs (\`ask_question\` Tool)** — Iris can now autonomously present rich interactive modals to quiz your knowledge, clarify ambiguous requests, gather preferences, or order priorities (single-choice, multi-select, and rank-ordering).\n- **Streaming Iris & Shimmer** — Real-time response streaming with animated shimmer indicators and responsive stream cancellation.\n- **AI Reasoning Viewer** — Collapsible thought trace viewer (\`ReasoningCollapsible\`) giving complete visibility into Iris's multi-step chain-of-thought.\n- **Inline Note Citations** — Interactive note references (\`[cite: noteId]\`) rendered directly in chat for one-click note inspection and modal preview.\n- **Header Navigation & Brand Link** — Application header logo now functions as a clean route link back to the workspace home.\n- **Native Desktop App (v1.2.2)** — Standalone DPI-aware Windows installer with bundled offline-safe assets and full IndexedDB synchronization.`,
    highlights: [
      {
        title: 'Interactive Ask Tool Dialogs',
        tag: 'Agentic Tools',
        description: 'Autonomous tool-driven quizzes, requirement clarification, and priority ranking modals directly in chat.',
      },
      {
        title: 'Real-time Streaming & Reasoning',
        tag: 'Iris AI',
        description: 'Streamlined assistant responses with thought traces, cancel controls, and animated status indicators.',
      },
      {
        title: 'Interactive Note Citations',
        tag: 'Notes Engine',
        description: 'Clickable inline citations linking conversation responses directly to your knowledge base.',
      },
      {
        title: 'Header Navigation & UI Polish',
        tag: 'UI / UX',
        description: 'Direct home navigation from the brand logo and updated application release info in Settings.',
      },
      {
        title: 'Native Windows Desktop Build',
        tag: 'Desktop App',
        description: 'DPI-aware standalone desktop installer with offline Dexie synchronization and local caching.',
      },
    ],
    technicalNotes: [
      'Autonomous ask_question tool schema with single-choice, multi-choice, and rank-priority modes.',
      'InteractivePromptDialog integration for graceful user-in-the-loop clarification without disrupting chat context.',
      'Collapsible ReasoningCollapsible UI for inspecting extended model thought chains.',
      'Robust citation regex resolver linking note references to workspace notes.',
      'Header brand component converted to React Router Link with bundled asset resolution.',
      'DPI-aware Windows desktop installer packaged via Electron Builder.',
    ],
    assets: [
      {
        name: 'Notesify.Setup.1.2.2.exe',
        size: 138358418,
        sizeFormatted: '~132 MB',
        downloadUrl: 'https://github.com/badalsahani20/notesify/releases/download/v1.2.2/Notesify.Setup.1.2.2.exe',
      },
    ],
  },
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
