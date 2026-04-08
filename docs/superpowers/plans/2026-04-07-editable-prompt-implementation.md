# Editable System Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the hardcoded "Linguistic Validator" system prompt into an external `system_prompt.txt` file and update IGT scripts to load it from there with a safety fallback.

**Architecture:** 
1. Create `system_prompt.txt` with current content.
2. Update `igt_config.json` to include `"SystemPromptPath": "system_prompt.txt"`.
3. Update `igt.ps1` and `profile_igt.ps1` to load the prompt from the file while maintaining a hardcoded string as a fallback.
4. Update `profile_igt.ps1` to include the file loading time in its performance analysis.

**Tech Stack:** PowerShell, JSON.

---

### Task 1: Initialize Prompt File and Config

**Files:**
- Create: `system_prompt.txt`
- Modify: `igt_config.json`

- [ ] **Step 1: Create the prompt file**

Create `system_prompt.txt` with the current "Linguistic Validator" content.

```powershell
$promptContent = @"
Act as an expert 'Linguistic Validator,' 'Professional Editor,' and 'Master Wordsmith.' Your goal is to provide meticulous text reviews. Focus strictly on the latest input content; treat the input as a standalone text and ignore all historical conversation context.

Purpose and Goals:
Audit: Review user-provided text for all grammatical errors, including syntax, punctuation, spelling, and tense consistency.

Enhance: Improve clarity, conciseness, flow, and impact while strictly preserving the original meaning and intent.
Deliver: Provide a polished, professional, and error-free final version of the user's text.

Behaviors and Rules:
Initial Assessment:
State immediately if the text is 'Grammatically Correct' or 'Requires Corrections'.
List specific error types found (e.g., 'Subject-Verb Agreement', 'Punctuation', 'Typos').

You must strictly follow this Output Format:
**Review**: [State "The original sentence is grammatically correct/incorrect." List specific errors identified and briefly explain the reasoning.]
**Correction**: [Correct grammatical errors and generate the optimized, error-free version of the original sentence.]
**Refine**: [Generate a polished version of the original sentence that is more natural, precise, and professional.]
"@
$promptContent | Out-File -FilePath "system_prompt.txt" -Encoding utf8
```

- [ ] **Step 2: Update `igt_config.json`**

Add the `SystemPromptPath` setting.

```json
{
    "ReviewPath": "D:\\Library\\-06Notes\\Obsidian Vault\\02_Knowledge\\EnglishGrammar\\Review_&_Feedback.md",
    "Model": "gemini-2.5-flash",
    "SystemPromptPath": "system_prompt.txt"
}
```

- [ ] **Step 3: Commit**

```bash
git add system_prompt.txt igt_config.json
git commit -m "feat: move system prompt to external file and update config"
```

---

### Task 2: Update `igt.ps1` with Loading Logic

**Files:**
- Modify: `igt.ps1`

- [ ] **Step 1: Implement prompt loading with fallback**

Update section `# 2. Optimized System Prompt` in `igt.ps1`.

```powershell
# 2. Optimized System Prompt (Load with Fallback)
$defaultPrompt = @"
Act as an expert 'Linguistic Validator,' 'Professional Editor,' and 'Master Wordsmith.' Your goal is to provide meticulous text reviews. Focus strictly on the latest input content; treat the input as a standalone text and ignore all historical conversation context.

Purpose and Goals:
Audit: Review user-provided text for all grammatical errors, including syntax, punctuation, spelling, and tense consistency.

Enhance: Improve clarity, conciseness, flow, and impact while strictly preserving the original meaning and intent.
Deliver: Provide a polished, professional, and error-free final version of the user's text.

Behaviors and Rules:
Initial Assessment:
State immediately if the text is 'Grammatically Correct' or 'Requires Corrections'.
List specific error types found (e.g., 'Subject-Verb Agreement', 'Punctuation', 'Typos').

You must strictly follow this Output Format:
**Review**: [State "The original sentence is grammatically correct/incorrect." List specific errors identified and briefly explain the reasoning.]
**Correction**: [Correct grammatical errors and generate the optimized, error-free version of the original sentence.]
**Refine**: [Generate a polished version of the original sentence that is more natural, precise, and professional.]
"@

$systemPrompt = $defaultPrompt
if (-not [string]::IsNullOrWhiteSpace($config.SystemPromptPath)) {
    $fullPromptPath = if ([System.IO.Path]::IsPathRooted($config.SystemPromptPath)) { $config.SystemPromptPath } else { Join-Path $scriptDir $config.SystemPromptPath }
    if (Test-Path $fullPromptPath) {
        try {
            $systemPrompt = Get-Content -Path $fullPromptPath -Raw -ErrorAction Stop
            Write-Host "[Loaded system prompt from: $($config.SystemPromptPath)]" -ForegroundColor DarkGray
        } catch {
            Write-Host "Warning: Could not read system prompt file. Using default." -ForegroundColor Yellow
        }
    }
}
```

- [ ] **Step 2: Verify by running IGT**

Run: `.\igt.ps1` (and type 'exit')
Expected: Output shows `[Loaded system prompt from: system_prompt.txt]` and the tool starts normally.

- [ ] **Step 3: Commit**

```bash
git add igt.ps1
git commit -m "feat: implement dynamic prompt loading in igt.ps1"
```

---

### Task 3: Update `profile_igt.ps1` with Loading Logic

**Files:**
- Modify: `profile_igt.ps1`

- [ ] **Step 1: Implement prompt loading and performance tracking**

Update `profile_igt.ps1` to include loading logic and track its time.

```powershell
# 1. Load Config & Prompt
$sw_step = [System.Diagnostics.Stopwatch]::StartNew()
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$model = if ([string]::IsNullOrWhiteSpace($config.Model)) { "gemini-2.5-flash" } else { $config.Model }
$targetPath = $config.ReviewPath

$defaultPrompt = @"
Act as an expert 'Linguistic Validator,' 'Professional Editor,' and 'Master Wordsmith.' Your goal is to provide meticulous text reviews. Focus strictly on the latest input content; treat the input as a standalone text and ignore all historical conversation context.

Purpose and Goals:
Audit: Review user-provided text for all grammatical errors, including syntax, punctuation, spelling, and tense consistency.

Enhance: Improve clarity, conciseness, flow, and flow and impact while strictly preserving the original meaning and intent.
Deliver: Provide a polished, professional, and error-free final version of the user's text.

Behaviors and Rules:
Initial Assessment:
State immediately if the text is 'Grammatically Correct' or 'Requires Corrections'.
List specific error types found (e.g., 'Subject-Verb Agreement', 'Punctuation', 'Typos').

You must strictly follow this Output Format:
**Review**: [State "The original sentence is grammatically correct/incorrect." List specific errors identified and briefly explain the reasoning.]
**Correction**: [Correct grammatical errors and generate the optimized, error-free version of the original sentence.]
**Refine**: [Generate a polished version of the original sentence that is more natural, precise, and professional.]
"@

$systemPrompt = $defaultPrompt
if (-not [string]::IsNullOrWhiteSpace($config.SystemPromptPath)) {
    $fullPromptPath = if ([System.IO.Path]::IsPathRooted($config.SystemPromptPath)) { $config.SystemPromptPath } else { Join-Path $scriptDir $config.SystemPromptPath }
    if (Test-Path $fullPromptPath) {
        try {
            $systemPrompt = Get-Content -Path $fullPromptPath -Raw -ErrorAction Stop
        } catch { }
    }
}
$time_config_prompt = $sw_step.Elapsed.TotalMilliseconds

# ... (rest of the script updates)
```

- [ ] **Step 2: Update Performance Output**

Change the performance analysis output to show the new timing.

```powershell
Write-Host "`n--- IGT Workflow Performance Analysis ---" -ForegroundColor Yellow
Write-Host ("{0,-30} : {1,10:F2} ms" -f "Config & Prompt Loading", $time_config_prompt)
# ...
```

- [ ] **Step 3: Run profiler to verify**

Run: `.\profile_igt.ps1`
Expected: Performance report shows "Config & Prompt Loading" time (should be < 10ms).

- [ ] **Step 4: Commit**

```bash
git add profile_igt.ps1
git commit -m "feat: update profiler to track prompt loading performance"
```

---

### Task 4: Functional Verification

**Files:**
- Create: `test_prompt_config.ps1`

- [ ] **Step 1: Write verification script**

Create a script that tests editing the file and fallback behavior.

```powershell
# Verify editable prompt
$testFile = "system_prompt_test.txt"
"Act as a pirate." | Out-File -FilePath $testFile -Encoding utf8

# 1. Test custom prompt
Write-Host "Testing custom prompt..." -ForegroundColor Gray
$config = Get-Content "igt_config.json" -Raw | ConvertFrom-Json
$config.SystemPromptPath = $testFile
$config | ConvertTo-Json | Out-File "igt_config.json" -Encoding utf8

# Check if IGT picks it up (visually verify the output)
Write-Host "Please verify that IGT says '[Loaded system prompt from: system_prompt_test.txt]'" -ForegroundColor Yellow
& .\igt.ps1 (Type 'exit')

# 2. Test fallback (delete file)
Write-Host "Testing fallback..." -ForegroundColor Gray
Remove-Item $testFile
& .\igt.ps1 (Type 'exit')
Write-Host "Please verify that IGT starts normally despite missing file." -ForegroundColor Yellow

# Reset config
$config.SystemPromptPath = "system_prompt.txt"
$config | ConvertTo-Json | Out-File "igt_config.json" -Encoding utf8
```

- [ ] **Step 2: Run verification**

Run: `.\test_prompt_config.ps1`
Expected: Visual confirmation of loading and fallback.

- [ ] **Step 3: Cleanup and Final Commit**

Remove the test script and commit.

```bash
rm test_prompt_config.ps1
git commit -m "test: verify editable prompt and fallback"
```
