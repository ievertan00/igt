/** User-configured OpenAI-compatible cloud or local endpoint. */
import { createOpenAICompatProvider } from "./openai-compat.mjs";

export default createOpenAICompatProvider({
  name: "custom",
  defaultBaseUrl: "http://localhost:1234/v1",
  baseUrlConfigKey: "CustomApiBase",
  keyEnvVars: ["IGT_CUSTOM_API_KEY"],
  keyConfigArray: "CustomApiKeys",
  keyConfigSingle: "CustomApiKey",
  allowNoKey: true,
});
