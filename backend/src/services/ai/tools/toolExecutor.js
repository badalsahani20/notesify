import { getNoteContentForUser } from "../../notes.service.js";
import { workflowService as defaultWorkflowService } from "../workflow/index.js";
import { createWorkflow } from "../workflow/domain/workflowFactory.js";

export class ToolExecutor {
  constructor({
    workflowService = defaultWorkflowService,
    getNoteContent = getNoteContentForUser,
  } = {}) {
    this.workflowService = workflowService;
    this.getNoteContent = getNoteContent;
  }

  async execute({
    toolName,
    args = {},
    userId,
    fallbackNoteId = null,
  }) {
    try {
      if (toolName === "get_note_content") {
        const noteId = args?.noteId || fallbackNoteId;
        if (!noteId) {
          return { error: "Missing noteId for get_note_content." };
        }
        try {
          const note = await this.getNoteContent(noteId, userId);
          if (!note) {
            return { error: `Note "${noteId}" not found or unauthorized.` };
          }
          return note;
        } catch (err) {
          return { error: `Failed to fetch note: ${err.message}` };
        }
      }

      if (toolName === "create_workflow") {
        const workflow = createWorkflow({
          title: args.title,
          phases: args.phases,
          userId,
          sessionId: args.sessionId ?? null,
        });

        return await this.workflowService.create(workflow);
      }

      if (toolName === "list_workflows") {
        const workflows = await this.workflowService.listByUser(userId);

        if (args?.status) {
          return workflows.filter(
            (workflow) => workflow.status === args.status,
          );
        }

        return workflows;
      }

      if (toolName === "get_workflow") {
        return await this.workflowService.getById(
          args.workflowId,
          userId,
        );
      }

      if (toolName === "delete_workflow") {
        return await this.workflowService.delete({
          workflowId: args.workflowId,
          userId,
          expectedVersion: args.expectedVersion,
        });
      }

      if (toolName === "transition_workflow") {
        if (args.command === "SUBMIT_ANSWER") {
          return await this.workflowService.submitAnswer({
            workflowId: args.workflowId,
            userId,
            payload: args.payload ?? {},
            expectedVersion: args.expectedVersion,
          });
        }

        return await this.workflowService.execute({
          workflowId: args.workflowId,
          userId,
          command: args.command,
          payload: args.payload ?? {},
          expectedVersion: args.expectedVersion,
        });
      }

      return { error: `Unknown server tool: ${toolName}` };
    } catch (err) {
      return {
        error: err.message || "Server tool execution failed",
        code: err.code || "TOOL_EXECUTION_ERROR",
        statusCode: err.statusCode || 500,
      };
    }
  }
}

export const toolExecutor = new ToolExecutor();

