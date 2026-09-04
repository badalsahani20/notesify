import Notes from "../models/notes.model.js";
import { getWelcomeNote } from "../utils/welcomeNote.js";
import { nanoid } from "nanoid";
// Bypasses the Mongoose pre('find') hook while matching missing fields on old docs
const ANY_ARCHIVE_STATE = { $in: [true, false, null] };

export const findUserNotes = async (userId) => {
    return await Notes.find({ user: userId, isDeleted: { $ne: true }, isArchived: { $ne: true }}).sort({
        pinned: -1,
        updatedAt: -1,
    });
}

export const findArchivedNotes = async (userId) => {
    return await Notes.find({ user: userId, isDeleted: false, isArchived: true }).sort({
        pinned: -1,
        updatedAt: -1,
    });
}

export const createNewNote = async (userId, noteData) => {
    return await Notes.create({
        user: userId,
        ...noteData
    });
};

export const createWelcomeNote = async (userId) => {
    const welcomeNote = getWelcomeNote();
    return await createNewNote(userId, welcomeNote);
};

export const updateNoteWithVersionCheck = async (
    noteId,
    userId,
    clientVersion,
    updateData
) => {
    const updatedNote = await Notes.findOneAndUpdate({ _id: noteId, user: userId, version: clientVersion, isDeleted: { $ne: true }, isArchived: ANY_ARCHIVE_STATE },
        {
            $set: updateData,
            $inc: { version: 1 }
        },
        { new: true }
    );
    if (!updatedNote) {
        //Either note not found or version mismatch. We need to check which one it is.
        const existingNote = await Notes.findOne({ _id: noteId, user: userId, isDeleted: { $ne: true }, isArchived: ANY_ARCHIVE_STATE });
        if (!existingNote) {
            return null; // Note not found
        }
        return { conflict: true, serverNote: existingNote }; // Version mismatch
    }

    return { updatedNote };
}

export const findNotesById = async (noteId, userId) => {
    return await Notes.findOne({ _id: noteId, user: userId, isDeleted: { $ne: true }, isArchived: ANY_ARCHIVE_STATE });
};

export const stampNoteAccess = async (noteId, userId) => {
    await Notes.updateOne(
        { _id: noteId, user: userId },
        { $set: { lastAccessedAt: new Date() } }
    ).setOptions({ timestamps: false });
};

export const removeNote = async (noteId, userId, clientVersion) => {
    // 1. Find the note first to check the version
    const existingNote = await Notes.findOne({ _id: noteId, user: userId, isDeleted: { $ne: true }, isArchived: ANY_ARCHIVE_STATE });
    if (!existingNote) {
        return null; // Note not found
    }
    // 2. Check for version conflict
    if(clientVersion !== existingNote.version) {
        return {conflict: true, serverNote: existingNote}; // Version mismatch
    }

    // 3. Soft delete: we can either remove the note or set a "deleted" flag. Here we choose to remove it.
    existingNote.isDeleted = true;
    existingNote.version += 1; // Increment version on delete as well

    return await existingNote.save();
}

export const flipPinStatus = async (noteId, userId, clientVersion) => {
    const existingNote = await Notes.findOne({
        _id: noteId,
        user: userId,
        isDeleted: { $ne: true },
        isArchived: ANY_ARCHIVE_STATE,
    });

    if (!existingNote) {
        return null;
    }

    if (clientVersion !== existingNote.version) {
        return { conflict: true, serverNote: existingNote };
    }

    const updatedNote = await Notes.findOneAndUpdate(
        { _id: noteId, user: userId, version: clientVersion, isDeleted: { $ne: true }, isArchived: ANY_ARCHIVE_STATE },
        [
            {
                $set: {
                    pinned: { $not: "$pinned" },
                    version: { $add: ["$version", 1] }
                }
            }
        ],
        { new: true }
    );

    if (!updatedNote) {
        const serverNote = await Notes.findOne({ _id: noteId, user: userId, isDeleted: { $ne: true }, isArchived: ANY_ARCHIVE_STATE });
        if (!serverNote) {
            return null;
        }
        return { conflict: true, serverNote };
    }

    return { updatedNote };
}

export const flipArchiveStatus = async (noteId, userId, clientVersion) => {
    const existingNote = await Notes.findOne({
        _id: noteId,
        user: userId,
        isDeleted: { $ne: true },
        isArchived: ANY_ARCHIVE_STATE,
    });

    if (!existingNote) {
        return null;
    }

    if (clientVersion !== existingNote.version) {
        return { conflict: true, serverNote: existingNote };
    }

    const updatedNote = await Notes.findOneAndUpdate(
        { _id: noteId, user: userId, version: clientVersion, isDeleted: { $ne: true }, isArchived: ANY_ARCHIVE_STATE },
        [
            {
                $set: {
                    isArchived: { $not: "$isArchived" },
                    version: { $add: ["$version", 1] }
                }
            }
        ],
        { new: true }
    );

    if (!updatedNote) {
        const serverNote = await Notes.findOne({ _id: noteId, user: userId, isDeleted: { $ne: true }, isArchived: ANY_ARCHIVE_STATE });
        if (!serverNote) {
            return null;
        }
        return { conflict: true, serverNote };
    }

    return { updatedNote };
}

export const searchNote = async(userId, query, folderId = null) => {

    const searchRegex = new RegExp(query, 'i');

    //The base filter
    const queryFilter = {
        user: userId,
        isDeleted: { $ne: true },
        isArchived: { $ne: true },
        $or:[
            { title: { $regex: searchRegex }},
            { content: { $regex: searchRegex }},
            { $text: { $search: query }}
        ]
    };

    const baseFilter = { user: userId, isDeleted: { $ne: true }, isArchived: { $ne: true } };

    //If folderId provided
    if(folderId && folderId !== null && folderId !== 'undefined'){
        baseFilter.folder = folderId;
    }

    let notes = await Notes.find({...baseFilter, $text: {$search: query}})
    .select({ score: {$meta: "textScore" }})
    .sort({ score: {$meta: "textScore" }});

    //Fallback
    if(notes.length === 0) {
        const searchRegex = new RegExp(query, 'i');
        notes = await Notes.find({
            ...baseFilter,
            $or: [
                {title: { $regex: searchRegex }},
                {content: { $regex: searchRegex }}
            ]
        }).sort({updatedAt: -1});
    }
    return notes;
}

export const permanentlyRemoveNote = async (noteId, userId) => {
    return await Notes.findOneAndDelete({ _id: noteId, user: userId, isDeleted: true });
};


export const updateShareSettings = async (noteId, userId, { isShared, expiresAt}) => {
    const note = await Notes.findOne({ _id: noteId, user: userId, isDeleted: { $ne: true }});
    
    if(!note) return null;

    if (isShared) {
        if (!note.shareSlug) {
            note.shareSlug = nanoid(10);
        }
        note.isShared = true;
        // Fallback to 24 hours if no expiry is provided (or if 'Forever' was somehow sent)
        note.shareExpiresAt = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours in ms
    } else {
        note.isShared = false;
        note.shareSlug = undefined; // Hard delete the slug so the next share creates a new one
        note.shareExpiresAt = null;
        note.shareViews = 0;
    }

    note.version += 1;

    return await note.save();
};

export const findByShareSlug = async (slug) => {
    const note = await Notes.findOne({
        shareSlug: slug,
        isShared: true,
        isDeleted: { $ne: true }
    });

    if(!note) return null;

    //Check if the link has expired/
    if( note.shareExpiresAt && new Date() > note.shareExpiresAt) {
        // Hard-delete expired link from DB
        note.isShared = false;
        note.shareSlug = undefined;
        note.shareExpiresAt = null;
        note.shareViews = 0;
        await note.save();
        return {expired: true};
    }

    //Increment views in the background
    Notes.updateOne({ _id: note._id }, { $inc: {shareViews: 1}}).catch(err => {
        console.error("Failed to increment share views:", err);
    });

    return { note };
}