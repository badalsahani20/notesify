# Notesify

A production-grade, full-stack notes application built on the MERN stack — featuring a professional rich-text editor, multi-provider AI orchestration, optimistic concurrency control, and banking-level authentication patterns.

**[Live Demo](https://notesify.in) · [GitHub](https://github.com/badalsahani20/notesify)**

<p align="center">
  <img src="./assets/dashboard.png" alt="Notesify Dashboard" width="100%">
</p>


---

## 🚀 What's New in v1.2.0

- **Bounded Agentic Loop:** Iris now supports a server-side, bounded agentic execution loop (`Round 1/3` → `Round 2/3`). When local editor context isn't enough, Iris can retrieve the complete active note, incorporate it into the conversation context, and continue reasoning in a single continuous SSE stream.
- **Contextual Document Retrieval (`get_note_content`):** Iris can now retrieve the complete active note on demand using its `noteId`. Retrieval is separated from note discovery, with user ownership enforcement and cleaned note content returned to the model.
- **Global Note Actions:** Iris can now create and update notes directly from Global Chat. You can ask Iris to create a new note or modify an existing one without manually switching into the note editor. **This feature is still being refined, so some note creation or update requests may not behave exactly as intended. We're actively working to improve its reliability and accuracy.**
- **Unified Minimalist Telemetry:** Replaced heavy cards and bordered telemetry with lightweight, consistent status indicators such as `Reading note...`, `Searching the web...`, `Reading webpage...`, and `Saving memory...`. Indicators automatically disappear when response text begins streaming.
- **Dynamic Teaching Mode & 3-Layer Constitution:** Streamlined Iris's system instructions into a token-efficient three-layer architecture, while adding dynamic intent-based routing between teaching-focused and general chat models.

### ⚙️ Technical Highlights
- On-demand full-note retrieval instead of injecting the entire document into every request.
- Strict `noteId`-based retrieval; note discovery remains a separate concern.
- Bounded tool execution with a maximum of 3 agentic rounds.
- Local editor context remains the first source of context, reducing unnecessary database retrieval.
- Continuous SSE streaming across tool execution rounds.

---

## 🚀 What's New in v1.1.0
- **Full Offline-First Capability (Packaged Desktop):** The Electron desktop client operates locally via bundled assets (`file://`) and Dexie / IndexedDB. Notes, notebooks, and state changes persist on disk offline with bidirectional queue synchronization and conflict-free reconciliation upon reconnection.
- **DPI-Aware Native Windows Installer:** Enhanced NSIS installer configuration with true Per-Monitor V2 DPI awareness, eliminating blurry text and interface scaling artifacts at 125%, 150%, and higher Windows display scaling settings.
- **Smart AI Session Title Generation:** Autonomous multi-turn title summarization for Global AI Chat. Automatically generates natural 3–6 word topic bookmarks (e.g. *"Offline-First Dexie Sync Plan"*) by filtering out filler words, transcript labels (`User:`, `Assistant:`), and user names.
- **Gemini 3.5 Flash Lite Integration:** Upgraded title generation and long-term conversation summarization to Google's ultra-fast `gemini-3.5-flash-lite`, delivering instant title synthesis and lower latency.
- **Zero-Flicker Safe Desktop Routing & Teardown:** Packaged desktop routing utilizes hash-aware navigation safeguards and declarative React Router routing on logout, preventing white screens, invalid `file://` navigations, and unauthenticated post-logout background sync triggers.

---

## 🚀 What's New in v1.0.3
- **Real-Time Web Search & Source Citations:** Global AI Chat features integrated live web browsing powered by OpenRouter + Exa (`openrouter:web_search` and `openrouter:web_fetch`). Includes real-time streaming telemetry (`● Searching the web for "<query>"`), automatic search keyword extraction from conversational prompts, and interactive source citation badges.
- **High-Performance Memory & Zero-Latency Routing:** Replaced per-message embedding generation and vector lookups with direct indexed memory retrieval (~1ms) and autonomous LLM tool calling (`save_memory`). Casual messages no longer suffer from unnecessary vector latency or false-positive note injections.
- **Smart Model Reasoning Configuration:** Native reasoning models (`z-ai/glm-5.3-flash`, `deepseek-r1`) maintain their required reasoning tokens, while high-speed conversational models (`qwen/qwen3.7-flash`) disable reasoning to eliminate system prompt reflections and deliver instant responses.
- **Enterprise-Grade Desktop Security (PKCE):** Completely overhauled Electron authentication. Google OAuth opens natively in the OS default browser with a memory-resident PKCE challenge, securely encrypting session tokens using Electron's `safeStorage` via an isolated IPC bridge.
- **AI Quiz State & Tool Call Persistence:** Interactive AI-generated quizzes (`render_quiz`) and tool telemetry are deeply integrated into Mongoose schemas and safely hydrated across page reloads and session switches.

---

## Architecture Highlights

These are the non-trivial engineering decisions behind Notesify — the things that separate it from a tutorial CRUD app.

### Offline-First Architecture & Dual Synchronization
Notesify desktop operates as an offline-first workspace powered by Dexie.js (IndexedDB) and an asynchronous mutation queue.
- **Local Read/Write Execution**: Notes and folders render and mutate locally in sub-millisecond time.
- **Safe State Reconciler**: Background sync queues push local changes and pull remote modifications with version-based OCC checks.
- **Zero-Blank Desktop Teardown**: Packaged Electron runs under `file://` with `HashRouter`. Authentication state teardown cleans local Dexie cache, safeStorage credentials, and React Query caches declaratively without triggering broken filesystem redirects.

### Optimistic Concurrency Control (OCC)
All core documents carry a `version` field. Every mutation from the client must include the current version. If another session modified the document in the meantime, the backend returns a `409 Conflict` — the frontend handles state-merging gracefully instead of silently overwriting data. Combined with TanStack React Query's optimistic UI, mutations feel instant while remaining safe under concurrent edits.

### Multi-Provider AI Orchestration
Iris AI routes requests dynamically across providers based on task type:

| Provider | Model | Use Case |
|---|---|---|
| OpenRouter | DeepSeek V4 Flash (`deepseek-v4-flash-0731`) | Primary brain for text, complex reasoning, and logic |
| OpenRouter | Qwen 3.7 Flash (`qwen3.7-flash`) | Default high-speed conversational chat |
| OpenRouter | GLM 5.3 Flash (`glm-5.3-flash`) | Native reasoning model and visualization diagrams |
| OpenRouter | Ling 3.0 Flash (`ling-3.0-flash`) | Quick operations and complex document analysis |
| OpenRouter | GPT-OSS 120B (`openai/gpt-oss-120b`) | Autonomous notes generation |
| Groq | OpenAI GPT-OSS 120B / 20B | High-speed fallback, conversation summarization, and title generation |
| Google Gemini | Gemini 3.5 Flash Lite (`gemini-3.5-flash-lite`) | High-speed conversation title generation & context summarization |

Cascading fallbacks ensure near-zero AI downtime: DeepSeek → Groq (GPT-OSS 120B) on failure, primary chat → Gemini on failure.

### Real-Time Web Search & Stream Telemetry
When web search is enabled, Iris leverages OpenRouter's integrated Exa search tools (`openrouter:web_search` and `openrouter:web_fetch`). The backend intelligently extracts clean search keywords from conversational queries, streams live status telemetry into the chat UI (`● Searching the web for "..."`), and automatically generates interactive citation badges with domain favicons and direct source URLs.

### Autonomous AI Memory & Long-Term Recall
Notesify features an autonomous Long-Term Memory architecture. Iris AI dynamically detects persistent facts, user preferences, tech stacks, and background details explicitly shared by the user, invoking the native `save_memory` function tool. Memories are indexed in MongoDB with automatic deduplication (similarity > 0.95) and vector embeddings for semantic recall. On chat queries, memories are retrieved via high-speed indexed lookups (~1ms) without incurring per-message embedding overhead, injecting relevant user context directly into the prompt.

### Production-Grade Authentication
Beyond standard JWT — Notesify implements:
- **Refresh token rotation** on every session renewal, limiting blast radius of a compromised token
- **Reuse detection** — replaying an old refresh token immediately revokes all active sessions for that user
- **5-device session capping** per user
- **3-tier email verification trust** — new users must verify, legacy accounts (pre-verification) are auto-trusted on login, Google OAuth users are pre-verified via OIDC
- **Social account linking** — Google signup automatically merges with an existing local account if emails match

### Self-Healing Redis Cache
Upstash Redis sits in front of all `GET /notes` and `GET /folders` requests, serving responses in sub-10ms. Mutations aggressively invalidate stale cache. If a cache drift is detected (404 on expected key), the system automatically re-fetches from MongoDB and re-seeds Redis — no manual intervention, no stale UI.

### SHA-256 Content-Hashed AI Caching
AI suggestions (Improve, Summarize, Grammar) are cached in MongoDB using a SHA-256 hash of the input text. Identical requests return cached results instantly — eliminating redundant LLM API calls and cutting AI feature costs.

### Token-Aware Conversation Management
Chat history beyond 40 messages triggers an automatic AI summarization task, compressing the conversation into a rolling "Context Snapshot." Old messages are purged, the snapshot is injected into the system prompt — preserving conversational memory without blowing token limits.

### Hybrid Search
MongoDB full-text indexing provides high-relevance ranking via linguistic scores. If indexed search returns no results (partial words, special characters), the system falls back to indexed case-insensitive regex — guaranteeing zero zero-result searches.

---

## Features

### Iris AI — Intelligent Writing Assistant

<img src="./assets/ai-assistant.png" alt="Iris AI Assistant" width="100%">

- **Inline Ghostwriter** — custom TipTap extension renders AI suggestions as faded ghost text before acceptance
- **Selection actions** — bubble menu on selected text: Improve, Summarize, Rewrite, Brainstorm
- **Grammar audit panel** — scans the entire note, surfaces fixes in a dedicated review panel
- **Multimodal chat** — attach images for visual analysis or OCR tasks

<img src="./assets/ai-chat.png" alt="Iris Global AI Chat" width="100%">

- **Streaming responses** — real-time token-by-token streaming via `ReadableStream`
- **Thinking UI** — real-time visualization of the AI's internal reasoning process via a dedicated thought-block widget
- **Live Web Search & Sources** — real-time web retrieval with live telemetry, intelligent search query extraction, and interactive source citations
- **Interactive Quizzes** — automatic quiz generation with instant scoring and persistent session state
- **Long-Term Memory** — autonomous fact and preference storage across conversations via `save_memory`
- **PDF Extraction Pipeline** — seamlessly attach `.pdf` textbooks; parsed instantly on the backend (`pdf-parse`) and injected into the LLM context
- **Context injection** — active note content injected into system prompt for context-aware responses

### Professional Editor (TipTap / ProseMirror)

<img src="./assets/editor.png" alt="Notesify Editor" width="100%">

- Markdown-style shortcuts for headers, lists, bold, italic
- Drag-and-drop / paste image upload → auto-hosted on Cloudinary
- Resizable tables, task lists, auto-detected language code blocks
- Custom font sizing, text alignment, and indentation controls

### Organisation
- Recursive nested notebooks (folders + sub-folders) with lazy loading
- Real-time note counts across folder hierarchy
- Favorites (pinned notes), soft-delete Trash with one-click restore or permanent deletion
- Command palette search across active notes, archived notes, and folder names — with real-time match highlighting, contextual snippets, and full keyboard navigation

### Performance
Diagnosed and resolved four production performance bottlenecks:

| Metric | Before | After |
|---|---|---|
| LCP | ~3.0s | ~1.7s |
| INP | ~0.30 | ~0.04 |
| CLS | 0.29 | 0.04 |
| Search | Laggy (per-keystroke regex) | Instant (Map-based O(1) cache) |

Key fixes: eliminated redundant `/users/me` auth waterfall (~1.6s scripting time), replaced Framer Motion `layoutId` with opacity/translate animations (~70% CPU reduction on mount), pre-computed searchable text into a Map.

---

## Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 (Vite) + TypeScript |
| Server state | TanStack React Query |
| UI state | Zustand |
| Styling | TailwindCSS + shadcn/ui + Lucide Icons |
| Routing | React Router v6 |
| Editor | TipTap (ProseMirror) + custom extensions |
| Animations | Framer Motion |
| Image hosting | Cloudinary (unsigned uploads) |

### Backend
| Layer | Technology |
|---|---|
| Framework | Node.js + Express |
| Database | MongoDB + Mongoose |
| Caching | Upstash Redis (REST API) |
| Auth | Passport.js + JWT |
| Email | Nodemailer |
| AI providers | OpenRouter, Groq, Google Gemini |

---

## Project Structure

```text
fullstack-notes/
├── backend/
│   ├── src/
│   │   ├── controllers/    # Express route handlers
│   │   │   ├── ai.controller.js
│   │   │   ├── auth.controller.js
│   │   │   ├── notes.controller.js
│   │   │   └── trash.controller.js
│   │   ├── middleware/     # Auth & error middlewares
│   │   │   ├── auth.middleware.js
│   │   │   ├── error.middleware.js
│   │   │   └── verified.middleware.js
│   │   ├── models/         # Mongoose schemas (OCC versioning)
│   │   │   ├── user.model.js
│   │   │   ├── notes.model.js
│   │   │   └── globalChatSession.model.js
│   │   ├── routes/         # Express API route definitions
│   │   ├── services/       # Core business & AI orchestration logic
│   │   │   ├── ai.service.js    # Multi-provider LLM routing + fallbacks
│   │   │   ├── mail.service.js  # Nodemailer HTML templating
│   │   │   └── notes.service.js
│   │   └── utils/          # Helpers (sanitization, diffing, summarization)
│   └── server.js           # API entry point
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ai/         # Iris AI message UI & results
│   │   │   ├── chat/       # Global AI chat panel
│   │   │   ├── editor/     # TipTap editor wrappers & toolbar
│   │   │   ├── folders/    # Folder tree & management
│   │   │   ├── search/     # Command palette (global search)
│   │   │   ├── ui/         # Glassmorphism & shadcn/ui primitives
│   │   │   ├── SideBar.tsx # Activity rail
│   │   │   └── TipTap.tsx  # Core editor logic
│   │   ├── extensions/     # TipTap custom extensions (AI ghost text, image)
│   │   ├── hooks/          # Domain-specific logic (useNotesQuery, useAiChat)
│   │   ├── store/          # Zustand state management
│   │   ├── pages/          # Main route components
│   │   ├── lib/            # Axios config & styling utilities
│   │   └── utils/          # Frontend helpers (HTML stripping, date formatting)
│   └── main.tsx            # React entry point
│
└── desktop/                # Electron / desktop-specific configuration
```

---

## Local Development Setup

### Prerequisites
- Node.js v18+
- MongoDB connection string
- Upstash Redis account
- Cloudinary account
- API keys: OpenRouter, Groq, Google Gemini

### 1. Clone the repository
```bash
git clone https://github.com/badalsahani20/notesify.git
cd notesify
```

### 2. Backend setup
```bash
cd backend
npm install
```

Create `.env` in `backend/`:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
OPENROUTER_API_KEY=your_openrouter_key
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
EMAIL_USER=your_smtp_email
EMAIL_PASS=your_smtp_password
MEMORY_SIMILARITY_THRESHOLD=0.75 # (Optional) Semantic search strictness, defaults to 0.75
```

```bash
npm run dev
```

### 3. Frontend setup
```bash
cd ../frontend
npm install
```

Create `.env` in `frontend/`:
```env
VITE_API_URL=http://localhost:5000/api
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset_name
```

```bash
npm run dev
```

### 4. Running Tests
The backend features an automated test suite utilizing Jest and `mongodb-memory-server` to test controllers and memory services without touching your production database.

```bash
cd backend
npm run test
```

---

*Built with focus on production patterns, reliability, and a fluid user experience.*
