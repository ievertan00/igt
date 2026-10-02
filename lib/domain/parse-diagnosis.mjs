/**
 * Thin LLM-output parser for /grammar.
 * Gemini enforces the schema via responseMimeType + responseSchema.
 * Qwen/Deepseek only get response_format: json_object — schema is best-effort,
 * so a non-JSON response is rejected rather than reintroduced as a legacy
 * `review` field.
 */
import fs from "node:fs";
import path from "node:path";
import { beijingISO } from "../shared/timezone.mjs";

export const GRAMMAR_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    correction: { type: "string" },
    refine:     { type: "string" },
    evaluate: { type: "string" },
    diagnoses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          error_type: { type: "string" },
          severity:    { type: "string", enum: ["Minor", "Moderate", "Major"] },
          explanation: { type: "string" },
        },
        required: ["error_type", "severity", "explanation"],
        additionalProperties: false,
      },
    },
    remember: { type: "string" },
  },
  required: ["correction", "refine", "evaluate", "diagnoses", "remember"],
  additionalProperties: false,
};

// Strip trailing fenced code blocks that some models (DeepSeek) append to string fields
function stripTrailingCodeBlock(value) {
  if (!value) return value;
  return value.replace(/\s*```[\w]*\s[\s\S]*?`{3,}\s*$/g, "").trim();
}

export function parseDiagnosis(output, errorTypes, { logPath = null } = {}) {
  // Strip reasoning/thinking tags (DeepSeek, Gemma 4, etc.)
  let cleaned = output
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\|channel>thought[\s\S]*?<channel\|>/gi, "")
    .trim();
    
  cleaned = cleaned.replace(/^```json\s*|\s*```$/g, "").trim();
  let data;
  try {
    data = JSON.parse(cleaned);
  } catch {
    if (logPath) {
      try {
        fs.appendFileSync(
          logPath,
          `${beijingISO()} WARN: non-JSON LLM output (${output.length} chars), dumping into review field\n`
        );
      } catch {}
    }
    throw new Error("Grammar provider returned invalid JSON");
  }

  const diagnoses = Array.isArray(data.diagnoses) ? data.diagnoses.map((d) => {
    const rawType = (d.error_type || "").trim();
    const normalizedType = errorTypes.getErrorTypePath(errorTypes.classifyErrorType(rawType));
    const explanation = (d.explanation || "").trim();
    return {
      error_type: normalizedType,
      severity: d.severity || "Minor",
      explanation: explanation || normalizedType,
    };
  }) : [];

  const evaluate = typeof data.evaluate === "string" ? stripTrailingCodeBlock(data.evaluate) : "";

  return {
    correction: stripTrailingCodeBlock(data.correction) || null,
    refine:     stripTrailingCodeBlock(data.refine) || null,
    evaluate: evaluate || null,
    diagnoses,
    remember: Array.isArray(data.remember)
      ? data.remember.filter(Boolean).join("\n") || null
      : (data.remember || null),
  };
}
