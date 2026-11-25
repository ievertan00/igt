import { useEffect, useRef, useState } from "react";
import { useGuideCopy, GuideText } from "../components/learner-language";
import { Icon } from "../components/Icon";
import { Heading, Panel } from "../components/Page";
import { ModelSwitcher } from "../components/model-settings";
import { WordDetails } from "../components/WordDetails";
import { webApi } from "../api/client";
import { androidApp } from "./AndroidWorkspace";

export function WordLookup({ initialQuery = "", compact = false }: { initialQuery?: string; compact?: boolean }) {
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
  const learningActions = !compact && !androidApp && (
    <div className="lookup-learning-actions">
      <a className="secondary" href="#word-library"><Icon name="word-library" />Saved words</a>
      <a className="secondary" href="#word-review"><Icon name="word-review" /><GuideText text="Review due words" /></a>
    </div>
  );
  return (
    <div className={compactResult ? "word-page word-lookup-page" : "word-page"}>
      {!compact && androidApp ? <h1 className="android-page-title">{t("Word lookup")}</h1> : compactResult ? <header className="lookup-header">
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
            <ModelSwitcher page="word-lookup" disabled={busy || saving} id={compact ? "selection-model" : "workspace-model"} />
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
