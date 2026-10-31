# Release Notes

Detailed release history for Notesify. For the product overview, see the [README](../readme.md).

---

## 🚀 What's New in v1.3.4

### 🌐 Always-On Autonomous Web Search (No Manual Toggle)
- **Zero-Friction Web Retrieval:** Removed the manual web search toggle button from the chat composers. Web search (`search_web`) and page crawler (`crawl_url`) tools are now continuously available by default.
- **Autonomous Intent Gating:** Iris decides dynamically whether an answer requires real-time facts, documentation crawling, or external verification, eliminating tedious manual switches.
- **Resilient Multi-Key Provider Failover:** Automatic fallback pipeline (Exa $\to$ Parallel $\to$ OpenRouter) rotates active API keys on rate limits or quota errors without breaking active chat streams.

### 🛡️ Interactive Tool Approval & Safe Workspace Mutations
- **Client-Side Confirmation Cards (`<ToolApprovalCard />`):** Notes are no longer created or removed autonomously in the background. Iris now proposes actions through interactive, rich approval cards where users can review draft titles, content previews, and approve or reject note creations and deletions with a single click.
- **Agentic `delete_note` Tooling:** Iris can now move notes to the trash upon explicit request with strict Optimistic Concurrency Control (OCC) version validation.
- **Stream-Safe Tool Signaling:** Enhanced `IrisStreamHandler` to emit structured SSE tool calls for instant UI confirmation without breaking real-time token streaming.

### 🎨 Live SVG Rendering & Safe Vector Visualizations
- **Sanitized Vector Graphics (`<SvgPreviewCard />`):** Iris can now output rich, responsive SVGs (architecture schematics, infographics, visual mockups) styled specifically for Notesify's dark aesthetic.
- **Streaming SVG Placeholder:** Mid-generation vector blocks render an animated loading state and compile safely on block completion via strict `DOMPurify` sanitization.

### ⚡ 24-Hour Temporal Anchor & Ephemeral Prompt Cache Optimization
- **Cache-Friendly Temporal Context:** Replaced dynamic second-level timestamps with an ISO date-only anchor (`Today's date: YYYY-MM-DD (Asia/Kolkata)`).
- **Persistent Prefix Caching:** Injected the anchor directly into Iris's base constitution (`messages[0]`) tagged with `cache_control: { type: "ephemeral" }`. The prompt prefix remains byte-identical for full 24-hour windows, delivering high OpenRouter/Anthropic KV prompt cache hit rates and slashing token latency on repeated queries.

### 📋 Universal Clipboard Pipeline (`copyToClipboard`)
- **Resilient Fallback Engine:** Added a dual-mode clipboard helper supporting `navigator.clipboard` with an automatic `document.execCommand('copy')` fallback for Android WebViews, Electron desktop, and unfocused document contexts.
- **Accurate Copy Feedback:** Selection toolbars and streaming response code blocks now only display success checkmarks when the text is authoritatively written to the system clipboard.

### 📱 Android & Mobile Polish
- **Mobile Header Drawer Toggle:** Replaced static brand logo with the 3-line hamburger layout icon (`Menu`) on Android and mobile viewports for quick sidebar navigation.
- **Dynamic Editor Sizing:** Fixed responsive font size and line spacing in mobile viewports by binding `.ProseMirror` rules directly to user settings CSS variables.
- **FAB Layering:** Adjusted mobile create button z-index and elevated What's New modal z-index to eliminate visual clipping.
- **Settings Visuals:** Upgraded active selection chips in Settings $\to$ Editor to high-contrast solid white (`bg-white text-zinc-950`).
- **Capacitor Alignment:** Synchronized devDependencies `@capacitor/android` and `@capacitor/cli` to `^8.6.0` to match `@capacitor/core@8.6.0`.


---

For previous updates, see the [commit history](../../commits/main/).

---

## 📜 Previous Release Highlights

<details>
<summary><b>v1.3.3 Release Notes</b></summary>

### 📄 Offline-First PDF Export & Native Android Share Sheet
- **Isolated Offscreen DOM Rendering:** Introduced a dedicated PDF rendering pipeline that creates an isolated DOM clone without disturbing the live editor state.
- **Print-Optimized Layouts:** Added print-specific typography, metadata headers, and improved spacing for cleaner, more professional PDF exports.
- **Code & Table Formatting:** Improved wrapping for code blocks and tables to preserve readability in exported documents.
- **Mermaid Diagram Support:** Export Mermaid diagrams as vector graphics for crisp, high-quality output.
- **Native Android Sharing:** Integrated Android's native share sheet for sharing exported PDFs with other apps.

### 🎨 UI/UX Improvements
- **Refined Interface:** Improved the overall visual design for a cleaner, more consistent user experience.
- **Enhanced Readability:** Fine-tuned typography and spacing for better content readability.
- **Responsive Layouts:** Improved the interface across different screen sizes and devices.

### ⚡ Performance Improvements
- **Faster Loading:** Optimized application startup for a quicker experience.
- **Smoother Navigation:** Refined interactions to improve overall responsiveness.

### 📱 Notesify for Android — In Testing
The Notesify Android app is currently in the testing phase as I continue refining the native mobile experience and addressing performance and usability issues.

> **Note:** The Android app is not yet publicly released. A wider release will be announced when it's ready.

</details>

<details>
<summary><b>v1.3.2 Release Notes</b></summary>

- **Inline Slash AI (`/`) & Smart Boundary Palette:** Type `/` anywhere in the note editor to trigger the interactive command palette with both AI assist and block tools:
  - **AI Generation Commands:** `/draft` (*Draft with Iris AI*), `/continue` (*Continue Writing*), `/summarize` (*Summarize Note*), and `/explain` (*Explain Note*).
  
- **Inline Ghost Review Bar (`<InlineAiReviewBar />`):** Generated prose and code streams directly into the active editor position wrapped in subtle ghost styling. An anchored floating review bar gives instant one-click controls: **Accept** (`⌘/Ctrl + Enter`), **Discard** (`Esc`), or **Try Again** with zero modal disruption.
- **Iris Agentic Note Search & Cross-Document Retrieval (`search_notes` & `get_note_content`):** Iris can now autonomously search and read notes across your entire workspace:
  - **Contextual Panel Cross-Referencing:** While working inside an active note, ask Iris to reference, compare, or synthesize insights from any other note in your collection without leaving the editor or manually copying content.
  - **Global Chat Workspace Intelligence:** From Global Chat, Iris searches through all your notes, retrieves full content by title or ID, and answers complex queries grounded directly in your personal knowledge base.
  - **Bounded Native Tool Execution:** Uses strict schema-driven native tool calling with HTML stripping, contextual snippet ranking, and deterministic execution bounds to prevent infinite loops.
- **60 FPS / 120 FPS Fluid AI Streaming Pipeline:** Re-engineered the chat streaming engine from network ingestion to DOM painting, eliminating micro-stutters and dropped frames:
  - **Velocity-Calibrated Time-Delta ($dt$) Pacing:** Dynamic reveal buffer synchronized with `performance.now()` and monitor refresh rates (16.6ms @ 60Hz, 8.3ms @ 120Hz). Absorbs bursty SSE network chunks and interpolates characters continuously with zero artificial lag or surrogate pair slicing.
  - **Isolated Transient Store (`useStreamingTextStore`):** Decoupled high-frequency active tokens from global Zustand message arrays. Historical chat messages stay at zero re-renders while only the active message bubble repaints at 60 FPS.
  - **Native GPU Scroll Anchoring (`[overflow-anchor:auto]`):** Replaced JavaScript `ResizeObserver` layout recalculations with hardware-composited scroll pinning, eliminating forced reflows and layout thrashing.
- **Mermaid Diagram Streaming Interception & Resilient Compilation:**
  - **Incomplete Diagram Interception:** Catches unclosed ```` ```mermaid ```` code blocks during active streaming, replacing partial syntax with an animated, non-flickering Iris loading card (*"Generating diagram... Please wait while the visualization compiles"*).
  - **Single-Pass Compilation on Block Close:** Diagram compilation is held back until the closing delimiter arrives, completely eliminating midway syntax errors and broken red error banners.
  - **Automatic Grammar Sanitization & Fallback Engine:** Auto-quotes multi-word subgraph titles (`subgraph "Input Layer"`), mathematical edge labels (`|"z = Σ(w*x) + b"|`), and node labels with parentheses. Includes a resilient fallback parser that automatically cleans conflicting style tags if an initial compile fails.
- **Floating AI Result Inspector (`<AiResultDialog />`):** Replaced static dialog modals with a non-blocking, draggable floating inspector card:
  - **Phone-Optimized Compact Mode:** On mobile viewports (`max-width: 640px`), locks into a streamlined draggable card with touch-safe header controls, keeping the document fully legible underneath.
  - **Spacious Desktop Reading Drawer:** Optional desktop expand toggle opens an 820px wide reading canvas for complex Markdown tables and multi-file code blocks.
  - **Clean Action Hierarchy:** Primary **Insert at cursor** / **Replace selection** (with signature blue/emerald styling and `↵` shortcut), **Copy**, and top-right dismissal without redundant duplicate controls.
- **Architectural Specimen Callouts:** Replaced generic 2018 side-striped alerts with an archival specimen aesthetic for markdown directives (`:::tip`, `:::warning`, `:::note`, `:::caution`, `:::details`). Features dedicated specimen metadata header bands, tactile technical glyphs (`※ INSIGHT`, `▲ CAUTION`, `✦ METHOD`, `Δ REVISION`, `↳ TAKEAWAY`), and AST paragraph-splitting that eliminates React DOM hydration errors.
- **Three-Tier AI Orchestration (Fast, Thinking, Pro):**
  - **Fast:** Instant answers for everyday writing and quick queries.
  - **Thinking:** In-depth reasoning and multi-step deduction for complex challenges.
  - **Pro:** Maximum capability for multifaceted research, vision tasks, and comprehensive analysis.
- **Ergonomic & Container-Aware Chat Composer (`<LiquidChatCompose />`):**
  - **Dynamic Compact Mode:** Container-aware `ResizeObserver` detects constrained horizontal widths, locking the toolbar into a tidy single-row layout when note list, editor, and contextual AI panel are co-open.
  - **Clean Action Hierarchy:** High-contrast white typography, solid white active toggles (Web Search), and intuitive thumb-reachable voice dictation button.
- **OpenRouter Ephemeral Prompt Caching (`cache_control`):** Split static system instructions from dynamic document context across all AI assist actions (`summarize`, `explain`, `rewrite`, `continue`, `noteCreation`, `grammar`). Static prompt prefixes are tagged with `cache_control: { type: "ephemeral" }`, leveraging OpenRouter KV prefix caching to slash response latency and token costs on repeated note operations.

</details>

<details>
<summary><b>v1.3.1 Release Notes</b></summary>

- **Interactive Diff Viewer with Context Hunk Folding:** Replaces full-text conflict comparisons with a dedicated `<NoteDiffViewer />` featuring **Unified** and **Split** (side-by-side) modes. Unchanged sections collapse into expandable pills (`↕ Expand N unchanged lines`), highlighting only modified sentences.
- **Accurate Conflict Draft Snapshotting:** Conflict resolution now freezes and restores the exact local draft captured at conflict time, preventing concurrent autosaves from contaminating the chosen resolution.
- **Authoritative Online Reload Revalidation:** Reloading a note while online revalidates against the latest cloud version, seamlessly updating local Dexie cache without risking un-synced offline edits.
- **Instant Cross-Tab Editor Synchronization:** When a conflict is resolved in any tab, the resolved note broadcasts live via `BroadcastChannel`, updating TipTap editor content in other open tabs without requiring a page reload.
- **Core Web Vitals & 96+ Lighthouse Performance:** 
  - **Sub-Second LCP (0.74s) & 0ms TBT:** Replaced artificial interval-based list batching with on-demand scroll pagination, and implemented custom-equality memoization on `<NoteCard />` to prevent redundant DOM updates across 100+ active notes.
  - **Eliminated Layout Thrashing (Forced Reflows):** Transitioned reactive panel layout constraints in `AppLayout` to navigation-bound dependency triggers, eliminating repeated synchronous geometry recalculations.
  - **Non-Blocking Font & Vector Asset Pipeline:** Replaced external `@import` CSS waterfalls with asynchronous font preconnections and upgraded raster brand icons to an ultra-lightweight (<1.5 KB) SVG asset pipeline.
  - **Code-Split Auth & Heavy Dialog Footprint:** Dynamic `lazy()` code splitting removes unauthenticated payloads and heavy modal dialogs from the initial entry bundle.

</details>

<details>
<summary><b>v1.3.0 Release Notes</b></summary>

- **Fair-Use AI Quotas & Concurrency Limiting:** Daily token tracking with UTC midnight auto-reset across Free (100k), Pro (500k), and Enterprise (2M) tiers, paired with concurrency semaphores to protect API limits while keeping interactions fair.(Currently Free)
- **Token-Budget History & Sliding Context Summarization:** Dynamic 8,000-token sliding window with provider-independent estimation. Messages overflowing the token budget are seamlessly consolidated in the background into an actionable, state-preserving summary without arbitrary turn truncation.
- **OCC Conflict Resolution & Visual Merging UI:** When multi-device edits cause an Optimistic Concurrency Control (OCC) conflict (`409 Conflict`), Notesify displays an interactive Note Conflict Banner and Modal allowing side-by-side diffing with **Keep Local**, **Keep Remote**, and **Smart Merge** resolution strategies.
- **Live Title Sync with Typewriter Feedback:** Global AI Chat sessions dynamically synthesize succinct 3–6 word topic titles in the background, updating active sidebar headers with a smooth typewriter animation.
- **Native LaTeX Mathematics (KaTeX):** Iris now formats mathematical formulas and equations in standard LaTeX notation (both inline `$x$` and block `$$...$$`), seamlessly rendered with KaTeX.
- **Butter-Smooth Iris Panel & Layout Polish:** Guarded layout transitions in `AppLayout` and stabilized session sync eliminate Global Chat drawer stutter and resize jitter.

</details>

<details>
<summary><strong>v1.2.3 — Agentic Learning Tasks & Composer Polish</strong></summary>

- **Agentic Learning Tasks Queue:** Iris can create, track, and update concrete practice milestones docked above the composer bar with smooth spring physics.
- **Permanent Learning Archive:** Completed milestones graduate into a permanent archive for long-term mastery analytics without polluting the active prompt context.
- **Native Tool Calling Protocol:** Strict native `role: "tool"` schemas, eliminating simulated text tags and model hallucinations.
- **Desktop Focus Mode Sync:** Header titlebar clearance dynamically applies only in fullscreen and focus modes for edge-to-edge desktop reading.
</details>

<details>
<summary><strong>v1.2.2 — Streaming Iris, Interactive Tools & Inline Citations</strong></summary>

- **Interactive Question Dialogs (`ask_question`):** Iris autonomously triggers rich modal dialogs for knowledge quizzes, requirement clarifications, preference selection, and priority ranking (`single_select`, `multi_select`, `rank_priority`).
- **AI Reasoning / Thought Trace Viewer:** Collapsible `ReasoningCollapsible` component provides full visibility into Iris's multi-step chain-of-thought.
- **Inline Note Citations:** Clickable note references (`[cite: noteId]`) render directly inside chat responses with instant popover previews and navigation.
- **Real-Time Streaming Shimmer:** Fluid token-by-token streaming with animated shimmer indicators and responsive stream cancellation.
</details>

<details>
<summary><strong>v1.2.1 — STT Voice Dictation & Chat Polish</strong></summary>

- **STT Voice Dictation:** Hands-free voice transcription inside the Iris compose bar with automatic language detection.
- **Refined Conversation Sidebar:** Clean, minimalist dark conversation history with instant in-place search and quick session switching.
- **Uncapped Conversations:** Seamlessly load and navigate your complete chat history without artificial session caps.
</details>

<details>
<summary><strong>v1.2.0 — Bounded Agentic Loop & On-Demand Retrieval</strong></summary>

- **Bounded Agentic Loop:** Server-side multi-round reasoning loop (`Round 1/3` → `Round 2/3`) in a single continuous SSE stream.
- **On-Demand Contextual Retrieval (`get_note_content`):** Iris fetches full note contents only when editor context is insufficient, enforcing strict user ownership.
- **Global Note Actions (`create_note`, `update_note`):** Create and update notes directly from Global Chat without navigating into the editor.
- **Minimalist Telemetry:** Lightweight ephemeral status indicators (`Reading note...`, `Searching the web...`) that automatically dissolve when streaming begins.
</details>

<details>
<summary><strong>v1.1.0 — Offline-First Desktop & DPI-Aware Installer</strong></summary>

- **Offline-First Dexie Workspace:** Packaged Electron app operates completely offline via bundled assets and Dexie.js (IndexedDB) with bidirectional queue synchronization on reconnection.
- **Automated Title Synthesis:** Ultra-low-latency topic extraction and long-term conversation summarization.
</details>
