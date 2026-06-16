/**
 * Deepseek — OpenAI-compatible provider.
 *
 * The implementation lives in ./openai-compat.mjs; this file is just the spec.
 * Endpoint: https://api.deepseek.com/v1
 */

import { createOpenAICompatProvider } from "./openai-compat.mjs";

export default createOpenAICompatProvider({
  name: "deepseek",
  defaultBaseUrl: "https://api.deepseek.com/v1",
  baseUrlConfigKey: "DeepseekApiBase",
  keyEnvVars: ["DEEPSEEK_API_KEY"],
  keyConfigArray: "DeepseekApiKeys",
  keyConfigSingle: "DeepseekApiKey",
});
