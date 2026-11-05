import { useEffect, useRef, useState } from "react";
import { webApi, type CoachReport, type CoachReportSummary, type LearningOverview } from "./api/client";
import { Heading, Panel, State } from "./Page";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { ModelSwitcher } from "./model-settings";
import { useGuideCopy } from "./learner-language";
import { coachReportDisplayMarkdown } from "../../../lib/domain/coach-report-display.mjs";
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

const activityBadge: Record<string, string> = {
  grammar: "Grammar",
  text: "Text analysis",
  writing: "Writing",
  practice: "Practice",
  vocabulary: "Saved word",
  ask: "Ask",
  other: "Other",
};

function EffortTrend({ effort }: { effort: LearningOverview["effort"] }) {
  const { t } = useGuideCopy();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const series =
    period === "daily"
      ? effort.daily.map((day) => ({ date: day.date, label: day.label, count: day.count }))
      : effort[period].map((item) => ({
          date: item.start,
          label: new Intl.DateTimeFormat("en", {
            month: "short",
            ...(period === "weekly" ? { day: "numeric" as const } : {}),
            timeZone: "UTC",
          }).format(new Date(`${item.start}T00:00:00Z`)),
          count: item.count,
        }));
  const max = Math.max(1, ...series.map((day) => day.count));
  const momentum = effort.momentum;
  const periodLabel =
    period === "daily"
      ? t("Last 7 days")
      : period === "weekly"
        ? t("Last 4 weeks")
        : t("Last 6 months");
  return (
    <section className="overview-effort" aria-labelledby="effort-title">
      <div className="panel-heading">
        <h2 id="effort-title">{t("Effort trend")}</h2>
        <div className="overview-chart-controls" role="group" aria-label="Effort period">
          {(
            [
              ["daily", t("Daily")],
              ["weekly", t("Weekly")],
              ["monthly", t("Monthly")],
            ] as const
          ).map(([value, label]) => (
            <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="overview-chart-caption">
        <span>{periodLabel}</span>
        <span>{t("Sentences · zero baseline")}</span>
      </p>
      <ol className="overview-daily" aria-label={`${period} sentence totals`}>
        {series.map((day, index) => (
          <li key={day.date} className={index === series.length - 1 ? "is-current" : ""}>
            <span className="overview-chart-value">
              {day.count}
              <span className="sr-only"> sentences</span>
            </span>
            <span className="overview-bar" aria-hidden="true">
              <span style={{ height: `${(day.count / max) * 100}%` }} />
            </span>
            <time dateTime={day.date} title={day.date}>
              {period === "daily" ? (
                <>
                  <span>
                    {index === series.length - 1 ? t("Today") : day.label.split(" ").at(-1)}
                  </span>
                  <span className="overview-chart-date">{day.date.slice(5).replace("-", "/")}</span>
                </>
              ) : (
                <>
                  <span>{day.label}</span>
                  {index === series.length - 1 && (
                    <span className="overview-chart-date">{t("Current")}</span>
                  )}
                </>
              )}
            </time>
          </li>
        ))}
      </ol>
      <p className="overview-momentum">
        <strong>
          {t("Weekly momentum:")}{" "}
          {momentum.percent == null
            ? momentum.current
              ? t("No previous-week baseline")
              : t("No activity in either week")
            : `${momentum.percent > 0 ? "+" : ""}${momentum.percent}%`}
        </strong>
        <span>
          {t("{current} sentences in the last 7 days vs {previous} in the previous 7 days.", {
            current: momentum.current,
            previous: momentum.previous,
          })}
        </span>
      </p>
    </section>
  );
}

export function Dashboard() {
  const { t } = useGuideCopy();
  const days = windowDays(30);
  const rawOffset = Number(params().get("offset") || 0);
  const offset = Number.isSafeInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const [data, setData] = useState<LearningOverview>();
  const [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const request = useRef(0);
  async function load() {
    const id = ++request.current;
    setBusy(true);
    setError("");
    try {
      const result = await webApi.getDashboard({ days, offset, limit: 5 });
      if (id === request.current) {
        setData(result);
        setNow(Date.now());
      }
    } catch {
      if (id === request.current)
        setError("Your learning activity could not be loaded. Please try again.");
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      request.current++;
    };
  }, [days, offset]);
  const inventory = data?.coverage.find((source) => source.status === "inventory");
  const unavailable = data?.coverage.filter((source) => source.status === "unavailable") || [];
  const amount = (value: number, singular: string, plural = `${singular}s`) =>
    `${value} ${value === 1 ? singular : plural}`;

  const quickLinks = [
    {
      href: "#word-library",
      label: t("Saved words"),
      detail: inventory?.count != null ? amount(inventory.count, "word") : t("Browse your library"),
    },
    {
      href: `#handbook?days=0`,
      label: t("Grammar corrections"),
      detail: t("Your saved sentences and feedback"),
    },
    { href: "#ask?view=notes", label: t("Ask notes"), detail: t("Explanations you kept") },
  ];

  return (
    <div className="overview-page">
      <div className="overview-header">
        <div className="overview-header-main">
          <Heading
            eyebrow="OVERVIEW"
            title="Your effort. Your next focus."
            detail={t(
              "See your sentence work over time and the mistakes to give attention to next.",
            )}
          />
          <button className="secondary" disabled={busy} onClick={() => void load()}>
            {busy ? t("Loading…") : t("Refresh")}
          </button>
        </div>
      </div>
      {error && (
        <div role="alert">
          <State title={t("Overview is unavailable")} detail={error} />
          {data && <p>{t("Previously loaded activity remains below.")}</p>}
          <button onClick={() => void load()}>{t("Try again")}</button>
        </div>
      )}
      <div aria-busy={busy}>
        {busy && <p role="status">{t("Loading recorded activity…")}</p>}
        {data && (
          <>
            {unavailable.length > 0 && (
              <p role="status" className="overview-notice">
                {t("Some activity could not be read: {sources}. Counts may be incomplete.", {
                  sources: unavailable.map((source) => source.source).join(", "),
                })}
              </p>
            )}

            <div className="overview-insights">
              <EffortTrend effort={data.effort} />
              <section className="overview-priorities" aria-labelledby="priorities-title">
                <div className="panel-heading">
                  <h2 id="priorities-title">{t("Top 3 priorities")}</h2>
                  <span className="overview-timeline-range">{t("Last 30 days")}</span>
                </div>
                <p className="handbook-evidence">
                  {t(
                    "Most frequent error types in saved Grammar and Text feedback. Each diagnosis counts as one hit.",
                  )}
                </p>
                {unavailable.some((source) => source.source === "Saved writing") ? (
                  <State
                    title={t("Priorities unavailable")}
                    detail={t("Saved writing could not be read. Refresh to try again.")}
                  />
                ) : data.priorities.length ? (
                  <ol className="overview-priority-list">
                    {data.priorities.map((item) => (
                      <li key={item.errorType}>
                        <div>
                          <h3>{item.errorType}</h3>
                          <span>
                            {item.hits} {item.hits === 1 ? "hit" : "hits"}
                          </span>
                        </div>
                        {item.habit && <p>Habit: {item.habit}</p>}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="overview-priority-empty">
                    <Icon name="coach" />
                    <State
                      title={t("No error types recorded in the last 30 days.")}
                      detail={t(
                        "Save feedback from Grammar or Text analysis to see what needs attention.",
                      )}
                    />
                  </div>
                )}
                <a className="primary" href="#practice">
                  {t("Practise sentences")}
                  <Icon name="arrow" />
                </a>
              </section>
            </div>

            <div className="overview-library-grid">
              <section className="overview-timeline" aria-label={t("Recent activity")}>
                <div className="panel-heading overview-history-heading">
                  <h2>{t("Recent activity")}</h2>
                  <WindowSelect
                    days={days}
                    disabled={busy}
                    onChange={(days) => go("dashboard", { days, offset: 0 })}
                  />
                </div>
                {data.events.length ? (
                  <ol className="learning-timeline">
                    {data.events.map((event) => (
                      <li key={`${event.source}:${event.id}`}>
                        <span className={`learning-badge learning-badge-${event.type}`}>
                          {activityBadge[event.type] || "Record"}
                        </span>
                        <div className="learning-event-body">
                          {event.title.length > 160 ? (
                            <details>
                              <summary>{event.title.slice(0, 140)}…</summary>
                              <p>{event.title}</p>
                              {event.href && <a href={event.href}>{t("Open record")}</a>}
                            </details>
                          ) : (
                            <p>
                              {event.href ? <a href={event.href}>{event.title}</a> : event.title}
                            </p>
                          )}
                          <time dateTime={event.timestamp}>
                            {relativeTime(event.timestamp, now, t)}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <State
                    title={
                      offset > 0
                        ? t("No records on this page.")
                        : t("No recent activity in this window.")
                    }
                    detail={
                      offset > 0
                        ? t("Go to the previous page to see earlier records.")
                        : t("Complete a practice or save some feedback — it will appear here.")
                    }
                  />
                )}
                {(data.pagination.total > 0 || offset > 0) && (
                  <nav className="handbook-pagination" aria-label={t("Activity pages")}>
                    <span>
                      {data.events.length
                        ? t("{start}–{end} of {total}", {
                            start: offset + 1,
                            end: offset + data.events.length,
                            total: data.pagination.total,
                          })
                        : t("{total} records", { total: data.pagination.total })}
                    </span>
                    <button
                      disabled={busy || offset === 0}
                      onClick={() =>
                        go("dashboard", {
                          days,
                          offset: Math.max(0, offset - data.pagination.limit),
                        })
                      }
                    >
                      {t("Previous")}
                    </button>
                    <button
                      disabled={busy || !data.pagination.hasMore}
                      onClick={() =>
                        go("dashboard", { days, offset: offset + data.pagination.limit })
                      }
                    >
                      {t("Next")}
                    </button>
                  </nav>
                )}
              </section>

              <section className="overview-quick" aria-label="Saved material">
                <div className="panel-heading">
                  <h2>{t("Your saved material")}</h2>
                </div>
                <div className="overview-quick-links">
                  {quickLinks.map((link, index) => (
                    <a key={link.href} href={link.href} className="overview-quick-link">
                      <Icon
                        name={index === 0 ? "word-library" : index === 1 ? "grammar" : "bookmark"}
                      />
                      <span className="overview-link-copy">
                        <strong>{link.label}</strong>
                        <span>{link.detail}</span>
                      </span>
                      <Icon name="arrow" />
                    </a>
                  ))}
                </div>
              </section>
            </div>

            <footer className="overview-coverage">
              <p>
                {t(
                  "Recorded effort and error frequency do not establish mastery. Unsaved tool use is not included. Vocabulary review history is excluded.",
                )}{" "}
                {data.undated > 0 &&
                  t("{count} undated record(s) excluded.", { count: data.undated })}
              </p>
            </footer>
          </>
        )}
      </div>
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
    const text = `# English proficiency diagnostic report\n\nGenerated: ${report.generatedAt}\n\n${report.totalChecks} saved records; ${report.evidence.length} records supplied for analysis.\n\n${reportMarkdown}`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "english-proficiency-report.md"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="coach-page">
    <div className="coach-hero">
      <Heading eyebrow="COACH" title="Your English proficiency report" detail="Understand your strengths, recurring language patterns, and the knowledge behind them in one evidence-based report to guide your next steps." />
      <div className="coach-illustration" aria-hidden="true">
        <div className="coach-illustration-back"><i /><i /></div>
        <div className="coach-illustration-front"><i /><i /><div className="coach-illustration-chart"><b /><b /><b /></div></div>
        <span className="coach-illustration-check"><Icon name="check" /></span>
        <svg viewBox="0 0 40 40" className="coach-illustration-rays"><path d="M9 14 12 3 M19 20 29 10 M24 29 36 26" /></svg>
      </div>
    </div>
    <div className="handbook-filters coach-toolbar">
      <div className="coach-window"><WindowSelect days={days} disabled={busy} onChange={days => go("coach", { days })} /><Icon name="calendar" /></div>
      <label className="coach-language">Report language <span className="coach-select"><Icon name="globe" /><select value={language} disabled={busy} onChange={e => setLanguage(e.target.value)}><option value="zh-CN">中文</option><option value="en">English</option></select></span></label>
      <div className="coach-model"><span id="coach-model-label">Model</span><ModelSwitcher role="pro" disabled={busy} /></div>
      <div className="coach-actions">
        <button className="primary" disabled={busy} aria-busy={busy} onClick={() => void generate()}>{busy ? "Generating report…" : report ? "Regenerate report" : "Generate diagnostic report"}<Icon name="arrow" /></button>
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
    {!report && !busy && <State title="A report grounded in your Grammar and Practice records" detail="Review your proficiency, individual error patterns, underlying knowledge gaps and personalized improvement directions using saved Grammar checks and 02_Practice_Log. Only abilities supported by your writing are assessed; AI corrections and assisted answers do not establish mastery." />}
    {report && <Panel title="English proficiency diagnostic report" icon="document" className="coach-report">
      <div className="coach-report-meta">
        <span><Icon name="calendar" />{report.cached ? "Cached report" : "Generated on"} {new Date(report.generatedAt).toLocaleString()}</span>
        <span><Icon name="layers" />{report.sourceCounts?.grammar ?? report.totalChecks} grammar checks</span>
        <span><Icon name="ask" />{report.sourceCounts?.practice ?? 0} practice records</span>
        <span><Icon name="info" />{report.coverage.unclassified} unknown sources</span>
      </div>
      <div className="coach-report-provenance">
      {report.savedPath && <p className="handbook-evidence coach-saved-path"><strong>Saved locally:</strong> <span>{report.savedPath}</span></p>}
      {report.saveError && <p role="alert">{report.saveError}</p>}
      <p className="handbook-evidence"><strong>Data:</strong> {report.sourceCounts ? `${report.sourceCounts.grammar} Grammar checks · ${report.sourceCounts.practice} Practice records` : `${report.totalChecks} saved Grammar checks`} · {report.evidence.length} records supplied to the model · {report.duplicateInputs} repeated inputs</p>
      {report.sourceStatus && report.sourceStatus.practice !== "available" && <p className="handbook-evidence">Practice log: {report.sourceStatus.practice}. Practice evidence was not available for this report.</p>}
      {report.sourceStatus?.grammar === "unavailable" && <p className="handbook-evidence">Grammar records could not be read. This report uses available Practice evidence.</p>}
      <p className="handbook-evidence"><strong>Notes:</strong> {report.sampled ? "Chronological sample" : "All records in this window"}. {report.coverage.unclassified} records with unknown sources and {report.coverage.excludedOtherSources} full-text records excluded; {report.coverage.undated} records have no usable date. Suggestions and possible causes need validation through practice.</p>
      {report.truncated && <p className="handbook-evidence">Long records and feedback were shortened for analysis. Open the saved checks to read the full records.</p>}
      </div>
      <Markdown source={reportMarkdown} />
    </Panel>}
      </div>
    </div>
  </div>;
}
