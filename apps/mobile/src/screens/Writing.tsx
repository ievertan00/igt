import React, { useMemo, useState } from "react";
import { api } from "../api";
import { errorMessage, go, native, store, useApp, useDraft } from "../core";
import { Badge, Button, Card, Chip, ErrorNote, Icon, IconButton, Segmented, TextArea } from "../ui";

type Mode = "refine" | "express";
type Direction = "zh2en" | "en2zh";
type Result = { source: string; response: any };

export function WritingScreen() {
  const { route, t, lang, toast } = useApp();
  const [mode, setMode] = useState<Mode>(() => route.params.get("mode") === "express" ? "express" : "refine");
  const [direction, setDirection] = useState<Direction>("zh2en");
  const [refineText, setRefineText, clearRefine] = useDraft("write");
  const [expressText, setExpressText, clearExpress] = useDraft("express");
  const [results, setResults] = useState<Record<Mode, Result | null>>({ refine: null, express: null });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const text = mode === "refine" ? refineText : expressText;
  const setText = mode === "refine" ? setRefineText : setExpressText;
  const clearText = mode === "refine" ? clearRefine : clearExpress;
  const result = results[mode];
  const data = useMemo(() => result?.response?.result || result?.response?.data || null, [result]);

  async function submit() {
    const value = text.trim();
    if (!value) { toast(t("先写点什么吧", "Write something first"), "err"); return; }
    setBusy(true); setError("");
    try {
      const response = mode === "refine"
        ? await api.checkGrammar(value)
        : await api.translate(value, direction);
      setResults((previous) => ({ ...previous, [mode]: { source: value, response } }));
      setSaved(false);
      native.haptic("ok");
    } catch (reason) {
      setError(errorMessage(reason));
      native.haptic("err");
    } finally { setBusy(false); }
  }

  async function save() {
    if (!result || !data || mode !== "refine") return;
    setSaving(true);
    try {
      const response = await api.saveGrammar(result.source, data);
      if (response?.persistence?.saved === false) throw new Error(t("未能保存记录", "Record was not saved"));
      setSaved(true);
      toast(t("已保存到学习记录", "Saved to your learning records"));
      native.haptic("ok");
    } catch (reason) { toast(errorMessage(reason), "err"); }
    finally { setSaving(false); }
  }

  async function paste() {
    const value = await native.paste();
    if (!value) { toast(t("剪贴板是空的", "Clipboard is empty"), "err"); return; }
    setText((text ? text + "\n" : "") + value.trim());
  }

  async function copy(value: string) {
    await native.copy(value);
    toast(t("已复制", "Copied"));
  }

  async function speak(value: string) {
    const ok = await native.speak(value);
    if (!ok) toast(t("语音服务不可用", "Speech is unavailable"), "err");
  }

  function followUp(question: string) {
    store.write("draft.ask", question);
    go("/ask");
  }

  return <div className="stack">
    <Segmented<Mode> value={mode} onChange={(value) => { setMode(value); setError(""); }}
      items={[
        { value: "refine", label: t("语法检查", "Refine") },
        { value: "express", label: t("表达转换", "Express") },
      ]} />

    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p className="card-kicker" style={{ margin: 0 }}>
          {mode === "refine" ? t("写一句英文", "YOUR SENTENCE") : t("输入想法或段落", "YOUR TEXT")}
        </p>
        <div style={{ display: "flex", gap: 2 }}>
          <IconButton name="clipboard" label={t("粘贴", "Paste")} onClick={paste} size={19} />
          <IconButton name="share" label={t("分享", "Share")} onClick={() => native.share(text)} size={19} />
          <IconButton name="trash" label={t("清空", "Clear")} onClick={clearText} size={19} />
        </div>
      </div>
      <TextArea value={text} onChange={setText} rows={6}
        placeholder={mode === "refine"
          ? t("例如：She go to work by train every day.", "e.g. She go to work by train every day.")
          : t("例如：我想约他明天下午讨论一下方案。", "e.g. 我想约他明天下午讨论一下方案。")} />
      <div className="field-counter"><span>{t("内容会自动保存在本机草稿", "Draft is saved on this device")}</span><span>{text.length}</span></div>
      {mode === "express" && <div className="chip-row" style={{ marginTop: 10 }}>
        <Chip selected={direction === "zh2en"} onClick={() => setDirection("zh2en")}>{t("中 → 英", "ZH → EN")}</Chip>
        <Chip selected={direction === "en2zh"} onClick={() => setDirection("en2zh")}>{t("英 → 中", "EN → ZH")}</Chip>
      </div>}
    </Card>

    <div className="dock-actions">
      <Button icon={mode === "refine" ? "wand" : "arrow"} onClick={submit} loading={busy} block>
        {mode === "refine" ? t("检查这一句", "Check this sentence") : t("生成表达", "Express it")}
      </Button>
    </div>

    {error && <ErrorNote message={error} onRetry={submit} retryLabel={t("重试", "Retry")} />}
    {busy && <Card className="card--tint"><p style={{ margin: 0, fontSize: 13.5 }}>
      {t("模型正在生成，可能需要十几秒，请先别离开。", "The model is working. This can take a few seconds.")}
    </p></Card>}

    {result && mode === "refine" && data && <>
      <Card>
        <p className="card-kicker">{t("原文", "ORIGINAL")}</p>
        <div className="result-text result-text--muted break" style={{ marginTop: 4 }}>{data.originalText || result.source}</div>
        {data.correction && <>
          <div className="divider" />
          <p className="card-kicker">{t("修正", "CORRECTED")}</p>
          <div className="result-text result-text--strong break" style={{ marginTop: 4 }}>{data.correction}</div>
        </>}
        <div className="divider" />
        <p className="card-kicker">{t("更自然的说法", "MORE NATURAL")}</p>
        <div className="result-text result-text--strong break" style={{ marginTop: 4 }}>{data.refine || "—"}</div>
      </Card>

      {data.evaluate && <Card className="card--tint">
        <p className="card-kicker">{t("整体评价", "FEEDBACK")}</p>
        <p style={{ margin: 0, fontSize: 14 }}>{data.evaluate}</p>
      </Card>}

      {Array.isArray(data.diagnoses) && data.diagnoses.length > 0 && <div>
        <p className="eyebrow" style={{ margin: "6px 2px 8px" }}>{t("发现的问题", "ISSUES FOUND")}</p>
        {data.diagnoses.map((item: any, index: number) => <div key={index} className="diagnosis" style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <strong>{item.error_type || t("语法问题", "Issue")}</strong>
            {item.severity && <Badge tone={item.severity === "Major" ? "danger" : "warning"}>{item.severity}</Badge>}
          </div>
          <p>{item.explanation || item.message}</p>
        </div>)}
      </div>}

      {data.remember && <Card><div style={{ display: "flex", gap: 10 }}>
        <Icon name="bulb" size={20} /><div><p className="card-kicker">{t("记忆点", "REMEMBER")}</p>
          <p style={{ margin: 0, fontSize: 14 }}>{Array.isArray(data.remember) ? data.remember.join(" · ") : data.remember}</p></div>
      </div></Card>}

      <Card padded={false}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, padding: 10 }}>
          <Action icon="save" label={saved ? t("已保存", "Saved") : t("保存记录", "Save")} onClick={save} disabled={saved || saving} />
          <Action icon="copy" label={t("复制", "Copy")} onClick={() => copy(data.correction || data.refine || result.source)} />
          <Action icon="volume" label={t("朗读", "Speak")} onClick={() => speak(data.correction || data.refine || result.source)} />
          <Action icon="sparkles" label={t("追问", "Ask")} onClick={() => followUp(t(`请解释这句话为什么这样改：${result.source}`, `Explain this correction: ${result.source}`))} />
        </div>
      </Card>
    </>}

    {result && mode === "express" && <>
      <Card className="card--tint">
        <p className="card-kicker">{t("推荐表达", "SUGGESTED")}</p>
        <div className="result-text result-text--strong break" style={{ marginTop: 6, fontSize: 18 }}>
          {data?.translation || result.response?.translation || "—"}
        </div>
      </Card>
      {data?.notes && <Card><p className="card-kicker">{t("用法与语气", "NOTES")}</p>
        <p style={{ margin: 0, fontSize: 14 }}>{data.notes}</p></Card>}
      <Card padded={false}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, padding: 10 }}>
          <Action icon="copy" label={t("复制", "Copy")} onClick={() => copy(data?.translation || "")} />
          <Action icon="volume" label={t("朗读", "Speak")} onClick={() => speak(data?.translation || "")} />
          <Action icon="sparkles" label={t("追问", "Ask")} onClick={() => followUp(t(`这个表达适合什么场合？${data?.translation || ""}`, `When is this expression appropriate? ${data?.translation || ""}`))} />
        </div>
      </Card>
    </>}

    {!result && !busy && <Card className="card--tint">
      <div style={{ display: "flex", gap: 10 }}>
        <Icon name="info" size={20} />
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
          {lang === "zh"
            ? "一次纠错成功不等于已经掌握，只有保存记录后才会进入后续的学习统计。"
            : "One successful correction is not proof of mastery. Only saved records feed your learning history."}
        </p>
      </div>
    </Card>}
    <div className="hero-space" />
  </div>;
}

function Action({ icon, label, onClick, disabled }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="action-tile" onClick={onClick} disabled={disabled}>
    <Icon name={icon} size={20} /><span>{label}</span>
  </button>;
}
