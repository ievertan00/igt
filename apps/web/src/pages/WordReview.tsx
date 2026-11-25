import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useGuideCopy } from "../components/learner-language";
import { Icon } from "../components/Icon";
import { Heading, Panel, State } from "../components/Page";
import { AudioButton } from "../components/AudioButton";
import { CopyButton } from "../components/CopyButton";
import { useDailyReviewSession } from "../lib/review-session";
import { reviewExampleParts } from "../lib/review-example";

export function WordReview() {
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
  const [showIPA, setShowIPA] = useState(false);
  const [showDeleteHint, setShowDeleteHint] = useState(false);
  const [ratingHint, setRatingHint] = useState<string | null>(null);
  const [focusMethod, setFocusMethod] = useState<"pointer" | "keyboard">("pointer");
  const composing = useRef(false);
  const answerRef = useRef<HTMLInputElement>(null);
  const ratingRef = useRef<HTMLFieldSetElement>(null);
  const card = cards[index];
  useLayoutEffect(() => {
    setAnswer("");
    setShowIPA(false);
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
  const feedbackState = result?.correct ? "correct" : submittedAnswer?.trim() ? "incorrect" : "revealed";
  const feedbackLabel = feedbackState === "correct" ? "Correct!" : feedbackState === "incorrect" ? "Not quite" : "Answer revealed";
  const exploreExamples = examples.filter(Boolean);
  const hasMoreDetails = Boolean(
    exploreExamples.length > 0 || details?.synonyms || details?.collocations || details?.note || card?.note,
  );
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (composing.current || grading || starting || revealed) return;
    void submit(answer);
  }
  function handleResultKeyDown(event: KeyboardEvent<HTMLDivElement>) {
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
              {/* The IPA is a hint, not a clue: it stays concealed until the learner asks for it. */}
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
                  {pronunciation && (
                    <div className="review-ipa-slot">
                      {!showIPA ? (
                        <button
                          type="button"
                          className="review-hint-button"
                          disabled={grading || starting}
                          onClick={() => setShowIPA(true)}
                        >
                          <Icon name="idea" />
                          {t("Show the IPA")}
                        </button>
                      ) : (
                        <span className="review-ipa-hint" role="status" lang="en">
                          <span className="sr-only">IPA: </span>{pronunciation}
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
                    {(details?.verbForms || details?.plural || details?.comparative) && (
                      <dl className="review-word-forms">
                        {[[t("Verb forms"), details?.verbForms], [t("Plural"), details?.plural], [t("Comparative"), details?.comparative]]
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
