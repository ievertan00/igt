/**
 * Qwen (DashScope / Alibaba Cloud) — OpenAI-compatible provider.
 *
 * The implementation lives in ./openai-compat.mjs; this file is just the spec.
 * Endpoint: https://dashscope.aliyuncs.com/compatible-mode/v1
 */

import { createOpenAICompatProvider } from "./openai-compat.mjs";

export default createOpenAICompatProvider({
  name: "qwen",
  defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  baseUrlConfigKey: "QwenApiBase",
  keyEnvVars: ["DASHSCOPE_API_KEY", "QWEN_API_KEY"],
  keyConfigArray: "QwenApiKeys",
  keyConfigSingle: "QwenApiKey",
});
