import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { webApi } from "./api/client";

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
  ["translation", "Translate"],
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
            Make a little progress.
            <br />
            <em>Make it yours.</em>
          </>
        }
        detail="Look back at your recent work, then choose what to practise next."
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
              : "Start with a sentence to build a picture of your learning."}
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
          {!data.recentActivity?.length && <State title="No review entries yet" />}
        </Panel>
        <Panel title="Your learning rhythm" icon="word-review">
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
      setSaved(response.persistence?.saved ? "Saved to your review log." : "Your review log was not saved. Try again.");
    } catch (e: any) {
      setSaved("Could not save: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  const data = result?.result || result?.data;
  const diagnoses = (data?.diagnoses || []).map((item: any) =>
    typeof item === "string" ? item : item.explanation || item.message || JSON.stringify(item),
  );

  return (
    <div className={`grammar-page${result ? " has-result" : ""}`}>
      <div className="grammar-intro">
        <h1>Your English,<br /><span>clearer<span className="accent-dot">.</span></span></h1>
        <p>A thought. A sentence. A little better every day.</p>
      </div>
      <form className="grammar-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }} aria-busy={busy}>
        <label className="sr-only" htmlFor="grammar-input">Your English sentence</label>
        <textarea ref={inputRef} id="grammar-input" value={text} disabled={busy}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault(); void submit();
            }
          }}
          placeholder="Write something in English…" aria-describedby="grammar-hint" />
        <div className="composer-actions">
          <span id="grammar-hint">{busy ? "Finding a clearer way to say it…" : "A sentence or a short paragraph"}</span>
          <button className="primary" type="submit" disabled={busy || saving || !text.trim()}>
            {busy ? <><span className="loading-spinner" />Checking…</> : <>Check my English<Icon name="arrow" /></>}
          </button>
        </div>
      </form>
      {!result && !busy && <div className="grammar-examples">
        <span>Need a starting point?</span>
        <button type="button" className="text-button" onClick={() => {
          setText("I suggested him to join the call."); inputRef.current?.focus();
        }}>Try an example<Icon name="arrow" /></button>
      </div>}
      <p className="grammar-note">Understand the changes. Keep what you learn. Save only when you choose.</p>
      {result?.error && <State title="Could not check your English. Try again." detail={result.error} />}
      {data && (
        <div className="correction-detail" aria-live="polite">
          <DetailSection variant="original" icon="document" title="Original">
            <p>{data.originalText || checkedText}</p>
          </DetailSection>
          <DetailSection variant="correction" icon="check" title="Correction">
            <p>{data.correction || "No correction needed."}</p>
          </DetailSection>
          {data.refine && <DetailSection variant="natural" icon="spark" title="More natural">
            <p>{data.refine || "No alternative wording provided."}</p>
          </DetailSection>}
          <DetailSection variant="why" icon="info" title="Why">
            {diagnoses.length ? (
              diagnoses.map((item: string, index: number) => <p key={index}>{item}</p>)
            ) : (
              <p>No explanation provided.</p>
            )}
          </DetailSection>
          <DetailSection variant="remember" icon="idea" title="Remember">
            <p>{data.remember || "No reminder provided."}</p>
          </DetailSection>
          <div className="correction-actions">
            <button className="primary save-review" onClick={save} disabled={busy || saving || didSave}>
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
function Translation() {
  const [text, setText] = useState("");
  const [direction, setDirection] = useState("zh2en");
  const [result, setResult] = useState<any>();
  const [busy, setBusy] = useState(false);
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
        eyebrow="TRANSLATION"
        title="Find the right words."
        detail="Translate between Chinese and English, with meaning and context intact."
      />
      <Panel title="Your text" icon="translation">
        <div className="switches">
          <button
            className={direction === "zh2en" ? "selected" : ""}
            onClick={() => setDirection("zh2en")}
          >
            Chinese → English
          </button>
          <button
            className={direction === "en2zh" ? "selected" : ""}
            onClick={() => setDirection("en2zh")}
          >
            English → Chinese
          </button>
        </div>
        <label className="form-label" htmlFor="translation-input">
          Text to translate
        </label>
        <textarea
          id="translation-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write or paste the text to translate…"
        />
        <button className="primary" onClick={submit} disabled={busy}>
          {busy ? "Translating…" : "Translate →"}
        </button>
      </Panel>
      {result?.error && <State title="Translation failed. Try again." detail={result.error} />}
      {translation && (
        <Panel title="Translation" icon="translation">
          <p className="translation-result">{translation}</p>
          {result.data?.notes && <p>{result.data.notes}</p>}
        </Panel>
      )}
    </>
  );
}
function Ask() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<any[]>([]);
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
    } catch (e: any) {
      setSaved(`Could not save: ${e.message}`);
    } finally {
      setSaveBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="ASK"
        title="Stay curious."
        detail="Explore usage, tone, and the subtle differences. Ask a follow-up whenever you need."
      />
      <Panel title="Your conversation" icon="ask">
        {turns.map((turn, index) => (
          <div className="ask-turn" key={`${turn.question}-${index}`}>
            <strong>{turn.question}</strong>
            <p>{turn.answer}</p>
          </div>
        ))}
        {!turns.length && <State title="What would you like to understand?" detail="Start with a question about English." />}
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
    </>
  );
}
function WordReview() {
  const [cards, setCards] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    webApi
      .getReviewDue()
      .then((data) => setCards(data.cards || []))
      .catch((e) => setError(e.message));
  }, []);
  async function grade(rating: string) {
    const card = cards[index];
    if (!card) return;
    try {
      await webApi.gradeReview(card.id, rating);
      setIndex((n) => n + 1);
      setRevealed(false);
    } catch (e: any) {
      setError(e.message);
    }
  }
  const card = cards[index];
  const details = card?.vocab_details;
  const examples = details?.examples?.length ? details.examples : [card?.example].filter(Boolean);
  return (
    <div className="word-review-page">
      <Heading
        eyebrow="VOCABULARY · SRS ONLY"
        title="Bring words back."
        detail="Recall the English word from the Chinese clue. Reveal it, then rate your recall."
      />
      {error && <State title="Could not load your review. Try again." detail={error} />}
      {!error && !card && (
        <Panel title="Your review today" icon="word-review" className="review-empty-state">
          <State
            title={cards.length ? "All done for today." : "You are all caught up."}
            detail={
              cards.length
                ? `You reviewed ${cards.length} vocabulary cards.`
                : "Come back later, or look up a word and save it to your vocabulary."
            }
          />
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
                <button className="primary" onClick={() => setRevealed(true)}>
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
              <div className="review-actions">
                <button onClick={() => grade("again")}>
                  <span>Again</span>
                  <small>Could not recall</small>
                </button>
                <button onClick={() => grade("hard")}>
                  <span>Hard</span>
                  <small>With difficulty</small>
                </button>
                <button onClick={() => grade("good")}>
                  <span>Good</span>
                  <small>Remembered</small>
                </button>
                <button onClick={() => grade("easy")}>
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
          eyebrow="COACH · EVIDENCE"
          title="Find your next step."
          detail="Use your learning history to choose a useful practice focus."
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
              <div><dt>Writing entries</dt><dd>{data.sample?.totalInputs || 0}<span> entries</span></dd></div>
              <div><dt>Grammar observations</dt><dd>{data.sample?.totalDiagnoses || 0}<span> observations</span></dd></div>
              <div><dt>Time window</dt><dd>{data.windowDays ?? "—"}<span> days</span></dd></div>
            </dl>
          </Panel>
          {(data.priorities || []).length > 0 ? (
            <Panel title="Where to focus" className="coach-priorities">
              {(data.priorities || []).map((item: any) => (
                <article className="coach-priority" key={item.errorType}>
                  <h3>{item.errorType}</h3>
                  {item.mechanism?.statement && <p className="coach-mechanism">{item.mechanism.statement}</p>}
                  <ol className="coach-tasks">
                    {item.prescription?.slice(0, 2).map((phase: any) => (
                      <li key={phase.phase}>
                        <strong>{phase.name}</strong>
                        {phase.task && <p>{phase.task}</p>}
                        {phase.check && <p className="coach-check"><span>How to check</span>{phase.check}</p>}
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </Panel>
          ) : (
            <Panel title="A little more practice first." className="coach-empty-priorities">
              <p>There is not enough evidence to choose a focus yet. Keep saving your writing and feedback, then check back.</p>
            </Panel>
          )}
          <Panel title="What this evidence can tell us" className="coach-limitations">
            {data.limitations?.length ? (
              <ul>{data.limitations.map((item: string) => <li key={item}>{item}</li>)}</ul>
            ) : <p>No additional limitations were provided for this analysis.</p>}
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
      setStatus(result.persistence?.saved ? "Saved to your vocabulary" : "This word is already in your vocabulary.");
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
        title="Meet your next word."
        detail="Explore a word, hear it in context, and save it for your next review."
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
                    <AudioButton text={example} small />
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
function Practice() {
  const [mode, setMode] = useState("sentence");
  const [count, setCount] = useState(3);
  const [questions, setQuestions] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<any>();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setEvaluation(undefined);
    try {
      const result = await webApi.generatePractice(mode, count);
      setQuestions(result.data?.questions || []);
      setIndex(0);
      setAnswer("");
    } catch (e: any) {
      setEvaluation({ error: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function evaluate() {
    const question = questions[index];
    if (!question || !answer.trim()) return;
    setBusy(true);
    try {
      const result = await webApi.evaluatePractice(question, answer);
      setEvaluation(result.data);
    } catch (e: any) {
      setEvaluation({ error: e.message });
    } finally {
      setBusy(false);
    }
  }

  const question = questions[index];
  const prompt = question?.kind === "choice" ? question.question : question?.prompt_zh;
  const modeHint: Record<string, string> = {
    word: "Fill the gap with the target word to complete the sentence.",
    sentence: "Use your vocabulary to write an original sentence in a new context.",
    choice: "Read the passage and choose the best answer.",
  };
  const modeName: Record<string, string> = {
    word: "word",
    sentence: "sentence",
    choice: "reading",
  };

  return (
    <>
      <Heading
        eyebrow="PRACTICE"
        title="Make the words your own."
        detail="Choose a short practice session. Recall your vocabulary and use it in a new context."
      />
      {!question && (
        <Panel title="Set up your practice" icon="practice" className="practice-setup">
          <div className="practice-field">
            <span className="practice-field-label">Practice type</span>
            <div className="switches" role="group" aria-label="Practice mode">
              <button
                className={mode === "word" ? "selected" : ""}
                aria-pressed={mode === "word"}
                onClick={() => setMode("word")}
              >
                Word
              </button>
              <button
                className={mode === "sentence" ? "selected" : ""}
                aria-pressed={mode === "sentence"}
                onClick={() => setMode("sentence")}
              >
                Sentence
              </button>
              <button
                className={mode === "choice" ? "selected" : ""}
                aria-pressed={mode === "choice"}
                onClick={() => setMode("choice")}
              >
                Choice
              </button>
            </div>
            <p className="practice-mode-hint">
              <Icon name="info" />
              {modeHint[mode]}
            </p>
          </div>
          <fieldset className="question-count">
            <legend>Number of questions</legend>
            <div className="count-options">
              {[3, 5, 10].map((value) => (
                <label className={count === value ? "selected" : ""} key={value}>
                  <input
                    type="radio"
                    name="practice-count"
                    value={value}
                    checked={count === value}
                    onChange={() => setCount(value)}
                  />
                  <span>{value}</span>
                  <span>questions</span>
                </label>
              ))}
            </div>
          </fieldset>
          <State title={count + " questions · " + modeName[mode] + " practice"} />
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
        </Panel>
      )}
      {question && (
        <Panel
          title={"Question " + (index + 1) + " of " + questions.length}
          icon="practice"
          className="practice-question"
        >
          <div
            className="practice-progress"
            aria-label={"Question " + (index + 1) + " of " + questions.length}
          >
            <span style={{ width: ((index + 1) / questions.length) * 100 + "%" }} />
          </div>
          <div className="practice-prompt">
            <span className="review-kicker">
              {question.kind === "choice" ? "CHOICE" : mode.toUpperCase()}
            </span>
            <h2>{prompt}</h2>
            <p>{question.focus || question.explanation || "Complete this exercise."}</p>
          </div>
          {question.kind === "choice" ? (
            <div className="practice-options" role="group" aria-label="Choose an answer">
              {(question.options || []).map((option: string, optionIndex: number) => (
                <button
                  className={answer === option ? "selected" : ""}
                  aria-pressed={answer === option}
                  key={option}
                  onClick={() => setAnswer(option)}
                >
                  <span className="option-marker">{String.fromCharCode(65 + optionIndex)}</span>
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <>
              <label className="form-label" htmlFor="practice-input">
                Your answer in English
              </label>
              <textarea
                id="practice-input"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Write your answer in English…"
              />
            </>
          )}
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
          {evaluation?.error && <State title="Could not review this answer. Try again." detail={evaluation.error} />}
          {evaluation && !evaluation.error && (
            <PracticeEvaluation
              evaluation={evaluation}
              answer={answer}
              nextLabel={index + 1 < questions.length ? "Next question" : "Finish session"}
              onNext={() => {
                setIndex((n) => n + 1);
                setAnswer("");
                setEvaluation(undefined);
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
  nextLabel,
  onNext,
}: {
  evaluation: any;
  answer: string;
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
          <p>{evaluation.feedback_zh || "Compare your answer with the revision. Check the meaning and grammar."}</p>
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

function Handbook() {
  const [data, setData] = useState<any>();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingSelection, setLoadingSelection] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const value = await webApi.getHandbook();
      setData(value);
      setSelected(value.selected || "");
    } catch {
      setError("Your handbook could not be loaded. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { load(); }, []);
  async function choose(value: string) {
    if (value === selected || loadingSelection) return;
    setError("");
    setLoadingSelection(true);
    try {
      const nextData = await webApi.getHandbook(value);
      setData(nextData);
      setSelected(nextData.selected || "");
    } catch {
      setError("This category could not be loaded. Please try again.");
    } finally {
      setLoadingSelection(false);
    }
  }
  const hasFrequencies = Boolean(data?.frequencies?.length);
  return (
    <div className="handbook-page">
      <div className="coach-header">
        <Heading
          eyebrow="HANDBOOK · REFERENCE"
          title="Learn from your own words."
          detail="Revisit patterns in your writing, with corrections and reminders worth keeping."
        />
        <button className="secondary" onClick={load} disabled={busy || loadingSelection}>
          {busy ? "Loading…" : "Refresh"}
        </button>
      </div>
      {!data && (busy ? (
        <State title="Loading your handbook…" />
      ) : error ? (
        <Panel title="Unable to load">
          <div className="handbook-empty">
            <State title="Your learning notes could not be loaded." detail={error} />
            <button className="primary" onClick={load}>Try again</button>
          </div>
        </Panel>
      ) : null)}
      {data && (
        <>
          <Panel title="Your writing history" className="coach-sample">
            <dl className="coach-sample-grid">
              <div><dt>Writing entries</dt><dd>{data.stats?.total_inputs || 0}<span> entries</span></dd></div>
              <div><dt>Grammar observations</dt><dd>{data.stats?.total_diagnoses || 0}<span> observations</span></dd></div>
              <div><dt>Time window</dt><dd>{data.days ?? "—"}<span> days</span></dd></div>
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
                    disabled={loadingSelection}
                  >
                    {item.error_type}<span>{item.count}</span>
                  </button>
                ))}
              </div>
              {error && <State title="Could not change category" detail={error} />}
              <Panel title={selected}>
                {loadingSelection ? <State title="Loading examples…" /> : data.examples?.length ? (
                  data.examples.map((item: any, index: number) => (
                    <article className="activity handbook-example" key={`${item.original_text}-${index}`}>
                      <div><span>Original</span><p>{item.original_text}</p></div>
                      <div><span>Correction</span><p>{item.correction}</p></div>
                      {item.refine && <div><span>More natural</span><p>{item.refine}</p></div>}
                      {item.explanation && <div><span>Why</span><p>{item.explanation}</p></div>}
                      {item.remember && <div><span>Remember</span><p>{item.remember}</p></div>}
                    </article>
                  ))
                ) : (
                  <div className="handbook-empty"><State title="No examples in this category yet." detail="Keep saving your writing to build a collection of useful examples." /></div>
                )}
              </Panel>
            </>
          ) : (
            <Panel title="A little more practice first." className="coach-empty-priorities">
              <div className="handbook-empty">
                <p>No grammar observations in the last {data.days} days. Check and save a sentence to start collecting corrections and explanations here.</p>
                <a className="primary" href="#grammar">Check a sentence<Icon name="arrow" /></a>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
const providerNames: Record<string, string> = {
  gemini: "Google Gemini",
  qwen: "Qwen",
  deepseek: "DeepSeek",
  ollama: "Ollama (local)",
};

function LlmSettings() {
  const [data, setData] = useState<any>();
  const [activeProvider, setActiveProvider] = useState("gemini");
  const [editProvider, setEditProvider] = useState("gemini");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [clearApiKeys, setClearApiKeys] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    webApi.getLlmSettings().then((settings) => {
      if (!settings?.providers || !settings?.provider) {
        throw new Error("Settings are unavailable. Restart IGT and try again.");
      }
      setData(settings);
      setActiveProvider(settings.provider);
      setEditProvider(settings.provider);
    }).catch((e: any) => setError(e.message || "Could not load model settings"));
  }, []);

  const providerSettings = data?.providers?.[editProvider];
  const updateModel = (role: "flash" | "pro", value: string) => {
    setData((old: any) => ({ ...old, providers: { ...old.providers, [editProvider]: { ...old.providers[editProvider], models: { ...old.providers[editProvider].models, [role]: value } } } }));
  };
  const updateBaseUrl = (value: string) => {
    setData((old: any) => ({ ...old, providers: { ...old.providers, [editProvider]: { ...old.providers[editProvider], baseUrl: value } } }));
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
        models: Object.fromEntries(Object.entries(data.providers).map(([name, value]: [string, any]) => [name, value.models])),
        baseUrls: {
          OllamaBaseUrl: data.providers.ollama.baseUrl,
          QwenApiBase: data.providers.qwen.baseUrl,
          DeepseekApiBase: data.providers.deepseek.baseUrl,
        },
      });
      setData((old: any) => ({ ...old, provider: saved.provider, providers: saved.providers }));
      setApiKeys({});
      setClearApiKeys({});
      setStatus("Settings saved and applied. Existing keys were kept where the field was left blank.");
    } catch (e: any) {
      setError(e.message || "Could not save settings");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <State title="Model settings are unavailable" detail={error} />;
  if (!data) return <State title="Loading model settings…" />;

  return (
    <div className="llm-settings">
      <div className="heading">
        <h1>Model settings</h1>
        <p>Choose your AI provider and the models used for everyday and complex tasks.</p>
      </div>
      <Panel title="AI provider" icon="settings">
        <div className="settings-grid">
          <div className="settings-field">
            <label className="form-label" htmlFor="llm-active-provider">Active provider</label>
            <select id="llm-active-provider" value={activeProvider} onChange={(e) => setActiveProvider(e.target.value)}>
              {Object.entries(providerNames).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
            </select>
            <small>This provider will handle your requests after you save.</small>
          </div>
          <div className="settings-field">
            <label className="form-label" htmlFor="llm-edit-provider">Configure a provider</label>
            <select id="llm-edit-provider" value={editProvider} onChange={(e) => setEditProvider(e.target.value)}>
              {Object.entries(providerNames).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
            </select>
            <small>Configure each provider separately, then save your changes.</small>
          </div>
        </div>
        {editProvider !== "ollama" && (
          <div className="settings-field settings-key-field">
            <label className="form-label" htmlFor="llm-api-key">{providerNames[editProvider]} API key</label>
            <input
              id="llm-api-key"
              type="password"
              autoComplete="new-password"
              disabled={Boolean(clearApiKeys[editProvider])}
              value={apiKeys[editProvider] || ""}
              onChange={(e) => setApiKeys((old) => ({ ...old, [editProvider]: e.target.value }))}
              placeholder={providerSettings?.keyConfigured ? `Configured ${providerSettings.keyMasked} · Enter a key to replace` : "Paste your API key"}
            />
            <small>Your key is stored on this device and will not be shown again. Leave blank to keep it.</small>
            {providerSettings?.keyConfigured && <label className="settings-check"><input type="checkbox" checked={Boolean(clearApiKeys[editProvider])} onChange={(e) => setClearApiKeys((old) => ({ ...old, [editProvider]: e.target.checked }))} /> Remove this provider’s key when saving</label>}
          </div>
        )}
        <div className="settings-field settings-models">
          <span className="form-label">Models</span>
          <div className="settings-grid">
            <label className="settings-field" htmlFor="llm-flash-model">
              <span className="form-label">Flash · Everyday tasks</span>
              <input id="llm-flash-model" value={providerSettings?.models?.flash || ""} onChange={(e) => updateModel("flash", e.target.value)} />
              <small>Grammar, translation, and Ask</small>
            </label>
            <label className="settings-field" htmlFor="llm-pro-model">
              <span className="form-label">Pro · Complex tasks</span>
              <input id="llm-pro-model" value={providerSettings?.models?.pro || ""} onChange={(e) => updateModel("pro", e.target.value)} />
              <small>Handbook, Coach, and text analysis</small>
            </label>
          </div>
        </div>
        {editProvider !== "gemini" && (
          <div className="settings-field settings-endpoint">
            <label className="form-label" htmlFor="llm-endpoint">{editProvider === "ollama" ? "Ollama endpoint" : `${providerNames[editProvider]} API endpoint`}</label>
            <input id="llm-endpoint" type="url" value={providerSettings?.baseUrl || ""} onChange={(e) => updateBaseUrl(e.target.value)} />
            <small>{editProvider === "ollama" ? "Your local Ollama OpenAI-compatible endpoint" : "OpenAI-compatible API endpoint"}</small>
          </div>
        )}
      </Panel>
      {error && <State title="Could not save" detail={error} />}
      {status && <p className="settings-status" role="status">{status}</p>}
      <button className="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save settings"}</button>
    </div>
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
        aria-label={busy ? "Playing…" : reviewPrompt ? "Listen to the English word" : `Read aloud: ${text}`}
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

const primaryRoutes: Route[] = ["grammar", "translation", "word-lookup", "word-review", "practice", "ask"];
const learningRoutes: Array<[Route, string]> = [["dashboard", "Overview"], ["handbook", "Handbook"], ["coach", "Coach"]];
function currentRoute(): Route {
  const hash = location.hash.slice(1);
  return hash === "dashboard" || items.some(([key]) => key === hash) ? hash as Route : "grammar";
}
export function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [route, setRoute] = useState<Route>(currentRoute);
  const moreRef = useRef<HTMLDetailsElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onHash = () => {
      if (location.hash === "#main-content") return;
      setRoute(currentRoute());
      setMenuOpen(false);
      if (moreRef.current) moreRef.current.open = false;
      mainRef.current?.focus();
      window.scrollTo(0, 0);
    };
    const dismiss = (event: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) moreRef.current.open = false;
    };
    addEventListener("hashchange", onHash);
    addEventListener("pointerdown", dismiss);
    return () => { removeEventListener("hashchange", onHash); removeEventListener("pointerdown", dismiss); };
  }, []);
  const title = route === "dashboard" ? "Overview" : items.find(([key]) => key === route)?.[1] || "Grammar";
  useEffect(() => { document.title = title + " · IGT"; }, [title]);
  const pages: Record<Route, React.ReactNode> = {
    grammar: <Grammar />, dashboard: <Dashboard />, translation: <Translation />, ask: <Ask />,
    "word-review": <WordReview />, "word-lookup": <WordLookup />, coach: <Coach />,
    practice: <Practice />, handbook: <Handbook />, settings: <LlmSettings />,
  };
  return <div className="shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="topbar" onKeyDown={(event) => {
      if (event.key === "Escape") {
        if (moreRef.current?.open) { moreRef.current.open = false; moreRef.current.querySelector("summary")?.focus(); }
        else if (menuOpen) { setMenuOpen(false); menuRef.current?.focus(); }
      }
    }}>
      <a className="brand" href="#grammar" aria-label="IGT home"><span className="brand-mark"><Icon name="grammar" /></span>igt<span className="brand-period">.</span></a>
      <button ref={menuRef} className="menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={menuOpen} aria-controls="workspace-nav" onClick={() => setMenuOpen(!menuOpen)}>
        <Icon name={menuOpen ? "close" : "menu"} /><span>Menu</span>
      </button>
      <nav id="workspace-nav" aria-label="Main navigation" className={menuOpen ? "top-nav is-open" : "top-nav"}>
        {items.filter(([key]) => primaryRoutes.includes(key)).map(([key, label]) =>
          <a href={"#" + key} key={key} className={route === key ? "nav-link active" : "nav-link"} aria-current={route === key ? "page" : undefined}>{label}</a>)}
        <details className="learning-menu" ref={moreRef}>
          <summary className={learningRoutes.some(([key]) => key === route) ? "active" : ""}>My learning<Icon name="chevron" /></summary>
          <div className="learning-links">{learningRoutes.map(([key, label]) =>
            <a key={key} href={"#" + key} aria-current={route === key ? "page" : undefined}><Icon name={key} />{label}</a>)}</div>
        </details>
        <a className="settings-link" href="#settings" aria-current={route === "settings" ? "page" : undefined}><Icon name="settings" /><span>Settings</span></a>
      </nav>
    </header>
    <main ref={mainRef} id="main-content" tabIndex={-1} className={route === "grammar" ? "workspace grammar-workspace" : "workspace"}>
      {route !== "grammar" && <div className="page-context"><a href="#grammar">Your workspace</a><span>/</span><span>{title}</span></div>}
      {pages[route]}
    </main>
    <footer className="site-footer"><span>Small steps. Better English.</span><div><a href="#handbook">Your handbook</a><a href="#coach">Find your next step<Icon name="arrow" /></a></div></footer>
  </div>;
}

function DetailSection({
  variant,
  icon,
  title,
  children,
}: {
  variant: string;
  icon: React.ComponentProps<typeof Icon>["name"];
  title: string;
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
        <h2 id={"detail-" + variant + "-title"}>{title}</h2>
        <div className="detail-copy">{children}</div>
      </div>
    </section>
  );
}
