import React, { useState } from "react";
import { api, type PracticeQuestion } from "../api";
import { errorMessage, go, native, useApp, useDraft } from "../core";
import { Badge, Button, Card, Chip, Empty, ErrorNote, Icon, Ring, SectionTitle, Sheet, TextArea } from "../ui";

type Evaluation = {
  score: number; verdict: string; corrected_answer: string; feedback_zh: string;
  strengths_zh: string[]; improvements_zh: string[]; reference_answer: string;
};

const CONTEXTS = ["all", "home", "dining", "shopping", "entertainment", "social", "health", "work", "transit", "travel", "services"];
const VERDICT_TONE: Record<string, string> = { excellent: "success", good: "success", needs_work: "warning", incorrect: "danger" };

export function PracticeScreen() {
  const { route, t, lang, toast } = useApp();
  const targetErrorType = route.params.get("targetErrorType") || "";
  const [difficulty, setDifficulty] = useState("standard");
  const [style, setStyle] = useState("all");
  const [context, setContext] = useState("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [question, setQuestion] = useState<PracticeQuestion | null>(null);
  const [answer, setAnswer, clearAnswer] = useDraft("practice.answer");
  const [hintsUsed, setHintsUsed] = useState(0);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [warning, setWarning] = useState("");
  const [busy, setBusy] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState("");
  const [answered, setAnswered] = useState(0);

  async function start() {
    setBusy(true); setError(""); setEvaluation(null); setQuestion(null);
    try {
      const response = await api.generatePractice({ count: 1, difficulty, style, context, targetErrorType });
      const next = response?.data?.questions?.[0];
      if (!next) throw new Error(t("题库暂时没有可用题目", "No practice question is available right now"));
      setQuestion(next);
      setAnswer(""); clearAnswer();
      setHintsUsed(0);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!question || !answer.trim()) { toast(t("先写出你的翻译", "Write your translation first"), "err"); return; }
    setGrading(true); setError("");
    try {
      const response = await api.evaluatePractice(question, answer.trim(), hintsUsed);
      setEvaluation(response?.data || null);
      setWarning(response?.persistence?.saved === false ? response?.persistence?.warning || "" : "");
      setAnswered((value) => value + 1);
      setSettingsOpen(false);
      native.haptic("ok");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setGrading(false); }
  }

  const hintKeys = ["simple", "intermediate", "complete"] as const;
  const hints = (question?.hints || {}) as Record<string, string>;
  const visibleHints = hintKeys.slice(0, hintsUsed).map((key) => hints[key]).filter(Boolean);
  const hasMoreHints = hintsUsed < 3 && hintKeys.some((key, index) => index >= hintsUsed && hints[key]);

  return <div className="stack">
    <Card className="card--tint">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <p className="card-kicker" style={{ margin: 0 }}>{t("中译英 · 单句练习", "SENTENCE TRANSLATION")}</p>
          <p style={{ margin: "4px 0 0", fontSize: 13.5 }}>
            {t("已答", "Answered")} {answered} · {difficulty} · {context === "all" ? t("全部场景", "all contexts") : context}
          </p>
        </div>
        <Button variant="secondary" icon="filter" onClick={() => setSettingsOpen(true)}>{t("设置", "Setup")}</Button>
      </div>
      {targetErrorType && <div style={{ marginTop: 10 }}><Badge tone="accent">{t("针对", "Focus")} · {targetErrorType}</Badge></div>}
    </Card>

    {!question && !busy && <Card className="card--hero">
      <p className="card-kicker">{t("一次只练一句", "ONE SENTENCE AT A TIME")}</p>
      <h3 style={{ fontSize: 20, margin: "4px 0 6px" }}>{t("看中文，写英文", "Read Chinese, write English")}</h3>
      <p className="card-note">{t("按需取提示，提交后由模型给出评分与更自然的表达。",
        "Reveal hints only when you need them, then get a score and a natural alternative.")}</p>
      <div style={{ marginTop: 16 }}><Button variant="secondary" icon="play" onClick={start} block>
        {t("出一道题", "Start practice")}
      </Button></div>
    </Card>}

    {busy && <Card><p style={{ margin: 0 }}>{t("正在从题库取题…", "Preparing a question…")}</p></Card>}
    {error && <ErrorNote message={error} onRetry={question ? submit : start} retryLabel={t("重试", "Retry")} />}
    {warning && <div className="stale-note"><Icon name="info" size={16} />{warning}</div>}

    {question && <>
      <Card className="focus-card" style={{ minHeight: 120 }}>
        <p className="card-kicker">{t("请把这句话译成英文", "TRANSLATE INTO ENGLISH")}</p>
        <div className="prompt">{question.prompt_zh}</div>
        {question.focus && <div className="hint">{t("语法焦点", "Focus")} · {question.focus}</div>}
      </Card>

      {visibleHints.length > 0 && <Card className="card--accent">
        <p className="card-kicker">{t("已使用的提示", "HINTS USED")}</p>
        {visibleHints.map((hint, index) => <p key={index} style={{ margin: "4px 0", fontSize: 14 }}>{hint}</p>)}
      </Card>}

      <Card>
        <TextArea value={answer} onChange={setAnswer} rows={4} disabled={Boolean(evaluation)}
          placeholder={t("写下你的英文句子…", "Write your English sentence…")} />
        <div className="field-counter"><span>{t("提示会记入本次练习", "Hints are recorded with this attempt")}</span><span>{hintsUsed} / 3</span></div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Button variant="soft" icon="bulb" onClick={() => setHintsUsed((value) => Math.min(3, value + 1))}
            disabled={!hasMoreHints || Boolean(evaluation)}>{t("给个提示", "Hint")}</Button>
          <Button icon="check" onClick={submit} loading={grading} disabled={Boolean(evaluation)}>
            {t("提交", "Check")}
          </Button>
        </div>
      </Card>

      {evaluation && <>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Ring value={evaluation.score || 0} size={92} label={`${Math.round(evaluation.score || 0)}`} sub={t("分", "pts")} />
            <div style={{ flex: 1 }}>
              <Badge tone={VERDICT_TONE[evaluation.verdict] || "neutral"}>{evaluation.verdict || "—"}</Badge>
              <p style={{ margin: "8px 0 0", fontSize: 14 }}>{evaluation.feedback_zh}</p>
            </div>
          </div>
        </Card>

        <Card>
          <p className="card-kicker">{t("参考译文", "REFERENCE")}</p>
          <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 650 }}>{evaluation.reference_answer || evaluation.corrected_answer}</p>
          {evaluation.corrected_answer && evaluation.corrected_answer !== evaluation.reference_answer &&
            <><div className="divider" /><p className="card-kicker">{t("你的句子可以改成", "YOUR VERSION REFINED")}</p>
              <p style={{ margin: 0, fontSize: 15 }}>{evaluation.corrected_answer}</p></>}
        </Card>

        {(evaluation.strengths_zh?.length > 0 || evaluation.improvements_zh?.length > 0) && <Card>
          {evaluation.strengths_zh?.length > 0 && <>
            <p className="card-kicker">{t("做得好的地方", "WHAT WORKED")}</p>
            {evaluation.strengths_zh.map((item, index) => <div key={index} className="kv"><strong>✓</strong><span>{item}</span></div>)}
          </>}
          {evaluation.improvements_zh?.length > 0 && <>
            <p className="card-kicker" style={{ marginTop: 14 }}>{t("可以改进", "TO IMPROVE")}</p>
            {evaluation.improvements_zh.map((item, index) => <div key={index} className="kv"><strong>→</strong><span>{item}</span></div>)}
          </>}
        </Card>}

        <div style={{ display: "flex", gap: 8 }}>
          <Button icon="refresh" onClick={start} block>{t("下一题", "Next question")}</Button>
          <Button variant="secondary" icon="chart" onClick={() => go("/me/overview")}>{t("看记录", "Records")}</Button>
        </div>
      </>}
    </>}

    {!question && !busy && <SectionTitle title={t("说明", "About")} />}
    {!question && !busy && <Card className="card--tint">
      <p style={{ margin: 0, fontSize: 13 }}>{lang === "zh"
        ? "一次答对只是当次表现，系统会把它记入练习日志，不会自动判定为长期掌握。"
        : "One correct attempt is a single observation. It is recorded in the practice log, not treated as durable mastery."}</p>
    </Card>}

    <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title={t("练习设置", "Practice setup")}
      footer={<Button onClick={() => setSettingsOpen(false)} block>{t("保存设置", "Save setup")}</Button>}>
      <p className="eyebrow">{t("难度", "DIFFICULTY")}</p>
      <div className="chip-row" style={{ flexWrap: "wrap", marginBottom: 16 }}>
        {[["easy", t("简单", "Easy")], ["standard", t("标准", "Standard")], ["challenge", t("挑战", "Challenge")]].map(([value, label]) =>
          <Chip key={value} selected={difficulty === value} onClick={() => setDifficulty(value)}>{label}</Chip>)}
      </div>
      <p className="eyebrow">{t("语体", "STYLE")}</p>
      <div className="chip-row" style={{ flexWrap: "wrap", marginBottom: 16 }}>
        {[["all", t("全部", "All")], ["casual", t("口语", "Casual")], ["neutral", t("中性", "Neutral")], ["formal", t("正式", "Formal")]].map(([value, label]) =>
          <Chip key={value} selected={style === value} onClick={() => setStyle(value)}>{label}</Chip>)}
      </div>
      <p className="eyebrow">{t("场景", "CONTEXT")}</p>
      <div className="chip-row" style={{ flexWrap: "wrap" }}>
        {CONTEXTS.map((value) => <Chip key={value} selected={context === value} onClick={() => setContext(value)}>
          {value === "all" ? t("全部场景", "All contexts") : value}
        </Chip>)}
      </div>
    </Sheet>
    <div className="hero-space" />
  </div>;
}
