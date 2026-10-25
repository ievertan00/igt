import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { webApi } from "./api/client";
import "./Ask.css";

type Turn = { question: string; answer: string; title?: string; related?: string[] };
type Note = { id: string; modifiedAt: string; bytes: number; content: string };
type Discussion = { turns: Turn[]; question: string; context?: Note };
type SaveState = { status: "saving" | "saved" | "error" | "uncertain"; message: string };
const suggestions = [
  ["Word choice", "What's the difference between 'affect' and 'effect'?"],
  ["Grammar in context", "Is 'I have been working' correct here?"],
  ["Tone & politeness", "How do I use 'would' to sound more polite?"],
  ["Tenses", "Can you explain when to use the present perfect?"],
  ["Natural expression", "What's a more natural way to say this?"],
];
const noteTitle = (note: Note) => note.id.replace(/\.md$/i, "");
const snapshot = (turns: Turn[]) => JSON.stringify(turns.map(({ question, answer }) => ({ question, answer })));
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function Ask({ active }: { active: boolean }) {
  const [view, setView] = useState<"ask" | "notes">("ask");
  const [discussion, setDiscussion] = useState<Discussion>({ turns: [], question: "" });
  const [previous, setPrevious] = useState<Discussion[]>([]);
  const [inspirationExpanded, setInspirationExpanded] = useState(false);
  const { turns, question, context } = discussion;
  const [notes, setNotes] = useState<Note[]>([]);
  const [directory, setDirectory] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [mobileDetail, setMobileDetail] = useState(false);
  const [notesBusy, setNotesBusy] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [saves, setSaves] = useState<Record<string, SaveState>>({});
  const [copyStatus, setCopyStatus] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const readerRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const sending = useRef(false);
  const saving = useRef(new Set<string>());
  const notesRequestId = useRef(0);
  const visible = useRef(false);
  visible.current = active && view === "ask";

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
        turns: [...old.turns, { question: submitted, answer, title: data?.title, related: relatedQuestions }] }));
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
      setSaves((old) => ({ ...old, [key]: { status: "saved", message: "Saved to Markdown notes" } }));
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
      <button className="secondary" disabled={state?.status === "saving" || state?.status === "saved"} onClick={() => void save(messages)}>
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
    setView("ask");
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }
  const matching = notes.filter((note) => !query.trim() || `${note.id}\n${note.content}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  // Searching filters the list, not the open document.
  const selected = notes.find((note) => note.id === selectedId);
  const hasConversation = Boolean(turns.length || context);

  return <div className={`ask-page${view === "ask" ? " is-asking" : ""}${hasConversation ? " has-conversation" : ""}`}>
    <div className="heading"><h1>Ask about your English.</h1><p>Make sense of grammar, word choice, tone, and natural expressions. Bring a sentence or a question.</p></div>
    <div className="ask-view-bar">
      <div className="ask-tabs" role="tablist" aria-label="Ask views">
        {(["ask", "notes"] as const).map((tab, index) => <button key={tab} ref={(node) => { tabRefs.current[index] = node; }} id={`ask-tab-${tab}`} role="tab" aria-selected={view === tab} aria-controls={`ask-panel-${tab}`} tabIndex={view === tab ? 0 : -1}
          onClick={() => setView(tab)} onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const target = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
            setView(target === 0 ? "ask" : "notes"); tabRefs.current[target]?.focus();
          }}>{tab === "ask" ? "Ask a question" : "Saved notes"}</button>)}
      </div>
      {view === "ask" && hasConversation && <button className="secondary ask-new-question" disabled={busy} onClick={() => start({ turns: [], question: "" })}><svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>New question</button>}
    </div>
    <section id="ask-panel-ask" role="tabpanel" aria-labelledby="ask-tab-ask" hidden={view !== "ask"}>
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
            <span id="ask-shortcut">Ctrl / ⌘ + Enter to send</span><button className="primary" disabled={busy || !question.trim()} onClick={() => void send()}>{busy ? "Thinking…" : hasConversation ? "Send" : "Ask"}<Icon name="arrow" /></button>
          </div>
        </div>
        {busy && <p className="ask-pending" role="status">Thinking about your question…</p>}
        {requestError && <p className="ask-error" role="alert">{requestError}</p>}
        {!hasConversation && <section className="ask-welcome" aria-label="Question suggestions">
          <div className="ask-quick-questions"><span>Try asking</span>
            {([["Word choice", 0], ["Grammar", 1], ["Tenses", 3]] as const).map(([label, index]) => <button type="button" className="ask-quick-question" key={label} disabled={busy} title={suggestions[index][1]} onClick={() => {
              setDiscussion((old) => ({ ...old, question: suggestions[index][1] })); inputRef.current?.focus({ preventScroll: true });
            }}>{label}</button>)}
            <button type="button" className="ask-more" aria-expanded={inspirationExpanded} aria-controls="ask-more-suggestions" onClick={() => setInspirationExpanded((old) => !old)}>{inspirationExpanded ? "Less" : "More"}<Icon name="chevron" /></button>
          </div>
          <div className="ask-suggestions" id="ask-more-suggestions" hidden={!inspirationExpanded}>
            {suggestions.filter((_, index) => index === 2 || index === 4).map(([label, value]) => <button type="button" key={label} className="ask-suggestion" disabled={busy} onClick={() => { setDiscussion((old) => ({ ...old, question: value })); inputRef.current?.focus({ preventScroll: true }); }}><span><strong>{label}</strong><span>{value}</span></span><Icon name="arrow" /></button>)}
          </div>
        </section>}
        <p className="ask-guidance">AI explanations may need checking. Save useful answers to revisit them.</p>
      </div>
    </section>
    <section id="ask-panel-notes" role="tabpanel" aria-labelledby="ask-tab-notes" hidden={view !== "notes"}>
      <div className={`ask-library-layout${mobileDetail ? " is-detail" : ""}`}>
        <aside className="ask-notes-index">
          <div className="ask-section-heading"><h2>Saved notes <span className="ask-note-count">({notes.length})</span></h2><button className="text-button" disabled={notesBusy} onClick={() => void refreshNotes()}>{notesBusy ? "Loading…" : "Refresh"}</button></div>
          <label className="sr-only" htmlFor="ask-notes-search">Search saved notes</label><input id="ask-notes-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles or content…" />
          {query && <p className="ask-action-status" role="status">{matching.length} of {notes.length} notes</p>}
          {notesBusy && <p role="status" className="ask-pending">Loading saved notes…</p>}
          {notesError && <div role="alert" className="ask-error"><p>Saved notes could not be loaded. {notesError}</p><button className="secondary" disabled={notesBusy} onClick={() => void refreshNotes()}>Retry loading notes</button></div>}
          {!notesBusy && !notesError && !notes.length && <p className="ask-empty">No saved conversations yet. Save an answer to keep it here as a Markdown note. CLI notes appear here too.</p>}
          {!notesBusy && !notesError && notes.length > 0 && !matching.length && <div className="ask-empty"><p>No notes match this search. Try another title or phrase.</p><button className="text-button" onClick={() => setQuery("")}>Clear search</button></div>}
          <nav ref={listRef} className="ask-note-list" aria-label="Saved Ask notes">{matching.map((note) => <button key={note.id} className="ask-note-link" aria-current={note.id === selectedId ? "true" : undefined} aria-controls="ask-note-reader" onClick={() => {
            setSelectedId(note.id); setMobileDetail(true);
            requestAnimationFrame(() => { if (readerRef.current) { readerRef.current.scrollTop = 0; readerRef.current.focus({ preventScroll: true }); } });
          }}><Icon name="document" /><span><strong>{noteTitle(note)}</strong><time dateTime={note.modifiedAt}>{dateLabel(note.modifiedAt)}</time></span></button>)}</nav>
        </aside>
        <article ref={readerRef} className="ask-note-card" id="ask-note-reader" tabIndex={0} aria-label={selected ? noteTitle(selected) : "Note reader"}>
          <button className="text-button ask-back" onClick={() => { setMobileDetail(false); requestAnimationFrame(() => listRef.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus({ preventScroll: true })); }}>Back to notes</button>
          {selected ? <><header><h2>{noteTitle(selected)}</h2><p className="ask-action-status">Updated <time dateTime={selected.modifiedAt}>{dateLabel(selected.modifiedAt)}</time></p><button className="secondary" disabled={busy} onClick={() => start({ turns: [], question: "", context: selected })}>Continue discussing<Icon name="arrow" /></button>{busy && <p className="ask-action-status">Wait for your current answer before starting another discussion.</p>}</header><Markdown source={selected.content} /></>
            : <div className="ask-empty"><h2>Choose a note to read</h2><p>Select a saved question to see the complete explanation here.</p></div>}
        </article>
      </div>
      {directory && <details className="ask-library-directory"><summary>Markdown storage location</summary><p>{directory}</p></details>}
    </section>
  </div>;
}
