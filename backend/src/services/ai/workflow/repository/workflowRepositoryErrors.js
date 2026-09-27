export const WORKFLOW_REPOSITORY_ERROR = {
    NOT_FOUND: "WORKFLOW_NOT_FOUND",
    VERSION_CONFLICT: "WORKFLOW_VERSION_CONFLICT",
};

const STATUS_BY_CODE = {
    [WORKFLOW_REPOSITORY_ERROR.NOT_FOUND]: 404,
    [WORKFLOW_REPOSITORY_ERROR.VERSION_CONFLICT]: 409,
};

export function workflowRepositoryError(code, message) {
    const error = new Error(message);

    error.code = code;
    error.statusCode = STATUS_BY_CODE[code] || 500;

    return error;
}