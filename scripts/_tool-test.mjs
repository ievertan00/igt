/**
 * Quick diagnostic: test Qwen tool-calling directly without the server.
 */
import configLoader from "../lib/shared/config-loader.mjs";
import qwen from "../lib/server/llm/qwen.mjs";
import { grammarRefAvailable, SEARCH_GRAMMAR_TOOL_DEF, executeGrammarSearch } from "../lib/db/grammar-ref.mjs";

const config = configLoader.load();

console.log("Grammar ref DB available:", grammarRefAvailable());
console.log("Qwen pro model:", config.QwenProModel || "(not set, default qwen3-max)");

const question = "What is the present perfect tense?";

console.log("\n--- Calling generateWithTools with question:", question);
console.log("--- (30-second watch; if silent, check network)\n");

const timeout = setTimeout(() => {
  console.error("ERROR: No response after 30 seconds — likely a network hang.");
  process.exit(1);
}, 30000);

try {
  const result = await qwen.generateWithTools(
    question,
    "You are a grammar expert. Answer concisely.",
    [SEARCH_GRAMMAR_TOOL_DEF],
    executeGrammarSearch,
    { config, taskType: "handbook" }
  );
  clearTimeout(timeout);
  console.log("CONTENT (first 300 chars):", result.content.slice(0, 300));
  console.log("SOURCES:", JSON.stringify(result.sources, null, 2));
} catch (err) {
  clearTimeout(timeout);
  console.error("ERROR:", err.message);
}
