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

  async markFailed({
    runId,
    userId,
    error,
    agentState = null,
    checkpoint = null,
  }) {
    const update = {
      status: "failed",
      error,
      failedAt: new Date(),
    };

    if (agentState !== null) update.agentState = agentState;
    if (checkpoint !== null) update.checkpoint = checkpoint;

    return AgentRun.findOneAndUpdate(
      {
        runId,
        user: userId,
        status: {
          $in: ["queued", "running"],
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
}

export default new AgentRunService();
