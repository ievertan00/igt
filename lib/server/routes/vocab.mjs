import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { insertVocabCard, vocabCardExistsForWord } from "../../db/srs-cards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..", "..");

function parseVocabFile(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  const entries = [];
  let li = 0;
  while (li < lines.length) {
    const hm = lines[li].match(/^###?\s+(.+)/);
    if (hm) {
      const block = [lines[li++]];
      while (li < lines.length && !/^###?\s+/.test(lines[li])) block.push(lines[li++]);
      const raw = block.join("\n");
      const get = (k) => { const m = raw.match(new RegExp(`\\*\\*${k}:\\*\\*\\s*(.+)`)); return m ? m[1].trim() : ""; };
      const wm = raw.match(/^###?\s*(.+)/m);
      if (wm) entries.push({
        word: wm[1].trim(), pos: get("PoS"), zh: get("中文"),
        meaning: get("Meaning"), note: get("Note"),
        example: get("Example 1") || get("Example"),
      });
    } else {
      li++;
    }
  }
  return entries;
}

export function registerVocabRoutes() {
  register("POST", "/vocab/seed", async (req, res) => {
    const config = configLoader.load();
    const vocabFile = config.VocabFile || "IGT Vocabulary.md";
    const baseDir = config.VaultDir
      ? (path.isAbsolute(config.VaultDir) ? config.VaultDir : path.join(projectRoot, config.VaultDir))
      : path.join(projectRoot, "docs");
    const noteFile = path.isAbsolute(vocabFile) ? vocabFile : path.join(baseDir, vocabFile);
    if (!fs.existsSync(noteFile)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ seeded: 0 }));
      return;
    }
    const entries = parseVocabFile(noteFile);
    let seeded = 0;
    for (const e of entries) {
      if (!e.word || !e.zh) continue;
      if (!(await vocabCardExistsForWord(e.word))) {
        await insertVocabCard(e);
        seeded++;
      }
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ seeded }));
  });
}
