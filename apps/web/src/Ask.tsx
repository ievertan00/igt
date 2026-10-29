import { useEffect, useRef, useState, type CSSProperties } from "react";
import { IconButton } from "./IconButton";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { webApi } from "./api/client";
import "./Ask.css";

type Turn = { question: string; answer: string; title?: string; related?: string[]; tags?: string[]; category?: string };
type Note = { id: string; modifiedAt: string; bytes: number; content: string; title?: string; tags?: string[]; category?: string };
type Discussion = { turns: Turn[]; question: string; context?: Note };
type SaveState = { status: "saving" | "saved" | "error" | "uncertain"; message: string };
const noteTitle = (note: Note) => note.title || note.id.replace(/\.md$/i, "");
const noteBody = (note: Note) => note.content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").replace(/<!-- igt-ask-save:[a-f0-9]+ -->\s*/g, "").trim();
const noteExcerpt = (note: Note) => noteBody(note)
  .replace(/<[^>]*>/g, " ").replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/^#{1,6}\s+.*$/gm, "").replace(/^\*{0,2}Date:.*$/gm, "")
  .replace(/[*_`#>|~]/g, "").replace(/\s+/g, " ").trim().slice(0, 320);
const snapshot = (turns: Turn[]) => JSON.stringify(turns.map(({ question, answer }) => ({ question, answer })));
function dateLabel(value: string, short = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return short ? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function Ask({ active, view }: { active: boolean; view: "ask" | "notes" }) {
  const [discussion, setDiscussion] = useState<Discussion>({ turns: [], question: "" });
  const [previous, setPrevious] = useState<Discussion[]>([]);
  const { turns, question, context } = discussion;
  const [notes, setNotes] = useState<Note[]>([]);
  const [directory, setDirectory] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [readerSize, setReaderSize] = useState<{ width: number; height: number }>();
  const resizeStart = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const [notesBusy, setNotesBusy] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [saves, setSaves] = useState<Record<string, SaveState>>({});
  const [copyStatus, setCopyStatus] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const sending = useRef(false);
  const saving = useRef(new Set<string>());
  const notesRequestId = useRef(0);
  const visible = useRef(false);
  visible.current = active && view === "ask";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (active && view === "notes" && noteOpen) {
      if (!dialog.open) dialog.showModal();
      const overflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { dialog.close(); document.body.style.overflow = overflow; };
    }
    if (dialog.open) dialog.close();
  }, [active, view, noteOpen]);
  useEffect(() => { if (!active || view !== "notes") setNoteOpen(false); }, [active, view]);
  function closeNote() {
    resizeStart.current = null;
    setNoteOpen(false);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus({ preventScroll: true }));
  }
  function resizeReader(width: number, height: number) {
    // The reader stays centered; keep every edge inside the viewport.
    const maxWidth = window.innerWidth - 48, maxHeight = window.innerHeight - 48;
    setReaderSize({ width: Math.min(maxWidth, Math.max(Math.min(448, maxWidth), width)),
      height: Math.min(maxHeight, Math.max(Math.min(352, maxHeight), height)) });
  }

  async function refreshNotes() {
    const requestId = ++notesRequestId.current;
    setNotesBusy(true);
    setNotesError("");
    try {
      const result = await webApi.listAskNotes();
      const loaded = await Promise.all(result.notes.map(async (note) => ({
        ...note, content: typeof note.content === "string" ? note.content : (await webApi.readAskNote(note.id)).content,
      })));
      if (requestId !== notesRequestId.current) return;
      setNotes(loaded);
      setDirectory(result.directory);
    } catch (error: any) {
      if (requestId === notesRequestId.current) setNotesError(error.message || "Could not load saved notes.");
    } finally {
      if (requestId === notesRequestId.current) setNotesBusy(false);
    }
  }
  useEffect(() => { void refreshNotes(); }, []);
  useEffect(() => {
    const input = inputRef.current;
    if (!active || view !== "ask" || !input) return;
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }, [question, active, view, turns.length]);
  // Drafts and discussions stay in this mounted module during in-app navigation.
  // Warn before the browser discards them; they are not disk-persisted drafts.
  useEffect(() => {
    const hasUnsaved = [discussion, ...previous].some((item) => item.question.trim() || item.turns.some((turn) =>
      saves[snapshot([turn])]?.status !== "saved" && saves[snapshot(item.turns)]?.status !== "saved"));
    if (!hasUnsaved && !busy && !saving.current.size) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [discussion, previous, saves, busy]);

  async function send(value = question, related = false) {
    const submitted = value.trim();
    if (sending.current || !submitted) return;
    sending.current = true;
    setBusy(true);
    setRequestError("");
    if (related) setDiscussion((old) => ({ ...old, question: submitted }));
    const history: Turn[] = context
      ? [{ question: `Saved note: ${noteTitle(context)}`, answer: context.content }, ...turns]
      : turns;
    try {
      const result = await webApi.ask(submitted, history);
      const data = result.data;
      const answer = typeof data === "string" ? data : data?.answer;
      if (typeof answer !== "string" || !answer.trim()) throw new Error("The response was empty. Please try again.");
      const relatedQuestions = Array.isArray(data?.related) ? data.related.filter((item: unknown): item is string => typeof item === "string" && Boolean(item.trim())) : [];
      setDiscussion((old) => ({ ...old, question: old.question === (related ? submitted : value) ? "" : old.question,
        turns: [...old.turns, { question: submitted, answer, title: data?.title, related: relatedQuestions,
          tags: Array.isArray(data?.tags) ? data.tags.filter((item: unknown): item is string => typeof item === "string") : [], category: data?.category }] }));
    } catch (error: any) {
      setRequestError(`Could not get an answer. Your question is still here. ${error.message}`);
    } finally {
      sending.current = false;
      setBusy(false);
      if (visible.current) inputRef.current?.focus({ preventScroll: true });
    }
  }

  async function save(messages: Turn[]) {
    const key = snapshot(messages);
    if (saving.current.has(key) || saves[key]?.status === "saved") return;
    saving.current.add(key);
    setSaves((old) => ({ ...old, [key]: { status: "saving", message: messages.length > 1 ? "Summarizing and saving your conversation…" : "Saving to notes…" } }));
    try {
      const result = await webApi.saveAsk(messages);
      if (!result.saved) throw new Error("There is no answer to save.");
      const metadata = result.metadata;
      const details = metadata ? ` · ${metadata.category}${metadata.tags?.length ? ` · ${metadata.tags.map((item: string) => `#${item}`).join(" ")}` : ""}` : "";
      setSaves((old) => ({ ...old, [key]: { status: "saved", message: `Saved${metadata?.title ? ` as “${metadata.title}”` : " to Markdown notes"}${details}${metadata?.metadataSource === "fallback" ? " · AI metadata incomplete; saved with available metadata." : ""}` } }));
      await refreshNotes();
    } catch (error: any) {
      const uncertain = ["NETWORK_ERROR", "REQUEST_TIMEOUT", "REQUEST_ABORTED"].includes(error.code);
      setSaves((old) => ({ ...old, [key]: { status: uncertain ? "uncertain" : "error", message: uncertain
        ? "Save not confirmed. Retry safely; an already saved conversation will be reused." : `Could not save. ${error.message}` } }));
    } finally { saving.current.delete(key); }
  }

  function saveAction(messages: Turn[], label: string) {
    const state = saves[snapshot(messages)];
    return <div className="ask-save-action">
      <button className="secondary" aria-busy={state?.status === "saving"} data-saved={state?.status === "saved"} disabled={state?.status === "saving" || state?.status === "saved"} onClick={() => void save(messages)}>
        <Icon name="bookmark" />{state?.status === "saved" ? "Saved to notes" : state?.status === "saving" ? "Saving…" : state?.status === "uncertain" ? "Retry save" : label}
      </button>
      {state && <span className={state.status === "error" || state.status === "uncertain" ? "ask-error" : "ask-action-status"} role="status">{state.message}</span>}
    </div>;
  }
  async function copy(answer: string) {
    try { await navigator.clipboard.writeText(answer); setCopyStatus("Response copied"); }
    catch { setCopyStatus("Could not copy. Select the response text and copy it manually."); }
  }
  function start(next: Discussion) {
    if (sending.current) return;
    if (question.trim() || turns.length || context) setPrevious((old) => [...old, discussion]);
    setDiscussion(next);
    setRequestError("");
    setCopyStatus("");
    setNoteOpen(false);
    location.hash = "ask";
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }
  const categories = [...new Set(notes.map((note) => note.category || "Uncategorized"))].sort();
  const tags = [...new Set(notes.flatMap((note) => note.tags || []))].sort();
  const matching = notes.filter((note) => (!category || (note.category || "Uncategorized") === category)
    && (!tag || note.tags?.includes(tag))
    && (!query.trim() || `${noteTitle(note)}\n${note.category || ""}\n${(note.tags || []).join(" ")}\n${note.content}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  // Searching filters the list, not the open document.
  const selected = notes.find((note) => note.id === selectedId);
  const hasConversation = Boolean(turns.length || context);
  const hasFilters = Boolean(query.trim() || category || tag);
  function clearFilters() { setQuery(""); setCategory(""); setTag(""); }

  return <div className={`ask-page${view === "ask" ? " is-asking" : ""}${hasConversation ? " has-conversation" : ""}`}>
    <div className={`heading${view === "notes" ? " ask-library-heading" : ""}`}><div><h1>{view === "notes" ? "Saved notes" : "Ask about your English."}</h1><p>{view === "notes" ? "Useful explanations, kept for later. Find a note and pick up where you left off." : "Make sense of grammar, word choice, tone, and natural expressions. Bring a sentence or a question."}</p></div>{view === "notes" && <a className="secondary" href="#ask"><Icon name="ask" />Ask a question<Icon name="arrow" /></a>}</div>
    {view === "ask" && hasConversation && <div className="ask-view-bar"><button className="secondary ask-new-question" disabled={busy} onClick={() => start({ turns: [], question: "" })}><Icon name="ask" />New question</button></div>}
    <section id="ask-panel-ask" aria-label="Ask a question" hidden={view !== "ask"}>
      <div className="ask-reading-column">
        {previous.length > 0 && <div className="ask-history-row"><details className="ask-previous"><summary>Previous questions in this session ({previous.length})</summary>
          {previous.map((item, index) => <button key={index} className="text-button" disabled={busy} onClick={() => {
            setPrevious((old) => old.filter((_, i) => i !== index).concat(question.trim() || turns.length || context ? [discussion] : []));
            setDiscussion(item); setRequestError(""); setCopyStatus("");
          }}>{item.turns[0]?.question || item.context?.id || item.question}</button>)}
        </details></div>}
        {context && <aside className="ask-context"><strong>Discussing: {noteTitle(context)}</strong><p>This is a new discussion using the complete saved note as context. Your note stays unchanged.</p></aside>}
        {turns.map((turn, index) => <article className="ask-turn" key={index} aria-label={`Question ${index + 1}`}>
          <div className="ask-question"><span className="ask-speaker">You asked</span><p>{turn.question}</p></div>
          <div className="ask-answer"><h2 className="ask-speaker">Explanation</h2><Markdown source={turn.answer} />
            <div className="ask-response-actions" role="group" aria-label="Response actions">
              <details className="ask-save-menu" onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}>
                <summary><Icon name={saves[snapshot([turn])]?.status === "saved" ? "check" : "bookmark"} />{saves[snapshot([turn])]?.status === "saved" ? "Saved to notes" : "Save"}<Icon name="chevron" /></summary>
                <div className="ask-save-options">{saveAction([turn], "Save this answer")}{turns.length > 1 && saveAction(turns, "Summarize & save conversation")}</div>
              </details>
              <button className="secondary" onClick={() => void copy(turn.answer)}><Icon name="copy" />Copy response</button>
            </div>
          </div>
          {Boolean(turn.related?.length) && <div className="ask-related"><h3>Explore further</h3><div className="ask-related-grid">{turn.related!.map((item, i) => <button className="ask-related-question" key={i} disabled={busy} onClick={() => void send(item, true)}>{item}<Icon name="arrow" /></button>)}</div></div>}
        </article>)}
        {copyStatus && <p className="ask-action-status" role="status">{copyStatus}</p>}
        <div className="ask-composer" aria-busy={busy}>
          <label className="form-label" htmlFor="ask-input">{hasConversation ? "Keep the conversation going" : "What would you like to understand?"}</label>
          <textarea ref={inputRef} id="ask-input" value={question} readOnly={busy} aria-describedby="ask-shortcut" onChange={(event) => setDiscussion((old) => ({ ...old, question: event.target.value }))}
            onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}
            placeholder={hasConversation ? "Ask a follow-up. Add an example or tell us what is still unclear…" : "Type your question here. Add a sentence or an example for context…"} />
          <div className="ask-composer-actions">
            {turns.length > 0 && <button type="button" className="text-button" disabled={busy} onClick={() => start({ turns: turns.slice(0, -1), question: turns[turns.length - 1].question, context })}>Back to question</button>}
            <span id="ask-shortcut">Ctrl / ⌘ + Enter to send</span><button className="primary" aria-busy={busy} disabled={busy || !question.trim()} onClick={() => void send()}>{busy ? "Thinking…" : hasConversation ? "Send" : "Ask"}<Icon name="arrow" /></button>
          </div>
        </div>
        {busy && <p className="ask-pending" role="status">Thinking about your question…</p>}
        {requestError && <p className="ask-error" role="alert">{requestError}</p>}
        <p className="ask-guidance">AI explanations may need checking. Save useful answers to revisit them.</p>
      </div>
    </section>
    <section id="ask-panel-notes" aria-label="Saved notes" hidden={view !== "notes"}>
      <div className="ask-library-layout">
        <aside className="ask-notes-index">
          <div className="ask-library-tools"><div className="ask-library-search"><label className="form-label" htmlFor="ask-notes-search">Search saved notes</label><input id="ask-notes-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, tags or content…" /></div>
          <div className="ask-note-filters">
            <label htmlFor="ask-category">Category<select id="ask-category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label htmlFor="ask-tag">Tag<select id="ask-tag" value={tag} onChange={(event) => setTag(event.target.value)}><option value="">All tags</option>{tags.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          </div>
          <div className="ask-section-heading ask-library-results"><div className="ask-results-label"><h2>{hasFilters ? "Matching notes" : "All notes"} <span className="ask-note-count">{hasFilters ? `${matching.length} / ${notes.length}` : notes.length}</span></h2>{hasFilters && <button className="text-button" onClick={clearFilters}>Clear filters</button>}</div><button className="text-button" aria-label="Refresh saved notes" disabled={notesBusy} onClick={() => void refreshNotes()}>{notesBusy ? "Loading…" : "Refresh"}</button></div>
          <span className="sr-only" role="status">{!notesBusy && !notesError ? `${matching.length} ${matching.length === 1 ? "note" : "notes"}${hasFilters ? ` matching your filters out of ${notes.length}` : " saved"}` : ""}</span>
          {notesBusy && <p role="status" className="ask-pending">{notes.length ? "Refreshing your notes…" : "Loading saved notes…"}</p>}
          {notesError && <div role="alert" className="ask-error"><p>Saved notes could not be loaded. {notesError}</p><button className="secondary" disabled={notesBusy} onClick={() => void refreshNotes()}>Retry loading notes</button></div>}
          {!notesBusy && !notesError && !notes.length && <div className="ask-empty ask-library-empty"><span className="ask-empty-icon"><Icon name="bookmark" /></span><h2>No saved conversations yet</h2><p>Save a useful answer in Ask to revisit it here.<br />Your saved CLI notes appear here too.</p><a className="secondary" href="#ask">Ask your first question<Icon name="arrow" /></a></div>}
          {!notesBusy && !notesError && notes.length > 0 && !matching.length && <div className="ask-empty ask-library-empty"><span className="ask-empty-icon"><Icon name="word-lookup" /></span><h2>No notes match these filters</h2><p>Try a different word, category or tag.</p><button className="secondary" onClick={clearFilters}>Clear filters</button></div>}
          <nav ref={listRef} className="ask-note-list" aria-label="Saved Ask notes" aria-busy={notesBusy}>{matching.map((note) => <button key={note.id} className="ask-note-link" aria-current={note.id === selectedId ? "true" : undefined} aria-haspopup="dialog" aria-controls="ask-note-reader" onClick={() => {
            setSelectedId(note.id); setNoteOpen(true);
          }}>
            <span className="ask-note-card-top"><span className="ask-note-category">{note.category || "Uncategorized"}</span><Icon name="document" /></span>
            <span className="ask-note-title"><strong title={noteTitle(note)}>{noteTitle(note)}</strong>{note.id === selectedId && <Icon name="check" />}</span>
            <span className="ask-note-excerpt">{noteExcerpt(note) || "Open this note to read the full explanation."}</span>
            {Boolean(note.tags?.length) && <span className="ask-note-topics">{note.tags!.map((item) => <span key={item}>#{item}</span>)}</span>}
            <span className="ask-note-card-footer"><time dateTime={note.modifiedAt} title={`Updated ${dateLabel(note.modifiedAt)}`}>{dateLabel(note.modifiedAt, true)}</time><span>Read note<Icon name="arrow" /></span></span>
          </button>)}</nav>
        </aside>
      </div>
      <dialog ref={dialogRef} className="ask-note-dialog" id="ask-note-reader" style={readerSize ? { "--reader-width": `${readerSize.width}px`, "--reader-height": `${readerSize.height}px` } as CSSProperties : undefined} aria-labelledby="ask-note-title" onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]')].filter((node) => node.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }} onCancel={(event) => { event.preventDefault(); closeNote(); }} onClick={(event) => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeNote(); } }}>
        <div className="ask-note-dialog-bar"><span className="ask-reader-label"><Icon name="document" />Saved note</span><div className="ask-reader-controls">{readerSize && <button className="text-button ask-reader-reset" onClick={() => setReaderSize(undefined)}>Reset size</button>}<IconButton icon="close" label="Close note" onClick={closeNote} /></div></div>
        <article className="ask-note-card">
          {selected && <><header><h2 id="ask-note-title">{noteTitle(selected)}</h2><p className="ask-action-status">Updated <time dateTime={selected.modifiedAt}>{dateLabel(selected.modifiedAt)}</time></p><div className="ask-note-metadata" aria-label="Note topics"><button className="secondary" onClick={() => { setCategory(selected.category || "Uncategorized"); closeNote(); }}>{selected.category || "Uncategorized"}</button>{(selected.tags || []).map((item) => <button className="text-button" key={item} onClick={() => { setTag(item); closeNote(); }}>#{item}</button>)}</div></header><Markdown source={noteBody(selected)} /></>}
        </article>
        <div className="ask-note-dialog-footer"><span className="sr-only" id="ask-note-discussion-hint">Use this note as context for a new question.</span><button className="text-button" aria-describedby="ask-note-discussion-hint" disabled={busy || !selected} onClick={() => selected && start({ turns: [], question: "", context: selected })}>Continue discussion<Icon name="arrow" /></button>{busy && <p className="ask-action-status">Wait for your current answer before starting another discussion.</p>}</div>
        <div className="ask-reader-size-bar"><span id="ask-reader-resize-hint">Drag the corner to resize · Arrow keys when focused</span><button className="ask-reader-resize" type="button" aria-label="Resize note window" aria-describedby="ask-reader-resize-hint" title="Drag to resize. Use arrow keys when focused; Home resets size."
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const box = dialogRef.current!.getBoundingClientRect();
            resizeStart.current = { x: event.clientX, y: event.clientY, width: box.width, height: box.height };
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
            event.currentTarget.focus({ preventScroll: true });
          }} onPointerMove={(event) => {
            const start = resizeStart.current;
            if (start) resizeReader(start.width + (event.clientX - start.x) * 2, start.height + (event.clientY - start.y) * 2);
          }} onPointerUp={(event) => {
            resizeStart.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          }} onPointerCancel={() => { resizeStart.current = null; }} onLostPointerCapture={() => { resizeStart.current = null; }}
          onKeyDown={(event) => {
            if (event.key === "Home") { event.preventDefault(); setReaderSize(undefined); return; }
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            const box = dialogRef.current!.getBoundingClientRect(), step = event.shiftKey ? 48 : 24;
            resizeReader(box.width + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0),
              box.height + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0));
          }}><svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" aria-hidden="true"><path d="M7 19 19 7 M13 19l6-6 M19 19h.01" /></svg></button></div>
      </dialog>
      {directory && <details className="ask-library-directory"><summary>Markdown storage location</summary><p>{directory}</p></details>}
    </section>
  </div>;
}
