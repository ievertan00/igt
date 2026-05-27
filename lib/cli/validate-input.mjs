const TEST_PATTERNS =
  /^(test(ing)?|hello|hi|hey|ok|okay|yes|no|sure|thanks|thank you|lol|haha|asdf|qwerty|foo|bar|baz|abc|xyz|aaa+|bbb+|ccc+|zzz+|123|1234|12345)[!?.\s]*$/i;

/**
 * @param {string} text
 * @param {{ lastSubmittedText: string, lastSubmittedProvider: string }} ctx
 * @returns {string|null} rejection message, or null if input is valid
 */
export function validateInput(text, ctx = {}) {
  if (text.length < 10) return "Input too short — type a complete sentence.";
  const words = text.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  if (words.length < 2) return "Input too short — needs at least two words.";
  if (TEST_PATTERNS.test(text))
    return "Looks like a test input — type a sentence you actually want checked.";
  const nonSpace = text.replace(/\s/g, "");
  if (nonSpace.length > 4) {
    const counts = {};
    for (const c of nonSpace) counts[c] = (counts[c] || 0) + 1;
    if (Math.max(...Object.values(counts)) / nonSpace.length > 0.6)
      return "Input looks like noise — type a real sentence.";
  }
  const currentProvider = process.env.IGT_LLM_PROVIDER || "gemini";
  if (text === ctx.lastSubmittedText && currentProvider === ctx.lastSubmittedProvider)
    return "Duplicate — same text as your last submission.";
  return null;
}

export function isMainlyChinese(text, minRatio = 0.3) {
  if (!text || typeof text !== "string") return false;

  // Remove spaces, punctuation, numbers, and non-Chinese characters
  const pureText = text.replace(/[^\u4e00-\u9fa5]/g, "");
  const chineseLength = pureText.length;
  const totalLength = text.length;

  // Chinese characters proportion >= minRatio (default 30%)
  return totalLength > 0 && chineseLength / totalLength >= minRatio;
}
