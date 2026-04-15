# Configuration Separation Guide

## Overview

IGT now uses a **separated configuration** approach for better security and collaboration:

- **`.env`** - Private data (API keys, secrets) - **NOT tracked by git**
- **`lib/igt_config.json`** - Shared settings (paths, models, prompts) - **Safe to commit**

This separation allows you to:
- ✅ Share configuration with team members without exposing API keys
- ✅ Collaborate on prompts and settings safely
- ✅ Keep sensitive data private
- ✅ Version control shared configuration

## File Structure

### `.env` (Private)
```env
# API Keys - Comma-separated for multiple keys
GOOGLE_API_KEYS=key1,key2,key3
DASHSCOPE_API_KEYS=your-qwen-key
DEEPSEEK_API_KEYS=your-deepseek-key

# Default provider
IGT_LLM_PROVIDER=gemini

# Environment settings
GEMINI_SYSTEM_MD=false
NO_COLOR=1
```

**Important:** This file is listed in `.gitignore` and will NEVER be committed.

### `lib/igt_config.json` (Shared)
```json
{
    "ReviewPath": "D:\\Path\\To\\Review.md",
    "LLMProvider": "gemini",
    "Model": "gemini-2.5-flash-lite",
    "QwenModel": "qwen-plus",
    "DeepseekModel": "deepseek-chat",
    "DbPath": "igt_data.db",
    "ReportPath": "D:\\Path\\To\\Reports",
    "Prompts": {
        "SystemPrompt": "...",
        "HandbookGrammarRulePrompt": "...",
        "PracticeExercisePrompt": "..."
    }
}
```

**Safe to commit** - Contains no API keys.

## Quick Start

### First Time Setup

1. **Copy .env.example to .env:**
   ```powershell
   cp .env.example .env
   ```

2. **Edit .env and add your API keys:**
   ```powershell
   notepad .env
   ```

3. **Or use the interactive setup:**
   ```
   llm setup
   ```

### Migrating from Old Configuration

If you were using IGT before this update:

1. **Your old API keys have been moved** to `.env` automatically
2. **Shared configuration** remains in `lib/igt_config.json`
3. **No action needed** - everything still works as before

To verify migration:
```
llm status
```

You should see your API keys loaded from `.env`.

## How It Works

### Configuration Loading

The `lib/config-loader.mjs` module handles the merging:

```javascript
import configLoader from "./config-loader.mjs";

const config = configLoader.load();
// Returns merged config from .env + igt_config.json
```

### Priority Order

1. **Environment variables** (highest priority)
2. **`.env` file** (API keys, provider selection)
3. **`igt_config.json`** (paths, models, prompts)
4. **Defaults** (lowest priority)

### API Key Resolution

For each provider, API keys are loaded in this order:

```
GOOGLE_API_KEY (env var)
  ↓
GOOGLE_API_KEYS (from .env, comma-separated)
  ↓
ApiKeys (from old igt_config.json, backward compatibility)
```

## Managing Configuration

### Using LLM Commands

From IGT prompt:

```
llm setup           # Interactive wizard for .env
llm status          # Show loaded keys (from .env)
llm switch qwen     # Updates .env IGT_LLM_PROVIDER
```

### Manual Editing

**Edit .env:**
```powershell
notepad .env
```

**Edit shared config:**
```powershell
notepad lib\igt_config.json
```

### Adding Multiple API Keys

In `.env`, separate keys with commas:
```env
GOOGLE_API_KEYS=key1,key2,key3
```

This enables automatic failover if one key hits rate limits.

## Security Best Practices

### ✅ DO:
- Keep `.env` in `.gitignore` (already done)
- Use `.env.example` as a template for team members
- Commit only `igt_config.json` changes
- Rotate API keys periodically

### ❌ DON'T:
- Commit `.env` to git
- Share API keys in chat/email
- Use same API key across projects
- Leave unused provider keys empty (remove them)

## Collaboration Workflow

### For Team Leaders

1. **Configure shared settings** in `igt_config.json`
2. **Commit changes** to git
3. **Share `.env.example`** with team (no real keys)
4. **Team members** copy `.env.example` to `.env` and add their own keys

### For Team Members

1. **Pull latest** code from git
2. **Copy template:** `cp .env.example .env`
3. **Edit `.env`** with your API keys
4. **Run IGT:** `./igt.ps1`

## Environment Variables Reference

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `GOOGLE_API_KEYS` | Private | Gemini API keys (comma-separated) | `key1,key2` |
| `DASHSCOPE_API_KEYS` | Private | Qwen API keys | `sk-xxx` |
| `DEEPSEEK_API_KEYS` | Private | Deepseek API keys | `sk-xxx` |
| `IGT_LLM_PROVIDER` | Private | Default LLM provider | `gemini`, `qwen`, `deepseek` |
| `GEMINI_SYSTEM_MD` | Shared | Disable system prompt overhead | `false` |
| `NO_COLOR` | Shared | Disable colored output | `1` |

## Troubleshooting

### "No API keys found"

**Check .env exists:**
```powershell
Test-Path .env
```

**Check keys are loaded:**
```
llm status
```

**Verify .env format:**
```env
GOOGLE_API_KEYS=key1,key2
```
(No spaces around `=`, keys comma-separated)

### "Config file not found"

Ensure `lib/igt_config.json` exists. If missing:
```powershell
cp lib/igt_config.json.example lib/igt_config.json
```

### Accidentally Committed .env

If you accidentally committed `.env`:

1. **Remove from git:**
   ```powershell
   git rm --cached .env
   git commit -m "Remove .env from tracking"
   ```

2. **Add to .gitignore** (already there)

3. **Rotate API keys** in `.env` (they may be exposed)

### Migration Issues

If old configuration still exists:

```powershell
# Check for old format
cat lib/igt_config.json | Select-String "ApiKeys"

# Should NOT see ApiKeys in config.json
# ApiKeys should be in .env only
```

## Advanced Usage

### Custom .env Location

Set environment variable to override .env path:
```powershell
$env:ENV_FILE="D:\\Secure\\config\\.env"
./igt.ps1
```

### Multiple Environments

Create environment-specific files:
```
.env.development
.env.production
```

Load specific one:
```powershell
$env:ENV_FILE=".env.production"
./igt.ps1
```

### Programmatic Access

```javascript
import { configLoader } from "./lib/config-loader.mjs";

const config = configLoader.load();

// Access API keys
console.log(config.GeminiApiKeys);

// Update .env
configLoader.updateEnv({ IGT_LLM_PROVIDER: "qwen" });
```

## Summary

| Aspect | `.env` | `igt_config.json` |
|--------|--------|-------------------|
| **Content** | API keys, secrets | Paths, models, prompts |
| **Git Tracked** | ❌ No | ✅ Yes |
| **Shareable** | ❌ Private | ✅ Safe |
| **Location** | Project root | `lib/` directory |
| **Format** | KEY=VALUE lines | JSON object |
| **Edit Frequency** | Rarely (setup) | Often (customization) |

---

**Need Help?** See [QUICKSTART_LLM.md](../QUICKSTART_LLM.md) for LLM setup or [README.md](../README.md) for general usage.
