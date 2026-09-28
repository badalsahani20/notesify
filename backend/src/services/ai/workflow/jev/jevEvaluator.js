import { VERDICT } from "../domain/workflowConstants.js";
import { executeGroq } from "../../transport/groqClient.js";
import { executeOpenRouter } from "../../transport/openRouterClient.js";
import { JEV_MODEL, FALLBACK_MODEL, getOpenRouterApiKey } from "../../config/aiModels.js";
import { JEV_ERROR, jevError } from "./jevErrors.js";

const VALID_VERDICTS = new Set(Object.values(VERDICT));

export const JEV_SYSTEM_PROMPT = `You are an educational answer evaluator.

Evaluate the student's answer against the supplied question, expected answer, and evaluation criteria.

Judge conceptual understanding, not exact wording.

Verdicts:
- PASSED: The answer demonstrates sufficient understanding of the required concepts.
- PARTIAL: The answer is substantially correct but incomplete or missing important concepts.
- MISCONCEPTION: The answer demonstrates a significant misunderstanding or incorrect concept.

Return JSON only:

{
  "verdict": "PASSED | PARTIAL | MISCONCEPTION",
  "confidence": 0.0-1.0,
  "feedback": "brief, constructive feedback",
  "misconceptions": ["..."],
  "criterionResults": [
    {
      "criterion": "...",
      "passed": true,
      "feedback": "..."
    }
  ]
}

Do not judge grammar, spelling, writing style, or verbosity unless they affect the demonstrated understanding.
Do not require the student's wording to match the expected answer.
Judge the student's demonstrated understanding based only on the supplied evaluation context.`;

export function buildJevPrompt({ question, evaluationSpec, userAnswer }) {
  return JSON.stringify(
    {
      question,
      expectedAnswer: evaluationSpec?.expectedAnswer ?? "",
      keyConcepts: evaluationSpec?.keyConcepts ?? [],
      rubric: evaluationSpec?.rubric ?? [],
      commonMisconceptions: evaluationSpec?.commonMisconceptions ?? [],
      userAnswer,
    },
    null,
    2,
  );
}

export function normalizeEvaluation(result) {
  if (!result || !VALID_VERDICTS.has(result.verdict)) {
    throw jevError(
      JEV_ERROR.INVALID_EVALUATION,
      "JEV returned an invalid verdict.",
    );
  }

  const confidence = Number(result.confidence);

  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw jevError(
      JEV_ERROR.INVALID_EVALUATION,
      "JEV returned an invalid confidence value.",
    );
  }

  return {
    verdict: result.verdict,
    confidence,
    feedback: typeof result.feedback === "string" ? result.feedback : "",
    misconceptions: Array.isArray(result.misconceptions)
      ? result.misconceptions.filter((m) => typeof m === "string" && m.trim()).map((m) => m.trim())
      : [],
    criterionResults: Array.isArray(result.criterionResults)
      ? result.criterionResults
          .filter((cr) => cr && typeof cr.criterion === "string")
          .map((cr) => ({
            criterion: cr.criterion.trim(),
            passed: Boolean(cr.passed),
            feedback: typeof cr.feedback === "string" ? cr.feedback.trim() : "",
            notes: typeof cr.feedback === "string" ? cr.feedback.trim() : (cr.notes ?? ""),
          }))
      : [],
  };
}

export class JevEvaluator {
  constructor({ generateEvaluation } = {}) {
    if (typeof generateEvaluation !== "function") {
      throw jevError(
        JEV_ERROR.EVALUATION_FAILED,
        "generateEvaluation function is required for JevEvaluator.",
      );
    }
    this.generateEvaluation = generateEvaluation;
  }

  async evaluate({ checkpoint, userAnswer }) {
    if (
      !checkpoint?.question ||
      typeof checkpoint.question !== "string" ||
      !checkpoint.question.trim()
    ) {
      throw jevError(
        JEV_ERROR.INVALID_CHECKPOINT,
        "Checkpoint question is required.",
      );
    }

    if (!checkpoint?.evaluationSpec) {
      throw jevError(
        JEV_ERROR.MISSING_EVALUATION_SPEC,
        "Checkpoint evaluationSpec is required.",
      );
    }

    if (typeof userAnswer !== "string" || !userAnswer.trim()) {
      throw jevError(
        JEV_ERROR.INVALID_ANSWER,
        "User answer is required.",
      );
    }

    const result = await this.generateEvaluation({
      question: checkpoint.question.trim(),
      evaluationSpec: checkpoint.evaluationSpec,
      userAnswer: userAnswer.trim(),
    });

    return normalizeEvaluation(result);
  }
}

export const createDefaultJevEvaluator = () => {
  return new JevEvaluator({
    generateEvaluation: async ({ question, evaluationSpec, userAnswer }) => {
      const messages = [
        { role: "system", content: JEV_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildJevPrompt({ question, evaluationSpec, userAnswer }),
        },
      ];

      let rawResponse;
      if (getOpenRouterApiKey()) {
        try {
          rawResponse = await executeOpenRouter(JEV_MODEL, messages, false, false);
        } catch (orErr) {
          console.warn(
            `⚠️ [JEV OpenRouter] Evaluation with ${JEV_MODEL} failed, attempting Groq fallback:`,
            orErr.message,
          );
          rawResponse = await executeGroq(messages, false, FALLBACK_MODEL);
        }
      } else {
        rawResponse = await executeGroq(messages, false, JEV_MODEL);
      }

      let content = typeof rawResponse === "string" ? rawResponse.trim() : "";

      if (content.startsWith("```")) {
        content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      }

      try {
        return JSON.parse(content);
      } catch (parseError) {
        throw jevError(
          JEV_ERROR.INVALID_EVALUATION,
          `Failed to parse JEV response JSON: ${parseError.message}`,
        );
      }
    },
  });
};

export const defaultJevEvaluator = createDefaultJevEvaluator();

