import { useEffect, useRef, useState } from "react";
import { androidApp } from "./AndroidWorkspace";
import { webApi } from "../api/client";
import { Icon } from "../components/Icon";
import { GuideText, useGuideCopy } from "../components/learner-language";
import { ModelSwitcher } from "../components/model-settings";
import { Heading, Panel, State } from "../components/Page";

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

export function Practice() {
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
      {androidApp ? <h1 className="android-page-title">{t("Sentence translation")}</h1> : <Heading
        eyebrow="PRACTICE"
        title="Put your English to work."
        detail={<GuideText text="Try translating a Chinese sentence into English before checking the AI feedback. Use the suggestions to revise your answer and try a new sentence of your own." />}
      />}
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
