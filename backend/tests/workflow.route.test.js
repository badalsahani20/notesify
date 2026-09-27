import request from "supertest";
import jwt from "jsonwebtoken";

import app from "../app.js";
import User from "../src/models/user.model.js";
import Workflow from "../src/models/workflow.model.js";

describe("Workflow API", () => {
    let user;
    let accessToken;

    beforeEach(async () => {
        user = await User.create({
            name: "Test User",
            email: "workflow-test@example.com",
            password: "password123",
            isVerified: true,
        });

        accessToken = jwt.sign(
            { id: user._id },
            process.env.ACCESS_SECRET,
            { expiresIn: "1h" },
        );
    });

    it("creates a workflow", async () => {
        const response = await request(app)
            .post("/api/workflows")
            .set("Authorization", `Bearer ${accessToken}`)
            .send({
                title: "Learn MongoDB",
                phases: [
                    {
                        id: "phase-1",
                        title: "Fundamentals",
                        tasks: [
                            {
                                id: "task-1",
                                title: "Documents",
                                concept: "MongoDB documents",
                                order: 1,
                            },
                        ],
                    },
                ],
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);

        expect(response.body.workflow).toEqual(
            expect.objectContaining({
                title: "Learn MongoDB",
                status: "DRAFT",
                version: 0,
            }),
        );

        const stored = await Workflow.findOne({
            id: response.body.workflow.id,
        }).lean();

        expect(stored).not.toBeNull();
        expect(stored.title).toBe("Learn MongoDB");
        expect(stored.user.toString()).toBe(user._id.toString());
    });

    it("lists workflows belonging only to the authenticated user", async () => {
        await Workflow.create({
            id: "workflow-1",
            user: user._id,
            title: "Learn MongoDB",
            phases: [],
            status: "DRAFT",
            version: 0,
        });

        const otherUser = await User.create({
            name: "Other User",
            email: "other@example.com",
            password: "password123",
            isVerified: true,
        });

        await Workflow.create({
            id: "workflow-2",
            user: otherUser._id,
            title: "Learn Docker",
            phases: [],
            status: "DRAFT",
            version: 0,
        });

        const response = await request(app)
            .get("/api/workflows")
            .set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.workflows).toHaveLength(1);
        expect(response.body.workflows[0].title).toBe("Learn MongoDB");
    });

    it("gets a workflow belonging to the authenticated user", async () => {
        await Workflow.create({
            id: "workflow-1",
            user: user._id,
            title: "Learn MongoDB",
            phases: [],
            status: "DRAFT",
            version: 0,
        });

        const response = await request(app)
            .get("/api/workflows/workflow-1")
            .set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.workflow.id).toBe("workflow-1");
    });

    it("does not expose another user's workflow", async () => {
        const otherUser = await User.create({
            name: "Other User",
            email: "other@example.com",
            password: "password123",
            isVerified: true,
        });

        await Workflow.create({
            id: "workflow-2",
            user: otherUser._id,
            title: "Private Workflow",
            phases: [],
            status: "DRAFT",
            version: 0,
        });

        const response = await request(app)
            .get("/api/workflows/workflow-2")
            .set("Authorization", `Bearer ${accessToken}`);

        expect(response.status).toBe(404);
    });

    it("transitions a workflow through the API", async () => {
        await Workflow.create({
            id: "workflow-1",
            user: user._id,
            title: "Learn MongoDB",
            phases: [],
            status: "DRAFT",
            version: 0,
        });

        const response = await request(app)
            .post("/api/workflows/workflow-1/transition")
            .set("Authorization", `Bearer ${accessToken}`)
            .send({
                command: "START_WORKFLOW",
                expectedVersion: 0,
            });

        expect(response.status).toBe(200);

        expect(response.body.workflow.status).toBe("ACTIVE");
        expect(response.body.workflow.version).toBe(1);

        const stored = await Workflow.findOne({
            id: "workflow-1",
        }).lean();

        expect(stored.status).toBe("ACTIVE");
        expect(stored.version).toBe(1);
    });

    it("returns 409 for a stale workflow version", async () => {
        await Workflow.create({
            id: "workflow-1",
            user: user._id,
            title: "Learn MongoDB",
            phases: [],
            status: "DRAFT",
            version: 1,
        });

        const response = await request(app)
            .post("/api/workflows/workflow-1/transition")
            .set("Authorization", `Bearer ${accessToken}`)
            .send({
                command: "START_WORKFLOW",
                expectedVersion: 0,
            });

        expect(response.status).toBe(409);
        expect(response.body.message).toMatch(/version conflict/i);
    });

    it("rejects unauthenticated workflow access", async () => {
        const response = await request(app)
            .get("/api/workflows");

        expect(response.status).toBe(401);
    });

    it("rejects malformed workflow creation", async () => {
        const response = await request(app)
            .post("/api/workflows")
            .set("Authorization", `Bearer ${accessToken}`)
            .send({
                title: "",
                phases: [],
            });

        expect(response.status).toBe(400);
    });
});
