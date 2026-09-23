export function errorPayload(code, message, retryable = false) {
  return { error: { code, message, retryable } };
}
