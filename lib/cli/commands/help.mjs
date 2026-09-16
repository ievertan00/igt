import { colors, paint } from "../ui/index.mjs";
import { cols } from "./render.mjs";

export function showHelp() {
  const sep = "─".repeat(Math.min(66, Math.max(30, cols() - 3)));
  const section = (title) => process.stdout.write("\n  " + paint(colors.yellow, title) + "\n  " + paint(colors.gray, sep) + "\n");
  const row = (command, description) => process.stdout.write("  " + paint(colors.cyan, command) + "\n    " + paint(colors.gray, description) + "\n");

  section("Learning modules");
  row("/modules  (/m)", "Browse the Word, Sentence, and Text learning modules.");
  row("/word", "Vocabulary lookup, saving, listening, and spaced review.");
  row("/sentence", "Check, translate, explain, and review individual sentences.");
  row("/text", "Check or translate a multi-line passage.");

  section("Write and understand");
  row("Type an English sentence", "Get a correction and explanation. Try a message, daily update, or work email.");
  row("/translate <text>  (/tr)", "Translate English or Chinese; Chinese input also translates automatically.");
  row("/explain [question]  (/e)", "Understand your last correction, with follow-up questions.");
  row("/ask [question]", "Explore grammar and usage; optionally save the explanation.");

  section("Build vocabulary");
  row("/add <word or phrase,...>  (/a)", "Look up words and expressions and choose whether to save them.");
  row("/word [count]  (/w, /vocab)", "Recall saved vocabulary. After revealing an answer, press a to hear it.");
  row("/word quiz [count]", "Use saved words in realistic scenarios like a native speaker.");
  row("/word --list | /word <phrase>", "Browse your vocabulary or look up a saved expression.");

  section("Listen and converse");
  row("/chat", "Practise everyday conversation or work situations with gentle corrections.");
  row("/voice [on|off|status]", "Control automatic chat speech; also works inside /chat.");
  row("/listen [English text]", "Hear the latest English expression, or text you supply. Repeat it aloud.");
  row("/listen --stop", "Stop audio. In /chat, /exit returns to the main prompt.");

  section("Practise and review");
  row("/today", "Choose grammar, vocabulary, listening, and expression practice.");
  row("/review [count]  (/r)", "Recall corrections from your own mistakes; press a for answer audio.");
  row("/quiz [1-10] [--days=30]", "Express Chinese prompts in English with personalized feedback.");
  row('/practice --type "Verb Tense"  (/p)', "Target one grammar pattern; /practice B2 10 sets level and count.");
  row("/stats  (/st)", "View activity, recurring errors, and saved learning records.");
  row("/handbook  (/h)", "Generate a reference from your recurring mistakes.");

  section("Session and settings");
  row("/retry | /undo [N]", "Retry your last input, or remove saved inputs and their associated cards.");
  row("/gemini | /qwen | /deepseek | /ollama", "Switch AI provider; /phi and /gemma select local model families.");
  row("/llm status | /theme", "Inspect your provider or choose terminal colors.");
  row('/help | /exit  (/q)', 'Show this guide or quit. Enter """ for multiline writing.');
  process.stdout.write("\n");
}
