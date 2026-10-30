import { jest } from '@jest/globals';
import mongoose from 'mongoose';

// Mock dependencies
jest.unstable_mockModule('../../src/services/notes.service.js', () => ({
  getNoteContentForUser: jest.fn(),
  searchNote: jest.fn(),
}));

jest.unstable_mockModule('../../src/services/memoryService.js', () => ({
  searchMemories: jest.fn(),
  saveMemoryWithStatus: jest.fn(),
}));

// Dynamic imports
const { getNoteContentForUser, searchNote } = await import('../../src/services/notes.service.js');
const { searchMemories, saveMemoryWithStatus } = await import('../../src/services/memoryService.js');
const { toolExecutor } = await import('../../src/services/ai/tools/toolExecutor.js');
const { CHAT_TOOLS, searchNotesTool } = await import('../../src/services/ai/tools/chatTools.js');

describe('ToolExecutor - search_notes & chat tools', () => {
  const userId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CHAT_TOOLS schema', () => {
    it('should include searchNotesTool in CHAT_TOOLS', () => {
      const found = CHAT_TOOLS.find((t) => t.function?.name === 'search_notes');
      expect(found).toBeDefined();
      expect(found.function.parameters.required).toContain('query');
      expect(searchNotesTool.function.name).toBe('search_notes');
    });
  });

  describe('search_notes execution', () => {
    it('should return error when query is missing or empty', async () => {
      const res1 = await toolExecutor.execute({
        toolName: 'search_notes',
        args: {},
        userId,
      });
      expect(res1.error).toMatch(/missing search query/i);

      const res2 = await toolExecutor.execute({
        toolName: 'search_notes',
        args: { query: '   ' },
        userId,
      });
      expect(res2.error).toMatch(/missing search query/i);
    });

    it('should return 0 count message when no notes match', async () => {
      searchNote.mockResolvedValue([]);

      const result = await toolExecutor.execute({
        toolName: 'search_notes',
        args: { query: 'quantum computing' },
        userId,
      });

      expect(searchNote).toHaveBeenCalledWith(userId, 'quantum computing');
      expect(result).toEqual({
        count: 0,
        message: 'No notes found matching "quantum computing".',
      });
    });

    it('should strip HTML, truncate long snippets, and return formatted noteId', async () => {
      const longText = 'A'.repeat(300);
      const mockNotes = [
        {
          _id: new mongoose.Types.ObjectId('65a1234567890123456789ab'),
          title: 'Docker Setup',
          content: '<p>Getting started with <strong>Docker Compose</strong> and multi-stage builds.</p>',
          updatedAt: new Date('2026-01-01'),
        },
        {
          _id: new mongoose.Types.ObjectId('65a9876543210987654321fe'),
          title: '', // Untitled fallback
          content: `<div>${longText}</div>`,
          updatedAt: new Date('2026-01-02'),
        },
      ];

      searchNote.mockResolvedValue(mockNotes);

      const result = await toolExecutor.execute({
        toolName: 'search_notes',
        args: { query: 'docker' },
        userId,
      });

      expect(result.count).toBe(2);
      expect(result.notes[0]).toEqual({
        noteId: '65a1234567890123456789ab',
        title: 'Docker Setup',
        snippet: 'Getting started with Docker Compose and multi-stage builds.',
        updatedAt: mockNotes[0].updatedAt,
      });

      // Check untitled title fallback and 200 char snippet truncation with ellipsis
      expect(result.notes[1].title).toBe('Untitled');
      expect(result.notes[1].snippet.length).toBe(203); // 200 chars + '...'
      expect(result.notes[1].snippet.endsWith('...')).toBe(true);
    });

    it('should cap results to top 5 notes', async () => {
      const mockNotes = Array.from({ length: 8 }, (_, i) => ({
        _id: new mongoose.Types.ObjectId(),
        title: `Note ${i + 1}`,
        content: `Content for note ${i + 1}`,
        updatedAt: new Date(),
      }));

      searchNote.mockResolvedValue(mockNotes);

      const result = await toolExecutor.execute({
        toolName: 'search_notes',
        args: { query: 'test' },
        userId,
      });

      expect(result.count).toBe(5);
      expect(result.notes).toHaveLength(5);
    });

    it('should catch errors from searchNote service gracefully', async () => {
      searchNote.mockRejectedValue(new Error('Database timeout'));

      const result = await toolExecutor.execute({
        toolName: 'search_notes',
        args: { query: 'docker' },
        userId,
      });

      expect(result).toEqual({
        error: 'Failed to search notes: Database timeout',
      });
    });
  });

  describe('get_note_content execution', () => {
    it('should use fallbackNoteId when noteId is omitted', async () => {
      const fallbackId = '65afallback01234567890ab';
      getNoteContentForUser.mockResolvedValue({
        noteId: fallbackId,
        title: 'Active Note',
        content: 'Active content',
      });

      const result = await toolExecutor.execute({
        toolName: 'get_note_content',
        args: {},
        userId,
        fallbackNoteId: fallbackId,
      });

      expect(getNoteContentForUser).toHaveBeenCalledWith(fallbackId, userId);
      expect(result.title).toBe('Active Note');
    });
  });

  describe('save_memory execution', () => {
    it('persists a new memory and reports it as created', async () => {
      saveMemoryWithStatus.mockResolvedValue({
        memory: { _id: 'm1', category: 'GOAL', content: 'Preparing for GATE' },
        created: true,
      });

      const result = await toolExecutor.execute({
        toolName: 'save_memory',
        args: { category: 'GOAL', content: '  Preparing for GATE  ' },
        userId,
      });

      expect(saveMemoryWithStatus).toHaveBeenCalledWith(userId, {
        category: 'GOAL',
        content: 'Preparing for GATE',
      });
      expect(result).toEqual({
        saved: true,
        created: true,
        category: 'GOAL',
        content: 'Preparing for GATE',
      });
    });

    it('reports a deduplicated hit without exposing the stored embedding', async () => {
      saveMemoryWithStatus.mockResolvedValue({
        memory: {
          _id: 'm1',
          category: 'GOAL',
          content: 'Preparing for GATE',
          embedding: [0.1, 0.2, 0.3],
        },
        created: false,
      });

      const result = await toolExecutor.execute({
        toolName: 'save_memory',
        args: { category: 'GOAL', content: 'Preparing for the GATE exam' },
        userId,
      });

      expect(result.created).toBe(false);
      expect(result.saved).toBe(true);
      expect(result.embedding).toBeUndefined();
    });

    it('rejects missing content without calling the service', async () => {
      const result = await toolExecutor.execute({
        toolName: 'save_memory',
        args: { category: 'GOAL', content: '   ' },
        userId,
      });

      expect(result.error).toMatch(/missing content/i);
      expect(saveMemoryWithStatus).not.toHaveBeenCalled();
    });

    it('surfaces a failed write as an error', async () => {
      saveMemoryWithStatus.mockResolvedValue(null);

      const result = await toolExecutor.execute({
        toolName: 'save_memory',
        args: { category: 'GOAL', content: 'Preparing for GATE' },
        userId,
      });

      expect(result.error).toMatch(/failed to save memory/i);
    });
  });
});
