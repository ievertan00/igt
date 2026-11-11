import { Dashboard, Coach, PracticeLog } from "./LearningPages";
import { Heading, Panel, State } from "./Page";
import { useGuideCopy, LearnerLanguageSwitch, GuideText } from "./learner-language";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { Ask } from "./Ask";
import { GrammarFollowUp } from "./GrammarFollowUp";
import { SelectionLookup } from "./SelectionLookup";
import { webApi } from "./api/client";
import { useDailyReviewSession } from "./review-session";
import { reviewExampleParts } from "./review-example";
import { VocabularyLibrary } from "./VocabularyLibrary";
import { PageScrollControls } from "./PageScrollControls";
import "./Writing.css";
import "./Handbook.css";
import { CorrectionText } from "./CorrectionText";
import { ModelSwitcher, useModelSettings, type ModelProfile, type ModelSettings } from "./model-settings";

type Route =
  | "dashboard"
  | "grammar"
  | "translation"
  | "word-lookup"
  | "word-review"
  | "word-library"
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
  ["word-library", "Saved words"],
  ["practice", "Practice"],
  ["ask", "Ask"],
  ["handbook", "Handbook"],
  ["coach", "Learning reports"],
  ["settings", "Model settings"],
];

function formatActivityTimestamp(value: unknown) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "Unknown date";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Grammar() {
  const { t } = useGuideCopy();
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
        <span className="writing-badge"><Icon name="spark" /><GuideText text="AI-Powered Writing Enhancer" /></span>
        <h1>
          Write with clarity<span className="accent-dot">.</span>
        </h1>
        <p><GuideText text="Refine your tone, catch subtle grammar nuances, and learn standard phrasing with contextual feedback." /></p>
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
          {t("Your English sentence")}
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
          placeholder={t("Write something in English…")}
          aria-describedby="grammar-hint"
        />
        <div className="composer-actions">
          <span id="grammar-hint" className="sr-only">
            {busy ? t("Checking grammar and wording…") : t("Try writing it yourself first. Use AI feedback as your continuous learning guide.")}
          </span>
          <ModelSwitcher disabled={busy || saving} />
          <button className="primary" type="submit" aria-busy={busy} disabled={busy || saving || !text.trim()}>
            {busy ? (
              <>
                <span className="loading-spinner" />
                {t("Checking…")}
              </>
            ) : (
              <>
                <GuideText text="Check my English" />
                <Icon name="arrow" />
              </>
            )}
          </button>
        </div>
      </form>
      {result?.error && (
        <State title={t("Could not check your English. Try again.")} detail={result.error} />
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
            <p>{data.correction ? <CorrectionText original={checkedText} correction={data.correction} /> : "No correction needed."}</p>
          </DetailSection>
            <DetailSection
              variant="natural"
              icon="spark"
              title="More natural"
              action={data.refine ? <CopyButton value={data.refine} label="More natural wording" /> : undefined}
            >
              <p>{data.refine || "No alternative wording provided."}</p>
            </DetailSection>
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
            <p className="review-save-hint"><Icon name="bookmark" />{t("Save this feedback to your personalized learning log for revision later.")}</p>
            <button
              className="primary save-review"
              aria-busy={saving}
              onClick={save}
              disabled={busy || saving || didSave}
            >
              <Icon name={didSave ? "check" : "bookmark"} />
              {saving ? t("Saving…") : didSave ? t("Saved to review log") : t("Save to review log")}
            </button>
            {saved && (
              <p className={didSave ? "sr-only" : "status"} role="status">
                {saved}
              </p>
            )}
          </div>
          <GrammarFollowUp key={JSON.stringify([checkedText, data])} context={[
            `Original sentence: ${checkedText}`,
            `Evaluation: ${evaluation}`,
            `Correction: ${data.correction || "No correction needed."}`,
            data.refine ? `More natural: ${data.refine}` : "",
            `Why: ${diagnoses.map((item: { label: string; explanation: string }) => `${item.label}: ${item.explanation}`).join("\n") || "No explanation provided."}`,
            `Remember: ${data.remember || "No reminder provided."}`,
          ].filter(Boolean).join("\n\n")} />
        </div>
      )}
    </div>
  );
}
function Express() {
  const { t } = useGuideCopy();
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
        detail={<GuideText text="Explore an English version of your Chinese text, or check what an English passage means in Chinese. Compare the wording, then try expressing the idea yourself." />}
      />
      <Panel title={t("Your text")} icon="translation" className="express-composer">
        <div className="switches">
          <button
            className={direction === "zh2en" ? "selected" : ""}
            aria-pressed={toEnglish}
            disabled={busy}
            onClick={() => changeDirection("zh2en")}
          >
            <GuideText text="Chinese → English" />
          </button>
          <button
            className={direction === "en2zh" ? "selected" : ""}
            aria-pressed={!toEnglish}
            disabled={busy}
            onClick={() => changeDirection("en2zh")}
          >
            <GuideText text="English → Chinese" />
          </button>
        </div>
        <label className="form-label" htmlFor="translation-input">
          <GuideText text={toEnglish ? "What do you want to say?" : "What do you want to understand?"} />
        </label>
        <textarea
          id="translation-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            toEnglish
              ? t("Describe your idea in Chinese. You can include who you’re speaking to and the tone you want.")
              : t("Paste an English sentence or passage. Include the context if it helps explain the meaning.")
          }
        />
        <div className="input-bottom-toolbar">
        <ModelSwitcher disabled={busy} />
        <button className="primary" onClick={submit} aria-busy={busy} disabled={busy || !text.trim()}>
          {busy
            ? toEnglish
              ? t("Finding the right words…")
              : t("Explaining the meaning…")
            : toEnglish
              ? t("Say it in English →")
              : t("Explain in Chinese →")}
        </button>
        </div>
      </Panel>
      {result?.error && (
        <State title={t("Couldn’t find an expression. Try again.")} detail={result.error} />
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
function formatReviewDueDate(value?: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function ReviewSentence({ text, masked }: { text: string; masked?: boolean }) {
  if (!masked) return <p lang="en">{text}</p>;
  return (
    <p lang="en">
      <span className="sr-only">{text.replace(/_{2,}/g, "blank")}</span>
      <span aria-hidden="true">
        {text.split(/(_{2,})/).map((part, i) =>
          /^_{2,}$/.test(part) ? (
            <span className="review-blank" key={i}>{part}</span>
          ) : (
            part
          ),
        )}
      </span>
    </p>
  );
}
function WordReview() {
  const { t } = useGuideCopy();
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
    answer: submittedAnswer,
    result,
    correct,
    wrong,
    limit,
    setLimit,
    submit,
    rate,
    pendingRating,
    next,
    remove,
    markAudio,
    retry,
    startNew,
  } = useDailyReviewSession();
  const [answer, setAnswer] = useState("");
  const [showFirstLetter, setShowFirstLetter] = useState(false);
  const [showDeleteHint, setShowDeleteHint] = useState(false);
  const [ratingHint, setRatingHint] = useState<string | null>(null);
  const [focusMethod, setFocusMethod] = useState<"pointer" | "keyboard">("pointer");
  const composing = useRef(false);
  const answerRef = useRef<HTMLInputElement>(null);
  const ratingRef = useRef<HTMLFieldSetElement>(null);
  const card = cards[index];
  useLayoutEffect(() => {
    setAnswer("");
    setShowFirstLetter(false);
    setShowDeleteHint(false);
    setRatingHint(null);
    composing.current = false;
  }, [index, cards]);
  useLayoutEffect(() => {
    if (!revealed) {
      answerRef.current?.focus({ preventScroll: true });
    } else {
      ratingRef.current?.focus({ preventScroll: true });
    }
  }, [card?.id, revealed]);
  const details = card?.vocab_details;
  const examples = details?.examples?.length ? details.examples : [card?.example].filter(Boolean);
  const targetWord = card?.word || card?.answer || "";
  const partOfSpeech = card?.pos || details?.pos || "";
  const pronunciation = details?.phonetic || details?.phonetics || "";
  const maskedExample =
    card?.masked_example && card.masked_example.includes("___") ? card.masked_example : "";
  const completeExample = card?.example || examples[0] || "";
  const reviewed = Math.min(cards.length, correct + wrong);
  const accuracy = reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0;
  const complete = !loading && !error && !card;
  const completionRef = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (complete) completionRef.current?.focus({ preventScroll: true });
  }, [complete]);
  const firstLetter = targetWord.match(/[A-Za-z]/)?.[0] || "";
  const feedbackState = result?.correct ? "correct" : submittedAnswer?.trim() ? "incorrect" : "revealed";
  const feedbackLabel = feedbackState === "correct" ? "Correct!" : feedbackState === "incorrect" ? "Not quite" : "Answer revealed";
  const exploreExamples = examples.filter(Boolean);
  const hasMoreDetails = Boolean(
    exploreExamples.length > 0 || details?.synonyms || details?.collocations || details?.note || card?.note,
  );
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (composing.current || grading || starting || revealed) return;
    void submit(answer);
  }
  function handleResultKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, summary, a, input, textarea, select")) return;
    event.preventDefault();
    if (!grading && !starting) next();
  }
  const sessionAction = (
        <div className="review-limit-field">
          <label htmlFor="review-limit">Cards in the next batch</label>
          <div className="review-limit-stepper">
          <button type="button" aria-label="Fewer cards" disabled={loading || grading || starting || limit <= 1} onClick={() => setLimit(Math.max(1, limit - 1))}>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden="true"><path d="M5 12h14" /></svg>
          </button>
          <input
            id="review-limit"
            type="number"
            min="1"
            max="100"
            value={limit}
            disabled={loading || grading || starting}
            onChange={(event) => setLimit(Number(event.target.value))}
          />
          <button type="button" aria-label="More cards" disabled={loading || grading || starting || limit >= 100} onClick={() => setLimit(Math.min(100, limit + 1))}>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden="true"><path d="M5 12h14 M12 5v14" /></svg>
          </button>
          </div>
        </div>
  );
  const sessionControls = (
    <div className="review-session-tools">{sessionAction}</div>
  );
  return (
    <div
      className="word-review-page"
      data-focus-method={focusMethod}
      onPointerDownCapture={() => setFocusMethod("pointer")}
      onKeyDownCapture={(event) => {
        if (event.key === "Tab") setFocusMethod("keyboard");
      }}
    >
      <div className="review-header">
        <div className="review-title-group">
          <span className="review-title-mark" aria-hidden="true"><Icon name="handbook" /></span>
          <Heading
            eyebrow="VOCABULARY · REVIEW"
            title="Vocabulary review"
            detail={t("Recall the expression. Make it easier to use next time.")}
          />
        </div>
        <button className="secondary review-new-session" onClick={startNew} disabled={loading || grading || starting} aria-busy={starting}>
          {starting ? "Starting…" : t("Start a new session")}<Icon name="arrow" />
        </button>
      </div>
      {startError && (
        <State title={t("Could not start a new session. Try again.")} detail={startError} />
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
                ? "Could not save your review. Try again."
                : "Could not load your review. Try again."
            }
            detail={error}
          />
          {!card && <button onClick={retry}>Try again</button>}
        </>
      )}
      {complete && (
        <div className="review-complete-options">{sessionControls}</div>
      )}
      {complete && (
        <Panel title="Your review today" icon="word-review" className="review-empty-state">
          <div className="review-completion">
            <span className="review-completion-mark" aria-hidden="true">
              <Icon name="check" />
            </span>
            <h3 ref={completionRef} tabIndex={-1}>
              {cards.length ? "Review session complete." : "No vocabulary cards due."}
            </h3>
            <p>
              {cards.length
                ? `You reviewed ${reviewed} of ${cards.length} vocabulary cards today. Try using a few in your own sentences.`
                : "Come back later, or look up a word and save it to your vocabulary."}
            </p>
            {cards.length > 0 && (
              <dl className="review-summary">
                <div>
                  <dt>Completed</dt>
                  <dd>{reviewed}<span> of {cards.length}</span></dd>
                </div>
                <div>
                  <dt>Correct</dt>
                  <dd>{correct}</dd>
                </div>
                <div>
                  <dt>Incorrect</dt>
                  <dd>{wrong}</dd>
                </div>
                <div>
                  <dt>Accuracy</dt>
                  <dd>{accuracy}%</dd>
                </div>
              </dl>
            )}
            <a className="primary review-completion-link" href="#word-lookup">
              Back to Vocabulary
              <Icon name="arrow" />
            </a>
          </div>
        </Panel>
      )}
      {card && (
        <section className="review-card" aria-label="Vocabulary recall">
          <div className="review-card-meta">
            <div className="review-progress-group">
              <div className="review-progress-label">
                <span>Card <strong>{index + 1}</strong> of {cards.length}</span>
              </div>
              <div
                className="review-progress"
                role="progressbar"
                aria-label="Review progress"
                aria-valuemin={0}
                aria-valuemax={cards.length}
                aria-valuenow={reviewed}
                aria-valuetext={`${reviewed} of ${cards.length} cards reviewed`}
              >
                <span style={{ width: `${cards.length ? (reviewed / cards.length) * 100 : 0}%` }} />
              </div>
              <span className="review-progress-percent" aria-hidden="true">{Math.round(reviewed / cards.length * 100)}%</span>
            </div>
            {sessionControls}
          </div>
          <div className={`review-body${revealed ? " is-feedback" : ""}`} key={card.id}>
            <div className="review-prompt">
              <span className="review-prompt-art" aria-hidden="true"><Icon name="handbook" /></span>
              {partOfSpeech && <span className="review-part-of-speech" lang="en">{partOfSpeech}</span>}
              <h2 lang={card.zh ? "zh" : undefined}>
                {card.zh || "Recall this English expression"}
              </h2>
              {pronunciation && (
                <p className="review-phonetic" lang="en">{pronunciation}</p>
              )}
              <p className="review-meaning" lang="en">
                {card.meaning || "Write the English expression that matches this clue."}
              </p>
              {!revealed && (
                <div className="review-hints" role="group" aria-label="Hints">
                  <span
                    className="review-audio-hint"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("button")) markAudio();
                    }}
                  >
                    <AudioButton
                      text={card.example ? `${card.word}. ${card.example}` : card.word || card.answer}
                      reviewPrompt
                    />
                  </span>
                  {firstLetter && (
                    <div className="review-letter-slot">
                      {!showFirstLetter ? (
                        <button
                          type="button"
                          className="review-hint-button"
                          disabled={grading || starting}
                          onClick={() => setShowFirstLetter(true)}
                        >
                          <Icon name="idea" />
                          Show first letter
                        </button>
                      ) : (
                        <span className="review-letter-hint" role="status">
                          Starts with “{firstLetter}”
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            {!revealed ? (
              <form className="review-recall-form" onSubmit={handleSubmit}>
                <div className="review-answer-composer">
                  <label className="form-label" htmlFor="review-answer">Your answer</label>
                  <input
                    ref={answerRef}
                    id="review-answer"
                    lang="en"
                    value={submittedAnswer ?? answer}
                    maxLength={1000}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder={t("Type the English word or phrase…")}
                    readOnly={
                      (submittedAnswer !== null && submittedAnswer !== undefined) || grading || starting
                    }
                    onChange={(event) => setAnswer(event.target.value)}
                    onCompositionStart={() => { composing.current = true; }}
                    onCompositionEnd={() => { composing.current = false; }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.nativeEvent.isComposing || composing.current)) {
                        event.preventDefault();
                      }
                    }}
                    aria-describedby="review-recall-hint"
                  />
                </div>
                <div id="review-recall-hint" className="review-answer-guidance">
                  <p>{t("Case, spaces and hyphens do not affect spelling.")}</p>
                  <p>{t("Cannot recall it? Leave your answer blank and check.")}</p>
                </div>
                <div className="review-recall-actions">
                  <button type="submit" className="primary review-check" aria-busy={grading} disabled={grading || starting}>
                    {grading ? t("Checking…") : submittedAnswer != null ? "Retry check" : t("Check answer")}
                    <Icon name="arrow" />
                  </button>
                </div>
              </form>
            ) : (
              <div className="review-feedback" onKeyDown={handleResultKeyDown}>
                <p className="sr-only" role="status">{feedbackLabel} The correct expression is {targetWord}.</p>
                <div className={`review-result-group is-${feedbackState}`}>
                  <div className="review-result-heading">
                    <div className={`review-verdict is-${feedbackState}`}>
                      <span className="review-verdict-mark" aria-hidden="true">
                        <Icon name={feedbackState === "correct" ? "check" : feedbackState === "incorrect" ? "close" : "info"} />
                      </span>
                      <strong>{feedbackLabel}</strong>
                    </div>
                    <span
                      className="review-delete-control"
                      onMouseEnter={() => setShowDeleteHint(true)}
                      onMouseLeave={(event) => {
                        if (!event.currentTarget.contains(document.activeElement)) setShowDeleteHint(false);
                      }}
                    >
                      <button
                        type="button"
                        className="review-remove-card"
                        disabled={grading || starting}
                        aria-describedby="review-delete-hint"
                        onFocus={() => setShowDeleteHint(true)}
                        onBlur={() => setShowDeleteHint(false)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setShowDeleteHint(false);
                        }}
                        onClick={() => void remove()}
                      >
                        <Icon name="trash" />
                        Delete
                      </button>
                      <span id="review-delete-hint" role="tooltip" hidden={!showDeleteHint}>
                        Remove this word from your review queue.
                      </span>
                    </span>
                  </div>
                  <div className="review-expression">
                    <div className="review-expression-word">
                      <div className="review-expression-title">
                        <h2 lang="en">{targetWord}</h2>
                        <AudioButton text={targetWord} />
                      </div>
                      <div className="review-word-meta">
                        {(partOfSpeech || pronunciation) && (
                          <p lang="en">{[partOfSpeech, pronunciation].filter(Boolean).join(" · ")}</p>
                        )}
                      </div>
                    </div>
                    {(details?.verbForms || details?.plural) && (
                      <dl className="review-word-forms">
                        {[["Verb forms", details?.verbForms], ["Plural", details?.plural]]
                          .filter(([, value]) => value)
                          .map(([label, value]) => (
                            <div key={label}>
                              <dt>{label}</dt>
                              <dd lang="en">{value}</dd>
                            </div>
                          ))}
                      </dl>
                    )}
                  </div>
                  {submittedAnswer?.trim() && (
                    <p className="review-your-answer">
                      Your answer: <span lang="en">{submittedAnswer}</span>
                    </p>
                  )}
                </div>
                <div className="review-flow-actions">
                  {hasMoreDetails && (
                    <section className="review-explore">
                      <div className="review-explore-heading">
                        <h3 className="review-explore-title">Explore this word</h3>
                      </div>
                      {exploreExamples.length > 0 && (
                        <div className="review-explore-examples">
                          <div className="review-examples-heading">
                            <Icon name="document" />
                            <h4 className="review-explore-subtitle">In a sentence</h4>
                            <span>{exploreExamples.length} example{exploreExamples.length === 1 ? "" : "s"}</span>
                          </div>
                          <ul className="review-example-list">
                            {exploreExamples.map((example: string, i: number) => (
                              <li className="review-result-example" key={i}>
                                <p lang="en">{reviewExampleParts(example, targetWord).map((part, index) =>
                                  part.highlighted ? <mark key={index}>{part.text}</mark> : part.text
                                )}</p>
                                <span className="example-controls">
                                  <AudioButton text={example} small />
                                  <CopyButton value={example} label="Example" small />
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <dl>
                        {[
                          ["Synonyms", details?.synonyms],
                          ["Collocations", details?.collocations],
                          ["Usage note", details?.note || card.note],
                        ]
                          .filter(([, value]) => value)
                          .map(([label, value]) => (
                            <div key={label} className={label === "Usage note" ? "review-usage-note" : label === "Synonyms" ? "review-synonyms" : "review-collocations"}>
                              <dt><Icon name={label === "Usage note" ? "idea" : label === "Synonyms" ? "word-lookup" : "document"} />{label}</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
                      </dl>
                    </section>
                  )}
                  {(!result?.persistence?.saved || result?.rating) && (
                    <fieldset className="review-ratings" ref={ratingRef} tabIndex={-1} aria-describedby="review-rating-help" aria-busy={grading}>
                      <legend>How well did you recall it?</legend>
                      <p id="review-rating-help" className="sr-only">按本次回忆感受评分；拼写对错单独记录。</p>
                      <div className="review-rating-options">
                        {([
                          ["again", "Again", "未想起。"],
                          ["hard", "Hard", "费力想起。"],
                          ["good", "Good", "正常想起。"],
                          ["easy", "Easy", "轻松想起。"],
                        ] as const).map(([key, label, description]) => {
                          const days = result?.ratings?.[key]?.intervalDays;
                          const selected = (result?.rating || pendingRating) === key;
                          return (
                            <span
                              key={key}
                              className="review-rating-control"
                              onMouseEnter={() => setRatingHint(key)}
                              onMouseLeave={(event) => {
                                if (!event.currentTarget.contains(document.activeElement)) setRatingHint(null);
                              }}
                            >
                              <button
                                type="button"
                                className="review-rating-button"
                                data-rating={key}
                                aria-describedby={`review-rating-hint-${key}`}
                                aria-pressed={selected}
                                disabled={grading || starting || result?.persistence?.saved || Boolean(pendingRating && pendingRating !== key)}
                                onFocus={() => setRatingHint(key)}
                                onBlur={() => setRatingHint(null)}
                                onKeyDown={(event) => {
                                  if (event.key === "Escape") setRatingHint(null);
                                }}
                                onClick={() => void rate(key)}
                              >
                                <svg className={`review-rating-face is-${key}`} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
                                  <circle className="review-face-fill" cx="18" cy="18" r="17" />
                                  <path className="review-face-features" d="M12 13h.01 M24 13h.01" strokeWidth="3.5" />
                                  <path className="review-face-features" d={key === "again" ? "M11 25c3-7 11-7 14 0" : key === "hard" ? "M12 23h12" : key === "good" ? "M11 22c3 5 11 5 14 0" : "M10 21c3 8 13 8 16 0"} strokeWidth="1.8" />
                                </svg>
                                <strong>{pendingRating === key ? grading ? t("Saving…") : `Retry ${label}` : label}</strong>
                                <span className="review-rating-interval">{days === 0 ? "Later" : days != null ? `${days}d` : ""}</span>
                              </button>
                              <span id={`review-rating-hint-${key}`} role="tooltip" className="review-rating-hint" hidden={ratingHint !== key} lang="zh-CN">
                                {description}{days === 0 ? "本轮末尾再练。" : days != null ? `下次复习：${days} 天后。` : ""}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    </fieldset>
                  )}
                  {result?.persistence?.saved && result?.rating && (
                    <p className="review-rating-saved" role="status">
                      {result.rating === "again" ? "Again saved. This word will return later in this session."
                        : `${result.rating[0].toUpperCase()}${result.rating.slice(1)} saved. Next review in ${result.next?.intervalDays} day${result.next?.intervalDays === 1 ? "" : "s"}.`}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
function WordLookup({ initialQuery = "", compact = false }: { initialQuery?: string; compact?: boolean }) {
  const { t } = useGuideCopy();
  const [query, setQuery] = useState(initialQuery);
  const [entry, setEntry] = useState<any>();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const lookupPending = useRef(false);
  useEffect(() => {
    if (!initialQuery) return;
    const timer = window.setTimeout(() => { void lookup(); }, 0);
    return () => window.clearTimeout(timer);
  }, [initialQuery]);
  async function lookup() {
    if (lookupPending.current || saving || !query.trim()) return;
    lookupPending.current = true;
    setBusy(true);
    setStatus("");
    setEntry(undefined);
    try {
      const result = await webApi.lookupWord(query.trim());
      setEntry(result.data);
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      lookupPending.current = false;
      setBusy(false);
    }
  }
  async function add() {
    if (saving || busy || !entry || entry.existing) return;
    setSaving(true);
    try {
      const result = await webApi.addWord(entry);
      setEntry((old: any) => ({ ...old, existing: true }));
      setStatus(
        result.persistence?.saved
          ? "Saved to your vocabulary"
          : "This word is already in your vocabulary.",
      );
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setSaving(false);
    }
  }
  const examples = [entry?.example || entry?.example1, entry?.example2, entry?.example3].filter(
    Boolean,
  );
  const compactResult = !compact && Boolean(entry);
  const learningActions = !compact && (
    <div className="lookup-learning-actions">
      <a className="secondary" href="#word-library"><Icon name="word-library" />Saved words</a>
      <a className="secondary" href="#word-review"><Icon name="word-review" /><GuideText text="Review due words" /></a>
    </div>
  );
  return (
    <div className={compactResult ? "word-page word-lookup-page" : "word-page"}>
      {compactResult ? <header className="lookup-header">
        <h1>{t("Word lookup")}</h1>
        {learningActions}
      </header> : !compact && <>
        <Heading
          eyebrow="WORD LOOKUP"
          title="Get to know a word."
          detail={<GuideText text="Enter an English word or a Chinese expression. Find its English meaning, examples, and common combinations, then save it for review." />}
        />
        {learningActions}
      </>}
      <Panel title={compactResult ? undefined : "Word or phrase"} icon="word-lookup" className="lookup-form">
        <label className="form-label" htmlFor={compact ? "selection-lookup-input" : "word-lookup-input"}>
          {compactResult ? t("English or Chinese word or phrase") : "English or Chinese word or phrase"}
        </label>
        <div className="lookup-row lookup-input-composer">
          <input
            id={compact ? "selection-lookup-input" : "word-lookup-input"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) void lookup(); }}
            placeholder={t("Try “follow up” or “跟进”")}
          />
          <div className="input-bottom-toolbar">
            <ModelSwitcher disabled={busy || saving} id={compact ? "selection-model" : "workspace-model"} />
            <button className={entry && !entry.existing ? "secondary" : "primary"} onClick={lookup} aria-busy={busy} disabled={busy || saving}>
              {busy ? "Looking it up…" : <><GuideText text="Look up" /><Icon name="arrow" /></>}
            </button>
          </div>
          </div>
      </Panel>
      {entry && (
        <Panel title={entry.word} icon="word-lookup" className="lookup-result">
          {entry.translated && <p className="status" role="status">English expression for “{entry.requested}”: <strong>{entry.lookup}</strong></p>}
          <WordDetails entry={entry} examples={examples} showWord={compact} />
          <button className="primary" onClick={add} aria-busy={saving} disabled={saving || entry.existing}>
            <Icon name="handbook" />
            {saving ? t("Saving…") : entry.existing ? "Already in your vocabulary" : "Save to vocabulary"}
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

function WordDetails({ entry, examples, showWord = true }: { entry: any; examples: string[]; showWord?: boolean }) {
  return (
    <div className="word-details">
      <div className="word-heading">
        <div>
          <div className="word-heading-meta">
            {entry.pos && <span className="word-pos">{entry.pos}</span>}
            {entry.phonetic && <span className="word-phonetic">{entry.phonetic}</span>}
          </div>
          {showWord && <h3>{entry.word}</h3>}
        </div>
        <AudioButton text={entry.word} />
      </div>
      {(entry.verbForms || entry.plural) && (
        <div className="word-detail-pair">
          {entry.verbForms && (
            <section className="word-detail-block word-verb-forms">
              <div className="word-detail-icon">
                <Icon name="grammar" />
              </div>
              <div>
                <h4>Verb forms</h4>
                <p>{entry.verbForms}</p>
              </div>
            </section>
          )}
          {entry.plural && (
            <section className="word-detail-block word-plural">
              <div className="word-detail-icon">
                <Icon name="word-library" />
              </div>
              <div>
                <h4>Plural</h4>
                <p>{entry.plural}</p>
              </div>
            </section>
          )}
        </div>
      )}
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
  const { t } = useGuideCopy();
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
      <p className="practice-section-hint">{t("Choose a context or keep all contexts.")}</p>
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
  const { t } = useGuideCopy();
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
        detail={<GuideText text="Try translating a Chinese sentence into English before checking the AI feedback. Use the suggestions to revise your answer and try a new sentence of your own." />}
      />
      {targetErrorType && <section className="practice-target" aria-label="Handbook learning target">
        <h2>{targetErrorType}</h2>
        <p>{t("Related sentence practice from your Handbook. Your overall translation score and hints used will be recorded separately from mastery of this pattern.")}</p>
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
              <p className="practice-section-hint">{t("Choose how many questions for this session.")}</p>
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
                  {t("Match the level to your current ability and goal.")}
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
                <p>{t("Choose a level and context for a short session from the question bank.")}</p>
              </div>
            </div>
            <div className="practice-guide-item">
              <Icon name="translation" />
              <div>
                <h3>Try it yourself</h3>
                <p>
                  {t("Write your own translation first. If you get stuck, reveal a hint one step at a time.")}
                </p>
              </div>
            </div>
            <div className="practice-guide-item">
              <Icon name="ask" />
              <div>
                <h3>Learn from feedback</h3>
                <p>{t("Compare the suggestions with your answer. The reference is one possible expression; other answers may also work.")}</p>
              </div>
            </div>
            <p className="practice-guide-note">
              <Icon name="bookmark" />
              {t("Your attempts are recorded. One good answer is a useful step; try using the expression again later.")}
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
            <div className="practice-model-actions">
            <ModelSwitcher disabled={busy} />
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
            </div>
          </aside>
        </div>
      )}
      {!question && generationError && (
        <State title={t("Could not prepare practice. Please try again.")} detail={generationError} />
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
            <p>{t("Translate this sentence into English.")}</p>
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
          <div className="practice-input-composer">
          <textarea
            id="practice-input"
            value={answer}
            disabled={busy}
            onChange={(e) => {
              setAnswer(e.target.value);
              setEvaluation(undefined);
              setSaveWarning("");
            }}
            placeholder={t("Write your translation in English…")}
          />
          <div className="input-bottom-toolbar">
          <ModelSwitcher disabled={busy} />
          <button className="primary" onClick={evaluate} aria-busy={busy} disabled={busy || !answer.trim()}>
            {busy ? (
              "Reviewing…"
            ) : (
              <>
                {t("Check answer")}
                <Icon name="arrow" />
              </>
            )}
          </button>
          </div>
          </div>
          {evaluation?.error && (
            <State title={t("Could not review this answer. Try again.")} detail={evaluation.error} />
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

function HandbookCopy({ text }: { text: string }) {
  const [status, setStatus] = useState("");
  return <span className="handbook-copy"><IconButton quiet icon={status === "Copied" ? "check" : "copy"} label="Copy correction" onClick={async () => {
    try { await navigator.clipboard.writeText(text); setStatus("Copied"); }
    catch { setStatus("Could not copy. Select and copy the correction."); }
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

function Handbook() {
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
  const [showNotes, setShowNotes] = useState(true);
  const [deleteStatus, setDeleteStatus] = useState("");
  const deleteInFlight = useRef(false);
  const refreshRef = useRef<HTMLButtonElement>(null);
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
      if (id === requestId.current) setError("Your saved Grammar checks could not be loaded. Please try again.");
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
      requestAnimationFrame(() => refreshRef.current?.focus({ preventScroll: true }));
    } finally {
      deleteInFlight.current = false;
      setBusy(false);
    }
  }
  return <div className="handbook-page">
    <div className="coach-header">
      <Heading eyebrow="HANDBOOK · HISTORY" title="Your saved Grammar checks." detail={t("Review the original sentences, corrections and explanations saved in your Review Log. Refresh to load the latest checks.")} />
      <button ref={refreshRef} className="secondary" disabled={busy} onClick={() => void load()}><Icon name="word-review" />{busy ? t("Loading…") : t("Refresh")}</button>
    </div>
    <form className="handbook-filters" onSubmit={event => { event.preventDefault(); navigate({ search: search.trim() }); }}>
      <label>{t("Time window")}<select value={days} disabled={busy} onChange={event => navigate({ days: event.target.value })}>
        {![0, 7, 30, 90].includes(days) && <option value={days}>{t("Last {days} days", { days })}</option>}
        <option value={0}>{t("All history")}</option><option value={7}>Last 7 days</option><option value={30}>{t("Last 30 days")}</option><option value={90}>Last 90 days</option>
      </select></label>
      <label>{t("Search saved checks")}<input type="search" value={search} maxLength={200} onChange={event => setSearch(event.target.value)} placeholder={t("Search sentences, corrections or notes")} /></label>
      <label>{t("Diagnoses")}<select value={diagnosis} disabled={busy} onChange={event => navigate({ diagnosis: event.target.value })}>
        <option value="all">{t("All checks")}</option><option value="with">{t("With diagnosed mistakes")}</option><option value="none">{t("No diagnosed mistakes")}</option>
      </select></label>
      <label>{t("Mistake type")}<select value={errorType} disabled={busy || diagnosis === "none"} onChange={event => navigate({ errorType: event.target.value })}>
        <option value="">{t("All mistake types")}</option>
        {errorType && !data?.categories.some(item => item.errorType === errorType) && <option value={errorType}>{errorType}</option>}
        {data?.categories.map(item => <option key={item.errorType} value={item.errorType}>{item.errorType} ({item.checks})</option>)}
      </select></label>
      <div className="handbook-filter-footer">
        <div className="handbook-filter-actions"><button className="primary" type="submit" disabled={busy}>{t("Search")}<Icon name="arrow" /></button>
        <button className="handbook-clear" type="button" disabled={busy} onClick={() => navigate({ days: 0, search: "", errorType: "", diagnosis: "all" })}>{t("Clear filters")}</button></div>
      </div>
    </form>
    {deleteStatus && <p role="status" className="handbook-evidence">{t(deleteStatus)}</p>}
    {error && <div role="alert" className="handbook-empty"><State title={t("Could not load Handbook")} detail={error} />{data && <p>{t("Previously loaded checks remain below.")}</p>}<button onClick={() => void load()}>{t("Try again")}</button></div>}
    <div aria-busy={busy}>
      {busy && <p role="status">{t("Loading saved checks…")}</p>}
      {data && <>
        {data.coverage.undated > 0 && days !== 0 && <p className="handbook-evidence">{t("Some records have no usable date and cannot be placed in this time window.")}</p>}
        {data.diagnosis === "none" && <p className="handbook-evidence">{t("No diagnosed mistakes describes the saved feedback. It does not establish error-free writing or mastery.")}</p>}
        <Panel title={t("Grammar check log")} className="handbook-log">
          {data.entries.length ? data.entries.map(entry => <article className="activity handbook-example" key={entry.entryId} id={`check-${entry.entryId}`}>
            <header className="handbook-source">
              <span className="handbook-entry-meta"><time><Icon name="word-review" />{timestampLabel(entry.timestamp)}</time>
                {[...new Set(entry.diagnoses.map(item => item.error_type))].map(type => <span className="handbook-type" key={type}>{type}</span>)}
                <span className="handbook-origin">{entry.source === "grammar" ? t("Writing · Grammar") : t("Historical check")}</span>
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
            {entry.refine && <section className="handbook-natural"><h3><Icon name="spark" />{t("More natural alternative")}</h3><p lang="en">{entry.refine}</p></section>}
            <details className="handbook-refine" hidden={!showNotes} open><summary>{t("Saved explanations and notes")}</summary>
              {entry.evaluate && <p>{entry.evaluate}</p>}
              {entry.diagnoses.map((item, index) => <section className="handbook-diagnosis" key={index}><h3>{item.error_type}</h3><p>{item.explanation}</p>{item.evidence && <p>Evidence: {item.evidence}</p>}{item.suggestion && <p>Suggestion: {item.suggestion}</p>}</section>)}
              {entry.remember && <section className="handbook-remember"><h3><Icon name="idea" />Remember</h3><p>{Array.isArray(entry.remember) ? entry.remember.join("\n") : entry.remember}</p></section>}
              {!entry.evaluate && !entry.diagnoses.length && !entry.refine && !entry.remember && <p>{t("No additional notes were saved.")}</p>}
            </details>
          </article>) : <div className="handbook-empty"><State title={t("No saved checks to show.")} detail={data.coverage.grammar ? t("Try another search, clear your filters or return to the first page.") : t("Save a Grammar check to start your log, or choose a longer time window.")} /><a href="#grammar">{t("Check a sentence")}</a></div>}
        </Panel>
        {(data.pagination.total > 0 || offset > 0) && <nav className="handbook-pagination" aria-label="Grammar check pages"><span>{data.entries.length ? `${data.pagination.offset + 1}–${data.pagination.offset + data.entries.length} of ${data.pagination.total} checks` : t("No checks on this page")}</span><button disabled={busy || offset === 0} onClick={() => navigate({ offset: Math.max(0, offset - data.pagination.limit) })}>{t("Previous")}</button><button disabled={busy || !data.pagination.hasMore} onClick={() => navigate({ offset: offset + data.pagination.limit })}>{t("Next")}</button></nav>}
      </>}
    </div>
    {Boolean(data?.entries.length) && <div className="floating-action-dock handbook-notes-dock">
      <button type="button" className="primary floating-action handbook-notes-toggle" title={showNotes ? t("Hide explanations & notes") : t("Show explanations & notes")} aria-pressed={showNotes} onClick={() => setShowNotes(value => !value)}>
        <Icon name={showNotes ? "eye-off" : "eye"} /><span className="sr-only">{showNotes ? t("Hide explanations & notes") : t("Show explanations & notes")}</span>
      </button>
    </div>}
  </div>;
}

const MODEL_PROVIDER_PRESETS = [
  { key: "openai", label: "OpenAI", provider: "custom", baseUrl: "https://api.openai.com/v1" },
  { key: "anthropic", label: "Anthropic", provider: "custom", baseUrl: "https://api.anthropic.com/v1" },
  { key: "deepseek", label: "DeepSeek", provider: "custom", baseUrl: "https://api.deepseek.com/v1" },
  { key: "ollama", label: "Ollama", provider: "ollama", baseUrl: "http://localhost:11434" },
  { key: "custom", label: "Custom (OpenAI-compatible)", provider: "custom", baseUrl: "" },
] as const;
type ProviderPresetKey = (typeof MODEL_PROVIDER_PRESETS)[number]["key"];
function presetFor(provider: string, baseUrl: string): ProviderPresetKey {
  if (provider === "ollama") return "ollama";
  const url = (baseUrl || "").toLowerCase();
  if (url.includes("openai.com")) return "openai";
  if (url.includes("anthropic.com")) return "anthropic";
  if (url.includes("deepseek.com")) return "deepseek";
  return "custom";
}
function displayUrl(url: string) {
  return (url || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
}
type ModelDraft = {
  id: string | null;
  name: string;
  preset: ProviderPresetKey;
  model: string;
  /** Legacy dual-role setups keep their Pro model when the single model is not edited. */
  pro?: string;
  baseUrl: string;
  apiKey: string;
  clearKey: boolean;
  setDefault: boolean;
  showKey: boolean;
  keyConfigured: boolean;
};
const emptyAddForm: Omit<ModelDraft, "id"> = {
  name: "", preset: "custom", model: "", baseUrl: "",
  apiKey: "", clearKey: false, setDefault: true, showKey: false, keyConfigured: false,
};

function LlmSettings() {
  const { t } = useGuideCopy();
  const models = useModelSettings();
  const [settingsTab, setSettingsTab] = useState<"models" | "markdown">("models");
  const [savedData, setSavedData] = useState<ModelSettings>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState("");
  const [editing, setEditing] = useState<ModelDraft>();
  const [deleting, setDeleting] = useState<ModelProfile>();
  const [addForm, setAddForm] = useState<ModelDraft>(() => ({ ...emptyAddForm, id: null }));
  const editDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (!models.settings || savedData) return; setSavedData(models.settings); }, [models.settings, savedData]);
  useEffect(() => { if (editing && editDialog.current && !editDialog.current.open) editDialog.current.showModal(); }, [editing]);
  useEffect(() => { if (deleting && deleteDialog.current && !deleteDialog.current.open) deleteDialog.current.showModal(); }, [deleting]);

  const profiles = savedData?.profiles || [];
  const presetOf = (provider: string, baseUrl: string) =>
    MODEL_PROVIDER_PRESETS.find(p => p.key === presetFor(provider, baseUrl)) || MODEL_PROVIDER_PRESETS[MODEL_PROVIDER_PRESETS.length - 1];
  function setPreset(draft: ModelDraft, key: ProviderPresetKey): ModelDraft {
    const next = MODEL_PROVIDER_PRESETS.find(p => p.key === key)!;
    const current = MODEL_PROVIDER_PRESETS.find(p => p.key === draft.preset)!;
    return { ...draft, preset: key, baseUrl: !draft.baseUrl || draft.baseUrl === current.baseUrl ? next.baseUrl : draft.baseUrl };
  }
  function openEdit(profile: ModelProfile) {
    const preset = presetOf(profile.provider, profile.baseUrl);
    setEditing({
      id: profile.id,
      name: profile.name,
      preset: preset.key,
      model: profile.models.flash || profile.models.pro || "",
      pro: profile.models.pro && profile.models.pro !== profile.models.flash ? profile.models.pro : undefined,
      baseUrl: profile.baseUrl || preset.baseUrl,
      apiKey: "",
      clearKey: false,
      setDefault: profile.id === savedData?.activeProfileId,
      showKey: false,
      keyConfigured: profile.keyConfigured,
    });
    setTestStatus(""); setError(""); setStatus("");
  }
  function closeEdit() { setEditing(undefined); }
  function resetAdd() { setAddForm({ ...emptyAddForm, id: null }); setTestStatus(""); setError(""); setStatus(""); }

  async function saveModel(action: "create" | "update", draft: ModelDraft) {
    const preset = MODEL_PROVIDER_PRESETS.find(p => p.key === draft.preset)!;
    const model = draft.model.trim();
    const baseUrl = (draft.baseUrl || preset.baseUrl).replace(/\/$/, "");
    if (!draft.name.trim()) { setError(t("Enter a configuration name")); return; }
    if (!model) { setError(t("Enter a model name")); return; }
    if (!baseUrl) { setError(t("Enter an API base URL")); return; }
    setBusy(true); setError(""); setStatus("");
    try {
      const saved = await webApi.saveLlmSettings({
        action,
        profileId: draft.id || "",
        profileName: draft.name.trim(),
        provider: preset.provider,
        apiKeys: { [preset.provider]: draft.apiKey },
        clearApiKeys: { [preset.provider]: draft.clearKey },
        models: { [preset.provider]: { flash: model, pro: (draft.pro && draft.pro !== model ? draft.pro : model) } },
        baseUrls: { [preset.provider === "ollama" ? "OllamaBaseUrl" : "CustomApiBase"]: baseUrl },
        setDefault: draft.setDefault,
      });
      models.update(saved);
      setSavedData(saved);
      setStatus(draft.setDefault ? t("Model configuration saved and applied.") : t("Model configuration saved."));
      setEditing(undefined);
      setTestStatus("");
      if (action === "create") setAddForm({ ...emptyAddForm, id: null });
    } catch (e: any) {
      setError(e.message || "Could not save settings");
    } finally {
      setBusy(false);
    }
  }

  async function testCurrent(draft: ModelDraft): Promise<boolean> {
    const preset = MODEL_PROVIDER_PRESETS.find(p => p.key === draft.preset)!;
    const baseUrl = (draft.baseUrl || preset.baseUrl).replace(/\/$/, "");
    if (!draft.model.trim() || !baseUrl) { setTestStatus(t("Enter an API base URL and a model name first")); return false; }
    setTesting(true); setTestStatus(""); setError("");
    try {
      const result = await webApi.testLlmConnection({ baseUrl, model: draft.model.trim(), apiKey: draft.apiKey || "", profileId: undefined, clearApiKey: false });
      const ok = !result?.error;
      setTestStatus(ok ? result.message || "Connection successful" : result.message || "Connection test failed");
      return ok;
    } catch (e: any) {
      setTestStatus(e.message || "Connection test failed");
      return false;
    } finally {
      setTesting(false);
    }
  }

  async function testAndAdd() {
    const draft = addForm;
    const preset = MODEL_PROVIDER_PRESETS.find(p => p.key === draft.preset)!;
    const model = draft.model.trim();
    const baseUrl = (draft.baseUrl || preset.baseUrl).replace(/\/$/, "");
    if (!draft.name.trim()) { setError(t("Enter a configuration name")); return; }
    if (!model) { setError(t("Enter a model name")); return; }
    if (!baseUrl) { setError(t("Enter an API base URL")); return; }
    if (preset.provider === "ollama") { await saveModel("create", draft); return; }
    const ok = await testCurrent(draft);
    if (ok) await saveModel("create", draft);
  }

  async function removeProfile() {
    if (!deleting) return;
    setBusy(true); setError(""); setStatus("");
    try {
      const saved = await webApi.saveLlmSettings({ action: "delete", profileId: deleting.id });
      models.update(saved);
      setSavedData(saved);
      setDeleting(undefined);
      setStatus(t("Model deleted."));
    } catch (e: any) {
      setError(e.message || t("Could not delete"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="llm-settings">
      <div className="settings-header" data-section={settingsTab}>
        <div className="settings-header-copy">
          <div aria-hidden={settingsTab !== "models"}>
            <Heading eyebrow={t("Settings")} title={t("Model settings")} detail={t("Connect Google Gemini, Qwen, DeepSeek, LM Studio, vLLM, and other OpenAI-compatible services.")} />
          </div>
          <div aria-hidden={settingsTab !== "markdown"}>
            <Heading eyebrow={t("Settings")} title={t("Markdown file settings")} detail={t("Choose where ClearWrite reads and saves your Markdown learning records.")} />
          </div>
        </div>
          <svg className="settings-art" viewBox="0 0 248 184" aria-hidden="true" focusable="false">
            <rect x="53" y="35" width="74" height="44" rx="12" fill="var(--accent-hover)" transform="rotate(2 53 35)" />
            <g transform="rotate(2 114 102)">
              <rect x="33" y="52" width="163" height="101" rx="21" fill="var(--accent)" />
              <path d="M53 108V96l6 7 6-7v12m9-12v12m-4-4 4 4 4-4" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <text x="86" y="108" fill="white" fontSize="15" fontWeight="700">Markdown</text>
            </g>
            <g transform="rotate(12 165 59)">
              <rect x="123" y="12" width="81" height="102" rx="14" fill="var(--paper)" />
              <rect x="135" y="23" width="40" height="9" rx="4.5" fill="var(--accent)" />
              <path d="M137 42h57m-57 10h49m-49 10h35" fill="none" stroke="var(--line-hover)" strokeWidth="5" strokeLinecap="round" />
            </g>
          </svg>
      </div>
      <div className="settings-tabs" role="tablist" aria-label={t("Settings sections")} onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? "models" : event.key === "End" ? "markdown" : settingsTab === "models" ? "markdown" : "models";
        setSettingsTab(next);
        event.currentTarget.querySelector<HTMLButtonElement>(`#settings-tab-${next}`)?.focus();
      }}>
        <button
          id="settings-tab-models"
          type="button"
          role="tab"
          aria-selected={settingsTab === "models"}
          tabIndex={settingsTab === "models" ? 0 : -1}
          aria-controls="settings-panel-models"
          className={settingsTab === "models" ? "is-active" : ""}
          onClick={() => setSettingsTab("models")}
        >
          <Icon name="settings" /><GuideText text="Model settings" />
        </button>
        <button
          id="settings-tab-markdown"
          type="button"
          role="tab"
          aria-selected={settingsTab === "markdown"}
          tabIndex={settingsTab === "markdown" ? 0 : -1}
          aria-controls="settings-panel-markdown"
          className={settingsTab === "markdown" ? "is-active" : ""}
          onClick={() => setSettingsTab("markdown")}
        >
          <Icon name="folder" /><GuideText text="Markdown files" />
        </button>
      </div>
      <div id="settings-panel-models" role="tabpanel" aria-labelledby="settings-tab-models" hidden={settingsTab !== "models"}>
      {!savedData ? (
        error || models.error
          ? <><State title={t("Model settings are unavailable")} detail={error || models.error} /><button className="secondary" onClick={() => void models.refresh()}>{t("Retry")}</button></>
          : <State title={t("Loading model settings…")} />
      ) : <>
      <Panel title={t("Saved models")}>
        <p className="saved-model-note"><GuideText text="Save model configurations here. Each page remembers its own model choice in this browser. The default is used when a page has no saved choice." /></p>
        {profiles.length === 0
          ? <p className="saved-model-empty">{t("No saved models yet. Add one below.")}</p>
          : <div className="saved-model-grid">
              {profiles.map(profile => {
                const preset = presetOf(profile.provider, profile.baseUrl);
                const isActive = profile.id === savedData.activeProfileId;
                const modelName = profile.models.flash || profile.models.pro;
                return <article key={profile.id} className={`model-card${isActive ? " is-active" : ""}`} data-profile-id={profile.id}>
                  <header className="model-card-head">
                    <span className="model-card-kind">{preset.provider === "ollama" ? <Icon name="home" /> : <Icon name="globe" />}<GuideText text={preset.label} /></span>
                    <h3 className="model-card-title">{profile.name}{isActive && <span className="model-card-default"><GuideText text="Default" /></span>}</h3>
                  </header>
                  <dl className="model-card-facts">
                    <div><dt><GuideText text="Model" /></dt><dd>{modelName}</dd></div>
                    <div><dt>URL</dt><dd>{displayUrl(profile.baseUrl)}</dd></div>
                    <div><dt><GuideText text="API Key" /></dt><dd>{profile.keyMasked || <GuideText text="No API key required" />}</dd></div>
                  </dl>
                  <footer className="model-card-actions">
                    <button type="button" className="secondary" disabled={busy || testing} onClick={() => openEdit(profile)}>{t("Edit")}</button>
                    {profile.id !== "current" && <button type="button" className="secondary model-card-delete" disabled={busy || testing} onClick={() => { setError(""); setStatus(""); setDeleting(profile); }}>{t("Delete")}</button>}
                  </footer>
                </article>;
              })}
            </div>}
      </Panel>

      <Panel title={t("Add a new model")} className="llm-add-panel">
        <form className="model-add-form" onSubmit={(event) => event.preventDefault()}>
          <label className="settings-field" htmlFor="add-model-name"><span className="form-label"><GuideText text="Task / Purpose" /></span>
            <input id="add-model-name" maxLength={80} value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("e.g. Everyday writing")} />
          </label>
          <fieldset className="model-provider-field">
            <legend><GuideText text="Provider" /></legend>
            <div className="model-provider-options">
              {MODEL_PROVIDER_PRESETS.map(preset => (
                <label key={preset.key} className={addForm.preset === preset.key ? "is-selected" : ""}>
                  <input type="radio" name="model-provider" value={preset.key} checked={addForm.preset === preset.key} onChange={() => setAddForm((f) => setPreset(f, preset.key))} />
                  <GuideText text={preset.label} />
                </label>
              ))}
            </div>
            <small><GuideText text="Selecting a provider fills its official base URL." /></small>
          </fieldset>
          <div className="settings-grid">
            <label className="settings-field" htmlFor="add-model-id"><span className="form-label"><GuideText text="Model name / ID" /></span>
              <input id="add-model-id" maxLength={300} value={addForm.model} onChange={(e) => setAddForm((f) => ({ ...f, model: e.target.value }))} placeholder="gpt-4o, deepseek-chat, qwen2.5:14b…" />
              <small><GuideText text="Official model IDs, e.g. gpt-4o or deepseek-chat" /></small>
            </label>
            <label className="settings-field" htmlFor="add-model-base-url"><span className="form-label"><GuideText text="API base URL" /></span>
              <input id="add-model-base-url" type="url" value={addForm.baseUrl} onChange={(e) => setAddForm((f) => ({ ...f, baseUrl: e.target.value }))} placeholder={MODEL_PROVIDER_PRESETS.find(p => p.key === addForm.preset)?.baseUrl || "https://api.example.com/v1"} />
              <small><GuideText text="Optional. Leave empty to use the provider default." /></small>
            </label>
          </div>
          {addForm.preset !== "ollama" ? (
            <label className="settings-field" htmlFor="add-model-key"><span className="form-label"><GuideText text="API Key" /></span>
              <span className="model-key-row">
                <input id="add-model-key" type={addForm.showKey ? "text" : "password"} autoComplete="new-password" value={addForm.apiKey} onChange={(e) => setAddForm((f) => ({ ...f, apiKey: e.target.value }))} placeholder={t("Enter API key")} />
                <button type="button" className="secondary model-key-toggle" aria-label={addForm.showKey ? t("Hide API key") : t("Show API key")} onClick={() => setAddForm((f) => ({ ...f, showKey: !f.showKey }))}><Icon name={addForm.showKey ? "eye-off" : "eye"} /></button>
              </span>
            </label>
          ) : <p className="model-ollama-note"><GuideText text="No API key required" /></p>}
          <label className="settings-check">
            <input id="add-model-default" type="checkbox" checked={addForm.setDefault} onChange={(e) => setAddForm((f) => ({ ...f, setDefault: e.target.checked }))} />
            <span><GuideText text="Set as default model" /></span>
          </label>
          {testStatus && <p role="status" className={testStatus === "Connection successful" ? "llm-test-success" : "llm-test-error"}>{testStatus}</p>}
          {error && <State title={t("Could not save")} detail={error} />}
          <div className="model-add-actions">
            <button type="button" className="secondary" disabled={busy || testing} onClick={resetAdd}>{t("Reset form")}</button>
            <button type="submit" className="primary" aria-busy={busy || testing} disabled={busy || testing || !addForm.name.trim() || !addForm.model.trim()} onClick={() => void testAndAdd()}>
              {busy || testing ? t("Testing…") : <GuideText text="Test & add model" />}
            </button>
          </div>
        </form>
      </Panel>

      {error && <State title={t("Could not save")} detail={error} />}
      {status && (
        <p className="settings-status" role="status">
          {status}
        </p>
      )}

      {editing && (
        <dialog ref={editDialog} className="saved-word-dialog model-edit-dialog" aria-labelledby="model-edit-title" onCancel={(event) => { event.preventDefault(); closeEdit(); }}>
          <div className="saved-word-dialog-header">
            <h2 id="model-edit-title">{t("Edit model configuration")}: {editing.name}</h2>
            <button type="button" className="secondary" onClick={closeEdit}><Icon name="close" />{t("Close")}</button>
          </div>
          <div className="model-dialog-body">
            <label className="settings-field" htmlFor="edit-model-name"><span className="form-label">{t("Task / Purpose")}</span>
              <input id="edit-model-name" maxLength={80} value={editing.name} onChange={(e) => setEditing(d => d && { ...d, name: e.target.value })} />
            </label>
            <div className="settings-grid">
              <label className="settings-field" htmlFor="edit-model-provider"><span className="form-label">{t("Provider")}</span>
                <select id="edit-model-provider" value={editing.preset} onChange={(e) => setEditing(d => d && setPreset(d, e.target.value as ProviderPresetKey))}>
                  {MODEL_PROVIDER_PRESETS.map(preset => <option key={preset.key} value={preset.key}>{t(preset.label)}</option>)}
                </select>
              </label>
              <label className="settings-field" htmlFor="edit-model-id"><span className="form-label">{t("Model name / ID")}</span>
                <input id="edit-model-id" maxLength={300} value={editing.model} onChange={(e) => setEditing(d => d && { ...d, model: e.target.value })} />
              </label>
            </div>
            <label className="settings-field" htmlFor="edit-model-base-url"><span className="form-label">{t("API base URL")}</span>
              <input id="edit-model-base-url" type="url" value={editing.baseUrl} onChange={(e) => setEditing(d => d && { ...d, baseUrl: e.target.value })} />
            </label>
            {editing.preset !== "ollama" && (
              <div className="settings-field">
                <span className="form-label">{t("API Key")}</span>
                <span className="model-key-row">
                  <input id="edit-model-key" type={editing.showKey ? "text" : "password"} autoComplete="new-password" disabled={editing.clearKey} value={editing.apiKey} onChange={(e) => setEditing(d => d && { ...d, apiKey: e.target.value })}
                    placeholder={editing.keyConfigured ? t("Saved key •••• · enter a replacement") : t("Enter API key")} />
                  <button type="button" className="secondary model-key-toggle" aria-label={editing.showKey ? t("Hide API key") : t("Show API key")} onClick={() => setEditing(d => d && { ...d, showKey: !d.showKey })}><Icon name={editing.showKey ? "eye-off" : "eye"} /></button>
                </span>
                {editing.keyConfigured && (
                  <label className="settings-check">
                    <input type="checkbox" checked={editing.clearKey} onChange={(e) => setEditing(d => d && { ...d, clearKey: e.target.checked })} />
                    <span>{t("Remove this provider’s key when saving")}</span>
                  </label>
                )}
              </div>
            )}
            <label className="settings-check">
              <input id="edit-model-default" type="checkbox" checked={editing.setDefault} onChange={(e) => setEditing(d => d && { ...d, setDefault: e.target.checked })} />
              <span>{t("Set as default model")}</span>
            </label>
            {testStatus && <p role="status" className={testStatus === "Connection successful" ? "llm-test-success" : "llm-test-error"}>{testStatus}</p>}
            {error && <State title={t("Could not save")} detail={error} />}
            <div className="model-dialog-actions">
              <button id="edit-model-test" type="button" className="secondary" disabled={busy || testing} onClick={() => editing && void testCurrent(editing)}>{testing ? t("Testing…") : t("Test connection")}</button>
              <button id="edit-model-cancel" type="button" className="secondary" disabled={busy || testing} onClick={closeEdit}>{t("Cancel")}</button>
              <button id="edit-model-save" type="button" className="primary" aria-busy={busy} disabled={busy || testing} onClick={() => editing && void saveModel("update", editing)}>{busy ? t("Saving…") : t("Save changes")}</button>
            </div>
          </div>
        </dialog>
      )}

      {deleting && (
        <dialog ref={deleteDialog} className="handbook-delete-confirm" aria-label={t("Delete model?")} aria-busy={busy} onCancel={(event) => { event.preventDefault(); setDeleting(undefined); }}>
          <strong>{t("Delete this model?")}</strong>
          <span>{t("This removes the saved configuration. If it is the active model, switch to another saved model first.")}</span>
          {error && <span role="alert">{t(error)}</span>}
          <span className="handbook-delete-actions">
            <button type="button" disabled={busy} onClick={() => setDeleting(undefined)}>{t("Cancel")}</button>
            <button type="button" className="handbook-delete-submit" disabled={busy} onClick={() => void removeProfile()}>{busy ? t("Deleting…") : t("Delete")}</button>
          </span>
        </dialog>
      )}
      </>}
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
  const { t } = useGuideCopy();
  const [paths, setPaths] = useState<MarkdownPaths>();
  const [savedPaths, setSavedPaths] = useState<MarkdownPaths>();
  const [operation, setOperation] = useState<"browse" | "save">();
  const busy = operation !== undefined;
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
    setOperation("browse");
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
      setOperation(undefined);
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

    setOperation("save");
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
      setOperation(undefined);
    }
  }

  const folderFields: Array<{ key: keyof MarkdownPaths; label: string; help: string }> = [
    { key: "vaultDir", label: "Obsidian vault folder", help: "Default location for learning notes." },
    { key: "askNotesDir", label: "Ask notes folder", help: "Each saved Ask consultation is written as a Markdown note." },
    { key: "handbookReports", label: "Coach reports folder", help: "Generated Coach reports and historical Markdown reports." },
  ];
  const fileFields: Array<{ key: keyof MarkdownPaths; label: string; help: string }> = [
    { key: "reviewLog", label: "Review log file", help: "Markdown corrections and writing feedback." },
    { key: "vocabularyFile", label: "Vocabulary file", help: "The Markdown source for vocabulary entries." },
    { key: "practiceLog", label: "Practice log file", help: "Saved independent practice records." },
  ];

  if (!paths) {
    return error
      ? <State title={t("Markdown file settings are unavailable")} detail={error} />
      : <State title={t("Loading Markdown file settings…")} />;
  }

  const locationStatus = status || (savedPaths && Object.entries(paths).every(
    ([field, path]) => path.trim() && path === savedPaths[field as keyof MarkdownPaths],
  ) ? "All locations are configured." : "");

  return (
      <Panel title={t("Markdown file locations")} icon="file-tree" className="markdown-settings-panel" detail={t("Choose the local folders and files that ClearWrite uses to read and save your learning records.")}>
        {[{ title: "Folders", kind: "folder" as const, fields: folderFields }, { title: "Files", kind: "file" as const, fields: fileFields }].map(({ title, kind, fields }) => (
          <section className="markdown-path-group" key={kind} aria-labelledby={`markdown-group-${kind}`}>
            <h3 id={`markdown-group-${kind}`}><Icon name={kind === "folder" ? "folder" : "document"} />{t(title)}</h3>
            <div className="markdown-path-grid">
              {fields.map(({ key, label, help }) => (
                <div className="settings-field" key={key}>
                  <div>
                    <label className="form-label" id={`markdown-path-${key}-label`} htmlFor={`markdown-path-${key}`}>{t(label)}</label>
                    <small id={`markdown-path-help-${key}`}>{t(help)}</small>
                  </div>
                  <div className="markdown-path-control">
                    <div className="markdown-path-input">
                      <Icon name={kind === "folder" ? "folder" : "document"} />
                      <input
                        id={`markdown-path-${key}`}
                        type="text"
                        dir="ltr"
                        spellCheck={false}
                        aria-describedby={`markdown-path-help-${key}`}
                        readOnly={busy}
                        value={paths[key]}
                        title={paths[key]}
                        onChange={(event) => { updatePath(key, event.target.value); setStatus(""); setError(""); }}
                      />
                    </div>
                    <button type="button" className="secondary" aria-describedby={`markdown-path-${key}-label`} disabled={busy} onClick={() => choosePath(key, kind)}>
                      <Icon name="folder-open" />{t("Browse…")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        <footer className="markdown-settings-footer">
          {error && <div className="markdown-settings-error" role="alert"><State title={t(errorTitle)} detail={t(error)} /></div>}
          <div className="llm-form-actions">
            <button className="primary" aria-busy={operation === "save"} disabled={busy} onClick={savePaths}>{t(operation === "save" ? "Saving…" : "Save file locations")}</button>
            <button className="secondary" disabled={busy} onClick={() => {
              setPaths(savedPaths);
              setError("");
              setStatus("");
            }}>{t("Reset")}</button>
          </div>
          <div className="markdown-settings-status" role="status">
            {!error && locationStatus && (
              <span><Icon name="check" />{t(locationStatus)}</span>
            )}
          </div>
        </footer>
      </Panel>
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
      <IconButton
        icon="volume"
        quiet={small}
        pending={busy}
        caption={reviewPrompt ? (busy ? "Playing…" : "Audio hint") : undefined}
        className={`audio-btn${small ? " audio-btn-sm" : ""}${error ? " audio-err" : ""}`}
        onClick={play}
        label={
          busy ? "Playing…" : reviewPrompt ? "Listen to the English word" : `Read aloud: ${text}`
        }
        title={busy ? "Playing…" : error || "Read aloud"}
      />
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
      <IconButton
        icon={state === "copied" ? "check" : "copy"}
        quiet={small}
        className={`copy-btn${small ? " copy-btn-sm" : ""}${state === "copied" ? " is-copied" : ""}${state === "failed" ? " is-failed" : ""}`}
        onClick={() => void copy()}
        label={state === "copied" ? `Copied ${label}` : `Copy ${label}`}
        title={
          state === "copied"
            ? "Copied"
            : state === "failed"
              ? "Copying failed — your browser blocked clipboard access"
              : `Copy ${label}`
        }
      />
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

const primaryRoutes: Route[] = ["word-lookup", "practice", "ask"];
const learningRoutes = [
  ["dashboard", "Overview", "dashboard"],
  ["word-library", "Saved words", "bookmark"],
  ["ask", "Saved notes", "document"],
  ["handbook", "Handbook", "handbook"],
  ["coach", "Learning reports", "trend"],
] as const;
const navigationGroups: Array<{ label: string; routes: Array<[Route, string]> }> = [
  {
    label: "Writing",
    routes: [
      ["grammar", "Grammar"],
      ["translation", "Express"],
    ],
  },
];
function currentRoute(): Route {
  const hash = location.hash.slice(1).split("?")[0];
  return hash === "dashboard" || items.some(([key]) => key === hash) ? (hash as Route) : "grammar";
}
export function App() {
  const { t } = useGuideCopy();
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
  const askView = new URLSearchParams(routeHash.split("?")[1]).get("view") === "notes" ? "notes" : "ask";
  const practiceLogView = route === "dashboard" && new URLSearchParams(routeHash.split("?")[1]).get("view") === "practice-log";
  const hasScrollNavigation = route === "word-library" || route === "coach" || route === "handbook" || (route === "ask" && askView === "notes");
  const title =
    practiceLogView ? "Practice log" : route === "ask" && askView === "notes" ? "Saved notes" : route === "dashboard" ? "Overview" : items.find(([key]) => key === route)?.[1] || "Grammar";
  useEffect(() => {
    document.title = title + " · ClearWrite";
  }, [title]);
  const askVisited = useRef(route === "ask");
  if (route === "ask") askVisited.current = true;
  const pages: Record<Route, React.ReactNode> = {
    grammar: <Grammar />,
    dashboard: practiceLogView ? <PracticeLog /> : <Dashboard />,
    translation: <Express />,
    ask: null,
    "word-review": <WordReview />,
    "word-library": <VocabularyLibrary renderDetails={entry => <WordDetails entry={entry} examples={[entry.example, entry.example2, entry.example3].filter(Boolean)} />} />,
    "word-lookup": <WordLookup />,
    coach: <Coach />,
    practice: <Practice key={routeHash} />,
    handbook: <Handbook />,
    settings: <LlmSettings />,
  };
  return (
    <div className={`shell${route === "grammar" ? " writing-shell" : ""}${hasScrollNavigation ? " has-scroll-navigation" : ""}`}>
      <a className="skip-link" href="#main-content">
        {t("Skip to content")}
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
        <a className="brand" href="#grammar" aria-label={t("ClearWrite home")}>
          <span className="brand-mark">
            <Icon name="wand" />
          </span>
          <span className="brand-wordmark">ClearWrite</span>
        </a>
        <button
          ref={menuRef}
          className="menu-toggle"
          aria-label={menuOpen ? t("Close navigation") : t("Open navigation")}
          aria-expanded={menuOpen}
          aria-controls="workspace-nav"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name={menuOpen ? "close" : "menu"} />
          <GuideText text="Menu" />
        </button>
        <nav
          ref={navRef}
          id="workspace-nav"
          aria-label={t("Main navigation")}
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
          <div className="nav-primary">
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
          {primaryRoutes.map((key) => (
              <a
                href={"#" + key}
                key={key}
                className={route === key && !(key === "ask" && askView === "notes") ? "nav-link active" : "nav-link"}
                aria-current={route === key && !(key === "ask" && askView === "notes") ? "page" : undefined}
              >
                {items.find(([itemKey]) => itemKey === key)?.[1]}
              </a>
            ))}
          <details className="learning-menu my-learning-menu" name="workspace-navigation">
            <summary className={route === "word-review" || learningRoutes.some(([key]) => key === route && (key !== "ask" || askView === "notes")) ? "active" : ""}>
              My learning
              <Icon name="chevron" />
            </summary>
            <div className="learning-links">
              {learningRoutes.map(([key, label, icon]) => (
                <a key={key} href={key === "ask" ? "#ask?view=notes" : "#" + key} aria-current={route === key && (key !== "ask" || askView === "notes") ? "page" : undefined}>
                  <Icon name={icon} />
                  {label}
                </a>
              ))}
            </div>
          </details>
          </div>
          <a
            className="settings-link"
            href="#settings"
            aria-label={t("Model settings")}
            aria-current={route === "settings" ? "page" : undefined}
          >
            <Icon name="settings" />
            <span>Settings</span>
          </a>
          <LearnerLanguageSwitch />
        </nav>
      </header>
      <main
        ref={mainRef}
        id="main-content"
        tabIndex={-1}
        className={`workspace workspace-${route}${route === "grammar" ? " grammar-workspace" : ""}`}
      >
        {pages[route]}
        <div hidden={route !== "ask"}>{askVisited.current && <Ask active={route === "ask"} view={askView} />}</div>
      </main>
      {hasScrollNavigation && <PageScrollControls key={`scroll-${routeHash}`} />}
      <SelectionLookup key={routeHash} renderLookup={(text) => <WordLookup initialQuery={text} compact />} />
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
