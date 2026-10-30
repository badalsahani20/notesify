import { jest } from '@jest/globals';
import mongoose from 'mongoose';

// Mock the dependencies
jest.unstable_mockModule('../../src/services/embeddingService.js', () => ({
  generateEmbedding: jest.fn()
}));

// Dynamic imports after mocking
const { generateEmbedding } = await import('../../src/services/embeddingService.js');
const { saveMemory, listMemories, deleteMemory, clearMemories } = await import('../../src/services/memoryService.js');
const { default: Memory } = await import('../../src/models/Memory.js');

describe('MemoryService', () => {
  let userId;

  beforeEach(() => {
    jest.clearAllMocks();
    userId = new mongoose.Types.ObjectId();
    
    // Mock Atlas-specific $vectorSearch so it doesn't crash mongodb-memory-server
    jest.spyOn(Memory, 'aggregate').mockResolvedValue([]);
  });

  describe('saveMemory', () => {
    it('should save a new memory when no duplicate exists', async () => {
      generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      Memory.aggregate.mockResolvedValue([]); // No duplicates

      const result = await saveMemory(userId, { category: 'SKILL', content: 'Testing' });

      expect(generateEmbedding).toHaveBeenCalledWith('Testing');
      expect(result.content).toBe('Testing');
      expect(result.category).toBe('SKILL');

      const count = await Memory.countDocuments({ user: userId });
      expect(count).toBe(1);
    });

    it('should update lastAccessedAt if it is a duplicate (>0.95 threshold)', async () => {
      generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      
      const existingId = new mongoose.Types.ObjectId();
      await Memory.create({
        _id: existingId,
        user: userId,
        content: 'Original',
        category: 'SKILL',
        embedding: [0.1, 0.2, 0.3],
        lastAccessedAt: new Date(2020, 1, 1)
      });

      // Mock Vector Search to return the existing document with score > 0.95
      Memory.aggregate.mockResolvedValue([{
        _id: existingId,
        score: 0.96,
        category: 'SKILL'
      }]);

      const result = await saveMemory(userId, { category: 'SKILL', content: 'Original' });

      expect(result._id.toString()).toBe(existingId.toString());

      const updated = await Memory.findById(existingId);
      expect(updated.lastAccessedAt.getTime()).toBeGreaterThan(new Date(2020, 1, 1).getTime());
      
      const count = await Memory.countDocuments({ user: userId });
      expect(count).toBe(1); // Didn't create a new one
    });
  });

  describe('listMemories', () => {
    it('returns only the user\'s memories, newest access first, without embeddings', async () => {
      await Memory.create({
        user: userId,
        content: 'Older goal',
        category: 'GOAL',
        embedding: [0.1, 0.2],
        lastAccessedAt: new Date(2020, 1, 1),
      });
      await Memory.create({
        user: userId,
        content: 'Newer skill',
        category: 'SKILL',
        embedding: [0.3, 0.4],
        lastAccessedAt: new Date(2024, 1, 1),
      });
      await Memory.create({
        user: new mongoose.Types.ObjectId(),
        content: 'Someone else',
        category: 'OTHER',
        embedding: [0.5, 0.6],
      });

      const results = await listMemories(userId);

      expect(results.map((m) => m.content)).toEqual(['Newer skill', 'Older goal']);
      expect(results[0].embedding).toBeUndefined();
    });
  });

  describe('deleteMemory', () => {
    it('deletes the owner\'s memory', async () => {
      const memory = await Memory.create({
        user: userId,
        content: 'Delete me',
        category: 'OTHER',
        embedding: [0.1],
      });

      const deleted = await deleteMemory(userId, memory._id.toString());

      expect(deleted).not.toBeNull();
      expect(await Memory.findById(memory._id)).toBeNull();
    });

    it('refuses to delete another user\'s memory', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const memory = await Memory.create({
        user: otherUserId,
        content: 'Not yours',
        category: 'OTHER',
        embedding: [0.1],
      });

      const deleted = await deleteMemory(userId, memory._id.toString());

      expect(deleted).toBeNull();
      expect(await Memory.findById(memory._id)).not.toBeNull();
    });

    it('returns null for an invalid id', async () => {
      expect(await deleteMemory(userId, 'not-an-object-id')).toBeNull();
    });
  });

  describe('clearMemories', () => {
    it('removes only the user\'s memories', async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      await Memory.create({ user: userId, content: 'A', category: 'OTHER', embedding: [0.1] });
      await Memory.create({ user: userId, content: 'B', category: 'OTHER', embedding: [0.2] });
      await Memory.create({ user: otherUserId, content: 'C', category: 'OTHER', embedding: [0.3] });

      const deletedCount = await clearMemories(userId);

      expect(deletedCount).toBe(2);
      expect(await Memory.countDocuments({ user: userId })).toBe(0);
      expect(await Memory.countDocuments({ user: otherUserId })).toBe(1);
    });
  });
});
