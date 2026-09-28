export const JEV_ERROR = {
  INVALID_CHECKPOINT: "INVALID_CHECKPOINT",
  MISSING_EVALUATION_SPEC: "MISSING_EVALUATION_SPEC",
  INVALID_ANSWER: "INVALID_ANSWER",
  INVALID_EVALUATION: "INVALID_EVALUATION",
  EVALUATION_FAILED: "EVALUATION_FAILED",
};

/**
 * Creates a JEV domain error with an error code and optional details.
 *
 * @param {string} code
 * @param {string} message
 * @param {object} [details={}]
 * @returns {Error}
 */
export function jevError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}
