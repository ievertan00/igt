#!/usr/bin/env node
/**
 * LLM Provider Switcher CLI
 * Allows users to view and switch between available LLM providers
 * Now supports .env and config.json separation
 */

import initializeLLMProviders from "./llm-init.mjs";
import { configLoader } from "./llm-init.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize LLM providers
const llmManager = initializeLLMProviders();

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

function showHelp() {
  console.log(`
🤖 IGT LLM Provider Manager

Usage (from IGT prompt):
  llm list                          List all available LLM providers
  llm current                       Show current LLM provider
  llm switch <provider>             Switch to a different LLM provider
  llm setup                         Interactive setup to configure API keys
  llm status                        Show detailed status of all providers

Examples:
  llm list
  llm current
  llm switch qwen
  llm switch deepseek
  llm switch gemini
  llm status
  llm setup

Available Providers:
  - gemini    Google Gemini (default)
  - qwen      Alibaba Qwen (DashScope)
  - deepseek  Deepseek
`);
}

function listProviders() {
  const providers = llmManager.listProviders();
  const current = llmManager.getCurrentProviderName();
  
  console.log("\n📋 Available LLM Providers:");
  console.log("─".repeat(40));
  
  for (const provider of providers) {
    const isCurrent = provider === current;
    const icon = isCurrent ? "✓" : "○";
    const marker = isCurrent ? " (current)" : "";
    console.log(`  ${icon} ${provider}${marker}`);
  }
  console.log("");
}

function showCurrent() {
  const current = llmManager.getCurrentProviderName();
  console.log(`\n🎯 Current LLM Provider: ${current}\n`);
}

function switchProvider(providerName) {
  try {
    const config = llmManager.config;
    const normalizedProvider = providerName.toLowerCase();
    
    // Determine the model that will be used for this provider
    const modelMap = {
      gemini: config.GeminiFlashModel || "gemini-2.5-flash",
      qwen: config.QwenFlashModel || "qwen3.5-flash",
      deepseek: config.DeepseekFlashModel || "deepseek-chat"
    };
    
    const grammarModel = modelMap[normalizedProvider] || "unknown";
    
    const newProvider = llmManager.switchProvider(providerName);
    
    console.log(`\n✅ Switched to LLM provider: ${newProvider.toUpperCase()}`);
    console.log(`🤖 Grammar model: ${grammarModel}`);
    console.log(`💡 You can now use IGT with ${newProvider.toUpperCase()}\n`);
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

function showStatus() {
  const current = llmManager.getCurrentProviderName();
  const config = llmManager.config;

  console.log("\n📊 LLM Provider Status:");
  console.log("═".repeat(50));

  console.log(`\n🎯 Current Provider: ${current.toUpperCase()}`);
  console.log(`📁 Config: lib/igt_config.json (shared)`);
  console.log(`🔒 Secrets: .env (private, not in git)`);

  // Determine active models based on current provider
  const modelMap = {
    gemini: {
      grammar: config.GeminiFlashModel || "gemini-2.5-flash",
      pro: config.GeminiProModel || "gemini-3.0-pro"
    },
    qwen: {
      grammar: config.QwenFlashModel || "qwen3.5-flash",
      pro: config.QwenProModel || "qwen3-max"
    },
    deepseek: {
      grammar: config.DeepseekFlashModel || "deepseek-chat",
      pro: config.DeepseekProModel || "deepseek-reasoner"
    }
  };

  const activeModels = modelMap[current] || modelMap.gemini;

  console.log(`\n📦 Active Models for ${current.toUpperCase()}:`);
  console.log(`    Grammar: ${activeModels.grammar} ⚡`);
  console.log(`    Handbook/Practice: ${activeModels.pro} 🏆`);

  console.log("\n📦 All Providers:");
  console.log("─".repeat(50));

  // Gemini status
  const geminiKeys = config.GeminiApiKeys?.length || 0;
  const geminiFlash = config.GeminiFlashModel || "gemini-2.5-flash";
  const geminiPro = config.GeminiProModel || "gemini-3.0-pro";
  const isGeminiActive = current === "gemini";
  console.log(`\n  Google Gemini${isGeminiActive ? " (ACTIVE)" : ""}:`);
  console.log(`    Grammar model: ${geminiFlash} ⚡`);
  console.log(`    Handbook model: ${geminiPro} 🏆`);
  console.log(`    API Keys: ${geminiKeys} configured (in .env)`);

  // Qwen status
  const qwenKeys = config.QwenApiKeys?.length || 0;
  const qwenFlash = config.QwenFlashModel || "qwen3.5-flash";
  const qwenPro = config.QwenProModel || "qwen3-max";
  const isQwenActive = current === "qwen";
  console.log(`\n  Alibaba Qwen (DashScope)${isQwenActive ? " (ACTIVE)" : ""}:`);
  console.log(`    Grammar model: ${qwenFlash} ⚡`);
  console.log(`    Handbook model: ${qwenPro} 🏆`);
  console.log(`    API Keys: ${qwenKeys} configured (in .env)`);

  // Deepseek status
  const deepseekKeys = config.DeepseekApiKeys?.length || 0;
  const deepseekFlash = config.DeepseekFlashModel || "deepseek-chat";
  const deepseekPro = config.DeepseekProModel || "deepseek-reasoner";
  const isDeepseekActive = current === "deepseek";
  console.log(`\n  Deepseek${isDeepseekActive ? " (ACTIVE)" : ""}:`);
  console.log(`    Grammar model: ${deepseekFlash} ⚡`);
  console.log(`    Handbook model: ${deepseekPro} 🏆`);
  console.log(`    API Keys: ${deepseekKeys} configured (in .env)`);

  console.log("\n" + "═".repeat(50));
  console.log("💡 Grammar tasks use flash models (fast, cost-effective)");
  console.log("💡 Handbook & Practice use pro models (highest quality)");
  console.log("💡 Use 'switch <provider>' to change LLM provider");
  console.log("💡 Use 'setup' to configure API keys interactively\n");
}

async function interactiveSetup() {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  function askQuestion(question) {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }
  
  console.log("\n🔧 LLM Provider Setup Wizard");
  console.log("═".repeat(50));
  console.log("This will help you configure API keys for different LLM providers.");
  console.log("API keys will be stored in .env (private, not in git).\n");
  
  const config = llmManager.config;
  const envUpdates = {};
  
  // Gemini setup
  console.log("\n📦 Google Gemini:");
  console.log("  Get API key from: https://aistudio.google.com/apikey");
  const geminiKeysInput = await askQuestion("  Enter Gemini API keys (comma-separated for multiple, or press Enter to keep current): ");
  if (geminiKeysInput) {
    envUpdates.GOOGLE_API_KEYS = geminiKeysInput;
  } else if (config.GeminiApiKeys && config.GeminiApiKeys.length > 0) {
    envUpdates.GOOGLE_API_KEYS = config.GeminiApiKeys.join(",");
  }
  
  // Qwen setup
  console.log("\n📦 Alibaba Qwen (DashScope):");
  console.log("  Get API key from: https://dashscope.console.aliyun.com/apiKey");
  const qwenKeysInput = await askQuestion("  Enter Qwen API keys (comma-separated, or press Enter to keep current): ");
  if (qwenKeysInput) {
    envUpdates.DASHSCOPE_API_KEYS = qwenKeysInput;
  } else if (config.QwenApiKeys && config.QwenApiKeys.length > 0) {
    envUpdates.DASHSCOPE_API_KEYS = config.QwenApiKeys.join(",");
  }
  
  // Deepseek setup
  console.log("\n📦 Deepseek:");
  console.log("  Get API key from: https://platform.deepseek.com/api_keys");
  const deepseekKeysInput = await askQuestion("  Enter Deepseek API keys (comma-separated, or press Enter to keep current): ");
  if (deepseekKeysInput) {
    envUpdates.DEEPSEEK_API_KEYS = deepseekKeysInput;
  } else if (config.DeepseekApiKeys && config.DeepseekApiKeys.length > 0) {
    envUpdates.DEEPSEEK_API_KEYS = config.DeepseekApiKeys.join(",");
  }
  
  // Choose default provider
  console.log("\n🎯 Select your default LLM provider:");
  console.log("  1. Gemini (default)");
  console.log("  2. Qwen");
  console.log("  3. Deepseek");
  const choice = await askQuestion(`  Enter choice (1-3) [${config.LLMProvider || "gemini"}]: `);
  
  const providerMap = { "1": "gemini", "2": "qwen", "3": "deepseek" };
  if (providerMap[choice]) {
    envUpdates.IGT_LLM_PROVIDER = providerMap[choice];
  } else if (config.LLMProvider) {
    envUpdates.IGT_LLM_PROVIDER = config.LLMProvider;
  }
  
  // Save .env file
  configLoader.updateEnv(envUpdates);
  
  console.log("\n✅ Configuration saved to .env");
  console.log(`🎯 Default provider set to: ${envUpdates.IGT_LLM_PROVIDER}`);
  console.log("🔒 Your API keys are safe in .env (not tracked by git)\n");
  
  rl.close();
}

// Main command handler
async function main() {
  if (!command || command === "help" || command === "--help" || command === "-h") {
    showHelp();
    return;
  }
  
  switch (command) {
    case "list":
      listProviders();
      break;
      
    case "current":
      showCurrent();
      break;
      
    case "switch":
      const provider = args[1];
      if (!provider) {
        console.error("\n❌ Error: Please specify a provider name\n");
        console.log("Usage: node lib/llm-switch.mjs switch <provider>\n");
        process.exit(1);
      }
      switchProvider(provider);
      break;
      
    case "status":
      showStatus();
      break;
      
    case "setup":
      await interactiveSetup();
      break;
      
    default:
      console.error(`\n❌ Unknown command: ${command}\n`);
      showHelp();
      process.exit(1);
  }
}

main().catch(error => {
  console.error("\n❌ Error:", error.message, "\n");
  process.exit(1);
});
