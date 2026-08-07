import { db } from "@/database/database";
import type { Note } from "@/store/useNoteStore";

export class LocalNoteDataSource {
  async getAll(): Promise<Note[]> {
    const notes = await db.notes.toArray();

    // 1. Pinned notes first
    // 2. Then sort by most recently updated
    return notes.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  async getById(id: string): Promise<Note | undefined> {
    return db.notes.get(id);
  }

  async save(note: Note): Promise<void> {
    await db.notes.put(note);
  }

  async saveMany(notes: Note[]): Promise<void> {
    await db.notes.bulkPut(notes);
  }

  async delete(id: string): Promise<void> {
    await db.notes.delete(id);
  }
}