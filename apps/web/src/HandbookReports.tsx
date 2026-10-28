import { useEffect, useRef, useState } from "react";
import { webApi } from "./api/client";

export function HandbookReports() {
  const [reports, setReports] = useState<Awaited<ReturnType<typeof webApi.listHandbookReports>>["reports"]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [report, setReport] = useState<Awaited<ReturnType<typeof webApi.readHandbookReport>>>();
  const [older, setOlder] = useState("");
  const [comparison, setComparison] = useState<Awaited<ReturnType<typeof webApi.compareHandbookReports>>>();
  const [truncated, setTruncated] = useState(false);
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current++; }, []);
  async function run(id: number, task: () => Promise<void>) {
    setBusy(true); setError("");
    try { await task(); }
    catch { if (id === sequence.current) setError("Reports could not be loaded. Refresh the list or choose the report again."); }
    finally { if (id === sequence.current) setBusy(false); }
  }
  async function loadList() {
    const id = ++sequence.current;
    await run(id, async () => {
      const value = await webApi.listHandbookReports();
      if (id !== sequence.current) return;
      setReports(value.reports); setLoaded(true); setTruncated(Boolean(value.truncated));
      setReport(undefined); setSelected(""); setComparison(undefined); setOlder("");
    });
  }
  async function choose(value: string) {
    const id = ++sequence.current;
    setSelected(value); setReport(undefined); setComparison(undefined); setOlder("");
    if (!value) return;
    await run(id, async () => {
      const result = await webApi.readHandbookReport(value);
      if (id === sequence.current) setReport(result);
    });
  }
  async function compare() {
    const id = ++sequence.current;
    setComparison(undefined);
    await run(id, async () => {
      const result = await webApi.compareHandbookReports(older, selected);
      if (id === sequence.current) setComparison(result);
    });
  }
  const download = (format: string) => `/handbook/reports/export?${new URLSearchParams({ id: selected, format })}`;
  return <details className="handbook-reports" onToggle={(event) => { if (event.currentTarget.open && !loaded && !busy) loadList(); }}>
    <summary>Past reports</summary>
    <p>Read a saved snapshot of your learning history. A past report may differ from your current Handbook.</p>
    <button className="secondary" aria-busy={busy} disabled={busy} onClick={loadList}>{busy ? "Loading reports…" : "Refresh reports"}</button>
    {error && <p role="alert">{error}</p>}
    {loaded && !reports.length && <p>No saved reports yet. Reports you generate with /handbook will appear here.</p>}
    {truncated && <p>Showing the 500 most recent reports.</p>}
    {reports.length > 0 && <label className="handbook-report-select">Saved report
      <select value={selected} disabled={busy} onChange={(event) => choose(event.target.value)}>
        <option value="">Choose a report</option>
        {reports.map((item) => <option key={item.id} value={item.id}>{item.date} · {item.provider}</option>)}
      </select>
    </label>}
    {report && <>
      <div className="handbook-report-actions"><a className="secondary" href={download("html")} download>Download HTML</a><a className="secondary" href={download("markdown")} download>Download Markdown</a></div>
      <p className="handbook-evidence">HTML opens offline and includes a print layout. Report text is preserved as saved; its conclusions may reflect an older analysis.</p>
      {report.snapshot ? <div className="handbook-report-compare">
        <label>Compare an earlier report<select value={older} disabled={busy} onChange={(event) => { setOlder(event.target.value); setComparison(undefined); }}>
          <option value="">Choose an earlier report</option>{reports.filter((item) => item.id !== selected).map((item) => <option key={item.id} value={item.id}>{item.date} · {item.provider}</option>)}
        </select></label>
        <button disabled={busy || !older} onClick={compare}>Compare recorded counts</button>
      </div> : <p className="handbook-evidence">This report has no matching structured snapshot. It can be read and exported, but reliable count comparisons are unavailable.</p>}
      {comparison && (comparison.available ? <div className="handbook-comparison" role="region" aria-label="Report count comparison">
        <p>{comparison.note}</p><div className="handbook-table-scroll"><table><thead><tr><th>Category</th><th>Earlier</th><th>Open report</th><th>Change</th></tr></thead><tbody>{comparison.changes?.map((row) => <tr key={row.errorType}><td>{row.errorType}</td><td>{row.before}</td><td>{row.after}</td><td>{row.delta > 0 ? "+" : ""}{row.delta}</td></tr>)}</tbody></table></div>
      </div> : <p role="status">{comparison.reason}</p>)}
      <iframe title={`Saved Handbook report: ${report.id}`} srcDoc={report.html} sandbox="allow-popups allow-popups-to-escape-sandbox" />
    </>}
  </details>;
}
