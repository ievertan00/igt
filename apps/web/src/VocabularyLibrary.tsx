import { useGuideCopy } from "./learner-language";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { webApi } from "./api/client";
import { Icon } from "./Icon";
import "./VocabularyLibrary.css";

export type SavedVocabularyEntry = {
  id: string; word: string; pos: string; phonetic: string; meaning: string; zh: string;
  synonyms: string; collocations: string; example: string; example2: string; example3: string;
  note: string; memory: string; added: string | null;
  srs?: { id: number; due_date: string | null; total_reviews: number; last_reviewed: string | null; interval_days: number } | null;
  learningStatus?: string; recordedReviews?: number;
};
export type VocabularyLibraryResult = {
  words: SavedVocabularyEntry[]; total: number; totalSaved: number; sourceAvailable: boolean;
  limit: number; offset: number; hasMore: boolean;
  overview?: { due: number; overdue: number; dueToday: number; retained: number; wellRetained: number; distribution: Record<string, number> } | null; today?: string;
};

const learningStatuses = ["new", "learning", "needs-reinforcement", "retained", "well-retained", "insufficient-history"];
const statusLabels: Record<string, string> = { new: "New", learning: "Learning", "needs-reinforcement": "Needs reinforcement", retained: "Retained",
  "well-retained": "Well retained", "insufficient-history": "Insufficient history", unavailable: "Status unavailable" };
const statusDescriptions: Record<string, string> = { new: "Not yet reviewed", learning: "Building recall", "needs-reinforcement": "Requires more practice",
  retained: "Consecutive successful recall", "well-retained": "Recall after a longer interval", "insufficient-history": "More evidence needed" };
const statusHelp: Record<string, string> = {
  new: "No reviews have been recorded for this review card.", learning: "Recall evidence is accumulating, or the latest correct recall used audio assistance.",
  "needs-reinforcement": "The latest recorded typed recall was incorrect, regardless of the selected rating.",
  retained: "Consecutive correct recalls without audio assistance on at least two separate days.",
  "well-retained": "Consecutive correct recalls without audio assistance, with at least 7 actual days between the latest two reviews.",
  "insufficient-history": "Detailed recall evidence is missing, incomplete, older than the latest review, or cannot be uniquely linked to this entry.",
  unavailable: "Review information could not be loaded. Your saved content is available.",
};
function scheduleLabel(due: string | null | undefined, today?: string) {
  if (!due) return "Not scheduled";
  const now = today || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const days = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${now}T00:00:00Z`)) / 86400000);
  return days < 0 ? `Overdue by ${-days} day${days === -1 ? "" : "s"}` : days === 0 ? "Due today" : `Review in ${days} day${days === 1 ? "" : "s"}`;
}
export type VocabularyHistoryResult = {
  records: { id: number; created_at: string; learner_answer: string; reference_answer: string; feedback: string }[];
  total: number; offset: number; hasMore: boolean;
};
function StatusGuide() {
  const { t } = useGuideCopy();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousScrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    dialogRef.current?.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = previousOverflow; window.scrollTo({ top: previousScrollY, behavior: "instant" }); };
  }, [open]);
  return <>
    <button ref={triggerRef} type="button" className="vocabulary-status-guide-trigger" aria-haspopup="dialog" aria-controls="vocabulary-status-guide" onClick={() => setOpen(true)}><Icon name="info" />{t("About statuses")}</button>
    <dialog ref={dialogRef} id="vocabulary-status-guide" className="saved-word-dialog vocabulary-status-guide-dialog" aria-labelledby="vocabulary-status-guide-title"
      onKeyDown={event => { if (event.key === "Tab") { event.preventDefault(); closeRef.current?.focus(); } }}
      onClose={() => { setOpen(false); triggerRef.current?.focus({ preventScroll: true }); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
      }}>
      <header className="saved-word-dialog-header">
        <h2 id="vocabulary-status-guide-title">{t("About statuses")}</h2>
        <button ref={closeRef} type="button" className="secondary" onClick={() => dialogRef.current?.close()}><Icon name="close" />Close</button>
      </header>
      <div className="vocabulary-status-guide-body">
        <p>{t("Learning statuses describe recorded recall evidence, not complete mastery. Review schedules are tracked separately.")}</p>
        <dl>{learningStatuses.map(key => <div key={key} data-learning-status={key}><dt className="word-learning-label"><i aria-hidden="true" />{statusLabels[key]}</dt><dd>{t(statusHelp[key])}</dd></div>)}</dl>
        <p>{t("Classification depends on available history. Ratings and scheduled intervals alone do not establish retention.")}</p>
      </div>
    </dialog>
  </>;
}
export function VocabularyLibrary({ renderDetails }: { renderDetails: (entry: SavedVocabularyEntry) => ReactNode }) {
  const { t } = useGuideCopy();
  const [sort, setSort] = useState("az");
  const [schedule, setSchedule] = useState("all");
  const [status, setStatus] = useState("all");
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<VocabularyLibraryResult>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SavedVocabularyEntry | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const limit = 25;
  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    const previousScrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = previousOverflow; window.scrollTo({ top: previousScrollY, behavior: "instant" }); };
  }, [selected]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true); setError("");
    const timer = window.setTimeout(() => {
      webApi.listVocabularyWords({ search: "", sort, schedule, status, offset, limit }, controller.signal)
        .then(result => { if (active) setData(result); })
        .catch((error: Error) => { if (active) setError(error.message); })
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [sort, schedule, status, offset, reload]);

  const page = data ? Math.floor(data.offset / limit) + 1 : 1;
  const pages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;
  const filtered = schedule !== "all" || status !== "all";
  const clearFilters = () => { setSchedule("all"); setStatus("all"); setOffset(0); };
  const filterStatus = (value: string) => { setStatus(value); setOffset(0); };
  return (
    <div className="vocabulary-library">
      <header className="vocabulary-library-header">
        <div className="vocabulary-library-title">
          <span className="vocabulary-library-mark" aria-hidden="true"><Icon name="handbook" /></span>
          <div><h1>Saved words</h1><p>Your vocabulary, ready to revisit.</p></div>
        </div>
        <a className="primary" href="#word-review">{t("Review due words")}<Icon name="arrow" /></a>
      </header>
      <section className="vocabulary-overview" aria-labelledby="vocabulary-overview-title" aria-busy={loading}>
        <div className="vocabulary-overview-heading">
          <div><h2 id="vocabulary-overview-title">Vocabulary overview</h2><p>Your vocabulary learning at a glance.</p></div>
          <StatusGuide />
        </div>
        <div className="vocabulary-overview-totals">
        {[
          { label: "Saved words", value: data?.sourceAvailable ? data.totalSaved : undefined, help: "Total in library", active: schedule === "all" && status === "all", onClick: clearFilters },
          { label: t("Due for review"), value: data?.overview?.due, help: data?.overview ? `${data.overview.overdue} overdue · ${data.overview.dueToday} today` : "Today and overdue", active: schedule === "due" && status === "all", onClick: () => { setSchedule("due"); setStatus("all"); setOffset(0); } },
        ].map(metric => <button key={metric.label} type="button" className="vocabulary-overview-metric" aria-pressed={metric.active} disabled={loading || !!error || metric.value === undefined} onClick={metric.onClick}>
          <span>{metric.label}</span><strong>{error || metric.value === undefined ? "—" : metric.value}</strong><small>{metric.help}</small>
        </button>)}
        </div>
        <div className="vocabulary-distribution">
          <div className="vocabulary-distribution-heading"><h3>{t("Learning distribution")}</h3><span>{data?.sourceAvailable ? `${data.totalSaved} words` : "—"}</span></div>
          {data?.overview?.distribution && !error ? <>
            <div className="vocabulary-distribution-bar" role="img" aria-label={learningStatuses.map(key => `${statusLabels[key]}: ${data.overview?.distribution[key] || 0}`).join(", ")}>
              {learningStatuses.map(key => { const count = data.overview?.distribution[key] || 0; return count > 0 && <span key={key} data-learning-status={key} style={{ flexGrow: count }} />; })}
            </div>
            <div className="vocabulary-distribution-grid">
              {learningStatuses.map(key => {
                const count = data.overview?.distribution[key] || 0;
                return <button type="button" key={key} data-learning-status={key} className="vocabulary-distribution-item" aria-pressed={status === key} disabled={loading} onClick={() => filterStatus(status === key ? "all" : key)}>
                  <span className="word-learning-label"><i aria-hidden="true" />{statusLabels[key]}</span>
                  <span className="vocabulary-distribution-value"><strong>{count}</strong><small>{data.totalSaved ? Math.round(count / data.totalSaved * 100) : 0}%</small></span>
                  <small>{statusDescriptions[key]}</small>
                </button>;
              })}
            </div>
          </> : <p className="vocabulary-evidence-note" role="status">{loading ? "Loading learning history…" : "Learning history is unavailable. Saved words remain available below."}</p>}
        </div>
      </section>
      <div className="vocabulary-library-browse-heading"><div><h2>Saved words</h2><p>{status === "all" ? t("All learning statuses") : statusLabels[status]}</p></div></div>
      <div className="vocabulary-library-filters">
        <label className="vocabulary-library-sort" htmlFor="saved-word-sort">{t("Sort by")}
          <select id="saved-word-sort" value={sort} onChange={event => { setSort(event.target.value); setOffset(0); }}>
            <option value="az">{t("Word: A–Z")}</option><option value="newest">{t("Recently saved")}</option><option value="next-review" disabled={!data?.overview}>{t("Next review")}</option>
          </select>
        </label>
        <label htmlFor="saved-word-schedule">{t("Review schedule")}<select id="saved-word-schedule" value={schedule} disabled={!data?.overview} onChange={event => { setSchedule(event.target.value); setOffset(0); }}>
          <option value="all">{t("Any schedule")}</option><option value="due">{t("Due for review")}</option><option value="upcoming">{t("Upcoming")}</option><option value="unscheduled">{t("Not scheduled")}</option>
        </select></label>
        <label htmlFor="saved-word-status">{t("Learning status")}<select id="saved-word-status" value={status} disabled={!data?.overview} onChange={event => { setStatus(event.target.value); setOffset(0); }}>
          <option value="all">{t("All learning statuses")}</option>{learningStatuses.map(key => <option key={key} value={key}>{statusLabels[key]}</option>)}
        </select></label>
        {filtered && <button type="button" className="text-button" onClick={clearFilters}>{t("Clear filters")}</button>}
      </div>
      <div className="vocabulary-library-status" role="status" aria-live="polite">
        {loading ? "Loading saved words…" : error ? "Could not load saved words." : data && (filtered
          ? `${data.total} match${data.total === 1 ? "" : "es"} · ${data.totalSaved} saved words`
          : `${data.totalSaved} saved word${data.totalSaved === 1 ? "" : "s"}`)}
      </div>
      {error ? (
        <section className="vocabulary-library-empty" role="alert">
          <h2>Could not load your vocabulary</h2><p>{error}</p>
          <button className="secondary" onClick={() => setReload(value => value + 1)}>Try again</button>
        </section>
      ) : !loading && data && (data.words.length ? (
        <>
          <section className="vocabulary-library-list" aria-label="Saved vocabulary">
            {data.words.map(entry => (
              <article className="saved-word" key={entry.id}>
                <button type="button" className="saved-word-row" aria-haspopup="dialog" aria-controls="saved-word-dialog"
                  onBlur={event => event.currentTarget.removeAttribute("data-restored-focus")}
                  onKeyDown={event => event.currentTarget.removeAttribute("data-restored-focus")}
                  onClick={event => { triggerRef.current = event.currentTarget; setSelected(entry); }}>
                  <span className="saved-word-name"><strong lang="en">{entry.word}</strong>{entry.pos && <small>{entry.pos}</small>}</span>
                  <span className="saved-word-preview">
                    {entry.zh && <span lang="zh-CN">{entry.zh}</span>}
                    {entry.meaning && <span lang="en">{entry.meaning}</span>}
                    <small className="saved-word-learning" data-learning-status={entry.learningStatus}><span className="word-learning-label"><i aria-hidden="true" />{statusLabels[entry.learningStatus || "unavailable"]}</span>{entry.srs?.due_date && <> · {scheduleLabel(entry.srs.due_date, data.today)}</>}</small>
                  </span>
                  <Icon name="arrow" />
                </button>
              </article>
            ))}
          </section>
          <nav className="vocabulary-library-pagination" aria-label="Saved words pages">
            <span>{data.offset + 1}–{data.offset + data.words.length} of {data.total}</span>
            <div>
              <button className="secondary" disabled={loading || data.offset === 0} onClick={() => setOffset(Math.max(0, data.offset - limit))}>Previous</button>
              <span>Page {page} of {pages}</span>
              <button className="secondary" disabled={loading || !data.hasMore} onClick={() => setOffset(data.offset + limit)}>Next</button>
            </div>
          </nav>
        </>
      ) : (
        <section className="vocabulary-library-empty">
          <Icon name="handbook" />
          <h2>{!data.sourceAvailable ? "Vocabulary file not found" : filtered ? "No matching words" : "Your vocabulary starts here"}</h2>
          <p>{!data.sourceAvailable ? t("Choose your vocabulary file in Settings to browse your saved words.") : filtered ? t("Broaden your review and learning filters to see more words.") : t("Look up an expression and save it to find it here.")}</p>
          {!data.sourceAvailable ? <a className="secondary" href="#settings">Open Settings</a> : filtered
            ? <button className="secondary" onClick={clearFilters}>{t("Clear filters")}</button>
            : <a className="primary" href="#word-lookup">Look up a word<Icon name="arrow" /></a>}
        </section>
      ))}
      <dialog ref={dialogRef} id="saved-word-dialog" className="saved-word-dialog" aria-labelledby="saved-word-dialog-title"
        onKeyDown={event => {
          if (event.key !== "Tab") return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), summary, a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          )).filter(element => element.getClientRects().length > 0);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first?.focus();
          }
        }}
        onClose={() => {
          setSelected(null);
          // Escape makes the browser treat restored focus as keyboard focus.
          // Keep the list position without a ring until navigation resumes.
          triggerRef.current?.setAttribute("data-restored-focus", "true");
          triggerRef.current?.focus({ preventScroll: true });
        }}
        onClick={event => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
        }}>
        <header className="saved-word-dialog-header">
          <div className="saved-word-dialog-heading"><h2 id="saved-word-dialog-title">Word details</h2>
            {selected && <span className="word-learning-label saved-word-dialog-status" data-learning-status={selected.learningStatus} aria-label={`Learning status: ${statusLabels[selected.learningStatus || "unavailable"]}`}><i aria-hidden="true" />{statusLabels[selected.learningStatus || "unavailable"]}</span>}
          </div>
          <button ref={closeRef} type="button" className="secondary" onClick={() => dialogRef.current?.close()}>
            <Icon name="close" />Close
          </button>
        </header>
        {selected && <div className="saved-word-details">
          {renderDetails(selected)}
          {selected.memory && <section className="saved-word-memory"><h4>Memory cue</h4><p>{selected.memory}</p></section>}
          {selected.added && <p className="saved-word-date">{t("Saved")} <time dateTime={selected.added}>{new Date(`${selected.added}T12:00:00`).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" })}</time></p>}
        </div>}
      </dialog>
    </div>
  );
}
