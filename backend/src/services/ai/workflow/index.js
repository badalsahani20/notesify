import { MongoWorkflowRepository } from "./repository/mongoWorkflowRepository.js";
import { WorkflowService } from "./workflowService.js";

export * from "./domain/index.js";
export * from "./repository/index.js";
export * from "./workflowService.js";

export const workflowRepository = new MongoWorkflowRepository();
export const workflowService = new WorkflowService(workflowRepository);

export default workflowService;
