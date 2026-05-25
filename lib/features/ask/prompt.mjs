// Schema + prompt assembly helpers for /ask. The response is a markdown body
// the LLM shapes adaptively — no fixed intent, no rigid sub-fields.

export const ASK_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    question: { type: "string" },
    answer:   { type: "string" },
    related:  { type: "array", items: { type: "string" } },
  },
  required: ["question", "answer"],
};

export function formatHistory(turns) {
  if (!turns || turns.length === 0) return "(no prior turns)";
  return turns
    .map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`)
    .join("\n\n");
}

export function assemblePrompt(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
