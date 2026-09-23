export function grammarAnalysisResponse({ data, perf }) {
  const result = {
    entryId: data.entryId || null,
    originalText: data.originalText || "",
    correction: data.correction || "",
    refine: data.refine || "",
    diagnoses: Array.isArray(data.diagnoses) ? data.diagnoses : [],
    remember: data.remember || [],
  };
  return {
    result,
    // Keep the legacy field for the CLI while clients migrate to the named contract.
    data,
    persistence: { saved: false, requiresConfirmation: true },
    perf,
  };
}

export function grammarPersistenceResponse(persistence) {
  return { persistence: { saved: Boolean(persistence.saved), ...persistence } };
}
