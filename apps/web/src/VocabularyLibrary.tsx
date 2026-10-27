import { useEffect, useRef, useState, type ReactNode } from "react";
import { webApi } from "./api/client";
import { Icon } from "./Icon";
import "./VocabularyLibrary.css";

export type SavedVocabularyEntry = {
  id: string; word: string; pos: string; phonetic: string; meaning: string; zh: string;
  synonyms: string; collocations: string; example: string; example2: string; example3: string;
  note: string; memory: string; added: string | null;
};
export type VocabularyLibraryResult = {
  words: SavedVocabularyEntry[]; total: number; totalSaved: number; sourceAvailable: boolean;
  limit: number; offset: number; hasMore: boolean;
};

export function VocabularyLibrary({ renderDetails }: { renderDetails: (entry: SavedVocabularyEntry) => ReactNode }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("az");
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
    document.body.style.overflow = "hidden";
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selected]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true); setError("");
    const timer = window.setTimeout(() => {
      webApi.listVocabularyWords({ search, sort, offset, limit }, controller.signal)
        .then(result => { if (active) setData(result); })
        .catch((error: Error) => { if (active) setError(error.message); })
        .finally(() => { if (active) setLoading(false); });
    }, search ? 200 : 0);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [search, sort, offset, reload]);

  const page = data ? Math.floor(data.offset / limit) + 1 : 1;
  const pages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;
  return (
    <div className="vocabulary-library">
      <header className="vocabulary-library-header">
        <div className="vocabulary-library-title">
          <span className="vocabulary-library-mark" aria-hidden="true"><Icon name="handbook" /></span>
          <div><h1>Saved words</h1><p>Your vocabulary, ready to revisit.</p></div>
        </div>
        <a className="primary" href="#word-review">Review due words<Icon name="arrow" /></a>
      </header>
      <div className="vocabulary-library-toolbar">
        <div className="vocabulary-library-search">
          <label htmlFor="saved-word-search">Find a saved word</label>
          <div className="vocabulary-search-field">
            <Icon name="word-lookup" />
            <input id="saved-word-search" type="search" maxLength={200} value={search}
              placeholder="Search words, meanings, or examples…"
              onChange={event => { setSearch(event.target.value); setOffset(0); }} />
          </div>
        </div>
        <div className="vocabulary-library-sort">
          <label htmlFor="saved-word-sort">Sort by</label>
          <select id="saved-word-sort" value={sort} onChange={event => { setSort(event.target.value); setOffset(0); }}>
            <option value="az">Word: A–Z</option><option value="newest">Recently saved</option>
          </select>
        </div>
      </div>
      <div className="vocabulary-library-status" role="status" aria-live="polite">
        {loading ? "Loading saved words…" : error ? "Could not load saved words." : data && (search.trim()
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
            <div className="vocabulary-list-head" aria-hidden="true"><span>Word / phrase</span><span>Meaning</span></div>
            {data.words.map(entry => (
              <article className="saved-word" key={entry.id}>
                <button type="button" className="saved-word-row" aria-haspopup="dialog" aria-controls="saved-word-dialog"
                  onClick={event => { triggerRef.current = event.currentTarget; setSelected(entry); }}>
                  <span className="saved-word-name"><strong lang="en">{entry.word}</strong>{entry.pos && <small>{entry.pos}</small>}</span>
                  <span className="saved-word-preview">
                    {entry.zh && <span lang="zh-CN">{entry.zh}</span>}
                    {entry.meaning && <span lang="en">{entry.meaning}</span>}
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
          <Icon name={search.trim() ? "word-lookup" : "handbook"} />
          <h2>{!data.sourceAvailable ? "Vocabulary file not found" : search.trim() ? "No matching words" : "Your vocabulary starts here"}</h2>
          <p>{!data.sourceAvailable ? "Choose your vocabulary file in Settings to browse your saved words." : search.trim() ? "Try another word, a Chinese meaning, or a phrase from an example." : "Look up an expression and save it to find it here."}</p>
          {!data.sourceAvailable ? <a className="secondary" href="#settings">Open Settings</a> : search.trim()
            ? <button className="secondary" onClick={() => { setSearch(""); setOffset(0); }}>Clear search</button>
            : <a className="primary" href="#word-lookup">Look up a word<Icon name="arrow" /></a>}
        </section>
      ))}
      <dialog ref={dialogRef} id="saved-word-dialog" className="saved-word-dialog" aria-labelledby="saved-word-dialog-title"
        onKeyDown={event => {
          if (event.key !== "Tab") return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          )).filter(element => element.getClientRects().length > 0);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first?.focus();
          }
        }}
        onClose={() => { setSelected(null); triggerRef.current?.focus({ preventScroll: true }); }}
        onClick={event => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
        }}>
        <header className="saved-word-dialog-header">
          <h2 id="saved-word-dialog-title">Word details</h2>
          <button ref={closeRef} type="button" className="secondary" onClick={() => dialogRef.current?.close()}>
            <Icon name="close" />Close
          </button>
        </header>
        {selected && <div className="saved-word-details">
          {renderDetails(selected)}
          {selected.memory && <section className="saved-word-memory"><h4>Memory cue</h4><p>{selected.memory}</p></section>}
          {selected.added && <p className="saved-word-date">Saved <time dateTime={selected.added}>{new Date(`${selected.added}T12:00:00`).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" })}</time></p>}
        </div>}
      </dialog>
    </div>
  );
}
