import { useRef, useState } from "react";
import { useGuideCopy, GuideText } from "../components/learner-language";
import { Icon } from "../components/Icon";
import { State } from "../components/Page";
import { ModelSwitcher } from "../components/model-settings";
import { CorrectionText } from "../components/CorrectionText";
import { DetailSection } from "../components/DetailSection";
import { CopyButton } from "../components/CopyButton";
import { webApi } from "../api/client";
import { GrammarFollowUp } from "./GrammarFollowUp";
import { androidApp } from "./AndroidWorkspace";
import "./Writing.css";

export function Grammar() {
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
      {androidApp ? <h1 className="android-page-title">{t("Refine check")}</h1> : <div className="grammar-intro">
        <span className="writing-badge"><Icon name="spark" /><GuideText text="AI-Powered Writing Enhancer" /></span>
        <h1>
          Write with clarity<span className="accent-dot">.</span>
        </h1>
        <p><GuideText text="Refine your tone, catch subtle grammar nuances, and learn standard phrasing with contextual feedback." /></p>
      </div>}
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
