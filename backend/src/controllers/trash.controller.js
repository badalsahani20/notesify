import * as TrashService from "../services/trash.service.js";
import * as NoteService from "../services/notes.service.js";
import catchAsync from "../utils/catchAsync.js";
import { redis } from "../../config/redis.js";

const clearNoteCaches = async (userId) =>
  Promise.all([
    redis.del(`notes:${userId}`),
    redis.del(`notes:archive:${userId}`),
  ]).catch((err) => console.warn("[Redis] clearNoteCaches failed:", err.message || err));
export const getTrash = catchAsync(async (req, res, next) => {
    const trash = await TrashService.getTrashItems(req.user._id);

    res.status(200).json({success: true, ...trash});
});

export const hardDeleteNote = catchAsync(async (req, res, next) => {
    await NoteService.permanentlyRemoveNote(req.params.id, req.user._id);
    await clearNoteCaches(req.user._id);
    res.status(200).json({ message: "Note permanently deleted "});
});

export const hardDeleteFolder = catchAsync(async (req, res, next) => {
    await TrashService.permanentlyDeleteFolderAndNotes(req.params.id, req.user._id);
    await Promise.all([
        clearNoteCaches(req.user._id),
        redis.del(`folders:${req.user._id}`),
    ]).catch((err) => console.warn("[Redis] Cache invalidation failed:", err.message || err));
    res.status(200).json({ message: "Folder and its notes permanently deleted "});
});

export const emptyTrash = catchAsync(async (req, res, next) => {
    const result = await TrashService.emptyTrash(req.user._id);
    await Promise.all([
        redis.del(`notes:${req.user._id}`),
        redis.del(`notes:archive:${req.user._id}`),
        redis.del(`folders:${req.user._id}`),
    ]).catch((err) => console.warn("[Redis] Cache invalidation failed:", err.message || err));
    res.status(200).json({
        success: true,
        message: "All Cleared!",
        ...result
    });
})


export const restoreNote = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const restoredNote = await TrashService.restoreNote(id, userId);
  if (!restoredNote) {
    return res.status(404).json({
      success: false,
      message: "Note not found or not in trash"
    });
  }

  await clearNoteCaches(userId);

  res.status(200).json({
    success: true,
    message: "Note restored!",
    note: restoredNote
  });
})

export const restoreFolder = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const folder = await TrashService.restoreFolderAndNotes(id, req.user._id);
  await Promise.all([
    redis.del(`notes:${req.user._id}`),
    redis.del(`notes:archive:${req.user._id}`),
    redis.del(`folders:${req.user._id}`),
  ]).catch((err) => console.warn("[Redis] Cache invalidation failed:", err.message || err));

  res.status(200).json({
    success: true,
    message: "Folder and notes restored successfully",
    folder,
  });
})
