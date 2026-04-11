import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

// Parse command line arguments
const args = process.argv.slice(2);
const daysArg = args.find(a => a.startsWith("--days="));
const days = daysArg ? parseInt(daysArg.split("=")[1]) : 30; // Default: last 30 days

// Load config
const configPath = path.join(projectRoot, "igt_config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const dbPath = config.DbPath || "igt_data.db";
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);

if (!fs.existsSync(resolvedDbPath)) {
  console.error("Error: Database file not found. Run IGT first to collect data.");
  process.exit(1);
}

const db = new Database(resolvedDbPath, { readonly: true });

// Get date filter
const dateFilter = days > 0 ? `AND i.timestamp >= datetime('now', '-${days} days')` : "";

// 1. Get error type frequency
const errorFrequency = db.prepare(`
  SELECT
    d.error_type,
    COUNT(*) as count,
    d.severity,
    COUNT(CASE WHEN d.severity = 'Major' THEN 1 END) as major_count,
    COUNT(CASE WHEN d.severity = 'Moderate' THEN 1 END) as moderate_count,
    COUNT(CASE WHEN d.severity = 'Minor' THEN 1 END) as minor_count
  FROM diagnoses d
  JOIN inputs i ON d.input_id = i.id
  WHERE 1=1 ${dateFilter}
  GROUP BY d.error_type
  ORDER BY count DESC
`).all();

// 2. Get trend data (errors per week)
const trendData = db.prepare(`
  SELECT 
    strftime('%Y-%W', i.timestamp) as week,
    COUNT(*) as error_count
  FROM diagnoses d
  JOIN inputs i ON d.input_id = i.id
  WHERE 1=1 ${dateFilter}
  GROUP BY week
  ORDER BY week
`).all();

// 3. Get example sentences for each error type
function getExamples(errorType, limit = 3) {
  return db.prepare(`
    SELECT
      i.original_text,
      i.correction,
      i.refine,
      d.explanation,
      a.rule,
      a.tip
    FROM inputs i
    JOIN diagnoses d ON i.id = d.input_id
    LEFT JOIN advice a ON i.id = a.input_id
    WHERE d.error_type = ?
    ORDER BY i.timestamp DESC
    LIMIT ?
  `).all(errorType, limit);
}

// 4. Get total statistics
const stats = db.prepare(`
  SELECT 
    COUNT(DISTINCT i.id) as total_inputs,
    COUNT(d.id) as total_diagnoses
  FROM inputs i
  LEFT JOIN diagnoses d ON i.id = d.input_id
  WHERE 1=1 ${dateFilter}
`).get();

// Generate Obsidian Dashboard report
function generateReport() {
  const date = new Date().toISOString().split("T")[0];
  let md = `# 📘 Personal English Error Handbook\n\n`;

  // 1. Overview Section (Abstract Callout)
  const topError = errorFrequency.length > 0 ? errorFrequency[0].error_type : "N/A";
  md += `> [!ABSTRACT] 📊 Performance Summary (Date: ${date})\n`;
  md += `> - **Period**: Last ${days} days\n`;
  md += `> - **Inputs Analyzed**: ${stats.total_inputs}\n`;
  md += `> - **Total Diagnoses**: ${stats.total_diagnoses}\n`;
  md += `> - **Unique Errors**: ${errorFrequency.length}\n`;
  md += `> - **Critical Priority**: ${topError}\n\n`;

  // 2. Frequency Ranking (Markdown Table)
  if (errorFrequency.length > 0) {
    md += `## 🎯 Error Frequency Ranking\n\n`;
    md += `| Error Type | Freq | Severity |\n`;
    md += `| :--- | :--- | :--- |\n`;

    for (const err of errorFrequency) {
      const severity = err.major_count > 0 ? "🔴 Major" : err.moderate_count > 0 ? "🟡 Moderate" : "🟢 Minor";
      md += `| ${err.error_type} | ${err.count} | ${severity} |\n`;
    }
    md += `\n`;
  }

  // 3. Trend Analysis (Table)
  if (trendData.length >= 2) {
    md += `## 📈 Weekly Trend\n\n`;
    md += `| Week | Errors |\n`;
    md += `| :--- | :--- |\n`;

    for (const week of trendData.slice(-8)) {
      const bar = "▓".repeat(Math.min(week.error_count, 20));
      md += `| ${week.week} | ${bar} ${week.error_count} |\n`;
    }
    md += `\n`;

    // Trend direction
    if (trendData.length >= 4) {
      const recent = trendData.slice(-2).reduce((sum, t) => sum + t.error_count, 0);
      const older = trendData.slice(-4, -2).reduce((sum, t) => sum + t.error_count, 0);
      const change = ((recent - older) / Math.max(older, 1) * 100).toFixed(1);

      if (change < 0) {
        md += `> [!SUCCESS] ✅ Good news! Your errors decreased by **${Math.abs(change)}%** in recent weeks.\n\n`;
      } else if (change > 0) {
        md += `> [!CAUTION] ⚠️ Errors increased by **${change}%** in recent weeks. Keep practicing!\n\n`;
      } else {
        md += `> [!NOTE] ➡️ Your error rate remained stable in recent weeks.\n\n`;
      }
    }
  }

  // 4. Detailed Error Analysis (Collapsible Callouts)
  if (errorFrequency.length > 0) {
    md += `## 🔍 Detailed Error Analysis\n\n`;

    for (const err of errorFrequency) {
      const severityIcon = err.major_count > 0 ? "🔴" : err.moderate_count > 0 ? "🟡" : "🟢";
      md += `> [!CAUTION]- ${severityIcon} ${err.error_type} (${err.count} Occurrences)\n`;
      md += `>\n`;

      const examples = getExamples(err.error_type);
      if (examples.length > 0) {
        for (let i = 0; i < examples.length; i++) {
          const ex = examples[i];

          // Original (Failure)
          md += `> ### 📝 Example ${i + 1}\n`;
          md += `> > [!FAILURE] Original (❌)\n`;
          md += `> > \`${escapeCallout(ex.original_text)}\`\n`;
          md += `>\n`;

          // Corrected (Success)
          if (ex.correction) {
            md += `> > [!SUCCESS] Corrected (✅)\n`;
            md += `> > \`${escapeCallout(ex.correction)}\`\n`;
            md += `>\n`;
          }

          // Natural Phrasing (Tip)
          if (ex.refine) {
            md += `> > [!TIP] Natural Phrasing (✨)\n`;
            md += `> > \`${escapeCallout(ex.refine)}\`\n`;
            md += `>\n`;
          }

          // Logic & Rules (Info)
          md += `> > [!INFO] Logic & Rules\n`;
          if (ex.explanation) {
            md += `> > **Why**: ${escapeCallout(ex.explanation)}\n`;
          }
          if (ex.rule) {
            md += `> > **Rule**: ${escapeCallout(ex.rule).replace(/\n/g, "<br>")}\n`;
          }
          if (ex.tip) {
            md += `> > **Pro Tip**: ${escapeCallout(ex.tip).replace(/\n/g, "<br>")}\n`;
          }
          md += `>\n`;

          // Separator between examples
          if (i < examples.length - 1) {
            md += `> ---\n>\n`;
          }
        }
      }

      md += `> ---\n\n`;
    }
  }

  // 5. Top 3 Priorities
  if (errorFrequency.length > 0) {
    md += `## 🎯 Top 3 Priorities\n\n`;
    md += `> [!EXAMPLE] 💡 Focus on these to see the biggest improvement\n`;
    md += `> \n`;

    const top3 = errorFrequency.slice(0, 3);
    for (let i = 0; i < top3.length; i++) {
      md += `> ${i + 1}. **${top3[i].error_type}** - ${top3[i].count} occurrences\n`;
    }
    md += `\n`;
  }

  md += `---\n\n`;
  md += `*Generated by IGT (Interactive Grammar Tool)*\n`;
  md += `Run \`node igt-cards.mjs --export\` to create Anki flashcards from your errors.\n`;

  return md;
}

// Escape special characters that could break callout syntax
function escapeCallout(str) {
  if (!str) return "";
  // Escape characters that could interfere with callout parsing
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const report = generateReport();

// Save to file
const dateStr = new Date().toISOString().split("T")[0];
const defaultOutputPath = path.join(projectRoot, `docs`, `handbook_${dateStr}.md`);

// Use ReportPath from config if available
let outputPath;
if (config.ReportPath) {
  const reportDir = path.isAbsolute(config.ReportPath) ? config.ReportPath : path.join(projectRoot, config.ReportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  outputPath = path.join(reportDir, `handbook_${dateStr}.md`);
} else {
  outputPath = defaultOutputPath;
  // Ensure docs directory exists
  const docsDir = path.join(projectRoot, `docs`);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
}

fs.writeFileSync(outputPath, report, "utf8");

console.log(`✅ Personal Error Handbook generated: ${outputPath}`);
console.log(`📊 Analyzed ${stats.total_inputs} inputs with ${stats.total_diagnoses} diagnoses`);
console.log(`🎯 Found ${errorFrequency.length} unique error types`);

db.close();
