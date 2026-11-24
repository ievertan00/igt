import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { errorMessage, native, store, useApp, useDraft, useRefresh, useResource } from "../core";
import { Badge, Busy, Button, Card, Chip, Empty, ErrorNote, Icon, IconButton, RichText, Segmented, Sheet, relativeTime } from "../ui";

type Turn = { question: string; answer: string; title?: string; related?: string[]; tags?: string[]; category?: string };
type Tab = "chat" | "notes";

export function AskScreen() {
  const { t, lang, toast } = useApp();
  const [tab, setTab] = useState<Tab>("chat");
  const [turns, setTurns] = useState<Turn[]>(() => store.read<Turn[]>("ask.conversation", []));
  const [input, setInput, clearInput] = useDraft("ask");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openNote, setOpenNote] = useState<any>(null);
  const autoSent = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { store.write("ask.conversation", turns); }, [turns]);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, busy]);

  async function send(question: string) {
    const value = question.trim();
    if (!value || busy) return;
    setBusy(true); setError("");
    const messages = turns.map(({ question: q, answer: a }) => ({ question: q, answer: a }));
    try {
      const response = await api.ask(value, messages, lang === "zh" ? "zh-CN" : "en");
      const data = response?.data || {};
      setTurns((previous) => [...previous, {
        question: value,
        answer: data.answer || "",
        title: data.title,
        related: data.related || [],
        tags: data.tags || [],
        category: data.category,
      }]);
      setInput(""); clearInput();
      native.haptic("ok");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  /* A follow-up from the Writing screen arrives as a prefilled draft. */
  useEffect(() => {
    if (autoSent.current) return;
    autoSent.current = true;
    const pending = store.read<string>("draft.ask", "");
    if (pending && turns.length === 0) void send(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (turns.length === 0) { toast(t("先问一个问题", "Ask something first"), "err"); return; }
    setSaving(true);
    try {
      const response = await api.saveAsk(
        turns.map(({ question, answer }) => ({ question, answer })),
        lang === "zh" ? "zh-CN" : "en",
      );
      if (!response?.saved) throw new Error(t("笔记未保存", "Note was not saved"));
      toast(t("已保存为笔记", "Saved as a note"));
      native.haptic("ok");
    } catch (reason) { toast(errorMessage(reason), "err"); }
    finally { setSaving(false); }
  }

  function newChat() {
    setTurns([]);
    setInput(""); clearInput();
    setError("");
    toast(t("已开始新对话", "New conversation"));
  }

  const lastRelated = turns.length ? turns[turns.length - 1].related || [] : [];

  return <>
    <Segmented<Tab> value={tab} onChange={setTab} items={[
      { value: "chat", label: t("对话", "Chat") },
      { value: "notes", label: t("收藏笔记", "Saved notes") },
    ]} />

    {tab === "chat" ? <div className="stack">
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="secondary" icon="save" onClick={save} loading={saving} disabled={turns.length === 0}>
          {t("存为笔记", "Save note")}
        </Button>
        <Button variant="ghost" icon="refresh" onClick={newChat}>{t("新对话", "New")}</Button>
      </div>

      {turns.length === 0 && !busy && <Empty icon="sparkles" title={t("有任何英语问题都可以问", "Ask anything about English")}
        hint={t("语法、词义、语气、场景用法……回答可保存成 Markdown 笔记。",
          "Grammar, word choice, tone, usage — save the answer as a Markdown note.")} />}

      <div className="chat-stream" ref={scrollRef}>
        {turns.map((turn, index) => <React.Fragment key={index}>
          <div className="bubble bubble--user">{turn.question}</div>
          <div className="bubble bubble--ai">
            {turn.category && <div style={{ marginBottom: 6 }}><Badge tone="primary">{turn.category}</Badge></div>}
            <RichText text={turn.answer} />
            {turn.tags && turn.tags.length > 0 && <div className="chip-row" style={{ marginTop: 8 }}>
              {turn.tags.slice(0, 4).map((tag) => <Chip key={tag}>#{tag}</Chip>)}
            </div>}
          </div>
        </React.Fragment>)}
        {busy && <div className="bubble bubble--ai"><Busy label={t("正在思考…", "Thinking…")} /></div>}
      </div>

      {lastRelated.length > 0 && !busy && <div>
        <p className="eyebrow" style={{ margin: "2px 2px 6px" }}>{t("继续追问", "FOLLOW UP")}</p>
        <div className="chip-row" style={{ flexWrap: "wrap" }}>
          {lastRelated.map((question) => <Chip key={question} icon="sparkles" onClick={() => setInput(question)}>{question}</Chip>)}
        </div>
      </div>}

      {error && <ErrorNote message={error} onRetry={() => send(input)} retryLabel={t("重试", "Retry")} />}

      <Card>
        <label className="field">
          <textarea className="field-textarea" value={input} onChange={(event) => setInput(event.target.value)}
            rows={3} placeholder={t("输入你的问题…", "Type your question…")} />
        </label>
        <div className="dock-actions" style={{ position: "static", padding: "10px 0 0" }}>
          <Button icon="send" onClick={() => send(input)} loading={busy} disabled={!input.trim()} block>
            {t("发送", "Send")}
          </Button>
          <IconButton name="volume" label={t("朗读最后一个回答", "Speak last answer")} tone="soft"
            onClick={() => turns.length && native.speak(turns[turns.length - 1].answer.replace(/[#*`]/g, ""))} />
        </div>
      </Card>
    </div> : <NotesList onOpen={setOpenNote} />}

    <Sheet open={Boolean(openNote)} onClose={() => setOpenNote(null)} title={openNote?.title || openNote?.id || ""}
      footer={<Button variant="danger" icon="trash" block onClick={async () => {
        try {
          await api.deleteAskNote(openNote.id);
          setOpenNote(null);
          toast(t("已删除笔记", "Note deleted"));
          window.dispatchEvent(new Event("igt:refresh"));
        } catch (reason) { toast(errorMessage(reason), "err"); }
      }}>{t("删除笔记", "Delete note")}</Button>}>
      {openNote && <>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {openNote.category && <Badge tone="primary">{openNote.category}</Badge>}
          <span className="muted tiny">{relativeTime(openNote.modifiedAt, lang)}</span>
        </div>
        <RichText text={String(openNote.content || "").replace(/^---[\s\S]*?---\n/, "")} />
      </>}
    </Sheet>
    <div className="hero-space" />
  </>;
}

function NotesList({ onOpen }: { onOpen: (note: any) => void }) {
  const { t, lang, toast } = useApp();
  const { data, loading, error, stale, reload } = useResource<any>("ask.notes.v1",
    () => api.listAskNotes(), [], { notes: [] });
  useRefresh(reload);

  async function open(note: any) {
    try {
      const detail = note.content ? note : await api.readAskNote(note.id);
      onOpen({ ...note, content: detail?.content || note.content || "" });
    } catch (reason) { toast(errorMessage(reason), "err"); }
  }

  const notes: any[] = data?.notes || [];
  return <div className="stack">
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <p className="eyebrow">{t("保存在本机 Markdown 目录中", "SAVED AS MARKDOWN ON YOUR COMPUTER")}</p>
      <IconButton name="refresh" label={t("刷新", "Refresh")} onClick={reload} />
    </div>
    {stale && <div className="stale-note"><Icon name="offline" size={16} />{t("离线，显示缓存笔记", "Offline — cached notes")}</div>}
    {error && !stale && <ErrorNote message={error} onRetry={reload} retryLabel={t("重试", "Retry")} />}
    {loading && notes.length === 0 ? <Busy /> : notes.length === 0 ?
      <Empty icon="note" title={t("还没有收藏的问答", "No saved notes yet")}
        hint={t("在对话页点「存为笔记」，回答会保存为 Markdown 文件。", "Tap Save note in a conversation to keep it as Markdown.")} />
      : notes.map((note) => <button key={note.id} type="button" className="list-row" onClick={() => open(note)}>
        <span className="list-row-icon list-row-icon--accent"><Icon name="note" size={20} /></span>
        <span className="list-row-text"><strong>{note.title || note.id.replace(/\.md$/, "")}</strong>
          <small>{note.category || "—"} · {relativeTime(note.modifiedAt, lang)}</small></span>
        <Icon name="forward" size={18} />
      </button>)}
  </div>;
}
