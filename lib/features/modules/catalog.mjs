export const MODULES = {
  word: {
    label: "Word",
    description: "Build and recall vocabulary.",
    commands: [
      ["/word lookup <word or phrase>", "Look up vocabulary."],
      ["/word add <word,...>", "Look up and save vocabulary."],
      ["/word review [count]", "Review saved vocabulary with spaced repetition."],
      ["/word list", "Browse saved vocabulary."],
      ["/vocab-test [count]", "Complete vocabulary test with realistic scenario production."],
      ["/word --list", "Browse saved vocabulary."],
      ["/listen <English text>", "Listen and repeat a word or expression."],
    ],
  },
  sentence: {
    label: "Sentence",
    description: "Improve individual sentences and understand corrections.",
    commands: [
      ["/sentence check <text>", "Check grammar and receive a diagnosis."],
      ["/sentence translate <text>", "Translate a sentence."],
      ["/explain [question]", "Understand the latest correction."],
      ["/review [count]", "Review grammar mistakes with spaced repetition."],
      ["/practice [mode] [3-12]", "Produce sentences and expressions in varied real-life scenarios."],
      ["/drill [count]", "Multiple-choice grammar drills by level or error type."],
    ],
  },
  text: {
    label: "Text",
    description: "Work with paragraphs and longer writing.",
    commands: [
      ["/text check", "Submit a multi-line passage for grammar feedback."],
      ["/text translate", "Translate a multi-line passage."],
      ["/text", "Show the text workflow."],
    ],
  },
};

export function renderModuleGuide(name) {
  const module = MODULES[name];
  if (!module) return `Unknown module: ${name}`;
  const lines = [`${module.label}: ${module.description}`, ""];
  for (const [command, description] of module.commands) {
    lines.push(`  ${command}`);
    lines.push(`    ${description}`);
  }
  return lines.join("\n");
}

export function renderModuleIndex() {
  return Object.entries(MODULES)
    .map(([name, module]) => `  /${name.padEnd(8)} ${module.description}`)
    .join("\n");
}
