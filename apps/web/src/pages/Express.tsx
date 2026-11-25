import { useState } from "react";
import { useGuideCopy, GuideText } from "../components/learner-language";
import { Heading, Panel, State } from "../components/Page";
import { ModelSwitcher } from "../components/model-settings";
import { DetailSection } from "../components/DetailSection";
import { webApi } from "../api/client";
import { androidApp } from "./AndroidWorkspace";
import "./Writing.css";

export function Express() {
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
      {androidApp ? <h1 className="android-page-title">{t("Express")}</h1> : <Heading
        eyebrow="EXPRESS"
        title="Find the right words."
        detail={<GuideText text="Explore an English version of your Chinese text, or check what an English passage means in Chinese. Compare the wording, then try expressing the idea yourself." />}
      />}
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
