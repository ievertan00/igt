import { useEffect, useRef, useState } from "react";
import { webApi, type CoachReport, type CoachReportSummary } from "../api/client";
import { Heading, Panel, State } from "../components/Page";
import { Icon } from "../components/Icon";
import { Markdown } from "../components/Markdown";
import { ModelSwitcher } from "../components/model-settings";
import { useGuideCopy } from "../components/learner-language";
import { coachReportDisplayMarkdown, coachReportTitle } from "../../../../lib/domain/coach-report-display.mjs";
import "./Coach.css";

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

export function PracticeLog() {
  const { t } = useGuideCopy();
  const [markdown, setMarkdown] = useState<string>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void webApi.getOverviewPracticeLog().then(
      (result) => {
        if (!active) return;
        if (typeof result.markdown === "string") setMarkdown(result.markdown);
        else setError(true);
      },
      () => { if (active) setError(true); },
    );
    return () => { active = false; };
  }, []);
  return (
    <div>
      <Heading eyebrow={t("Overview")} title={t("Practice log")} detail={<a href="#dashboard">{t("Back to Overview")}</a>} />
      <Panel className="practice-log-panel">
        {error ? <div role="alert"><State title={t("Practice log is unavailable")} /></div>
          : markdown === undefined ? <p role="status">{t("Loading…")}</p>
            : markdown.trim() ? <Markdown source={markdown} />
              : <State title={t("No saved practice entries yet")} />}
      </Panel>
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
