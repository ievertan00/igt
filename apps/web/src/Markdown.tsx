import type { ReactNode } from "react";

// Renders the markdown subset the Ask prompt asks for (see igt_config.json AskPrompt)
// and that the CLI already renders in lib/features/ask/render.mjs:
// headings, bullets, ordered lists, blockquotes, code fences, tables, hr,
// inline **bold**, *italic* and `code`. Output is React elements, never HTML strings.

const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;
const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const FENCE = /^\s*```/;
const RULE = /^\s*(?:-{3,}|\*{3,})\s*$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const [raw, code, bold, italic] = match;
    if (code !== undefined) out.push(<code key={key++}>{code}</code>);
    else if (bold !== undefined) out.push(<strong key={key++}>{bold}</strong>);
    else out.push(<em key={key++}>{italic}</em>);
    last = match.index + raw.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function tableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableRow(line: string): boolean {
  return TABLE_ROW.test(line);
}

function isSeparatorRow(line: string): boolean {
  return isTableRow(line) && tableCells(line).every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isBlockStart(line: string): boolean {
  return (
    HEADING.test(line) ||
    BULLET.test(line) ||
    ORDERED.test(line) ||
    QUOTE.test(line) ||
    FENCE.test(line) ||
    RULE.test(line) ||
    isTableRow(line)
  );
}

function blocks(source: string): ReactNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (FENCE.test(line)) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      i += 1;
      out.push(
        <pre key={key++}>
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 6);
      const Tag = `h${level}` as "h3" | "h4" | "h5" | "h6";
      out.push(<Tag key={key++}>{renderInline(heading[2])}</Tag>);
      i += 1;
      continue;
    }

    if (RULE.test(line)) {
      out.push(<hr key={key++} />);
      i += 1;
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const header = tableCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(tableCells(lines[i++]));
      out.push(
        <table key={key++}>
          <thead>
            <tr>
              {header.map((cell, cellIndex) => (
                <th key={cellIndex}>{renderInline(cell)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{renderInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }

    const ordered = line.match(ORDERED);
    if (ordered) {
      const items: string[] = [];
      while (i < lines.length) {
        const item = lines[i].match(ORDERED);
        if (!item) break;
        items.push(item[1]);
        i += 1;
      }
      out.push(
        <ol key={key++}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const bullet = line.match(BULLET);
    if (bullet) {
      const items: string[] = [];
      while (i < lines.length) {
        const item = lines[i].match(BULLET);
        if (!item) break;
        items.push(item[1]);
        i += 1;
      }
      out.push(
        <ul key={key++}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) quoted.push(lines[i++].replace(QUOTE, "$1"));
      out.push(<blockquote key={key++}>{blocks(quoted.join("\n"))}</blockquote>);
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    // A pipe row without a separator row is text, not a table.
    if (!paragraph.length) paragraph.push(lines[i++].trim());
    out.push(<p key={key++}>{renderInline(paragraph.join("\n"))}</p>);
  }
  return out;
}

export function Markdown({ source }: { source: string }) {
  if (!source?.trim()) return null;
  return <div className="md">{blocks(source)}</div>;
}
