import Notes from "../models/notes.model.js";
import Folder from "../models/folder.model.js";
import {
    clearNoteTombstone,
    recordNoteTombstones,
} from "./tombstone.service.js";

export const emptyTrash = async (userId) => {
    const deletedNotes = await Notes.find({
        user: userId,
        isDeleted: true,
        isArchived: { $in: [true, false, null] },
    })
        .select("_id")
        .lean();

    await recordNoteTombstones(
        userId,
        deletedNotes.map((note) => note._id)
    );

    const [notesResult, foldersResult] = await Promise.all([
        Notes.deleteMany({ user: userId, isDeleted: true}),
        Folder.deleteMany({ user: userId, isDeleted: true})
    ]);

    return {
        notesDeleted: notesResult.deletedCount,
        foldersDeleted: foldersResult.deletedCount
    }
}

export const permanentlyDeleteFolderAndNotes = async (folderId, userId) => {
    const folder = await Folder.findOne({
        _id: folderId,
        user: userId,
        isDeleted: true,
    });

    if (!folder) {
        return null;
    }

    const notes = await Notes.find({
        folder: folderId,
        user: userId,
        isDeleted: { $in: [true, false, null] },
        isArchived: { $in: [true, false, null] },
    })
        .select("_id")
        .lean();

    await recordNoteTombstones(
        userId,
        notes.map((note) => note._id)
    );

    await Folder.findOneAndDelete({ _id: folderId, user: userId, isDeleted: true });
    await Notes.deleteMany({ folder: folderId, user: userId});

    return folder;
}
export const getTrashItems = async (userId) => {
    const[notes, folders] = await Promise.all([
        Notes.find({ user: userId, isDeleted: true, isArchived: { $in: [true, false] }}).select("-embedding").sort({ updatedAt: -1 }),
        Folder.find({user: userId, isDeleted: true}).sort({ updatedAt: -1 })
    ])

    return { notes, folders };
}

export const restoreNote = async (noteId, userId) => {
    const restoredNote = await Notes.findOneAndUpdate(
        { _id: noteId, user: userId, isDeleted: true, isArchived: { $in: [true, false] }},
        {isDeleted: false, $inc: { version: 1 }},
        { new: true }
    );

    if (restoredNote) {
        await clearNoteTombstone(userId, restoredNote._id).catch((err) => {
            console.warn("[Trash] Failed to clear note tombstone:", err);
        });
    }

    return restoredNote;
};

export const restoreFolderAndNotes = async (folderId, userId) => {
  //Find the deleted folder
  const folder = await Folder.findOne({
    _id: folderId,
    user: userId,
    isDeleted: true,
  });
  if (!folder) {
    const error = new Error("Deleted folder not found");
    error.statusCode = 404;
    throw error;
  }

  //Flip the folder back to active
  folder.isDeleted = false;
  folder.version += 1; // Increment version so offline devices sync the restore
  await folder.save();

  //Restore the notes in the folder
  await Notes.updateMany(
    { folder: folderId, user: userId, isDeleted: true, isArchived: { $in: [true, false] } },
    {
        $set: { isDeleted: false },
        $inc: { version: 1 }
    }
  );
  return folder;
};
