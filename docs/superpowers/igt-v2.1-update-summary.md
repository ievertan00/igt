# IGT Reliability & Performance Update (v2.1) - Summary of Work

**Date:** 2026-04-07
**Project:** Interactive Grammar Tool (IGT)
**Status:** Completed & Deployed to `igt.ps1`

## 1. Executive Summary
This update transitions the IGT from a performance-only tool to a highly reliable, "Obsidian-safe" production utility. We identified that the model generation (Gemini Call) was the primary bottleneck (~98% of wall-clock time), allowing us to sacrifice negligible micro-optimizations in logging for massive gains in reliability and file-system compatibility.

## 2. New Features & Improvements

### 2.1. "Obsidian-Safe" Surgical Logging
- **The Problem**: Previously, IGT held an exclusive write lock on the log file for the entire session, causing "Access Denied" errors in Obsidian and sync services.
- **The Solution**: Switched to an on-demand "Open-Append-Close" pattern.
- **Benefit**: The log file is now only locked for ~1-5ms per result. You can keep Obsidian open and edit/view the log file simultaneously without conflict.

### 2.2. Intelligent Lock Recovery
- **Mechanism**: If the log file is temporarily locked (e.g., during an Obsidian auto-save or cloud sync), IGT now performs **2 automatic retries** at 100ms intervals.
- **Resilience**: If the lock persists, the script warns the user but continues the session instead of crashing or permanently disabling logging ("Transient Mode").

### 2.3. Robust Prompt Construction (v2.1)
- **Formatting Fix**: Removed the PowerShell `-f` (format) operator for prompt building.
- **Safety**: Inputs containing `{0}`, `{1}`, or other bracketed placeholders no longer cause PowerShell runtime crashes.
- **Literal Input handling**: User inputs (e.g., `$env:VAR`) are now treated as literal text and passed to Gemini without unintended PowerShell variable expansion.

## 3. Performance Analysis Results
| Input Type | Startup | Gemini Call (Bottleneck) | Processing/Logging |
| :--- | :--- | :--- | :--- |
| **Short** | ~131ms | **~8,516ms** | **< 45ms** |
| **Long** | ~131ms | **~9,779ms** | **< 1ms** |

*Analysis confirmed that the 9-second Gemini latency makes the millisecond-level logging overhead irrelevant to user experience.*

## 4. Technical Implementation Details
- **Files Modified**: `C:\Users\Evertan\.igt\igt.ps1`
- **Logic Added**: `function Log-Result` with `try-catch` retry loop and `Add-Content` surgical append.
- **Instrumentation**: Added `[System.Diagnostics.Stopwatch]` during the analysis phase to validate optimization trade-offs.

---
*Work completed by Gemini CLI.*
