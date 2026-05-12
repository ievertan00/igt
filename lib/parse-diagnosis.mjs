/**
 * Thin LLM-output parser for /grammar.
 * Gemini enforces the schema via responseMimeType + responseSchema.
 * Qwen/Deepseek only get response_format: json_object — schema is best-effort,
 * so a non-JSON response logs a WARNING and dumps the raw text into `review`.
 */
import fs from "node:fs";
import path from "node:path";

export const GRAMMAR_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    review:     { type: "string" },
    correction: { type: "string" },
    refine:     { type: "string" },
    diagnoses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type:        { type: "string" },
          severity:    { type: "string", enum: ["Minor", "Moderate", "Major"] },
          explanation: { type: "string" },
        },
      },
    },
    rule: { type: "string" },
    tip:  { type: "string" },
  },
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
          `${new Date().toISOString()} WARN: non-JSON LLM output (${output.length} chars), dumping into review field\n`
        );
      } catch {}
    }
    data = { review: output };
  }

  const diagnoses = Array.isArray(data.diagnoses) ? data.diagnoses.map((d) => {
    const rawType = (d.type || d.error_type || "").trim();
    return {
      error_type: errorTypes.getErrorTypePath(errorTypes.classifyErrorType(rawType)),
      severity: d.severity || "Minor",
      explanation: d.explanation || "",
    };
  }) : [];

  return {
    review:     data.review || null,
    correction: stripTrailingCodeBlock(data.correction) || null,
    refine:     stripTrailingCodeBlock(data.refine) || null,
    diagnoses,
    rule: Array.isArray(data.rule) ? data.rule.join("\n") : (data.rule || null),
    tip:  Array.isArray(data.tip)  ? data.tip.join("\n")  : (data.tip  || null),
  };
}
