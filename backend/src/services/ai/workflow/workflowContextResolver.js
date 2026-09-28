import { workflowService as defaultWorkflowService } from "./index.js";

const RESUMABLE_STATUSES = new Set([
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "FAILED",
]);

export function toWorkflowSummary(workflow) {
  if (!workflow) return null;
  return {
    id: workflow.id,
    title: workflow.title,
    status: workflow.status,
    activePhaseId: workflow.activePhaseId,
    activeTaskId: workflow.activeTaskId,
    activeCheckpointId: workflow.activeCheckpointId,
    version: workflow.version,
    updatedAt: workflow.updatedAt,
  };
}

export async function resolveWorkflowContext({
  workflowService = defaultWorkflowService,
  userId,
  sessionId = null,
  workflowId = null,
}) {
  if (!workflowService || !userId) {
    return {
      activeWorkflow: null,
      candidates: [],
    };
  }

  if (workflowId) {
    try {
      const workflow = await workflowService.getById(workflowId, userId);
      if (workflow) {
        return {
          activeWorkflow: toWorkflowSummary(workflow),
          candidates: [],
        };
      }
    } catch {
      return {
        activeWorkflow: null,
        candidates: [],
      };
    }
  }

  let workflows = [];
  try {
    workflows = await workflowService.listByUser(userId);
  } catch {
    workflows = [];
  }

  const resumable = (workflows || [])
    .filter((workflow) => RESUMABLE_STATUSES.has(workflow.status))
    .sort(
      (a, b) =>
        new Date(b.updatedAt || 0).getTime() -
        new Date(a.updatedAt || 0).getTime(),
    );

  if (sessionId) {
    const sessionWorkflows = resumable.filter(
      (workflow) => workflow.sessionId === sessionId,
    );

    if (sessionWorkflows.length === 1) {
      return {
        activeWorkflow: toWorkflowSummary(sessionWorkflows[0]),
        candidates: resumable
          .filter((workflow) => workflow.id !== sessionWorkflows[0].id)
          .map(toWorkflowSummary),
      };
    }

    if (sessionWorkflows.length > 1) {
      return {
        activeWorkflow: null,
        candidates: resumable.map(toWorkflowSummary),
      };
    }
  }

  if (resumable.length === 1) {
    return {
      activeWorkflow: toWorkflowSummary(resumable[0]),
      candidates: [],
    };
  }

  return {
    activeWorkflow: null,
    candidates: resumable.map(toWorkflowSummary),
  };
}

export function formatWorkflowPromptContext(workflowContext) {
  if (!workflowContext) return "";

  if (workflowContext.activeWorkflow) {
    const wf = workflowContext.activeWorkflow;
    return `\n[ACTIVE WORKFLOW]\nid: ${wf.id}\ntitle: "${wf.title}"\nstatus: ${wf.status}\nactivePhaseId: ${wf.activePhaseId || "none"}\nactiveTaskId: ${wf.activeTaskId || "none"}\nactiveCheckpointId: ${wf.activeCheckpointId || "none"}\nversion: ${wf.version}\n[/ACTIVE WORKFLOW]`;
  }

  if (workflowContext.candidates?.length > 1) {
    const list = workflowContext.candidates
      .map(
        (c) =>
          `- id: ${c.id} | title: "${c.title}" | status: ${c.status} | activeTaskId: ${c.activeTaskId || "none"}`,
      )
      .join("\n");
    return `\n[RESUMABLE WORKFLOWS]\n${list}\n[/RESUMABLE WORKFLOWS]`;
  }

  return "";
}
