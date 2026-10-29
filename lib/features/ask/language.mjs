// An omitted language preserves existing CLI/API prompt behavior.
export function validateAskLanguage(value) {
  if (value === undefined || value === "zh-CN" || value === "en") return value;
  throw Object.assign(new Error("language must be zh-CN or en."), { status: 400, code: "INVALID_REQUEST" });
}

export function askLanguagePrompt(language) {
  validateAskLanguage(language);
  if (!language) return "";
  return language === "zh-CN"
    ? "\n\nRESPONSE LANGUAGE: Explain in clear, beginner-friendly Simplified Chinese. Keep English examples, target words, highlighted expressions and grammar forms in English. Explain necessary terminology in Chinese. Use Chinese for explanatory headings and related questions, retaining English terms where needed. Apply this to clarifications and out-of-scope replies too. Preserve the user's original question. The explicit response language takes precedence over the language of the question, history and earlier general answer instructions. The separate Chinese note-title and category rules still apply."
    : "\n\nRESPONSE LANGUAGE: Use clear English for explanations, headings and related questions, including clarifications and out-of-scope replies. Keep original quoted examples and the user's question unchanged. The explicit response language takes precedence over the language of the question, history and earlier general answer instructions. The separate Chinese note-title and category rules still apply.";
}
