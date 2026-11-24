import React, { useEffect, useMemo, useState } from "react";
import { api, type ReviewCard, type ReviewRating } from "../api";
import { errorMessage, go, native, useApp, useDraft, useRefresh, useResource } from "../core";
import {
  Badge, Busy, Button, Card, Chip, Empty, ErrorNote, Icon, IconButton, Input,
  ListRow, Progress, SectionTitle, Segmented, Sheet, Skeleton, relativeTime,
} from "../ui";

type Tab = "lookup" | "review" | "library";

/* ------------------------------------------------------------------ words -- */
export function WordsScreen() {
  const { route, t, lang, toast } = useApp();
  const [tab, setTab] = useState<Tab>(() => {
    const value = route.params.get("tab");
    return value === "library" || value === "review" ? value : "lookup";
  });
  return <div className="stack">
    <Segmented<Tab> value={tab} onChange={setTab} items={[
      { value: "lookup", label: t("查词", "Look up") },
      { value: "review", label: t("复习", "Review") },
      { value: "library", label: t("词库", "Saved") },
    ]} />
    {tab === "lookup" ? <Lookup /> : tab === "review" ? <ReviewIntro onStart={() => go("/review")} /> : <Library />}
    <div className="hero-space" />
  </div>;
}

/* ----------------------------------------------------------------- lookup -- */
function Lookup() {
  const { t, lang, toast } = useApp();
  const [query, setQuery, clearQuery] = useDraft("word.query");
  const [entry, setEntry] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function lookup() {
    const value = query.trim();
    if (!value) { toast(t("输入一个单词或中文", "Enter a word or Chinese phrase"), "err"); return; }
    setBusy(true); setError(""); setEntry(null);
    try {
      const response = await api.lookupWord(value);
      setEntry(response?.data || response);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  }

  async function add() {
    if (!entry) return;
    setAdding(true);
    try {
      const response = await api.addWord(entry);
      const saved = response?.persistence?.saved;
      toast(saved ? t("已加入词库", "Added to your word bank") : t("这个词已经在词库里", "Already in your word bank"));
      if (saved) native.haptic("ok");
    } catch (reason) { toast(errorMessage(reason), "err"); }
    finally { setAdding(false); }
  }

  async function speak(text: string) {
    const ok = await native.speak(text);
    if (!ok) toast(t("语音服务不可用", "Speech is unavailable"), "err");
  }

  const examples = [entry?.example, entry?.example2, entry?.example3].filter(Boolean);
  const facts: Array<[string, string]> = [
    [t("词性", "POS"), entry?.pos], [t("近义词", "Synonyms"), entry?.synonyms],
    [t("搭配", "Collocations"), entry?.collocations], [t("动词变化", "Verb forms"), entry?.verbForms],
    [t("复数", "Plural"), entry?.plural], [t("比较级", "Comparative"), entry?.comparative],
    [t("备注", "Note"), entry?.note],
  ].filter(([, value]) => Boolean(value)) as Array<[string, string]>;

  return <>
    <Card>
      <Input value={query} onChange={setQuery} onEnter={lookup} icon="search"
        placeholder={t("输入英文单词或中文释义", "English word or Chinese meaning")} />
      <div className="dock-actions" style={{ position: "static", padding: "10px 0 0" }}>
        <Button icon="search" onClick={lookup} loading={busy} block>{t("查词", "Look up")}</Button>
        {query && <IconButton name="close" label={t("清空", "Clear")} onClick={clearQuery} />}
      </div>
    </Card>
    {error && <ErrorNote message={error} onRetry={lookup} retryLabel={t("重试", "Retry")} />}
    {busy && <Card><Skeleton lines={4} /></Card>}

    {entry && <>
      <Card>
        <div className="word-hero">
          <div style={{ minWidth: 0 }}>
            <h2 className="break">{entry.word}</h2>
            {entry.phonetic && <p className="word-phonetic mono">/{String(entry.phonetic).replace(/^\/|\/$/g, "")}/</p>}
          </div>
          <IconButton name="volume" label={t("朗读", "Speak")} tone="soft" onClick={() => speak(entry.word)} />
        </div>
        <p className="word-zh">{entry.zh || t("暂无中文释义", "No Chinese gloss")}</p>
        {entry.meaning && <p className="card-note">{entry.meaning}</p>}
        {entry.translated && <p className="card-note">{t("已按中文输入解析为", "Resolved from Chinese input")} · {entry.lookup}</p>}
        {entry.existing && <div style={{ marginTop: 10 }}><Badge tone="primary">{t("已在词库", "Already saved")}</Badge></div>}
        <div style={{ marginTop: 16 }}>
          <Button icon="plus" onClick={add} loading={adding} block>{t("加入词库", "Add to word bank")}</Button>
        </div>
      </Card>

      {examples.length > 0 && <Card>
        <p className="card-kicker">{t("例句", "EXAMPLES")}</p>
        {examples.map((example: string, index: number) => <div key={index} className="example-item">
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ flex: 1 }}>{example}</span>
            <IconButton name="volume" label={t("朗读", "Speak")} size={17} onClick={() => speak(example)} />
          </div>
        </div>)}
      </Card>}

      {facts.length > 0 && <Card>
        <p className="card-kicker">{t("词条细节", "DETAILS")}</p>
        {facts.map(([label, value]) => <div key={label} className="kv"><strong>{label}</strong><span>{value}</span></div>)}
      </Card>}
    </>}

    {!entry && !busy && <Empty icon="search" title={t("查一个词，看看它怎么用", "Look up a word")}
      hint={t("支持英文单词或中文短语，结果可以一键加入词库并进入复习。", "English words or Chinese phrases. Save a result to review it later.")} />}
  </>;
}

/* ------------------------------------------------------------ review intro -- */
function ReviewIntro({ onStart }: { onStart: () => void }) {
  const { t } = useApp();
  const { data, loading, error, reload } = useResource<{ count: number }>("words.due.v1", async (signal) => {
    const response = await api.reviewDue(100, signal);
    return { count: Array.isArray(response?.cards) ? response.cards.length : 0 };
  }, [], { count: 0 });
  useRefresh(reload);
  return <>
    <Card className="card--hero">
      <p className="card-kicker">{t("间隔复习", "SPACED REVIEW")}</p>
      <div className="big-number">{loading && !data.count ? "–" : data.count}</div>
      <div style={{ fontWeight: 650 }}>{t("张卡片到期", "cards due")}</div>
      <p className="card-note">{t("先自己回忆，再核对答案，最后按回忆难度给一个评价。",
        "Recall first, check the answer, then rate how hard it was to remember.")}</p>
      <div style={{ marginTop: 16 }}><Button variant="secondary" icon="play" onClick={onStart} disabled={loading || data.count === 0} block>
        {t("开始一组复习", "Start a session")}
      </Button></div>
    </Card>
    {error && <ErrorNote message={error} onRetry={reload} retryLabel={t("重试", "Retry")} />}
    <Card>
      <p className="card-kicker">{t("四个评价档位", "FOUR RATINGS")}</p>
      <div className="kv"><strong>{t("Again", "Again")}</strong><span>{t("完全没想起来，今天再来一次", "Did not recall — repeat today")}</span></div>
      <div className="kv"><strong>{t("Hard", "Hard")}</strong><span>{t("想得很费力，明天再见", "Recalled with effort")}</span></div>
      <div className="kv"><strong>{t("Good", "Good")}</strong><span>{t("正常想起来了", "Recalled normally")}</span></div>
      <div className="kv"><strong>{t("Easy", "Easy")}</strong><span>{t("很轻松，间隔拉长", "Effortless — longer interval")}</span></div>
    </Card>
    <Card className="card--tint">
      <p style={{ margin: 0, fontSize: 13 }}>{t("评分只是安排下次复习时间，不代表已经长期掌握。",
        "A rating schedules the next review; it does not prove durable mastery.")}</p>
    </Card>
  </>;
}

/* ---------------------------------------------------------------- library -- */
const STATUS_TONE: Record<string, string> = {
  new: "primary", learning: "warning", "needs-reinforcement": "danger",
  retained: "success", "well-retained": "success", "insufficient-history": "neutral", unavailable: "neutral",
};

function Library() {
  const { t, lang, toast } = useApp();
  const [search, setSearch] = useDraft("word.search");
  const [sort, setSort] = useState("az");
  const [status, setStatus] = useState("all");
  const [schedule, setSchedule] = useState("all");
  const [offset, setOffset] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const limit = 20;

  const { data, loading, error, stale, reload } = useResource<any>(
    `words.library.v1.${search}.${sort}.${status}.${schedule}.${offset}`,
    (signal) => api.listWords({ q: search, sort, status, schedule, offset, limit }, signal),
    [search, sort, status, schedule, offset],
    { words: [], total: 0, overview: null },
  );
  useRefresh(reload);

  useEffect(() => { setOffset(0); }, [search, sort, status, schedule]);

  async function openDetail(word: any) {
    setDetail(word);
    setHistory([]);
    const cardId = word?.srs?.id;
    if (!cardId) return;
    setHistoryBusy(true);
    try {
      const response = await api.wordHistory(cardId, 0);
      setHistory(response?.records || []);
    } catch { /* history is optional */ }
    finally { setHistoryBusy(false); }
  }

  const words: any[] = data?.words || [];
  const overview = data?.overview || {};

  return <>
    <Card>
      <Input value={search} onChange={setSearch} icon="search" placeholder={t("搜索已保存的词", "Search saved words")} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
        <Button variant="secondary" icon="filter" onClick={() => setFilterOpen(true)}>{t("筛选", "Filters")}</Button>
        <div className="chip-row" style={{ flex: 1 }}>
          <Chip selected={schedule === "due"} onClick={() => setSchedule(schedule === "due" ? "all" : "due")}>{t("待复习", "Due")}</Chip>
          <Chip selected={status === "retained"} onClick={() => setStatus(status === "retained" ? "all" : "retained")}>{t("已记住", "Retained")}</Chip>
        </div>
      </div>
      {overview && <div className="metric-grid metric-grid--3" style={{ marginTop: 12 }}>
        <div className="metric"><strong>{overview.due ?? 0}</strong><span>{t("待复习", "Due")}</span></div>
        <div className="metric"><strong>{overview.retained ?? 0}</strong><span>{t("已记住", "Retained")}</span></div>
        <div className="metric"><strong>{data?.totalSaved ?? 0}</strong><span>{t("总词条", "Saved")}</span></div>
      </div>}
    </Card>

    {stale && <div className="stale-note"><Icon name="offline" size={16} />{t("离线，显示缓存词库", "Offline — cached word bank")}</div>}
    {error && !stale && <ErrorNote message={error} onRetry={reload} retryLabel={t("重试", "Retry")} />}
    {loading && words.length === 0 ? <Card><Skeleton lines={5} /></Card> : words.length === 0 ?
      <Empty icon="book" title={t("词库还是空的", "No saved words yet")}
        hint={t("查词后点「加入词库」，词条会出现在这里并进入复习。", "Save a lookup result to see it here.")}
        action={t("去查词", "Look up a word")} onAction={() => go("/words?tab=lookup")} />
      : <>
        <SectionTitle title={t("已保存", "Saved words")} kicker={`${data?.total ?? words.length}`} />
        {words.map((word: any) => <ListRow key={word.id || word.word} icon="book" title={`${word.word}${word.phonetic ? `  /${word.phonetic}/` : ""}`}
          sub={word.zh || word.meaning || ""} onClick={() => openDetail(word)}
          right={<Badge tone={STATUS_TONE[word.learningStatus] || "neutral"}>{word.learningStatus || "—"}</Badge>} />)}
        {(offset + limit < (data?.total ?? 0)) && <Button variant="secondary" onClick={() => setOffset(offset + limit)} block>
          {t("加载更多", "Load more")}
        </Button>}
      </>}

    <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title={t("筛选与排序", "Filter & sort")}
      footer={<Button onClick={() => setFilterOpen(false)} block>{t("完成", "Done")}</Button>}>
      <p className="eyebrow">{t("排序", "SORT")}</p>
      <div className="chip-row" style={{ flexWrap: "wrap", marginBottom: 16 }}>
        {[["az", t("按字母", "A–Z")], ["newest", t("最近添加", "Newest")], ["next-review", t("下次复习", "Next review")]].map(([value, label]) =>
          <Chip key={value} selected={sort === value} onClick={() => setSort(value)}>{label}</Chip>)}
      </div>
      <p className="eyebrow">{t("复习状态", "STATUS")}</p>
      <div className="chip-row" style={{ flexWrap: "wrap", marginBottom: 16 }}>
        {[["all", t("全部", "All")], ["new", t("新词", "New")], ["learning", t("学习中", "Learning")],
          ["needs-reinforcement", t("需强化", "Reinforce")], ["retained", t("已记住", "Retained")],
          ["well-retained", t("牢固", "Well retained")]].map(([value, label]) =>
          <Chip key={value} selected={status === value} onClick={() => setStatus(value)}>{label}</Chip>)}
      </div>
      <p className="eyebrow">{t("复习计划", "SCHEDULE")}</p>
      <div className="chip-row" style={{ flexWrap: "wrap" }}>
        {[["all", t("全部", "All")], ["due", t("已到期", "Due")], ["upcoming", t("即将到期", "Upcoming")], ["unscheduled", t("未安排", "Unscheduled")]].map(([value, label]) =>
          <Chip key={value} selected={schedule === value} onClick={() => setSchedule(value)}>{label}</Chip>)}
      </div>
    </Sheet>

    <Sheet open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.word || ""}>
      {detail && <>
        {detail.phonetic && <p className="mono muted">/{String(detail.phonetic).replace(/^\/|\/$/g, "")}/</p>}
        <h3 style={{ margin: "6px 0 12px", fontSize: 20 }}>{detail.zh}</h3>
        {detail.meaning && <p>{detail.meaning}</p>}
        {detail.example && <div className="example-item">{detail.example}</div>}
        <div className="divider" />
        <div className="kv"><strong>{t("状态", "Status")}</strong><span>{detail.learningStatus || "—"}</span></div>
        <div className="kv"><strong>{t("复习次数", "Reviews")}</strong><span>{detail.srs?.total_reviews ?? 0}</span></div>
        <div className="kv"><strong>{t("下次复习", "Next")}</strong><span>{detail.srs?.due_date || "—"}</span></div>
        <div className="kv"><strong>{t("间隔", "Interval")}</strong><span>{detail.srs?.interval_days ?? 0} {t("天", "days")}</span></div>
        <div className="divider" />
        <p className="eyebrow">{t("复习记录", "REVIEW HISTORY")}</p>
        {historyBusy ? <Busy /> : history.length === 0 ? <p className="muted tiny">{t("暂无记录", "No review history yet")}</p> :
          history.slice(0, 8).map((record: any) => <div key={record.id} className="example-item">
            <strong>{record.learner_answer || "—"}</strong>
            <div className="muted tiny">{relativeTime(record.created_at, lang)} · {record.feedback || ""}</div>
          </div>)}
      </>}
    </Sheet>
  </>;
}

/* --------------------------------------------------------- review session -- */
function makeSessionId(): string {
  try { return crypto.randomUUID(); } catch { return `igt-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`; }
}

export function ReviewSession() {
  const { t, lang, toast, back } = useApp();
  const { data, loading, error, reload } = useResource<{ cards: ReviewCard[] }>("review.session.v1",
    (signal) => api.reviewDue(20, signal).then((response) => ({ cards: response?.cards || [] })),
    [], { cards: [] });
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [grading, setGrading] = useState(false);
  const [audioPlayed, setAudioPlayed] = useState(false);
  const [revealIpa, setRevealIpa] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [grades, setGrades] = useState<Record<ReviewRating, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const sessionId = useMemo(makeSessionId, []);

  const cards = data.cards;
  const card = cards[index];
  const done = !loading && cards.length > 0 && index >= cards.length;

  async function check() {
    if (!card) return;
    const value = answer.trim();
    if (!value) { toast(t("先试着回忆一下", "Try to recall it first"), "err"); return; }
    setBusy(true);
    try {
      const response = await api.checkReview(card.id, value);
      setChecked(response);
      native.haptic("ok");
    } catch (reason) { toast(errorMessage(reason), "err"); }
    finally { setBusy(false); }
  }

  async function grade(rating: ReviewRating) {
    if (!card || !checked) return;
    setGrading(true);
    try {
      const response = await api.gradeReview(card.id, answer.trim(), `${sessionId}-${index}`, audioPlayed, rating);
      if (response?.persistence?.saved !== true) throw new Error(t("评分未保存，请重试", "Rating was not saved, please retry"));
      setGrades((previous) => ({ ...previous, [rating]: previous[rating] + 1 }));
      native.haptic("ok");
      setIndex((value) => value + 1);
      setAnswer(""); setChecked(null); setAudioPlayed(false); setRevealIpa(false); setShowExample(false);
    } catch (reason) { toast(errorMessage(reason), "err"); }
    finally { setGrading(false); }
  }

  async function skip() {
    if (!card) return;
    try {
      await api.deleteReview(card.id);
      setIndex((value) => value + 1);
      setAnswer(""); setChecked(null); setRevealIpa(false); setShowExample(false);
      toast(t("已移除这张卡片", "Card removed"));
    } catch (reason) { toast(errorMessage(reason), "err"); }
  }

  async function speak(text: string) {
    const ok = await native.speak(text);
    if (ok) setAudioPlayed(true);
    else toast(t("语音服务不可用", "Speech is unavailable"), "err");
  }

  if (loading && cards.length === 0) return <Card><Busy label={t("正在准备卡片…", "Preparing cards…")} /></Card>;
  if (error && cards.length === 0) return <ErrorNote message={error} onRetry={reload} retryLabel={t("重试", "Retry")} />;
  if (!loading && cards.length === 0) return <Empty icon="check" title={t("今天没有待复习的卡片", "Nothing due today")}
    hint={t("查词并加入词库后，卡片会出现在这里。", "Save a few words to build your review queue.")}
    action={t("返回词汇", "Back to words")} onAction={() => go("/words")} />;

  if (done) return <div className="stack">
    <Card className="card--hero center">
      <p className="card-kicker">{t("本组完成", "SESSION COMPLETE")}</p>
      <div className="big-number">{cards.length}</div>
      <div style={{ fontWeight: 650 }}>{t("张卡片", "cards reviewed")}</div>
    </Card>
    <div className="metric-grid">
      {(["again", "hard", "good", "easy"] as ReviewRating[]).map((rating) =>
        <div key={rating} className="metric"><strong>{grades[rating]}</strong><span>{rating}</span></div>)}
    </div>
    <Button icon="refresh" onClick={() => { setIndex(0); setGrades({ again: 0, hard: 0, good: 0, easy: 0 }); reload(); }} block>
      {t("再来一组", "Another session")}
    </Button>
    <Button variant="secondary" onClick={back} block>{t("完成", "Done")}</Button>
  </div>;

  if (!card) return <Busy />;

  const details = card.vocab_details || {};
  const phonetic = String((details as any).phonetic || "");
  const ratings = checked?.ratings || {};

  return <div className="stack">
    <div className="session-bar">
      <Progress value={(index / cards.length) * 100} />
      <span>{index + 1} / {cards.length}</span>
    </div>

    <Card className="focus-card">
      <p className="card-kicker">{t("请回忆这个单词", "RECALL THE WORD")}</p>
      <div className="prompt break">{card.zh || card.prompt}</div>
      <div className="hint">{card.pos ? `${card.pos}` : t("输入英文单词", "Type the English word")}</div>
      <div className="chip-row" style={{ marginTop: 12 }}>
        {phonetic && <Chip selected={revealIpa} onClick={() => setRevealIpa(!revealIpa)} icon="volume">
          {revealIpa ? <span className="mono">/{phonetic.replace(/^\/|\/$/g, "")}/</span> : t("显示音标", "Show IPA")}
        </Chip>}
        <Chip selected={showExample} onClick={() => setShowExample(!showExample)} icon="bulb">
          {t("例句提示", "Example hint")}
        </Chip>
      </div>
      {showExample && <p className="mono muted tiny" style={{ marginTop: 6 }}>{card.masked_example || card.example || "—"}</p>}
    </Card>

    {!checked ? <Card>
      <Input value={answer} onChange={setAnswer} onEnter={check} placeholder={t("输入你回忆出的单词", "Type the word you recall")} />
      <div className="dock-actions" style={{ position: "static", padding: "10px 0 0" }}>
        <Button icon="check" onClick={check} loading={busy} block>{t("核对答案", "Check answer")}</Button>
      </div>
    </Card> : <>
      <Card className={checked.correct ? "card--tint" : "card--accent"}>
        <p className="card-kicker">{checked.correct ? t("回忆正确", "RECALLED") : t("参考答案", "ANSWER")}</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <h2 className="break" style={{ margin: 0, fontSize: 27 }}>{card.word || card.answer}</h2>
          <IconButton name="volume" label={t("朗读", "Speak")} tone="soft" onClick={() => speak(card.word || card.answer)} />
        </div>
        {phonetic && <p className="word-phonetic mono">/{phonetic.replace(/^\/|\/$/g, "")}/</p>}
        <p className="word-zh">{card.zh}</p>
        {card.meaning && <p className="card-note">{card.meaning}</p>}
        {card.example && <div className="example-item" style={{ marginTop: 10 }}>{card.example}</div>}
      </Card>

      <div>
        <p className="eyebrow" style={{ margin: "6px 2px 8px" }}>{t("这次回忆有多难？", "HOW HARD WAS IT TO RECALL?")}</p>
        <div className="grade-grid">
          {(["again", "hard", "good", "easy"] as ReviewRating[]).map((rating) =>
            <button key={rating} type="button" className={`grade grade--${rating}`} disabled={grading}
              onClick={() => grade(rating)}>
              <strong>{rating}</strong>
              <small>{ratings[rating]?.intervalDays != null ? `${ratings[rating].intervalDays}d` : "—"}</small>
            </button>)}
        </div>
        <p className="card-note">{t("数字是下一次复习的间隔天数。", "Numbers are the next interval in days.")}</p>
      </div>
    </>}

    <div style={{ display: "flex", gap: 8 }}>
      <Button variant="ghost" icon="trash" onClick={skip}>{t("移除此卡", "Remove card")}</Button>
      <Button variant="ghost" onClick={back}>{t("结束本组", "End session")}</Button>
    </div>
    <div className="hero-space" />
  </div>;
}
