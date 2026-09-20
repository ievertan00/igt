function stripTrailingCodeBlock(value) {
  if (!value) return value;
  return value.replace(/\s*```[\w]*\s[\s\S]*?`{3,}\s*$/g, "").trim();
}

function escapeCallout(str) {
  if (!str) return "";
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getCategoryIcon(category) {
  const icons = { Grammar: "🔧", Vocabulary: "📝", Mechanics: "⚙️", Style: "🎨", Clarity: "💡" };
  return icons[category] || "📌";
}

export function buildReport({ provider, handbookModel, date, days, stats, errorFrequency, trendData, examplesByType, rules, overallSummary, learningProfile }) {
  let md = `# 📘 Personal English Error Handbook\n\n`;
  md += `> [!INFO] Generated with: **${provider.toUpperCase()}** (${handbookModel}) on ${date}\n\n`;

  const topError = errorFrequency.length > 0 ? errorFrequency[0].error_type : "N/A";
  md += `> [!ABSTRACT] 📊 Performance Summary (Date: ${date})\n`;
  md += `> - **Period**: Last ${days} days\n`;
  md += `> - **Inputs Analyzed**: ${stats.total_inputs}\n`;
  md += `> - **Total Diagnoses**: ${stats.total_diagnoses}\n`;
  md += `> - **Unique Errors**: ${errorFrequency.length}\n`;
  md += `> - **Critical Priority**: ${topError}\n\n`;

  if (overallSummary) {
    md += `## 📝 Executive Linguistic Summary\n\n${overallSummary}\n\n`;
  }

  if (learningProfile?.priorities?.length) {
    md += `## 🧭 Learning Profile & Next Actions\n\n`;
    md += `This section uses repeated history, spread across days, recency, severity, and practice results. A low-confidence item is not treated as a stable weakness. Overall error rate: **${learningProfile.sample?.errorRate ?? learningProfile.errorRate ?? "N/A"}** diagnoses per input.\n\n`;
    md += `| Priority | Evidence | Trend | Practice recurrence | Confidence |\n| :--- | :--- | :--- | :--- | :--- |\n`;
    for (const item of learningProfile.priorities) {
      const practice = item.practiceAttempts > 0
        ? `${item.practiceAttempts} attempts; ${item.practiceRecurrenceRate ?? 0} recurrence`
        : "not tested yet";
      md += `| **${item.errorType}** | ${item.count} records on ${item.days} days / ${item.sessions || "?"} sessions | ${item.trend} (${item.recent} recent) | ${practice} | ${item.confidence} |\n`;
    }
    md += `\n`;
    for (const item of learningProfile.priorities) {
      md += `### ${item.errorType}\n\n`;
      md += `- **建议练习**：${item.practice}\n`;
      md += `- **外部资源**：[${item.resource.title}](${item.resource.url}) — ${item.resource.why}\n`;
      if (item.trend === "improving") md += `- **判断**：近期记录少于前半段，先保持低频复习，不要扩大训练范围。\n`;
      else if (item.reviewed === 0) md += `- **判断**：尚无复习反馈，先完成 3 次主动回忆，再重新生成手册。\n`;
      else md += `- **判断**：仍有近期重复记录，优先做新语境迁移，而不是继续阅读规则。\n`;
      md += `\n`;
    }
  }

  if (errorFrequency.length > 0) {
    md += `\n## 🎯 Error Frequency Ranking\n\n| Error Type | Freq | Severity |\n| :--- | :--- | :--- |\n`;
    for (const err of errorFrequency) {
      const sev = err.major_count > 0 ? "🔴 Major" : err.moderate_count > 0 ? "🟡 Moderate" : "🟢 Minor";
      md += `| ${err.error_type} | ${err.count} | ${sev} |\n`;
    }
    md += `\n`;
  }

  if (trendData.length >= 2) {
    md += `\n## 📈 Weekly Trend\n\n| Week | Errors |\n| :--- | :--- |\n`;
    for (const week of trendData.slice(-8)) {
      const bar = "▓".repeat(Math.min(week.error_count, 20));
      md += `| ${week.week} | ${bar} ${week.error_count} |\n`;
    }
    md += `\n`;
    if (trendData.length >= 4) {
      const recent = trendData.slice(-2).reduce((s, t) => s + t.error_count, 0);
      const older = trendData.slice(-4, -2).reduce((s, t) => s + t.error_count, 0);
      const change = (((recent - older) / Math.max(older, 1)) * 100).toFixed(1);
      if (change < 0) md += `> [!SUCCESS] ✅ Good news! Your errors decreased by **${Math.abs(change)}%** in recent weeks.\n\n`;
      else if (change > 0) md += `> [!CAUTION] ⚠️ Errors increased by **${change}%** in recent weeks. Keep practicing!\n\n`;
      else md += `> [!NOTE] ➡️ Your error rate remained stable in recent weeks.\n\n`;
    }
  }

  if (errorFrequency.length > 0) {
    md += `\n## 🔍 Detailed Error Analysis\n\n`;
    for (const err of errorFrequency) {
      const icon = err.major_count > 0 ? "🔴" : err.moderate_count > 0 ? "🟡" : "🟢";
      md += `> [!CAUTION]- ${icon} ${err.error_type} (${err.count} Occurrences)\n>\n`;
      const examples = examplesByType.get(err.error_type) || [];
      for (let i = 0; i < examples.length; i++) {
        const ex = examples[i];
        md += `> ### 📝 Example ${i + 1}\n> \n`;
        md += `> > [!FAILURE] Original (❌)\n> > \`${escapeCallout(ex.original_text)}\`\n> \n`;
        const correction = stripTrailingCodeBlock(ex.correction);
        if (correction) {
          md += `> > [!SUCCESS] Corrected (✅)\n> > \`${escapeCallout(correction)}\`\n> \n`;
        }
        const refine = stripTrailingCodeBlock(ex.refine);
        if (refine) {
          md += `> > [!TIP] Natural Phrasing (✨)\n> > \`${escapeCallout(refine)}\`\n> \n`;
        }
        md += `> > [!INFO] Logic & Rules\n`;
        if (ex.explanation) md += `> > **Why**: ${escapeCallout(ex.explanation)}\n`;
        if (ex.rule) md += `> > **Rule**: ${escapeCallout(ex.rule).replace(/\n/g, "<br>")}\n`;
        if (ex.tip) md += `> > **Pro Tip**: ${escapeCallout(ex.tip).replace(/\n/g, "<br>")}\n`;
        md += `> \n`;
        if (i < examples.length - 1) md += `> ---\n>\n`;
      }
      md += `> ---\n\n`;
    }
  }

  if (errorFrequency.length > 0) {
    md += `\n## 📚 Grammar Rules Reference (AI-Powered)\n\n`;
    md += `> [!INFO] 📖 Personalized Grammar Explanations\n`;
    md += `> This section provides **AI-generated**, customized grammar rules based on your actual errors and examples.\n\n`;
    const categories = {};
    for (const err of errorFrequency) {
      const category = err.error_type.split(" / ")[0];
      if (!categories[category]) categories[category] = [];
      categories[category].push(err);
    }
    for (const [category, errors] of Object.entries(categories)) {
      md += `### ${getCategoryIcon(category)} ${category}\n\n`;
      for (const err of errors) {
        const rule = rules.get(err.error_type);
        if (rule && rule.content) {
          md += `> [!NOTE]- ${rule.title}\n> \n`;
          for (const line of rule.content.split("\n")) {
            if (line.trim() === "") md += `> \n`;
            else {
              let cleaned = line.replace(/^>\s*/, "").replace(/\|/g, "\\|");
              md += `> ${cleaned}\n`;
            }
          }
          md += `\n\n`;
        }
      }
    }
  }

  if (errorFrequency.length > 0) {
    md += `\n## 🎯 Top 3 Priorities\n\n> [!EXAMPLE] 💡 Focus on these to see the biggest improvement\n> \n`;
    const top3 = errorFrequency.slice(0, 3);
    for (let i = 0; i < top3.length; i++) {
      md += `> ${i + 1}. **${top3[i].error_type}** - ${top3[i].count} occurrences\n`;
    }
    md += `\n`;
  }
  md += `---\n\n*Generated by IGT (Interactive Grammar Tool) with AI-powered customization*\n`;
  return md;
}
