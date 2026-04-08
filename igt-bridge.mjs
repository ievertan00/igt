import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load config and input
const configPath = path.join(__dirname, "igt_config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const apiKey = process.env.GOOGLE_API_KEY || config.ApiKey;

// Handle system prompt path resolution
let systemPromptPath = config.SystemPromptPath;
if (!path.isAbsolute(systemPromptPath)) {
  systemPromptPath = path.join(__dirname, systemPromptPath);
}
const systemPrompt = fs.readFileSync(systemPromptPath, "utf8");

const userInput = fs.readFileSync(0, "utf8"); // Read from stdin

if (!apiKey) {
  console.error("Error: API Key not found. Set GOOGLE_API_KEY env var or add to igt_config.json.");
  process.exit(1);
}

// 2. Initialize Gemini
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ 
  model: config.Model || "gemini-2.5-flash-lite",
  systemInstruction: systemPrompt
});

// 3. Generate
try {
  const result = await model.generateContent(userInput);
  const text = result.response.text().trim();
  console.log(text);
} catch (error) {
  console.error("Gemini Error:", error.message);
  process.exit(1);
}
