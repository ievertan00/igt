import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

// 1. Load config and input
const config = JSON.parse(fs.readFileSync("./igt_config.json", "utf8"));
const apiKey = process.env.GOOGLE_API_KEY || config.ApiKey;
const systemPrompt = fs.readFileSync(config.SystemPromptPath, "utf8");
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
  console.log(result.response.text());
} catch (error) {
  console.error("Gemini Error:", error.message);
  process.exit(1);
}
