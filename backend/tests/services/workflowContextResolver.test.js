import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  resolveWorkflowContext,
  toWorkflowSummary,
  formatWorkflowPromptContext,
} from "../../src/services/ai/workflow/workflowContextResolver.js";
import { WorkflowService } from "../../src/services/ai/workflow/workflowService.js";
import { InMemoryWorkflowRepository } from "../../src/services/ai/workflow/repository/inMemoryWorkflowRepository.js";
import { createWorkflow } from "../../src/services/ai/workflow/domain/workflowFactory.js";
import { WORKFLOW_STATUS, COMMAND } from "../../src/services/ai/workflow/domain/workflowConstants.js";
import { ChatContextResolver } from "../../src/services/ai/chatContextResolver.js";

describe("WorkflowContextResolver", () => {
  let repository;
  let workflowService;

  beforeEach(() => {
    repository = new InMemoryWorkflowRepository();
    workflowService = new WorkflowService(repository);
  });

  describe("Precedence 1: Explicit workflowId", () => {
    it("returns activeWorkflow and empty candidates when workflowId is provided", async () => {
      const wf = createWorkflow({
        title: "MongoDB Course",
        userId: "user-1",
        phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
      });
      await repository.create(wf);

      const result = await resolveWorkflowContext({
        workflowService,
        userId: "user-1",
        workflowId: wf.id,
      });

      expect(result.activeWorkflow).toEqual(toWorkflowSummary(wf));
      expect(result.candidates).toEqual([]);
    });

    it("returns activeWorkflow null when explicit workflowId does not exist", async () => {
      const result = await resolveWorkflowContext({
        workflowService,
        userId: "user-1",
        workflowId: "missing-id",
      });

      expect(result.activeWorkflow).toBeNull();
      expect(result.candidates).toEqual([]);
    });
  });

  describe("Precedence 2: Workflow associated with current sessionId", () => {
    it("resolves the session-linked workflow as activeWorkflow and remaining as candidates", async () => {
      const sessionWf = createWorkflow({
        title: "Session Course",
        userId: "user-1",
        sessionId: "session-abc",
        phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
      });
      const otherWf = createWorkflow({
        title: "Other Course",
        userId: "user-1",
        sessionId: "session-xyz",
        phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
      });

      await repository.create(sessionWf);
      await repository.create(otherWf);

      const result = await resolveWorkflowContext({
        workflowService,
        userId: "user-1",
        sessionId: "session-abc",
      });

      expect(result.activeWorkflow.id).toBe(sessionWf.id);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].id).toBe(otherWf.id);
    });

    it("does not choose an activeWorkflow when multiple resumable workflows share the same sessionId", async () => {
      const sessionWf1 = createWorkflow({
        title: "MongoDB Course",
        userId: "user-1",
        sessionId: "session-abc",
        phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
      });
      const sessionWf2 = createWorkflow({
        title: "React Course",
        userId: "user-1",
        sessionId: "session-abc",
        phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
      });

      await repository.create(sessionWf1);
      await repository.create(sessionWf2);

      const result = await resolveWorkflowContext({
        workflowService,
        userId: "user-1",
        sessionId: "session-abc",
      });

      expect(result.activeWorkflow).toBeNull();
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates.map((c) => c.title)).toEqual(
        expect.arrayContaining(["MongoDB Course", "React Course"]),
      );
    });
  });

  describe("Precedence 3: Exactly one resumable workflow", () => {
    it("automatically picks the single resumable workflow as activeWorkflow", async () => {
      const singleWf = createWorkflow({
        title: "Solo Course",
        userId: "user-1",
        phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
      });
      await repository.create(singleWf);

      const result = await resolveWorkflowContext({
        workflowService,
        userId: "user-1",
      });

      expect(result.activeWorkflow).toEqual(toWorkflowSummary(singleWf));
      expect(result.candidates).toEqual([]);
    });

    it("ignores COMPLETED workflows when determining single resumable", async () => {
      const activeWf = createWorkflow({
        title: "Active Course",
        userId: "user-1",
        phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
      });
      const completedWf = {
        ...createWorkflow({
          title: "Finished Course",
          userId: "user-1",
          phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
        }),
        status: WORKFLOW_STATUS.COMPLETED,
      };

      await repository.create(activeWf);
      await repository.create(completedWf);

      const result = await resolveWorkflowContext({
        workflowService,
        userId: "user-1",
      });

      // Exactly one RESUMABLE workflow exists
      expect(result.activeWorkflow.id).toBe(activeWf.id);
      expect(result.candidates).toEqual([]);
    });
  });

  describe("Precedence 4: Multiple resumable workflows", () => {
    it("does not choose an activeWorkflow and returns candidates sorted by updatedAt desc", async () => {
      const now = Date.now();
      const wf1 = {
        ...createWorkflow({
          title: "React Course",
          userId: "user-1",
          phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
        }),
        updatedAt: new Date(now - 10000).toISOString(),
      };
      const wf2 = {
        ...createWorkflow({
          title: "MongoDB Course",
          userId: "user-1",
          phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
        }),
        updatedAt: new Date(now).toISOString(),
      };

      await repository.create(wf1);
      await repository.create(wf2);

      const result = await resolveWorkflowContext({
        workflowService,
        userId: "user-1",
      });

      expect(result.activeWorkflow).toBeNull();
      expect(result.candidates).toHaveLength(2);
      // Most recently updated first
      expect(result.candidates[0].id).toBe(wf2.id);
      expect(result.candidates[1].id).toBe(wf1.id);
    });
  });

  describe("formatWorkflowPromptContext", () => {
    it("formats an active workflow block", () => {
      const text = formatWorkflowPromptContext({
        activeWorkflow: {
          id: "wf-1",
          title: "MongoDB Fundamentals",
          status: "ACTIVE",
          activePhaseId: "p1",
          activeTaskId: "t1",
          activeCheckpointId: "c1",
          version: 3,
        },
        candidates: [],
      });

      expect(text).toContain("[ACTIVE WORKFLOW]");
      expect(text).toContain('id: wf-1');
      expect(text).toContain('title: "MongoDB Fundamentals"');
      expect(text).toContain("status: ACTIVE");
      expect(text).toContain("activeTaskId: t1");
      expect(text).toContain("version: 3");
      expect(text).toContain("[/ACTIVE WORKFLOW]");
    });

    it("formats a resumable workflows candidates list when activeWorkflow is null", () => {
      const text = formatWorkflowPromptContext({
        activeWorkflow: null,
        candidates: [
          { id: "wf-1", title: "MongoDB", status: "ACTIVE", activeTaskId: "t1" },
          { id: "wf-2", title: "React", status: "PAUSED", activeTaskId: "t2" },
        ],
      });

      expect(text).toContain("[RESUMABLE WORKFLOWS]");
      expect(text).toContain('title: "MongoDB"');
      expect(text).toContain('title: "React"');
      expect(text).toContain("[/RESUMABLE WORKFLOWS]");
    });

    it("returns empty string when no active workflow and candidates <= 1", () => {
      expect(formatWorkflowPromptContext({ activeWorkflow: null, candidates: [] })).toBe("");
    });
  });

  describe("ChatContextResolver integration", () => {
    it("populates workflowContext and injects active workflow into finalSystemPrompt", async () => {
      const wf = createWorkflow({
        title: "Docker Course",
        userId: "user-1",
        phases: [{ id: "p1", title: "P1", tasks: [{ id: "t1", title: "T1", concept: "C1", order: 1 }] }],
      });
      await repository.create(wf);

      const resolver = new ChatContextResolver({ workflowService });

      const resolved = await resolver.resolve({
        user: { _id: "user-1", name: "Alice" },
        body: { message: "Continue my course" },
        sessionData: {},
      });

      expect(resolved.workflowContext).toBeDefined();
      expect(resolved.workflowContext.activeWorkflow.title).toBe("Docker Course");
      expect(resolved.finalSystemPrompt).toContain("[ACTIVE WORKFLOW]");
      expect(resolved.finalSystemPrompt).toContain('title: "Docker Course"');
    });
  });
});
