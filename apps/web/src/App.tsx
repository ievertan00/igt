import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { webApi } from "./api/client";

type Route =
  | "dashboard"
  | "grammar"
  | "translation"
  | "word-lookup"
  | "word-review"
  | "practice"
  | "ask"
  | "handbook"
  | "coach"
  | "settings";
const items: Array<[Route, string]> = [
  ["grammar", "语法检查"],
  ["translation", "翻译"],
  ["word-lookup", "单词查询"],
  ["word-review", "单词复习"],
  ["practice", "练习"],
  ["ask", "语法查询"],
  ["handbook", "Handbook"],
  ["coach", "Coach"],
  ["settings", "模型设置"],
];
const groups: Array<[string, Array<[Route, string]>]> = [
  ["语言工具", items.slice(0, 3)],
  ["练习工作台", items.slice(3, 5)],
  ["Ask", items.slice(5, 6)],
  ["学习系统", items.slice(6, 8)],
];

function formatActivityTimestamp(value: unknown) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "时间未知";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Dashboard() {
  const [data, setData] = useState<any>();
  const [error, setError] = useState("");
  useEffect(() => {
    webApi
      .getDashboard()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  if (error) return <State title="总览暂时不可用" detail={error} />;
  if (!data) return <State title="正在读取学习状态…" />;
  const focus = data.coach?.focus;
  return (
    <>
      <Heading
        eyebrow="OVERVIEW"
        title={
          <>
            今天，继续把表达
            <br />
            <em>变成自己的。</em>
          </>
        }
        detail="你的学习证据正在形成。先完成一次短复测，再决定下一步。"
      />
      <section className="focus">
        <div>
          <span className="focus-label">
            <Icon name="coach" />
            当前关注
          </span>
          <h2>{focus?.error_type || "从真实表达开始"}</h2>
          <p>
            {focus
              ? `最近记录 ${focus.hits} 次，适合安排一次延迟复测。`
              : "还没有足够的稳定模式，先提交一句真实英文。"}
          </p>
          <a className="primary" href="#grammar">
            开始表达
            <Icon name="arrow" />
          </a>
        </div>
        <img
          className="focus-image"
          src="/images/study-desk.webp"
          alt=""
          width="960"
          height="640"
        />
      </section>
      <div className="columns">
        <Panel title="最近的表达" icon="grammar">
          {(data.recentActivity || []).slice(0, 5).map((item: any) => {
            const original = String(item.userInput || "");
            const correction = String(item.correction || "已记录");
            const isLong = original.length > 160 || correction.length > 160;
            return (
              <article className="activity activity-entry" key={item.entryId}>
                <time className="activity-time" dateTime={item.timestamp || undefined}>
                  {formatActivityTimestamp(item.timestamp)}
                </time>
                <div className="activity-copy">
                  <section className="activity-copy-section">
                    <span className="activity-label">原句</span>
                    <p className={isLong ? "activity-preview is-clamped" : "activity-preview"}>
                      {original}
                    </p>
                  </section>
                  <section className="activity-copy-section activity-correction">
                    <span className="activity-label">修正</span>
                    <p className={isLong ? "activity-preview is-clamped" : "activity-preview"}>
                      {correction}
                    </p>
                  </section>
                  {isLong && (
                    <details className="activity-full">
                      <summary>展开完整记录</summary>
                      <div className="activity-full-content">
                        <section>
                          <strong>原句</strong>
                          <p>{original}</p>
                        </section>
                        <section>
                          <strong>修正</strong>
                          <p>{correction}</p>
                        </section>
                      </div>
                    </details>
                  )}
                </div>
              </article>
            );
          })}
          {!data.recentActivity?.length && <State title="还没有 Review 记录" />}
        </Panel>
        <Panel title="学习节奏" icon="word-review">
          <div className="stat">
            {data.stats?.totalInputs || 0}
            <small> review entries</small>
          </div>
          <p>
            今日 {data.today?.inputs_today || 0} 条 · Vocabulary due{" "}
            {data.stats?.dueCounts?.vocab || 0}
          </p>
          <div className="daily-effort" aria-label="最近七天活动">
            <span className="eyebrow">最近 7 天</span>
            {(data.stats?.dailyEffort || [])
              .slice()
              .reverse()
              .map((item: any) => (
                <div className="effort-row" key={item.day}>
                  <small>{item.day.slice(5)}</small>
                  <div className="effort-track">
                    <span style={{ width: `${Math.min(100, item.count * 20)}%` }} />
                  </div>
                  <strong>{item.count}</strong>
                </div>
              ))}
          </div>
        </Panel>
      </div>
      <Panel title="核心资产" icon="handbook">
        <div className="asset-list">
          {[
            ["Review log", data.assets?.reviewLog],
            ["Vocabulary", data.assets?.vocabulary],
            ["Ask", data.assets?.ask],
            ["Practice", data.assets?.practice],
          ].map(([label, available]) => (
            <div className="asset-row" key={String(label)}>
              <span>{label}</span>
              <strong className={available ? "asset-ok" : "asset-missing"}>
                {available ? "可用" : "未找到"}
              </strong>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

function Grammar() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<any>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    setSaved("");
    try {
      setResult(await webApi.checkGrammar(text));
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const data = result?.result || result?.data;
    if (!data) return;
    setBusy(true);
    try {
      const response = await webApi.saveGrammar(text, data);
      setSaved(response.persistence?.saved ? "已保存到 Review log" : "Review log 未保存");
    } catch (e: any) {
      setSaved("保存失败：" + e.message);
    } finally {
      setBusy(false);
    }
  }

  const data = result?.result || result?.data;
  const diagnoses = (data?.diagnoses || []).map((item: any) =>
    typeof item === "string" ? item : item.explanation || item.message || JSON.stringify(item),
  );

  return (
    <div className="grammar-page">
      <Heading
        eyebrow="GRAMMAR CHECK"
        title="把一句话交给 IGT"
        detail="查看原句、修正和原因，再把值得记住的提示保存下来。"
      />
      <Panel title="你的英文表达" icon="grammar">
        <label className="form-label" htmlFor="grammar-input">
          你的英文表达
        </label>
        <textarea
          id="grammar-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例如：I suggested him to join the call."
        />
        <button className="primary" onClick={submit} disabled={busy}>
          {busy ? "检查中…" : "检查这句话 →"}
        </button>
      </Panel>
      {result?.error && <State title="检查失败" detail={result.error} />}
      {data && (
        <div className="correction-detail">
          <DetailSection variant="original" icon="document" title="Original">
            <p>{data.originalText || text}</p>
          </DetailSection>
          <DetailSection variant="correction" icon="check" title="Correction">
            <p>{data.correction || "暂无修正"}</p>
          </DetailSection>
          <DetailSection variant="natural" icon="spark" title="More natural">
            <p>{data.refine || "暂无更自然表达"}</p>
          </DetailSection>
          <DetailSection variant="why" icon="info" title="Why">
            {diagnoses.length ? (
              diagnoses.map((item: string, index: number) => <p key={index}>{item}</p>)
            ) : (
              <p>暂无诊断说明</p>
            )}
          </DetailSection>
          <DetailSection variant="remember" icon="idea" title="Remember">
            <p>{data.remember || "暂无记忆提示"}</p>
          </DetailSection>
          <div className="correction-actions">
            <button className="primary save-review" onClick={save} disabled={busy}>
              <Icon name="bookmark" />
              {busy ? "保存中…" : "保存到 Review log"}
            </button>
            {saved && (
              <p className="status" role="status">
                {saved}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function Translation() {
  const [text, setText] = useState("");
  const [direction, setDirection] = useState("zh2en");
  const [result, setResult] = useState<any>();
  const [busy, setBusy] = useState(false);
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
      <Heading
        eyebrow="TRANSLATION"
        title="把意思说得自然"
        detail="选择中英互译方向，输入句子并获取自然、贴合语境的译文。"
      />
      <Panel title="翻译输入" icon="translation">
        <div className="switches">
          <button
            className={direction === "zh2en" ? "selected" : ""}
            onClick={() => setDirection("zh2en")}
          >
            中 → 英
          </button>
          <button
            className={direction === "en2zh" ? "selected" : ""}
            onClick={() => setDirection("en2zh")}
          >
            英 → 中
          </button>
        </div>
        <label className="form-label" htmlFor="translation-input">
          输入要翻译的句子
        </label>
        <textarea
          id="translation-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="输入要翻译的句子…"
        />
        <button className="primary" onClick={submit} disabled={busy}>
          {busy ? "翻译中…" : "开始翻译 →"}
        </button>
      </Panel>
      {result?.error && <State title="翻译失败" detail={result.error} />}
      {translation && (
        <Panel title="翻译结果" icon="translation">
          <p className="translation-result">{translation}</p>
          {result.data?.notes && <p>{result.data.notes}</p>}
        </Panel>
      )}
    </>
  );
}
function Ask() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saved, setSaved] = useState("");
  async function send() {
    if (!question.trim()) return;
    const current = question.trim();
    setQuestion("");
    setBusy(true);
    try {
      const result = await webApi.ask(current, turns);
      setTurns((old) => [
        ...old,
        { question: current, answer: result.data?.answer || result.data },
      ]);
    } catch (e: any) {
      setTurns((old) => [...old, { question: current, answer: `请求失败：${e.message}` }]);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setSaved("正在保存 Ask Markdown…");
    setSaveBusy(true);
    try {
      const result = await webApi.saveAsk(turns);
      setSaved(result.saved ? "已保存到 Ask Markdown" : "当前没有可保存的咨询");
    } catch (e: any) {
      setSaved(`保存失败：${e.message}`);
    } finally {
      setSaveBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="ASK"
        title="把一个问题问到底"
        detail="提出语言问题并持续追问，探索用法、语气和表达差异。"
      />
      <Panel title="当前咨询" icon="ask">
        {turns.map((turn, index) => (
          <div className="ask-turn" key={`${turn.question}-${index}`}>
            <strong>{turn.question}</strong>
            <p>{turn.answer}</p>
          </div>
        ))}
        {!turns.length && <State title="还没有问题" detail="从一个具体的语言问题开始。" />}
        <label className="form-label" htmlFor="ask-input">
          你的问题
        </label>
        <textarea
          id="ask-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="继续追问…"
        />
        <button className="primary" onClick={send} disabled={busy}>
          {busy ? "思考中…" : "发送 →"}
        </button>
        <button className="secondary" onClick={save} disabled={saveBusy}>
          {saveBusy ? "保存中…" : "保存到 Ask Markdown"}
        </button>
        {saved && <p className="status">{saved}</p>}
      </Panel>
    </>
  );
}
function WordReview() {
  const [cards, setCards] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    webApi
      .getReviewDue()
      .then((data) => setCards(data.cards || []))
      .catch((e) => setError(e.message));
  }, []);
  async function grade(rating: string) {
    const card = cards[index];
    if (!card) return;
    try {
      await webApi.gradeReview(card.id, rating);
      setIndex((n) => n + 1);
      setRevealed(false);
    } catch (e: any) {
      setError(e.message);
    }
  }
  const card = cards[index];
  const details = card?.vocab_details;
  const examples = details?.examples?.length ? details.examples : [card?.example].filter(Boolean);
  return (
    <div className="word-review-page">
      <Heading
        eyebrow="VOCABULARY · SRS ONLY"
        title="词汇复习"
        detail="先根据中文提示回忆英文，再揭示答案并评分。"
      />
      {error && <State title="复习失败" detail={error} />}
      {!error && !card && (
        <Panel title="今日状态" icon="word-review" className="review-empty-state">
          <State
            title={cards.length ? "今日复习完成" : "没有到期卡片"}
            detail={
              cards.length
                ? `完成 ${cards.length} 张词汇卡。`
                : "稍后再来，或先从词汇 Markdown 添加内容。"
            }
          />
        </Panel>
      )}
      {card && (
        <Panel
          title={`今日第 ${index + 1} / ${cards.length} 张`}
          icon="word-review"
          className="review-card"
        >
          <div className="review-progress" aria-label={`第 ${index + 1} 张，共 ${cards.length} 张`}>
            <span style={{ width: `${((index + 1) / cards.length) * 100}%` }} />
          </div>
          {!revealed ? (
            <div className="review-prompt">
              <span className="review-kicker">先回忆英文单词</span>
              <h2>{card.zh || "回忆这个英文表达"}</h2>
              <p>{card.meaning || "根据中文提示回忆，再揭示完整词卡。"}</p>
              <div className="review-prompt-actions">
                <AudioButton text={card.word || card.answer} reviewPrompt />
                <button className="primary" onClick={() => setRevealed(true)}>
                  显示完整词卡
                  <span className="review-cta-icon" aria-hidden="true">
                    <Icon name="arrow" />
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <WordDetails
                entry={{
                  word: card.word || card.answer,
                  pos: card.pos || details?.pos,
                  phonetic: details?.phonetic || details?.phonetics,
                  meaning: card.meaning,
                  zh: card.zh,
                  synonyms: details?.synonyms,
                  collocations: details?.collocations,
                  note: details?.note || card.note,
                }}
                examples={examples}
              />
              <div className="review-actions">
                <button onClick={() => grade("again")}>
                  <span>Again</span>
                  <small>未想起</small>
                </button>
                <button onClick={() => grade("hard")}>
                  <span>Hard</span>
                  <small>费力想起</small>
                </button>
                <button onClick={() => grade("good")}>
                  <span>Good</span>
                  <small>正常想起</small>
                </button>
                <button onClick={() => grade("easy")}>
                  <span>Easy</span>
                  <small>轻松想起</small>
                </button>
              </div>
            </>
          )}
        </Panel>
      )}
    </div>
  );
}
function Coach() {
  const [data, setData] = useState<any>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load(refresh = false) {
    setBusy(true);
    setError("");
    try {
      setData(await (refresh ? webApi.analyzeCoach() : webApi.getCoach()));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="coach-page">
      <div className="coach-header">
        <Heading
          eyebrow="COACH · EVIDENCE"
          title="根据学习证据，安排下一步"
          detail="查看样本、练习重点与证据限制，决定接下来要练什么。"
        />
        <button className="secondary" onClick={() => load(true)} disabled={busy}>
          {busy ? "分析中…" : "重新分析资产"}
        </button>
      </div>
      {error && <State title="Coach 暂时不可用" detail={error} />}
      {!data && !error && <State title="正在分析学习证据…" />}
      {data && (
        <>
          <Panel title="分析样本" className="coach-sample">
            <dl className="coach-sample-grid">
              <div><dt>表达记录</dt><dd>{data.sample?.totalInputs || 0}<span>条输入</span></dd></div>
              <div><dt>语法诊断</dt><dd>{data.sample?.totalDiagnoses || 0}<span>条诊断</span></dd></div>
              <div><dt>观察窗口</dt><dd>{data.windowDays ?? "—"}<span>天</span></dd></div>
            </dl>
          </Panel>
          {(data.priorities || []).length > 0 ? (
            <Panel title="优先练习重点" className="coach-priorities">
              {(data.priorities || []).map((item: any) => (
                <article className="coach-priority" key={item.errorType}>
                  <h3>{item.errorType}</h3>
                  {item.mechanism?.statement && <p className="coach-mechanism">{item.mechanism.statement}</p>}
                  <ol className="coach-tasks">
                    {item.prescription?.slice(0, 2).map((phase: any) => (
                      <li key={phase.phase}>
                        <strong>{phase.name}</strong>
                        {phase.task && <p>{phase.task}</p>}
                        {phase.check && <p className="coach-check"><span>检查方式</span>{phase.check}</p>}
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </Panel>
          ) : (
            <Panel title="当前暂无线索" className="coach-empty-priorities">
              <p>现有样本还不足以确定优先练习重点。继续记录真实表达与诊断后，再查看新的分析。</p>
            </Panel>
          )}
          <Panel title="证据限制" className="coach-limitations">
            {data.limitations?.length ? (
              <ul>{data.limitations.map((item: string) => <li key={item}>{item}</li>)}</ul>
            ) : <p>当前分析没有返回额外限制说明。</p>}
          </Panel>
        </>
      )}
    </div>
  );
}
function WordLookup() {
  const [query, setQuery] = useState("");
  const [entry, setEntry] = useState<any>();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function lookup() {
    if (!query.trim()) return;
    setBusy(true);
    setStatus("");
    try {
      const result = await webApi.lookupWord(query.trim());
      setEntry(result.data);
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function add() {
    try {
      const result = await webApi.addWord(entry);
      setStatus(result.persistence?.saved ? "已保存到 Vocabulary Markdown" : "这个词已经存在");
    } catch (e: any) {
      setStatus(e.message);
    }
  }
  const examples = [entry?.example || entry?.example1, entry?.example2, entry?.example3].filter(
    Boolean,
  );
  return (
    <div className="word-page">
      <Heading
        eyebrow="WORD LOOKUP"
        title="查一个词，也把它留下"
        detail="查询结果可以保存到 Vocabulary Markdown，并进入词汇复习。"
      />
      <Panel title="查询单词或短语" icon="word-lookup" className="lookup-form">
        <label className="form-label" htmlFor="word-lookup-input">
          查询单词或短语
        </label>
        <div className="lookup-row">
          <input
            id="word-lookup-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="例如：consolidate"
          />
          <button className="primary" onClick={lookup} disabled={busy}>
            {busy ? (
              "查询中…"
            ) : (
              <>
                查询
                <Icon name="arrow" />
              </>
            )}
          </button>
        </div>
      </Panel>
      {entry && (
        <Panel title={entry.word} icon="word-lookup" className="lookup-result">
          <WordDetails entry={entry} examples={examples} />
          <button className="primary" onClick={add}>
            <Icon name="handbook" />
            加入词汇资产
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

function WordDetails({ entry, examples }: { entry: any; examples: string[] }) {
  return (
    <div className="word-details">
      <div className="word-heading">
        <div>
          <div className="word-heading-meta">
            {entry.pos && <span className="word-pos">{entry.pos}</span>}
            {entry.phonetic && <span className="word-phonetic">{entry.phonetic}</span>}
          </div>
          <h3>{entry.word}</h3>
        </div>
        <AudioButton text={entry.word} />
      </div>
      {entry.meaning && (
        <section className="word-detail-block word-meaning">
          <div className="word-detail-icon">
            <Icon name="handbook" />
          </div>
          <div>
            <h4>Meaning</h4>
            <p>{entry.meaning}</p>
          </div>
        </section>
      )}
      <div className="word-detail-pair">
        {entry.zh && (
          <section className="word-detail-block word-translation">
            <div className="word-detail-icon">
              <Icon name="translation" />
            </div>
            <div>
              <h4>中文</h4>
              <p>{entry.zh}</p>
            </div>
          </section>
        )}
        {entry.synonyms && (
          <section className="word-detail-block word-synonyms">
            <div className="word-detail-icon">
              <Icon name="idea" />
            </div>
            <div>
              <h4>Synonyms</h4>
              <p>{entry.synonyms}</p>
            </div>
          </section>
        )}
      </div>
      {entry.collocations && (
        <section className="word-detail-block word-collocations">
          <div className="word-detail-icon">
            <Icon name="grammar" />
          </div>
          <div>
            <h4>Collocations</h4>
            <p>{entry.collocations}</p>
          </div>
        </section>
      )}
      {examples.length > 0 && (
        <section className="word-detail-block word-examples">
          <div className="word-detail-icon">
            <Icon name="ask" />
          </div>
          <div className="word-examples-content">
            <h4>Examples</h4>
            <ol>
              {examples.map((example, index) => (
                <li key={index}>
                  <span className="example-number">{index + 1}</span>
                  <span className="example-copy">
                    <span className="example-text">{example}</span>
                    <AudioButton text={example} small />
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
      {entry.note && (
        <section className="word-detail-block word-note">
          <div className="word-detail-icon">
            <Icon name="idea" />
          </div>
          <div>
            <h4>Note</h4>
            <p>{entry.note}</p>
          </div>
        </section>
      )}
    </div>
  );
}
function Practice() {
  const [mode, setMode] = useState("sentence");
  const [count, setCount] = useState(3);
  const [questions, setQuestions] = useState<any[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<any>();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setEvaluation(undefined);
    try {
      const result = await webApi.generatePractice(mode, count);
      setQuestions(result.data?.questions || []);
      setIndex(0);
      setAnswer("");
    } catch (e: any) {
      setEvaluation({ error: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function evaluate() {
    const question = questions[index];
    if (!question || !answer.trim()) return;
    setBusy(true);
    try {
      const result = await webApi.evaluatePractice(question, answer);
      setEvaluation(result.data);
    } catch (e: any) {
      setEvaluation({ error: e.message });
    } finally {
      setBusy(false);
    }
  }

  const question = questions[index];
  const prompt = question?.kind === "choice" ? question.question : question?.prompt_zh;
  const modeHint: Record<string, string> = {
    word: "选词填空练习：填入目标单词，补全句子",
    sentence: "造句写作练习：使用选定词汇，在全新语境下自主造句",
    choice: "阅读理解选择题：根据短文选择最佳答案",
  };
  const modeName: Record<string, string> = {
    word: "选词填空",
    sentence: "造句",
    choice: "阅读理解选择题",
  };

  return (
    <>
      <Heading
        eyebrow="PRACTICE"
        title="在新语境里自己写出来"
        detail="选择练习类型和题目数量，在新语境中回忆词汇并练习表达。"
      />
      {!question && (
        <Panel title="开始一次练习" icon="practice" className="practice-setup">
          <div className="practice-field">
            <span className="practice-field-label">练习类型</span>
            <div className="switches" role="group" aria-label="Practice 模式">
              <button
                className={mode === "word" ? "selected" : ""}
                aria-pressed={mode === "word"}
                onClick={() => setMode("word")}
              >
                Word
              </button>
              <button
                className={mode === "sentence" ? "selected" : ""}
                aria-pressed={mode === "sentence"}
                onClick={() => setMode("sentence")}
              >
                Sentence
              </button>
              <button
                className={mode === "choice" ? "selected" : ""}
                aria-pressed={mode === "choice"}
                onClick={() => setMode("choice")}
              >
                Choice
              </button>
            </div>
            <p className="practice-mode-hint">
              <Icon name="info" />
              {modeHint[mode]}
            </p>
          </div>
          <fieldset className="question-count">
            <legend>题目数量</legend>
            <div className="count-options">
              {[3, 5, 10].map((value) => (
                <label className={count === value ? "selected" : ""} key={value}>
                  <input
                    type="radio"
                    name="practice-count"
                    value={value}
                    checked={count === value}
                    onChange={() => setCount(value)}
                  />
                  <span>{value}</span>
                  <span>题</span>
                </label>
              ))}
            </div>
          </fieldset>
          <State title={"准备生成 " + count + " 道" + modeName[mode] + "练习"} />
          <button
            className="primary practice-generate"
            onClick={generate}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? (
              <>
                <span className="loading-spinner" aria-hidden="true" />
                生成中…
              </>
            ) : (
              <>
                生成练习
                <Icon name="arrow" />
              </>
            )}
          </button>
        </Panel>
      )}
      {question && (
        <Panel
          title={"第 " + (index + 1) + " / " + questions.length + " 题"}
          icon="practice"
          className="practice-question"
        >
          <div
            className="practice-progress"
            aria-label={"第 " + (index + 1) + " 题，共 " + questions.length + " 题"}
          >
            <span style={{ width: ((index + 1) / questions.length) * 100 + "%" }} />
          </div>
          <div className="practice-prompt">
            <span className="review-kicker">
              {question.kind === "choice" ? "CHOICE" : mode.toUpperCase()}
            </span>
            <h2>{prompt}</h2>
            <p>{question.focus || question.explanation || "完成这道练习。"}</p>
          </div>
          {question.kind === "choice" ? (
            <div className="practice-options" role="group" aria-label="选择答案">
              {(question.options || []).map((option: string, optionIndex: number) => (
                <button
                  className={answer === option ? "selected" : ""}
                  aria-pressed={answer === option}
                  key={option}
                  onClick={() => setAnswer(option)}
                >
                  <span className="option-marker">{String.fromCharCode(65 + optionIndex)}</span>
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <>
              <label className="form-label" htmlFor="practice-input">
                你的英文答案
              </label>
              <textarea
                id="practice-input"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="写出你的英文答案…"
              />
            </>
          )}
          <button className="primary" onClick={evaluate} disabled={busy || !answer.trim()}>
            {busy ? (
              "评价中…"
            ) : (
              <>
                提交评价
                <Icon name="arrow" />
              </>
            )}
          </button>
          {evaluation?.error && <State title="这道题暂时无法评价" detail={evaluation.error} />}
          {evaluation && !evaluation.error && (
            <PracticeEvaluation
              evaluation={evaluation}
              answer={answer}
              nextLabel={index + 1 < questions.length ? "下一题" : "完成本轮"}
              onNext={() => {
                setIndex((n) => n + 1);
                setAnswer("");
                setEvaluation(undefined);
              }}
            />
          )}
        </Panel>
      )}
    </>
  );
}

const practiceVerdicts: Record<string, string> = {
  excellent: "表达准确自然",
  good: "整体表达准确",
  needs_work: "还有提升空间",
  incorrect: "需要重新梳理",
};

function PracticeEvaluation({
  evaluation,
  answer,
  nextLabel,
  onNext,
}: {
  evaluation: any;
  answer: string;
  nextLabel: string;
  onNext: () => void;
}) {
  const strengths = Array.isArray(evaluation.strengths_zh)
    ? evaluation.strengths_zh.filter(Boolean)
    : [];
  const improvements = Array.isArray(evaluation.improvements_zh)
    ? evaluation.improvements_zh.filter(Boolean)
    : [];
  const score = Number.isFinite(Number(evaluation.score))
    ? Math.max(0, Math.min(100, Number(evaluation.score)))
    : undefined;
  const verdict = practiceVerdicts[evaluation.verdict] || "本题反馈";
  return (
    <section className="evaluation" aria-live="polite" aria-label="练习评价结果">
      <div className="evaluation-summary">
        {score !== undefined && (
          <div className="evaluation-score">
            <strong>{score}</strong>
            <span>分</span>
          </div>
        )}
        <div>
          <span className="evaluation-phase-label">本题反馈</span>
          <h3>{verdict}</h3>
          <p>{evaluation.feedback_zh || "请对照修订表达，检查语义和语法。"}</p>
        </div>
      </div>
      <div className="evaluation-phases">
        <section className="evaluation-phase">
          <span className="phase-index">01</span>
          <div>
            <h4>你的答案</h4>
            <p>{answer}</p>
          </div>
        </section>
        <section className="evaluation-phase evaluation-correction">
          <span className="phase-index">02</span>
          <div>
            <h4>参考修订</h4>
            <p>{evaluation.corrected_answer || "暂无修订建议"}</p>
          </div>
        </section>
        {(strengths.length > 0 || improvements.length > 0) && (
          <section className="evaluation-phase evaluation-notes">
            <span className="phase-index">03</span>
            <div className="evaluation-notes-grid">
              {strengths.length > 0 && (
                <div>
                  <h4>做得好的地方</h4>
                  <ul>
                    {strengths.map((item: string, index: number) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {improvements.length > 0 && (
                <div>
                  <h4>下一步可调整</h4>
                  <ul>
                    {improvements.map((item: string, index: number) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
      <button className="secondary evaluation-next" onClick={onNext}>
        {nextLabel}
        <Icon name="arrow" />
      </button>
    </section>
  );
}

function Handbook() {
  const [data, setData] = useState<any>();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingSelection, setLoadingSelection] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const value = await webApi.getHandbook();
      setData(value);
      setSelected(value.selected || "");
    } catch {
      setError("Handbook 暂时无法读取，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { load(); }, []);
  async function choose(value: string) {
    if (value === selected || loadingSelection) return;
    setError("");
    setLoadingSelection(true);
    try {
      const nextData = await webApi.getHandbook(value);
      setData(nextData);
      setSelected(nextData.selected || "");
    } catch {
      setError("分类暂时无法切换，请稍后重试。");
    } finally {
      setLoadingSelection(false);
    }
  }
  const hasFrequencies = Boolean(data?.frequencies?.length);
  return (
    <div className="handbook-page">
      <div className="coach-header">
        <Heading
          eyebrow="HANDBOOK · REFERENCE"
          title="从真实错误找到解释"
          detail="查看过往表达中的错误类型、修正与记忆提示。"
        />
        <button className="secondary" onClick={load} disabled={busy || loadingSelection}>
          {busy ? "读取中…" : "重新读取"}
        </button>
      </div>
      {!data && (busy ? (
        <State title="正在读取 Handbook…" />
      ) : error ? (
        <Panel title="暂时无法读取">
          <div className="handbook-empty">
            <State title="学习资料暂时没有加载成功" detail={error} />
            <button className="primary" onClick={load}>重试</button>
          </div>
        </Panel>
      ) : null)}
      {data && (
        <>
          <Panel title="记录概况" className="coach-sample">
            <dl className="coach-sample-grid">
              <div><dt>表达记录</dt><dd>{data.stats?.total_inputs || 0}<span>条输入</span></dd></div>
              <div><dt>语法诊断</dt><dd>{data.stats?.total_diagnoses || 0}<span>条诊断</span></dd></div>
              <div><dt>观察窗口</dt><dd>{data.days ?? "—"}<span>天</span></dd></div>
            </dl>
          </Panel>
          {hasFrequencies ? (
            <>
              <div className="handbook-list" aria-label="按错误类型筛选">
                {data.frequencies.map((item: any) => (
                  <button
                    className={selected === item.error_type ? "selected" : ""}
                    key={item.error_type}
                    onClick={() => choose(item.error_type)}
                    aria-pressed={selected === item.error_type}
                    disabled={loadingSelection}
                  >
                    {item.error_type}<span>{item.count}</span>
                  </button>
                ))}
              </div>
              {error && <State title="分类暂时无法切换" detail={error} />}
              <Panel title={selected}>
                {loadingSelection ? <State title="正在读取实例…" /> : data.examples?.length ? (
                  data.examples.map((item: any, index: number) => (
                    <article className="activity handbook-example" key={`${item.original_text}-${index}`}>
                      <div><span>原句</span><p>{item.original_text}</p></div>
                      <div><span>修正</span><p>{item.correction}</p></div>
                      {item.refine && <div><span>更自然的表达</span><p>{item.refine}</p></div>}
                      {item.explanation && <div><span>原因</span><p>{item.explanation}</p></div>}
                      {item.remember && <div><span>记忆提示</span><p>{item.remember}</p></div>}
                    </article>
                  ))
                ) : (
                  <div className="handbook-empty"><State title="这个分类还没有可展示的实例" detail="可以继续记录新的英文表达，累积更多可参考的例子。" /></div>
                )}
              </Panel>
            </>
          ) : (
            <Panel title="当前暂无线索" className="coach-empty-priorities">
              <div className="handbook-empty">
                <p>最近 {data.days} 天还没有可展示的错误诊断。记录真实表达并完成语法检查后，相关修正和解释会整理在这里。</p>
                <a className="primary" href="#grammar">开始一次语法检查<Icon name="arrow" /></a>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
function Placeholder({ title }: { title: string }) {
  return (
    <>
      <Heading
        eyebrow="WORKSPACE"
        title={title}
        detail="页面骨架已就绪，正在接入对应的真实工作流。"
      />
      <Panel title="Local Web 工作区" icon="handbook">
        <State title="Application API 已准备" detail="下一步将接入该工作区的页面交互和状态流。" />
      </Panel>
    </>
  );
}

const providerNames: Record<string, string> = {
  gemini: "Google Gemini",
  qwen: "通义千问",
  deepseek: "DeepSeek",
  ollama: "Ollama 本地模型",
};

function LlmSettings() {
  const [data, setData] = useState<any>();
  const [activeProvider, setActiveProvider] = useState("gemini");
  const [editProvider, setEditProvider] = useState("gemini");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [clearApiKeys, setClearApiKeys] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    webApi.getLlmSettings().then((settings) => {
      if (!settings?.providers || !settings?.provider) {
        throw new Error("模型设置接口尚未加载。请重启 Local Web Runtime 后重试。");
      }
      setData(settings);
      setActiveProvider(settings.provider);
      setEditProvider(settings.provider);
    }).catch((e: any) => setError(e.message || "无法读取模型设置"));
  }, []);

  const providerSettings = data?.providers?.[editProvider];
  const updateModel = (role: "flash" | "pro", value: string) => {
    setData((old: any) => ({ ...old, providers: { ...old.providers, [editProvider]: { ...old.providers[editProvider], models: { ...old.providers[editProvider].models, [role]: value } } } }));
  };
  const updateBaseUrl = (value: string) => {
    setData((old: any) => ({ ...old, providers: { ...old.providers, [editProvider]: { ...old.providers[editProvider], baseUrl: value } } }));
  };

  async function save() {
    if (!data) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const saved = await webApi.saveLlmSettings({
        provider: activeProvider,
        apiKeys,
        clearApiKeys,
        models: Object.fromEntries(Object.entries(data.providers).map(([name, value]: [string, any]) => [name, value.models])),
        baseUrls: {
          OllamaBaseUrl: data.providers.ollama.baseUrl,
          QwenApiBase: data.providers.qwen.baseUrl,
          DeepseekApiBase: data.providers.deepseek.baseUrl,
        },
      });
      setData((old: any) => ({ ...old, provider: saved.provider, providers: saved.providers }));
      setApiKeys({});
      setClearApiKeys({});
      setStatus("模型设置已保存并生效。未填写的密钥保持原样。");
    } catch (e: any) {
      setError(e.message || "保存模型设置失败");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <State title="模型设置暂时不可用" detail={error} />;
  if (!data) return <State title="正在读取模型设置…" />;

  return (
    <div className="llm-settings">
      <div className="heading">
        <h1>模型设置</h1>
        <p>选择 IGT 使用的服务，分别配置快速任务与复杂任务所用模型。</p>
      </div>
      <Panel title="当前服务" icon="settings">
        <div className="settings-grid">
          <div className="settings-field">
            <label className="form-label" htmlFor="llm-active-provider">用于 IGT 请求</label>
            <select id="llm-active-provider" value={activeProvider} onChange={(e) => setActiveProvider(e.target.value)}>
              {Object.entries(providerNames).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
            </select>
            <small>保存后，语法、翻译、练习和 Ask 等请求将使用此服务。</small>
          </div>
          <div className="settings-field">
            <label className="form-label" htmlFor="llm-edit-provider">编辑服务配置</label>
            <select id="llm-edit-provider" value={editProvider} onChange={(e) => setEditProvider(e.target.value)}>
              {Object.entries(providerNames).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
            </select>
            <small>服务配置分别保存；更改密钥或模型后点击下方保存。</small>
          </div>
        </div>
        {editProvider !== "ollama" && (
          <div className="settings-field settings-key-field">
            <label className="form-label" htmlFor="llm-api-key">{providerNames[editProvider]} API key</label>
            <input
              id="llm-api-key"
              type="password"
              autoComplete="new-password"
              disabled={Boolean(clearApiKeys[editProvider])}
              value={apiKeys[editProvider] || ""}
              onChange={(e) => setApiKeys((old) => ({ ...old, [editProvider]: e.target.value }))}
              placeholder={providerSettings?.keyConfigured ? `已配置 ${providerSettings.keyMasked} · 输入新密钥以替换` : "粘贴 API key"}
            />
            <small>密钥保存在本机 .env 文件中，不会再次显示。留空会保留现有密钥。</small>
            {providerSettings?.keyConfigured && <label className="settings-check"><input type="checkbox" checked={Boolean(clearApiKeys[editProvider])} onChange={(e) => setClearApiKeys((old) => ({ ...old, [editProvider]: e.target.checked }))} /> 保存时移除此服务的密钥</label>}
          </div>
        )}
        <div className="settings-field settings-models">
          <span className="form-label">任务模型</span>
          <div className="settings-grid">
            <label className="settings-field" htmlFor="llm-flash-model">
              <span className="form-label">Flash · 快速任务</span>
              <input id="llm-flash-model" value={providerSettings?.models?.flash || ""} onChange={(e) => updateModel("flash", e.target.value)} />
              <small>语法检查、翻译与 Ask</small>
            </label>
            <label className="settings-field" htmlFor="llm-pro-model">
              <span className="form-label">Pro · 复杂任务</span>
              <input id="llm-pro-model" value={providerSettings?.models?.pro || ""} onChange={(e) => updateModel("pro", e.target.value)} />
              <small>Handbook、Coach 与文本分析</small>
            </label>
          </div>
        </div>
        {editProvider !== "gemini" && (
          <div className="settings-field settings-endpoint">
            <label className="form-label" htmlFor="llm-endpoint">{editProvider === "ollama" ? "Ollama 服务地址" : `${providerNames[editProvider]} API 地址`}</label>
            <input id="llm-endpoint" type="url" value={providerSettings?.baseUrl || ""} onChange={(e) => updateBaseUrl(e.target.value)} />
            <small>{editProvider === "ollama" ? "本机 Ollama OpenAI 接口地址" : "兼容 OpenAI API 的服务入口"}</small>
          </div>
        )}
      </Panel>
      {error && <State title="保存失败" detail={error} />}
      {status && <p className="settings-status" role="status">{status}</p>}
      <button className="primary" disabled={busy} onClick={save}>{busy ? "保存中…" : "保存模型设置"}</button>
    </div>
  );
}

function Heading({ eyebrow, title, detail }: { eyebrow: string; title: React.ReactNode; detail: string }) {
  return (
    <div className="heading">
      <span className="heading-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{detail}</p>
    </div>
  );
}
function Panel({
  title,
  children,
  icon,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ComponentProps<typeof Icon>["name"];
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        {icon && <Icon name={icon} />}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}
function State({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="state">
      <strong>{title}</strong>
      {detail && <p>{detail}</p>}
    </div>
  );
}
function AudioButton({
  text,
  small,
  reviewPrompt = false,
}: {
  text: string;
  small?: boolean;
  reviewPrompt?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | undefined>(undefined);
  const releaseAudio = (audio: HTMLAudioElement) => {
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    if (audio.src.startsWith("blob:")) URL.revokeObjectURL(audio.src);
    audio.removeAttribute("src");
    if (audioRef.current === audio) audioRef.current = undefined;
  };
  useEffect(
    () => () => {
      if (audioRef.current) releaseAudio(audioRef.current);
    },
    [],
  );
  function playBrowserSpeech() {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      return Promise.reject(new Error("浏览器系统语音不可用"));
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    return new Promise<void>((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error("浏览器系统语音播放失败"));
      window.speechSynthesis.speak(utterance);
    });
  }
  async function fallbackToBrowserSpeech(message: string) {
    try {
      await playBrowserSpeech();
    } catch (fallbackError: any) {
      setError(`${message}；${fallbackError.message || "浏览器语音不可用"}`);
    } finally {
      setBusy(false);
    }
  }
  async function play() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const audio = await webApi.speakWord(text);
      audioRef.current = audio;
      audio.onended = () => {
        const tooShort =
          Number.isFinite(audio.duration) && audio.duration > 0 && audio.duration < 0.2;
        releaseAudio(audio);
        if (tooShort) void fallbackToBrowserSpeech("TTS 返回了空音频");
        else setBusy(false);
      };
      audio.onerror = () => {
        releaseAudio(audio);
        void fallbackToBrowserSpeech("浏览器无法解码 TTS 音频");
      };
      await audio.play();
    } catch (e: any) {
      if (audioRef.current) releaseAudio(audioRef.current);
      await fallbackToBrowserSpeech(e.message || "TTS 播放失败");
    }
  }
  if (!text) return null;
  return (
    <span className="audio-control">
      <button
        type="button"
        className={`audio-btn${small ? " audio-btn-sm" : ""}${error ? " audio-err" : ""}`}
        onClick={play}
        disabled={busy}
        aria-label={busy ? "播放中…" : reviewPrompt ? "听取英文单词发音" : `朗读: ${text}`}
        title={error || "朗读"}
      >
        <Icon name="volume" />
      </button>
      {error && (
        <span className="audio-error" role="status" aria-live="polite">
          播放失败：{error}
        </span>
      )}
    </span>
  );
}

export function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [route, setRoute] = useState<Route>((location.hash.slice(1) || "dashboard") as Route);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    语言工具: true,
    练习工作台: true,
    Ask: true,
    学习系统: true,
  });
  useEffect(() => {
    const onHash = () => {
      if (location.hash === "#main-content") return;
      setRoute((location.hash.slice(1) || "dashboard") as Route);
      setMenuOpen(false);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  const title = items.find(([key]) => key === route)?.[1] || "总览";
  const page =
    route === "dashboard" ? (
      <Dashboard />
    ) : route === "grammar" ? (
      <Grammar />
    ) : route === "translation" ? (
      <Translation />
    ) : route === "ask" ? (
      <Ask />
    ) : route === "word-review" ? (
      <WordReview />
    ) : route === "coach" ? (
      <Coach />
    ) : route === "word-lookup" ? (
      <WordLookup />
    ) : route === "practice" ? (
      <Practice />
    ) : route === "handbook" ? (
      <Handbook />
    ) : route === "settings" ? (
      <LlmSettings />
    ) : (
      <Placeholder title={title} />
    );
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        跳到主内容
      </a>
      <aside>
        <div className="sidebar-top">
          <a className="brand" href="#dashboard">
            <Icon name="handbook" />
            IGT
          </a>
          <button
            className="menu-toggle"
            aria-label={menuOpen ? "收起导航" : "展开导航"}
            aria-expanded={menuOpen}
            aria-controls="workspace-nav"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? "close" : "menu"} />
            <span>导航</span>
          </button>
        </div>
        <nav
          id="workspace-nav"
          aria-label="学习工作台"
          className={menuOpen ? "workspace-nav is-open" : "workspace-nav"}
        >
          <span className="side-label">学习工作台</span>
          <button
            className={`nav ${route === "dashboard" ? "active" : ""}`}
            aria-current={route === "dashboard" ? "page" : undefined}
            onClick={() => {
              location.hash = "dashboard";
              setMenuOpen(false);
            }}
          >
            <Icon name="dashboard" />
            总览
          </button>
          {groups.map(([group, groupItems]) => {
            const active = groupItems.some(([key]) => route === key);
            return (
              <section className="nav-group" key={group}>
                <button
                  className={`group-label ${active ? "active" : ""}`}
                  aria-expanded={openGroups[group]}
                  onClick={() => setOpenGroups((old) => ({ ...old, [group]: !old[group] }))}
                >
                  <span>{group}</span>
                  <Icon name="chevron" />
                </button>
                {openGroups[group] &&
                  groupItems.map(([key, label]) => (
                    <button
                      className={`nav nav-child ${route === key ? "active" : ""}`}
                      key={key}
                      aria-current={route === key ? "page" : undefined}
                      onClick={() => {
                        location.hash = key;
                        setMenuOpen(false);
                      }}
                    >
                      <Icon name={key} />
                      <span>{label}</span>
                    </button>
                  ))}
              </section>
            );
          })}
          <button
            className={`nav ${route === "settings" ? "active" : ""}`}
            aria-current={route === "settings" ? "page" : undefined}
            onClick={() => { location.hash = "settings"; setMenuOpen(false); }}
          >
            <Icon name="settings" />
            <span>模型设置</span>
          </button>
        </nav>
      </aside>
      <main id="main-content" tabIndex={-1}>
        <header>
          <span className="breadcrumb">
            IGT <span>/</span> <strong>{title}</strong>
          </span>
        </header>
        {page}
      </main>
    </div>
  );
}

function DetailSection({
  variant,
  icon,
  title,
  children,
}: {
  variant: string;
  icon: React.ComponentProps<typeof Icon>["name"];
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={"detail-section detail-" + variant}
      aria-labelledby={"detail-" + variant + "-title"}
    >
      <span className="detail-icon">
        <Icon name={icon} />
      </span>
      <div className="detail-content">
        <h2 id={"detail-" + variant + "-title"}>{title}</h2>
        <div className="detail-copy">{children}</div>
      </div>
    </section>
  );
}
