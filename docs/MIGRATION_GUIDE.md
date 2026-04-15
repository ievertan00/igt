# Migration Guide: Configuration Separation

## What Changed?

IGT has separated configuration into two files for better security:

**Before:**
- All config (including API keys) in `lib/igt_config.json`

**After:**
- `.env` - API keys (private, not in git)
- `lib/igt_config.json` - Paths, models, prompts (shared, safe to commit)

## Automatic Migration

✅ **No action required!** Your existing configuration has been automatically migrated.

When you first run the new IGT:
1. API keys were moved from `igt_config.json` to `.env`
2. Shared settings remain in `igt_config.json`
3. Everything continues to work as before

## Verify Migration

Check that your configuration is properly separated:

```powershell
# Run IGT and check status
./igt.ps1
> llm status
```

You should see:
```
📊 LLM Provider Status:
══════════════════════════════════════════════════

🎯 Current Provider: GEMINI
📁 Config: lib/igt_config.json (shared)
🔒 Secrets: .env (private, not in git)

  Google Gemini:
    API Keys: 3 configured (in .env)  ← Should show your keys
```

## Manual Migration (If Needed)

If automatic migration didn't work:

### Step 1: Create .env file

```powershell
cp .env.example .env
```

### Step 2: Move API keys to .env

**Edit `.env`:**
```env
GOOGLE_API_KEYS=your-key-1,your-key-2,your-key-3
DASHSCOPE_API_KEYS=your-qwen-key
DEEPSEEK_API_KEYS=your-deepseek-key
IGT_LLM_PROVIDER=gemini
```

### Step 3: Remove API keys from config.json

**Edit `lib/igt_config.json`:**

Remove these lines:
```json
"ApiKeys": ["key1", "key2"],
"QwenApiKeys": [],
"DeepseekApiKeys": [],
```

Keep everything else (paths, models, prompts).

### Step 4: Verify

```powershell
node lib/llm-switch.mjs status
```

## For Team Collaboration

### If you're sharing the project

1. **`.env` is already in `.gitignore`** - Your API keys are safe
2. **Share `.env.example`** with teammates (template with no real keys)
3. **Commit `igt_config.json`** - Safe to share (no API keys)

### New team member setup

```powershell
# 1. Clone repo
git clone <repo-url>
cd igt

# 2. Copy template
cp .env.example .env

# 3. Add personal API keys
notepad .env

# 4. Run IGT
./igt.ps1
> llm setup  # Interactive wizard
```

## Benefits of Separation

### ✅ Security
- API keys never committed to git
- Easy to rotate keys without config changes
- Separate keys for dev/prod environments

### ✅ Collaboration
- Share prompts and paths safely
- Team members use their own API keys
- No accidental key exposure

### ✅ Organization
- Clear separation of concerns
- Easier to understand what's private vs shared
- Simpler version control

## Troubleshooting

### "No API keys found" after migration

**Check .env exists:**
```powershell
Test-Path .env
```

**Check .env has keys:**
```powershell
cat .env | Select-String "GOOGLE_API_KEYS"
```

**Should show:**
```
GOOGLE_API_KEYS=key1,key2,key3
```

### Old API keys still in config.json

**Remove them manually:**

1. Open `lib/igt_config.json`
2. Remove `"ApiKeys"`, `"QwenApiKeys"`, `"DeepseekApiKeys"` lines
3. Save file

**Or use PowerShell:**
```powershell
$config = Get-Content lib\igt_config.json | ConvertFrom-Json
$config.PSObject.Properties.Remove('ApiKeys')
$config.PSObject.Properties.Remove('QwenApiKeys')
$config.PSObject.Properties.Remove('DeepseekApiKeys')
$config | ConvertTo-Json -Depth 10 | Set-Content lib\igt_config.json
```

### Want to start fresh?

```powershell
# Backup old config
cp lib\igt_config.json lib\igt_config.json.backup

# Create new .env from template
cp .env.example .env

# Edit and add your keys
notepad .env
```

## Comparison Table

| Aspect | Before | After |
|--------|--------|-------|
| **API Keys Location** | `igt_config.json` | `.env` |
| **Git Tracked** | Everything except `igt_config.json` | Only `.env.example` |
| **Sharing Config** | Risky (keys exposed) | Safe (keys in `.env`) |
| **Team Setup** | Share config carefully | Share `.env.example` |
| **File Count** | 1 config file | 2 config files |
| **Security** | Moderate | High |

## Need Help?

- **Setup issues:** See [QUICKSTART_LLM.md](QUICKSTART_LLM.md)
- **Configuration guide:** See [docs/config-separation.md](docs/config-separation.md)
- **General usage:** See [README.md](README.md)

---

**Migration completed successfully!** 🎉

Your IGT is now more secure and collaboration-ready.
