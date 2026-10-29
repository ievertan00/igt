import { useGuideCopy } from "./learner-language";
import { useEffect, useRef, useState } from "react";
import { webApi } from "./api/client";
import { Markdown } from "./Markdown";

type Evidence = { count: number; entries: number; days: number; latest: string | null; ruleExamples: number };

export function HandbookKnowledge({ errorType, days, version, evidence, disabled, practice, practiceHref }: {
  errorType: string; days: number; version: string; evidence: Evidence; disabled: boolean;
  practice?: { status: string; total: number; evidence?: { attempts: number; withoutHints: number; latestScore: number | null } };
  practiceHref?: string;
}) {
  const { t } = useGuideCopy();
  const [result, setResult] = useState<Awaited<ReturnType<typeof webApi.explainHandbookRule>>>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current++; }, []);
  async function explain() {
    if (busy) return;
    const id = ++sequence.current;
    setBusy(true);
    setError("");
    try {
      const value = await webApi.explainHandbookRule(errorType, days, version);
      if (id === sequence.current) setResult(value);
    } catch (cause: any) {
      if (id === sequence.current) setError(cause?.code === "HANDBOOK_CHANGED"
        ? t("Your examples have changed. Refresh the handbook before trying again.")
        : t("The explanation could not be loaded. Your examples are still available. Please try again."));
    } finally {
      if (id === sequence.current) setBusy(false);
    }
  }
  return <section className="handbook-knowledge" aria-label="Category evidence and explanation">
    <h2>About this pattern</h2>
    <p className="handbook-evidence">{evidence.count} observations · {evidence.entries} saved entries · {evidence.days} dates
      {evidence.latest && Number.isFinite(Date.parse(evidence.latest)) && <> · Last observed <time dateTime={evidence.latest}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(evidence.latest))}</time></>}
    </p>
    <div className="handbook-practice">
      {practiceHref ? <><a className="secondary" href={practiceHref}>Practice this pattern</a><p>{t("{count} related questions available. Choose your session before starting.", { count: practice?.total ?? 0 })}</p></>
        : <p>{practice?.status === "unavailable" ? t("Related practice is temporarily unavailable. Refresh to try again.") : t("No related practice questions are available for this category yet. Your examples remain available below.")}</p>}
      {practice?.evidence && <p className="handbook-evidence">{practice.evidence.attempts} linked practice attempts · {practice.evidence.withoutHints} without hints.
        {practice.evidence.latestScore !== null && <> Latest overall translation score: {practice.evidence.latestScore}/100.</>}
        {" "}{t("An overall score does not establish control of this specific pattern.")}</p>}
    </div>
    <p className="handbook-evidence">{t("Based on all {history} for this category, including examples outside your search. These observations do not establish mastery.", { history: days === 0 ? t("saved history") : t("records in the last {days} days", { days }) })} <a href="#coach">Explore next steps in Coach</a>.</p>
    {result ? <div className="handbook-rule">
      <h3>Personalized explanation</h3>
      <p className="handbook-evidence">{t("AI-generated from {count} recent examples. Check the explanation against your sentences.", { count: result.exampleCount })}
        {result.rule.generatedAt && Number.isFinite(Date.parse(result.rule.generatedAt)) && <> Created <time dateTime={result.rule.generatedAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(result.rule.generatedAt))}</time>.</>}
      </p>
      <Markdown source={result.rule.content} />
    </div> : <>
      <p>{t("Get a rule explanation based on up to {count} recent examples from this category. Matching saved explanations are reused.", { count: evidence.ruleExamples })}</p>
      <button className="secondary" aria-busy={busy} onClick={explain} disabled={disabled || busy}>{busy ? t("Preparing explanation…") : error ? t("Try explanation again") : t("Explain this pattern")}</button>
      {busy && <p role="status">{t("Your examples are ready to read while the explanation is prepared. You can switch categories.")}</p>}
      {error && <p role="alert">{error}</p>}
    </>}
  </section>;
}
