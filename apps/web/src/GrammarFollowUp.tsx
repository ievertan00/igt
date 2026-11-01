import { useEffect, useRef, useState } from "react";
import { webApi } from "./api/client";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { useGuideCopy, type LearnerLanguage } from "./learner-language";
import "./GrammarFollowUp.css";

type Turn = { question: string; answer: string; title?: string; tags?: string[]; category?: string };
type SaveState = { status: "saving" | "saved" | "error"; message: string };

export function GrammarFollowUp({ context }: { context: string }) {
  const { language, t } = useGuideCopy();
  const [answerOverride, setAnswerOverride] = useState<LearnerLanguage>();
  const answerLanguage = answerOverride ?? language;
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saves, setSaves] = useState<Record<number, SaveState>>({});
  const sending = useRef(false);
  const saving = useRef(new Set<number>());
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!question.trim() && !busy && turns.every((_, index) => saves[index]?.status === "saved")) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [question, busy, turns, saves]);

  async function send() {
    const submitted = question.trim();
    if (!submitted || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      // Keep the grammar snapshot even when Ask truncates long histories to 12 turns.
      const history = [{ question: "Grammar check context", answer: context }, ...turns.slice(-11)];
      const response = await webApi.ask(submitted, history, answerLanguage);
      const data = response.data;
      const answer = typeof data === "string" ? data : data?.answer;
      if (typeof answer !== "string" || !answer.trim()) throw new Error(t("The response was empty. Please try again."));
      setTurns(old => [...old, { question: submitted, answer, title: data?.title,
        tags: data?.tags, category: data?.category }]);
      setQuestion("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      sending.current = false;
      setBusy(false);
      input.current?.focus({ preventScroll: true });
    }
  }

  async function save(index: number) {
    if (saving.current.has(index) || saves[index]?.status === "saved") return;
    saving.current.add(index);
    setSaves(old => ({ ...old, [index]: { status: "saving", message: "" } }));
    // Ask notes persist the answer body, so include the source and question there.
    const previous = turns.slice(0, index).map(turn => `Question: ${turn.question}\nAnswer: ${turn.answer}`).join("\n\n");
    const turn = turns[index];
    const note = { ...turn, answer: `## Grammar check\n\n${context}${previous ? `\n\n## Previous discussion\n\n${previous}` : ""}\n\n## Follow-up question\n\n${turn.question}\n\n## Answer\n\n${turn.answer}` };
    try {
      const response = await webApi.saveAsk([note]);
      if (!response.saved) throw new Error(t("There is no answer to save."));
      setSaves(old => ({ ...old, [index]: { status: "saved", message: t("Saved as an Ask note.") } }));
      window.dispatchEvent(new Event("ask-notes-changed"));
    } catch (err: any) {
      const uncertain = ["NETWORK_ERROR", "REQUEST_TIMEOUT", "REQUEST_ABORTED"].includes(err.code);
      setSaves(old => ({ ...old, [index]: { status: "error", message: uncertain
        ? t("Save not confirmed. Retry safely; an already saved conversation will be reused.")
        : `${t("Could not save. Try again.")} ${err.message}` } }));
    } finally {
      saving.current.delete(index);
    }
  }

  return <section className="grammar-follow-up" aria-labelledby="grammar-follow-up-title">
    <header className="grammar-follow-up-header">
      <span className="follow-up-mark"><Icon name="ask" /></span>
      <div className="follow-up-heading"><h2 id="grammar-follow-up-title">{t("Ask about this feedback")} <span className="assistant-badge">{t("AI Assistant")}</span></h2>
        <p>{t("Ask why, compare alternatives, or request extra examples.")}</p></div>
      <div className="grammar-follow-up-controls"><label>{t("Answer language")}<select aria-label={t("Answer language")} value={answerLanguage} disabled={busy} onChange={event => setAnswerOverride(event.target.value as LearnerLanguage)}>
        <option value="zh-CN">中文解释</option><option value="en">English</option>
      </select></label></div>
    </header>
    <div className="follow-up-suggestions"><h3>{t("Suggested follow-ups")}</h3><div>
      {["Why use this verb form?", "Is this formal enough for documentation?", "Give 3 alternative variations", "Explain the grammar changes here"].map(prompt => <button key={prompt} type="button" disabled={busy} onClick={() => { setQuestion(t(prompt)); input.current?.focus(); }}>{t(prompt)}<Icon name="arrow" /></button>)}
    </div></div>
    <div className="follow-up-messages" aria-live="polite">
    {!turns.length && <div className="follow-up-welcome"><span><Icon name="spark" /></span><p>{t("Hello! I'm your ClearWrite Assistant. Have questions about these suggestions or want alternative phrasing options?")}</p></div>}
    {turns.map((turn, index) => <article className="grammar-follow-up-turn" key={index} aria-label={`${t("Follow-up question")} ${index + 1}`}>
      <h3>{turn.question}</h3>
      <Markdown source={turn.answer} />
      <div className="grammar-follow-up-save">
        <button className="secondary" type="button" onClick={() => void save(index)} aria-busy={saves[index]?.status === "saving"}
          disabled={saves[index]?.status === "saving" || saves[index]?.status === "saved"}>
          <Icon name={saves[index]?.status === "saved" ? "check" : "bookmark"} />
          {saves[index]?.status === "saving" ? t("Saving…") : saves[index]?.status === "saved" ? t("Saved to notes") : t("Save as Ask note")}
        </button>
        {saves[index]?.message && <p role="status" className={saves[index].status === "error" ? "grammar-follow-up-error" : "status"}>{saves[index].message}</p>}
      </div>
    </article>)}
    </div>
    <form className="grammar-follow-up-composer" onSubmit={event => { event.preventDefault(); void send(); }} aria-busy={busy}>
      <label className="sr-only" htmlFor="grammar-follow-up-input">{t("Follow-up question")}</label>
      <div className="follow-up-input-row"><textarea ref={input} id="grammar-follow-up-input" value={question} readOnly={busy} rows={2}
        placeholder={t("For example: Why use this verb form?")} onChange={event => setQuestion(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
            event.preventDefault(); void send();
          }
        }} />
        <button className="primary" type="submit" disabled={busy || !question.trim()} aria-busy={busy}>
          {busy ? t("Thinking…") : t("Ask AI")}{busy ? <span className="loading-spinner" /> : <Icon name="arrow" />}
        </button>
      </div>
      {error && <p role="alert" className="grammar-follow-up-error">{t("Could not answer. Your question is kept; try again.")} {error}</p>}
      <div className="follow-up-composer-footer"><p>{t("AI explanations may need checking. Save useful answers to revisit them.")}</p><span>{t("Ctrl / ⌘ + Enter to send")}</span></div>
    </form>
  </section>;
}
