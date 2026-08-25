import * as NoteService from "../services/notes.service.js";
import catchAsync from "../utils/catchAsync.js";
import mongoose from "mongoose";
import { redis } from "../../config/redis.js";
import { sanitizeNoteHtml } from "../utils/sanitizeNoteHtml.js";
import { generateTitleFromText } from "../services/title.service.js";
import Notes from "../models/notes.model.js";
import { stripHtml } from "../utils/stripHtml.js";
import { generateEmbedding } from "../services/embeddingService.js";

const clearNoteCaches = async (userId) =>
  Promise.all([
    redis.del(`notes:${userId}`),
    redis.del(`notes:archive:${userId}`),
  ]);

const clearSharedNoteCache = async (slug) => {
  if (slug) await redis.del(`shared_note:${slug}`);
};

const queueNoteEmbedding = (note, userId) => {
  if (!note || !note.content) return;

  const plainText = stripHtml(note.content).trim();
  if (plainText.length < 10) return;

  generateEmbedding(plainText)
    .then(async (embedding) => {
      if (embedding) {
        await Notes.updateOne(
          { _id: note._id, user: userId },
          { $set: { embedding, lastEmbeddedAt: new Date() } }
        ).exec();
      }
    })
    .catch((err) => console.error("[AutoEmbed] failed:", err));
};

const DEFAULT_NOTE_TITLES = ["Untitled Note", "Untitled"];

const queueAutoTitleGeneration = (note, userId) => {
  if (!note || !DEFAULT_NOTE_TITLES.includes(note.title) || !note.content) {
    return;
  }

  const plainText = stripHtml(note.content).trim();
  if (plainText.length < 120) {
    return;
  }

  // Pure function contract: Input content -> Output title string.
  // The caller (controller) handles updating the database model.
  generateTitleFromText(plainText)
    .then(async (generatedTitle) => {
      const normalizedTitle = generatedTitle?.trim();
      if (!normalizedTitle || DEFAULT_NOTE_TITLES.includes(normalizedTitle)) {
        return;
      }

      const updated = await Notes.findOneAndUpdate(
        {
          _id: note._id,
          user: userId,
          title: { $in: DEFAULT_NOTE_TITLES },
        },
        { title: normalizedTitle },
        { new: true }
      ).exec();

      if (updated) {
        await clearNoteCaches(userId);
      }
    })
    .catch((err) => console.error("[AutoTitle] failed:", err));
};

export const generateNoteTitleController = catchAsync(async (req, res) => {
  const { content } = req.body;
  const plainText = stripHtml(content || "").trim();

  if (plainText.length < 15) {
    return res.status(400).json({ message: "Content too short for title generation" });
  }

  // Pure function call: Input content -> Output title
  const title = await generateTitleFromText(plainText);
  const normalizedTitle = title?.trim() || "Untitled Note";

  return res.status(200).json({ title: normalizedTitle });
});

export const getAllNotes = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const cacheKey = `notes:${userId}`;
    const lockKey = `lock:notes:${userId}`;

    //Check cache
    const cachedNotes = await redis.get(cacheKey);

    if (cachedNotes) {
        // Upstash automatically parses objects
        return res.status(200).json(cachedNotes);
    }

    const lock = await redis.set(lockKey, "1", { nx: true, ex: 5});

    if(lock) {
      // 2. If not in cache, fetch from database
      const notes = await NoteService.findUserNotes(userId);
      if (!notes || notes.length === 0) {
        await redis.del(lockKey);
        return res.status(200).json([]);
      }
      
      await redis.set(cacheKey, notes, { ex: 3600 });
      await redis.del(lockKey); 
      
      res.status(200).json(notes);
    }else{
       // Another request is fetching DB
       await new Promise((resolve) => setTimeout(resolve, 100));
       const retryCache = await redis.get(cacheKey);

       if(retryCache) {
        return res.status(200).json(retryCache);
       }

       //Fallback if cache still empty
       const notes = await NoteService.findUserNotes(userId);
       return res.status(200).json(notes);
    }
});

export const getArchivedNotes = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const cacheKey = `notes:archive:${userId}`;
    const lockKey = `lock:notes:archive:${userId}`;

    const cachedNotes = await redis.get(cacheKey);
    if (cachedNotes) {
      return res.status(200).json(cachedNotes);
    }

    const lock = await redis.set(lockKey, "1", { nx: true, ex: 5 });

    if (lock) {
      const notes = await NoteService.findArchivedNotes(userId);
      await redis.set(cacheKey, notes || [], { ex: 3600 });
      await redis.del(lockKey);
      return res.status(200).json(notes || []);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    const retryCache = await redis.get(cacheKey);

    if (retryCache) {
      return res.status(200).json(retryCache);
    }

    const notes = await NoteService.findArchivedNotes(userId);
    return res.status(200).json(notes);
});

export const createNote = catchAsync(async (req, res) => {
    const { _id, content, title, color, folder, createdAt} = req.body;
    const note = await NoteService.createNewNote(req.user._id, {
      _id,
      content: sanitizeNoteHtml(content),
      title,
      color,
      folder,
      createdAt,
    });

    // Invalidate cache
    await clearNoteCaches(req.user._id);

    queueAutoTitleGeneration(note, req.user._id);
    queueNoteEmbedding(note, req.user._id);

    res.status(201).json(note);
});

export const getNoteById = catchAsync(async (req, res) => {
    const note = await NoteService.findNotesById(req.params.id, req.user._id);
    if(!note) {
      return res.status(404).json({message: "Note not found."});
    }

    // Silently update lastAccessedAt without bumping updatedAt
    NoteService.stampNoteAccess(req.params.id, req.user._id).catch(() => {});

    res.json(note);
})

export const updateNote = catchAsync(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
  return res.status(400).json({ message: "Invalid note id" });
}
  const { version, ...updateData } = req.body;
  if (version === undefined) {
   return res.status(400).json({
      message: "Version is required for update"
   });
} 
  const finalUpdateData = {
    ...updateData,
    ...(typeof updateData.content === "string" ? { content: sanitizeNoteHtml(updateData.content) } : {}),
    grammarErrors: [],
  };
  const result = await NoteService.updateNoteWithVersionCheck(
    req.params.id,
    req.user._id,
    version,
    finalUpdateData
  );

  if(!result) {
    await clearNoteCaches(req.user._id);
    return res.status(404).json({ message: "Note not found" });
  }
  
  if(result.conflict) {
    return res.status(409).json({
      error: "VERSION_CONFLICT",
      message: "Conflict detected",
      serverVersion: result.serverNote.version,
      serverState: result.serverNote,
    });
  }

    // Invalidate cache
    await clearNoteCaches(req.user._id);
    if (result.updatedNote?.shareSlug) await clearSharedNoteCache(result.updatedNote.shareSlug);

    queueAutoTitleGeneration(result.updatedNote, req.user._id);
    queueNoteEmbedding(result.updatedNote, req.user._id);

    res.status(200).json(result.updatedNote);
});

export const deleteNote = catchAsync(async (req, res) => {
    const { version } = req.body;

    const noteBefore = await NoteService.findNotesById(req.params.id, req.user._id);
    const oldSlug = noteBefore?.shareSlug;

    const result = await NoteService.removeNote(req.params.id, req.user._id, version);
    if(!result) {
        await clearNoteCaches(req.user._id);
        return res.status(404).json({message: "Note not found"});
    }
    if(result.conflict) {
      return res.status(409).json({
        message: "Conflict detected: Note was updated on another device",
        serverNote: result.serverNote,
      });
    }

    // Invalidate cache
    await clearNoteCaches(req.user._id);
    if (oldSlug) await clearSharedNoteCache(oldSlug);

    res.status(200).json({message: "Note Moved to Trash" });
})

export const togglePin = catchAsync(async (req, res) => {
    const { version } = req.body;
    if (version === undefined) {
      return res.status(400).json({ message: "Version is required for pin toggle" });
    }

    const result = await NoteService.flipPinStatus(req.params.id, req.user._id, version);
    if(!result) {
        await clearNoteCaches(req.user._id);
        return res.status(404).json({message: "Note not found"});
    }
    if (result.conflict) {
      return res.status(409).json({
        message: "Conflict detected: Note was updated on another device",
        serverNote: result.serverNote,
      });
    }

    // Invalidate cache
    await clearNoteCaches(req.user._id);

    res.status(200).json({message: "Pin status toggled" , note: result.updatedNote});
})

export const toggleArchive = catchAsync(async (req, res) => {
    const { version } = req.body;
    if (version === undefined) {
      return res.status(400).json({ message: "Version is required for archive toggle" });
    }

    const result = await NoteService.flipArchiveStatus(req.params.id,req.user._id, version);
    if(!result) {
        await clearNoteCaches(req.user._id);
        return res.status(404).json({message: "Note not found"});
    }
    if (result.conflict) {
      return res.status(409).json({
        message: "Conflict detected: Note was updated on another device",
        serverNote: result.serverNote,
      });
    }

    // Invalidate cache
    await clearNoteCaches(req.user._id);

    res.status(200).json({message: result.updatedNote.isArchived ? "Note archived" : "Note unarchived" , note: result.updatedNote});
})

export const searchAllNotes = catchAsync(async (req, res) => {
  const { q, folderId } = req.query;
  if(!q || q.trim() === "") {
    return res.status(400).json({ message: "Search query is required"});
  }

  const notes = await NoteService.searchNote(req.user._id, q, folderId);

  res.status(200).json({
    success: true,
    count: notes.length,
    notes
  });
});

export const restoreNote = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const restoredNote = await NoteService.restoreNote(id, userId);
  if(!restoredNote) {
    return res.status(404).json({
      success: false,
      message: "Note not found or not in trash"
    });
  }

  // Invalidate cache
  await clearNoteCaches(userId);

  res.status(200).json({
    success: true,
    message: "Note restored!",
    note: restoredNote
  });
})

export const toggleNoteShare = catchAsync(async (req, res) => {
  const { isShared, expiresAt } = req.body;
  const { id } = req.params;

  const noteBefore = await NoteService.findNotesById(id, req.user._id);
  const oldSlug = noteBefore?.shareSlug;

  const updatedNote = await NoteService.updateShareSettings(id, req.user._id, { isShared, expiresAt });

  if(!updatedNote) {
    return res.status(404).json({ message: "Note not found"});
  }

  await clearNoteCaches(req.user._id);
  if (oldSlug) await clearSharedNoteCache(oldSlug);
  if (updatedNote.shareSlug && updatedNote.shareSlug !== oldSlug) {
    await clearSharedNoteCache(updatedNote.shareSlug);
  }

  res.status(200).json({
    success: true,
    message: isShared ? "Note is now public" : "Note is now private",
    note: updatedNote
  });
})

export const getSharedNote = catchAsync(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = `shared_note:${slug}`;
        
  // 1. Try serving from Redis cache
  const cachedData = await redis.get(cacheKey);

  if (cachedData) {
    const parsedCache = typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData;
    
    // Background view increment
    if (parsedCache.noteId) {
      Notes.updateOne({ _id: parsedCache.noteId }, { $inc: { shareViews: 1 } }).catch(console.error);
    }

    return res.status(200).json({
      title: parsedCache.title,
      content: parsedCache.content,
      updatedAt: parsedCache.updatedAt
    });
  }

  // 2. Cache miss, fetch from DB
  const result = await NoteService.findByShareSlug(slug);

  if(!result) {
    return res.status(404).json({ message: "Note link invalid or disabled" });
  }

  if(result.expired) {
    return res.status(410).json({ message: "This share link has expired"});
  }

  const responseData = {
    noteId: result.note._id,
    title: result.note.title,
    content: result.note.content,
    updatedAt: result.note.updatedAt
  };

  // 3. Calculate TTL: Use the smaller of 1 hour OR the actual remaining time until expiry
  let ttl = 3600; 
  if (result.note.shareExpiresAt) {
    const secondsUntilExpiry = Math.floor((new Date(result.note.shareExpiresAt).getTime() - Date.now()) / 1000);
    if (secondsUntilExpiry <= 0) {
      return res.status(410).json({ message: "This share link has expired" });
    }
    ttl = Math.min(ttl, secondsUntilExpiry);
  }

  // 4. Cache the valid public note
  await redis.set(cacheKey, JSON.stringify(responseData), { ex: ttl });

  res.status(200).json({
    title: responseData.title,
    content: responseData.content,
    updatedAt: responseData.updatedAt
  });
});