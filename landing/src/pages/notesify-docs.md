# Notesify Documentation

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [The Editor](#the-editor)
4. [Iris AI & Agentic Tools](#iris-ai--agentic-tools)
5. [Active Study Tools (Quizzes & Flashcards)](#active-study-tools-quizzes--flashcards)
6. [Offline-First Architecture & Desktop App](#offline-first-architecture--desktop-app)
7. [Organisation](#organisation)
8. [Search](#search)
9. [Sharing Notes](#sharing-notes)
10. [Security & Authentication](#security--authentication)
11. [Multi-Device & Conflict Safety](#multi-device--conflict-safety)
12. [Performance](#performance)
13. [Self-Hosting](#self-hosting)

---

## Introduction

Notesify is a focused writing environment with an AI assistant built in. The philosophy is simple: the editor stays quiet and out of your way, and Iris — the AI — only shows up when you invite it.

Under the hood, Notesify is a production-grade MERN stack application with multi-provider AI orchestration, optimistic concurrency control, and robust, secure authentication.

**Live app:** [notesify.in](https://notesify.in) 

---

## Getting Started

### Create an account

Sign up with an email and password, or continue with Google. Google accounts are pre-verified via OIDC — no email confirmation step required. If you sign up with Google using an email that already has a local Notesify account, the two are automatically merged into one.

Email/password accounts require a one-time verification before you can sign in.

### Your first note

Once logged in, click **New Note** in the sidebar. The editor opens immediately — start typing. Notesify auto-saves as you write, so there is no save button.

---

## The Editor

Notesify's editor is built on TipTap (ProseMirror) — the same foundation used by Notion, Linear, and Loom. It is a rich-text editor that feels like writing in a document but stores structured content underneath.

### Formatting

Markdown-style shortcuts work as you type:

- `#`, `##`, `###` for headings
- `-` or `*` for bullet lists
- `1.` for numbered lists
- `**bold**`, `_italic_`
- `` ` `` for inline code, triple backtick for a code block

The toolbar at the top of the editor covers everything else: font size, text alignment, indentation, and highlights.

### Code blocks

Language is auto-detected as you type — no need to specify it manually. Syntax highlighting applies immediately.

### Tables

Insert a table from the toolbar. Tables are native markdown — they stay clean, resize correctly, and never break your structure when you edit them.

### Images

Drag an image into the editor or paste it directly. It uploads automatically to Cloudinary and embeds inline. No manual hosting required.

### Task lists

Create checkboxes with `[ ]` syntax or from the toolbar. Check them off inline without leaving the editor.

### Automatic title

When you start writing a new note, Iris generates a meaningful title from your content automatically. Your note list stays organised without you having to name anything.

---

## Iris AI & Agentic Tools

Iris is Notesify's context-aware AI assistant. It understands your active note, can research across your entire workspace, and only activates when invoked — never interrupting your writing flow.

Under the hood, Iris routes requests dynamically across specialized models configured in the multi-provider orchestrator:

| UI Tier / Mode | Model Identifier | Provider | Architecture Role & Use Case |
|---|---|---|---|
| **Thinking** | `deepseek/deepseek-v4-flash-0731` | OpenRouter | Primary reasoning engine for complex logic, multi-step deduction, and deep research |
| **Pro** | `z-ai/glm-5.3-flash` | OpenRouter | Default Chat & Pro mode, vision analysis, teaching, and complex analysis |
| **Fast** | `qwen/qwen3.7-flash` | OpenRouter | Fast mode, ultra-low latency queries, and structured note generation |
| **Inline Polish** | `inclusionai/ling-3.0-flash` | OpenRouter | Inline grammar, rewrite, and text improvement actions |
| **Auto-Titling** | `meta-llama/llama-3.1-8b-instruct` | OpenRouter | High-speed background title generation for new notes |
| **Fallback** | `openai/gpt-oss-120b` & `20b` | Groq / OpenRouter | High-throughput strong and lightweight cascading fallbacks |
| **Extraction** | `gemini-3.5-flash-lite` | Google Gemini | High-speed PDF text parsing, content extraction, and summarization |

Cascading fallbacks ensure near-zero AI downtime. This multi-tiered routing is completely seamless — you always interact with a single, unified Iris persona.

### Agentic Workspace Tools

Unlike standard chat interfaces that only see the currently opened document, Iris in v1.3.2 functions as an agentic assistant with autonomous tool access:

- **`search_notes(query)`**: When you ask a broad question ("Where did I write down the system architecture?"), Iris automatically queries your entire notes database to find candidate notes.
- **`get_note_content(noteId)`**: Iris inspects the full text of relevant candidate notes before synthesizing a complete, citation-backed answer.
- **`create_note(title, content, tags)`**: Iris can generate structured study guides, project roadmaps, or research summaries and save them directly as new notes in your library.

### Inline Slash AI (`/`)

Type `/` on any blank line inside the editor to open the inline command menu. Choose from pre-configured actions (draft note, generate outline, explain concept, summarize) or type a custom prompt. Iris streams ghost-text directly into your note canvas, which you can accept with Tab or reject with Escape.

### Interactive Mermaid Architecture Diagrams

Iris natively detects architectural flows, sequence diagrams, and class charts. Instead of outputting raw text, Iris renders high-resolution, zoomable Mermaid diagrams inline in your chat conversation, complete with dark-mode styling and node interaction.

### Bubble menu (inline actions)

Select any text in the editor. A floating menu appears immediately above your selection with formatting options and AI actions. No shortcut or click required — selection is the trigger.

Available AI actions on selected text:

- **Improve** — rewrites the selection for clarity, grammar, and flow
- **Summarize** — condenses the selection into key points
- **Rewrite** — rephrases with different wording while preserving meaning
- **Brainstorm** — expands the selection into related ideas
- **Continue** — continues your thought from where the selection ends

### Ghost text & inline suggestions

When you run an AI action (Improve, Continue, etc.), the result is injected into the editor as ghost text — visually distinct from your regular content. An **AI Suggestion** widget appears inline with two options:

- **Accept** — merges the suggestion into your document as normal text
- **Reject** — discards the suggestion entirely, restoring your original

Your document is never modified until you explicitly accept.

### Chat panel

For longer conversations, questions, or research tasks, open the full Iris chat panel.

- **Desktop:** Click the **Ask AI** button in the top-right editor header
- **Mobile:** Tap the floating **Ask AI** button at the bottom of the screen

The chat panel slides in alongside the editor. Iris has full context of your active note and responds accordingly.

**What you can do in chat:**

- Ask questions about your note content or across your entire workspace
- Request rewrites, summaries, or expansions of entire sections
- Attach images for visual analysis or OCR
- Attach PDF files — Notesify parses them on the backend and injects the content into Iris's context
- Research topics in real time — Iris can browse documentation and URLs and return clean, usable answers

**Streaming:** Responses appear token by token in real time at 60 FPS. You can see Iris's reasoning process via a live Thinking indicator before the final answer arrives.

**Conversation memory:** Chat history is managed through an intelligent token-budget sliding window. Active history is maintained within an 8,000-token allowance; older messages that exceed this budget are automatically consolidated via a multi-provider background summarizer into a rolling technical context snapshot, preserving continuous context without hitting token limits or clipping verbose code.

### AI suggestion caching

Improve, Summarize, and Grammar actions on identical text return cached results instantly. Repeated requests on the same content never make a redundant API call.

---

## Active Study Tools (Quizzes & Flashcards)

Notesify bridges note-taking with active recall. Transform passive notes into interactive study sessions:

### Spaced-Repetition Flashcards
- Generate flashcard decks directly from your document notes with a single click.
- Review decks with flip animations, rating your confidence to prioritize challenging concepts.
- Seamlessly synchronize review progress across devices.

### AI-Generated MCQ Quizzes
- Automatically extract key concepts into multiple-choice quizzes with distractor options and instant explanations.
- Test retention after writing or studying long technical documents.

---

## Offline-First Architecture & Desktop App

Notesify's Windows desktop application (and modern web client) is engineered with local-first reliability:

- **Zero-Latency Local Workspace**: Read, edit, and organize notes completely offline. Edits persist on your machine's disk without network lag.
- **Ordered Mutation Queue**: Offline actions (create, edit, delete, reorder) are queued in local persistent storage.
- **Dual Reconciler**: When your internet connection returns, Notesify's background synchronizer automatically drains the mutation queue and reconciles state with the cloud.
- **Optimistic Concurrency Control (OCC)**: Version-based hashing prevents stale updates from silently overwriting newer server changes, providing visual diff resolution if a true conflict arises.

---

## Organisation

### Folders

Create folders and sub-folders to any depth. Each folder shows a live note count. Sub-folders load lazily — the tree does not fetch everything upfront.

### Favorites

Star any note to pin it. Starred notes appear at the top of your note list for quick access.

### Trash

Deleted notes go to Trash, not permanent deletion. Restore a note in one click, or permanently delete it when you are ready. The editor is never a destructive environment by default.

---

## Search

### In-panel search

A search bar at the top of the notes panel filters your current folder view in real time.

### Command palette

Open the global command palette to search across all your notes, archived notes, and folder names simultaneously. Results include contextual snippets and real-time match highlighting. Full keyboard navigation — no mouse required.

Notesify's search is hybrid: full-text indexing provides high-relevance ranked results for complete words. If your query contains partial words or special characters, the system falls back to indexed regex search automatically. You will never hit a zero-result page.

---

## Sharing Notes

Notes can be shared via a secure, self-expiring link. Shared links are cached globally — recipients outside your account get near-instant load times regardless of location.

Sharing controls (set expiry, revoke access) are available from the editor header.

---

## Security & Authentication

Notesify implements authentication patterns typically found in financial applications, not note-taking apps.

### JWT with refresh token rotation

Every session uses a short-lived access token paired with a refresh token. On each session renewal, the refresh token is rotated — a new one is issued and the old one is invalidated immediately. This limits the damage window if a token is ever compromised.

### Reuse detection

If an old (already-rotated) refresh token is replayed — which would indicate token theft — Notesify immediately revokes **all active sessions** for that account. Every device is signed out.

### Session limits

A maximum of 5 active sessions are allowed per account. Signing in on a sixth device signs out the oldest session automatically.

### Email verification

New accounts require email verification before sign-in. Existing legacy accounts are auto-trusted on login. Google OAuth accounts are pre-verified via OIDC — no extra step needed.

### Password security

Passwords are hashed with bcrypt before storage. Plain-text passwords are never stored or logged anywhere.

---

## Multi-Device & Conflict Safety

Notesify is safe to have open on multiple devices simultaneously. Edits never silently overwrite each other.

Every note carries a version number. When you save, your request includes the version you last saw. If another device saved a newer version in the meantime, the server returns a conflict response instead of applying your change blindly. The frontend surfaces this gracefully — your content is never lost.

This pattern is called Optimistic Concurrency Control (OCC). It is the same approach used in production database systems to handle concurrent writes safely.

---

## Performance

Notesify's backend serves note and folder requests through a self-healing Redis cache (Upstash). Most read requests return in under 10ms. Cache invalidation happens automatically on every write — you never see stale data.

If a cache drift occurs (an expected key is missing), the system re-fetches from MongoDB and re-seeds the cache without any manual intervention.

### Measured frontend performance

| Metric | Before optimisation | After optimisation |
|---|---|---|
| LCP (Largest Contentful Paint) | ~3.0s | ~1.7s |
| INP (Interaction to Next Paint) | ~0.30s | ~0.04s |
| CLS (Cumulative Layout Shift) | 0.29 | 0.04 |
| Search responsiveness | Laggy (per-keystroke regex) | Instant (O(1) Map cache) |

---

## Self-Hosting

Notesify can be run locally. You will need:

- Node.js v18+
- A MongoDB connection string
- An Upstash Redis account
- A Cloudinary account
- API keys for Groq, Google Gemini, and OpenRouter

Full setup instructions are available in the [GitHub repository](https://github.com/badalsahani20/notesify).

---

*Notesify is currently in public preview. Free to use, no credit card required.*
