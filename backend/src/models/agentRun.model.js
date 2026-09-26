import mongoose from "mongoose";

const agentRunSchema = new mongoose.Schema(
    {
        runId: {type: String, required: true, unique: true, index: true },

        conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "GlobalChatSession", required: true, index: true },

        user: { type: mongoose.Schema.ObjectId, ref: "User", required: true, index: true },
        
        status: { type: String, enum: ["queued", "running", "waiting_for_user", "completed", "cancelled", "failed"], default: "queued", index: true },
        
        input: { type: mongoose.Schema.Types.Mixed, default: () => ({}), required: true},

        agentState: { type: mongoose.Schema.Types.Mixed, default: () => ({})},
        
        checkpoint: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        finalReply: { type: String, default: null },
        
        toolCalls: { type: [mongoose.Schema.Types.Mixed], default: () => []},
        
        error: { type: mongoose.Schema.Types.Mixed, default: null, },
        
        startedAt: { type: Date, default: null,},

        completedAt: { type: Date, default: null,},

        failedAt: { type: Date, default: null,},

        cancelledAt: { type: Date, default: null,},

        lastResumedAt: { type: Date, default: null,}
    },
    {
        timestamps: true
    }
);

agentRunSchema.index({ conversationId: 1, createdAt: -1 });
agentRunSchema.index({ user: 1, createdAt: -1 });
agentRunSchema.index({ user: 1, status: 1 });
const AgentRun =
  mongoose.models.AgentRun || mongoose.model("AgentRun", agentRunSchema);

export default AgentRun;