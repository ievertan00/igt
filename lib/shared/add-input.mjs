import { isMainlyChinese } from "../cli/validate-input.mjs";

export { isMainlyChinese };

export function cleanEnglishCounterpart(raw) {
  const cleaned = String(raw ?? "")
    .trim()
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^(?:English(?: counterpart)?|Translation)\s*:\s*/i, "")
    .replace(/^['"“”]+|['"“”]+$/g, "")
    .trim();

  if (!cleaned || !/[a-zA-Z]/.test(cleaned) || /[\u4e00-\u9fff]/.test(cleaned)) {
    throw new Error("Could not find a reliable English counterpart for that Chinese input.");
  }

  return cleaned;
}
