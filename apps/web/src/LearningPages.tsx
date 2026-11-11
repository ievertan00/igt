import { useEffect, useRef, useState } from "react";
import { webApi, type CoachReport, type CoachReportSummary, type LearningOverview } from "./api/client";
import { Heading, Panel, State } from "./Page";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { ModelSwitcher } from "./model-settings";
import { useGuideCopy } from "./learner-language";
import { coachReportDisplayMarkdown, coachReportTitle } from "../../../lib/domain/coach-report-display.mjs";
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
  const step = Math.max(1, Math.ceil(Math.max(0, ...series.map((day) => day.count)) / 4));
  const ticks = [4, 3, 2, 1, 0].map((value) => value * step);
  const points = series.map((day, index) => ({
    x: ((index + .5) / series.length) * 100,
    y: 100 - (day.count / ticks[0]) * 100,
  }));
  const coordinates = points.map(({ x, y }) => `${x},${y}`).join(" ");
  const momentum = effort.momentum;
  const periodLabel =
    period === "daily"
      ? t("Last 7 days")
      : period === "weekly"
        ? t("Last 4 weeks")
        : t("Last 6 months");
  return (
    <section className="overview-effort" aria-labelledby="effort-title">
      <div className="overview-section-header">
        <div className="panel-heading">
          <Icon name="trend" />
          <div><h2 id="effort-title">{t("Effort trend")}</h2><p>{t("Your sentence work over time.")}</p></div>
        </div>
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
      <div className="overview-effort-body">
        <div>
          <p className="overview-chart-caption">
            <span>{periodLabel}</span>
            <span>{t("Sentences · zero baseline")}</span>
          </p>
          <div className="overview-chart">
            <div className="overview-chart-scale" aria-hidden="true">{ticks.map((tick) => <span key={tick}>{tick}</span>)}</div>
            <div className="overview-chart-plot" aria-hidden="true">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
                {points.length > 0 && <polygon points={`${points[0].x},100 ${coordinates} ${points.at(-1)!.x},100`} />}
                <polyline points={coordinates} vectorEffect="non-scaling-stroke" />
              </svg>
              {points.map(({ x, y }, index) => <span key={series[index].date} style={{ left: `${x}%`, top: `${y}%` }} />)}
            </div>
            <ol className="overview-daily" aria-label={`${period} sentence totals`}>
              {series.map((day, index) => (
                <li key={day.date} className={index === series.length - 1 ? "is-current" : ""}>
                  <span className="overview-chart-value">
                    {day.count}
                    <span className="sr-only"> sentences</span>
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
          </div>
        </div>
        <p className="overview-momentum">
          <span>{t("Weekly momentum:")}</span>
          <strong>
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
      </div>
      <details className="overview-counting">
        <summary><Icon name="info" />{t("How effort is counted")}<Icon name="chevron" /></summary>
        <p>{t("Beijing dates. Weeks start Monday; current week and month are partial. Saved Grammar/Text sentences and Sentence Practice attempts count as effort. Repeat work counts again; vocabulary reviews do not count.")}</p>
      </details>
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
      if (id !== request.current) return;
      // Older runtimes omit these fields. The library endpoints can also recover a missing count.
      const savedMaterial = result.savedMaterial;
      if (savedMaterial?.grammar == null || savedMaterial?.ask == null) {
        const [handbook, askNotes] = await Promise.allSettled([
          savedMaterial?.grammar == null ? webApi.getHandbook("", { days: 0, limit: 1 }) : undefined,
          savedMaterial?.ask == null ? webApi.listAskNotes() : undefined,
        ]);
        const grammarCoverage = handbook.status === "fulfilled" ? handbook.value?.coverage : undefined;
        const notes = askNotes.status === "fulfilled" ? askNotes.value?.notes : undefined;
        result.savedMaterial = {
          grammar: savedMaterial?.grammar ?? (typeof grammarCoverage?.grammar === "number"
            ? grammarCoverage.grammar - (grammarCoverage.legacyIncluded ?? 0)
            : null),
          ask: savedMaterial?.ask ?? (Array.isArray(notes) ? notes.length : null),
        };
      }
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
  const countLabel = (count: number | null | undefined, singular: string, plural: string) =>
    count == null ? t("Count unavailable") : t(count === 1 ? singular : plural, { count });

  const quickLinks = [
    {
      href: "#word-library",
      icon: "word-library",
      label: t("Saved words"),
      action: t("View all words"),
      detail: countLabel(inventory?.count, "{count} word", "{count} words"),
    },
    {
      href: `#handbook?days=0`,
      icon: "grammar",
      label: t("Grammar corrections"),
      action: t("Browse corrections"),
      detail: countLabel(data?.savedMaterial?.grammar, "{count} saved Grammar check", "{count} saved Grammar checks"),
    },
    { href: "#ask?view=notes", icon: "ask", label: t("Ask notes"), detail: countLabel(data?.savedMaterial?.ask, "{count} saved note", "{count} saved notes"), action: t("Explore notes") },
    { href: "#coach", icon: "coach", label: t("Learning reports"), detail: t("See your strengths, recurring mistakes, and what to practice next."), action: t("Open reports") },
  ] as const;

  return (
    <div className="overview-page">
      <div className="overview-header">
        <div className="overview-header-main">
          <Heading
            eyebrow={t("Overview")}
            title={t("Your effort. Your next focus.")}
            detail={t(
              "See your sentence work over time and the mistakes to give attention to next.",
            )}
          />
          <div className="overview-hero-art" aria-hidden="true">
            <Icon name="document" />
            <Icon name="folder" />
          </div>
          <button className="secondary" disabled={busy} onClick={() => void load()}>
            <Icon name="refresh" />
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

            <Panel title={t("Your saved material")} icon="layers" className="overview-quick">
              <div className="overview-quick-links">
                {quickLinks.map((link) => (
                  <a key={link.href} href={link.href} className="overview-quick-link">
                    <Icon name={link.icon} />
                    <span className="overview-link-copy"><strong>{link.label}</strong>{link.detail && <span>{link.detail}</span>}</span>
                    <span className="overview-link-action">{link.action}<Icon name="arrow" /></span>
                  </a>
                ))}
              </div>
            </Panel>
            <EffortTrend effort={data.effort} />
            <section className="overview-priorities" aria-labelledby="priorities-title">
              <div className="overview-section-header">
                <div className="panel-heading">
                  <Icon name="target" />
                  <div>
                    <h2 id="priorities-title">{t("Top 3 priorities")}</h2>
                    <p>{t("Most frequent errors in saved Grammar and Text feedback. One hit per diagnosis.")}</p>
                  </div>
                </div>
                <span className="overview-priority-window">{t("Last 30 days")}</span>
              </div>
              {unavailable.some((source) => source.source === "Saved writing") ? (
                <State
                  title={t("Priorities unavailable")}
                  detail={t("Saved writing could not be read. Refresh to try again.")}
                />
              ) : data.priorities.length ? (
                <ol className="overview-priority-list">
                  {data.priorities.map((item, index) => (
                    <li key={item.errorType}>
                      <span className="overview-priority-rank" aria-hidden="true">{index + 1}</span>
                      <h3>{item.errorType}</h3>
                      <span className="overview-priority-count">
                        {t(item.hits === 1 ? "{count} hit" : "{count} hits", { count: item.hits })}
                      </span>
                      {item.habit && <p>{t("Habit: {habit}", { habit: item.habit })}</p>}
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
            </section>

            <section className="overview-timeline" aria-label={t("Recent activity")}>
              <div className="overview-section-header overview-history-heading">
                <div className="panel-heading">
                  <Icon name="clock" />
                  <div><h2>{t("Recent activity")}</h2><p>{t("Your latest learning actions and results.")}</p></div>
                </div>
                <div className="overview-history-actions">
                  <a className="overview-link-action" href="#dashboard?view=practice-log">{t("Open practice log")}<Icon name="arrow" /></a>
                  <WindowSelect
                    days={days}
                    disabled={busy}
                    onChange={(days) => go("dashboard", { days, offset: 0 })}
                  />
                </div>
              </div>
              {data.events.length ? (
                <ol className="learning-timeline">
                  {data.events.map((event) => (
                    <li key={`${event.source}:${event.id}`}>
                      <time dateTime={event.timestamp} title={dateLabel(event.timestamp, t, event.precision)}>
                        {event.precision === "day" ? dateLabel(event.timestamp, t, event.precision) : relativeTime(event.timestamp, now, t) || dateLabel(event.timestamp, t)}
                      </time>
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

            <footer className="overview-coverage">
              <p>
                {t(
                  "Recorded effort and error frequency do not establish mastery. Unsaved tool use is not included. Vocabulary review history is excluded.",
                )}{" "}
                {data.undated > 0 &&
                  t("{count} undated record(s) omitted from recent activity.", { count: data.undated })}
              </p>
            </footer>
          </>
        )}
      </div>
    </div>
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
    const text = `# ${coachReportTitle}\n\nGenerated: ${report.generatedAt}\n\n${report.totalChecks} saved records; ${report.evidence.length} records supplied for analysis.\n\n${reportMarkdown}`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "english-proficiency-report.md"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="coach-page">
    <div className="coach-hero">
      <Heading eyebrow="Learning reports" title={coachReportTitle} detail="Understand your strengths, recurring language patterns, and the knowledge behind them in one evidence-based report to guide your next steps." />
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
    {!report && !busy && <State title="A report grounded in your Grammar and Practice records" detail="Review your proficiency, individual error patterns, underlying knowledge gaps and personalized improvement directions using saved Grammar checks and 02_Practice_Log. Only abilities supported by your writing are assessed; AI corrections and assisted answers do not establish mastery." />}
    {report && <Panel title={coachReportTitle} icon="document" className="coach-report">
      <div className="coach-report-meta">
        <span><Icon name="calendar" />{report.cached ? "Cached report" : "Generated on"} {new Date(report.generatedAt).toLocaleString()}</span>
        <span><Icon name="layers" />{report.sourceCounts?.grammar ?? report.totalChecks} grammar checks</span>
        <span><Icon name="ask" />{report.sourceCounts?.practice ?? 0} practice records</span>
        <span><Icon name="info" />{report.coverage.unclassified} unknown sources</span>
      </div>
      <div className="coach-report-provenance">
      {report.saveError && <p role="alert">{report.saveError}</p>}
      {report.sourceStatus && report.sourceStatus.practice !== "available" && <p className="handbook-evidence">Practice log: {report.sourceStatus.practice}. Practice evidence was not available for this report.</p>}
      {report.sourceStatus?.grammar === "unavailable" && <p className="handbook-evidence">Grammar records could not be read. This report uses available Practice evidence.</p>}
      </div>
      <Markdown source={reportMarkdown} />
    </Panel>}
      </div>
    </div>
  </div>;
}
