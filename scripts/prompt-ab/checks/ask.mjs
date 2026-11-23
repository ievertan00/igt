// Deterministic contract checks for Ask output, mirroring the production
// metadata rules (Chinese filename-safe title, bounded tags/category, no tables).
import { ASK_CATEGORIES, ASK_TOPICS } from "../../../lib/features/ask/metadata.mjs";

const hanCount = text => (String(text).match(/\p{Script=Han}/gu) || []).length;
const stripCode = text => String(text).replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");

export function checkAsk({ language, output, expectations = {} }) {
  const checks = [];
  const add = (id, level, pass, detail = "") => checks.push({ id, level, pass, detail });

  const answer = typeof output.answer === "string" ? output.answer : "";
  add("answer_nonempty", "hard", answer.trim().length > 0, "");
  add("schema_fields", "hard",
    typeof output.title === "string" && Array.isArray(output.related) && Array.isArray(output.tags) && typeof output.category === "string",
    "missing title/related/tags/category");

  const title = String(output.title || "");
  add("title_chinese", "hard", hanCount(title) > 0, `title: ${title.slice(0, 60)}`);
  add("title_length", "hard", [...title].length <= 50, `${[...title].length} chars`);
  add("title_filename_safe", "hard", !/[\\/:*?"<>|#\[\]^]/.test(title), "");

  const tags = Array.isArray(output.tags) ? output.tags : [];
  const allowed = new Set(ASK_TOPICS.map(topic => topic.toLowerCase()));
  const badTags = tags.filter(tag => !allowed.has(String(tag).toLowerCase()));
  add("tags_allowed", "hard", tags.length >= 1 && tags.length <= 2 && badTags.length === 0,
    badTags.length ? `off-list tags: ${badTags.join("; ")}` : `${tags.length} tags`);

  add("category_valid", "hard", ASK_CATEGORIES.includes(output.category), `category: ${output.category}`);

  add("no_markdown_tables", "hard", !/^\s*\|.*\|\s*$/m.test(answer), "answer contains a markdown table");

  const prose = stripCode(answer);
  if (language === "zh-CN") {
    add("language_zh", "hard", hanCount(prose) >= 20, `only ${hanCount(prose)} Han characters in prose`);
  } else if (language === "en") {
    add("language_en", "soft", hanCount(prose) <= 5, `${hanCount(prose)} Han characters in English-mode prose`);
  }

  add("related_present", "soft", Array.isArray(output.related) && output.related.length > 0, "");

  if (expectations.mustMention && expectations.mustMention.length) {
    const lower = answer.toLowerCase();
    const missing = expectations.mustMention.filter(fragment => !lower.includes(String(fragment).toLowerCase()));
    add("expected_content", "soft", missing.length === 0, missing.length ? `not mentioned: ${missing.join("; ")}` : "");
  }

  return checks;
}