import { colors, paint } from "../ui/index.mjs";
import { cols } from "./render.mjs";

export function showHelp() {
  const sep = "─".repeat(Math.min(66, Math.max(30, cols() - 3)));
  const section = (title) => process.stdout.write("\n  " + paint(colors.yellow, title) + "\n  " + paint(colors.gray, sep) + "\n");
  const row = (command, description) => process.stdout.write("  " + paint(colors.cyan, command) + "\n    " + paint(colors.gray, description) + "\n");

  section("Learning modules");
  row("/modules  (/m)", "Browse the Word, Sentence, and Text learning modules.");
  row("/word lookup <word>", "Look up a word or phrase in the vocabulary source.");
  row("/word add <word,...>", "Look up and save one or more vocabulary items.");
  row("/word review [count]", "Review saved vocabulary with spaced repetition.");
  row("/word list", "Browse saved vocabulary.");
  row("/sentence", "Check, translate, explain, and review individual sentences.");
  row("/text", "Open the default text editor and analyze a complete passage.");

  section("Write and understand");
  row("Type an English sentence", "Get a correction and explanation. Try a message, daily update, or work email.");
  row("/translate <text>  (/tr)", "Translate English or Chinese; Chinese input also translates automatically.");
  row("/explain [question]  (/e)", "Understand your last correction, with follow-up questions.");
  row("/ask [question]", "Explore grammar and usage; optionally save the explanation.");

  section("Build vocabulary");
  row("/add <word or phrase,...>  (/a)", "Look up words and expressions and choose whether to save them.");
  row("/word [count]  (/w, /vocab)", "Recall saved vocabulary. After revealing an answer, press a to hear it.");
  row("/vocab-test [count]  (/vtest)", "Complete vocabulary test: recall, usage, and realistic scenario production.");
  row("/word quiz [count]", "Legacy alias for /vocab-test.");
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
  row("/practice [mode] [3-12]  (/p)", "Produce sentences and expressions in varied real-life scenarios.");
  row("/practice sentence|expression", "Focus one production skill; mixed is the default.");
  row('/drill [--type "Verb Tense"]  (/mc)', "Multiple-choice grammar drills; /drill B2 10 sets level and count.");
  row("/stats  (/st)", "View activity, recurring errors, and saved learning records.");
  row("/handbook  (/h)", "Generate a reference from your recurring mistakes.");
  row("/coach [--days=90] [--resources=local]", "Use the Pro model to analyze English ability and create an evidence-based two-week plan.");
  row("/coach --complete=<task-id>", "Mark a persisted coach task complete; /today shows pending tasks.");
  row("/coach --skip=<task-id> | --resume=<task-id>", "Skip an unsuitable task or return a skipped task to today's queue.");
  row("/coach --pause-plan | --resume-plan", "Pause the current plan or resume it later without generating a new plan.");

  section("Session and settings");
  row("/retry | /undo [N]", "Retry your last input, or remove saved inputs and their associated cards.");
  row("/gemini | /qwen | /deepseek | /ollama", "Switch AI provider; /phi and /gemma select local model families.");
  row("/llm status | /theme", "Inspect your provider or choose terminal colors.");
  row('/help | /exit  (/q)', 'Show this guide or quit. Enter """ for multiline writing.');
  process.stdout.write("\n");
}
