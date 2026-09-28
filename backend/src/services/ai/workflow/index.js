import { MongoWorkflowRepository } from "./repository/mongoWorkflowRepository.js";
import { WorkflowService } from "./workflowService.js";
import { defaultJevEvaluator } from "./jev/index.js";

export * from "./domain/index.js";
export * from "./repository/index.js";
export * from "./workflowService.js";
export * from "./workflowContextResolver.js";
export * from "./jev/index.js";

export const workflowRepository = new MongoWorkflowRepository();
export const workflowService = new WorkflowService(
    workflowRepository,
    defaultJevEvaluator,
);

export default workflowService;
