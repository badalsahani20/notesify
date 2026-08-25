import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import verifiedMiddleware from "../middleware/verified.middleware.js";
import { createNote, deleteNote, getAllNotes, getArchivedNotes, toggleArchive, togglePin, updateNote, getNoteById, searchAllNotes, toggleNoteShare, generateNoteTitleController } from "../controllers/notes.controller.js";

const router = express.Router();
router.use(authMiddleware);
router.use(verifiedMiddleware);

router.get("/search", searchAllNotes);
router.get("/archive", getArchivedNotes);

router.get("/", getAllNotes);

router.post("/", createNote);
router.post("/generate-title", generateNoteTitleController);
router.post("/:id/share", toggleNoteShare);

router.get("/:id", getNoteById);

router.put("/:id", updateNote);

router.delete("/:id", deleteNote);

router.patch("/:id/pin", togglePin);
router.patch("/:id/archive", toggleArchive);

export default router;
