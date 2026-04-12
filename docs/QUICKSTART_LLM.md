# 🚀 Quick Start: Multi-LLM IGT

## What's New?

IGT now supports **3 LLM providers** that you can switch between at any time:

1. **Google Gemini** (default) - Fast, reliable grammar checking
2. **Alibaba Qwen** (DashScope) - Strong multilingual capabilities  
3. **Deepseek** - Cost-effective, excellent performance

## Setup in 3 Steps

### Step 1: Get API Keys (Choose at Least One)

| Provider | Where to Get | Free Tier |
|----------|--------------|-----------|
| **Gemini** | https://aistudio.google.com/apikey | ✅ Yes |
| **Qwen** | https://dashscope.console.aliyun.com/apiKey | ✅ Yes |
| **Deepseek** | https://platform.deepseek.com/api_keys | ✅ Yes |

### Step 2: Configure (Easiest Method)

From IGT prompt, run the setup wizard:
```
llm setup
```

This will interactively guide you through adding API keys.

### Step 3: Start Using

Just start IGT! It will use your configured provider automatically.

```powershell
./igt.ps1
```

## Switching Providers On-the-Fly

At any time during your IGT session:

```
llm switch qwen      # Switch to Qwen
llm switch deepseek  # Switch to Deepseek
llm switch gemini    # Switch back to Gemini
```

**That's it!** All your data and settings are preserved. The switch is instant.

## View Status

Check which provider you're using and see API key configuration:

```
llm status
```

Example output:
```
📊 LLM Provider Status:
══════════════════════════════════════════════════

🎯 Current Provider: GEMINI

📦 Provider Details:
──────────────────────────────────────────────────

  Google Gemini:
    Model: gemini-2.5-flash-lite
    API Keys: 3 configured
    Env Var: ○ Not set

  Alibaba Qwen (DashScope):
    Model: qwen-plus
    API Keys: 0 configured
    Env Var: ○ Not set

  Deepseek:
    Model: deepseek-chat
    API Keys: 0 configured
    Env Var: ○ Not set
```

## All LLM Commands

| Command | What It Does |
|---------|--------------|
| `llm` | Show help menu |
| `llm list` | List all available providers |
| `llm current` | Show current provider |
| `llm switch <name>` | Switch to a provider (gemini/qwen/deepseek) |
| `llm status` | Detailed status of all providers |
| `llm setup` | Interactive API key setup wizard |

## Why Switch Providers?

### Use Gemini When:
- You want the default, proven option
- You already have Gemini API keys
- You need fast response times

### Use Qwen When:
- You want to try a different AI perspective
- You have DashScope credits
- You need strong multilingual support

### Use Deepseek When:
- You want cost-effective alternative
- Gemini or Qwen rate limits are hit
- You want to compare results

## Example Workflow

```
Grammar Input > He don't like it.
Processing... Done (1523ms)
**Review**: ...
[Output from Gemini]

Grammar Input > llm switch qwen
✅ Switched to LLM provider: qwen

Grammar Input > She didn't went to school.
Processing... Done (1847ms)
**Review**: ...
[Output from Qwen - might have different perspective!]

Grammar Input > llm switch deepseek
✅ Switched to LLM provider: deepseek

Grammar Input > They is going home.
Processing... Done (1234ms)
**Review**: ...
[Output from Deepseek]
```

## Advanced: Environment Variables

For power users, you can set providers via environment variables:

```powershell
# Set provider
$env:IGT_LLM_PROVIDER="qwen"

# Set API keys
$env:GOOGLE_API_KEY="your-key"
$env:DASHSCOPE_API_KEY="your-key"
$env:DEEPSEEK_API_KEY="your-key"

./igt.ps1
```

## Troubleshooting

**"No API keys found"**
- Run `llm setup` to add keys
- Or edit `lib/igt_config.json` manually

**"Unknown provider"**
- Run `llm list` to see available options
- Check spelling (case-insensitive)

**Want to switch back?**
- Just run `llm switch gemini` to return to default

## Next Steps

- Read full documentation: [docs/multi-llm-support.md](multi-llm-support.md)
- Try all three providers and compare results
- Configure multiple API keys for automatic failover

---

**Questions?** Check [docs/multi-llm-support.md](multi-llm-support.md) for comprehensive documentation.
