import React, { useEffect, useMemo, useState } from "react";
import { api, type ReviewCard, type ReviewRating } from "../api";
import { errorMessage, go, native, useApp, useDraft, useRefresh, useResource } from "../core";
import {
  Badge, Busy, Button, Card, Chip, Empty, ErrorNote, Icon, IconButton, Input,
  Progress, Sheet, Skeleton,
} from "../ui";

type WordEntry = {
  word: string;
  pos?: string;
  phonetic?: string;
  zh?: string;
  meaning?: string;
  synonyms?: string;
  collocations?: string;
  verbForms?: string;
  plural?: string;
  comparative?: string;
  example?: string;
  example2?: string;
  example3?: string;
  note?: string;
  memory?: string;
};

type SavedWord = WordEntry & {
  id: string;
};

type WordPage = {
  words: SavedWord[];
  total: number;
  totalSaved: number;
  offset: number;
  overview: { due: number; retained: number } | null;
};

function formatIpa(value: string) {
  return `/${value.replace(/^\/|\/$/g, "")}/`;
}

function WordCard({ entry, onSpeak, onSpeakExample = onSpeak, children }: {
  entry: WordEntry; onSpeak: (text: string) => void; onSpeakExample?: (text: string) => void; children?: React.ReactNode;
}) {
  const { t } = useApp();
  const examples = [entry.example, entry.example2, entry.example3].filter((value): value is string => Boolean(value));
  const facts = [
    [t("英文释义", "Meaning"), entry.meaning, "meaning"],
    [t("中文释义", "Chinese"), entry.zh, "translation"],
    [t("近义词", "Synonyms"), entry.synonyms, "synonyms"],
    [t("常见搭配", "Collocations"), entry.collocations, "usage"],
    [t("动词变化", "Verb forms"), entry.verbForms, "usage"],
    [t("复数", "Plural"), entry.plural, "usage"],
    [t("比较级", "Comparative"), entry.comparative, "usage"],
  ];
  return <Card className="word-card">
    <div className="word-card-heading">
      <div className="word-card-title">
        <h2 className="break">{entry.word}</h2>
        <IconButton name="volume" label={t("朗读单词", "Speak word")} size={22} onClick={() => onSpeak(entry.word)} />
      </div>
      {(entry.pos || entry.phonetic) && <div className="word-card-meta">
        {entry.pos && <Badge>{entry.pos}</Badge>}
        {entry.phonetic && <span className="word-phonetic mono break">{formatIpa(entry.phonetic)}</span>}
      </div>}
    </div>
    {facts.map(([label, value, tone]) => value && <div className={`word-field word-field--${tone}`} key={label}>
      <h3>{label}</h3><p>{value}</p>
    </div>)}
    {examples.length > 0 && <div className="word-field">
      <h3>{t("例句", "Examples")}</h3>
      <ol className="word-examples">{examples.map((example, index) => <li key={index}>
        <div><span>{example}</span><IconButton name="volume" size={17}
          label={t(`朗读例句 ${index + 1}`, `Speak example ${index + 1}`)} onClick={() => onSpeakExample(example)} /></div>
      </li>)}</ol>
    </div>}
    {entry.note && <div className="word-field word-field--note"><h3>{t("备注", "Note")}</h3><p>{entry.note}</p></div>}
    {entry.memory && <div className="word-field word-field--note"><h3>{t("记忆提示", "Memory aid")}</h3><p>{entry.memory}</p></div>}
    {children}
  </Card>;
}

async function speakWord(text: string, onError: () => void) {
  if (!(await native.speak(text))) onError();
}

export function WordsScreen() {
  const { route } = useApp();
  if (route.params.get("tab") === "lookup") return <div className="stack words-layout">
    <Lookup />
  </div>;
  return <Library viewing={route.params.get("view") === "card"} />;
}

/* ----------------------------------------------------------------- lookup -- */
function Lookup() {
  const { t, toast } = useApp();
  const [query, setQuery, clearQuery] = useDraft("word.query");
  const [entry, setEntry] = useState<(WordEntry & { translated?: boolean; lookup?: string; existing?: boolean }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function lookup() {
    if (busy) return;
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
      setEntry((current) => current === entry ? { ...entry, existing: true } : current);
      if (saved) native.haptic("ok");
    } catch (reason) { toast(errorMessage(reason), "err"); }
    finally { setAdding(false); }
  }

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

    {entry && <WordCard entry={entry} onSpeak={(text) => speakWord(text, () => toast(t("语音服务不可用", "Speech is unavailable"), "err"))}>
      {entry.translated && <p className="muted tiny">{t("已按中文输入解析为", "Resolved from Chinese input")} · {entry.lookup}</p>}
      {entry.existing ? <div><Badge tone="primary">{t("已在词库", "Already saved")}</Badge></div>
        : <Button icon="plus" onClick={add} loading={adding} block>{t("加入词库", "Add to word bank")}</Button>}
    </WordCard>}

    {!entry && !busy && <Empty icon="search" title={t("查一个词，看看它怎么用", "Look up a word")}
      hint={t("支持英文单词或中文短语，结果可以一键加入词库并进入复习。", "English words or Chinese phrases. Save a result to review it later.")} />}
  </>;
}

/* ---------------------------------------------------------------- library -- */
const EMPTY_WORD_PAGE: WordPage = { words: [], total: 0, totalSaved: 0, offset: 0, overview: null };

function Library({ viewing }: { viewing: boolean }) {
  const { t, toast } = useApp();
  const [search, setSearch] = useDraft("word.search");
  const [sort, setSort] = useState("az");
  const [status, setStatus] = useState("all");
  const [schedule, setSchedule] = useState("all");
  const [offset, setOffset] = useState(0);
  const [position, setPosition] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const limit = 20;

  const { data, loading, error, stale, reload } = useResource<WordPage>(
    `words.library.v1.${search}.${sort}.${status}.${schedule}.${offset}`,
    (signal) => api.listWords({ q: search, sort, status, schedule, offset, limit }, signal),
    [search, sort, status, schedule, offset],
    EMPTY_WORD_PAGE,
  );
  useRefresh(reload);

  const { words, total, totalSaved, overview } = data;
  const activeFilters = Boolean(search.trim()) || status !== "all" || schedule !== "all";
  const due = overview?.due;
  const currentPosition = Math.min(position, Math.max(0, total - 1));
  const waitingForPage = data.offset !== offset && (loading || Boolean(error));
  const word = waitingForPage ? undefined : words[currentPosition - data.offset];

  function setPagePosition(next: number) {
    setPosition(next);
    setOffset(Math.floor(next / limit) * limit);
  }

  function openCard(next: number) {
    setPagePosition(next);
    go("/words?view=card");
  }

  function changeCard(next: number) {
    setPagePosition(next);
    document.querySelector(".screen")?.scrollTo(0, 0);
  }

  function changeFilter(update: (value: string) => void, value: string) {
    update(value);
    setOffset(0);
  }

  if (viewing) return <div className="stack words-layout words-reader">
    {error && !word ? <ErrorNote message={error} onRetry={reload} retryLabel={t("重试", "Retry")} />
      : !word && loading ? <Card><Skeleton lines={5} /></Card>
      : word ? <>
        <WordCard key={word.id} entry={word} onSpeak={(text) => speakWord(text, () => toast(t("语音服务不可用", "Speech is unavailable"), "err"))} />
        <nav className="words-dock words-pager" aria-label={t("词卡翻页", "Word card navigation")}>
          <Button variant="secondary" icon="back" onClick={() => changeCard(currentPosition - 1)} disabled={currentPosition === 0 || loading}>
            {t("上一张", "Previous")}
          </Button>
          <span aria-live="polite">{currentPosition + 1} / {total}</span>
          <Button variant="secondary" icon="forward" onClick={() => changeCard(currentPosition + 1)} disabled={currentPosition + 1 >= total || loading}>
            {t("下一张", "Next")}
          </Button>
        </nav>
      </> : <Empty icon="book" title={t("没有可浏览的词卡", "No cards to browse")}
        action={t("返回词库", "Back to vocabulary")} onAction={() => go("/words")} />}
  </div>;

  return <div className="stack words-layout">
    <Card className="words-action-card">
      <div className="words-action-heading">
        <span className="words-symbol"><Icon name="clock" /></span>
        <div>
          <h2>{t("今日待复习", "Today’s due")}</h2>
          <p>{due == null ? t("查看今天的复习队列", "See today’s review queue")
            : due > 0 ? t(`${due} 个单词待复习`, `${due} words due`) : t("今天的待复习单词已清空", "You’re all caught up today")}</p>
        </div>
      </div>
      <Button icon="play" onClick={() => go("/review")} disabled={due === 0} block>{t("开始复习", "Start review")}</Button>
    </Card>

    <Card className="words-action-card">
      <div className="words-action-heading">
        <span className="words-symbol"><Icon name="layers" /></span>
        <div>
          <h2>{t("浏览词卡", "Browse cards")}</h2>
          <p>{t(`${totalSaved} 个已保存的单词`, `${totalSaved} saved words`)}{overview && ` · ${t(`${overview.retained} 个已记住`, `${overview.retained} retained`)}`}</p>
        </div>
      </div>
      <Button variant="soft" icon="forward" onClick={() => openCard(0)} disabled={total === 0 || loading} block>
        {activeFilters ? t("浏览筛选结果", "Browse matching cards") : t("浏览全部词卡", "Browse all cards")}
      </Button>
    </Card>

    <section className="stack stack--tight" aria-labelledby="saved-words-title">
      <div className="words-list-heading">
        <h2 id="saved-words-title">{t("所有单词", "All words")} <span>{total}</span></h2>
        <Button variant="secondary" icon="search" onClick={() => go("/words?tab=lookup")}>{t("查词", "Look up")}</Button>
      </div>
      <div className="words-search">
        <Input value={search} onChange={(value) => changeFilter(setSearch, value)} icon="search"
          label={t("搜索词库", "Search vocabulary")} placeholder={t("单词或释义", "Word or meaning")} />
        <IconButton name="filter" label={t("筛选与排序", "Filter & sort")} tone="soft" onClick={() => setFilterOpen(true)} />
      </div>
      <div className="words-hints">
        <Chip selected={schedule === "due"} onClick={() => changeFilter(setSchedule, schedule === "due" ? "all" : "due")}>{t("待复习", "Due")}</Chip>
        <Chip selected={status === "retained"} onClick={() => changeFilter(setStatus, status === "retained" ? "all" : "retained")}>{t("已记住", "Retained")}</Chip>
      </div>
      {stale && words.length > 0 && <div className="stale-note"><Icon name="offline" size={16} />{t("离线，显示缓存词库", "Offline — cached word bank")}</div>}
      {error && <ErrorNote message={error} onRetry={reload} retryLabel={t("重试", "Retry")} />}
      {loading && (words.length === 0 || waitingForPage) ? <Card><Skeleton lines={5} /></Card>
        : words.length > 0 ? <Card className="words-list" padded={false}>
          {words.map((item, index) => <button key={item.id} type="button" className="words-row" disabled={loading}
            onClick={() => openCard(data.offset + index)}>
            <span className="words-symbol" aria-hidden="true">{Array.from(item.word.trim())[0]?.toUpperCase() || "?"}</span>
            <span className="words-row-text">
              <strong>{item.word}</strong>
              <small>{[item.pos, item.zh || item.meaning].filter(Boolean).join(" · ")}</small>
            </span>
            <Icon name="forward" size={18} />
          </button>)}
        </Card> : !error && <Empty icon="book"
          title={activeFilters ? t("没有匹配的单词", "No matching words") : t("词库还是空的", "No saved words yet")}
          hint={activeFilters ? t("试试其他关键词或筛选条件。", "Try another search or filter.") : t("查词后可以把结果加入词库。", "Look up a word to add it to your library.")}
          action={activeFilters ? undefined : t("去查词", "Look up a word")} onAction={() => go("/words?tab=lookup")} />}
      {(data.offset > 0 || data.offset + limit < total) && <div className="words-pager">
        <Button variant="secondary" icon="back" disabled={data.offset === 0 || loading} onClick={() => setOffset(data.offset - limit)}>{t("上一页", "Previous")}</Button>
        <span>{Math.floor(data.offset / limit) + 1} / {Math.ceil(total / limit)}</span>
        <Button variant="secondary" icon="forward" disabled={data.offset + limit >= total || loading} onClick={() => setOffset(data.offset + limit)}>{t("下一页", "Next")}</Button>
      </div>}
    </section>

    <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title={t("筛选与排序", "Filter & sort")}
      footer={<Button onClick={() => setFilterOpen(false)} block>{t("完成", "Done")}</Button>}>
      <p className="eyebrow">{t("排序", "SORT")}</p>
      <div className="chip-row" style={{ flexWrap: "wrap", marginBottom: 16 }}>
        {[["az", t("按字母", "A–Z")], ["newest", t("最近添加", "Newest")], ["next-review", t("下次复习", "Next review")]].map(([value, label]) =>
          <Chip key={value} selected={sort === value} onClick={() => changeFilter(setSort, value)}>{label}</Chip>)}
      </div>
      <p className="eyebrow">{t("复习状态", "STATUS")}</p>
      <div className="chip-row" style={{ flexWrap: "wrap", marginBottom: 16 }}>
        {[["all", t("全部", "All")], ["new", t("新词", "New")], ["learning", t("学习中", "Learning")],
          ["needs-reinforcement", t("需强化", "Reinforce")], ["retained", t("已记住", "Retained")],
          ["well-retained", t("牢固", "Well retained")]].map(([value, label]) =>
          <Chip key={value} selected={status === value} onClick={() => changeFilter(setStatus, value)}>{label}</Chip>)}
      </div>
      <p className="eyebrow">{t("复习计划", "SCHEDULE")}</p>
      <div className="chip-row" style={{ flexWrap: "wrap" }}>
        {[["all", t("全部", "All")], ["due", t("已到期", "Due")], ["upcoming", t("即将到期", "Upcoming")], ["unscheduled", t("未安排", "Unscheduled")]].map(([value, label]) =>
          <Chip key={value} selected={schedule === value} onClick={() => changeFilter(setSchedule, value)}>{label}</Chip>)}
      </div>
    </Sheet>

  </div>;
}

/* --------------------------------------------------------- review session -- */
function makeSessionId(): string {
  try { return crypto.randomUUID(); } catch { return `igt-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`; }
}

export function ReviewSession() {
  const { t, toast, back } = useApp();
  const { data, loading, error, reload } = useResource<{ cards: ReviewCard[] }>("review.session.v1",
    (signal) => api.reviewDue(20, signal).then((response) => ({ cards: response?.cards || [] })),
    [], { cards: [] });
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [grading, setGrading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [audioPlayed, setAudioPlayed] = useState(false);
  const [revealIpa, setRevealIpa] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [grades, setGrades] = useState<Record<ReviewRating, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const sessionId = useMemo(makeSessionId, []);

  const cards = data.cards;
  const card = cards[index];
  const done = !loading && cards.length > 0 && index >= cards.length;
  const ratedCount = Object.values(grades).reduce((sum, count) => sum + count, 0);

  useEffect(() => { document.querySelector(".screen")?.scrollTo(0, 0); }, [index, checked]);

  async function check() {
    if (!card || busy || removing) return;
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
    if (!card || !checked || grading || removing) return;
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
    if (!card || busy || grading || removing) return;
    setRemoving(true);
    try {
      await api.deleteReview(card.id);
      setIndex((value) => value + 1);
      setAnswer(""); setChecked(null); setAudioPlayed(false); setRevealIpa(false); setShowExample(false);
      toast(t("已移除这张卡片", "Card removed"));
    } catch (reason) { toast(errorMessage(reason), "err"); }
    finally { setRemoving(false); }
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

  if (done) return <div className="stack words-layout">
    <Card className="words-action-card">
      <div className="words-action-heading">
        <span className="words-symbol"><Icon name="check" /></span>
        <div><h2>{t("本组完成", "Session complete")}</h2>
          <p>{t(`已评分 ${ratedCount} 张卡片`, `Rated ${ratedCount} cards`)}</p></div>
      </div>
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
  const examples = Array.isArray(details.examples)
    ? details.examples.filter((example): example is string => typeof example === "string" && Boolean(example.trim()))
    : [];
  const phonetic = typeof details.phonetic === "string" ? details.phonetic : "";
  const exampleHint = card.masked_example;
  const reviewEntry = {
    ...card, ...details, word: card.word || card.answer, phonetic,
    example: examples[0] || card.example, example2: examples[1], example3: examples[2],
  };
  const ratings = checked?.ratings || {};

  return <div className="stack words-layout words-reader">
    <div className="review-progress">
      <span>{t("复习进度", "Review progress")}</span>
      <span>{index + 1} / {cards.length}</span>
      <Progress value={(index / cards.length) * 100} />
    </div>

    {!checked ? <Card className="review-prompt">
      <div className="word-field">
        <h3>{t("回忆英文单词", "Recall the English word")}</h3>
        <p className="review-clue">{card.zh || card.prompt}</p>
        {card.pos && <Badge tone="primary">{card.pos}</Badge>}
      </div>
      {(phonetic || exampleHint) && <div className="words-hints">
        {phonetic && <Chip selected={revealIpa} onClick={() => setRevealIpa(!revealIpa)} icon="volume">
          {t("显示音标", "Show IPA")}
        </Chip>}
        {exampleHint && <Chip selected={showExample} onClick={() => setShowExample(!showExample)} icon="bulb">
          {t("例句提示", "Example hint")}
        </Chip>}
      </div>}
      {(revealIpa || showExample) && <div className="review-hint-text" role="status">
        {revealIpa && <div className="mono break">{formatIpa(phonetic)}</div>}
        {showExample && <div>{exampleHint}</div>}
      </div>}
      <Input value={answer} onChange={setAnswer} onEnter={check}
        label={t("你的答案", "Your answer")} placeholder={t("输入回忆出的单词", "Type the word you recall")} />
    </Card> : <>
      <p className="review-feedback" role="status">
        <Badge tone={checked.correct ? "success" : "warning"}>{checked.correct ? t("回忆正确", "Recalled correctly") : t("参考答案", "Correct answer")}</Badge>
        <span>{t("你的答案", "Your answer")} · <strong>{answer.trim()}</strong></span>
      </p>
      <WordCard entry={reviewEntry} onSpeak={speak}
        onSpeakExample={(text) => speakWord(text, () => toast(t("语音服务不可用", "Speech is unavailable"), "err"))} />
    </>}

    <div className="review-utilities">
      <Button variant="ghost" icon="trash" loading={removing} disabled={busy || grading} onClick={skip}>{t("移除此卡", "Remove card")}</Button>
      <Button variant="ghost" onClick={back}>{t("结束本组", "End session")}</Button>
    </div>

    <div className="words-dock review-dock">
      {!checked ? <Button icon="check" onClick={check} loading={busy} disabled={removing || !answer.trim()} block>{t("核对答案", "Check answer")}</Button> : <>
        <h2>{t("这次回忆有多难？", "How hard was it to recall?")}</h2>
        <div className="grade-grid">
          {(["again", "hard", "good", "easy"] as const).map((rating) =>
            <button key={rating} type="button" className={`grade grade--${rating}`} disabled={grading || removing}
              onClick={() => grade(rating)}>
              <strong>{rating}</strong>
              <small>{ratings[rating]?.intervalDays != null ? `${ratings[rating].intervalDays}d` : "—"}</small>
            </button>)}
        </div>
        <p className="tiny muted">{t("数字表示距离下次复习的天数。", "Numbers show the days until the next review.")}</p>
      </>}
    </div>
  </div>;
}
