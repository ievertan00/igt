const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function inline(value) {
  const pattern = /`([^`]+)`|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;
  let result = "", last = 0;
  for (const match of value.matchAll(pattern)) {
    result += escape(value.slice(last, match.index));
    const [, code, label, href, bold, italic] = match;
    if (code) result += `<code>${escape(code)}</code>`;
    else if (href) result += `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`;
    else if (bold) result += `<strong>${escape(bold)}</strong>`;
    else result += `<em>${escape(italic)}</em>`;
    last = match.index + match[0].length;
  }
  return result + escape(value.slice(last));
}

const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
const separator = (line) => /^\s*\|/.test(line || "") && cells(line).every((cell) => /^:?-{3,}:?$/.test(cell));
const blockStart = (line) => /^(?:#{1,6}\s|>\s?|```|[-*]\s|\d+[.)]\s|---+\s*$|\|)/.test(line);

export function renderReportMarkdown(markdown, depth = 0) {
  if (depth > 12) return `<pre>${escape(markdown)}</pre>`;
  const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^```/.test(line)) {
      const body = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++; out.push(`<pre><code>${escape(body.join("\n"))}</code></pre>`); continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) { out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); i++; continue; }
    if (/^---+\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (/^>/.test(line)) {
      const quoted = [];
      while (i < lines.length && /^>/.test(lines[i])) quoted.push(lines[i++].replace(/^>\s?/, ""));
      const callout = quoted[0]?.match(/^\[!([A-Z]+)\]([+-])?\s*(.*)$/);
      if (callout) {
        const title = inline(callout[3] || callout[1]);
        const body = renderReportMarkdown(quoted.slice(1).join("\n"), depth + 1);
        out.push(callout[2] ? `<details${callout[2] === "+" ? " open" : ""}><summary>${title}</summary>${body}</details>` : `<aside><p class="callout-title">${title}</p>${body}</aside>`);
      } else out.push(`<blockquote>${renderReportMarkdown(quoted.join("\n"), depth + 1)}</blockquote>`);
      continue;
    }
    if (/^\s*\|/.test(line) && separator(lines[i + 1])) {
      const header = cells(line); i += 2;
      const body = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) body.push(`<tr>${cells(lines[i++]).map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`);
      out.push(`<div class="table-scroll"><table><thead><tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${body.join("")}</tbody></table></div>`); continue;
    }
    const list = line.match(/^(?:([-*])|\d+[.)])\s+(.*)$/);
    if (list) {
      const tag = list[1] ? "ul" : "ol", items = [];
      const pattern = list[1] ? /^[-*]\s+(.*)$/ : /^\d+[.)]\s+(.*)$/;
      while (i < lines.length && pattern.test(lines[i])) items.push(`<li>${inline(lines[i++].match(pattern)[1])}</li>`);
      out.push(`<${tag}>${items.join("")}</${tag}>`); continue;
    }
    const paragraph = [line]; i++;
    while (i < lines.length && lines[i].trim() && !blockStart(lines[i])) paragraph.push(lines[i++]);
    out.push(`<p>${inline(paragraph.join("\n"))}</p>`);
  }
  return out.join("\n");
}

export function reportHtml(markdown, title = "Personal English Error Handbook") {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${escape(title)}</title><style>
:root{color-scheme:light;font-family:"Segoe UI","Microsoft YaHei",system-ui,sans-serif;color:#171717;background:#fff}
*{box-sizing:border-box}body{margin:0 auto;max-width:900px;padding:32px;line-height:1.75;font-size:16px;overflow-wrap:anywhere}h1,h2,h3{line-height:1.3}h1{font-size:30px}h2{margin-top:32px;font-size:23px}h3{margin-top:24px;font-size:19px}a{color:#315b99;text-underline-offset:3px}p,li{white-space:pre-wrap}pre{overflow:auto;background:#f7f7f5;padding:16px;white-space:pre-wrap}code{font-size:.94em}aside,blockquote,details{margin:20px 0;padding:16px;background:#f7f7f5;border:1px solid #e5e5e2;border-radius:10px}aside>:last-child,details>:last-child{margin-bottom:0}.callout-title,summary{font-weight:600}summary{cursor:pointer;min-height:44px;padding:8px 0}details[open]>summary{margin-bottom:12px}.table-scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:12px;border-bottom:1px solid #e5e5e2;vertical-align:top}hr{border:0;border-top:1px solid #e5e5e2;margin:32px 0}
@media(max-width:600px){body{padding:20px}h1{font-size:26px}th,td{padding:8px}}@media print{body{max-width:none;padding:0;font-size:11pt}details,aside,blockquote{break-inside:avoid;background:none}details:not([open])>*:not(summary){display:block}a{color:inherit}h1,h2,h3{break-after:avoid}.table-scroll{overflow:visible}}
@media print{details::details-content{display:block;content-visibility:visible}}
</style></head><body>${renderReportMarkdown(markdown)}</body></html>`;
}
