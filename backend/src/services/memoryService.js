import mongoose from "mongoose";
import Memory from "../models/Memory.js";
import GlobalChatSession from "../models/globalChatSession.model.js";
import { generateEmbedding } from "./embeddingService.js";

const MAX_MEMORIES = 1000;
const DEDUPLICATION_THRESHOLD = 0.95;
// Default to 0.75, can be configured via env
const RETRIEVAL_THRESHOLD = process.env.MEMORY_SIMILARITY_THRESHOLD ? parseFloat(process.env.MEMORY_SIMILARITY_THRESHOLD) : 0.75;

export const searchMemories = async (userId, queryText, precomputedEmbedding = null) => {
    try {
        const queryEmbedding = precomputedEmbedding || await generateEmbedding(queryText);
        if (!queryEmbedding) return [];

        const pipeline = [
            {
                $vectorSearch: {
                    index: "memory_vector_index", // The name of the index in Atlas
                    path: "embedding",
                    queryVector: queryEmbedding,
                    numCandidates: 50,
                    limit: 10,
                    filter: { user: userId } // Requires user field to be indexed for filtering
                }
            },
            {
                $addFields: {
                    score: { $meta: "vectorSearchScore" }
                }
            },
            {
                $match: {
                    score: { $gte: RETRIEVAL_THRESHOLD }
                }
            },
            {
                $limit: 5
            }
        ];

        const results = await Memory.aggregate(pipeline);

        // Update lastAccessedAt for the injected memories
        if (results.length > 0) {
            const ids = results.map(m => m._id);
            await Memory.updateMany(
                { _id: { $in: ids } },
                { $set: { lastAccessedAt: new Date() } }
            );
        }

        return results;
    } catch (err) {
        console.error("Error in searchMemories:", err);
        return [];
    }
};

/**
 * Save or refresh a memory. Returns `{ memory, created }` so callers can tell a
 * fresh insert from a deduplicated hit. Returns null when the write fails.
 */
export const saveMemoryWithStatus = async (userId, memoryObj) => {
    try {
        const embedding = await generateEmbedding(memoryObj.content);
        if (!embedding) return null;

        // Deduplication Check
        const pipeline = [
            {
                $vectorSearch: {
                    index: "memory_vector_index",
                    path: "embedding",
                    queryVector: embedding,
                    numCandidates: 10,
                    limit: 1,
                    filter: { user: userId }
                }
            },
            {
                $addFields: { score: { $meta: "vectorSearchScore" } }
            }
        ];

        const topMatches = await Memory.aggregate(pipeline);

        if (topMatches.length > 0 && topMatches[0].score > DEDUPLICATION_THRESHOLD) {
            // It's a duplicate, just update the timestamp
            const existingMemory = topMatches[0];
            const updatedCategory = memoryObj.category || existingMemory.category;
            await Memory.findByIdAndUpdate(existingMemory._id, {
                lastAccessedAt: new Date(),
                category: updatedCategory // optionally update category
            });
            return { memory: { ...existingMemory, category: updatedCategory }, created: false };
        }

        const validCategories = ["PROFILE", "PREFERENCE", "GOAL", "PROJECT", "SKILL", "OTHER"];
        const finalCategory = validCategories.includes(memoryObj.category) ? memoryObj.category : "OTHER";

        // Create new memory
        const newMemory = await Memory.create({
            user: userId,
            content: memoryObj.content,
            category: finalCategory,
            embedding: embedding
        });

        // Cap Enforcement
        const count = await Memory.countDocuments({ user: userId });
        if (count > MAX_MEMORIES) {
            const overflow = count - MAX_MEMORIES;
            // Find oldest accessed, then oldest created to delete
            const oldestMemories = await Memory.find({ user: userId })
                .sort({ lastAccessedAt: 1, createdAt: 1 })
                .limit(overflow)
                .select('_id');
            
            const idsToDelete = oldestMemories.map(m => m._id);
            await Memory.deleteMany({ _id: { $in: idsToDelete } });
        }

        return { memory: newMemory, created: true };
    } catch (err) {
        console.error("Error in saveMemory:", err);
        return null;
    }
};

/** Returns the stored memory document (or null). Kept for existing callers. */
export const saveMemory = async (userId, memoryObj) => {
    const result = await saveMemoryWithStatus(userId, memoryObj);
    return result?.memory ?? null;
};

/**
 * List a user's memories newest-access first, without embeddings.
 * Embeddings are 768 floats and must never leave the server.
 */
export const listMemories = async (userId, limit = 500) => {
    return Memory.find({ user: userId })
        .select("-embedding")
        .sort({ lastAccessedAt: -1, createdAt: -1 })
        .limit(limit)
        .lean();
};

/** Delete one memory, scoped to its owner. Returns null when nothing matched. */
export const deleteMemory = async (userId, memoryId) => {
    if (!mongoose.Types.ObjectId.isValid(memoryId)) return null;
    return Memory.findOneAndDelete({ _id: memoryId, user: userId });
};

/** Delete every memory for a user. Returns the number removed. */
export const clearMemories = async (userId) => {
    const result = await Memory.deleteMany({ user: userId });
    return result.deletedCount ?? 0;
};

