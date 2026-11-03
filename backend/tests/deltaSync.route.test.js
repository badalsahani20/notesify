import request from "supertest";
import jwt from "jsonwebtoken";

import app from "../app.js";
import User from "../src/models/user.model.js";
import Notes from "../src/models/notes.model.js";
import DeletedNote from "../src/models/deletedNote.model.js";
import * as NoteService from "../src/services/notes.service.js";

const createUserAndToken = async (email = "delta-test@example.com") => {
    const user = await User.create({
        name: "Delta Test User",
        email,
        password: "password123",
        isVerified: true,
    });

    const accessToken = jwt.sign(
        { id: user._id },
        process.env.ACCESS_SECRET,
        { expiresIn: "1h" }
    );

    return { user, accessToken };
};

const setUpdatedAt = async (noteId, date) => {
    await Notes.collection.updateOne(
        { _id: noteId },
        { $set: { updatedAt: date } }
    );
};

const sync = (accessToken, query = {}) =>
    request(app)
        .get("/api/notes/sync")
        .set("Authorization", `Bearer ${accessToken}`)
        .query(query);

describe("Delta note sync API", () => {
    it("returns changed notes including archived and trashed notes, without embeddings", async () => {
        const { user, accessToken } = await createUserAndToken();
        const since = new Date(Date.now() - 60_000).toISOString();

        const unchanged = await Notes.create({
            user: user._id,
            title: "Old note",
            content: "unchanged",
        });
        await setUpdatedAt(unchanged._id, new Date(Date.now() - 60 * 60_000));

        const active = await Notes.create({
            user: user._id,
            title: "Active changed",
            content: "active",
            embedding: [0.1, 0.2, 0.3],
        });
        const archived = await Notes.create({
            user: user._id,
            title: "Archived changed",
            content: "archived",
            isArchived: true,
        });
        const trashed = await Notes.create({
            user: user._id,
            title: "Trashed changed",
            content: "trashed",
            isDeleted: true,
        });

        const response = await sync(accessToken, { since });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.hasMore).toBe(false);
        expect(response.body.highWaterMark).toEqual(expect.any(String));
        expect(response.body.notes).toHaveLength(3);

        const ids = response.body.notes.map((note) => note._id);
        expect(ids).toEqual(
            expect.arrayContaining([
                active._id.toString(),
                archived._id.toString(),
                trashed._id.toString(),
            ])
        );
        expect(ids).not.toContain(unchanged._id.toString());
        expect(
            response.body.notes.every((note) => !("embedding" in note))
        ).toBe(true);
    });

    it("returns tombstones for hard-deleted notes", async () => {
        const { user, accessToken } = await createUserAndToken();
        const since = new Date(Date.now() - 60_000).toISOString();

        const note = await Notes.create({
            user: user._id,
            title: "Hard delete me",
            content: "gone",
            isDeleted: true,
        });

        const removed = await NoteService.permanentlyRemoveNote(
            note._id,
            user._id
        );
        expect(removed).not.toBeNull();

        const tombstone = await DeletedNote.findOne({
            user: user._id,
            noteId: note._id,
        }).lean();
        expect(tombstone).not.toBeNull();

        const response = await sync(accessToken, { since });

        expect(response.status).toBe(200);
        expect(response.body.notes).toHaveLength(0);
        expect(response.body.deletedIds).toContain(note._id.toString());
    });

    it("paginates changes without duplicates or gaps", async () => {
        const { user, accessToken } = await createUserAndToken();
        const since = new Date(Date.now() - 60_000).toISOString();
        const sharedTimestamp = new Date();

        const created = [];
        for (let i = 0; i < 5; i += 1) {
            const note = await Notes.create({
                user: user._id,
                title: `Note ${i}`,
                content: `content ${i}`,
            });
            await setUpdatedAt(note._id, sharedTimestamp);
            created.push(note._id.toString());
        }

        const collected = [];
        const highWaterMarks = new Set();
        let page = null;
        let finalCursor = null;

        do {
            const query = { since, limit: 2 };
            if (page) query.page = page;

            const response = await sync(accessToken, query);
            expect(response.status).toBe(200);

            highWaterMarks.add(response.body.highWaterMark);
            collected.push(
                ...response.body.notes.map((note) => note._id)
            );

            finalCursor = response.body.highWaterMark;
            page = response.body.hasMore ? response.body.nextPage : null;
            expect(response.body.hasMore ? Boolean(page) : page === null).toBe(
                true
            );
        } while (page);

        expect(collected).toHaveLength(5);
        expect(new Set(collected).size).toBe(5);
        expect(collected.sort()).toEqual(created.sort());
        expect(finalCursor).toEqual(expect.any(String));
        // The whole pagination session must agree on one mark, otherwise a
        // note written mid-pagination can slip behind the final cursor.
        expect(highWaterMarks.size).toBe(1);
    });

    it("does not leak notes or tombstones across users", async () => {
        const { accessToken } = await createUserAndToken(
            "delta-owner@example.com"
        );
        const { user: otherUser } = await createUserAndToken(
            "delta-other@example.com"
        );
        const since = new Date(Date.now() - 60_000).toISOString();

        const otherNote = await Notes.create({
            user: otherUser._id,
            title: "Other user note",
            content: "secret",
        });
        const otherDeleted = await Notes.create({
            user: otherUser._id,
            title: "Other user deleted",
            content: "secret",
            isDeleted: true,
        });
        await NoteService.permanentlyRemoveNote(
            otherDeleted._id,
            otherUser._id
        );

        const response = await sync(accessToken, { since });

        expect(response.status).toBe(200);
        expect(response.body.notes).toHaveLength(0);
        expect(response.body.deletedIds).toHaveLength(0);
        expect(response.body.deletedIds).not.toContain(
            otherDeleted._id.toString()
        );
        expect(response.body.notes).not.toContainEqual(
            expect.objectContaining({ _id: otherNote._id.toString() })
        );
    });

    it("includes legacy notes whose isDeleted/isArchived fields are missing", async () => {
        const { user, accessToken } = await createUserAndToken();
        const since = new Date(Date.now() - 60_000).toISOString();

        const note = await Notes.create({
            user: user._id,
            title: "Legacy note",
            content: "legacy",
        });

        await Notes.collection.updateOne(
            { _id: note._id },
            {
                $unset: { isDeleted: "", isArchived: "" },
                $set: { updatedAt: new Date() },
            }
        );

        const response = await sync(accessToken, { since });

        expect(response.status).toBe(200);
        expect(response.body.notes.map((item) => item._id)).toContain(
            note._id.toString()
        );
    });

    it("returns 410 when the cursor is older than tombstone retention", async () => {
        const { accessToken } = await createUserAndToken();
        const since = new Date(
            Date.now() - 100 * 24 * 60 * 60 * 1000
        ).toISOString();

        const response = await sync(accessToken, { since });

        expect(response.status).toBe(410);
    });

    it("rejects invalid since and page values", async () => {
        const { accessToken } = await createUserAndToken();

        const badSince = await sync(accessToken, { since: "not-a-date" });
        expect(badSince.status).toBe(400);

        const badPage = await sync(accessToken, { page: "not-a-cursor" });
        expect(badPage.status).toBe(400);
    });
});
