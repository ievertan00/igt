let currentSessionId = null;
let nextSessionId = 1;

export async function getOrStartSession() {
  if (currentSessionId === null) currentSessionId = nextSessionId++;
  return currentSessionId;
}

export function resetSessionState() {
  currentSessionId = null;
}

export function getCurrentSessionId() {
  return currentSessionId;
}
