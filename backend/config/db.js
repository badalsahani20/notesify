import mongoose from "mongoose";
import Folder from "../src/models/folder.model.js";
import User from "../src/models/user.model.js";
import Notes from "../src/models/notes.model.js";
import DeletedNote from "../src/models/deletedNote.model.js";
import AiAssistCache from "../src/models/aiAssistCache.model.js";
import GlobalChatSession from "../src/models/globalChatSession.model.js";

const connectDB = async() => {
    try {
        await mongoose.connect(process.env.DB_URI);
        console.log("✅ MongoDB Connected", mongoose.connection.name);

        // Sync indexes to apply any schema changes (e.g. partial unique index)
        await Folder.syncIndexes();
        await User.syncIndexes();
        await Notes.syncIndexes();
        await DeletedNote.syncIndexes();
        await AiAssistCache.syncIndexes();
        await GlobalChatSession.syncIndexes();
        console.log("✅ Models indexes synced");
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

export default connectDB;
