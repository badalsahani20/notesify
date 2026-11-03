# Redis caching and delta sync

> **Engineering note**
> **Topics:** Redis cache correctness, and replacing the full-collection note pull with an incremental sync protocol
> **Scope:** `backend/src/controllers/`, `backend/src/services/`, `frontend/src/services/SyncService.ts`, `frontend/src/database/`
> **Outcome:** Three cache-invalidation gaps fixed. Delta note sync implemented and covered by tests. Redis resilience work explicitly **not** implemented.

---

## TL;DR

These are two separate problems that were investigated in the same pass.

**Redis caching.** Redis was audited, not redesigned. It already does a small, well-defined job: cache three per-user read endpoints, hold short-lived OAuth/PKCE state, and cache public shared notes. The audit found three invalidation paths that left stale entries behind; all are fixed. Everything else - failure fallback, compression, metrics, cache-versioning - is documented here as open work and was left alone.

**Delta sync.** This was a real implementation change. Every sync used to download the user's entire active-note collection, could not see archived or trashed notes, and had no way to learn that a note had been hard-deleted. It now uses a cursor protocol: a keyset-paginated `GET /api/notes/sync?since=...`, a server high-water mark, and tombstones for hard deletes. A full snapshot is used only on first run or when the server rejects the cursor.

No production measurements (hit rate, response sizes, sync frequency, Upstash usage) were available while writing this, so this note makes no latency or cost claims.

---

# Part 1 — Redis caching

## 1.1 What Redis actually stores

Redis is Upstash over REST (`backend/config/redis.js`). There is no Redis-backed session store and no Redis-backed refresh-token store.

| Key | Written by | TTL | Purpose |
|---|---|---|---|
| `notes:<userId>` | `GET /api/notes` | 3600 s | Active (non-archived, non-trashed) note list |
| `notes:archive:<userId>` | `GET /api/notes/archive` | 3600 s | Archived note list |
| `folders:<userId>` | `GET /api/folders` | 3600 s | Folder list |
| `lock:notes:<userId>` | `GET /api/notes` | 5 s | Cache-stampede guard (NX) |
| `lock:notes:archive:<userId>` | `GET /api/notes/archive` | 5 s | Cache-stampede guard (NX) |
| `shared_note:<slug>` | `GET /api/public/notes/:slug` | min(3600 s, share expiry) | Public share payload |
| `oauth_state:<state>` | Google OAuth start | 300 s | PKCE code challenge + redirect metadata |
| `authorization_code:<code>` | Google OAuth callback | 60 s | One-time code for desktop token exchange |

Notes and folders are stored as Upstash-serialized objects. The shared-note payload is stored as an explicit `JSON.stringify`, because it is also read back and parsed by hand.

### What is *not* in Redis

This distinction matters because public-facing docs got it wrong (see §4).

- **Refresh tokens** are embedded in the MongoDB user document (`backend/src/models/user.model.js`).
- **Email verification tokens, verification OTPs, and password-reset tokens** are MongoDB fields on the user document.
- **Sessions** are not stored server-side. Auth is JWT access tokens plus rotating refresh tokens.
- **Trash listings** (`GET /api/trash`) are not cached at all.
- **Single notes** (`GET /api/notes/:id`) are not cached.

Redis *is* mandatory for the OAuth/PKCE flow: the state entry and the authorization code are consumed from Redis. If Redis is unavailable, that flow fails. Caching is optional; OAuth state is not.

## 1.2 The cache read path

All three list caches use the same shape:

```js
const cached = await redis.get(cacheKey);
if (cached) return res.json(cached);

const lock = await redis.set(lockKey, "1", { nx: true, ex: 5 });
if (lock) {
  const rows = await loadFromMongo();
  await redis.set(cacheKey, rows, { ex: 3600 });
  await redis.del(lockKey);
  return res.json(rows);
}

await sleep(100);
const retry = await redis.get(cacheKey);
if (retry) return res.json(retry);

return res.json(await loadFromMongo()); // last-resort read
```

The intent is reasonable: one request rebuilds the entry, concurrent requests wait briefly and read the rebuilt entry, and the final fallback prevents a permanent miss if the rebuild is slow.

`getSharedNote` is the only read path with a `try/catch` around Redis. It serves the cached payload if present, and if the cache write fails it logs and still returns the database result.

## 1.3 What was wrong

### Three invalidation gaps (fixed)

**`deleteFolder`** removed `folders:<userId>` only. Deleting a folder soft-deletes its notes, so both note lists were left stale for up to an hour. A client could keep seeing notes that had just moved to trash.

**`restoreFolder`** removed `notes:<userId>` and `folders:<userId>`, but not `notes:archive:<userId>`. Restoring a folder that contained archived notes left the archive list stale.

**`deleteFolder` also left public share pages cached.** This one is separate from the list caches. `shared_note:<slug>` is keyed by slug, not derived from `notes:` or `folders:`, and `deleteFolder` never touched it. A shared note inside the deleted folder therefore kept serving its public page from Redis for up to an hour, even though `findByShareSlug` excludes `isDeleted: true` in MongoDB. The controller now reads the folder's shared slugs before the cascade delete and removes those keys.

All three are fixed in this pass:

```js
// folder.controller.js — deleteFolder
const sharedSlugs = await FolderService.findSharedNoteSlugsInFolder(id, req.user._id);

// ...after a successful delete
await Promise.all([
  redis.del(`folders:${req.user._id}`),
  redis.del(`notes:${req.user._id}`),
  redis.del(`notes:archive:${req.user._id}`),
  ...sharedSlugs.map((slug) => redis.del(`shared_note:${slug}`)),
]);
```

```js
// trash.controller.js — restoreFolder
await Promise.all([
  redis.del(`notes:${req.user._id}`),
  redis.del(`notes:archive:${req.user._id}`),
  redis.del(`folders:${req.user._id}`),
]);
```

Every other note mutation path already called `clearNoteCaches`, which clears both note keys. `deleteNote`, `updateNote`, and `toggleNoteShare` also clear the affected `shared_note:` key.

### Correctness limits that were *not* changed

These are real, and they are the reason this note exists rather than a claim that Redis is "done":

1. **No failure fallback on list reads.** `getAllNotes`, `getArchivedNotes`, and `getAllFolders` call `redis.get` outside a `try/catch`. An Upstash outage turns a cache miss into a 500 instead of a slower database read. Only `getSharedNote` degrades gracefully.
2. **The stampede guard is best-effort.** It waits a fixed 100 ms and retries exactly once. It is not a distributed lock, and a slow Mongo query can still produce a thundering herd.
3. **No TTL jitter.** Every entry for every user expires at exactly one hour after creation, so entries written during a traffic spike expire together.
4. **No cache versioning.** Keys do not include a schema or payload version. Changing the serialized shape requires a deploy that either waits out the TTL or manually flushes keys.
5. **No compression.** Large note lists are sent to Upstash as-is over REST.
6. **No instrumentation.** There is no hit/miss counter, no invalidation counter, and no timing around cache reads. The hit rate is unknown.
7. **Invalidation is manual and per-controller.** Nothing enforces that a new mutation clears the right keys. The three gaps fixed here are exactly the failure mode this design invites.

## 1.4 Options considered

| Option | What it would involve | Why it was not chosen |
|---|---|---|
| **A. Leave it, document it** | No code change | Rejected: three known paths produced user-visible stale data |
| **B. Fix the missing invalidations only** | Add the missing `redis.del` calls | **Chosen.** Small, verifiable, no architectural risk |
| **C. Read-through cache helper** | Centralize key building, `get`/`set`, lock, and fallback in one module | Correct long-term direction, but a cross-controller refactor with no tests around the cache layer. Deferred |
| **D. Versioned keys** | `notes:v2:<userId>` | Fixes shape changes, not invalidation gaps. Deferred |
| **E. Redis-backed sessions** | Move refresh/session state into Redis | Rejected: sessions and refresh tokens already work in MongoDB, and this would make Redis a hard dependency for login |

Option B was chosen deliberately: fix what is demonstrably wrong, write down what is not, and do not disguise a partial audit as a redesign.

## 1.5 What changed, precisely

| File | Change |
|---|---|
| `backend/src/controllers/folder.controller.js` | `deleteFolder` now clears `notes:`, `notes:archive:`, and the folder's `shared_note:<slug>` keys, in addition to `folders:` |
| `backend/src/services/folder.service.js` | Added `findSharedNoteSlugsInFolder` so the controller can clear share pages before the cascade delete |
| `backend/src/controllers/trash.controller.js` | `restoreFolder` now clears `notes:archive:` |

No key names, TTLs, serialization, endpoints, or response shapes changed. No cache entries need to be flushed for this deploy; the fix only affects future invalidations.

## 1.6 Open work

Ordered by user impact, not effort:

1. Wrap the three list reads so a Redis error falls through to MongoDB.
2. Replace the fixed 100 ms retry with bounded retry/backoff, or accept the herd and remove the lock.
3. Add TTL jitter (for example 3600 s ± 120 s).
4. Add hit/miss and invalidation counters before changing anything else, so the next decision is based on data.
5. Consider a single `invalidateUserCaches(userId)` helper so a new mutation cannot forget the archive key.
6. Decide whether note-list payloads are large enough to justify compression. This needs the missing metrics first.

---

# Part 2 — Delta sync

## 2.1 The old flow

The client already kept notes in Dexie and rendered from local state, so "sync" meant pulling the server's view and merging it into IndexedDB.

Before this change, the pull was a full collection:

```ts
// Simplified old shape
const notes = await notesApi.getNotes(); // GET /api/notes
for (const note of notes) {
  const local = await db.notes.get(note._id);
  if (!local || note.version > local.version) {
    await db.notes.put(note);
  }
}
```

Problems:

1. **Every sync transferred every active note.** The cost grew with the size of the user's workspace, not with what changed.
2. **Archived notes were invisible.** `GET /api/notes` excludes `isArchived: true`, so a device could never learn that a note had been archived.
3. **Trashed notes were invisible.** The same endpoint excludes `isDeleted: true`, so moving a note to trash did not propagate.
4. **Hard deletes were indistinguishable from "not returned".** A permanent delete removes the row; a full pull simply omits it. Nothing told the client to remove its local copy.
5. **The response still carried fields the client cannot use.** Embeddings were already projected out in the service layer, which helped, but the rest of each document was re-sent every time.
6. **There was no resumable position.** A failed sync restarted from the beginning.

## 2.2 Requirements

The replacement had to:

- return only notes changed since the client's last successful sync;
- include archived and trashed notes, because the local database holds all three states;
- report hard deletes explicitly;
- paginate without skipping or duplicating rows, including rows that share a millisecond;
- remain correct when a note is written while pagination is in flight;
- survive process restarts and multiple tabs;
- not depend on the device clock;
- have a bounded retention window, with a defined recovery path.

## 2.3 Options considered

| Option | How it would work | Verdict |
|---|---|---|
| **A. Keep the full pull** | `GET /api/notes` every time | Rejected: O(workspace) per sync, no archive/trash/delete visibility |
| **B. `updatedAt > since` only** | Simple timestamp filter | Rejected: ties on the same millisecond skip rows during pagination; a bare timestamp also cannot describe a consistent snapshot |
| **C. Per-user change log** | Append every mutation to a `changes` collection, client reads by sequence | Rejected: a second write on every mutation, plus retention and compaction code, for the same guarantee |
| **D. MongoDB change streams** | Tail the oplog and stream changes | Rejected: requires a replica set, adds an always-on consumer, and gives no replay for a client whose cursor predates the stream. The deployment type was also not confirmed |
| **E. Keyset delta + tombstones** | Cursor on `(updatedAt, _id)`, tombstones for hard deletes, server high-water mark | **Chosen** |

Option E keeps one source of truth (the notes collection), needs no extra write on the happy path, and degrades into a full snapshot when the cursor is unusable.

## 2.4 The protocol

```
GET /api/notes/sync?since=<ISO-8601>&page=<opaque cursor>&limit=<1..500>
```

- No `since` and no `page` → full snapshot from the beginning of time.
- `since` present → changes after `since - 10s`.
- `page` present → continue an existing pagination session. `since` is ignored, because the cursor carries it.

Response:

```json
{
  "success": true,
  "notes": [ /* full note documents, minus embedding */ ],
  "deletedIds": ["..."],
  "nextPage": "base64url-cursor-or-null",
  "highWaterMark": "2026-11-03T10:15:30.000Z",
  "hasMore": false
}
```

Rules:

- `deletedIds` is populated **only on the first page** of a pagination session.
- `highWaterMark` is identical on every page of one session.
- `nextPage` is opaque; clients must not construct or parse it.
- `410 Gone` means the cursor is older than the retention window. `400` means the cursor or `since` is invalid. Both require a full snapshot.
- Default page size is 200; the maximum is 500.

## 2.5 Server implementation

`backend/src/services/deltaSync.service.js`

### Keyset pagination, not offset

The cursor is `(updatedAt, _id)`:

```js
$or: [
  { updatedAt: { $gt: cursor.updatedAt } },
  { updatedAt: cursor.updatedAt, _id: { $gt: cursor.id } },
]
```

`_id` is the tiebreaker. A bulk folder delete can stamp many notes with the same `updatedAt`; without the tiebreaker, `skip`/`limit` pagination would skip or repeat those rows. The index `{ user: 1, updatedAt: 1, _id: 1 }` was added to `notes.model.js` for this query.

### The 10-second overlap

The first page starts at `since - 10s`, not `since`:

```js
updatedAt: new Date(sinceMs - SYNC_OVERLAP_MS)
```

A write that committed just before the previous response was assembled may not have been visible to that query. Re-reading ten seconds costs a handful of duplicate rows and prevents a lost update. Duplicates are harmless: the client applies by version.

### The high-water mark travels in the cursor

This is the subtle part. The server records `highWaterMark = new Date()` when the first page is built. That value is embedded in every `nextPage` cursor, and each page returns the cursor's value — not a fresh `new Date()`.

If each page computed its own "now", this sequence would lose a note:

1. Page 1 reads notes through T.
2. Note X is updated.
3. Page 2 computes a new high-water mark T+1 and returns it.
4. The client stores T+1.
5. The next sync asks for changes after T+1, but X changed at T+0.5 and was never returned.

One mark per pagination session closes that gap.

### The model's pre-find hook

`notes.model.js` has a `pre(/^find/)` hook that hides `isDeleted: true` and `isArchived: true` unless those fields appear in the query. The delta query must see all three states, so it sets them explicitly:

```js
isDeleted: { $in: [true, false, null] },
isArchived: { $in: [true, false, null] },
```

`null` is included for legacy documents where the field is missing entirely. There is a test specifically for this.

### Tombstones

`DeletedNote` (`backend/src/models/deletedNote.model.js`):

- `{ user, noteId, deletedAt }`, unique on `(user, noteId)`;
- index on `(user, deletedAt)` for reads;
- TTL index on `deletedAt` at 90 days.

`tombstone.service.js` exposes three operations:

- `recordNoteTombstones(userId, ids)` — upsert before a physical delete;
- `findNoteTombstonesSince(userId, since)` — return ids deleted at or after the cursor;
- `clearNoteTombstone(userId, noteId)` — remove a tombstone when a note with that id is recreated or restored.

Tombstones are written **before** the row is deleted in `permanentlyRemoveNote`, `emptyTrash`, and `permanentlyDeleteFolderAndNotes`. The ordering is deliberate: a crash between the two leaves a tombstone for a note that still exists, which causes a temporary client-side removal that the next snapshot repairs. The reverse order would permanently lose the delete.

The `clearNoteTombstone` path exists because a client can reuse an `_id` after a hard delete, for example a stale queued `CREATE`. Without the clear, another device would keep deleting the recreated note.

### Retention

Two constants bound the window:

| Constant | Value | Where |
|---|---|---|
| Tombstone TTL | 90 days | `deletedNote.model.js` |
| Cursor retention | 80 days | `deltaSync.service.js` (`TOMBSTONE_RETENTION_MS`) |

The 10-day margin is intentional: a client is forced into a full snapshot *before* the tombstones it would need can expire. A `since` older than 80 days returns `410`, and the client rebuilds.

### Embeddings

The query selects `-embedding`. Embeddings are large, are not used by the client, and re-sending them on every sync would dwarf the actual note payload.

## 2.6 Client implementation

`frontend/src/services/SyncService.ts`

### Cursor persistence

The cursor is stored in Dexie, not memory:

```ts
// frontend/src/database/syncMeta.ts
const NOTE_SYNC_CURSOR_KEY = "notes.cursor";
```

`syncMeta` is a new table in Dexie schema v3 (`frontend/src/database/tables.ts`). Persisting it means a reload, a crash, or a second tab resumes from the last fully applied sync instead of re-downloading the collection.

The cursor is always the server's `highWaterMark`. It is never derived from `Date.now()`, so a device with a wrong clock does not poison sync.

### Lifecycle

```
pullServerChanges()
  ├─ no cursor ──────────────► pullSnapshot()  (no since)
  └─ cursor present
       ├─ pullDelta(cursor)
       │    ├─ 200 ───────────► apply pages, store highWaterMark
       │    ├─ 400 / 410 ────► clear cursor, pullSnapshot()
       │    └─ other error ──► propagate; cursor stays put
       └─ pullFolders()       (still a full pull)
```

`pullSnapshot` walks pages until `hasMore` is false, then deletes local notes the server did not return. That absence-based deletion happens **only after the final page**: doing it per page would delete notes that live on a page not yet fetched.

`pullDelta` never deletes by absence. A note missing from a delta response is expected; only tombstones trigger local deletion.

### Protected entities

Before applying pages, the client collects:

- note and folder ids with pending operations in `syncQueue`;
- ids with an `UNRESOLVED` entry in `conflictLog`.

Those entities are skipped. Otherwise a pull could overwrite a local edit that has not been pushed yet, or clobber the local side of a conflict the user has not resolved.

### Merge rule

For each remote note:

```ts
const local = await db.notes.get(remote._id);
if (!local || (remote.version && remote.version > (local.version || 0))) {
  await db.notes.put(remote);
}
```

`put` replaces the whole record. This is why the delta response must contain **full documents**, not patches: a partial document would erase fields that were not included. The only omission is `embedding`, which the client does not store.

### Cursor advance rule

The cursor is written only after a page set has been completely applied. If a page fails mid-way, the cursor stays at the previous high-water mark and the next attempt re-reads the same range. Re-applying is safe because of the version check.

## 2.7 Correctness bugs caught during implementation

These are worth recording because each one would have produced a silent, hard-to-reproduce sync failure.

**1. View counts bumped `updatedAt`.**
Incrementing `shareViews` used `updateOne` without disabling timestamps, so simply viewing a public note made it look modified and re-downloaded it to every device. Both increments now use `.setOptions({ timestamps: false })` (`notes.service.js` and `getSharedNote`). View counts are analytics, not content.

**2. Per-page high-water marks drift.**
Fixed by carrying one mark in the pagination cursor (§2.5).

**3. The pre-find hook hides archived and trashed notes.**
Fixed with explicit `$in: [true, false, null]` predicates and covered by a test.

**4. Same-millisecond ties skip rows.**
Fixed with the `(updatedAt, _id)` keyset and a test that creates five notes with an identical timestamp and pages through them two at a time.

**5. Tombstones could arrive after the cursor moved past them.**
Fixed by sending tombstones only on the first page (before the client can advance) plus the 10-second overlap on the next request.

**6. Absence-based deletion could run before the snapshot finished.**
Fixed by performing it only when `hasMore` is false.

**7. Reused note ids could be deleted by an old tombstone.**
Fixed with `clearNoteTombstone` on note creation and on note restore from trash.

## 2.8 Tests

`backend/tests/deltaSync.route.test.js` covers:

- changed notes are returned, archived and trashed included, unchanged notes excluded, `embedding` absent;
- hard deletes produce tombstones and appear in `deletedIds`;
- pagination across five notes sharing one timestamp returns no duplicates and no gaps, with one high-water mark for the whole session;
- notes and tombstones do not leak across users;
- legacy documents with missing `isDeleted`/`isArchived` are included;
- an 80-day-old cursor returns `410`;
- invalid `since` and invalid `page` return `400`.

Verification commands:

```bash
cd backend && npm test
cd frontend && npx tsc -b && npm run lint
```

## 2.9 Limitations and follow-ups

1. **Folders still use a full pull.** `pullFolders()` fetches the whole folder collection every sync and deletes local folders missing from the response. This was left alone on purpose: folders are tens of documents and a few hundred bytes each, so a delta protocol would add code without measurable benefit. If folder counts grow, this is the next thing to change.
2. **The client has a 80-day offline horizon.** Past that, the first sync after reconnecting is a full snapshot. That is correct, just expensive.
3. **There is no per-device server state.** The cursor is local to each IndexedDB instance. Two devices sync independently, which is fine, but the server cannot report "device X is behind".
4. **`deletedIds` is unbounded on the first page.** It returns every tombstone newer than the cursor. With the 80-day cap this is bounded in time, not in count. A user who deletes tens of thousands of notes could produce a large first page.
5. **No compression on the sync response.** Full note documents are still returned. The gain versus the old flow comes from sending fewer of them, not smaller ones.
6. **`backend/src/services/folder.service.js:123` contains a dead duplicate `permanentlyDeleteFolderAndNotes` that deletes notes without writing tombstones.** Nothing imports it — `trash.controller.js` uses `trash.service.js` — but it is a trap for a future edit. It should be deleted.
7. **Trash is not part of the delta protocol.** `GET /api/trash` remains a separate uncached read.

---

# Part 3 — Honest scope

| Area | Status |
|---|---|
| Redis key inventory | Audited |
| Redis invalidation gaps in folder delete/restore/share | Fixed |
| Redis failure fallback | **Not implemented** |
| Redis compression | **Not implemented** |
| Redis metrics / hit rate | **Not implemented** |
| Delta sync for notes | Implemented, tested |
| Delta sync for folders | **Not implemented** (intentional) |
| Public docs corrected | Yes (see §4) |

## 4. Documentation corrections

The audit found three public claims that did not match the code:

| Location | Claim | Reality |
|---|---|---|
| `landing/src/pages/notesify-privacy.md:75` | "Authentication sessions, temporary verification data, and synchronization states are managed through Upstash Redis." | Refresh tokens, verification tokens/OTPs, and reset tokens live in MongoDB. Redis holds short-lived OAuth state and authorization codes, plus note/folder caches. Sync state lives in the client's IndexedDB. |
| `landing/src/pages/notesify-privacy.md:110` | "Upstash Redis (Caching and session management)" | Same correction: caching and OAuth handshake state, not session management. |
| `landing/src/pages/notesify-docs.md:269` | "Cache invalidation happens automatically on every write - you never see stale data." | Invalidation is manual and per-controller, and the audit found three paths that missed it. The claim is now scoped to the endpoints that are cached. |

---

## File map

| Concern | File |
|---|---|
| Redis client | `backend/config/redis.js` |
| Note cache + sync endpoint | `backend/src/controllers/notes.controller.js` |
| Folder cache + invalidation | `backend/src/controllers/folder.controller.js` |
| Shared-slug collection | `backend/src/services/folder.service.js` |
| Trash mutations + invalidation | `backend/src/controllers/trash.controller.js` |
| OAuth state / code exchange | `backend/src/controllers/auth.controller.js` |
| Delta query, cursor, retention | `backend/src/services/deltaSync.service.js` |
| Tombstone operations | `backend/src/services/tombstone.service.js` |
| Tombstone schema + TTL | `backend/src/models/deletedNote.model.js` |
| Keyset index + pre-find hook | `backend/src/models/notes.model.js` |
| Client sync engine | `frontend/src/services/SyncService.ts` |
| Cursor persistence | `frontend/src/database/syncMeta.ts` |
| Dexie v3 schema | `frontend/src/database/tables.ts`, `frontend/src/database/database.ts` |
| API response shape | `frontend/src/repositories/api/RemoteNoteDataSource.ts` |
| Tests | `backend/tests/deltaSync.route.test.js` |
