export const coachReportTitle = "English skills report";

// Keep validated source references in report data, but omit them from reader-facing text.
export function coachReportDisplayMarkdown(report) {
  const sources = new Set(report.evidence.flatMap((item, index) => [item.entryId, `S${index + 1}`]));
  const markdown = report.markdown.replace(/\[([^\]\n]+)\]/g, (citation, group) =>
    group.trim().split(/[,，、;；\s]+/).every(label => sources.has(label)) ? "" : citation)
    .replace(/[ \t]+([.,;:!?，。；：！？])/g, "$1");
  // A column used only for citations would otherwise become an empty column.
  return markdown.replace(/^[ \t]*\|[^\n]*\|[ \t]*(?:\r?\n[ \t]*\|[^\n]*\|[ \t]*)+/gm, table => {
    const rows = table.split(/\r?\n/).map(line => line.trim().slice(1, -1).split("|").map(cell => cell.trim()));
    if (rows.length < 3 || !rows[1].every(cell => /^:?-+:?$/.test(cell))) return table;
    const hidden = new Set(rows[0].flatMap((heading, index) =>
      /^(?:evidence|sources?|citations?|references?|证据|来源|引用|证据引用)$/i.test(heading) && rows.slice(2).every(row => row[index] === "") ? [index] : []));
    if (!hidden.size) return table;
    return rows.map(row => `| ${row.filter((_, index) => !hidden.has(index)).join(" | ")} |`).join("\n");
  });
}
