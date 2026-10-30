import { useEffect, useRef, useState } from "react";
import { webApi, type CoachDetail, type CoachPatterns, type LearningOverview } from "./api/client";
import { Heading, Panel, State } from "./Page";
import { Icon } from "./Icon";

const params = () => new URLSearchParams(location.hash.split("?")[1] || "");
function windowDays(fallback: number) {
  const value = Number(params().get("days") ?? fallback);
  return Number.isInteger(value) && value >= 0 && value <= 3650 ? value : fallback;
}
function go(route: string, values: Record<string, string | number>) { location.hash = `#${route}?${new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)]))}`; }
function dateLabel(value: string, precision?: string) {
  if (!Number.isFinite(Date.parse(value))) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", ...(precision === "day" ? {} : { timeStyle: "short" as const }), timeZone: "Asia/Shanghai" }).format(new Date(value)) + (precision === "day" ? " · date only" : " · Beijing time");
}
function relativeTime(value: string, now: number) {
  const ms = now - Date.parse(value);
  if (!Number.isFinite(ms) || ms < 0) return "";
  const minutes = Math.floor(ms / 60000), hours = Math.floor(minutes / 60), days = Math.floor(hours / 24);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return dateLabel(value);
}
function WindowSelect({ days, onChange, disabled }: { days: number; onChange: (days: number) => void; disabled: boolean }) {
  return <label>Time window<select value={days} disabled={disabled} onChange={event => onChange(Number(event.target.value))}>
    {![0, 30, 90].includes(days) && <option value={days}>Last {days} days</option>}
    <option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={0}>All history</option>
  </select></label>;
}

const activityBadge: Record<string, string> = {
  grammar: "Grammar", text: "Text analysis", writing: "Writing",
  practice: "Practice", vocabulary: "Saved word", ask: "Ask", other: "Other",
};

function EffortTrend({ effort }: { effort: LearningOverview["effort"] }) {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const series = period === "daily" ? effort.daily.map(day => ({ date: day.date, label: day.label, count: day.count }))
    : effort[period].map(item => ({ date: item.start, label: new Intl.DateTimeFormat("en", { month: "short", ...(period === "weekly" ? { day: "numeric" as const } : {}), timeZone: "UTC" }).format(new Date(`${item.start}T00:00:00Z`)), count: item.count }));
  const max = Math.max(1, ...series.map(day => day.count));
  const momentum = effort.momentum;
  const periodLabel = period === "daily" ? "Last 7 days" : period === "weekly" ? "Last 4 weeks" : "Last 6 months";
  return <section className="overview-effort" aria-labelledby="effort-title">
    <div className="panel-heading"><h2 id="effort-title">Effort trend</h2>
      <div className="overview-chart-controls" role="group" aria-label="Effort period">{([['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']] as const).map(([value, label]) => <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>)}</div>
    </div>
    <p className="overview-chart-caption"><span>{periodLabel}</span><span>Sentences · zero baseline</span></p>
    <ol className="overview-daily" aria-label={`${period} sentence totals`}>{series.map((day, index) => <li key={day.date} className={index === series.length - 1 ? "is-current" : ""}>
      <span className="overview-chart-value">{day.count}<span className="sr-only"> sentences</span></span><span className="overview-bar" aria-hidden="true"><span style={{ height: `${day.count / max * 100}%` }} /></span>
      <time dateTime={day.date} title={day.date}>{period === "daily" ? <><span>{index === series.length - 1 ? "Today" : day.label.split(" ").at(-1)}</span><span className="overview-chart-date">{day.date.slice(5).replace("-", "/")}</span></> : <><span>{day.label}</span>{index === series.length - 1 && <span className="overview-chart-date">Current</span>}</>}</time>
    </li>)}</ol>
    <p className="overview-momentum"><strong>Weekly momentum: {momentum.percent == null ? (momentum.current ? "No previous-week baseline" : "No activity in either week") : `${momentum.percent > 0 ? "+" : ""}${momentum.percent}%`}</strong><span>{momentum.current} sentences in the last 7 days vs {momentum.previous} in the previous 7 days.</span></p>
    <details className="overview-counting"><summary><Icon name="info" />How effort is counted<Icon name="chevron" /></summary><p className="handbook-evidence">Beijing dates. Weeks start Monday; current week and month are partial. Saved Grammar/Text sentences and Sentence Practice attempts count as effort. Repeat work counts again; vocabulary reviews do not count.</p></details>
  </section>;
}

export function Dashboard() {
  const days = windowDays(30);
  const rawOffset = Number(params().get("offset") || 0);
  const offset = Number.isSafeInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const [data, setData] = useState<LearningOverview>();
  const [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const request = useRef(0);
  async function load() {
    const id = ++request.current; setBusy(true); setError("");
    try { const result = await webApi.getDashboard({ days, offset, limit: 5 }); if (id === request.current) { setData(result); setNow(Date.now()); } }
    catch { if (id === request.current) setError("Your learning activity could not be loaded. Please try again."); }
    finally { if (id === request.current) setBusy(false); }
  }
  useEffect(() => { void load(); return () => { request.current++; }; }, [days, offset]);
  const inventory = data?.coverage.find(source => source.status === "inventory");
  const unavailable = data?.coverage.filter(source => source.status === "unavailable") || [];
  const amount = (value: number, singular: string, plural = `${singular}s`) => `${value} ${value === 1 ? singular : plural}`;

  const quickLinks = [
    { href: "#word-library", label: "Saved words", detail: inventory?.count != null ? amount(inventory.count, "word") : "Browse your library" },
    { href: `#handbook?days=0`, label: "Grammar corrections", detail: "Your saved sentences and feedback" },
    { href: "#ask?view=notes", label: "Ask notes", detail: "Explanations you kept" },
  ];

  return <div className="overview-page">
    <div className="overview-header">
      <div className="overview-header-main">
        <Heading eyebrow="OVERVIEW" title="Your effort. Your next focus." detail="See your sentence work over time and the mistakes to give attention to next." />
        <button className="secondary" disabled={busy} onClick={() => void load()}>{busy ? "Loading…" : "Refresh"}</button>
      </div>
    </div>
    {error && <div role="alert"><State title="Overview is unavailable" detail={error} />{data && <p>Previously loaded activity remains below.</p>}<button onClick={() => void load()}>Try again</button></div>}
    <div aria-busy={busy}>{busy && <p role="status">Loading recorded activity…</p>}
      {data && <>
        {unavailable.length > 0 && <p role="status" className="overview-notice">Some activity could not be read: {unavailable.map(source => source.source).join(", ")}. Counts may be incomplete.</p>}

        <div className="overview-insights">
          <EffortTrend effort={data.effort} />
          <section className="overview-priorities" aria-labelledby="priorities-title">
            <div className="panel-heading"><h2 id="priorities-title">Top 3 priorities</h2><span className="overview-timeline-range">Last 30 days</span></div>
            <p className="handbook-evidence">Most frequent error types in saved Grammar and Text feedback. Each diagnosis counts as one hit.</p>
            {unavailable.some(source => source.source === "Saved writing") ? <State title="Priorities unavailable" detail="Saved writing could not be read. Refresh to try again." /> : data.priorities.length ? <ol className="overview-priority-list">{data.priorities.map(item => <li key={item.errorType}><div><h3>{item.errorType}</h3><span>{item.hits} {item.hits === 1 ? "hit" : "hits"}</span></div>{item.habit && <p>Habit: {item.habit}</p>}</li>)}</ol> : <div className="overview-priority-empty"><Icon name="coach" /><State title="No error types recorded in the last 30 days." detail="Save feedback from Grammar or Text analysis to see what needs attention." /></div>}
            <a className="primary" href="#practice">Practise sentences<Icon name="arrow" /></a>
          </section>
        </div>

        <div className="overview-library-grid"><section className="overview-timeline" aria-label="Recent activity">
          <div className="panel-heading overview-history-heading"><h2>Recent activity</h2><WindowSelect days={days} disabled={busy} onChange={days => go("dashboard", { days, offset: 0 })} /></div>
          {data.events.length ? <ol className="learning-timeline">{data.events.map(event => <li key={`${event.source}:${event.id}`}>
            <span className={`learning-badge learning-badge-${event.type}`}>{activityBadge[event.type] || "Record"}</span>
            <div className="learning-event-body">
              {event.title.length > 160
                ? <details><summary>{event.title.slice(0, 140)}…</summary><p>{event.title}</p>{event.href && <a href={event.href}>Open record</a>}</details>
                : <p>{event.href ? <a href={event.href}>{event.title}</a> : event.title}</p>}
              <time dateTime={event.timestamp}>{relativeTime(event.timestamp, now)}</time>
            </div>
          </li>)}</ol> : <State title={offset > 0 ? "No records on this page." : "No recent activity in this window."} detail={offset > 0 ? "Go to the previous page to see earlier records." : "Complete a practice or save some feedback — it will appear here."} />}
          {(data.pagination.total > 0 || offset > 0) && <nav className="handbook-pagination" aria-label="Activity pages"><span>{data.events.length ? `${offset + 1}–${offset + data.events.length} of ${data.pagination.total}` : `${data.pagination.total} records`}</span><button disabled={busy || offset === 0} onClick={() => go("dashboard", { days, offset: Math.max(0, offset - data.pagination.limit) })}>Previous</button><button disabled={busy || !data.pagination.hasMore} onClick={() => go("dashboard", { days, offset: offset + data.pagination.limit })}>Next</button></nav>}
        </section>

        <section className="overview-quick" aria-label="Saved material">
          <div className="panel-heading"><h2>Your saved material</h2></div>
          <div className="overview-quick-links">{quickLinks.map((link, index) => <a key={link.href} href={link.href} className="overview-quick-link"><Icon name={index === 0 ? "word-library" : index === 1 ? "grammar" : "bookmark"} /><span className="overview-link-copy"><strong>{link.label}</strong><span>{link.detail}</span></span><Icon name="arrow" /></a>)}</div>
        </section></div>

        <footer className="overview-coverage">
          <p>Recorded effort and error frequency do not establish mastery. Unsaved tool use is not included. Vocabulary review history is excluded. {data.undated > 0 && `${data.undated} undated record(s) excluded.`}</p>
        </footer>
      </>}
    </div>
  </div>;
}

export function Coach() {
  const days = windowDays(90), selected = params().get("errorType") || "";
  const [data, setData] = useState<CoachPatterns>();
  const [detail, setDetail] = useState<CoachDetail>();
  const [busy, setBusy] = useState(true), [explaining, setExplaining] = useState(false);
  const [error, setError] = useState(""), [detailError, setDetailError] = useState("");
  const listRequest = useRef(0), detailRequest = useRef(0);
  async function load() {
    const id = ++listRequest.current; setBusy(true); setError("");
    try { const result = await webApi.getCoach(days); if (id === listRequest.current) setData(result); }
    catch { if (id === listRequest.current) setError("Your saved Grammar checks could not be analysed. Please try again."); }
    finally { if (id === listRequest.current) setBusy(false); }
  }
  const pattern = data?.days === days ? data.patterns.find(item => item.errorType === selected) : undefined;
  async function explain(refresh = false) {
    if (!pattern) return;
    const id = ++detailRequest.current; setExplaining(true); setDetailError("");
    try { const result = await webApi.explainCoach(selected, days, pattern.version, refresh); if (id === detailRequest.current) setDetail(result); }
    catch (error) { if (id === detailRequest.current) setDetailError(error instanceof Error ? error.message : "The explanation could not be generated."); }
    finally { if (id === detailRequest.current) setExplaining(false); }
  }
  useEffect(() => { void load(); return () => { listRequest.current++; }; }, [days]);
  useEffect(() => {
    setDetail(undefined); setDetailError(""); setExplaining(false);
    if (pattern) void explain();
    return () => { detailRequest.current++; };
  }, [days, selected, pattern?.version]);
  return <div className="coach-page">
    <div className="coach-header"><Heading eyebrow="COACH" title="Understand your recurring mistakes." detail="Find patterns in your saved Grammar checks, explore possible causes, and learn the grammar principles behind the corrections." /><button className="secondary" disabled={busy || explaining} onClick={() => void load()}>{busy ? "Loading…" : "Refresh patterns"}</button></div>
    <div className="handbook-filters"><WindowSelect days={days} disabled={busy} onChange={days => go("coach", { days })} /></div>
    {error && <div role="alert"><State title="Coach is unavailable" detail={error} /><button onClick={() => void load()}>Try again</button></div>}
    <div aria-busy={busy}>{busy && <p role="status">Reading saved checks…</p>}{data && <>
      <p className="handbook-evidence">Based on {data.checks} saved Grammar check(s) {data.days ? `in the last ${data.days} days` : "across all history"}. A recurring pattern needs at least two distinct checks.</p>
      {data.coverage.unclassified > 0 && <p className="handbook-evidence">{data.coverage.unclassified} historical record(s) have no identified source and are excluded. Your original records are preserved.</p>}
      {data.patterns.length ? <Panel title="Recurring mistakes"><div className="coach-patterns">{data.patterns.map(item => <button key={item.errorType} aria-expanded={selected === item.errorType} aria-controls="coach-explanation" disabled={busy} onClick={() => go("coach", { days, errorType: selected === item.errorType ? "" : item.errorType })}><strong>{item.errorType}</strong><span>{item.checks} affected checks · {item.observations} observations</span></button>)}</div></Panel> : <Panel title="No recurring pattern yet."><p>Keep saving Grammar checks. A single correction does not establish a recurring difficulty.</p><a href="#handbook">Browse saved checks</a></Panel>}
      {selected && !pattern && !busy && <State title="This pattern is not available in the selected window." detail="Choose a listed pattern or a longer time window." />}
      {selected && pattern && <section id="coach-explanation" className="panel" aria-busy={explaining} aria-label={`${selected} explanation`}>
        <div className="panel-heading"><h2>{selected}</h2></div>
        {explaining && <p role="status">Generating an explanation from your saved checks…</p>}
        {detailError && <div role="alert"><p>{detailError}</p><button disabled={explaining} onClick={() => void explain()}>Try explanation again</button></div>}
        {detail && detail.errorType === selected && detail.days === days && <>
          <p>{detail.explanation.observedPattern}</p>
          <section className="learning-explanation"><h3>Possible causes</h3><p className="handbook-evidence">These are hypotheses based on your records, not confirmed psychological causes.</p>{detail.explanation.possibleCauses.map((cause, index) => <div key={index}><p>{cause.hypothesis}</p><p className="handbook-evidence">Supporting checks: {cause.evidenceIds.map(id => <a key={id} href={`#handbook?days=0&entry=${encodeURIComponent(id)}`}>{id} </a>)}</p></div>)}</section>
          <section className="learning-explanation"><h3>Grammar principle</h3><p>{detail.explanation.principle}</p><h4>Context and exceptions</h4><p>{detail.explanation.qualifications}</p></section>
          <section className="learning-explanation"><h3>From your saved checks</h3>{detail.explanation.examples.map((example, index) => { const evidence = detail.evidence.find(item => item.entryId === example.entryId); return <article key={index} className="handbook-example"><p lang="en">Original: {evidence?.original}</p><p lang="en">Correction: {evidence?.correction || "No correction saved"}</p><p>{example.explanation}</p><a href={`#handbook?days=0&entry=${encodeURIComponent(example.entryId)}`}>Open saved check</a></article>; })}</section>
          {detail.sampled && <p className="handbook-evidence">This explanation uses a sample of the pattern’s saved checks.</p>}
          <p className="handbook-evidence">Generated explanation · {detail.cached ? "Reused from matching evidence" : "Generated on request"}. Saved feedback is unchanged.</p>
          <button className="secondary" disabled={explaining} onClick={() => void explain(true)}>Regenerate explanation</button>
        </>}
      </section>}
      <p className="handbook-evidence">Mistake frequency and generated explanations do not establish durable mastery or overall English ability.</p>
    </>}</div>
  </div>;
}
