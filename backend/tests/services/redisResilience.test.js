import { jest } from "@jest/globals";

// Mock dependencies
jest.unstable_mockModule("../../config/redis.js", () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

jest.unstable_mockModule("../../src/services/notes.service.js", () => ({
  findUserNotes: jest.fn(),
  findArchivedNotes: jest.fn(),
  findNotesById: jest.fn(),
  removeNote: jest.fn(),
  createNewNote: jest.fn(),
  getNoteContentForUser: jest.fn(),
  searchNote: jest.fn(),
}));

jest.unstable_mockModule("../../src/services/folder.service.js", () => ({
  getUserFolders: jest.fn(),
  createFolder: jest.fn(),
  getFolderById: jest.fn(),
  getNotesByFolder: jest.fn(),
  updateFolderWithVersion: jest.fn(),
  removeFolderAndNotes: jest.fn(),
  findSharedNoteSlugsInFolder: jest.fn(),
}));

jest.unstable_mockModule("../../src/services/trash.service.js", () => ({
  emptyTrash: jest.fn(),
  getTrashItems: jest.fn(),
  permanentlyDeleteFolderAndNotes: jest.fn(),
  restoreNote: jest.fn(),
  restoreFolderAndNotes: jest.fn(),
}));

const { redis } = await import("../../config/redis.js");
const NoteService = await import("../../src/services/notes.service.js");
const FolderService = await import("../../src/services/folder.service.js");
const TrashService = await import("../../src/services/trash.service.js");

const { getAllNotes, getArchivedNotes } = await import(
  "../../src/controllers/notes.controller.js"
);
const { getAllFolders } = await import(
  "../../src/controllers/folder.controller.js"
);
const { emptyTrash } = await import(
  "../../src/controllers/trash.controller.js"
);
const { toolExecutor } = await import(
  "../../src/services/ai/tools/toolExecutor.js"
);

describe("Redis Resilience and Fallbacks", () => {
  const userId = "user123";
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { _id: userId },
      body: {},
      params: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const callController = (ctrl, req, res) =>
    new Promise((resolve, reject) => {
      res.json = jest.fn((data) => {
        resolve(data);
        return res;
      });
      const next = (err) => (err ? reject(err) : resolve());
      ctrl(req, res, next);
    });

  describe("getAllNotes", () => {
    it("falls back to database when redis.get throws a network error", async () => {
      redis.get.mockRejectedValue(new Error("Connection reset by peer"));
      const mockNotes = [{ _id: "n1", title: "Fallback Note" }];
      NoteService.findUserNotes.mockResolvedValue(mockNotes);

      await callController(getAllNotes, req, res);

      expect(NoteService.findUserNotes).toHaveBeenCalledWith(userId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockNotes);
    });

    it("serves from redis cache on cache hit", async () => {
      const cached = [{ _id: "n1", title: "Cached Note" }];
      redis.get.mockResolvedValue(cached);

      await callController(getAllNotes, req, res);

      expect(NoteService.findUserNotes).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(cached);
    });
  });

  describe("getArchivedNotes", () => {
    it("falls back to database when redis.get throws a timeout error", async () => {
      redis.get.mockRejectedValue(new Error("Upstash read timeout"));
      const mockArchived = [{ _id: "n2", title: "Archived Note" }];
      NoteService.findArchivedNotes.mockResolvedValue(mockArchived);

      await callController(getArchivedNotes, req, res);

      expect(NoteService.findArchivedNotes).toHaveBeenCalledWith(userId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockArchived);
    });
  });

  describe("getAllFolders", () => {
    it("falls back to database when redis throws an error", async () => {
      redis.get.mockRejectedValue(new Error("Redis ECONNREFUSED"));
      const mockFolders = [{ _id: "f1", name: "Folder 1" }];
      FolderService.getUserFolders.mockResolvedValue(mockFolders);
      redis.set.mockRejectedValue(new Error("Redis write failure"));

      await callController(getAllFolders, req, res);

      expect(FolderService.getUserFolders).toHaveBeenCalledWith(userId);
      expect(res.json).toHaveBeenCalledWith(mockFolders);
    });
  });

  describe("emptyTrash", () => {
    it("invalidates notes, notes:archive, and folders caches", async () => {
      TrashService.emptyTrash.mockResolvedValue({ deletedNotesCount: 2, deletedFoldersCount: 1 });
      redis.del.mockResolvedValue(1);

      await callController(emptyTrash, req, res);

      expect(TrashService.emptyTrash).toHaveBeenCalledWith(userId);
      expect(redis.del).toHaveBeenCalledWith(`notes:${userId}`);
      expect(redis.del).toHaveBeenCalledWith(`notes:archive:${userId}`);
      expect(redis.del).toHaveBeenCalledWith(`folders:${userId}`);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("does not fail the request if redis.del rejects", async () => {
      TrashService.emptyTrash.mockResolvedValue({ deletedNotesCount: 0, deletedFoldersCount: 0 });
      redis.del.mockRejectedValue(new Error("Redis offline"));

      await callController(emptyTrash, req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "All Cleared!",
        })
      );
    });
  });

  describe("toolExecutor delete_note", () => {
    it("invalidates both notes and notes:archive caches on deletion", async () => {
      NoteService.findNotesById.mockResolvedValue({
        _id: "note999",
        title: "Test Note",
        version: 1,
      });
      NoteService.removeNote.mockResolvedValue({
        _id: "note999",
        isDeleted: true,
      });
      redis.del.mockResolvedValue(1);

      const result = await toolExecutor.execute({
        toolName: "delete_note",
        args: { noteId: "note999" },
        userId,
      });

      expect(result.deleted).toBe(true);
      expect(redis.del).toHaveBeenCalledWith(`notes:${userId}`);
      expect(redis.del).toHaveBeenCalledWith(`notes:archive:${userId}`);
    });
  });
});
