// Sparse learning targets: omit unknown dimensions; each target dimension is an array.
// Historical columns are converted to the current array-based fields only.
export function practiceFieldsFromLegacy(row) {
  const metadata = JSON.parse(row.metadata_json || "{}");
  const fields = {};
  if (row.focus) fields.grammar_point = [row.focus];
  for (const [key, value] of Object.entries(metadata)) {
    if (value) fields[key] = Array.isArray(value) ? value : [value];
  }
  if (!fields.register && row.style) fields.register = [row.style === "casual" ? "informal" : row.style];
  return fields;
}

export function practiceRowFromLegacy(row) {
  return {
    id: row.id, prompt_zh: row.prompt_zh, reference_answer: row.reference_answer,
    difficulty: row.difficulty, context: row.context,
    practice_fields_json: JSON.stringify(practiceFieldsFromLegacy(row)),
    hint_json: row.hints_json || "{}",
    generated_by: row.generated_by ?? row.Generated_by ?? "unknown",
    served_count: row.served_count ?? 0, active: row.active ?? 1,
  };
}
