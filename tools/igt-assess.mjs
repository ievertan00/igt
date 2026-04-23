import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import configLoader from "../lib/config-loader.mjs";
import { ui, paint, colors, wrapText } from "../lib/ui.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

// Load config via unified config loader
const config = configLoader.load();
const dbPath = config.DbPath || "igt_data.db";
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);

if (!fs.existsSync(resolvedDbPath)) {
  console.error("Error: Database file not found. Run IGT first to collect data.");
  process.exit(1);
}

const db = new Database(resolvedDbPath, { readonly: true });

// Get overall statistics
const stats = db.prepare(`
  SELECT 
    COUNT(DISTINCT i.id) as total_inputs,
    COUNT(DISTINCT d.id) as total_diagnoses,
    COUNT(DISTINCT d.error_type) as unique_errors,
    MIN(i.timestamp) as first_input,
    MAX(i.timestamp) as last_input
  FROM inputs i
  LEFT JOIN diagnoses d ON i.id = d.input_id
`).get();

if (stats.total_inputs === 0) {
  console.log("No data found. Run some grammar checks first!");
  db.close();
  process.exit(0);
}

// Get error rate trend (comparing first half vs second half of usage)
const errorRateTrend = db.prepare(`
  WITH halves AS (
    SELECT 
      id,
      NTILE(2) OVER (ORDER BY timestamp) as half
    FROM inputs
  )
  SELECT 
    h.half,
    COUNT(DISTINCT i.id) as inputs,
    COUNT(d.id) as diagnoses,
    CAST(COUNT(d.id) AS FLOAT) / COUNT(DISTINCT i.id) as error_rate
  FROM halves h
  JOIN inputs i ON h.id = i.id
  LEFT JOIN diagnoses d ON i.id = d.input_id
  GROUP BY h.half
`).all();

// Get severity distribution
const severityDist = db.prepare(`
  SELECT 
    severity,
    COUNT(*) as count,
    CAST(COUNT(*) AS FLOAT) / (SELECT COUNT(*) FROM diagnoses) * 100 as percentage
  FROM diagnoses
  GROUP BY severity
  ORDER BY 
    CASE severity 
      WHEN 'Major' THEN 1 
      WHEN 'Moderate' THEN 2 
      WHEN 'Minor' THEN 3 
      ELSE 4 
    END
`).all();

// Get top error types
const topErrors = db.prepare(`
  SELECT 
    error_type,
    COUNT(*) as count,
    severity
  FROM diagnoses
  GROUP BY error_type
  ORDER BY count DESC
  LIMIT 10
`).all();

// Get improvement indicators (errors that appeared early but not recently)
const improvedErrors = db.prepare(`
  WITH error_timeline AS (
    SELECT 
      d.error_type,
      MIN(i.timestamp) as first_seen,
      MAX(i.timestamp) as last_seen,
      COUNT(*) as total_count
    FROM diagnoses d
    JOIN inputs i ON d.input_id = i.id
    GROUP BY d.error_type
  )
  SELECT 
    error_type,
    total_count,
    first_seen,
    last_seen,
    JULIANDAY('now') - JULIANDAY(last_seen) as days_since_last
  FROM error_timeline
  WHERE days_since_last > 7
  ORDER BY total_count DESC
  LIMIT 5
`).all();

// Get persistent errors (high frequency, still appearing recently)
const persistentErrors = db.prepare(`
  WITH error_timeline AS (
    SELECT 
      d.error_type,
      COUNT(*) as total_count,
      MAX(i.timestamp) as last_seen
    FROM diagnoses d
    JOIN inputs i ON d.input_id = i.id
    GROUP BY d.error_type
  )
  SELECT 
    error_type,
    total_count,
    last_seen,
    JULIANDAY('now') - JULIANDAY(last_seen) as days_since_last
  FROM error_timeline
  WHERE days_since_last <= 7
  ORDER BY total_count DESC
  LIMIT 5
`).all();

db.close();

// Calculate estimated CEFR level (simplified heuristic)
function estimateCEFR(stats, severityDist, topErrors) {
  let score = 50; // Start at B1 (middle of CEFR scale)
  
  // Factor 1: Error rate (lower is better)
  const errorRate = stats.total_diagnoses / Math.max(stats.total_inputs, 1);
  if (errorRate < 0.3) score += 15;
  else if (errorRate < 0.5) score += 10;
  else if (errorRate < 0.7) score += 5;
  else if (errorRate > 1.5) score -= 10;
  
  // Factor 2: Severity distribution (fewer Major errors is better)
  const majorCount = severityDist.find(s => s.severity === 'Major')?.count || 0;
  const majorRatio = majorCount / Math.max(stats.total_diagnoses, 1);
  if (majorRatio < 0.1) score += 10;
  else if (majorRatio < 0.2) score += 5;
  else if (majorRatio > 0.5) score -= 10;
  
  // Factor 3: Vocabulary diversity (unique errors / total inputs)
  const errorDiversity = stats.unique_errors / Math.max(stats.total_inputs, 1);
  if (errorDiversity < 0.5) score += 5;
  
  // Factor 4: Usage volume (more practice = more reliable estimate)
  if (stats.total_inputs > 100) score += 5;
  else if (stats.total_inputs > 50) score += 3;
  else if (stats.total_inputs < 10) score -= 5;
  
  // Convert score to CEFR level
  if (score >= 80) return { level: "C2", description: "Mastery", details: "Near-native proficiency" };
  if (score >= 70) return { level: "C1", description: "Effective Operational Proficiency", details: "Advanced level, can handle complex texts" };
  if (score >= 60) return { level: "B2", description: "Vantage", details: "Upper-intermediate, can interact fluently" };
  if (score >= 45) return { level: "B1", description: "Threshold", details: "Intermediate, can handle most situations" };
  if (score >= 30) return { level: "A2", description: "Waystage", details: "Elementary, can communicate in simple tasks" };
  return { level: "A1", description: "Breakthrough", details: "Beginner, can use basic expressions" };
}

// Generate dimension scores
function getDimensionScores(stats, severityDist, topErrors) {
  const dimensions = {
    Grammar: 70,
    Vocabulary: 70,
    SentenceStructure: 70,
    Coherence: 70
  };
  
  // Adjust based on error types
  for (const err of topErrors) {
    const lowerType = err.error_type.toLowerCase();
    
    if (lowerType.includes("tense") || lowerType.includes("grammar") || lowerType.includes("agreement")) {
      dimensions.Grammar -= err.count * 2;
    }
    if (lowerType.includes("vocab") || lowerType.includes("word choice") || lowerType.includes("lexical")) {
      dimensions.Vocabulary -= err.count * 2;
    }
    if (lowerType.includes("sentence") || lowerType.includes("structure") || lowerType.includes("clause")) {
      dimensions.SentenceStructure -= err.count * 2;
    }
    if (lowerType.includes("coher") || lowerType.includes("flow") || lowerType.includes("style")) {
      dimensions.Coherence -= err.count * 2;
    }
  }
  
  // Normalize to 0-100
  for (const key of Object.keys(dimensions)) {
    dimensions[key] = Math.max(0, Math.min(100, dimensions[key]));
  }
  
  return dimensions;
}

const cefr = estimateCEFR(stats, severityDist, topErrors);
const dimensions = getDimensionScores(stats, severityDist, topErrors);

// Generate report
function generateReport() {
  const date = new Date().toISOString().split("T")[0];
  let md = `# English Proficiency Assessment\n\n`;
  md += `**Generated**: ${date}\n`;
  md += `**Data Period**: ${stats.first_input} to ${stats.last_input}\n\n`;
  md += `---\n\n`;
  
  // Overall assessment
  md += `## 🎯 Overall Assessment\n\n`;
  md += `### Estimated CEFR Level: **${cefr.level}** - ${cefr.description}\n\n`;
  md += `${cefr.details}\n\n`;
  
  // Dimension scores with visual bars
  md += `### Dimension Scores\n\n`;
  md += `\`\`\`\n`;
  for (const [dim, score] of Object.entries(dimensions)) {
    const barLength = Math.round(score / 5);
    const bar = "█".repeat(barLength / 2) + "░".repeat((100 - score) / 5 / 2);
    const label = dim.replace(/([A-Z])/g, ' $1').trim();
    md += `${label.padEnd(20)} |${bar}| ${score.toFixed(0)}%\n`;
  }
  md += `\`\`\`\n\n`;
  
  // Key statistics
  md += `## 📊 Key Statistics\n\n`;
  md += `- **Total Inputs**: ${stats.total_inputs}\n`;
  md += `- **Total Diagnoses**: ${stats.total_diagnoses}\n`;
  md += `- **Unique Error Types**: ${stats.unique_errors}\n`;
  md += `- **Error Rate**: ${(stats.total_diagnoses / Math.max(stats.total_inputs, 1)).toFixed(2)} per input\n\n`;
  
  // Severity distribution
  md += `## ⚖️ Severity Distribution\n\n`;
  md += `| Severity | Count | Percentage |\n`;
  md += `|----------|-------|------------|\n`;
  for (const s of severityDist) {
    md += `| ${s.severity || "Unspecified"} | ${s.count} | ${s.percentage?.toFixed(1) || 0}% |\n`;
  }
  md += `\n`;
  
  // Top error types
  md += `## 🔴 Top 10 Error Types\n\n`;
  md += `| Rank | Error Type | Count | Severity |\n`;
  md += `|------|-----------|-------|----------|\n`;
  for (let i = 0; i < topErrors.length; i++) {
    md += `| ${i + 1} | ${topErrors[i].error_type} | ${topErrors[i].count} | ${topErrors[i].severity || "-"} |\n`;
  }
  md += `\n`;
  
  // Improvements
  if (improvedErrors.length > 0) {
    md += `## ✅ Showing Improvement\n\n`;
    md += `These errors appeared frequently but haven't been seen recently:\n\n`;
    for (const err of improvedErrors) {
      md += `- **${err.error_type}** (${err.total_count} occurrences, last seen ${Math.floor(err.days_since_last)} days ago)\n`;
    }
    md += `\n`;
  }
  
  // Persistent errors
  if (persistentErrors.length > 0) {
    md += `## ⚠️ Persistent Errors\n\n`;
    md += `These errors are still appearing recently and need more practice:\n\n`;
    for (const err of persistentErrors) {
      md += `- **${err.error_type}** (${err.total_count} occurrences)\n`;
    }
    md += `\n`;
  }
  
  // Trend analysis
  if (errorRateTrend.length >= 2) {
    md += `## 📈 Progress Trend\n\n`;
    const firstHalf = errorRateTrend.find(h => h.half === 1);
    const secondHalf = errorRateTrend.find(h => h.half === 2);
    
    if (firstHalf && secondHalf) {
      const change = ((secondHalf.error_rate - firstHalf.error_rate) / firstHalf.error_rate * 100).toFixed(1);
      
      if (change < 0) {
        md += `✅ **Good progress!** Your error rate decreased by **${Math.abs(change)}%**.\n\n`;
      } else if (change > 0) {
        md += `⚠️ Your error rate increased by **${change}%**. Keep practicing!\n\n`;
      } else {
        md += `➡️ Your error rate remained stable.\n\n`;
      }
      
      md += `| Period | Inputs | Diagnoses | Error Rate |\n`;
      md += `|--------|--------|-----------|------------|\n`;
      md += `| First Half | ${firstHalf.inputs} | ${firstHalf.diagnoses} | ${(firstHalf.error_rate * 100).toFixed(1)}% |\n`;
      md += `| Second Half | ${secondHalf.inputs} | ${secondHalf.diagnoses} | ${(secondHalf.error_rate * 100).toFixed(1)}% |\n`;
      md += `\n`;
    }
  }
  
  // Recommendations
  md += `## 💡 Recommendations\n\n`;
  
  if (stats.total_inputs < 20) {
    md += `- 📝 **More data needed**: Run at least 20 grammar checks for a more accurate assessment.\n`;
  }
  
  if (dimensions.Grammar < 50) {
    md += `- 📖 **Focus on Grammar**: Review basic grammar rules, especially verb tenses and agreement.\n`;
  }
  
  if (dimensions.Vocabulary < 50) {
    md += `- 📚 **Expand Vocabulary**: Read more and note down useful expressions.\n`;
  }
  
  if (persistentErrors.length > 3) {
    md += `- 🎯 **Target Persistent Errors**: Use \`handbook\` command in IGT to review your error patterns.\n`;
  }

  md += `- 📊 **Generate Handbook**: Run \`node igt-handbook.mjs\` for a detailed error analysis.\n`;
  md += `- 🎯 **Practice Mode**: Run \`node igt-practice.mjs\` for targeted exercises.\n`;
  
  md += `\n---\n\n`;
  md += `*Generated by IGT (Interactive Grammar Tool) - Proficiency Assessment Module*\n`;
  
  return md;
}

const report = generateReport();

// Save to file
const dateStr = new Date().toISOString().split("T")[0];
const defaultOutputPath = path.join(projectRoot, `docs`, `assessment_${dateStr}.md`);

// Use ReportPath from config if available
let outputPath;
if (config.ReportPath) {
  const reportDir = path.isAbsolute(config.ReportPath) ? config.ReportPath : path.join(projectRoot, config.ReportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  outputPath = path.join(reportDir, `assessment_${dateStr}.md`);
} else {
  outputPath = defaultOutputPath;
  // Ensure docs directory exists
  const docsDir = path.join(projectRoot, `docs`);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
}

fs.writeFileSync(outputPath, report, "utf8");

ui.header("Proficiency Assessment", `Analyzed ${stats.total_inputs} inputs`);

const summaryContent = [
  `${paint(colors.gray, "Estimated Level ")}${paint(colors.bold + colors.cyan, cefr.level)} - ${paint(colors.white, cefr.description)}`,
  `${paint(colors.gray, "Diagnoses       ")}${paint(colors.yellow, stats.total_diagnoses.toString())}`,
  `${paint(colors.gray, "Unique Errors   ")}${paint(colors.brightRed, stats.unique_errors.toString())}`,
  "",
  paint(colors.gray, "Dimension Scores:"),
  ...Object.entries(dimensions).map(([dim, score]) => {
    const barLength = Math.round(score / 10);
    const bar = paint(colors.green, "█".repeat(barLength)) + paint(colors.gray, "░".repeat(10 - barLength));
    return `  ${paint(colors.white, dim.padEnd(18))} ${bar} ${score.toFixed(0)}%`;
  }),
  "",
  `${paint(colors.green, "✅ Report saved to:")}`,
  `  ${paint(colors.gray, wrapText(outputPath, 62, 2))}`
].join("\n");

console.log(ui.box("ASSESSMENT SUMMARY", summaryContent, { width: 70 }));
console.log("");
