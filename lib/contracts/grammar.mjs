function fallbackEvaluate({ originalText, correction, refine, diagnoses }) {
  const input = String(originalText || "").trim();
  const corrected = String(correction || "").trim();
  const normalized = (value) => value.replace(/\s+/g, " ").replace(/[.!?]+$/, "").toLowerCase();
  const issues = Array.isArray(diagnoses) ? diagnoses : [];
  if (input && corrected && normalized(input) !== normalized(corrected)) {
    const count = Math.max(1, issues.length);
    return `The original sentence contains ${count === 1 ? "an error" : "several errors"}.`;
  }
  if (issues.length) {
    return "The original sentence is understandable overall, with some wording that could be improved.";
  }
  if (refine && input && normalized(input) !== normalized(refine)) {
    return "The original sentence is grammatically correct. The suggested change is an optional improvement to naturalness.";
  }
  return "The original sentence is grammatically correct and clear.";
}

function validEvaluate(value) {
  const evaluate = typeof value === "string" ? value.trim() : "";
  if (!evaluate || /^(?:no evaluation provided|the original sentence could not be assessed|unable to assess)/i.test(evaluate)) return "";
  return evaluate;
}

export function grammarAnalysisResponse({ data, perf, originalText = "" }) {
  const result = {
    entryId: data.entryId || null,
    originalText: data.originalText || originalText,
    correction: data.correction || "",
    refine: data.refine || "",
    evaluate: validEvaluate(data.evaluate) || fallbackEvaluate({
      originalText: data.originalText || originalText,
      correction: data.correction,
      refine: data.refine,
      diagnoses: data.diagnoses,
    }),
    diagnoses: Array.isArray(data.diagnoses) ? data.diagnoses : [],
    remember: data.remember || [],
  };
  return {
    result,
    // Keep the legacy field for the CLI while clients migrate to the named contract.
    data: { ...data, originalText: result.originalText, evaluate: result.evaluate },
    persistence: { saved: false, requiresConfirmation: true },
    perf,
  };
}

export function grammarPersistenceResponse(persistence) {
  return { persistence: { saved: Boolean(persistence.saved), ...persistence } };
}
