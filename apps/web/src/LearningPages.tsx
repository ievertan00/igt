import { useEffect, useRef, useState } from "react";
import { webApi, type CoachDetail, type CoachPatterns, type CoachReport, type CoachReportSummary, type LearningOverview } from "./api/client";
import { Heading, Panel, State } from "./Page";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { ModelSwitcher } from "./model-settings";
import { useGuideCopy } from "./learner-language";

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
  const [patterns, setPatterns] = useState(false);
  const [savedReports, setSavedReports] = useState<CoachReportSummary[]>([]);
  const [historyError, setHistoryError] = useState("");
  const sourceLabels = new Map(report?.evidence.map((item, index) => [item.entryId, `S${index + 1}`]));
  const reportMarkdown = report?.evidence.reduce((text, item) => text.replaceAll(item.entryId, sourceLabels.get(item.entryId)!), report.markdown) || "";
  const request = useRef(0);
  useEffect(() => {
    request.current++; setReport(undefined); setBusy(false); setError("");
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
      if (id === request.current) setReport(result);
    } catch { if (id === request.current) setError("The saved report could not be opened. Refresh the list and try again."); }
    finally { if (id === request.current) setBusy(false); }
  }
  async function generate() {
    const id = ++request.current;
    setBusy(true); setError("");
    try {
      const result = await webApi.generateCoachReport(days, language, Boolean(report));
      if (id === request.current) { setReport(result); void loadSavedReports(); }
    } catch (err) {
      if (id === request.current) setError(err instanceof Error ? err.message : "Could not generate the report. Please try again.");
    } finally { if (id === request.current) setBusy(false); }
  }
  function download() {
    if (!report) return;
    const text = `# Learning report\n\nGenerated: ${report.generatedAt}\n\n${report.totalChecks} saved checks; ${report.evidence.length} sampled records.\n\n${reportMarkdown}\n\n## Source records\n\n${report.evidence.filter(e => report.evidenceIds.includes(e.entryId)).map(e => `### ${sourceLabels.get(e.entryId)} · ${e.timestamp}\n\nOriginal: ${e.original}\n\nSaved correction (unverified): ${e.correction}`).join("\n\n")}`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "learning-report.md"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="coach-page">
    <Heading eyebrow="COACH" title="Your learning report" detail="Understand the patterns in your writing, review the evidence, and choose what to practise next." />
    <div className="handbook-filters">
      <WindowSelect days={days} disabled={busy} onChange={days => go("coach", { days })} />
      <label>Report language <select value={language} disabled={busy} onChange={e => setLanguage(e.target.value)}><option value="zh-CN">中文</option><option value="en">English</option></select></label>
      <ModelSwitcher role="pro" disabled={busy} />
      <button className="primary" disabled={busy} onClick={() => void generate()}>{busy ? "Generating report…" : report ? "Regenerate report" : "Generate learning report"}</button>
      {report && <button className="secondary" onClick={download}>Download Markdown</button>}
    </div>
    {error && <p role="alert">{error}</p>}
    <details><summary>Saved reports</summary>
      <button className="secondary" disabled={busy} onClick={() => void loadSavedReports()}>Refresh saved reports</button>
      {historyError && <p role="alert">{historyError}</p>}
      {!historyError && !savedReports.filter(item => item.days === days && item.language === language).length && <p>No saved reports for this language and time window yet.</p>}
      <ul>{savedReports.filter(item => item.days === days && item.language === language).map(item => <li key={item.savedId}><button className="secondary" disabled={busy} onClick={() => void openSaved(item.savedId)}>{new Date(item.generatedAt).toLocaleString()} · {item.totalChecks} checks</button></li>)}</ul>
    </details>
    {busy && <p role="status">Reviewing saved sentences and feedback. This may take a few minutes.</p>}
    {!report && !busy && <State title="A report grounded in your saved Grammar checks" detail="Generate an analysis of recurring mechanisms, possible causes, feedback quality and a suggested study sequence. Saved corrections are reviewed as evidence, not treated as standard answers." />}
    {report && <Panel title="Learning report" className="coach-report">
      {report.savedPath && <p className="handbook-evidence">Saved locally: {report.savedPath}</p>}
      {report.saveError && <p role="alert">{report.saveError}</p>}
      <p className="handbook-evidence">{report.totalChecks} saved Grammar checks · {report.evidence.length} records supplied to the model · {report.sampled ? "Chronological sample" : "All checks in this window"} · {report.duplicateInputs} repeated inputs · {report.cached ? "Cached report" : "Generated"} {new Date(report.generatedAt).toLocaleString()}</p>
      <p className="handbook-evidence">{report.coverage.unclassified} records with unknown sources and {report.coverage.excludedOtherSources} full-text records excluded; {report.coverage.undated} records have no usable date. Suggestions and possible causes need validation through practice.</p>
      <Markdown source={reportMarkdown} />
      {report.truncated && <p className="handbook-evidence">Long records and feedback were shortened for analysis. Open the saved checks to read the full records.</p>}
      <details><summary>Source records cited in this report</summary>{report.evidence.filter(e => report.evidenceIds.includes(e.entryId)).map(e => <section key={e.entryId}><h3>{sourceLabels.get(e.entryId)} · {e.timestamp}</h3><p>{e.original}</p><p>Saved correction (unverified): {e.correction || "None"}</p><a href={`#handbook?entry=${encodeURIComponent(e.entryId)}&days=${days}`}>Open saved check</a></section>)}</details>
    </Panel>}
    <button className="secondary" aria-expanded={patterns} onClick={() => setPatterns(!patterns)}>{patterns ? "Hide pattern explorer" : "Explore individual patterns"}</button>
    {patterns && <CoachPatternsView />}
  </div>;
}

function CoachPatternsView() {
  const { t } = useGuideCopy();
  const days = windowDays(90),
    selected = params().get("errorType") || "";
  const [data, setData] = useState<CoachPatterns>();
  const [detail, setDetail] = useState<CoachDetail>();
  const [busy, setBusy] = useState(true),
    [explaining, setExplaining] = useState(false);
  const [error, setError] = useState(""),
    [detailError, setDetailError] = useState("");
  const listRequest = useRef(0),
    detailRequest = useRef(0);
  async function load() {
    const id = ++listRequest.current;
    setBusy(true);
    setError("");
    try {
      const result = await webApi.getCoach(days);
      if (id === listRequest.current) setData(result);
    } catch {
      if (id === listRequest.current)
        setError("Your saved Grammar checks could not be analysed. Please try again.");
    } finally {
      if (id === listRequest.current) setBusy(false);
    }
  }
  const pattern =
    data?.days === days ? data.patterns.find((item) => item.errorType === selected) : undefined;
  async function explain(refresh = false) {
    if (!pattern) return;
    const id = ++detailRequest.current;
    setExplaining(true);
    setDetailError("");
    try {
      const result = await webApi.explainCoach(selected, days, pattern.version, refresh);
      if (id === detailRequest.current) setDetail(result);
    } catch (error) {
      if (id === detailRequest.current)
        setDetailError(
          error instanceof Error ? error.message : "The explanation could not be generated.",
        );
    } finally {
      if (id === detailRequest.current) setExplaining(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      listRequest.current++;
    };
  }, [days]);
  useEffect(() => {
    setDetail(undefined);
    setDetailError("");
    setExplaining(false);
    if (pattern) void explain();
    return () => {
      detailRequest.current++;
    };
  }, [days, selected, pattern?.version]);
  return (
    <div className="coach-page">
      <div className="coach-header">
        <Heading
          eyebrow="COACH"
          title="Understand your recurring mistakes."
          detail={t(
            "Find patterns in your saved Grammar checks, explore possible causes, and learn the grammar principles behind the corrections.",
          )}
        />
        <button className="secondary" disabled={busy || explaining} onClick={() => void load()}>
          {busy ? t("Loading…") : t("Refresh patterns")}
        </button>
      </div>
      <div className="handbook-filters">
        <WindowSelect days={days} disabled={busy} onChange={(days) => go("coach", { days })} />
      </div>
      {error && (
        <div role="alert">
          <State title={t("Coach is unavailable")} detail={error} />
          <button onClick={() => void load()}>{t("Try again")}</button>
        </div>
      )}
      <div aria-busy={busy}>
        {busy && <p role="status">{t("Reading saved checks…")}</p>}
        {data && (
          <>
            <p className="handbook-evidence">
              {t(
                "Based on {checks} saved Grammar check(s) {window}. A recurring pattern needs at least two distinct checks.",
                {
                  checks: data.checks,
                  window: data.days
                    ? t("in the last {days} days", { days: data.days })
                    : t("across all history"),
                },
              )}
            </p>
            {data.coverage.unclassified > 0 && (
              <p className="handbook-evidence">
                {t(
                  "{count} historical record(s) have no identified source and are excluded. Your original records are preserved.",
                  { count: data.coverage.unclassified },
                )}
              </p>
            )}
            {data.patterns.length ? (
              <Panel title={t("Recurring mistakes")}>
                <div className="coach-patterns">
                  {data.patterns.map((item) => (
                    <button
                      key={item.errorType}
                      aria-expanded={selected === item.errorType}
                      aria-controls="coach-explanation"
                      disabled={busy}
                      onClick={() =>
                        go("coach", {
                          days,
                          errorType: selected === item.errorType ? "" : item.errorType,
                        })
                      }
                    >
                      <div className="coach-pattern-main">
                        <span
                          className={`coach-priority-badge coach-priority-${item.priorityArea?.toLowerCase().replace(/\s+/g, "-") || "other"}`}
                        >
                          {item.priorityArea || "Other"}
                        </span>
                        <strong>{item.errorType}</strong>
                      </div>
                      <span>
                        {t("{checks} affected checks", { checks: item.checks })} ·{" "}
                        {t("{observations} observations", { observations: item.observations })}
                      </span>
                    </button>
                  ))}
                </div>
              </Panel>
            ) : (
              <Panel title={t("No recurring pattern yet.")}>
                <p>
                  {t(
                    "Keep saving Grammar checks. A single correction does not establish a recurring difficulty.",
                  )}
                </p>
                <a href="#handbook">{t("Browse saved checks")}</a>
              </Panel>
            )}
            {selected && !pattern && !busy && (
              <State
                title={t("This pattern is not available in the selected window.")}
                detail={t("Choose a listed pattern or a longer time window.")}
              />
            )}
            {selected && pattern && (
              <section
                id="coach-explanation"
                className="panel"
                aria-busy={explaining}
                aria-label={`${selected} explanation`}
              >
                <div className="panel-heading">
                  <h2>{selected}</h2>
                </div>
                {explaining && (
                  <p role="status">{t("Generating an explanation from your saved checks…")}</p>
                )}
                {detailError && (
                  <div role="alert">
                    <p>{detailError}</p>
                    <button disabled={explaining} onClick={() => void explain()}>
                      {t("Try explanation again")}
                    </button>
                  </div>
                )}
                {detail && detail.errorType === selected && detail.days === days && (
                  <>
                    <Markdown source={detail.explanation.observedPattern} />
                    {detail.explanation.keyStructure && (
                      <div className="coach-key-structure">
                        <span className="coach-key-label">{t("Key structure")}</span>
                        <code>{detail.explanation.keyStructure}</code>
                      </div>
                    )}
                    <section className="learning-explanation">
                      <h3>{t("Possible causes")}</h3>
                      <p className="handbook-evidence">
                        {t(
                          "These are hypotheses based on your records, not confirmed psychological causes.",
                        )}
                      </p>
                      {detail.explanation.possibleCauses.map((cause, index) => (
                        <div key={index}>
                          <Markdown source={cause.hypothesis} />
                          <p className="handbook-evidence">
                            {t("Supporting checks:")}{" "}
                            {cause.evidenceIds.map((id) => (
                              <a key={id} href={`#handbook?days=0&entry=${encodeURIComponent(id)}`}>
                                {id}{" "}
                              </a>
                            ))}
                          </p>
                        </div>
                      ))}
                    </section>
                    <section className="learning-explanation">
                      <h3>{t("Grammar principle")}</h3>
                      <Markdown source={detail.explanation.principle} />
                      <h4>{t("Context and exceptions")}</h4>
                      <Markdown source={detail.explanation.qualifications} />
                    </section>
                    <section className="learning-explanation">
                      <h3>{t("From your saved checks")}</h3>
                      {detail.explanation.examples.map((example, index) => {
                        const evidence = detail.evidence.find(
                          (item) => item.entryId === example.entryId,
                        );
                        return (
                          <article key={index} className="handbook-example">
                            <p lang="en">
                              {t("Original:")} {evidence?.original}
                            </p>
                            <p lang="en">
                              {t("Correction:")} {evidence?.correction || t("No correction saved")}
                            </p>
                            <Markdown source={example.explanation} />
                            <a
                              href={`#handbook?days=0&entry=${encodeURIComponent(example.entryId)}`}
                            >
                              {t("Open saved check")}
                            </a>
                          </article>
                        );
                      })}
                    </section>
                    {detail.explanation.relatedStructures?.length > 0 && (
                      <section className="learning-explanation">
                        <h3>{t("Practise together")}</h3>
                        <Markdown
                          source={t(
                            "These structures are worth practising alongside this one — learning to distinguish them builds more durable knowledge.",
                          )}
                        />
                        <ul className="coach-related-list">
                          {detail.explanation.relatedStructures.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </section>
                    )}
                    {detail.explanation.drills && (
                      <section className="coach-drills-section">
                        <h3>{t("Practice drills")}</h3>
                        <Markdown
                          source={t(
                            "Three-phase practice: self-correct → transfer to new context → recall tomorrow. Work through each phase without looking ahead.",
                          )}
                        />
                        {detail.explanation.drills.phase1_selfCorrect?.length > 0 && (
                          <details className="coach-drill">
                            <summary>
                              <span className="coach-drill-phase">{t("Phase 1")}</span>{" "}
                              {t("Self-correct ({count} items)", {
                                count: detail.explanation.drills.phase1_selfCorrect.length,
                              })}
                            </summary>
                            <div className="coach-drill-body">
                              {detail.explanation.drills.phase1_selfCorrect.map((item, i) => (
                                <div key={i} className="coach-drill-item">
                                  <Markdown source={item.incorrect} />
                                  <details>
                                    <summary>{t("Reveal hint")}</summary>
                                    <Markdown source={item.hint} />
                                  </details>
                                  <details>
                                    <summary>{t("Reveal answer")}</summary>
                                    <Markdown source={item.answer} />
                                  </details>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                        {detail.explanation.drills.phase2_transfer?.length > 0 && (
                          <details className="coach-drill">
                            <summary>
                              <span className="coach-drill-phase">{t("Phase 2")}</span>{" "}
                              {t("New context ({count} items)", {
                                count: detail.explanation.drills.phase2_transfer.length,
                              })}
                            </summary>
                            <div className="coach-drill-body">
                              {detail.explanation.drills.phase2_transfer.map((item, i) => (
                                <div key={i} className="coach-drill-item">
                                  <Markdown source={item.prompt} />
                                  <details>
                                    <summary>{t("Structure hint")}</summary>
                                    <Markdown source={item.structureHint} />
                                  </details>
                                  <details>
                                    <summary>{t("Reveal answer")}</summary>
                                    <Markdown source={item.answer} />
                                  </details>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                        {detail.explanation.drills.phase3_delayedRecall?.length > 0 && (
                          <details className="coach-drill">
                            <summary>
                              <span className="coach-drill-phase">{t("Phase 3")}</span>{" "}
                              {t("Recall tomorrow ({count} intents)", {
                                count: detail.explanation.drills.phase3_delayedRecall.length,
                              })}
                            </summary>
                            <div className="coach-drill-body">
                              {detail.explanation.drills.phase3_delayedRecall.map((item, i) => (
                                <div key={i} className="coach-drill-item">
                                  <Markdown source={item.intent} />
                                  <Markdown source={`Use: ${item.structureUsed}`} />
                                </div>
                              ))}
                            </div>
                            <Markdown
                              source={t(
                                "No answers — try these tomorrow without looking back at today's work.",
                              )}
                            />
                          </details>
                        )}
                      </section>
                    )}
                    {detail.sampled && (
                      <p className="handbook-evidence">
                        {t("This explanation uses a sample of the pattern's saved checks.")}
                      </p>
                    )}
                    <p className="handbook-evidence">
                      {t("Generated explanation")} ·{" "}
                      {detail.cached
                        ? t("Reused from matching evidence")
                        : t("Generated on request")}
                      . {t("Saved feedback is unchanged.")}
                    </p>
                    <button
                      className="secondary"
                      disabled={explaining}
                      onClick={() => void explain(true)}
                    >
                      {t("Regenerate explanation")}
                    </button>
                  </>
                )}
              </section>
            )}
            <p className="handbook-evidence">
              {t(
                "Mistake frequency and generated explanations do not establish durable mastery or overall English ability.",
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
