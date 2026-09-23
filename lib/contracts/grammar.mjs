export function grammarAnalysisResponse({ data, perf }) {
  return {
    data,
    persistence: { saved: false, requiresConfirmation: true },
    perf,
  };
}

export function grammarPersistenceResponse(persistence) {
  return { persistence };
}
