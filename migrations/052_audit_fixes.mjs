// Migration 052: Audit fixes — hints, difficulty, schema fields, and data cleanup
//
// Applies fixes from the 2026-10-05 practice question bank audit:
// P1-1: Rewrite progressive hints for 100 unknown questions
// P1-2: Recalibrate difficulty for 200 questions (100 unknown + 100 Space Bunny)
// P1-3: Fix native-027-indirect-question-10 (who = subject, no observable word order choice)
// P2-4: Fill schema fields (sentence_structure/clause_type/etc.) for 740 questions
// P3-8: Tone down pilot complete hints
// P3-9: Fix native-027-not-until-02 hint (don't force inversion as only answer)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const artifactsDir = path.resolve(__dirname, "..", "artifacts");

const AUDIT_HINTS = JSON.parse(fs.readFileSync(path.resolve(artifactsDir, "audit-hints.json"), "utf-8"));
const AUDIT_DIFFICULTY = JSON.parse(fs.readFileSync(path.resolve(artifactsDir, "audit-difficulty.json"), "utf-8"));
const SCHEMA_FIELDS = JSON.parse(fs.readFileSync(path.resolve(artifactsDir, "schema_fields_analysis.json"), "utf-8"));

const hashInput = (row) => `${row.id}|${row.prompt_zh}|${row.reference_answer}`;

export function up(db) {
  return db.transaction(() => {
    const select = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const updateDifficulty = db.prepare("UPDATE practice_questions SET difficulty = ? WHERE id = ? AND difficulty = ?");
    const updateHint = db.prepare("UPDATE practice_questions SET hint_json = ? WHERE id = ?");
    const updateFields = db.prepare(
      "UPDATE practice_questions SET practice_fields_json = json_patch(practice_fields_json, ?) WHERE id = ?"
    );
    const updatePrompt = db.prepare(
      "UPDATE practice_questions SET prompt_zh = ?, reference_answer = ?, practice_fields_json = json_patch(practice_fields_json, ?) WHERE id = ? AND prompt_zh = ?"
    );

    let changes = { difficulty: 0, hints: 0, schema: 0, prompts: 0, pilotHints: 0 };

    // ---- P1-2: Difficulty recalibration ----
    for (const [id, newDifficulty] of Object.entries(AUDIT_DIFFICULTY)) {
      const row = select.get(id);
      if (!row) throw new Error(`Difficulty target missing: ${id}`);
      if (row.difficulty === newDifficulty) continue;
      const result = updateDifficulty.run(newDifficulty, id, row.difficulty);
      if (result.changes !== 1) throw new Error(`Difficulty update failed for ${id}`);
      changes.difficulty++;
    }

    // ---- P1-1: Hint rewrite for unknown questions ----
    for (const [id, newHints] of Object.entries(AUDIT_HINTS)) {
      const row = select.get(id);
      if (!row) throw new Error(`Hint target missing: ${id}`);
      const hintStr = JSON.stringify(newHints);
      if (row.hint_json === hintStr) continue;
      updateHint.run(hintStr, id);
      changes.hints++;
    }

    // ---- P2-4: Schema fields for all missing questions ----
    for (const [id, fields] of Object.entries(SCHEMA_FIELDS)) {
      const row = select.get(id);
      if (!row) throw new Error(`Schema target missing: ${id}`);
      
      // Build patch: only include non-null fields, wrap arrays
      const patch = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== null && value !== undefined) {
          patch[key] = Array.isArray(value) ? value : [value];
        }
      }
      if (Object.keys(patch).length === 0) continue;
      
      updateFields.run(JSON.stringify(patch), id);
      changes.schema++;
    }

    // ---- P1-3: Fix native-027-indirect-question-10 ----
    // Change prompt so the embedded WH-word is the OBJECT, creating observable word order choice
    {
      const row = select.get("native-027-indirect-question-10");
      if (!row) throw new Error("native-027-indirect-question-10 missing");
      if (row.prompt_zh === "委员会尚未决定由谁主持下一轮讨论。") {
        const newPrompt = "委员会尚未决定将下一轮讨论委托给谁。";
        const newRef = "The committee has not yet decided who they will delegate the next round of discussions to.";
        const patch = {
          grammar_point: ["Statement word order in indirect questions (object)"],
          primary_target: ["indirect-question-object-word-order"],
          learning_goal: ["Use statement word order when the embedded WH-word is the object of an indirect question."],
          learning_rationale: ["The WH-word 'who' is now the object of 'delegate to', creating an observable word order contrast between direct ('Who will they delegate...?') and indirect ('...who they will delegate...')."],
        };
        updatePrompt.run(newPrompt, newRef, JSON.stringify(patch), "native-027-indirect-question-10", row.prompt_zh);
        // Also update hints
        updateHint.run(JSON.stringify({
          simple: "间接问句中，不再直接用问句语序——疑问词后接陈述句语序。",
          intermediate: "delegate...to 后接谁作为宾语；间接问句中 who 后接主语再加谓语，不要倒装。",
          complete: "...who they will delegate...（疑问词 who 后接陈述语序）",
        }), "native-027-indirect-question-10");
        changes.prompts++;
      }
    }

    // ---- P3-9: Fix native-027-not-until-02 hint ----
    {
      const row = select.get("native-027-not-until-02");
      if (!row) throw new Error("native-027-not-until-02 missing");
      const currentHint = JSON.parse(row.hint_json);
      if (currentHint.complete && currentHint.complete.includes("Not until [主语]")) {
        updateHint.run(JSON.stringify({
          simple: "恢复发生在双方签字之后——\"直到……才……\"。",
          intermediate: "可以用 Not until 开头强调时间点，注意主句需要倒装（助动词提前）。也可以说 The project resumed only after...。",
          complete: "Not until [从句, 陈述语序] did [主语] + [动词原形] + [其他]。也可以：...[主语] + [谓语] + only after...（不倒装）。",
        }), "native-027-not-until-02");
        changes.pilotHints++;
      }
    }

    // ---- P3-8: Tone down pilot complete hints ----
    // Pilot questions with overly complete hints: replace with less revealing frames
    const pilotHintFixes = {
      "pilot-041-health-001": {
        simple: "一个不适已经持续两天，另一个今天早上才开始。两件事的时态不同。",
        intermediate: "持续至今的状态用现在完成时；有明确开始时间的新症状用过去时。",
        complete: "My throat has been _____ for the past two days, and I started _____ this morning.",
      },
      "pilot-041-health-003": {
        simple: "说明过敏情况，并交代预约时已告知诊所。",
        intermediate: "用 be allergic to 表达对……过敏；已完成的告知用过去时。",
        complete: "I'm allergic to _____, and I told _____ when I _____.",
      },
      "pilot-041-health-008": {
        simple: "护士对说话者提出两个先后动作——注意指令的转述方式。",
        intermediate: "ask 后接人再接 to + 动词；用 then 标出顺序。",
        complete: "The nurse asked me to _____ and then _____.",
      },
      "pilot-041-services-001": {
        simple: "漏水昨晚开始；现在柜子里有积水——前因后果。",
        intermediate: "明确开始时间用过去时(started + V-ing)；描述眼前存在物可用 there is。",
        complete: "The pipe started _____ last night, and there's _____ in the cupboard.",
      },
      "pilot-041-services-003": {
        simple: "视频已经发出；客服承诺转交维修部门。",
        intermediate: "最近完成且与现在有关的动作用现在完成时；转述承诺用 said they'd。",
        complete: "I've sent _____, and customer service said they'd pass it on to _____.",
      },
    };

    for (const [id, newHints] of Object.entries(pilotHintFixes)) {
      const row = select.get(id);
      if (!row) throw new Error(`Pilot hint target missing: ${id}`);
      updateHint.run(JSON.stringify(newHints), id);
      changes.pilotHints++;
    }

    return changes;
  })();
}

export function down(_db) {
  throw new Error("Migration 052 is not reversible. Restore from backup if needed.");
}

export default { up, down };