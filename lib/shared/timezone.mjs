const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Return an ISO-8601 timestamp string (like toISOString) adjusted to Beijing time.
 * The result looks like a UTC timestamp but represents the Beijing clock time.
 */
export function beijingISO(date = new Date()) {
  return new Date(date.getTime() + BEIJING_OFFSET_MS).toISOString();
}

/**
 * Return 'yyyy-MM-dd' in Beijing time.
 */
export function beijingDate(date = new Date()) {
  return beijingISO(date).slice(0, 10);
}