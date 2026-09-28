/**
 * Normalizes and validates an evaluation specification for a checkpoint.
 *
 * @param {object} spec
 * @returns {object|null}
 */
export function normalizeEvaluationSpec(spec) {
  if (!spec || typeof spec !== "object") return null;

  return {
    expectedAnswer: typeof spec.expectedAnswer === "string" ? spec.expectedAnswer.trim() : null,
    keyConcepts: Array.isArray(spec.keyConcepts)
      ? spec.keyConcepts.filter((c) => typeof c === "string" && c.trim()).map((c) => c.trim())
      : [],
    rubric: Array.isArray(spec.rubric)
      ? spec.rubric
          .filter((r) => r && typeof r.criterion === "string" && r.criterion.trim())
          .map((r) => ({
            criterion: r.criterion.trim(),
            weight:
              typeof r.weight === "number" && !Number.isNaN(r.weight)
                ? Math.max(0, Math.min(1, r.weight))
                : 1,
          }))
      : [],
    commonMisconceptions: Array.isArray(spec.commonMisconceptions)
      ? spec.commonMisconceptions.filter((m) => typeof m === "string" && m.trim()).map((m) => m.trim())
      : [],
  };
}
