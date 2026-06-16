# IGT Context

Domain language for IGT (Interactive Grammar Tool). This glossary names the
project-specific concepts so architecture reviews and design discussions stay
consistent. General programming concepts (timeouts, retries, error codes) are
deliberately excluded.

## Language

**Provider**:
An LLM backend IGT can talk to — Gemini, Qwen, Deepseek, or Ollama. Each one
satisfies the same provider interface (`generate`, `generateWithFallback`,
`generateWithTools`, `getApiKeys`, `getModelName`) and is registered with the
provider manager at boot.
_Avoid_: backend, vendor, model (a model is what a provider runs, not the provider).

**Provider spec**:
The small declarative description of a single OpenAI-compatible provider — its
name, default base URL, base-URL config key, and where its API keys come from.
A spec carries only what genuinely differs between providers; all shared
behaviour lives in the openai-compat adapter.
_Avoid_: config, options, settings.

**OpenAI-compat adapter**:
The one implementation behind every provider that speaks the OpenAI
`/chat/completions` protocol (currently Qwen and Deepseek). Built from a
provider spec via `createOpenAICompatProvider`. Gemini (own SDK) and Ollama
(native `/api/chat`) are not openai-compat adapters.
_Avoid_: wrapper, client, base provider.

**Task tier**:
The quality/speed class a request routes to: **flash** (interactive — grammar,
ask, chat, practice, translation) or **pro** (non-interactive, quality-critical
— handbook). The model resolver maps each provider + task to a concrete model.
_Avoid_: mode, level, profile.

## Example dialogue

> **Dev:** When I add a new provider like Mistral, do I copy the Deepseek file?
> **Expert:** No — Mistral is OpenAI-compatible, so it's just a new provider
> spec: name, base URL, key sources. The openai-compat adapter already has the
> request, retry, and tool loop.
> **Dev:** And it picks the model how?
> **Expert:** The spec only names the provider. The model resolver maps that
> provider plus the task tier — flash for grammar, pro for handbook — to the
> actual model.
> **Dev:** So Gemini could be a spec too?
> **Expert:** No. Gemini isn't an openai-compat adapter — different SDK and it
> can't combine tools with a response schema. It stays its own provider.
