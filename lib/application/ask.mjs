import { performance } from "node:perf_hooks";
import { askResponse } from "../contracts/ask.mjs";
import { handleAskTurn } from "../features/ask/handler.mjs";
import { saveSession } from "../features/ask/save-handler.mjs";
import { ASK_RESPONSE_SCHEMA, assemblePrompt, formatHistory } from "../features/ask/prompt.mjs";
import { parseAskResponse } from "../features/ask/handler.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { saveToVault } from "../features/ask/vault.mjs";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function askTurn({ sessionId, messages, question, llm, config }) {
  if (Array.isArray(messages)) return askStateless({ messages, question, llm, config });
  const startTime = performance.now();
  const result = await handleAskTurn({ sessionId, question, llm, config });
  const model = llm.getCurrentProvider().getModelName(config, "handbook");
  return {
    response: askResponse({
      data: result.response,
      perf: {
        llm_ms: result.elapsed,
        total_ms: performance.now() - startTime,
        model,
        ...(result.llmPerf ? { tool_ms: result.llmPerf.toolMs, answer_ms: result.llmPerf.answerMs, call_count: result.llmPerf.callCount } : {}),
      },
    }),
  };
}

export async function askStateless({ messages = [], question, llm, config }) {
  const startTime = performance.now();
  const template = config.Prompts?.AskPrompt;
  if (!template) throw new Error("Prompts.AskPrompt missing from config");
  const history = messages.map((item) => ({ question: item.question || item.user || "", answer: item.answer || item.assistant || "" }));
  const systemPrompt = assemblePrompt(template, { history: formatHistory(history.slice(-12)) }) +
    "\n\nFormatting rule: Do not use markdown tables. For comparisons, use short bulleted lists or compact feature-by-feature sections instead.";
  const raw = await llm.generateWithFallback(question, systemPrompt, { taskType: "ask", jsonSchema: ASK_RESPONSE_SCHEMA });
  const response = parseAskResponse(raw);
  if (!response.question) response.question = question;
  if (!response.title) response.title = "";
  if (!response.answer) response.answer = "";
  if (!Array.isArray(response.related)) response.related = [];
  response.sources = [];
  return { response: askResponse({ data: response, perf: { llm_ms: performance.now() - startTime, total_ms: performance.now() - startTime, model: llm.getCurrentProvider().getModelName(config, "handbook") } }) };
}

export function saveAsk({ sessionId, messages, llm, config }) {
  if (Array.isArray(messages)) return saveAskMessages({ messages, config });
  return saveSession({ sessionId, llm, config });
}

export function saveAskMessages({ messages = [], config }) {
  if (!messages.length) return { saved: false, response: null, vaultFile: null, turnCount: 0 };
  const targetDir = resolveAskTargetDir(config);
  const response = {
    title: messages[0]?.question || "Ask consultation",
    question: messages[0]?.question || "Ask consultation",
    answer: messages.map((item) => `**Q:** ${item.question || ""}\n\n${item.answer || ""}`).join("\n\n"),
    related: [],
  };
  return { saved: true, response, vaultFile: saveToVault(targetDir, response), turnCount: messages.length };
}

function resolveAskTargetDir(config) {
  if (config.AskPath) {
    const value = path.isAbsolute(config.AskPath) ? config.AskPath : path.join(projectRoot, config.AskPath);
    return value.endsWith(".md") ? path.dirname(value) : value;
  }
  if (config.AskDir) {
    return path.isAbsolute(config.AskDir)
      ? config.AskDir
      : path.join(projectRoot, config.AskDir);
  }

  if (config.AskFile) {
    if (path.isAbsolute(config.AskFile)) {
      return config.AskFile.endsWith(".md") ? path.dirname(config.AskFile) : config.AskFile;
    }
    if (!config.AskFile.endsWith(".md")) {
      return path.join(projectRoot, config.AskFile);
    }
  }

  return config.VaultDir
    ? (path.isAbsolute(config.VaultDir) ? config.VaultDir : path.join(projectRoot, config.VaultDir))
    : path.join(projectRoot, "docs");
}
