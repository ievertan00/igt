# Multi-LLM Support Guide

IGT now supports multiple LLM (Large Language Model) providers, allowing you to switch between different AI services at any time.

## Available LLM Providers

### 1. **Google Gemini** (Default)
- **Models**: `gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro`
- **API**: Google AI Studio
- **Get API Key**: https://aistudio.google.com/apikey
- **Pricing**: Free tier available, pay-as-you-go

### 2. **Alibaba Qwen (DashScope)**
- **Models**: `qwen-plus`, `qwen-turbo`, `qwen-max`, `qwen-long`
- **API**: DashScope (Alibaba Cloud)
- **Get API Key**: https://dashscope.console.aliyun.com/apiKey
- **Pricing**: Competitive pricing, free tier available

### 3. **Deepseek**
- **Models**: `deepseek-chat`, `deepseek-coder`
- **API**: Deepseek Platform
- **Get API Key**: https://platform.deepseek.com/api_keys
- **Pricing**: Cost-effective, strong coding capabilities

## Task-Based Model Routing

IGT uses different models for different tasks to optimize for both **cost** and **quality**:

| Task | Model Tier | Purpose |
|------|-----------|---------|
| **Grammar Correction** | Flash ⚡ | Fast, cost-effective for high-volume checks |
| **Handbook Generation** | Pro 🏆 | Highest quality for detailed explanations |
| **Practice Exercises** | Pro 🏆 | Best reasoning for exercise generation |

### Default Models

| Provider | Flash Model | Pro Model |
|----------|-------------|-----------|
| **Gemini** | `gemini-2.5-flash` | `gemini-3.0-pro` |
| **Qwen** | `qwen3.5-flash` | `qwen3-max` |
| **Deepseek** | `deepseek-chat` | `deepseek-reasoner` |

### Configuration

Models are configured in `lib/igt_config.json` with per-provider, per-task fields:

```json
{
  "GeminiFlashModel": "gemini-2.5-flash",
  "GeminiProModel": "gemini-3.0-pro",
  "QwenFlashModel": "qwen3.5-flash",
  "QwenProModel": "qwen3-max",
  "DeepseekFlashModel": "deepseek-chat",
  "DeepseekProModel": "deepseek-reasoner"
}
```

View current model configuration with:
```
llm status
```

## Quick Start

### Method 1: Interactive Setup (Recommended)

Run the setup wizard from the IGT prompt:
```
llm setup
```

This will guide you through configuring API keys for all providers interactively.

### Method 2: Manual Configuration

Edit `lib/igt_config.json` and add your API keys:

```json
{
  "LLMProvider": "gemini",
  "ApiKeys": ["your-gemini-key-1", "your-gemini-key-2"],
  "QwenApiKeys": ["your-qwen-key"],
  "DeepseekApiKeys": ["your-deepseek-key"],
  "Model": "gemini-2.5-flash-lite",
  "QwenModel": "qwen-plus",
  "DeepseekModel": "deepseek-chat"
}
```

### Method 3: Environment Variables

Set environment variables in your system:
```powershell
# For Gemini
$env:GOOGLE_API_KEY="your-gemini-key"

# For Qwen (either works)
$env:DASHSCOPE_API_KEY="your-qwen-key"
$env:QWEN_API_KEY="your-qwen-key"

# For Deepseek
$env:DEEPSEEK_API_KEY="your-deepseek-key"
```

Then set the provider:
```powershell
$env:IGT_LLM_PROVIDER="qwen"  # or "gemini" or "deepseek"
```

## LLM Management Commands

From the IGT interactive prompt, use these commands:

### View Available Providers
```
llm list
```

### Show Current Provider
```
llm current
```

### Switch Provider
```
llm switch qwen
llm switch deepseek
llm switch gemini
```

### View Detailed Status
```
llm status
```

### Run Setup Wizard
```
llm setup
```

### Show Help
```
llm
llm help
```

## Command Line Usage

You can also manage LLM providers directly from the command line:

```powershell
# List providers
node lib/llm-switch.mjs list

# Switch provider
node lib/llm-switch.mjs switch qwen

# View status
node lib/llm-switch.mjs status

# Run setup
node lib/llm-switch.mjs setup
```

## Provider-Specific Configuration

### Google Gemini
```json
{
  "LLMProvider": "gemini",
  "Model": "gemini-2.5-flash-lite",
  "ApiKeys": [
    "AIzaSy...",
    "AIzaSy..."
  ]
}
```

**Features:**
- Multiple API key support for failover
- System instruction support
- Fast response times

### Alibaba Qwen (DashScope)
```json
{
  "LLMProvider": "qwen",
  "QwenModel": "qwen-plus",
  "QwenApiKeys": [
    "sk-..."
  ],
  "QwenApiBase": "https://dashscope.aliyuncs.com/compatible-mode/v1"
}
```

**Features:**
- OpenAI-compatible API endpoint
- Multiple model options
- Custom API base URL support

**Available Models:**
- `qwen-turbo`: Fast, cost-effective
- `qwen-plus`: Balanced performance
- `qwen-max`: Highest quality
- `qwen-long`: Long context window

### Deepseek
```json
{
  "LLMProvider": "deepseek",
  "DeepseekModel": "deepseek-chat",
  "DeepseekApiKeys": [
    "sk-..."
  ],
  "DeepseekApiBase": "https://api.deepseek.com/v1"
}
```

**Features:**
- OpenAI-compatible API
- Strong multilingual support
- Cost-effective pricing

**Available Models:**
- `deepseek-chat`: General purpose
- `deepseek-coder`: Code-specialized

## Switching LLMs at Any Time

You can switch LLM providers **at any time** without restarting IGT:

1. **During a session**: Simply type `llm switch <provider>` at the IGT prompt
2. **Before starting**: Set `IGT_LLM_PROVIDER` environment variable
3. **Permanently**: Update `LLMProvider` in `igt_config.json`

All tools (grammar checking, handbook generation, practice) will automatically use the new provider.

## Architecture

The multi-LLM system uses a unified provider interface:

```
┌─────────────────────────────────────┐
│       LLM Provider Manager          │
│    (llm-provider.mjs)               │
└──────────────┬──────────────────────┘
               │
     ┌─────────┼─────────┐
     │         │         │
┌────▼───┐ ┌──▼──┐ ┌▼──────┐
│ Gemini │ │Qwen │ │Deepsek│
└────────┘ └─────┘ └───────┘
```

**Key Files:**
- `lib/llm-provider.mjs`: Core provider manager
- `lib/llm-gemini.mjs`: Gemini implementation
- `lib/llm-qwen.mjs`: Qwen implementation
- `lib/llm-deepseek.mjs`: Deepseek implementation
- `lib/llm-init.mjs`: Provider initialization
- `lib/llm-switch.mjs`: CLI management tool

## Troubleshooting

### "No API keys found" Error
- Check that API keys are configured in `igt_config.json`
- Verify environment variables are set correctly
- Run `llm status` to see current configuration

### "Unknown provider" Error
- Use `llm list` to see available providers
- Check provider name spelling (case-insensitive)
- Ensure provider modules are properly initialized

### API Key Not Working
- Verify the API key is valid and active
- Check if you've exceeded rate limits or quota
- Try regenerating the API key from the provider's console

### Model Not Available
- Some models may require special access or subscriptions
- Check the provider's documentation for available models
- Update the model name in config (e.g., `QwenModel`, `DeepseekModel`)

## Best Practices

1. **Multiple API Keys**: Configure multiple keys for the same provider for automatic failover
2. **Environment Variables**: Use env vars for sensitive API keys instead of storing in config files
3. **Model Selection**: Choose models based on your needs (speed vs. quality vs. cost)
4. **Testing**: Test different providers to see which gives the best results for your use case
5. **Cost Management**: Monitor API usage and set budgets in provider consoles

## Migration from Old Setup

If you were using IGT before this update, your existing Gemini configuration is automatically preserved. No action is needed unless you want to:

- Add Qwen or Deepseek API keys
- Switch to a different default provider
- Use different models

Your existing `ApiKeys` array continues to work for Gemini.

## Support

For issues or questions:
- Check provider documentation (Google AI Studio, DashScope, Deepseek Platform)
- Review error messages in the IGT console
- Verify API key permissions and quotas in provider consoles
