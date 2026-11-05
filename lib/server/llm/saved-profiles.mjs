const providers = new Set(["custom", "ollama", "gemini", "qwen", "deepseek"]);

// Profile secrets stay in .env. Callers expose only the masked public projection.
export function readSavedProfiles(loader, fallback = () => []) {
  const encoded = loader.env.IGT_LLM_PROFILES;
  if (!encoded) return fallback();
  const profiles = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  if (!Array.isArray(profiles) || profiles.some(p => !p?.id || !p.name || !providers.has(p.provider) || !p.models || !Array.isArray(p.apiKeys))) {
    throw new Error("Saved model configurations could not be read");
  }
  return profiles;
}
