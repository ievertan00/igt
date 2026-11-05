import { useEffect, useRef, useState, type CSSProperties } from "react";
import { IconButton } from "./IconButton";
import { Icon } from "./Icon";
import { FloatingAction } from "./FloatingAction";
import { Markdown } from "./Markdown";
import { webApi } from "./api/client";
import { GuideText, useGuideCopy, type LearnerLanguage } from "./learner-language";
import "./Ask.css";
import { ModelSwitcher } from "./model-settings";

type Turn = { question: string; answer: string; title?: string; related?: string[]; tags?: string[]; category?: string; language?: LearnerLanguage };
type Note = { id: string; modifiedAt: string; bytes: number; content: string; title?: string; tags?: string[]; category?: string };
type Discussion = { turns: Turn[]; question: string; context?: Note };
type SaveState = { status: "saving" | "saved" | "error" | "uncertain"; message: string };
const noteTitle = (note: Note) => note.id.replace(/\.md$/i, "");
const noteBody = (note: Note) => note.content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").replace(/<!-- igt-ask-save:[a-f0-9]+ -->\s*/g, "").trim();
const noteExcerpt = (note: Note) => noteBody(note)
  .replace(/<[^>]*>/g, " ").replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/^#{1,6}\s+.*$/gm, "").replace(/^\*{0,2}Date:.*$/gm, "")
  .replace(/[*_`#>|~]/g, "").replace(/\s+/g, " ").trim().slice(0, 320);
const snapshot = (turns: Turn[], language?: LearnerLanguage) => JSON.stringify(turns.map(({ question, answer }) => ({ question, answer }))) + (turns.length > 1 && language ? `\0${language}` : "");
function dateLabel(value: string, short = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return short ? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function Ask({ active, view }: { active: boolean; view: "ask" | "notes" }) {
  const { language, t } = useGuideCopy();
  const [answerOverride, setAnswerOverride] = useState<LearnerLanguage>();
  const [summaryOverride, setSummaryOverride] = useState<LearnerLanguage>();
  const answerLanguage = answerOverride ?? language;
  const [discussion, setDiscussion] = useState<Discussion>({ turns: [], question: "" });
  const [previous, setPrevious] = useState<Discussion[]>([]);
  const { turns, question, context } = discussion;
  const summaryLanguage = summaryOverride ?? turns.at(-1)?.language ?? answerLanguage;
  const [notes, setNotes] = useState<Note[]>([]);
  const [directory, setDirectory] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [copiedNote, setCopiedNote] = useState("");
  const [noteCopyError, setNoteCopyError] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const [selectedId, setSelectedId] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletedTitle, setDeletedTitle] = useState("");
  const deletingRef = useRef(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const deleteConfirmRef = useRef<HTMLDivElement>(null);
  const deleteSubmitRef = useRef<HTMLButtonElement>(null);
  const returnFocusIdRef = useRef<string | null>(null);
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
  useEffect(() => {
    if (noteOpen || returnFocusIdRef.current === null) return;
    const id = returnFocusIdRef.current;
    returnFocusIdRef.current = null;
    if (!active || view !== "notes") return;
    // Wait until the modal has closed before moving focus outside it.
    const frame = requestAnimationFrame(() => {
      const card = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find(button => button.dataset.noteId === id);
      const target = card ?? document.getElementById("ask-notes-all");
      target?.setAttribute("data-restored-focus", "true");
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [noteOpen, active, view]);
  useEffect(() => {
    if (confirmDelete) cancelDeleteRef.current?.focus({ preventScroll: true });
  }, [confirmDelete]);
  useEffect(() => {
    if (deleting) deleteConfirmRef.current?.focus({ preventScroll: true });
    else if (deleteError) deleteSubmitRef.current?.focus({ preventScroll: true });
  }, [deleting, deleteError]);
  function cancelDeletion() {
    if (deletingRef.current) return;
    setConfirmDelete(false);
    setDeleteError("");
    requestAnimationFrame(() => deleteButtonRef.current?.focus({ preventScroll: true }));
  }
  function dismissReader() {
    if (confirmDelete) cancelDeletion();
    else closeNote();
  }
  function closeNote() {
    if (deletingRef.current) return;
    setConfirmDelete(false);
    setDeleteError("");
    resizeStart.current = null;
    returnFocusIdRef.current = selectedId;
    setNoteOpen(false);
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
  async function deleteNote() {
    if (!selected || !confirmDelete || deletingRef.current) return;
    const id = selectedId;
    const title = noteTitle(selected);
    const index = matching.findIndex(note => note.id === id);
    const nextId = (matching[index + 1] ?? matching[index - 1])?.id;
    deletingRef.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      await webApi.deleteAskNote(id);
      ++notesRequestId.current;
      setNotesBusy(false);
      setNotes(old => old.filter(note => note.id !== id));
      setSelectedId("");
      setDeletedTitle(title);
      setSaves({});
      deletingRef.current = false;
      closeNote();
      returnFocusIdRef.current = nextId ?? "";
      window.dispatchEvent(new Event("ask-notes-changed"));
    } catch (error: any) {
      setDeleteError(error.message || "Could not delete this note. Try again.");
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }
  useEffect(() => { void refreshNotes(); }, []);
  useEffect(() => {
    const refresh = () => { void refreshNotes(); };
    window.addEventListener("ask-notes-changed", refresh);
    return () => window.removeEventListener("ask-notes-changed", refresh);
  }, []);
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
      saves[snapshot([turn])]?.status !== "saved" && !([undefined, "en", "zh-CN"] as const).some(lang => saves[snapshot(item.turns, lang)]?.status === "saved")));
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
      const result = await webApi.ask(submitted, history, answerLanguage);
      const data = result.data;
      const answer = typeof data === "string" ? data : data?.answer;
      if (typeof answer !== "string" || !answer.trim()) throw new Error("The response was empty. Please try again.");
      const relatedQuestions = Array.isArray(data?.related) ? data.related.filter((item: unknown): item is string => typeof item === "string" && Boolean(item.trim())) : [];
      setDiscussion((old) => ({ ...old, question: old.question === (related ? submitted : value) ? "" : old.question,
        turns: [...old.turns, { question: submitted, answer, language: answerLanguage, title: data?.title, related: relatedQuestions,
          tags: Array.isArray(data?.tags) ? data.tags.filter((item: unknown): item is string => typeof item === "string") : [], category: data?.category }] }));
    } catch (error: any) {
      setRequestError(error.message);
    } finally {
      sending.current = false;
      setBusy(false);
      if (visible.current) inputRef.current?.focus({ preventScroll: true });
    }
  }

  async function save(messages: Turn[]) {
    const selectedLanguage = messages.length > 1 ? summaryLanguage : undefined;
    const key = snapshot(messages, selectedLanguage);
    if (saving.current.has(key) || saves[key]?.status === "saved") return;
    saving.current.add(key);
    setSaves((old) => ({ ...old, [key]: { status: "saving", message: messages.length > 1 ? t("Summarizing and saving your conversation…") : t("Saving to notes…") } }));
    try {
      const result = await webApi.saveAsk(messages, selectedLanguage);
      if (!result.saved) throw new Error("There is no answer to save.");
      const metadata = result.metadata;
      const details = metadata ? ` · ${metadata.category}${metadata.tags?.length ? ` · ${metadata.tags.map((item: string) => `#${item}`).join(" ")}` : ""}` : "";
      setSaves((old) => ({ ...old, [key]: { status: "saved", message: `Saved${metadata?.title ? ` as “${metadata.title}”` : " to Markdown notes"}${details}${metadata?.metadataSource === "fallback" ? " · AI metadata incomplete; saved with available metadata." : ""}` } }));
      await refreshNotes();
    } catch (error: any) {
      const uncertain = ["NETWORK_ERROR", "REQUEST_TIMEOUT", "REQUEST_ABORTED"].includes(error.code);
      setSaves((old) => ({ ...old, [key]: { status: uncertain ? "uncertain" : "error", message: uncertain
        ? t("Save not confirmed. Retry safely; an already saved conversation will be reused.") : `Could not save. ${error.message}` } }));
    } finally { saving.current.delete(key); }
  }

  function saveAction(messages: Turn[], label: string) {
    const state = saves[snapshot(messages, messages.length > 1 ? summaryLanguage : undefined)];
    return <div className="ask-save-action">
      <button className="secondary" aria-busy={state?.status === "saving"} data-saved={state?.status === "saved"} disabled={state?.status === "saving" || state?.status === "saved"} onClick={() => void save(messages)}>
        <Icon name="bookmark" />{state?.status === "saved" ? t("Saved to notes") : state?.status === "saving" ? t("Saving…") : state?.status === "uncertain" ? t("Retry save") : label}
      </button>
      {state && <span className={state.status === "error" || state.status === "uncertain" ? "ask-error" : "ask-action-status"} role="status">{t(state.message)}</span>}
    </div>;
  }
  async function copy(answer: string) {
    try { await navigator.clipboard.writeText(answer); setCopyStatus("Response copied"); }
    catch { setCopyStatus("Could not copy. Select the response text and copy it manually."); }
  }
  async function copyNote(content: string, id: string) {
    setNoteCopyError("");
    try {
      await navigator.clipboard.writeText(content);
      clearTimeout(copyTimer.current);
      setCopiedNote(id);
      copyTimer.current = setTimeout(() => setCopiedNote(""), 2000);
    } catch {
      setNoteCopyError(t("Could not copy. Open the note and copy its text manually."));
    }
  }
  function openNote(note: Note) {
    setSelectedId(note.id); setConfirmDelete(false); setDeleteError(""); setDeletedTitle(""); setNoteCopyError(""); setNoteOpen(true);
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
  const categoryNotes = notes.filter(note => !category || (note.category || "Uncategorized") === category);
  const tags = [...new Set(categoryNotes.flatMap((note) => note.tags || []))].sort();
  const visibleTags = showAllTopics ? tags : tags.slice(0, 24);
  if (tag && tags.includes(tag) && !visibleTags.includes(tag)) visibleTags.push(tag);
  const matching = notes.filter((note) => (!category || (note.category || "Uncategorized") === category)
    && (!tag || note.tags?.includes(tag))
    && (!query.trim() || `${noteTitle(note)}\n${note.title || ""}\n${note.category || ""}\n${(note.tags || []).join(" ")}\n${note.content}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  // Searching filters the list, not the open document.
  const selected = notes.find((note) => note.id === selectedId);
  const hasConversation = Boolean(turns.length || context);
  const hasFilters = Boolean(category || tag || query.trim());
  function clearFilters() { setCategory(""); setTag(""); setQuery(""); }

  return <div className={`ask-page${view === "ask" ? " is-asking" : ""}${hasConversation ? " has-conversation" : ""}`}>
    <div className={`heading${view === "notes" ? " ask-library-heading" : ""}`}><div><h1>{view === "notes" ? "Saved notes" : "Ask about your English."}</h1><p><GuideText text={view === "notes" ? "Useful explanations, kept for later. Find a note and pick up where you left off." : "Make sense of grammar, word choice, tone, and natural expressions. Bring a sentence or a question."} /></p></div>{view === "notes" && <a className="secondary" href="#ask"><Icon name="ask" /><GuideText text="Ask a question" /><Icon name="arrow" /></a>}</div>
    {view === "ask" && hasConversation && <div className="ask-view-bar"><button className="secondary ask-new-question" disabled={busy} onClick={() => start({ turns: [], question: "" })}><Icon name="ask" />{t("New question")}</button></div>}
    <section id="ask-panel-ask" aria-label={t("Ask a question")} hidden={view !== "ask"}>
      <div className="ask-reading-column">
        {previous.length > 0 && <div className="ask-history-row"><details className="ask-previous"><summary>Previous questions in this session ({previous.length})</summary>
          {previous.map((item, index) => <button key={index} className="text-button" disabled={busy} onClick={() => {
            setPrevious((old) => old.filter((_, i) => i !== index).concat(question.trim() || turns.length || context ? [discussion] : []));
            setDiscussion(item); setRequestError(""); setCopyStatus("");
          }}>{item.turns[0]?.question || item.context?.id || item.question}</button>)}
        </details></div>}
        {context && <aside className="ask-context"><strong>Discussing: {noteTitle(context)}</strong><p>{t("This is a new discussion using the complete saved note as context. Your note stays unchanged.")}</p></aside>}
        {turns.map((turn, index) => <article className="ask-turn" key={index} aria-label={`Question ${index + 1}`}>
          <div className="ask-question"><span className="ask-speaker">You asked</span><p>{turn.question}</p></div>
          <div className="ask-answer"><h2 className="ask-speaker">Explanation</h2><Markdown source={turn.answer} />
            <div className="ask-response-actions" role="group" aria-label="Response actions">
              <details className="ask-save-menu" onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}>
                <summary><Icon name={saves[snapshot([turn])]?.status === "saved" ? "check" : "bookmark"} />{saves[snapshot([turn])]?.status === "saved" ? t("Saved to notes") : "Save"}<Icon name="chevron" /></summary>
                <div className="ask-save-options">{saveAction([turn], t("Save this answer"))}{turns.length > 1 && <><label className="ask-language-control">{t("Note language")}<select aria-label={t("Note language")} value={summaryLanguage} onChange={event => setSummaryOverride(event.target.value as LearnerLanguage)}><option value="zh-CN">中文讲解</option><option value="en">English</option></select></label>{saveAction(turns, t("Summarize & save conversation"))}</>}</div>
              </details>
              <button className="secondary" onClick={() => void copy(turn.answer)}><Icon name="copy" />{t("Copy response")}</button>
            </div>
          </div>
          {Boolean(turn.related?.length) && <div className="ask-related"><h3>{t("Explore further")}</h3><div className="ask-related-grid">{turn.related!.map((item, i) => <button className="ask-related-question" key={i} disabled={busy} onClick={() => void send(item, true)}>{item}<Icon name="arrow" /></button>)}</div></div>}
        </article>)}
        {copyStatus && <p className="ask-action-status" role="status">{t(copyStatus)}</p>}
        <div className="ask-composer" aria-busy={busy}>
          <div className="ask-composer-heading"><span className="ask-composer-mark"><Icon name="ask" /></span><label className="form-label" htmlFor="ask-input"><GuideText text={hasConversation ? "Keep the conversation going" : "What would you like to understand?"} /></label><span className="assistant-badge"><GuideText text="AI Assistant" /></span></div>
          <textarea ref={inputRef} id="ask-input" value={question} readOnly={busy} aria-describedby="ask-shortcut" onChange={(event) => setDiscussion((old) => ({ ...old, question: event.target.value }))}
            onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}
            placeholder={hasConversation ? t("Ask a follow-up. Add an example or tell us what is still unclear…") : t("Type your question here. Add a sentence or an example for context…")} />
          <div className="ask-composer-actions">
            <ModelSwitcher page="ask" disabled={busy} id={active && view === "ask" ? "workspace-model" : "ask-hidden-model"} />
            <label className="ask-language-control" htmlFor="ask-answer-language">
              <GuideText text="Answer language" />
              <select id="ask-answer-language" aria-describedby="ask-language-hint" title={t("Applies to your next answer. English examples stay in English.")} value={answerLanguage} onChange={event => setAnswerOverride(event.target.value as LearnerLanguage)}>
                <option value="zh-CN" lang="zh-CN">中文讲解</option>
                <option value="en" lang="en">English</option>
              </select>
            </label>
            <span className="sr-only" id="ask-language-hint">{t("Applies to your next answer. English examples stay in English.")}</span>
            <div className="ask-submit-actions">
              <span className="ask-shortcut" id="ask-shortcut"><GuideText text="Ctrl / ⌘ + Enter to send" /></span>
              <button className="primary" aria-busy={busy} disabled={busy || !question.trim()} onClick={() => void send()}>{busy ? t("Thinking…") : <GuideText text="Send" />}<Icon name="arrow" /></button>
            </div>
          </div>
          {turns.length > 0 && <button type="button" className="text-button ask-back-question" disabled={busy} onClick={() => start({ turns: turns.slice(0, -1), question: turns[turns.length - 1].question, context })}>{t("Back to question")}</button>}
        </div>
        {busy && <p className="ask-pending" role="status">{t("Thinking about your question…")}</p>}
        {requestError && <p className="ask-error" role="alert">{t("Could not get an answer. Your question is still here.")} {requestError}</p>}
        <p className="ask-guidance">{t("AI explanations may need checking. Save useful answers to revisit them.")}</p>
      </div>
    </section>
    <section id="ask-panel-notes" aria-label="Saved notes" hidden={view !== "notes"}>
      {deletedTitle && <div className="ask-note-deleted"><div role="status"><Icon name="check" /><p><strong>{t("Note deleted")}</strong><span>{deletedTitle}</span></p></div><IconButton icon="close" quiet label={t("Dismiss notification")} onClick={() => { setDeletedTitle(""); document.getElementById("ask-notes-all")?.focus(); }} /></div>}
      <div className="ask-library-layout">
        <aside className="ask-notes-index">
          <div className="ask-library-tools">
            <div className="ask-library-filter-row">
              <div className="ask-category-tabs" role="group" aria-label={t("Category")}>
                <button id="ask-notes-all" className="text-button" aria-pressed={!category} onClick={() => { setCategory(""); setTag(""); }} onBlur={event => event.currentTarget.removeAttribute("data-restored-focus")} onKeyDown={event => event.currentTarget.removeAttribute("data-restored-focus")}>{t("All notes")} <span>{notes.length}</span></button>
                {categories.map(item => <button key={item} className="text-button" aria-pressed={category === item} onClick={() => { setCategory(category === item ? "" : item); setTag(""); }}>{t(item)} <span>{notes.filter(note => (note.category || "Uncategorized") === item).length}</span></button>)}
              </div>
              <div className="ask-library-search"><Icon name="word-lookup" /><label className="sr-only" htmlFor="ask-notes-search">{t("Search notes or topics")}</label><input id="ask-notes-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Search notes or topics…")} />{query && <IconButton className="ask-search-clear" icon="close" label={t("Clear search")} quiet onClick={() => { setQuery(""); document.getElementById("ask-notes-search")?.focus(); }} />}</div>
            </div>
            {tags.length > 0 && <section className="ask-topics-section" aria-labelledby="ask-topics-title">
              <div className="ask-topics-heading"><h2 id="ask-topics-title"><Icon name="bookmark" />{t("Topics")} <span>({tags.length})</span></h2>{tag && <button type="button" className="text-button" onClick={() => setTag("")}>{t("Clear topic filter")} <strong>#{tag}</strong><Icon name="close" /></button>}</div>
              <div id="ask-topic-options" className="ask-topic-filters" role="group" aria-label={t("Tag")}>{visibleTags.map(item => <button className="text-button" key={item} aria-pressed={tag === item} onClick={() => setTag(tag === item ? "" : item)}>{t(item)} <span>{categoryNotes.filter(note => note.tags?.includes(item)).length}</span></button>)}</div>
              {tags.length > 24 && <button type="button" className="text-button ask-topics-toggle" aria-expanded={showAllTopics} aria-controls="ask-topic-options" onClick={() => setShowAllTopics(!showAllTopics)}>{showAllTopics ? t("Show fewer topics") : t("Show all {count} topics", { count: tags.length })}<Icon name="chevron" /></button>}
            </section>}
          </div>
          {noteCopyError && !noteOpen && <p className="ask-error" role="alert">{noteCopyError}</p>}
          <span className="sr-only" role="status">{copiedNote && t("Copied to clipboard")}</span>
          <div className="ask-section-heading ask-library-results"><div className="ask-results-label"><h2>{hasFilters ? "Matching notes" : "All notes"} <span className="ask-note-count">{hasFilters ? `${matching.length} / ${notes.length}` : notes.length}</span></h2>{hasFilters && <button className="text-button" onClick={clearFilters}>{t("Clear filters")}</button>}</div><button className="text-button" aria-label="Refresh saved notes" disabled={notesBusy} onClick={() => void refreshNotes()}>{notesBusy ? "Loading…" : "Refresh"}</button></div>
          <span className="sr-only" role="status">{!notesBusy && !notesError ? `${matching.length} ${matching.length === 1 ? "note" : "notes"}${hasFilters ? ` matching your filters out of ${notes.length}` : " saved"}` : ""}</span>
          {notesBusy && <p role="status" className="ask-pending">{notes.length ? t("Refreshing your notes…") : t("Loading saved notes…")}</p>}
          {notesError && <div role="alert" className="ask-error"><p>{t("Saved notes could not be loaded.")} {notesError}</p><button className="secondary" disabled={notesBusy} onClick={() => void refreshNotes()}>{t("Retry loading notes")}</button></div>}
          {!notesBusy && !notesError && !notes.length && <div className="ask-empty ask-library-empty"><span className="ask-empty-icon"><Icon name="bookmark" /></span><h2>{t("No saved conversations yet")}</h2><p>{t("Save a useful answer in Ask to revisit it here.")}<br />{t("Your saved CLI notes appear here too.")}</p><a className="secondary" href="#ask">Ask your first question<Icon name="arrow" /></a></div>}
          {!notesBusy && !notesError && notes.length > 0 && !matching.length && <div className="ask-empty ask-library-empty"><span className="ask-empty-icon"><Icon name="word-lookup" /></span><h2>{t("No notes match these filters")}</h2><p>{t("Try a different category or topic.")}</p><button className="secondary" onClick={clearFilters}>{t("Clear filters")}</button></div>}
          <nav ref={listRef} className="ask-note-list" aria-label="Saved Ask notes" aria-busy={notesBusy}>{matching.map(note => <article key={note.id} className="ask-note-tile">
            <div className="ask-note-card-top"><span className="ask-note-category">{t(note.category || "Uncategorized")}</span><IconButton className="ask-note-copy" quiet icon={copiedNote === `summary:${note.id}` ? "check" : "copy"} label={copiedNote === `summary:${note.id}` ? t("Copied summary") : `${t("Copy summary")}: ${noteTitle(note)}`} onClick={() => void copyNote(noteExcerpt(note), `summary:${note.id}`)} /></div>
            <button data-note-id={note.id} className="ask-note-link" aria-current={noteOpen && note.id === selectedId ? "true" : undefined} onBlur={event => event.currentTarget.removeAttribute("data-restored-focus")} onKeyDown={event => event.currentTarget.removeAttribute("data-restored-focus")} aria-haspopup="dialog" aria-controls="ask-note-reader" onClick={() => openNote(note)}>
              <span className="ask-note-title"><strong title={noteTitle(note)}>{noteTitle(note)}</strong></span>
              <time dateTime={note.modifiedAt}>{t("Updated")} {dateLabel(note.modifiedAt)}</time>
              <span className="ask-note-excerpt">{noteExcerpt(note) || t("Open this note to read the full explanation.")}</span>
            </button>
            {Boolean(note.tags?.length) && <div className="ask-note-topics">{note.tags!.slice(0, 4).map(item => <button type="button" key={item} aria-pressed={tag === item} onClick={() => setTag(tag === item ? "" : item)}>{t(item)}</button>)}{note.tags!.length > 4 && <span className="ask-note-more-tags" title={note.tags!.slice(4).join(", ")}>+{note.tags!.length - 4}</span>}</div>}
            <div className="ask-note-card-footer"><time dateTime={note.modifiedAt} title={`${t("Updated")} ${dateLabel(note.modifiedAt)}`}>{dateLabel(note.modifiedAt, true)}</time><button type="button" className="text-button" onClick={() => openNote(note)}>{t("Read note")}<Icon name="arrow" /></button></div>
          </article>)}</nav>
          <FloatingAction active={active && view === "notes" && notes.length > 0 && !noteOpen} href="#ask" label={t("Ask a question")} icon="ask" />
        </aside>
      </div>
      <dialog ref={dialogRef} className="ask-note-dialog" id="ask-note-reader" style={readerSize ? { "--reader-width": `${readerSize.width}px`, "--reader-height": `${readerSize.height}px` } as CSSProperties : undefined} aria-labelledby="ask-note-title" onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]')].filter((node) => node.getClientRects().length && !node.closest("[inert]"));
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); deleteConfirmRef.current?.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }} onCancel={(event) => { event.preventDefault(); dismissReader(); }} onClick={(event) => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dismissReader(); } }}>
        <div className="ask-note-dialog-bar"><span className="ask-reader-label"><Icon name="document" />{t("Saved note")}</span><div className="ask-reader-controls">{readerSize && !confirmDelete && <button className="text-button ask-reader-reset" onClick={() => setReaderSize(undefined)}>Reset size</button>}<IconButton icon="close" label={t("Close note")} disabled={deleting} onClick={closeNote} /></div></div>
        <article className="ask-note-card" inert={confirmDelete}>
          {selected && <><header><h2 id="ask-note-title">{noteTitle(selected)}</h2><p className="ask-action-status">Updated <time dateTime={selected.modifiedAt}>{dateLabel(selected.modifiedAt)}</time></p><div className="ask-note-metadata" aria-label="Note topics"><button className="secondary" onClick={() => { setCategory(selected.category || "Uncategorized"); closeNote(); }}>{t(selected.category || "Uncategorized")}</button>{(selected.tags || []).map((item) => <button className="text-button" key={item} onClick={() => { setTag(item); closeNote(); }}>{t(item)}</button>)}</div></header><Markdown source={noteBody(selected)} /></>}
        </article>
        <div className={`ask-note-dialog-footer${confirmDelete ? " is-confirming" : ""}`}>
          {confirmDelete ? <div ref={deleteConfirmRef} className="ask-note-delete-confirm" tabIndex={-1} role="group" aria-labelledby="ask-note-delete-prompt" aria-describedby="ask-note-delete-description" aria-busy={deleting}>
            <div className="ask-note-delete-heading"><Icon name="trash" /><h3 id="ask-note-delete-prompt">{t("Delete this note?")}</h3></div>
            <p className="ask-note-delete-title" title={selected ? noteTitle(selected) : undefined}>{selected && noteTitle(selected)}</p>
            <p id="ask-note-delete-description">{t("This permanently deletes the saved note. This cannot be undone.")}</p>
            {deleteError && <p className="ask-error" role="alert">{t(deleteError)}</p>}
            <div className="ask-note-delete-actions">
              <button ref={cancelDeleteRef} className="secondary" disabled={deleting} onClick={cancelDeletion}>{t("Keep note")}</button>
              <button ref={deleteSubmitRef} className="ask-note-delete-submit" disabled={deleting} onClick={() => void deleteNote()}>{deleting ? <span className="loading-spinner" aria-hidden="true" /> : <Icon name="trash" />}{deleting ? t("Deleting…") : deleteError ? t("Retry deletion") : t("Delete permanently")}</button>
            </div>
            {deleting && <span className="sr-only" role="status">{t("Deleting…")}</span>}
          </div> : <>
            <button ref={deleteButtonRef} className="text-button ask-note-delete" disabled={!selected || deleting} onClick={() => setConfirmDelete(true)}><Icon name="trash" />{t("Delete note")}</button>
            <span className="sr-only" id="ask-note-discussion-hint">{t("Use this note as context for a new question.")}</span><button className="secondary ask-note-continue" aria-describedby="ask-note-discussion-hint" disabled={busy || !selected || deleting} onClick={() => selected && start({ turns: [], question: "", context: selected })}>{t("Continue discussion")}<Icon name="arrow" /></button>
            {busy && <p className="ask-action-status">{t("Wait for your current answer before starting another discussion.")}</p>}
          </>}
          {!confirmDelete && <button className="text-button ask-copy-full-note" disabled={!selected} onClick={() => selected && void copyNote(noteBody(selected), `full:${selected.id}`)}><Icon name={selected && copiedNote === `full:${selected.id}` ? "check" : "copy"} />{selected && copiedNote === `full:${selected.id}` ? t("Copied content") : t("Copy note content")}</button>}
          {noteCopyError && <p className="ask-error" role="alert">{noteCopyError}</p>}
        </div>
        <div className="ask-reader-size-bar" hidden={confirmDelete}><span id="ask-reader-resize-hint">{t("Drag the corner to resize · Arrow keys when focused")}</span><button className="ask-reader-resize" type="button" aria-label="Resize note window" aria-describedby="ask-reader-resize-hint" title="Drag to resize. Use arrow keys when focused; Home resets size."
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
