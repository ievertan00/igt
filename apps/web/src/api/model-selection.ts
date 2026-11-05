export const modelPages = ["grammar", "translation", "word-lookup", "practice", "coach", "ask"] as const;
export type ModelPage = typeof modelPages[number];
export type ModelSelections = Partial<Record<ModelPage, string>>;
const storageKey = "clearwrite.page-models";
let memory: ModelSelections = {};

export function currentModelPage(): ModelPage | undefined {
  if (typeof window === "undefined") return undefined;
  const page = window.location.hash.slice(1).split("?")[0] || "grammar";
  return modelPages.find(value => value === page);
}

export function readModelSelections(): ModelSelections {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "{}");
    memory = Object.fromEntries(modelPages.filter(page => typeof value?.[page] === "string" && value[page].length <= 80).map(page => [page, value[page]]));
  } catch { /* Keep this session's selections if browser storage is unavailable. */ }
  return { ...memory };
}

export function writeModelSelections(value: ModelSelections) {
  memory = { ...value };
  try { localStorage.setItem(storageKey, JSON.stringify(memory)); } catch { /* Session-only persistence. */ }
}

export function requestModelProfile() {
  const page = currentModelPage();
  return page ? readModelSelections()[page] : undefined;
}
