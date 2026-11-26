import { useEffect, useRef, useState } from "react";
import { webApi, type CoachReport, type CoachReportSummary } from "../api/client";
import { Panel, State } from "../components/Page";
import { Icon } from "../components/Icon";
import { Markdown } from "../components/Markdown";
import { ModelSwitcher } from "../components/model-settings";
import { useGuideCopy } from "../components/learner-language";
import { coachReportDisplayMarkdown, coachReportTitle } from "../../../../lib/domain/coach-report-display.mjs";
import "./Coach.css";
import "./PracticeLog.css";

const params = () => new URLSearchParams(location.hash.split("?")[1] || "");
function windowDays(fallback: number) {
  const value = Number(params().get("days") ?? fallback);
  return Number.isInteger(value) && value >= 0 && value <= 3650 ? value : fallback;
}
function go(route: string, values: Record<string, string | number>) {
  location.hash = `#${route}?${new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)]))}`;
}
function dateLabel(
  value: string,
  t: (s: string, v?: Record<string, string | number>) => string,
  precision?: string,
) {
  if (!Number.isFinite(Date.parse(value))) return t("Date unavailable");
  return (
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      ...(precision === "day" ? {} : { timeStyle: "short" as const }),
      timeZone: "Asia/Shanghai",
    }).format(new Date(value)) + (precision === "day" ? t("· date only") : t("· Beijing time"))
  );
}
function relativeTime(
  value: string,
  now: number,
  t: (s: string, v?: Record<string, string | number>) => string,
) {
  const ms = now - Date.parse(value);
  if (!Number.isFinite(ms) || ms < 0) return "";
  const minutes = Math.floor(ms / 60000),
    hours = Math.floor(minutes / 60),
    days = Math.floor(hours / 24);
  if (minutes < 1) return t("just now");
  if (minutes < 60) return t("{minutes}m ago", { minutes });
  if (hours < 24) return t("{hours}h ago", { hours });
  if (days < 7) return t("{days}d ago", { days });
  return dateLabel(value, t);
}
function WindowSelect({
  days,
  onChange,
  disabled,
}: {
  days: number;
  onChange: (days: number) => void;
  disabled: boolean;
}) {
  const { t } = useGuideCopy();
  return (
    <label>
      {t("Time window")}
      <select
        value={days}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {![0, 30, 90].includes(days) && (
          <option value={days}>{t("Last {days} days", { days })}</option>
        )}
        <option value={30}>{t("Last 30 days")}</option>
        <option value={90}>Last 90 days</option>
        <option value={0}>{t("All history")}</option>
      </select>
    </label>
  );
}

const PRACTICE_LOG_FIELDS = [
  "Mode", "Context", "Handbook target", "Evidence", "Question", "Difficulty", "Style",
  "Language focus", "Hints used", "Prompt", "Your answer", "Correct answer", "Reference answer",
  "Score", "Feedback", "Strengths", "Improvements",
] as const;
type PracticeLogField = (typeof PRACTICE_LOG_FIELDS)[number];
const PRACTICE_LOG_FIELD_SET = new Set<string>(PRACTICE_LOG_FIELDS);
// Older / hand-edited logs may carry the raw evaluation keys. Accept both spellings;
// the display key always wins when both are present.
const PRACTICE_LOG_FIELD_ALIASES: Record<string, PracticeLogField> = {
  corrected_answer: "Correct answer",
  feedback_zh: "Feedback",
  strengths_zh: "Strengths",
  improvements_zh: "Improvements",
};

type PracticeEntry = {
  id: string;
  title: string;
  fields: Partial<Record<PracticeLogField, string>>;
  extra: string[];
  prose: string[];
};

// The Markdown file stays the source of truth. Only the log writer's `## …` + `- Key: value`
// shape is turned into structured entries; anything else is preserved verbatim through the Markdown renderer.
function parsePracticeLog(source: string): { preamble: string; entries: PracticeEntry[] } {
  const preamble: string[] = [];
  const entries: PracticeEntry[] = [];
  let current: PracticeEntry | null = null;
  let feedbackContinuation = false;
  source.replace(/\r\n?/g, "\n").split("\n").forEach((line, index) => {
    const heading = line.match(/^##\s+(.*)$/);
    if (heading) {
      current = { id: `practice-entry-${index}`, title: heading[1].trim(), fields: {}, extra: [], prose: [] };
      entries.push(current);
      feedbackContinuation = false;
      return;
    }
    if (!current) {
      if (line.trim()) preamble.push(line);
      return;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      const pair = bullet[1].match(/^([^:]+):\s*(.*)$/);
      const rawKey = pair?.[1].trim();
      const key = rawKey && (PRACTICE_LOG_FIELD_SET.has(rawKey) ? rawKey : PRACTICE_LOG_FIELD_ALIASES[rawKey]);
      if (pair && key && PRACTICE_LOG_FIELD_SET.has(key)) {
        if (!current.fields[key as PracticeLogField]) current.fields[key as PracticeLogField] = pair[2].trim();
        feedbackContinuation = key === "Feedback";
      } else if (feedbackContinuation) current.fields.Feedback += `\n${line}`;
      else current.extra.push(bullet[1]);
      return;
    }
    if (feedbackContinuation) current.fields.Feedback += `\n${line}`;
    else if (line.trim()) current.prose.push(line);
  });
  return { preamble: preamble.join("\n"), entries };
}

const PRACTICE_LOG_META_FIELDS: PracticeLogField[] = [
  "Context", "Difficulty", "Style", "Language focus", "Hints used", "Handbook target",
];

// The log writer flattens evaluation arrays onto one `; `-separated line.
function splitPracticeNotes(value: string): string[] {
  return value.split(/;\s*/).map((item) => item.trim()).filter(Boolean);
}

function PracticeLogEntries({ preamble, entries }: { preamble: string; entries: PracticeEntry[] }) {
  const { t } = useGuideCopy();
  return (
    <div className="practice-log-entries">
      {preamble && <Markdown source={preamble} />}
      {entries.map((entry) => {
        const fields = entry.fields;
        const strengths = splitPracticeNotes(fields.Strengths ?? "");
        const improvements = splitPracticeNotes(fields.Improvements ?? "");
        const scoreText = fields.Score || "";
        const score = /^\d+$/.test(scoreText) ? Number(scoreText) : null;
        const timestamp = entry.title.match(/\d{4}-\d{2}-\d{2}T[^\s]+/)?.[0];
        const title = timestamp
          ? entry.title.replace(timestamp, "").replace(/\s*[·–-]\s*$/, "").trim()
          : entry.title;
        return (
          <article className="practice-log-entry" key={entry.id} aria-label={entry.title}>
            <header className="practice-log-entry-head">
              <div className="practice-log-entry-titles">
                <p className="practice-log-eyebrow">
                  {timestamp ? <time dateTime={timestamp}>{dateLabel(timestamp, t)}</time> : t("Practice entry")}
                </p>
                <h2>{title && !/^practice$/i.test(title) ? title : t("Sentence translation")}</h2>
              </div>
              {score !== null && (
                <div className="practice-log-score" aria-label={`${t("Score")}: ${score} / 100`}>
                  <span className="practice-log-score-label">{t("Score")}</span>
                  <strong>{score}</strong>
                  <span className="practice-log-score-total">/ 100</span>
                </div>
              )}
            </header>
            <ul className="practice-log-meta">
              {PRACTICE_LOG_META_FIELDS.filter((key) => fields[key]).map((key) => (
                <li key={key}><span>{t(key)}</span><strong>{fields[key]}</strong></li>
              ))}
            </ul>
            {fields.Prompt && <dl className="practice-log-prompt"><dt>{t("Prompt")}</dt><dd>{fields.Prompt}</dd></dl>}
            {(fields["Your answer"] || fields["Correct answer"] || fields["Reference answer"]) && (
              <div className="practice-log-detail">
                {(fields["Your answer"] || fields["Correct answer"]) && <div className="practice-log-comparison">
                  {fields["Your answer"] && <dl className="practice-log-answer"><dt>{t("Your answer")}</dt><dd>{fields["Your answer"]}</dd></dl>}
                  {fields["Correct answer"] && <dl className="practice-log-answer practice-log-answer-corrected"><dt>{t("Corrected answer")}</dt><dd>{fields["Correct answer"]}</dd></dl>}
                </div>}
                {fields["Reference answer"] && (
                  <div className="practice-log-reference">
                    <span className="practice-log-reference-label">{t("Reference answer")}</span>
                    <p>{fields["Reference answer"]}</p>
                  </div>
                )}
              </div>
            )}
            {(fields.Feedback || fields.Strengths || fields.Improvements || fields.Prompt || score !== null) && (
              <div className="practice-log-feedback">
                <span className="practice-log-feedback-label">{t("Feedback")}</span>
                <div className="practice-log-feedback-body">{fields.Feedback?.trim() ? <Markdown source={fields.Feedback} /> : <p className="practice-log-note-empty">{t("Not recorded")}</p>}</div>
                <div className="practice-log-notes">
                  <dl className="practice-log-notes-col">
                    <dt>{t("Strengths")}</dt>
                    {strengths.length > 0
                      ? <dd><ul>{strengths.map((item, index) => <li key={index}><Markdown source={item} /></li>)}</ul></dd>
                      : <dd className="practice-log-note-empty">{t("Not recorded")}</dd>}
                  </dl>
                  <dl className="practice-log-notes-col">
                    <dt>{t("Improvements")}</dt>
                    {improvements.length > 0
                      ? <dd><ul>{improvements.map((item, index) => <li key={index}><Markdown source={item} /></li>)}</ul></dd>
                      : <dd className="practice-log-note-empty">{t("Not recorded")}</dd>}
                  </dl>
                </div>
              </div>
            )}
            {fields.Evidence && <p className="practice-log-evidence">{t("Evidence")}: {fields.Evidence}</p>}
            {entry.extra.length > 0 && (
              <ul className="practice-log-extra">{entry.extra.map((line, index) => <li key={index}>{line}</li>)}</ul>
            )}
            {entry.prose.length > 0 && <Markdown source={entry.prose.join("\n\n")} />}
          </article>
        );
      })}
    </div>
  );
}

export function PracticeLog() {
  const { t } = useGuideCopy();
  const [markdown, setMarkdown] = useState<string>();
  const [count, setCount] = useState<number>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void webApi.getOverviewPracticeLog().then(
      (result) => {
        if (!active) return;
        if (typeof result.markdown === "string") {
          setMarkdown(result.markdown);
          if (typeof result.count === "number") setCount(result.count);
        } else setError(true);
      },
      () => { if (active) setError(true); },
    );
    return () => { active = false; };
  }, []);
  const parsed = markdown ? parsePracticeLog(markdown) : null;
  const structured = !!parsed && parsed.entries.some((entry) => Object.keys(entry.fields).length > 0);
  return (
    <div className="practice-log-page">
      <div className="practice-log-heading-detail">
        <a href="#dashboard"><span aria-hidden="true">←</span> {t("Back to Overview")}</a>
        {count !== undefined && <span className="practice-log-count">{t("{count} entries", { count })}</span>}
      </div>
      <section className={`practice-log-panel${structured ? " is-structured" : " panel"}`}>
        {error ? <div role="alert"><State title={t("Practice log is unavailable")} /></div>
          : markdown === undefined ? <p role="status">{t("Loading…")}</p>
            : markdown.trim()
              ? structured && parsed
                ? <PracticeLogEntries preamble={parsed.preamble} entries={parsed.entries} />
                : <Markdown source={markdown} />
              : <State title={t("No saved practice entries yet")} />}
      </section>
    </div>
  );
}

export function Coach() {
  const days = windowDays(0);
  const [language, setLanguage] = useState("zh-CN");
  const [report, setReport] = useState<CoachReport>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedReports, setSavedReports] = useState<CoachReportSummary[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("");
  const visibleReports = savedReports.filter(item => item.days === days && item.language === language);
  const reportMarkdown = report ? coachReportDisplayMarkdown(report) : "";
  const request = useRef(0);
  useEffect(() => {
    request.current++; setReport(undefined); setSelectedReportId(""); setBusy(false); setError("");
    return () => { request.current++; };
  }, [days, language]);
  async function loadSavedReports() {
    try { setSavedReports(await webApi.listCoachReports()); setHistoryError(""); }
    catch { setHistoryError("Saved reports could not be loaded. Try refreshing the list."); }
  }
  useEffect(() => { void loadSavedReports(); }, []);
  async function openSaved(savedId: string) {
    const id = ++request.current;
    setBusy(true); setError("");
    try {
      const result = await webApi.readCoachReport(savedId);
      if (id === request.current) { setReport(result); setSelectedReportId(savedId); }
    } catch { if (id === request.current) setError("The saved report could not be opened. Refresh the list and try again."); }
    finally { if (id === request.current) setBusy(false); }
  }
  async function generate() {
    const id = ++request.current;
    setBusy(true); setError("");
    try {
      const result = await webApi.generateCoachReport(days, language, Boolean(report));
      if (id === request.current) { setReport(result); setSelectedReportId(result.savedId || ""); void loadSavedReports(); }
    } catch (err) {
      if (id === request.current) setError(err instanceof Error ? err.message : "Could not generate the report. Please try again.");
    } finally { if (id === request.current) setBusy(false); }
  }
  function download() {
    if (!report) return;
    const text = `# ${coachReportTitle}\n\nGenerated: ${report.generatedAt}\n\n${reportMarkdown}`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "english-proficiency-report.md"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="coach-page">
    <div className="handbook-filters coach-toolbar">
      <div className="coach-window"><WindowSelect days={days} disabled={busy} onChange={days => go("coach", { days })} /><Icon name="calendar" /></div>
      <label className="coach-language">Report language <span className="coach-select"><Icon name="globe" /><select value={language} disabled={busy} onChange={e => setLanguage(e.target.value)}><option value="zh-CN">中文</option><option value="en">English</option></select></span></label>
      <div className="coach-model"><span id="coach-model-label">Model</span><ModelSwitcher role="pro" disabled={busy} /></div>
      <div className="coach-actions">
        <button className="primary" disabled={busy} aria-busy={busy} onClick={() => void generate()}>{busy ? "Generating report…" : "Generate report"}<Icon name="arrow" /></button>
        <button className="secondary" disabled={!report} onClick={download}><Icon name="download" />Download Markdown</button>
      </div>
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="coach-workspace">
      <aside className="coach-history" aria-labelledby="coach-history-title">
        <h2 id="coach-history-title"><Icon name="layers" /><span>Saved reports <span className="coach-history-count">({visibleReports.length})</span></span></h2>
        {historyError && <p role="alert">{historyError}</p>}
        {!historyError && !visibleReports.length && <p className="coach-history-empty">No saved reports for this language and time window yet.</p>}
        <ul>{visibleReports.map(item => <li key={item.savedId}><button className="coach-history-item" aria-current={selectedReportId === item.savedId ? "true" : undefined} disabled={busy} onClick={() => void openSaved(item.savedId)}><time dateTime={item.generatedAt}>{new Date(item.generatedAt).toLocaleString()}</time><span>{item.totalChecks} records</span></button></li>)}</ul>
        <button className="secondary coach-history-refresh" disabled={busy} onClick={() => void loadSavedReports()}><Icon name="refresh" />Refresh saved reports</button>
      </aside>
      <div className="coach-reading">
    {busy && <p className="coach-progress" role="status">Reviewing saved sentences and feedback. This may take a few minutes.</p>}
    {!report && !busy && <State title="A report grounded in your Refine and Practice records" detail="Review your proficiency, individual error patterns, underlying knowledge gaps and personalized improvement directions using saved Refine checks and 02_Practice_Log. Only abilities supported by your writing are assessed; AI corrections and assisted answers do not establish mastery." />}
    {report && <Panel title={coachReportTitle} icon="document" className="coach-report">
      <div className="coach-report-meta">
        <span><Icon name="calendar" />{report.cached ? "Cached report" : "Generated on"} {new Date(report.generatedAt).toLocaleString()}</span>
      </div>
      <div className="coach-report-provenance">
      {report.saveError && <p role="alert">The report could not be saved. Try generating it again.</p>}
      {report.sourceStatus && report.sourceStatus.practice !== "available" && <p className="handbook-evidence">Practice records could not be read. This report uses the available learning records.</p>}
      {report.sourceStatus?.grammar === "unavailable" && <p className="handbook-evidence">Refine records could not be read. This report uses available Practice evidence.</p>}
      </div>
      <Markdown source={reportMarkdown} />
    </Panel>}
      </div>
    </div>
  </div>;
}
