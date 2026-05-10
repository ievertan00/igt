import { hasExamplesChanged, hashExamples, loadCachedRule, saveCachedRule } from "./cache.mjs";
import { getStaticGrammarRule } from "./static-rules.mjs";

export function extractMarkdownContent(raw) {
  if (!raw) return raw;
  raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenceMatch = raw.match(/^```(?:\w*)\s*\n([\s\S]*?)\n```\s*$/);
  if (fenceMatch) raw = fenceMatch[1].trim();
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      const content = parsed.content || parsed.markdown || parsed.text || parsed.output;
      if (typeof content === "string") return content.trim();
    } catch {}
  }
  return raw;
}

function buildExamplesText(examples) {
  return examples.map((ex, i) => {
    let text = `Example ${i + 1}:\n`;
    text += `Original: "${ex.original_text}"\n`;
    if (ex.correction) text += `Corrected: "${ex.correction}"\n`;
    if (ex.refine) text += `Natural: "${ex.refine}"\n`;
    if (ex.explanation) text += `Explanation: "${ex.explanation}"\n`;
    if (ex.rule) text += `Rule: "${ex.rule}"\n`;
    if (ex.tip) text += `Tip: "${ex.tip}"\n`;
    return text;
  }).join("\n");
}

const FALLBACK_RULE_PROMPT = `You are an expert English grammar tutor. Based on the user's error patterns and examples, create a detailed, personalized grammar rule explanation.

**Error Type**: {{errorType}}

**User's Examples**:
{{examplesText}}

**Instructions**:
1. Explain the grammar rule clearly and concisely
2. Reference the user's specific errors and show what they did wrong
3. Provide the correct patterns with examples from the user's data
4. Give 2-3 additional common examples that the user might encounter
5. Include a "Key Takeaway" section with a memorable rule or tip
6. All explanations MUST be in English ONLY. Do NOT use Chinese.

**Format** (use markdown):
- Start with a brief overview of the rule
- List specific patterns with ✅/❌ examples
- Explain why the user made these errors
- Provide clear rules to avoid these mistakes
- End with a concise "Key Takeaway" box

Keep the tone encouraging and educational. Focus on the patterns the user actually struggles with.`;

export async function generateTailoredRule({ llm, config, errorType, examples, incremental, log }) {
  if (examples.length === 0) return null;
  if (incremental && !hasExamplesChanged(errorType, examples)) {
    const cached = loadCachedRule(errorType);
    if (cached) {
      log(`⏭️  Skipping ${errorType} (cached, no changes)`);
      return cached.rule;
    }
  }
  const examplesText = buildExamplesText(examples);
  const tmpl = (config.Prompts && config.Prompts.HandbookGrammarRulePrompt) || FALLBACK_RULE_PROMPT;
  const prompt = tmpl.replace("{{errorType}}", errorType).replace("{{examplesText}}", examplesText);

  const maxRetries = 3;
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const raw = await llm.generate(prompt, "", { taskType: "handbook", systemPrompt: "" });
      const rule = { title: `${errorType} (Personalized)`, content: extractMarkdownContent(raw) };
      if (incremental) {
        saveCachedRule(errorType, hashExamples(examples), rule);
        log(`✅ Generated and cached ${errorType}`);
      } else {
        log(`✅ Generated ${errorType}`);
      }
      return rule;
    } catch (error) {
      const isRate = error.message && (error.message.includes("429") || /rate/i.test(error.message));
      if (isRate && attempt < maxRetries) {
        let delay = 5;
        const m = error.message.match(/retry in ([\d.]+)s/i);
        if (m) delay = parseFloat(m[1]) + 1;
        else if (attempt > 0) delay = Math.pow(2, attempt) * 5;
        attempt++;
        log(`⏳ Rate limit. Waiting ${delay.toFixed(1)}s, retry ${attempt}/${maxRetries}…`);
        await new Promise((r) => setTimeout(r, delay * 1000));
      } else {
        log(`⚠️  LLM generation failed for ${errorType}: ${error.message}`);
        break;
      }
    }
  }
  log(`Falling back to static rule for ${errorType}`);
  return getStaticGrammarRule(errorType);
}

const FALLBACK_SUMMARY_PROMPT = `Provide a linguistic summary for:
- Period: {{days}} days
- Inputs: {{totalInputs}}
- Errors: {{totalErrors}}
- Top Error: {{topError}}

Ranking:
{{frequencyText}}

Give 2-3 paragraphs of analysis and 3 goals. English only.`;

export async function generateOverallSummary({ llm, config, stats, errorFrequency, days }) {
  const frequencyText = errorFrequency.slice(0, 10).map((err) =>
    `- ${err.error_type}: ${err.count} occurrences (${err.major_count} Major, ${err.moderate_count} Moderate)`
  ).join("\n");
  const topError = errorFrequency.length > 0 ? errorFrequency[0].error_type : "N/A";
  const tmpl = (config.Prompts && config.Prompts.HandbookSummaryPrompt) || FALLBACK_SUMMARY_PROMPT;
  const prompt = tmpl
    .replace("{{days}}", days)
    .replace("{{totalInputs}}", stats.total_inputs)
    .replace("{{totalErrors}}", stats.total_diagnoses)
    .replace("{{uniqueErrors}}", errorFrequency.length)
    .replace("{{topError}}", topError)
    .replace("{{frequencyText}}", frequencyText);
  try {
    const result = await llm.generate(prompt, "", { taskType: "handbook", systemPrompt: "" });
    return extractMarkdownContent(result);
  } catch (e) {
    console.error(`❌ Failed to generate overall summary: ${e.message}`);
    return null;
  }
}
