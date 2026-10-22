import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { HandbookKnowledge } from "./HandbookKnowledge";
import { HandbookReports } from "./HandbookReports";
import { webApi } from "./api/client";
import { useDailyReviewSession } from "./review-session";
import clearWriteWordmark from "./assets/clearwrite-wordmark.svg";

type Route =
  | "dashboard"
  | "grammar"
  | "translation"
  | "word-lookup"
  | "word-review"
  | "practice"
  | "ask"
  | "handbook"
  | "coach"
  | "settings";
const items: Array<[Route, string]> = [
  ["grammar", "Grammar"],
  ["translation", "Express"],
  ["word-lookup", "Vocabulary"],
  ["word-review", "Review"],
  ["practice", "Practice"],
  ["ask", "Ask"],
  ["handbook", "Handbook"],
  ["coach", "Coach"],
  ["settings", "Model settings"],
];

function formatActivityTimestamp(value: unknown) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "Unknown date";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Dashboard() {
  const [data, setData] = useState<any>();
  const [error, setError] = useState("");
  useEffect(() => {
    webApi
      .getDashboard()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  if (error) return <State title="Overview is unavailable" detail={error} />;
  if (!data) return <State title="Loading your learning activity…" />;
  const focus = data.coach?.focus;
  return (
    <>
      <Heading
        eyebrow="OVERVIEW"
        title={
          <>
            Support for your English.
            <br />
            <em>Practice beyond the page.</em>
          </>
        }
        detail="ClearWrite helps you check your writing, explore words, and practise expressing ideas. Use it alongside regular reading, listening, and real conversations—learning English takes more than a tool."
      />
      <section className="focus">
        <div>
          <span className="focus-label">
            <Icon name="coach" />
            Current focus
          </span>
          <h2>{focus?.error_type || "Start with your own words"}</h2>
          <p>
            {focus
              ? `Seen ${focus.hits} times recently. Try revisiting it after a break.`
              : "Write about something from your day, then review the suggested changes."}
          </p>
          <a className="primary" href="#grammar">
            Write a sentence
            <Icon name="arrow" />
          </a>
        </div>
        <img
          className="focus-image"
          src="/images/study-desk.webp"
          alt=""
          width="960"
          height="640"
        />
      </section>
      <div className="columns">
        <Panel title="Recent writing" icon="grammar">
          {(data.recentActivity || []).slice(0, 5).map((item: any) => {
            const original = String(item.userInput || "");
            const correction = String(item.correction || "Recorded");
            const isLong = original.length > 160 || correction.length > 160;
            return (
              <article className="activity activity-entry" key={item.entryId}>
                <time className="activity-time" dateTime={item.timestamp || undefined}>
                  {formatActivityTimestamp(item.timestamp)}
                </time>
                <div className="activity-copy">
                  <section className="activity-copy-section">
                    <span className="activity-label">Original</span>
                    <p className={isLong ? "activity-preview is-clamped" : "activity-preview"}>
                      {original}
                    </p>
                  </section>
                  <section className="activity-copy-section activity-correction">
                    <span className="activity-label">Correction</span>
                    <p className={isLong ? "activity-preview is-clamped" : "activity-preview"}>
                      {correction}
                    </p>
                  </section>
                  {isLong && (
                    <details className="activity-full">
                      <summary>Read full entry</summary>
                      <div className="activity-full-content">
                        <section>
                          <strong>Original</strong>
                          <p>{original}</p>
                        </section>
                        <section>
                          <strong>Correction</strong>
                          <p>{correction}</p>
                        </section>
                      </div>
                    </details>
                  )}
                </div>
              </article>
            );
          })}
          {!data.recentActivity?.length && <State title="No saved writing yet" detail="Check a sentence in Grammar, then save the feedback you want to revisit." />}
        </Panel>
        <Panel title="Your activity here" icon="word-review">
          <div className="stat">
            {data.stats?.totalInputs || 0}
            <small> review entries</small>
          </div>
          <p>
            Today: {data.today?.inputs_today || 0} entries · Words due{" "}
            {data.stats?.dueCounts?.vocab || 0}
          </p>
          <div className="daily-effort" aria-label="Activity over the last seven days">
            <span className="eyebrow">Last 7 days</span>
            {(data.stats?.dailyEffort || [])
              .slice()
              .reverse()
              .map((item: any) => (
                <div className="effort-row" key={item.day}>
                  <small>{item.day.slice(5)}</small>
                  <div className="effort-track">
                    <span style={{ width: `${Math.min(100, item.count * 20)}%` }} />
                  </div>
                  <strong>{item.count}</strong>
                </div>
              ))}
          </div>
        </Panel>
      </div>
      <Panel title="Your learning library" icon="handbook">
        <div className="asset-list">
          {[
            ["Review log", data.assets?.reviewLog],
            ["Vocabulary", data.assets?.vocabulary],
            ["Ask", data.assets?.ask],
            ["Practice", data.assets?.practice],
          ].map(([label, available]) => (
            <div className="asset-row" key={String(label)}>
              <span>{label}</span>
              <strong className={available ? "asset-ok" : "asset-missing"}>
                {available ? "Available" : "Not found"}
              </strong>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

function Grammar() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<any>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  const [checkedText, setCheckedText] = useState("");
  const [saving, setSaving] = useState(false);
  const [didSave, setDidSave] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    if (!text.trim() || busy || saving) return;
    const submitted = text.trim();
    setBusy(true);
    setSaved("");
    setResult(undefined);
    setDidSave(false);
    try {
      setResult(await webApi.checkGrammar(submitted));
      setCheckedText(submitted);
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const data = result?.result || result?.data;
    if (!data || saving || didSave) return;
    setSaving(true);
    try {
      const response = await webApi.saveGrammar(checkedText, data);
      setDidSave(Boolean(response.persistence?.saved));
      setSaved(
        response.persistence?.saved
          ? "Saved to your review log."
          : "Your review log was not saved. Try again.",
      );
    } catch (e: any) {
      setSaved("Could not save: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  const data = result?.result || result?.data;
  const diagnoses = (data?.diagnoses || []).map((item: any) =>
    typeof item === "string"
      ? { label: "Issue (Minor)", explanation: item }
      : {
          label: `${(item.error_type || "Issue").split(" / ").pop()} (${item.severity || "Minor"})`,
          explanation: item.explanation || item.message || "No explanation provided.",
        },
  );
  const evaluation = (() => {
    const supplied = typeof data?.evaluate === "string" ? data.evaluate.trim() : "";
    if (
      supplied &&
      !/^(?:no evaluation provided|the original sentence could not be assessed|unable to assess)/i.test(
        supplied,
      )
    )
      return supplied;
    const input = String(data?.originalText || checkedText).trim();
    const normalize = (value: string) =>
      value
        .replace(/\s+/g, " ")
        .replace(/[.!?]+$/, "")
        .toLowerCase();
    const issues = Array.isArray(data?.diagnoses) ? data.diagnoses : [];
    if (input && data?.correction && normalize(input) !== normalize(data.correction)) {
      const count = Math.max(1, issues.length);
      return `The original sentence contains ${count === 1 ? "an error" : "several errors"}.`;
    }
    if (issues.length) {
      return "The original sentence is understandable overall, with some wording that could be improved.";
    }
    if (input && data?.refine && normalize(input) !== normalize(data.refine)) {
      return "The original sentence is grammatically correct. The suggested change is an optional improvement to naturalness.";
    }
    return "The original sentence is grammatically correct and clear.";
  })();

  return (
    <div className={`grammar-page${result ? " has-result" : ""}`}>
      <div className="grammar-intro">
        <h1>
          Write with
          <br />
          <span>
            clarity<span className="accent-dot">.</span>
          </span>
        </h1>
        <p>Check your writing. Understand the suggested changes.</p>
      </div>
      <form
        className="grammar-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        aria-busy={busy}
      >
        <label className="sr-only" htmlFor="grammar-input">
          Your English sentence
        </label>
        <textarea
          ref={inputRef}
          id="grammar-input"
          value={text}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (
              (event.ctrlKey || event.metaKey) &&
              event.key === "Enter" &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Write something in English…"
          aria-describedby="grammar-hint"
        />
        <div className="composer-actions">
          <span id="grammar-hint">
            {busy ? "Checking grammar and wording…" : "A sentence or a short paragraph"}
          </span>
          <button className="primary" type="submit" disabled={busy || saving || !text.trim()}>
            {busy ? (
              <>
                <span className="loading-spinner" />
                Checking…
              </>
            ) : (
              <>
                Check my English
                <Icon name="arrow" />
              </>
            )}
          </button>
        </div>
      </form>
      {!result && !busy && (
        <div className="grammar-examples">
          <span>Need a starting point?</span>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setText("I suggested him to join the call.");
              inputRef.current?.focus();
            }}
          >
            Try an example
            <Icon name="arrow" />
          </button>
        </div>
      )}
      <p className="grammar-note">
        Try writing it yourself first. Use AI feedback as a guide, then practise the expression in your own context. Save only when you choose.
      </p>
      {result?.error && (
        <State title="Could not check your English. Try again." detail={result.error} />
      )}
      {data && (
        <div className="correction-detail" aria-live="polite">
          <DetailSection variant="evaluate" icon="info" title="Evaluate">
            <p>{evaluation}</p>
          </DetailSection>
          <DetailSection
            variant="correction"
            icon="check"
            title="Correction"
            action={<CopyButton value={data.correction} label="Correction" />}
          >
            <p>{data.correction || "No correction needed."}</p>
          </DetailSection>
          {data.refine && (
            <DetailSection
              variant="natural"
              icon="spark"
              title="More natural"
              action={<CopyButton value={data.refine} label="More natural wording" />}
            >
              <p>{data.refine || "No alternative wording provided."}</p>
            </DetailSection>
          )}
          <DetailSection variant="why" icon="info" title="Why">
            {diagnoses.length ? (
              <ul className="grammar-why-list">
                {diagnoses.map((item: { label: string; explanation: string }, index: number) => (
                  <li key={index}>
                    <strong>{item.label}</strong>
                    <p>{item.explanation}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No explanation provided.</p>
            )}
          </DetailSection>
          <DetailSection variant="remember" icon="idea" title="Remember">
            <p>{data.remember || "No reminder provided."}</p>
          </DetailSection>
          <div className="correction-actions">
            <button
              className="primary save-review"
              onClick={save}
              disabled={busy || saving || didSave}
            >
              <Icon name="bookmark" />
              {saving ? "Saving…" : didSave ? "Saved to review log" : "Save to review log"}
            </button>
            {saved && (
              <p className="status" role="status">
                {saved}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function Express() {
  const [text, setText] = useState("");
  const [direction, setDirection] = useState("zh2en");
  const [result, setResult] = useState<any>();
  const [busy, setBusy] = useState(false);
  const toEnglish = direction === "zh2en";
  function changeDirection(nextDirection: string) {
    if (nextDirection === direction) return;
    setDirection(nextDirection);
    setResult(undefined);
  }
  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      setResult(await webApi.translate(text, direction));
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setBusy(false);
    }
  }
  const translation = result?.data?.translation || result?.translation;
  return (
    <>
      <Heading
        eyebrow="EXPRESS"
        title="Find the right words."
        detail="Explore an English version of your Chinese text, or check what an English passage means in Chinese. Compare the wording, then try expressing the idea yourself."
      />
      <Panel title="Your text" icon="translation">
        <div className="switches">
          <button
            className={direction === "zh2en" ? "selected" : ""}
            aria-pressed={toEnglish}
            disabled={busy}
            onClick={() => changeDirection("zh2en")}
          >
            Chinese → English
          </button>
          <button
            className={direction === "en2zh" ? "selected" : ""}
            aria-pressed={!toEnglish}
            disabled={busy}
            onClick={() => changeDirection("en2zh")}
          >
            English → Chinese
          </button>
        </div>
        <label className="form-label" htmlFor="translation-input">
          {toEnglish ? "What do you want to say?" : "What do you want to understand?"}
        </label>
        <textarea
          id="translation-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            toEnglish
              ? "Describe your idea in Chinese. You can include who you’re speaking to and the tone you want."
              : "Paste an English sentence or passage. Include the context if it helps explain the meaning."
          }
        />
        <button className="primary" onClick={submit} disabled={busy || !text.trim()}>
          {busy
            ? toEnglish
              ? "Finding the right words…"
              : "Explaining the meaning…"
            : toEnglish
              ? "Say it in English →"
              : "Explain in Chinese →"}
        </button>
      </Panel>
      {result?.error && (
        <State title="Couldn’t find an expression. Try again." detail={result.error} />
      )}
      {translation && (
        <Panel
          title={toEnglish ? "A natural way to say it" : "Meaning in Chinese"}
          icon="translation"
        >
          <p className="translation-result">{translation}</p>
          {result.data?.notes && (
            <DetailSection
              variant="remember"
              icon="idea"
              title={toEnglish ? "Why this works" : "Expression notes"}
            >
              <p>{result.data.notes}</p>
            </DetailSection>
          )}
        </Panel>
      )}
    </>
  );
}
function Ask() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<any[]>([]);
  const [askNotes, setAskNotes] = useState<Array<{ id: string; modifiedAt: string; bytes: number; content: string }>>([]);
  const [askNotesDirectory, setAskNotesDirectory] = useState("");
  const [notesQuery, setNotesQuery] = useState("");
  const [notesBusy, setNotesBusy] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saved, setSaved] = useState("");
  async function send() {
    if (!question.trim()) return;
    const current = question.trim();
    setQuestion("");
    setBusy(true);
    try {
      const result = await webApi.ask(current, turns);
      setTurns((old) => [
        ...old,
        { question: current, answer: result.data?.answer || result.data },
      ]);
    } catch (e: any) {
      setTurns((old) => [...old, { question: current, answer: `Request failed: ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setSaved("Saving your conversation…");
    setSaveBusy(true);
    try {
      const result = await webApi.saveAsk(turns);
      setSaved(result.saved ? "Conversation saved" : "There is no conversation to save yet.");
      if (result.saved) await refreshAskNotes();
    } catch (e: any) {
      setSaved(`Could not save: ${e.message}`);
    } finally {
      setSaveBusy(false);
    }
  }
  async function refreshAskNotes() {
    setNotesError("");
    setNotesBusy(true);
    try {
      const result = await webApi.listAskNotes();
      const notes = await Promise.all(result.notes.map(async (note) => {
        const content = typeof note.content === "string" ? note.content : (await webApi.readAskNote(note.id)).content;
        return { ...note, content };
      }));
      setAskNotes(notes);
      setAskNotesDirectory(result.directory);
    } catch (e: any) {
      setNotesError(e.message || "Could not load saved Ask notes.");
    } finally {
      setNotesBusy(false);
    }
  }
  useEffect(() => { void refreshAskNotes(); }, []);
  const matchingNotes = askNotes.filter((note) => {
    const query = notesQuery.trim().toLocaleLowerCase();
    return !query || note.id.toLocaleLowerCase().includes(query) || note.content.toLocaleLowerCase().includes(query);
  });
  return (
    <>
      <Heading
        eyebrow="ASK"
        title="Ask about your English."
        detail="Ask about grammar, word choice, or tone. Include a sentence for context, and ask for examples you can try using yourself. AI explanations may need checking."
      />
      <Panel title="Your conversation" icon="ask">
        {turns.map((turn, index) => (
          <div className="ask-turn" key={`${turn.question}-${index}`}>
            <strong>{turn.question}</strong>
            <Markdown source={String(turn.answer ?? "")} />
          </div>
        ))}
        {!turns.length && (
          <State
            title="What would you like to understand?"
            detail="Start with a question about English."
          />
        )}
        <label className="form-label" htmlFor="ask-input">
          Your question
        </label>
        <textarea
          id="ask-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about a phrase, a rule, or a difference…"
        />
        <button className="primary" onClick={send} disabled={busy}>
          {busy ? "Thinking…" : "Ask →"}
        </button>
        <button className="secondary" onClick={save} disabled={saveBusy}>
          {saveBusy ? "Saving…" : "Save conversation"}
        </button>
        {saved && <p className="status">{saved}</p>}
      </Panel>
      <Panel title="Saved Ask notes" icon="document" className="ask-library-panel">
        {!notesBusy && !notesError && askNotes.length > 0 && <div className="ask-library-toolbar">
          <label className="sr-only" htmlFor="ask-notes-search">Search saved notes</label>
          <input id="ask-notes-search" type="search" value={notesQuery} onChange={(event) => setNotesQuery(event.target.value)} placeholder="Search notes by title or content…" />
          <span>{matchingNotes.length} of {askNotes.length}</span>
        </div>}
        {askNotesDirectory && <p className="ask-library-directory">Automatically loaded from {askNotesDirectory}</p>}
        {notesBusy ? <State title="Loading saved Ask notes…" /> : notesError ? <State title="Saved Ask notes could not be loaded" detail={notesError} /> : !askNotes.length ? (
          <State title="No Markdown notes found" detail="Save a conversation from the CLI and it will appear here automatically." />
        ) : matchingNotes.length ? (
          <div className="ask-note-list">
            {matchingNotes.map((note) => (
              <article className="ask-note-card" key={note.id}>
                <header>
                  <h3>{note.id.replace(/\.md$/i, "")}</h3>
                  <time dateTime={note.modifiedAt}>{new Date(note.modifiedAt).toLocaleDateString()}</time>
                </header>
                <Markdown source={note.content} />
              </article>
            ))}
          </div>
        ) : <State title="No notes match this search" detail="Try another title or phrase." />}
      </Panel>
    </>
  );
}
function WordReview() {
  const {
    cards,
    index,
    revealed,
    loading,
    grading,
    starting,
    startError,
    error,
    notice,
    reveal,
    grade,
    retry,
    startNew,
  } = useDailyReviewSession();
  const card = cards[index];
  const details = card?.vocab_details;
  const examples = details?.examples?.length ? details.examples : [card?.example].filter(Boolean);
  const complete = !loading && !error && !card;
  const sessionAction = (
    <div className="review-session-actions">
      <button
        className={complete ? "primary" : "secondary"}
        onClick={startNew}
        disabled={loading || grading || starting}
        aria-busy={starting}
      >
        {starting ? "Starting…" : "Start a new session"}
        <Icon name="arrow" />
      </button>
    </div>
  );
  return (
    <div className="word-review-page">
      <div className="review-header">
        <Heading
          eyebrow="VOCABULARY · REVIEW"
          title="Bring words back."
          detail="Recall the English word from the Chinese clue. Reveal it, then rate your recall."
        />
        {!complete && sessionAction}
      </div>
      {startError && (
        <State title="Could not start a new session. Try again." detail={startError} />
      )}
      {loading && <State title="Loading your review…" />}
      {notice && (
        <p className="status" role="status">
          {notice}
        </p>
      )}
      {error && (
        <>
          <State
            title={
              card
                ? "Could not save your rating. Try again."
                : "Could not load your review. Try again."
            }
            detail={error}
          />
          {!card && <button onClick={retry}>Try again</button>}
        </>
      )}
      {complete && (
        <Panel title="Your review today" icon="word-review" className="review-empty-state">
          <div className="review-completion" role="status">
            <span className="review-completion-mark" aria-hidden="true">
              <Icon name="check" />
            </span>
            <h3>{cards.length ? "Review session complete." : "No vocabulary cards due."}</h3>
            <p>
              {cards.length
                ? `You reviewed ${cards.length} vocabulary cards. Try using a few of these words in a sentence or conversation.`
                : "Come back later, or look up a word and save it to your vocabulary."}
            </p>
          </div>
          {sessionAction}
        </Panel>
      )}
      {card && (
        <Panel
          title={`Card ${index + 1} of ${cards.length}`}
          icon="word-review"
          className="review-card"
        >
          <div className="review-progress" aria-label={`Card ${index + 1} of ${cards.length}`}>
            <span style={{ width: `${((index + 1) / cards.length) * 100}%` }} />
          </div>
          {!revealed ? (
            <div className="review-prompt">
              <span className="review-kicker">Recall before you reveal</span>
              <h2>{card.zh || "Recall this English expression"}</h2>
              <p>{card.meaning || "Use the Chinese clue, then reveal the word."}</p>
              <div className="review-prompt-actions">
                <AudioButton text={card.word || card.answer} reviewPrompt />
                <button className="primary" onClick={reveal} disabled={starting}>
                  Reveal word
                  <span className="review-cta-icon" aria-hidden="true">
                    <Icon name="arrow" />
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <WordDetails
                entry={{
                  word: card.word || card.answer,
                  pos: card.pos || details?.pos,
                  phonetic: details?.phonetic || details?.phonetics,
                  meaning: card.meaning,
                  zh: card.zh,
                  synonyms: details?.synonyms,
                  collocations: details?.collocations,
                  note: details?.note || card.note,
                }}
                examples={examples}
              />
              <div className="review-actions" aria-busy={grading}>
                <button disabled={grading || starting} onClick={() => grade("again")}>
                  <span>Again</span>
                  <small>Could not recall</small>
                </button>
                <button disabled={grading || starting} onClick={() => grade("hard")}>
                  <span>Hard</span>
                  <small>With difficulty</small>
                </button>
                <button disabled={grading || starting} onClick={() => grade("good")}>
                  <span>Good</span>
                  <small>Remembered</small>
                </button>
                <button disabled={grading || starting} onClick={() => grade("easy")}>
                  <span>Easy</span>
                  <small>Effortless</small>
                </button>
              </div>
            </>
          )}
        </Panel>
      )}
    </div>
  );
}
function Coach() {
  const [data, setData] = useState<any>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load(refresh = false) {
    setBusy(true);
    setError("");
    try {
      setData(await (refresh ? webApi.analyzeCoach() : webApi.getCoach()));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="coach-page">
      <div className="coach-header">
        <Heading
          eyebrow="COACH · SUGGESTIONS"
          title="Find your next step."
          detail="Find possible practice priorities in your saved writing. These suggestions reflect your activity here, not a full assessment of your English."
        />
        <button className="secondary" onClick={() => load(true)} disabled={busy}>
          {busy ? "Analysing…" : "Refresh analysis"}
        </button>
      </div>
      {error && <State title="Coach is unavailable" detail={error} />}
      {!data && !error && <State title="Looking at your learning history…" />}
      {data && (
        <>
          <Panel title="Learning history" className="coach-sample">
            <dl className="coach-sample-grid">
              <div>
                <dt>Writing entries</dt>
                <dd>
                  {data.sample?.totalInputs || 0}
                  <span> entries</span>
                </dd>
              </div>
              <div>
                <dt>Grammar observations</dt>
                <dd>
                  {data.sample?.totalDiagnoses || 0}
                  <span> observations</span>
                </dd>
              </div>
              <div>
                <dt>Time window</dt>
                <dd>
                  {data.windowDays ?? "—"}
                  <span> days</span>
                </dd>
              </div>
            </dl>
          </Panel>
          {(data.priorities || []).length > 0 ? (
            <Panel title="Where to focus" className="coach-priorities">
              {(data.priorities || []).map((item: any) => (
                <article className="coach-priority" key={item.errorType}>
                  <h3>{item.errorType}</h3>
                  {item.mechanism?.statement && (
                    <p className="coach-mechanism">{item.mechanism.statement}</p>
                  )}
                  <ol className="coach-tasks">
                    {item.prescription?.slice(0, 2).map((phase: any) => (
                      <li key={phase.phase}>
                        <strong>{phase.name}</strong>
                        {phase.task && <p>{phase.task}</p>}
                        {phase.check && (
                          <p className="coach-check">
                            <span>How to check</span>
                            {phase.check}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </Panel>
          ) : (
            <Panel title="A little more practice first." className="coach-empty-priorities">
              <p>
                There is not enough evidence to choose a focus yet. Keep saving your writing and
                feedback, then check back.
              </p>
            </Panel>
          )}
          <Panel title="What this evidence can tell us" className="coach-limitations">
            {data.limitations?.length ? (
              <ul>
                {data.limitations.map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>These suggestions are based on the records available here. They do not show everything you know or how you use English elsewhere.</p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
function WordLookup() {
  const [query, setQuery] = useState("");
  const [entry, setEntry] = useState<any>();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function lookup() {
    if (!query.trim()) return;
    setBusy(true);
    setStatus("");
    try {
      const result = await webApi.lookupWord(query.trim());
      setEntry(result.data);
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function add() {
    try {
      const result = await webApi.addWord(entry);
      setStatus(
        result.persistence?.saved
          ? "Saved to your vocabulary"
          : "This word is already in your vocabulary.",
      );
    } catch (e: any) {
      setStatus(e.message);
    }
  }
  const examples = [entry?.example || entry?.example1, entry?.example2, entry?.example3].filter(
    Boolean,
  );
  return (
    <div className="word-page">
      <Heading
        eyebrow="WORD LOOKUP"
        title="Get to know a word."
        detail="Look up meanings, examples, and common word combinations. Save useful words for review, then look for them in what you read and hear."
      />
      <Panel title="Word or phrase" icon="word-lookup" className="lookup-form">
        <label className="form-label" htmlFor="word-lookup-input">
          Word or phrase
        </label>
        <div className="lookup-row">
          <input
            id="word-lookup-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="Try “consolidate”"
          />
          <button className="primary" onClick={lookup} disabled={busy}>
            {busy ? (
              "Looking it up…"
            ) : (
              <>
                Look up
                <Icon name="arrow" />
              </>
            )}
          </button>
        </div>
      </Panel>
      {entry && (
        <Panel title={entry.word} icon="word-lookup" className="lookup-result">
          <WordDetails entry={entry} examples={examples} />
          <button className="primary" onClick={add}>
            <Icon name="handbook" />
            Save to vocabulary
            <Icon name="arrow" />
          </button>
        </Panel>
      )}
      {status && (
        <p className="status" role="status">
          {status}
        </p>
      )}
    </div>
  );
}

function WordDetails({ entry, examples }: { entry: any; examples: string[] }) {
  return (
    <div className="word-details">
      <div className="word-heading">
        <div>
          <div className="word-heading-meta">
            {entry.pos && <span className="word-pos">{entry.pos}</span>}
            {entry.phonetic && <span className="word-phonetic">{entry.phonetic}</span>}
          </div>
          <h3>{entry.word}</h3>
        </div>
        <AudioButton text={entry.word} />
      </div>
      {entry.meaning && (
        <section className="word-detail-block word-meaning">
          <div className="word-detail-icon">
            <Icon name="handbook" />
          </div>
          <div>
            <h4>Meaning</h4>
            <p>{entry.meaning}</p>
          </div>
        </section>
      )}
      <div className="word-detail-pair">
        {entry.zh && (
          <section className="word-detail-block word-translation">
            <div className="word-detail-icon">
              <Icon name="translation" />
            </div>
            <div>
              <h4>中文</h4>
              <p>{entry.zh}</p>
            </div>
          </section>
        )}
        {entry.synonyms && (
          <section className="word-detail-block word-synonyms">
            <div className="word-detail-icon">
              <Icon name="idea" />
            </div>
            <div>
              <h4>Synonyms</h4>
              <p>{entry.synonyms}</p>
            </div>
          </section>
        )}
      </div>
      {entry.collocations && (
        <section className="word-detail-block word-collocations">
          <div className="word-detail-icon">
            <Icon name="grammar" />
          </div>
          <div>
            <h4>Collocations</h4>
            <p>{entry.collocations}</p>
          </div>
        </section>
      )}
      {examples.length > 0 && (
        <section className="word-detail-block word-examples">
          <div className="word-detail-icon">
            <Icon name="ask" />
          </div>
          <div className="word-examples-content">
            <h4>Examples</h4>
            <ol>
              {examples.map((example, index) => (
                <li key={index}>
                  <span className="example-number">{index + 1}</span>
                  <span className="example-copy">
                    <span className="example-text">{example}</span>
                    <span className="example-controls">
                      <AudioButton text={example} small />
                      <CopyButton value={example} label={`Example ${index + 1}`} small />
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
      {entry.note && (
        <section className="word-detail-block word-note">
          <div className="word-detail-icon">
            <Icon name="idea" />
          </div>
          <div>
            <h4>Note</h4>
            <p>{entry.note}</p>
          </div>
        </section>
      )}
    </div>
  );
}
const practiceContextIcons: Record<string, React.ComponentProps<typeof Icon>["name"]> = {
  all: "dashboard",
  home: "home",
  dining: "dining",
  shopping: "shopping",
  entertainment: "entertainment",
  social: "ask",
  health: "health",
  work: "work",
  transit: "transit",
  travel: "travel",
  services: "services",
};

function PracticeFilter({
  label,
  value,
  setValue,
  options,
  names,
  disabled,
}: {
  label: string;
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  options: string[];
  names: Record<string, string>;
  disabled: boolean;
}) {
  const pickerRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    const positionMenu = () => {
      if (!picker.open) return;
      const trigger = picker.querySelector("summary")!;
      const menu = picker.querySelector<HTMLElement>(".practice-picker-menu")!;
      const rect = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      // Leave room for the gap and a small viewport gutter on either side.
      const below = Math.max(0, viewportBottom - rect.bottom - 14);
      const above = Math.max(0, rect.top - viewportTop - 14);
      const opensAbove = below < Math.min(300, menu.scrollHeight) && above > below;
      picker.dataset.side = opensAbove ? "above" : "below";
      menu.style.maxHeight = Math.min(300, opensAbove ? above : below) + "px";
    };
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape" && picker.open) {
        picker.open = false;
        picker.querySelector("summary")?.focus();
      }
    };
    const dismissOutside = (event: PointerEvent) => {
      if (picker.open && event.target instanceof Node && !picker.contains(event.target)) {
        picker.open = false;
      }
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    picker.addEventListener("toggle", positionMenu);
    picker.addEventListener("keydown", dismiss);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    window.visualViewport?.addEventListener("resize", positionMenu);
    window.visualViewport?.addEventListener("scroll", positionMenu);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      picker.removeEventListener("toggle", positionMenu);
      picker.removeEventListener("keydown", dismiss);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      window.visualViewport?.removeEventListener("resize", positionMenu);
      window.visualViewport?.removeEventListener("scroll", positionMenu);
    };
  }, []);

  return (
    <fieldset className="practice-filter" disabled={disabled}>
      <legend>
        <span className="practice-step" aria-hidden="true">
          3
        </span>
        {label}
      </legend>
      <p className="practice-section-hint">Choose a context or keep all contexts.</p>
      <details className="practice-picker" ref={pickerRef}>
        <summary
          aria-label={`${label}: ${names[value]}`}
          aria-disabled={disabled}
          onClick={(event) => {
            if (disabled) event.preventDefault();
          }}
        >
          <Icon name={practiceContextIcons[value]} />
          <span>{names[value]}</span>
          <Icon name="chevron" className="picker-chevron" />
        </summary>
        <div className="practice-picker-menu" role="group" aria-label={`${label} options`}>
          {options.map((option) => (
            <button
              type="button"
              aria-pressed={value === option}
              className={value === option ? "selected" : ""}
              key={option}
              onClick={(event) => {
                setValue(option);
                const picker = event.currentTarget.closest("details");
                picker?.removeAttribute("open");
                picker?.querySelector("summary")?.focus();
              }}
            >
              <Icon name={practiceContextIcons[option]} />
              <span>{names[option]}</span>
              {value === option && <Icon name="check" />}
            </button>
          ))}
        </div>
      </details>
    </fieldset>
  );
}

function Practice() {
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const targetErrorType = params.get("targetErrorType") || "";
  const returnDays = ["0", "30", "90"].includes(params.get("returnDays") || "") ? params.get("returnDays")! : "90";
  const handbookHref = `#handbook?${new URLSearchParams({ errorType: targetErrorType, days: returnDays })}`;
  const [context, setContext] = useState("all");
  const [count, setCount] = useState(3);
  const [difficulty, setDifficulty] = useState(() => ["easy", "standard", "challenge"].includes(params.get("difficulty") || "") ? params.get("difficulty")! : "standard");
  const [hintsUsed, setHintsUsed] = useState(0);
  const [generationError, setGenerationError] = useState("");
  const [sessionNotice, setSessionNotice] = useState("");
  const [saveWarning, setSaveWarning] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<any>();
  const [busy, setBusy] = useState(false);
  const evaluationRequestId = useRef(0);
  async function generate() {
    if (busy) return;
    evaluationRequestId.current += 1;
    setBusy(true);
    setGenerationError("");
    setSessionNotice("");
    setSaveWarning("");
    try {
      const result = await webApi.generatePractice("sentence", count, difficulty, "all", context, targetErrorType);
      const generated = result.data?.questions || [];
      if (!generated.length)
        throw new Error(targetErrorType ? "No questions match this target at the selected difficulty and context. Try another difficulty, choose all contexts or return to Handbook." : "No questions match these categories. Try a different style or context.");
      if (generated.length < count)
        setSessionNotice(
          `Prepared ${generated.length} of ${count} questions available for these categories.`,
        );
      setEvaluation(undefined);
      setQuestions(generated);
      setIndex(0);
      setHintsUsed(0);
      setAnswer("");
    } catch (e: any) {
      setGenerationError(
        e.code === "REQUEST_TIMEOUT"
          ? "Preparing questions took too long. Please try again."
          : e.message || "Practice could not be generated. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function evaluate() {
    const question = questions[index];
    if (!question || !answer.trim() || busy) return;
    const requestId = ++evaluationRequestId.current;
    setEvaluation(undefined);
    setSaveWarning("");
    setBusy(true);
    try {
      const result = await webApi.evaluatePractice(question, answer, hintsUsed);
      if (requestId !== evaluationRequestId.current) return;
      setEvaluation(result.data);
      setSaveWarning(result.persistence?.saved === false ? result.persistence.warning : "");
    } catch (e: any) {
      if (requestId !== evaluationRequestId.current) return;
      setEvaluation({ error: e.message });
    } finally {
      if (requestId === evaluationRequestId.current) setBusy(false);
    }
  }

  const question = questions[index];
  const prompt = question?.prompt_zh;
  const categoryName: Record<string, string> = {
    all: "All contexts",
    casual: "Casual",
    neutral: "Neutral",
    formal: "Formal",
    home: "Home",
    dining: "Dining",
    shopping: "Shopping",
    entertainment: "Entertainment",
    social: "Social",
    health: "Health",
    work: "Work",
    transit: "Transit",
    travel: "Travel",
    services: "Services",
  };
  const difficultyName: Record<string, string> = {
    easy: "Easy",
    standard: "Standard",
    challenge: "Challenge",
  };
  const hints = question
    ? [question.hints?.simple, question.hints?.intermediate, question.hints?.complete].filter(
        Boolean,
      )
    : [];
  const hintLabels = ["Simple hint", "Intermediate hint", "Complete pattern"];

  return (
    <>
      <Heading
        eyebrow="PRACTICE"
        title="Put your English to work."
        detail="Try translating a Chinese sentence into English before checking the AI feedback. Use the suggestions to revise your answer and try a new sentence of your own."
      />
      {targetErrorType && <section className="practice-target" aria-label="Handbook learning target">
        <h2>{targetErrorType}</h2>
        <p>Related sentence practice from your Handbook. Your overall translation score and hints used will be recorded separately from mastery of this pattern.</p>
        <a href={handbookHref}>Return to this Handbook category</a>
        {!question && <a href="#practice">Practise without this target</a>}
      </section>}
      {!question && (
        <div className="practice-config">
          <section className="practice-setup" aria-label="Set up your practice">
            <fieldset className="question-count" disabled={busy}>
              <legend>
                <span className="practice-step" aria-hidden="true">
                  1
                </span>
                Number of questions
              </legend>
              <p className="practice-section-hint">Choose how many questions for this session.</p>
              <div className="count-options count-segments">
                {[3, 5, 10].map((value) => (
                  <label className={count === value ? "selected" : ""} key={value}>
                    <input
                      type="radio"
                      name="practice-count"
                      value={value}
                      checked={count === value}
                      onChange={() => setCount(value)}
                    />
                    <Icon name="document" />
                    <span className="practice-choice-copy">
                      <strong>{value} questions</strong>
                      <small>
                        {value === 3
                          ? "A quick practice"
                          : value === 5
                            ? "A balanced session"
                            : "A deeper practice"}
                      </small>
                    </span>
                    <Icon name="check" className="practice-choice-check" />
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="practice-difficulty-section">
              <fieldset className="practice-difficulty" disabled={busy}>
                <legend>
                  <span className="practice-step" aria-hidden="true">
                    2
                  </span>
                  Difficulty
                </legend>
                <p className="practice-section-hint">
                  Match the level to your current ability and goal.
                </p>
                <div className="count-options difficulty-segments">
                  {(["easy", "standard", "challenge"] as const).map((value) => (
                    <label className={difficulty === value ? "selected" : ""} key={value}>
                      <input
                        type="radio"
                        name="practice-difficulty"
                        value={value}
                        checked={difficulty === value}
                        onChange={() => setDifficulty(value)}
                      />
                      <Icon
                        name={
                          value === "easy" ? "idea" : value === "standard" ? "dashboard" : "coach"
                        }
                      />
                      <span className="practice-choice-copy">
                        <strong>{difficultyName[value]}</strong>
                        <small>
                          {value === "easy"
                            ? "One familiar idea"
                            : value === "standard"
                              ? "A realistic choice"
                              : "Precise, connected English"}
                        </small>
                      </span>
                      <Icon name="check" className="practice-choice-check" />
                    </label>
                  ))}
                </div>
                <p className="practice-mode-hint">
                  <Icon name="info" />
                  <span>
                    Easy uses one familiar idea; Standard adds a realistic choice; Challenge asks
                    for more precise, connected English.
                  </span>
                </p>
              </fieldset>
            </div>
            <div className="practice-config-lower">
              <div className="practice-filter-stack">
                <PracticeFilter
                  label="Context"
                  value={context}
                  setValue={setContext}
                  options={[
                    "all",
                    "home",
                    "dining",
                    "shopping",
                    "entertainment",
                    "social",
                    "health",
                    "work",
                    "transit",
                    "travel",
                    "services",
                  ]}
                  names={categoryName}
                  disabled={busy}
                />
              </div>
            </div>
          </section>
          <aside className="practice-guide" aria-labelledby="practice-guide-title">
            <h2 id="practice-guide-title">
              <Icon name="handbook" />
              How to practise
            </h2>
            <div className="practice-guide-item">
              <Icon name="document" />
              <div>
                <h3>Start with a sentence</h3>
                <p>Choose a level and context for a short session from the question bank.</p>
              </div>
            </div>
            <div className="practice-guide-item">
              <Icon name="translation" />
              <div>
                <h3>Try it yourself</h3>
                <p>
                  Write your own translation first. If you get stuck, reveal a hint one step at a time.
                </p>
              </div>
            </div>
            <div className="practice-guide-item">
              <Icon name="ask" />
              <div>
                <h3>Learn from feedback</h3>
                <p>Compare the suggestions with your answer. The reference is one possible expression; other answers may also work.</p>
              </div>
            </div>
            <p className="practice-guide-note">
              <Icon name="bookmark" />
              Your attempts are recorded. One good answer is a useful step; try using the expression again later.
            </p>
          </aside>
          <aside className="practice-session" aria-label="Your session">
            <p className="practice-session-label">Your session</p>
            <ul>
              <li>
                <Icon name="document" />
                <span>{count} questions</span>
              </li>
              <li>
                <Icon name="dashboard" />
                <span>{difficultyName[difficulty]}</span>
              </li>
              <li>
                <Icon name={practiceContextIcons[context]} />
                <span>{categoryName[context]}</span>
              </li>
            </ul>
            <button
              className="primary practice-generate"
              onClick={generate}
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? (
                <>
                  <span className="loading-spinner" aria-hidden="true" />
                  Preparing…
                </>
              ) : (
                <>
                  Start practice
                  <Icon name="arrow" />
                </>
              )}
            </button>
          </aside>
        </div>
      )}
      {!question && generationError && (
        <State title="Could not prepare practice. Please try again." detail={generationError} />
      )}
      {question && (
        <Panel
          title={"Question " + (index + 1) + " of " + questions.length}
          icon="practice"
          className="practice-question"
        >
          {sessionNotice && (
            <p className="practice-warning" role="status">
              {sessionNotice}
            </p>
          )}
          <div
            className="practice-progress"
            aria-label={"Question " + (index + 1) + " of " + questions.length}
          >
            <span style={{ width: ((index + 1) / questions.length) * 100 + "%" }} />
          </div>
          <div className="practice-prompt">
            <span className="review-kicker">
              {difficultyName[question.difficulty]} · {categoryName[question.style]} ·{" "}
              {categoryName[question.context]}
            </span>
            <h2>{prompt}</h2>
            <p>Translate this sentence into English.</p>
            {question.focus_id && (
              <p className="practice-mode-hint">
                {question.focus_id} · {question.focus}
              </p>
            )}
          </div>
          {hints.length > 0 && (
            <section className="practice-hints" aria-label="Optional translation hints">
              <button
                type="button"
                className="secondary"
                disabled={busy || hintsUsed >= hints.length || !!(evaluation && !evaluation.error)}
                aria-controls="practice-hint-list"
                onClick={() => setHintsUsed((n) => Math.min(n + 1, hints.length))}
              >
                {hintsUsed < hints.length
                  ? `Show ${hintLabels[hintsUsed].toLowerCase()}`
                  : "All hints shown"}
              </button>
              <p className="practice-mode-hint">
                {hintsUsed}/3 hints used · The complete pattern leaves the translation for you.
              </p>
              <ol id="practice-hint-list" aria-live="polite" aria-relevant="additions">
                {hints.slice(0, hintsUsed).map((hint, i) => (
                  <li key={i}>
                    <strong>{hintLabels[i]}</strong>
                    <p>{hint}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <label className="form-label" htmlFor="practice-input">
            Your translation in English
          </label>
          <textarea
            id="practice-input"
            value={answer}
            disabled={busy}
            onChange={(e) => {
              setAnswer(e.target.value);
              setEvaluation(undefined);
              setSaveWarning("");
            }}
            placeholder="Write your translation in English…"
          />
          <button className="primary" onClick={evaluate} disabled={busy || !answer.trim()}>
            {busy ? (
              "Reviewing…"
            ) : (
              <>
                Check answer
                <Icon name="arrow" />
              </>
            )}
          </button>
          {evaluation?.error && (
            <State title="Could not review this answer. Try again." detail={evaluation.error} />
          )}
          {saveWarning && (
            <p className="practice-warning" role="status">
              {saveWarning}
            </p>
          )}
          {evaluation && !evaluation.error && (
            <PracticeEvaluation
              evaluation={evaluation}
              answer={answer}
              question={{ ...question, reference_answer: evaluation.reference_answer }}
              nextLabel={index + 1 < questions.length ? "Next question" : "Finish session"}
              onNext={() => {
                evaluationRequestId.current += 1;
                setBusy(false);
                setIndex((n) => n + 1);
                setHintsUsed(0);
                setAnswer("");
                setEvaluation(undefined);
                setSaveWarning("");
              }}
            />
          )}
        </Panel>
      )}
    </>
  );
}

const practiceVerdicts: Record<string, string> = {
  excellent: "Clear and natural",
  good: "Well expressed",
  needs_work: "Room to improve",
  incorrect: "Give it another look",
};

function PracticeEvaluation({
  evaluation,
  answer,
  question,
  nextLabel,
  onNext,
}: {
  evaluation: any;
  answer: string;
  question: any;
  nextLabel: string;
  onNext: () => void;
}) {
  const strengths = Array.isArray(evaluation.strengths_zh)
    ? evaluation.strengths_zh.filter(Boolean)
    : [];
  const improvements = Array.isArray(evaluation.improvements_zh)
    ? evaluation.improvements_zh.filter(Boolean)
    : [];
  const score = Number.isFinite(Number(evaluation.score))
    ? Math.max(0, Math.min(100, Number(evaluation.score)))
    : undefined;
  const verdict = practiceVerdicts[evaluation.verdict] || "Your feedback";
  return (
    <section className="evaluation" aria-live="polite" aria-label="Practice feedback">
      <div className="evaluation-summary">
        {score !== undefined && (
          <div className="evaluation-score">
            <strong>{score}</strong>
            <span>/ 100</span>
          </div>
        )}
        <div>
          <span className="evaluation-phase-label">Your feedback</span>
          <h3>{verdict}</h3>
          <p>
            {evaluation.feedback_zh ||
              "Compare your answer with the revision. Check the meaning and grammar."}
          </p>
        </div>
      </div>
      <div className="evaluation-phases">
        <section className="evaluation-phase">
          <span className="phase-index">01</span>
          <div>
            <h4>Your answer</h4>
            <p>{answer}</p>
          </div>
        </section>
        <section className="evaluation-phase evaluation-correction">
          <span className="phase-index">02</span>
          <div>
            <h4>Suggested revision</h4>
            <p>{evaluation.corrected_answer || "No revision provided."}</p>
          </div>
        </section>
        {question.reference_answer && question.reference_answer !== evaluation.corrected_answer && (
          <section className="evaluation-phase evaluation-reference">
            <div>
              <h4>Reference translation</h4>
              <p>{question.reference_answer}</p>
            </div>
          </section>
        )}
        {(strengths.length > 0 || improvements.length > 0) && (
          <section className="evaluation-phase evaluation-notes">
            <span className="phase-index">03</span>
            <div className="evaluation-notes-grid">
              {strengths.length > 0 && (
                <div>
                  <h4>What worked</h4>
                  <ul>
                    {strengths.map((item: string, index: number) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {improvements.length > 0 && (
                <div>
                  <h4>What to work on</h4>
                  <ul>
                    {improvements.map((item: string, index: number) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
      <button className="secondary evaluation-next" onClick={onNext}>
        {nextLabel}
        <Icon name="arrow" />
      </button>
    </section>
  );
}

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

function Handbook() {
  const [data, setData] = useState<any>();
  const [selected, setSelected] = useState(() => new URLSearchParams(location.hash.split("?")[1] || "").get("errorType") || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingSelection, setLoadingSelection] = useState(false);
  const [days, setDays] = useState(() => {
    const value = new URLSearchParams(location.hash.split("?")[1] || "").get("days");
    return value !== null && [0, 30, 90].includes(Number(value)) ? Number(value) : 90;
  });
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const requestId = useRef(0);
  async function load(value = selected, windowDays = days, query = appliedSearch, offset = 0) {
    const id = ++requestId.current;
    setBusy(true);
    setError("");
    try {
      const result = await webApi.getHandbook(value, { days: windowDays, search: query, offset });
      if (id !== requestId.current) return;
      setData(result);
      setSelected(result.selected || "");
      setDays(windowDays);
      setAppliedSearch(query);
    } catch {
      if (id !== requestId.current) return;
      setError("Your handbook could not be loaded. Please try again.");
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }
  useEffect(() => {
    load();
    return () => { requestId.current++; };
  }, []);
  async function choose(value: string) {
    if (value === selected || loadingSelection) return;
    setLoadingSelection(true);
    try {
      await load(value);
    } finally {
      setLoadingSelection(false);
    }
  }
  const hasFrequencies = Boolean(data?.frequencies?.length);
  const preferredDifficulty = ["standard", "easy", "challenge"].find((value) => data?.practice?.byDifficulty?.[value] > 0) || "standard";
  const practiceHref = data?.practice?.status === "available" ? `#practice?${new URLSearchParams({ targetErrorType: selected, difficulty: preferredDifficulty, returnDays: String(data.days) })}` : undefined;
  return (
    <div className="handbook-page">
      <div className="coach-header">
        <Heading
          eyebrow="HANDBOOK · REFERENCE"
          title="Learn from your own words."
          detail="Revisit corrections and notes from your writing. Try a fresh example without looking, then compare it with your notes."
        />
        <button className="secondary" onClick={() => load()} disabled={busy || loadingSelection}>
          {busy ? "Loading…" : "Refresh"}
        </button>
      </div>
      <form className="handbook-filters" onSubmit={(event) => { event.preventDefault(); load("", days, search.trim()); }}>
        <label>Time window<select value={days} disabled={busy} onChange={(event) => load("", Number(event.target.value), appliedSearch)}>
          <option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={0}>All history</option>
        </select></label>
        <label>Search your examples<input type="search" value={search} maxLength={200} onChange={(event) => setSearch(event.target.value)} placeholder="Search sentences, corrections or notes" /></label>
        <button className="primary" type="submit" disabled={busy}>Search</button>
        {appliedSearch && <button type="button" disabled={busy} onClick={() => { setSearch(""); load("", days, ""); }}>Clear search</button>}
      </form>
      <HandbookReports />
      {!data &&
        (busy ? (
          <State title="Loading your handbook…" />
        ) : error ? (
          <Panel title="Unable to load">
            <div className="handbook-empty">
              <State title="Your learning notes could not be loaded." detail={error} />
              <button className="primary" onClick={() => load()}>
                Try again
              </button>
            </div>
          </Panel>
        ) : null)}
      {data && (
        <>
          {error && <State title="Could not update handbook" detail={error} />}
          <Panel title="Your writing history" className="coach-sample">
            <dl className="coach-sample-grid">
              <div>
                <dt>Writing entries</dt>
                <dd>
                  {data.stats?.total_inputs || 0}
                  <span> entries</span>
                </dd>
              </div>
              <div>
                <dt>Grammar observations</dt>
                <dd>
                  {data.stats?.total_diagnoses || 0}
                  <span> observations</span>
                </dd>
              </div>
              <div>
                <dt>Time window</dt>
                <dd>
                  {data.days === 0 ? "All history" : data.days ?? "—"}
                  {data.days !== 0 && <span> days</span>}
                </dd>
              </div>
            </dl>
          </Panel>
          {hasFrequencies ? (
            <>
              <div className="handbook-list" aria-label="Filter by error type">
                {data.frequencies.map((item: any) => (
                  <button
                    className={selected === item.error_type ? "selected" : ""}
                    key={item.error_type}
                    onClick={() => choose(item.error_type)}
                    aria-pressed={selected === item.error_type}
                    disabled={busy || loadingSelection}
                  >
                    {item.error_type}
                    <span>{item.count}</span>
                  </button>
                ))}
              </div>
              <div aria-busy={busy}>
              {busy && <p role="status">Updating examples…</p>}
              <Panel title={selected}>
                {data.evidence && <HandbookKnowledge key={`${selected}:${data.days}:${data.ruleVersion}`} errorType={selected} days={data.days} version={data.ruleVersion} evidence={data.evidence} disabled={busy} practice={data.practice} practiceHref={practiceHref} />}
                {data.examples?.length ? (
                  data.examples.map((item: any, index: number) => (
                    <article
                      className="activity handbook-example"
                      key={item.id || `${item.original_text}-${index}`}
                    >
                      <header className="handbook-source">
                        <span>From your Review log</span>
                        {item.timestamp && <time dateTime={item.timestamp}>{Number.isFinite(Date.parse(item.timestamp)) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.timestamp)) : "Date unavailable"}</time>}
                        {item.entryId && <details><summary>Source details</summary><p>Review log entry: <code>{item.entryId}</code></p><p>Find this entry in your saved Review log using its entry ID.</p></details>}
                      </header>
                      <div>
                        <span>Original</span>
                        {item.correction ? <HandbookSentence original={item.original_text} correction={item.correction} /> : <p lang="en">{item.original_text}</p>}
                      </div>
                      <div>
                        <span>Correction</span>
                        <HandbookSentence original={item.original_text} correction={item.correction || ""} corrected />
                      </div>
                      {item.explanation && (
                        <div>
                          <span>Why</span>
                          <p>{item.explanation}</p>
                        </div>
                      )}
                      {item.remember && (
                        <div>
                          <span>Remember</span>
                          <ul>{String(item.remember).split(/\r?\n/).filter(Boolean).map((note, i) => <li key={i}>{note}</li>)}</ul>
                        </div>
                      )}
                      {item.refine && <details className="handbook-refine"><summary>More natural</summary><p lang="en">{item.refine}</p></details>}
                      {practiceHref && <footer className="handbook-example-action"><a href={practiceHref}>Practice this pattern</a></footer>}
                    </article>
                  ))
                ) : (
                  <div className="handbook-empty">
                    <State
                      title="No examples in this category yet."
                      detail="Keep saving your writing to build a collection of useful examples."
                    />
                  </div>
                )}
              </Panel>
              {data.pagination?.total > 0 && <nav className="handbook-pagination" aria-label="Example pages">
                <span role="status">{data.pagination.offset + 1}–{Math.min(data.pagination.offset + data.pagination.limit, data.pagination.total)} of {data.pagination.total} examples{data.search ? ` matching “${data.search}”` : ""}</span>
                <button disabled={busy || data.pagination.offset === 0} onClick={() => load(selected, days, appliedSearch, Math.max(0, data.pagination.offset - data.pagination.limit))}>Previous</button>
                <button disabled={busy || !data.pagination.hasMore} onClick={() => load(selected, days, appliedSearch, data.pagination.offset + data.pagination.limit)}>Next</button>
              </nav>}
              </div>
            </>
          ) : (
            <Panel title={data.search ? "No matching examples." : "A little more practice first."} className="coach-empty-priorities">
              <div className="handbook-empty">
                {data.search ? <p>No examples match “{data.search}” in this time window. Try another phrase, clear your search or choose a longer time window.</p> : <p>No grammar observations {data.days === 0 ? "in your saved history" : `in the last ${data.days} days`}. Check and save a sentence to start collecting corrections and explanations here.</p>}
                <a className="primary" href="#grammar">
                  Check a sentence
                  <Icon name="arrow" />
                </a>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
const providerNames: Record<string, string> = {
  custom: "OpenAI-compatible",
  ollama: "Ollama (local)",
};

function LlmSettings() {
  const [settingsTab, setSettingsTab] = useState<"models" | "markdown">("models");
  const [data, setData] = useState<any>();
  const [savedData, setSavedData] = useState<any>();
  const [activeProvider, setActiveProvider] = useState("gemini");
  const [editProvider, setEditProvider] = useState("gemini");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [clearApiKeys, setClearApiKeys] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState("");

  useEffect(() => {
    webApi
      .getLlmSettings()
      .then((settings) => {
        if (!settings?.providers || !settings?.provider) {
          throw new Error("Settings are unavailable. Restart IGT and try again.");
        }
        setData(settings);
        setSavedData(settings);
        setActiveProvider(settings.provider);
        setEditProvider(settings.provider);
      })
      .catch((e: any) => setError(e.message || "Could not load model settings"));
  }, []);

  const providerSettings = data?.providers?.[editProvider];
  const updateModel = (role: "flash" | "pro", value: string) => {
    setData((old: any) => ({
      ...old,
      providers: {
        ...old.providers,
        [editProvider]: {
          ...old.providers[editProvider],
          models: { ...old.providers[editProvider].models, [role]: value },
        },
      },
    }));
  };
  const updateBaseUrl = (value: string) => {
    setData((old: any) => ({
      ...old,
      providers: {
        ...old.providers,
        [editProvider]: { ...old.providers[editProvider], baseUrl: value },
      },
    }));
  };

  async function save() {
    if (!data) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const saved = await webApi.saveLlmSettings({
        provider: activeProvider,
        apiKeys,
        clearApiKeys,
        models: Object.fromEntries(
          Object.entries(data.providers).map(([name, value]: [string, any]) => [
            name,
            value.models,
          ]),
        ),
        baseUrls: {
          OllamaBaseUrl: data.providers.ollama?.baseUrl,
          QwenApiBase: data.providers.qwen?.baseUrl,
          DeepseekApiBase: data.providers.deepseek?.baseUrl,
          CustomApiBase: data.providers.custom?.baseUrl,
        },
      });
      setData((old: any) => ({ ...old, provider: saved.provider, providers: saved.providers }));
      setSavedData(saved);
      setApiKeys({});
      setClearApiKeys({});
      setStatus(
        "Settings saved and applied. Existing keys were kept where the field was left blank.",
      );
    } catch (e: any) {
      setError(e.message || "Could not save settings");
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestStatus("");
    setError("");
    try {
      const result = await webApi.testLlmConnection({
        baseUrl: providerSettings?.baseUrl,
        model: providerSettings?.models?.flash,
        apiKey: apiKeys[editProvider] || "",
      });
      setTestStatus(result.message || "Connection successful");
    } catch (e: any) {
      setTestStatus(e.message || "Connection test failed");
    } finally {
      setTesting(false);
    }
  }

  function reset() {
    setData(savedData);
    setActiveProvider(savedData?.provider || "gemini");
    setEditProvider(savedData?.provider || "gemini");
    setApiKeys({});
    setClearApiKeys({});
    setError("");
    setStatus("");
    setTestStatus("");
    setShowApiKey(false);
  }

  if (error && !data) return <State title="Model settings are unavailable" detail={error} />;
  if (!data) return <State title="Loading model settings…" />;

  return (
    <div className="llm-settings">
      <div className="heading">
        <h1>{settingsTab === "models" ? "Model settings" : "Markdown file settings"}</h1>
        <p>{settingsTab === "models"
          ? "Connect Google Gemini, Qwen, DeepSeek, LM Studio, vLLM, and other OpenAI-compatible services."
          : "Choose where IGT reads and saves your Markdown learning records."}</p>
      </div>
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        <button
          id="settings-tab-models"
          type="button"
          role="tab"
          aria-selected={settingsTab === "models"}
          aria-controls="settings-panel-models"
          className={settingsTab === "models" ? "is-active" : ""}
          onClick={() => setSettingsTab("models")}
        >
          Model settings
        </button>
        <button
          id="settings-tab-markdown"
          type="button"
          role="tab"
          aria-selected={settingsTab === "markdown"}
          aria-controls="settings-panel-markdown"
          className={settingsTab === "markdown" ? "is-active" : ""}
          onClick={() => setSettingsTab("markdown")}
        >
          Markdown files
        </button>
      </div>
      <div id="settings-panel-models" role="tabpanel" aria-labelledby="settings-tab-models" hidden={settingsTab !== "models"}>
      <Panel title="AI Provider" className="llm-provider-panel">
        <label className="sr-only" htmlFor="llm-active-provider">
          AI Provider
        </label>
        <select
          id="llm-active-provider"
          className="llm-provider-select"
          value={activeProvider}
          onChange={(e) => {
            setActiveProvider(e.target.value);
            setEditProvider(e.target.value);
            setTestStatus("");
          }}
        >
          {Object.entries(providerNames).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
        <small>Used for requests after you save.</small>
      </Panel>
      <Panel title={`Configure: ${providerNames[editProvider]}`} className="llm-config-panel">
        <div className="llm-settings-section">
          <h3>Connection</h3>
          {editProvider !== "ollama" && (
            <div className="settings-field settings-endpoint">
              <label className="form-label" htmlFor="llm-endpoint">
                {editProvider === "custom"
                  ? "Base URL"
                  : `${providerNames[editProvider]} API endpoint`}
              </label>
              <input
                id="llm-endpoint"
                type="url"
                value={providerSettings?.baseUrl || ""}
                placeholder="https://api.example.com/v1"
                onChange={(e) => updateBaseUrl(e.target.value)}
              />
              <small>
                {editProvider === "custom"
                  ? "ⓘ API base URL, usually ending in /v1"
                  : "API base URL, usually ending in /v1"}
              </small>
            </div>
          )}
          {editProvider !== "ollama" && (
            <div className="settings-field settings-key-field">
              <label className="form-label" htmlFor="llm-api-key">
                API Key
              </label>
              <input
                id="llm-api-key"
                type={showApiKey ? "text" : "password"}
                autoComplete="new-password"
                disabled={Boolean(clearApiKeys[editProvider])}
                value={apiKeys[editProvider] || ""}
                onChange={(e) =>
                  setApiKeys((old) => ({ ...old, [editProvider]: e.target.value }))
                }
                placeholder={
                  providerSettings?.keyConfigured
                    ? `Saved key ${providerSettings.keyMasked} · enter a replacement`
                    : "Enter API key"
                }
              />
              <small>
                {editProvider === "custom"
                  ? "ⓘ Optional for local services. Stored on this device."
                  : "Stored on this device; leave blank to keep the saved key."}
              </small>
              <div className="llm-key-actions">
                <button
                  type="button"
                  className="secondary llm-show-key"
                  onClick={() => setShowApiKey((value) => !value)}
                >
                  {showApiKey ? "Hide" : "Show"}
                </button>
                {editProvider === "custom" && (
                  <>
                    <button
                      type="button"
                      className="secondary"
                      disabled={testing}
                      onClick={testConnection}
                    >
                      {testing ? "Testing…" : "Test connection"}
                    </button>
                    {testStatus && (
                      <span
                        role="status"
                        className={
                          testStatus === "Connection successful"
                            ? "llm-test-success"
                            : "llm-test-error"
                        }
                      >
                        {testStatus}
                      </span>
                    )}
                  </>
                )}
              </div>
              {providerSettings?.keyConfigured && (
                <label className="settings-check">
                  <input
                    type="checkbox"
                    checked={Boolean(clearApiKeys[editProvider])}
                    onChange={(e) =>
                      setClearApiKeys((old) => ({ ...old, [editProvider]: e.target.checked }))
                    }
                  />{" "}
                  Remove this provider’s key when saving
                </label>
              )}
            </div>
          )}
          {editProvider === "ollama" && (
            <div className="settings-field settings-endpoint">
              <label className="form-label" htmlFor="llm-endpoint">
                Ollama endpoint
              </label>
              <input
                id="llm-endpoint"
                type="url"
                value={providerSettings?.baseUrl || ""}
                placeholder="http://localhost:11434"
                onChange={(e) => updateBaseUrl(e.target.value)}
              />
              <small>Ollama local server address</small>
            </div>
          )}
        </div>
        <div className="llm-settings-section llm-model-section">
          <h3>Model mapping</h3>
          <div className="settings-field settings-models">
            <div className="settings-grid">
              <label className="settings-field" htmlFor="llm-flash-model">
                <span className="form-label">Flash · Everyday tasks</span>
                <input
                  id="llm-flash-model"
                  value={providerSettings?.models?.flash || ""}
                  onChange={(e) => updateModel("flash", e.target.value)}
                />
                <small>Grammar, Express, and Ask</small>
              </label>
              <label className="settings-field" htmlFor="llm-pro-model">
                <span className="form-label">Pro · Complex tasks</span>
                <input
                  id="llm-pro-model"
                  value={providerSettings?.models?.pro || ""}
                  onChange={(e) => updateModel("pro", e.target.value)}
                />
                <small>Handbook, Coach, and text analysis</small>
              </label>
            </div>
          </div>
        </div>
      </Panel>
      {error && <State title="Could not save" detail={error} />}
      {status && (
        <p className="settings-status" role="status">
          {status}
        </p>
      )}
      <div className="llm-form-actions">
        <button className="primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button className="secondary" disabled={busy} onClick={reset}>
          Reset
        </button>
      </div>
      </div>
      <div id="settings-panel-markdown" role="tabpanel" aria-labelledby="settings-tab-markdown" hidden={settingsTab !== "markdown"}>
        <MarkdownFileSettings />
      </div>
    </div>
  );
}

type MarkdownPaths = {
  vaultDir: string;
  reviewLog: string;
  vocabularyFile: string;
  practiceLog: string;
  askNotesDir: string;
  handbookReports: string;
};

function MarkdownFileSettings() {
  const [paths, setPaths] = useState<MarkdownPaths>();
  const [savedPaths, setSavedPaths] = useState<MarkdownPaths>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorTitle, setErrorTitle] = useState("Could not save file locations");
  const [status, setStatus] = useState("");

  useEffect(() => {
    webApi.getFileSettings()
      .then((settings) => {
        if (!settings?.paths) throw new Error("Markdown file settings are unavailable.");
        setPaths(settings.paths);
        setSavedPaths(settings.paths);
      })
      .catch((e: any) => setError(e.message || "Could not load Markdown file settings"));
  }, []);

  function updatePath(field: keyof MarkdownPaths, value: string) {
    setPaths((current) => current ? { ...current, [field]: value } : current);
  }

  async function choosePath(field: keyof MarkdownPaths, kind: "file" | "folder") {
    setError("");
    setStatus("");
    setBusy(true);
    try {
      const result = await webApi.pickFileSetting(kind);
      if (result.path) updatePath(field, result.path);
    } catch (e: any) {
      if (e.message === "Not found") {
        setErrorTitle("Path picker unavailable");
        setError("Restart IGT so the running server can load the path picker, then try again.");
      } else {
        setErrorTitle("Could not choose a path");
        setError(e.message || "Could not open the path picker");
      }
    } finally {
      setBusy(false);
    }
  }

  async function savePaths() {
    if (!paths || !savedPaths) return;
    const changed = Object.fromEntries(
      Object.entries(paths).filter(([field, value]) => value !== savedPaths[field as keyof MarkdownPaths]),
    );
    if (Object.keys(changed).length === 0) {
      setStatus("File locations are up to date.");
      return;
    }

    setBusy(true);
    setError("");
    setErrorTitle("Could not save file locations");
    setStatus("");
    try {
      const result = await webApi.saveFileSettings({ paths: changed });
      setPaths(result.paths);
      setSavedPaths(result.paths);
      setStatus("Markdown file locations saved.");
    } catch (e: any) {
      setError(e.message || "Could not save Markdown file locations");
    } finally {
      setBusy(false);
    }
  }

  const folderFields: Array<{ key: keyof MarkdownPaths; label: string; help: string }> = [
    { key: "vaultDir", label: "Obsidian vault folder", help: "Default location for learning notes." },
    { key: "askNotesDir", label: "Ask notes folder", help: "Each saved Ask consultation is written as a Markdown note." },
    { key: "handbookReports", label: "Handbook reports folder", help: "Generated handbook Markdown files." },
  ];
  const fileFields: Array<{ key: keyof MarkdownPaths; label: string; help: string }> = [
    { key: "reviewLog", label: "Review log file", help: "Markdown corrections and writing feedback." },
    { key: "vocabularyFile", label: "Vocabulary file", help: "The Markdown source for vocabulary entries." },
    { key: "practiceLog", label: "Practice log file", help: "Saved independent practice records." },
  ];

  if (!paths) {
    return error
      ? <State title="Markdown file settings are unavailable" detail={error} />
      : <State title="Loading Markdown file settings…" />;
  }

  return (
    <>
      <Panel title="Markdown file locations" className="llm-config-panel markdown-settings-panel">
        <p className="markdown-settings-intro">
          Choose where IGT reads and saves its Markdown learning records. Paths are stored locally.
        </p>
        {[{ title: "Folders", kind: "folder" as const, fields: folderFields }, { title: "Files", kind: "file" as const, fields: fileFields }].map(({ title, kind, fields }) => (
          <section className="markdown-path-group" key={kind} aria-label={title}>
            <h3>{title}</h3>
            <div className="settings-grid markdown-path-grid">
              {fields.map(({ key, label, help }) => (
                <div className="settings-field" key={key}>
                  <label className="form-label" htmlFor={`markdown-path-${key}`}>{label}</label>
                  <div className="markdown-path-control">
                    <input
                      id={`markdown-path-${key}`}
                      type="text"
                      value={paths[key]}
                      title={paths[key]}
                      onChange={(event) => updatePath(key, event.target.value)}
                    />
                    <button type="button" className="secondary" disabled={busy} onClick={() => choosePath(key, kind)}>
                      Choose…
                    </button>
                  </div>
                  <small>{help}</small>
                </div>
              ))}
            </div>
          </section>
        ))}
      </Panel>
      {error && <State title={errorTitle} detail={error} />}
      {status && <p className="settings-status" role="status">{status}</p>}
      <div className="llm-form-actions">
        <button className="primary" disabled={busy} onClick={savePaths}>
          {busy ? "Saving…" : "Save file locations"}
        </button>
        <button className="secondary" disabled={busy} onClick={() => {
          setPaths(savedPaths);
          setError("");
          setErrorTitle("Could not save file locations");
          setStatus("");
        }}>
          Reset
        </button>
      </div>
    </>
  );
}

function Heading({ title, detail }: { eyebrow: string; title: React.ReactNode; detail: string }) {
  return (
    <div className="heading">
      <h1>{title}</h1>
      <p>{detail}</p>
    </div>
  );
}
function Panel({
  title,
  children,
  icon,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ComponentProps<typeof Icon>["name"];
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        {icon && <Icon name={icon} />}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}
function State({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="state">
      <strong>{title}</strong>
      {detail && <p>{detail}</p>}
    </div>
  );
}
function AudioButton({
  text,
  small,
  reviewPrompt = false,
}: {
  text: string;
  small?: boolean;
  reviewPrompt?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | undefined>(undefined);
  const releaseAudio = (audio: HTMLAudioElement) => {
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    if (audio.src.startsWith("blob:")) URL.revokeObjectURL(audio.src);
    audio.removeAttribute("src");
    if (audioRef.current === audio) audioRef.current = undefined;
  };
  useEffect(
    () => () => {
      if (audioRef.current) releaseAudio(audioRef.current);
    },
    [],
  );
  function playBrowserSpeech() {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      return Promise.reject(new Error("Browser speech is unavailable"));
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    return new Promise<void>((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error("Browser speech playback failed"));
      window.speechSynthesis.speak(utterance);
    });
  }
  async function fallbackToBrowserSpeech(message: string) {
    try {
      await playBrowserSpeech();
    } catch (fallbackError: any) {
      setError(`${message}；${fallbackError.message || "Browser speech is unavailable"}`);
    } finally {
      setBusy(false);
    }
  }
  async function play() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const audio = await webApi.speakWord(text);
      audioRef.current = audio;
      audio.onended = () => {
        const tooShort =
          Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration < 0.2;
        releaseAudio(audio);
        if (tooShort) void fallbackToBrowserSpeech("The audio was empty");
        else setBusy(false);
      };
      audio.onerror = () => {
        releaseAudio(audio);
        void fallbackToBrowserSpeech("The audio could not be played");
      };
      await audio.play();
    } catch (e: any) {
      if (audioRef.current) releaseAudio(audioRef.current);
      await fallbackToBrowserSpeech(e.message || "Audio playback failed");
    }
  }
  if (!text) return null;
  return (
    <span className="audio-control">
      <button
        type="button"
        className={`audio-btn${small ? " audio-btn-sm" : ""}${error ? " audio-err" : ""}`}
        onClick={play}
        disabled={busy}
        aria-label={
          busy ? "Playing…" : reviewPrompt ? "Listen to the English word" : `Read aloud: ${text}`
        }
        title={error || "Read aloud"}
      >
        <Icon name="volume" />
      </button>
      {error && (
        <span className="audio-error" role="status" aria-live="polite">
          Playback failed: {error}
        </span>
      )}
    </span>
  );
}

function CopyButton({ value, label, small }: { value: string; label: string; small?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  // execCommand still works where the async clipboard does not, such as a plain
  // http:// LAN address, which is how this local app is often opened.
  function copyViaSelection(value: string) {
    const holder = document.createElement("textarea");
    holder.value = value;
    holder.setAttribute("readonly", "");
    holder.style.position = "fixed";
    holder.style.opacity = "0";
    document.body.appendChild(holder);
    holder.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    holder.remove();
    return copied;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState(copyViaSelection(value) ? "copied" : "failed");
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState("idle"), 2400);
  }
  if (!value) return null;
  return (
    <span className="copy-control">
      <button
        type="button"
        className={`copy-btn${small ? " copy-btn-sm" : ""}${state === "copied" ? " is-copied" : ""}${state === "failed" ? " is-failed" : ""}`}
        onClick={() => void copy()}
        aria-label={state === "copied" ? `Copied ${label}` : `Copy ${label}`}
        title={
          state === "copied"
            ? "Copied"
            : state === "failed"
              ? "Copying failed — your browser blocked clipboard access"
              : "Copy"
        }
      >
        <Icon name={state === "copied" ? "check" : "copy"} />
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied"
          ? `${label} copied to clipboard`
          : state === "failed"
            ? `Could not copy ${label}`
            : ""}
      </span>
    </span>
  );
}

const primaryRoutes: Route[] = ["practice", "ask"];
const learningRoutes: Array<[Route, string]> = [
  ["dashboard", "Overview"],
  ["handbook", "Handbook"],
  ["coach", "Coach"],
];
const navigationGroups: Array<{ label: string; routes: Array<[Route, string]> }> = [
  {
    label: "Writing",
    routes: [
      ["grammar", "Grammar"],
      ["translation", "Express"],
    ],
  },
  {
    label: "Vocabulary",
    routes: [
      ["word-lookup", "Look up"],
      ["word-review", "Review"],
    ],
  },
];
function currentRoute(): Route {
  const hash = location.hash.slice(1).split("?")[0];
  return hash === "dashboard" || items.some(([key]) => key === hash) ? (hash as Route) : "grammar";
}
export function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [route, setRoute] = useState<Route>(currentRoute);
  const [routeHash, setRouteHash] = useState(location.hash);
  const [statusMsg, setStatusMsg] = useState("");
  const navRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    webApi
      .getStatusMessage()
      .then((m) => setStatusMsg(m.content))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const onHash = () => {
      if (location.hash === "#main-content") return;
      setRoute(currentRoute());
      setRouteHash(location.hash);
      setMenuOpen(false);
      navRef.current?.querySelectorAll("details").forEach((menu) => {
        menu.open = false;
      });
      mainRef.current?.focus();
      window.scrollTo(0, 0);
    };
    const dismiss = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        navRef.current?.querySelectorAll("details").forEach((menu) => {
          menu.open = false;
        });
      }
    };
    addEventListener("hashchange", onHash);
    addEventListener("pointerdown", dismiss);
    return () => {
      removeEventListener("hashchange", onHash);
      removeEventListener("pointerdown", dismiss);
    };
  }, []);
  const title =
    route === "dashboard" ? "Overview" : items.find(([key]) => key === route)?.[1] || "Grammar";
  useEffect(() => {
    document.title = title + " · ClearWrite";
  }, [title]);
  const pages: Record<Route, React.ReactNode> = {
    grammar: <Grammar />,
    dashboard: <Dashboard />,
    translation: <Express />,
    ask: <Ask />,
    "word-review": <WordReview />,
    "word-lookup": <WordLookup />,
    coach: <Coach />,
    practice: <Practice key={routeHash} />,
    handbook: <Handbook key={routeHash} />,
    settings: <LlmSettings />,
  };
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header
        className="topbar"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            const openMenu = navRef.current?.querySelector<HTMLDetailsElement>("details[open]");
            if (openMenu) {
              openMenu.open = false;
              openMenu.querySelector("summary")?.focus();
            } else if (menuOpen) {
              setMenuOpen(false);
              menuRef.current?.focus();
            }
          }
        }}
      >
        <a className="brand" href="#grammar" aria-label="ClearWrite home">
          <span className="brand-mark">
            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
              <path d="M5 9a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-7l-5 4v-4H8a3 3 0 0 1-3-3V9Z" />
              <path d="M10 11h8M10 15h6M10 19h4" />
              <path
                d="m26 4 .9 2.6 2.6.9-2.6.9L26 11l-.9-2.6-2.6-.9 2.6-.9L26 4Z"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </span>
          <img
            className="brand-wordmark"
            src={clearWriteWordmark}
            alt=""
            aria-hidden="true"
            width="190"
            height="33"
          />
        </a>
        <button
          ref={menuRef}
          className="menu-toggle"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          aria-controls="workspace-nav"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name={menuOpen ? "close" : "menu"} />
          <span>Menu</span>
        </button>
        <nav
          ref={navRef}
          id="workspace-nav"
          aria-label="Main navigation"
          className={menuOpen ? "top-nav is-open" : "top-nav"}
          onClick={(event) => {
            if ((event.target as Element).closest("a")) {
              navRef.current?.querySelectorAll("details").forEach((menu) => {
                menu.open = false;
              });
              setMenuOpen(false);
            }
          }}
        >
          {navigationGroups.map((group) => (
            <details key={group.label} className="learning-menu" name="workspace-navigation">
              <summary className={group.routes.some(([key]) => key === route) ? "active" : ""}>
                {group.label}
                <Icon name="chevron" />
              </summary>
              <div className="learning-links">
                {group.routes.map(([key, label]) => (
                  <a key={key} href={"#" + key} aria-current={route === key ? "page" : undefined}>
                    <Icon name={key} />
                    {label}
                  </a>
                ))}
              </div>
            </details>
          ))}
          {items
            .filter(([key]) => primaryRoutes.includes(key))
            .map(([key, label]) => (
              <a
                href={"#" + key}
                key={key}
                className={route === key ? "nav-link active" : "nav-link"}
                aria-current={route === key ? "page" : undefined}
              >
                {label}
              </a>
            ))}
          <details className="learning-menu" name="workspace-navigation">
            <summary className={learningRoutes.some(([key]) => key === route) ? "active" : ""}>
              My learning
              <Icon name="chevron" />
            </summary>
            <div className="learning-links">
              {learningRoutes.map(([key, label]) => (
                <a key={key} href={"#" + key} aria-current={route === key ? "page" : undefined}>
                  <Icon name={key} />
                  {label}
                </a>
              ))}
            </div>
          </details>
          <a
            className="settings-link"
            href="#settings"
            aria-current={route === "settings" ? "page" : undefined}
          >
            <Icon name="settings" />
            <span>Settings</span>
          </a>
        </nav>
      </header>
      <main
        ref={mainRef}
        id="main-content"
        tabIndex={-1}
        className={route === "grammar" ? "workspace grammar-workspace" : "workspace"}
      >
        {pages[route]}
      </main>
      <footer className="site-footer">
        <span className="site-footer-motto">A tool for practice. Keep reading, listening, and using English beyond it.</span>
        {statusMsg && (
          <span className="site-footer-status" role="status">
            {statusMsg}
          </span>
        )}
      </footer>
    </div>
  );
}

function DetailSection({
  variant,
  icon,
  title,
  action,
  children,
}: {
  variant: string;
  icon: React.ComponentProps<typeof Icon>["name"];
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={"detail-section detail-" + variant}
      aria-labelledby={"detail-" + variant + "-title"}
    >
      <span className="detail-icon">
        <Icon name={icon} />
      </span>
      <div className="detail-content">
        {action ? (
          <div className="detail-head">
            <h2 id={"detail-" + variant + "-title"}>{title}</h2>
            {action}
          </div>
        ) : (
          <h2 id={"detail-" + variant + "-title"}>{title}</h2>
        )}
        <div className="detail-copy">{children}</div>
      </div>
    </section>
  );
}
