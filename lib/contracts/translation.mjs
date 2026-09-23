export function translationResponse({ translation, notes, direction, perf }) {
  return { data: { translation, notes, direction }, perf };
}
