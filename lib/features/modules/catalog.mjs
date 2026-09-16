export const MODULES = {
  word: {
    label: "Word",
    description: "Build and recall vocabulary.",
    commands: [
      ["/add <word or phrase>", "Look up and optionally save vocabulary."],
      ["/word [count]", "Review saved vocabulary with spaced repetition."],
      ["/word quiz [count]", "Use saved words in realistic scenarios like a native speaker."],
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
      ["/practice", "Practise a recurring grammar weakness."],
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
