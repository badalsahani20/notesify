import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ToolExecutor } from "../../src/services/ai/tools/toolExecutor.js";
import { WorkflowService } from "../../src/services/ai/workflow/workflowService.js";
import { InMemoryWorkflowRepository } from "../../src/services/ai/workflow/repository/inMemoryWorkflowRepository.js";
import { COMMAND, WORKFLOW_STATUS } from "../../src/services/ai/workflow/domain/workflowConstants.js";
import { WORKFLOW_REPOSITORY_ERROR } from "../../src/services/ai/workflow/repository/workflowRepositoryErrors.js";

describe("ToolExecutor", () => {
  let repository;
  let workflowService;
  let mockGetNoteContent;
  let executor;

  beforeEach(() => {
    repository = new InMemoryWorkflowRepository();
    workflowService = new WorkflowService(repository);
    mockGetNoteContent = jest.fn();
    executor = new ToolExecutor({
      workflowService,
      getNoteContent: mockGetNoteContent,
    });
  });

  describe("get_note_content", () => {
    it("returns note content when note exists and user is authorized", async () => {
      const mockNote = { _id: "note-1", title: "Test Note", content: "Note body" };
      mockGetNoteContent.mockResolvedValue(mockNote);

      const result = await executor.execute({
        toolName: "get_note_content",
        args: { noteId: "note-1" },
        userId: "user-1",
      });

      expect(mockGetNoteContent).toHaveBeenCalledWith("note-1", "user-1");
      expect(result).toEqual(mockNote);
    });

    it("uses fallbackNoteId when args.noteId is not provided", async () => {
      const mockNote = { _id: "note-fallback", title: "Fallback Note" };
      mockGetNoteContent.mockResolvedValue(mockNote);

      const result = await executor.execute({
        toolName: "get_note_content",
        args: {},
        userId: "user-1",
        fallbackNoteId: "note-fallback",
      });

      expect(mockGetNoteContent).toHaveBeenCalledWith("note-fallback", "user-1");
      expect(result).toEqual(mockNote);
    });

    it("returns error when neither noteId nor fallbackNoteId is provided", async () => {
      const result = await executor.execute({
        toolName: "get_note_content",
        args: {},
        userId: "user-1",
      });

      expect(result).toEqual({ error: "Missing noteId for get_note_content." });
      expect(mockGetNoteContent).not.toHaveBeenCalled();
    });

    it("returns error when note is not found or unauthorized", async () => {
      mockGetNoteContent.mockResolvedValue(null);

      const result = await executor.execute({
        toolName: "get_note_content",
        args: { noteId: "note-404" },
        userId: "user-1",
      });

      expect(result).toEqual({ error: 'Note "note-404" not found or unauthorized.' });
    });

    it("returns error when note fetch throws", async () => {
      mockGetNoteContent.mockRejectedValue(new Error("Database connection lost"));

      const result = await executor.execute({
        toolName: "get_note_content",
        args: { noteId: "note-1" },
        userId: "user-1",
      });

      expect(result).toEqual({ error: "Failed to fetch note: Database connection lost" });
    });
  });

  describe("create_workflow", () => {
    it("creates and stores a new workflow via WorkflowService", async () => {
      const phases = [
        {
          id: "phase-1",
          title: "Phase 1",
          tasks: [
            { id: "task-1", title: "Task 1", concept: "Concept 1", order: 1 },
          ],
        },
      ];

      const result = await executor.execute({
        toolName: "create_workflow",
        args: {
          title: "Master Node.js",
          phases,
          sessionId: "session-123",
        },
        userId: "user-1",
      });

      expect(result).toBeDefined();
      expect(typeof result.id).toBe("string");
      expect(result.id.length).toBeGreaterThan(0);
      expect(result.title).toBe("Master Node.js");
      expect(result.userId).toBe("user-1");
      expect(result.sessionId).toBe("session-123");
      expect(result.status).toBe(WORKFLOW_STATUS.DRAFT);
      expect(result.version).toBe(0);
      expect(result.phases).toEqual(phases);

      // Verify stored in repository
      const stored = await repository.getById(result.id, "user-1");
      expect(stored).toEqual(result);
    });

    it("defaults sessionId to null when not provided", async () => {
      const result = await executor.execute({
        toolName: "create_workflow",
        args: {
          title: "Docker Basics",
          phases: [
            {
              id: "p1",
              title: "P1",
              tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }],
            },
          ],
        },
        userId: "user-1",
      });

      expect(result.sessionId).toBeNull();
    });
  });

  describe("list_workflows", () => {
    beforeEach(async () => {
      const wf1 = await executor.execute({
        toolName: "create_workflow",
        args: {
          title: "Workflow 1",
          phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
        },
        userId: "user-1",
      });

      // Start workflow 1 so status is ACTIVE
      await executor.execute({
        toolName: "transition_workflow",
        args: {
          workflowId: wf1.id,
          command: COMMAND.START_WORKFLOW,
          expectedVersion: 0,
        },
        userId: "user-1",
      });

      // Workflow 2 remains DRAFT
      await executor.execute({
        toolName: "create_workflow",
        args: {
          title: "Workflow 2",
          phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
        },
        userId: "user-1",
      });

      // Workflow 3 belongs to user-2
      await executor.execute({
        toolName: "create_workflow",
        args: {
          title: "Workflow 3",
          phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
        },
        userId: "user-2",
      });
    });

    it("lists all workflows for the user when no status filter is provided", async () => {
      const result = await executor.execute({
        toolName: "list_workflows",
        args: {},
        userId: "user-1",
      });

      expect(result).toHaveLength(2);
      expect(result.map((w) => w.title)).toEqual(["Workflow 1", "Workflow 2"]);
    });

    it("filters workflows by status when args.status is specified", async () => {
      const activeWorkflows = await executor.execute({
        toolName: "list_workflows",
        args: { status: WORKFLOW_STATUS.ACTIVE },
        userId: "user-1",
      });

      expect(activeWorkflows).toHaveLength(1);
      expect(activeWorkflows[0].title).toBe("Workflow 1");
      expect(activeWorkflows[0].status).toBe(WORKFLOW_STATUS.ACTIVE);

      const draftWorkflows = await executor.execute({
        toolName: "list_workflows",
        args: { status: WORKFLOW_STATUS.DRAFT },
        userId: "user-1",
      });

      expect(draftWorkflows).toHaveLength(1);
      expect(draftWorkflows[0].title).toBe("Workflow 2");
    });
  });

  describe("get_workflow", () => {
    it("retrieves a workflow by ID for the authorized user", async () => {
      const created = await executor.execute({
        toolName: "create_workflow",
        args: {
          title: "Get Workflow Test",
          phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
        },
        userId: "user-1",
      });

      const result = await executor.execute({
        toolName: "get_workflow",
        args: { workflowId: created.id },
        userId: "user-1",
      });

      expect(result).toEqual(created);
    });

    it("returns NOT_FOUND error when the workflow does not exist", async () => {
      const result = await executor.execute({
        toolName: "get_workflow",
        args: { workflowId: "missing-wf" },
        userId: "user-1",
      });

      expect(result).toMatchObject({
        code: WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
        statusCode: 404,
      });
      expect(result.error).toMatch(/not found/i);
    });

    it("returns NOT_FOUND error when requesting another user's workflow", async () => {
      const created = await executor.execute({
        toolName: "create_workflow",
        args: {
          title: "Private Workflow",
          phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
        },
        userId: "user-1",
      });

      const result = await executor.execute({
        toolName: "get_workflow",
        args: { workflowId: created.id },
        userId: "user-2",
      });

      expect(result).toMatchObject({
        code: WORKFLOW_REPOSITORY_ERROR.NOT_FOUND,
        statusCode: 404,
      });
      expect(result.error).toMatch(/not found/i);
    });
  });

  describe("delete_workflow", () => {
    it("deletes a workflow when expectedVersion matches", async () => {
      const created = await executor.execute({
        toolName: "create_workflow",
        args: {
          title: "Delete Me",
          phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
        },
        userId: "user-1",
      });

      const deleted = await executor.execute({
        toolName: "delete_workflow",
        args: {
          workflowId: created.id,
          expectedVersion: 0,
        },
        userId: "user-1",
      });

      expect(deleted).toBe(true);

      // Verify it is gone
      const stored = await repository.getById(created.id, "user-1");
      expect(stored).toBeNull();
    });

    it("returns VERSION_CONFLICT error on stale expectedVersion during delete", async () => {
      const created = await executor.execute({
        toolName: "create_workflow",
        args: {
          title: "Delete Me Conflict",
          phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
        },
        userId: "user-1",
      });

      const result = await executor.execute({
        toolName: "delete_workflow",
        args: {
          workflowId: created.id,
          expectedVersion: 99,
        },
        userId: "user-1",
      });

      expect(result).toMatchObject({
        code: WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
        statusCode: 409,
      });
      expect(result.error).toMatch(/version conflict/i);
    });
  });

  describe("transition_workflow", () => {
    it("executes valid workflow transition with incremented version", async () => {
      const created = await executor.execute({
        toolName: "create_workflow",
        args: {
          title: "Transition Test",
          phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
        },
        userId: "user-1",
      });

      const result = await executor.execute({
        toolName: "transition_workflow",
        args: {
          workflowId: created.id,
          command: COMMAND.START_WORKFLOW,
          expectedVersion: 0,
        },
        userId: "user-1",
      });

      expect(result.status).toBe(WORKFLOW_STATUS.ACTIVE);
      expect(result.version).toBe(1);
    });

    it("passes payload to transition command", async () => {
      const created = await executor.execute({
        toolName: "create_workflow",
        args: {
          title: "Activate Task Test",
          phases: [{ id: "p1", title: "P1", tasks: [{ id: "task-abc", title: "T1", concept: "C1", order: 1 }] }],
        },
        userId: "user-1",
      });

      // Start workflow first
      await executor.execute({
        toolName: "transition_workflow",
        args: {
          workflowId: created.id,
          command: COMMAND.START_WORKFLOW,
          expectedVersion: 0,
        },
        userId: "user-1",
      });

      // Activate task with payload
      const result = await executor.execute({
        toolName: "transition_workflow",
        args: {
          workflowId: created.id,
          command: COMMAND.ACTIVATE_TASK,
          payload: { taskId: "task-abc" },
          expectedVersion: 1,
        },
        userId: "user-1",
      });

      expect(result.activeTaskId).toBe("task-abc");
      expect(result.version).toBe(2);
    });

    it("returns VERSION_CONFLICT error on stale version during transition", async () => {
      const created = await executor.execute({
        toolName: "create_workflow",
        args: {
          title: "Stale Version Test",
          phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
        },
        userId: "user-1",
      });

      const result = await executor.execute({
        toolName: "transition_workflow",
        args: {
          workflowId: created.id,
          command: COMMAND.START_WORKFLOW,
          expectedVersion: 42,
        },
        userId: "user-1",
      });

      expect(result).toMatchObject({
        code: WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT,
        statusCode: 409,
      });
      expect(result.error).toMatch(/version conflict/i);
    });

    it("routes SUBMIT_ANSWER command to workflowService.submitAnswer", async () => {
      const mockResult = { id: "wf-1", status: WORKFLOW_STATUS.COMPLETED, version: 5 };
      const submitSpy = jest.spyOn(workflowService, "submitAnswer").mockResolvedValue(mockResult);

      const result = await executor.execute({
        toolName: "transition_workflow",
        args: {
          workflowId: "wf-1",
          command: "SUBMIT_ANSWER",
          payload: { answer: "My test answer" },
          expectedVersion: 3,
        },
        userId: "user-1",
      });

      expect(submitSpy).toHaveBeenCalledWith({
        workflowId: "wf-1",
        userId: "user-1",
        payload: { answer: "My test answer" },
        expectedVersion: 3,
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe("unknown tool", () => {
    it("returns error object for unrecognized tool", async () => {
      const result = await executor.execute({
        toolName: "nonexistent_tool",
        args: {},
        userId: "user-1",
      });

      expect(result).toEqual({ error: "Unknown server tool: nonexistent_tool" });
    });
  });
});
