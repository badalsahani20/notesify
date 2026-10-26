import AgentRun from "../../../models/agentRun.model.js";
import crypto from "node:crypto";

class AgentRunService {
  async createRun({
    conversationId,
    userId,
    input,
    agentState = {},
    checkpoint = null,
  }) {
    const runId = crypto.randomUUID();

    return AgentRun.create({
      runId,
      conversationId,
      user: userId,
      status: "queued",
      input,
      agentState,
      checkpoint,
    });
  }

  async startRun({ runId, userId }) {
    return AgentRun.findOneAndUpdate(
      {
        runId,
        user: userId,
        status: "queued",
      },
      {
        $set: {
          status: "running",
          startedAt: new Date(),
        },
      },
      {
        new: true,
      },
    );
  }

  async markWaitingForUser({ runId, userId, checkpoint }) {
    return AgentRun.findOneAndUpdate(
      {
        runId,
        user: userId,
        status: "running",
      },
      {
        $set: {
          status: "waiting_for_user",
          checkpoint,
        },
      },
      {
        new: true,
      },
    );
  }

  async resumeRun({ runId, userId }) {
    return AgentRun.findOneAndUpdate(
      {
        runId,
        user: userId,
        status: "waiting_for_user",
      },
      {
        $set: {
          status: "running",
          lastResumedAt: new Date(),
        },
      },
      {
        new: true,
      },
    );
  }

  async getRun({ runId, userId }) {
    return AgentRun.findOne({
      runId,
      user: userId,
    });
  }

  async markCompleted({
    runId,
    userId,
    finalReply,
    agentState = null,
    checkpoint = null,
    toolCalls = null,
  }) {
    const update = {
      status: "completed",
      finalReply,
      completedAt: new Date(),
    };

    if (agentState !== null) update.agentState = agentState;
    if (checkpoint !== null) update.checkpoint = checkpoint;
    if (toolCalls !== null) update.toolCalls = toolCalls;

    return AgentRun.findOneAndUpdate(
      {
        runId,
        user: userId,
        status: {
          $in: ["running"],
        },
      },
      {
        $set: update,
      },
      {
        new: true,
      },
    );
  }

  _formatError(error) {
    if (!error) return null;
    if (typeof error === "string") return error;
    if (error instanceof Error) return error.message || error.toString();
    if (typeof error === "object") {
      if (error.message) return error.message;
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }
    return String(error);
  }

  async markFailed({
    runId,
    userId,
    error,
    agentState = null,
    checkpoint = null,
  }) {
    const update = {
      status: "failed",
      error: this._formatError(error),
      failedAt: new Date(),
    };

    if (agentState !== null) update.agentState = agentState;
    if (checkpoint !== null) update.checkpoint = checkpoint;

    return AgentRun.findOneAndUpdate(
      {
        runId,
        user: userId,
        status: {
          $in: ["queued", "running", "waiting_for_user"],
        },
      },
      {
        $set: update,
      },
      {
        new: true,
      },
    );
  }

  async updateState({ runId, userId, agentState = null, checkpoint = null }) {
    const update = {};
    if (agentState !== null) update.agentState = agentState;
    if (checkpoint !== null) update.checkpoint = checkpoint;

    if (Object.keys(update).length === 0) return null;

    return AgentRun.findOneAndUpdate(
      {
        runId,
        user: userId,
        status: "running",
      },
      {
        $set: update,
      },
      {
        new: true,
      },
    );
  }

  async cancelRun({ runId, userId }) {
    return AgentRun.findOneAndUpdate(
      {
        runId,
        user: userId,
        status: {
          $in: ["queued", "running", "waiting_for_user"],
        },
      },
      {
        $set: {
          status: "cancelled",
          cancelledAt: new Date(),
        },
      },
      {
        new: true,
      },
    );
  }

  async failStaleRuns({ timeoutMinutes = 30 } = {}) {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    return AgentRun.updateMany(
      {
        status: { $in: ["queued", "running"] },
        updatedAt: { $lt: cutoff },
      },
      {
        $set: {
          status: "failed",
          error: `Execution timed out after ${timeoutMinutes} minutes of inactivity.`,
          failedAt: new Date(),
        },
      },
    );
  }
}

export default new AgentRunService();
