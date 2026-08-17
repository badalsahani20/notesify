import { create } from "zustand";
import type { IrisSegment } from "@/components/ai/types";

export interface Note {
  _id: string;
  title: string;
  content: string;
  folder: string | null;
  color: string;
  pinned: boolean;
  version: number;
  isDeleted: boolean;
  isArchived: boolean;
  updatedAt: string;
  lastAccessedAt: string | null;
  isShared?: boolean;
  shareSlug?: string;
  shareExpiresAt?: string | null;
  shareViews?: number;
  chatHistory?: { id: string; role: 'user' | 'assistant'; content: string; segments?: IrisSegment[] }[];
}

export interface TrashFolder {
  _id: string;
  name: string;
  color: string;
  version: number;
  pinned: boolean;
  isDeleted: boolean;
  updatedAt: string;
  createdAt: string;
}

interface NoteState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeNoteId: string | null;
  setActiveNoteId: (id: string | null) => void;
  reset: () => void;
}

export const useNoteStore = create<NoteState>((set) => ({
  searchQuery: "",
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  activeNoteId: null,
  setActiveNoteId: (id: string | null) => set({ activeNoteId: id }),
  reset: () => set({ searchQuery: "", activeNoteId: null }),
}));
