import catchAsync from "../utils/catchAsync.js";
import { clearMemories, deleteMemory, listMemories } from "../services/memoryService.js";

// Public shape of a memory. `embedding` is deliberately never included.
const toMemoryResponse = (memory) => ({
  id: memory._id,
  content: memory.content,
  category: memory.category,
  createdAt: memory.createdAt,
  lastAccessedAt: memory.lastAccessedAt,
});

export const getMemories = catchAsync(async (req, res) => {
  const memories = await listMemories(req.user._id);

  res.status(200).json({
    success: true,
    count: memories.length,
    memories: memories.map(toMemoryResponse),
  });
});

export const removeMemory = catchAsync(async (req, res) => {
  const deleted = await deleteMemory(req.user._id, req.params.id);

  if (!deleted) {
    return res.status(404).json({ success: false, message: "Memory not found" });
  }

  res.status(200).json({ success: true, message: "Memory deleted" });
});

export const removeAllMemories = catchAsync(async (req, res) => {
  const deletedCount = await clearMemories(req.user._id);

  res.status(200).json({ success: true, deletedCount });
});
