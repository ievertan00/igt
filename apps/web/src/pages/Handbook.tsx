import { useEffect, useRef, useState } from "react";
import { useGuideCopy } from "../components/learner-language";
import { Icon } from "../components/Icon";
import { IconButton } from "../components/IconButton";
import { Panel, State } from "../components/Page";
import { copyText } from "../lib/clipboard";
import { webApi } from "../api/client";
import "./Handbook.css";

function HandbookSentence({ original, correction, corrected = false }: { original: string; correction: string; corrected?: boolean }) {
  const before = original.split(/(\s+)/);
  const after = correction.split(/(\s+)/);
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let end = 0;
  while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
  const tokens = corrected ? after : before;
  const middle = tokens.slice(start, end ? -end : undefined).join("");
  return <p lang="en">{tokens.slice(0, start).join("")}{middle && (corrected ? <ins>{middle}</ins> : <del>{middle}</del>)}{end ? tokens.slice(-end).join("") : ""}</p>;
}

function HandbookCopy({ text }: { text: string }) {
  const [status, setStatus] = useState("");
  return <span className="handbook-copy"><IconButton quiet icon={status === "Copied" ? "check" : "copy"} label="Copy correction" onClick={async () => {
    setStatus(await copyText(text) ? "Copied" : "Could not copy. Select and copy the correction.");
  }} /><span role="status">{status}</span></span>;
}

function HandbookDelete({ disabled, onDelete }: { disabled: boolean; onDelete: () => Promise<void> }) {
  const { t } = useGuideCopy();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!confirming || !dialog.current) return;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    cancel.current?.focus();
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, [confirming]);
  function dismiss() {
    if (inFlight.current) return;
    dialog.current?.close();
    setConfirming(false); setError("");
    trigger.current?.focus();
  }
  return <span className="handbook-delete">
    <button ref={trigger} type="button" className="icon-button icon-button-quiet" aria-label={t("Delete saved check")} title={t("Delete saved check")} disabled={disabled || pending} onClick={() => setConfirming(true)}><Icon name="trash" /></button>
    {confirming && <dialog ref={dialog} className="handbook-delete-confirm" aria-label={t("Confirm deletion")} aria-busy={pending} onCancel={event => { event.preventDefault(); dismiss(); }}>
      <strong>{t("Delete this check?")}</strong>
      <span>{t("This cannot be undone.")}</span>
      {error && <span role="alert">{t(error)}</span>}
      <span className="handbook-delete-actions">
        <button ref={cancel} type="button" disabled={pending} onClick={dismiss}>{t("Cancel")}</button>
        <button type="button" className="handbook-delete-submit" disabled={disabled || pending} onClick={async () => {
          if (inFlight.current) return;
          inFlight.current = true; setPending(true); setError("");
          try { await onDelete(); }
          catch (cause: any) { setError(cause?.message || "Could not delete this check. Try again."); }
          finally { inFlight.current = false; setPending(false); }
        }}>{t(pending ? "Deleting…" : "Delete")}</button>
      </span>
    </dialog>}
  </span>;
}

export function Handbook() {
  const { t } = useGuideCopy();
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const rawDays = Number(params.get("days") ?? 0);
  const days = Number.isInteger(rawDays) && rawDays >= 0 && rawDays <= 3650 ? rawDays : 0;
  const diagnosis = (["all", "with", "none"].includes(params.get("diagnosis") || "") ? params.get("diagnosis") : "all") as "all" | "with" | "none";
  const errorType = diagnosis === "none" ? "" : params.get("errorType") || "";
  const appliedSearch = params.get("search") || "";
  const entryId = params.get("entry") || "";
  const rawOffset = Number(params.get("offset") || 0);
  const offset = Number.isSafeInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const [search, setSearch] = useState(appliedSearch);
  // Notes collapse to one line by default; the newest check stays open as a state example. The dock expands every entry at once.
  const [notesOpen, setNotesOpen] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState("");
  const deleteInFlight = useRef(false);
  const filterSubmitRef = useRef<HTMLButtonElement>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof webApi.getHandbook>>>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  async function load() {
    if (deleteInFlight.current) return;
    const id = ++requestId.current;
    setBusy(true);
    setError("");
    try {
      const result = await webApi.getHandbook(errorType, { days, search: appliedSearch, diagnosis, offset, entryId });
      if (id === requestId.current) setData(result);
    } catch {
      if (id === requestId.current) setError("Your saved Refine checks could not be loaded. Please try again.");
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }
  useEffect(() => { setSearch(appliedSearch); void load(); return () => { requestId.current++; }; }, [days, diagnosis, errorType, appliedSearch, offset, entryId]);
  function navigate(changes: Record<string, string | number>) {
    const next = new URLSearchParams({ days: String(days), search: appliedSearch, diagnosis, errorType, offset: "0", ...Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, String(value)])) });
    if (next.get("diagnosis") === "none") next.delete("errorType");
    for (const [key, value] of [...next]) if (!value) next.delete(key);
    const hash = `#handbook?${next}`;
    if (location.hash === hash) void load(); else location.hash = hash;
  }
  function timestampLabel(value: string) {
    if (!Number.isFinite(Date.parse(value))) return "Date unavailable";
    // Review Log timestamps contain Beijing wall time encoded with a Z suffix.
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " · Beijing time";
  }
  async function deleteCheck(id: string) {
    if (deleteInFlight.current) return;
    deleteInFlight.current = true;
    ++requestId.current;
    setBusy(true);
    setDeleteStatus("");
    try {
      await webApi.deleteHandbookCheck(id);
      setData(previous => previous && ({ ...previous, entries: previous.entries.filter(entry => entry.entryId !== id) }));
      setDeleteStatus("Saved check deleted from your Review Log.");
      deleteInFlight.current = false;
      if (entryId || (data?.entries.length === 1 && offset > 0)) navigate({ offset: Math.max(0, offset - (data?.pagination.limit || 10)) });
      else await load();
      requestAnimationFrame(() => filterSubmitRef.current?.focus({ preventScroll: true }));
    } finally {
      deleteInFlight.current = false;
      setBusy(false);
    }
  }
  return <div className="handbook-page">
    <form className="handbook-filters" onSubmit={event => { event.preventDefault(); navigate({ search: search.trim() }); }}>
      <label><span className="sr-only">{t("Time window")}</span><select value={days} disabled={busy} onChange={event => navigate({ days: event.target.value })}>
        {![0, 7, 30, 90].includes(days) && <option value={days}>{t("Last {days} days", { days })}</option>}
        <option value={0}>{t("All history")}</option><option value={7}>Last 7 days</option><option value={30}>{t("Last 30 days")}</option><option value={90}>Last 90 days</option>
      </select></label>
      <label><span className="sr-only">{t("Search saved checks")}</span><input type="search" value={search} maxLength={200} onChange={event => setSearch(event.target.value)} placeholder={t("Search sentences, corrections or notes")} /></label>
      <label><span className="sr-only">{t("Diagnoses")}</span><select value={diagnosis} disabled={busy} onChange={event => navigate({ diagnosis: event.target.value })}>
        <option value="all">{t("All checks")}</option><option value="with">{t("With diagnosed mistakes")}</option><option value="none">{t("No diagnosed mistakes")}</option>
      </select></label>
      <label><span className="sr-only">{t("Mistake type")}</span><select value={errorType} disabled={busy || diagnosis === "none"} onChange={event => navigate({ errorType: event.target.value })}>
        <option value="">{t("All mistake types")}</option>
        {errorType && !data?.categories.some(item => item.errorType === errorType) && <option value={errorType}>{errorType}</option>}
        {data?.categories.map(item => <option key={item.errorType} value={item.errorType}>{item.errorType} ({item.checks})</option>)}
      </select></label>
      <div className="handbook-filter-footer">
        <div className="handbook-filter-actions"><button ref={filterSubmitRef} className="primary" type="submit" disabled={busy}>{t("Search")}<Icon name="arrow" /></button>
        <button className="handbook-clear" type="button" disabled={busy} onClick={() => navigate({ days: 0, search: "", errorType: "", diagnosis: "all" })}>{t("Clear filters")}</button></div>
      </div>
    </form>
    {deleteStatus && <p role="status" className="handbook-evidence">{t(deleteStatus)}</p>}
    {error && <div role="alert" className="handbook-empty"><State title={t("Could not load Handbook")} detail={error} />{data && <p>{t("Previously loaded checks remain below.")}</p>}<button onClick={() => void load()}>{t("Try again")}</button></div>}
    <div aria-busy={busy}>
      {busy && <p role="status">{t("Loading saved checks…")}</p>}
      {data && <>
        {data.coverage.undated > 0 && days !== 0 && <p className="handbook-evidence">{t("Some records have no usable date and cannot be placed in this time window.")}</p>}
        <div className="panel-heading handbook-log-heading"><h2>{t("Refine check log")}</h2></div>
        <div className="handbook-log-layout">
          <div className="handbook-log-main">
            <Panel className="handbook-log">
              {data.entries.length ? data.entries.map((entry, index) => <article className="activity handbook-example" key={entry.entryId} id={`check-${entry.entryId}`}>
                <header className="handbook-source">
                  <span className="handbook-entry-meta"><time><Icon name="word-review" />{timestampLabel(entry.timestamp)}</time>
                    {[...new Set(entry.diagnoses.map(item => item.error_type))].map(type => <span className="handbook-type" key={type}>{type}</span>)}
                    <span className="handbook-origin">{entry.source === "grammar" ? t("Writing · Refine") : t("Historical check")}</span>
                  </span>
                  <span className="handbook-entry-tools">
                    {entry.correction && <HandbookCopy text={entry.correction} />}
                    <HandbookDelete disabled={busy} onDelete={() => deleteCheck(entry.entryId)} />
                  </span>
                </header>
                <section className="handbook-comparison" aria-label="Original and correction">
                  <div className="handbook-sentence handbook-original"><span>{t("Original")}</span>{entry.correction ? <HandbookSentence original={entry.userInput} correction={entry.correction} /> : <p lang="en">{entry.userInput}</p>}</div>
                  {entry.correction && <div className="handbook-sentence handbook-corrected"><span>{t("Correction")}</span><HandbookSentence original={entry.userInput} correction={entry.correction} corrected /></div>}
                </section>
                {!entry.diagnoses.length && <p className="handbook-evidence">{t("No diagnosed mistakes in saved feedback.")}</p>}
                {entry.refine && <section className="handbook-natural"><h3><Icon name="spark" />{t("More natural")}</h3><p lang="en">{entry.refine}</p></section>}
                <details className="handbook-refine" key={`notes-${entry.entryId}-${notesOpen}`} open={notesOpen || index === 0}><summary>{t("Saved explanations and notes")}</summary>
                  {entry.evaluate && <p>{entry.evaluate}</p>}
                  {entry.diagnoses.map((item, index) => <section className="handbook-diagnosis" key={index}><h3>{item.error_type}</h3><p>{item.explanation}</p>{item.evidence && <p>Evidence: {item.evidence}</p>}{item.suggestion && <p>Suggestion: {item.suggestion}</p>}</section>)}
                  {entry.remember && <section className="handbook-remember"><h3><Icon name="idea" />Remember</h3><p>{Array.isArray(entry.remember) ? entry.remember.join("\n") : entry.remember}</p></section>}
                  {!entry.evaluate && !entry.diagnoses.length && !entry.refine && !entry.remember && <p>{t("No additional notes were saved.")}</p>}
                </details>
              </article>) : <div className="handbook-empty"><State title={t("No saved checks to show.")} detail={data.coverage.grammar ? t("Try another search, clear your filters or return to the first page.") : t("Save a Refine check to start your log, or choose a longer time window.")} /><a href="#grammar">{t("Check a sentence")}</a></div>}
            </Panel>
            {(data.pagination.total > 0 || offset > 0) && <nav className="handbook-pagination" aria-label="Refine check pages"><span>{data.entries.length ? `${data.pagination.offset + 1}–${data.pagination.offset + data.entries.length} of ${data.pagination.total} checks` : t("No checks on this page")}</span><button disabled={busy || offset === 0} onClick={() => navigate({ offset: Math.max(0, offset - data.pagination.limit) })}>{t("Previous")}</button><button disabled={busy || !data.pagination.hasMore} onClick={() => navigate({ offset: offset + data.pagination.limit })}>{t("Next")}</button></nav>}
          </div>
          <aside className="handbook-rail" aria-label={t("Log summary")}>
            <section className="handbook-rail-card">
              <h3>{t("At a glance")}</h3>
              <p className="handbook-rail-figure">{data.pagination.total}</p>
              <p className="handbook-rail-caption">{t("Saved checks")}</p>
              <dl className="handbook-rail-stats">
                <div><dt>{t("Checks in view")}</dt><dd>{data.entries.length}</dd></div>
                <div><dt>{t("Mistake types")}</dt><dd>{data.categories.length}</dd></div>
              </dl>
            </section>
            {data.categories.length > 0 && <section className="handbook-rail-card">
              <h3>{t("Most common mistake types")}</h3>
              <ul className="handbook-rail-bars">
                {[...data.categories].sort((a, b) => b.checks - a.checks).slice(0, 4).map(item => {
                  const max = Math.max(...data.categories.map(category => category.checks), 1);
                  return <li key={item.errorType}>
                    <span className="handbook-rail-bar-label">{item.errorType}</span><span className="handbook-rail-bar-value">{item.checks}</span>
                    <span className="handbook-rail-bar-track"><span style={{ width: `${Math.max(6, Math.round(item.checks / max * 100))}%` }} /></span>
                  </li>;
                })}
              </ul>
            </section>}
            <section className="handbook-rail-card">
              <h3>{t("Browse by tag")}</h3>
              <div className="handbook-rail-chips">
                {data.categories.slice(0, 6).map(item => <button type="button" key={item.errorType} aria-pressed={errorType === item.errorType} onClick={() => navigate({ errorType: errorType === item.errorType ? "" : item.errorType })}>{item.errorType}<span>{item.checks}</span></button>)}
                {!data.categories.length && <p className="handbook-rail-caption">{t("No mistake types yet")}</p>}
              </div>
            </section>
          </aside>
        </div>
      </>}
    </div>
    {Boolean(data?.entries.length) && <div className="floating-action-dock handbook-notes-dock">
      <button type="button" className="primary floating-action handbook-notes-toggle" title={notesOpen ? t("Hide explanations & notes") : t("Show explanations & notes")} aria-pressed={notesOpen} onClick={() => setNotesOpen(value => !value)}>
        <Icon name={notesOpen ? "eye-off" : "eye"} /><span className="sr-only">{notesOpen ? t("Hide explanations & notes") : t("Show explanations & notes")}</span>
      </button>
    </div>}
  </div>;
}
