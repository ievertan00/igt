import React from "react";
import { api } from "../api";
import { go, useApp, useRefresh, useResource } from "../core";
import { Badge, Busy, Button, Card, Empty, Icon, SectionTitle, relativeTime } from "../ui";

type HomeData = { dash: any; dueCount: number; status: any };
const EMPTY: HomeData = { dash: null, dueCount: 0, status: null };

const EVENT_ICON: Record<string, string> = {
  grammar: "pen", practice: "target", vocabulary: "book", ask: "sparkles",
  review: "layers", text: "note", writing: "pen",
};

export function HomeScreen() {
  const { t, lang, toast } = useApp();
  const { data, loading, error, stale, reload } = useResource<HomeData>("home.v1", async (signal) => {
    const [dash, due, status] = await Promise.all([
      api.dashboard({ days: 14, limit: 8 }, signal),
      api.reviewDue(100, signal),
      api.statusMessage().catch(() => ({ content: "" })),
    ]);
    return { dash, dueCount: Array.isArray(due?.cards) ? due.cards.length : 0, status };
  }, [], EMPTY);
  useRefresh(reload);

  const dash = data.dash || {};
  const summary: Array<{ type: string; label: string; count: number }> = dash.summary || [];
  const total = (type: string) => summary.find((item) => item.type === type)?.count ?? 0;
  const daily: Array<{ date: string; count: number }> = dash.effort?.daily || [];
  const last7 = daily.slice(-7);
  const max = Math.max(1, ...last7.map((item) => item.count));
  const events: Array<{ source: string; id: string; type: string; timestamp: string; title: string; score?: number; href?: string | null }> = dash.events || [];

  return <div className="stack">
    {stale && <div className="stale-note"><Icon name="offline" size={16} />
      {t("暂时无法连接电脑端，下面是上次缓存的数据。", "Offline — showing your last saved learning data.")}
    </div>}
    {error && !stale && <div className="error-note"><Icon name="alert" size={18} /><span>{error}</span>
      <button type="button" onClick={reload}>{t("重试", "Retry")}</button></div>}

    <Card className="card--hero">
      <p className="card-kicker">{t("今日计划", "TODAY'S FOCUS")}</p>
      <div className="hero-stat">
        <div>
          <div className="big-number">{loading && !data.dash ? "–" : data.dueCount}</div>
          <div className="strong">{t("个单词待复习", "words due for review")}</div>
        </div>
        <span className="hero-icon">
          <Icon name="layers" size={24} />
        </span>
      </div>
      <p className="card-note">{data.dueCount > 0
        ? t("先回忆，再核对，一次只专注一张卡。", "Recall first, then check — one card at a time.")
        : t("今天的复习已清空，可以练一句或查个词。", "All caught up. Try a sentence or look up a word.")}</p>
      <div className="hero-action">
        <Button variant="secondary" icon="play" onClick={() => go("/review")}>
          {t("开始复习", "Start review")}
        </Button>
      </div>
    </Card>

    <div>
      <SectionTitle title={t("快捷开始", "Quick start")} />
      <div className="quick-grid">
        <button type="button" className="quick-tile" onClick={() => go("/write")}>
          <span className="tile-icon"><Icon name="pen" size={19} /></span>
          <strong>{t("写一句", "Check a sentence")}</strong>
          <small>{t("语法与表达", "Grammar & expression")}</small>
        </button>
        <button type="button" className="quick-tile" onClick={() => go("/words?tab=lookup")}>
          <span className="tile-icon"><Icon name="search" size={19} /></span>
          <strong>{t("查个词", "Look up a word")}</strong>
          <small>{t("释义与例句", "Meaning & examples")}</small>
        </button>
        <button type="button" className="quick-tile" onClick={() => go("/practice")}>
          <span className="tile-icon"><Icon name="target" size={19} /></span>
          <strong>{t("练一句", "Translate a sentence")}</strong>
          <small>{t("中译英练习", "Sentence practice")}</small>
        </button>
        <button type="button" className="quick-tile" onClick={() => go("/ask")}>
          <span className="tile-icon"><Icon name="sparkles" size={19} /></span>
          <strong>{t("问一句", "Ask a question")}</strong>
          <small>{t("随时追问", "Follow-up & notes")}</small>
        </button>
      </div>
    </div>

    <div>
      <SectionTitle title={t("最近 7 天", "Last 7 days")} />
      <Card>
        <div className="activity-bars">
          {(last7.length ? last7 : Array.from({ length: 7 }, (_, i) => ({ date: String(i), count: 0 }))).map((item, index) =>
            <span key={index} className={index === (last7.length || 7) - 1 ? "is-today" : ""}
              style={{ height: `${Math.max(6, (item.count / max) * 100)}%` }}
              title={`${item.date}: ${item.count}`} />)}
        </div>
        <p className="card-note">{t("按天统计的学习记录条数，仅代表记录，不代表掌握程度。", "Recorded learning events per day — records, not proof of mastery.")}</p>
      </Card>
    </div>

    <div>
      <SectionTitle title={t("记录概览", "Records")} action={t("查看全部", "View all")} onAction={() => go("/me/overview")} />
      <div className="metric-grid metric-grid--3">
        <div className="metric"><strong>{total("grammar") + total("text") + total("writing")}</strong><span>{t("写作检查", "Writing checks")}</span></div>
        <div className="metric"><strong>{total("practice")}</strong><span>{t("练习记录", "Practice")}</span></div>
        <div className="metric"><strong>{total("vocabulary")}</strong><span>{t("词汇记录", "Vocabulary")}</span></div>
      </div>
    </div>

    {data.status?.content && <Card className="card--tint">
      <div style={{ display: "flex", gap: 10 }}>
        <Icon name="bulb" size={20} />
        <div><p className="card-kicker">{t("今日一句", "A NOTE FOR TODAY")}</p>
          <p style={{ margin: 0, fontSize: 14 }}>{data.status.content}</p></div>
      </div>
    </Card>}

    <div>
      <SectionTitle title={t("最近活动", "Recent activity")} action={t("学习概览", "Overview")} onAction={() => go("/me/overview")} />
      {loading && !data.dash ? <Busy /> : events.length === 0 ?
        <Empty icon="list" title={t("还没有学习记录", "No records yet")} hint={t("写一句或练一句后，这里会出现记录。", "Check a sentence or start a practice to see records here.")} />
        : events.slice(0, 6).map((event, index) => <button key={`${event.id}-${index}`} type="button" className="list-row"
          onClick={() => event.href ? go(String(event.href).replace(/^#/, "")) : go("/me/overview")}>
          <span className="list-row-icon list-row-icon--primary"><Icon name={EVENT_ICON[event.source] || "note"} size={19} /></span>
          <span className="list-row-text"><strong className="break">{event.title}</strong>
            <small>{relativeTime(event.timestamp, lang)}{event.score != null ? ` · ${event.score}` : ""}</small></span>
          {event.score != null ? <Badge tone="primary">{event.score}</Badge> : <Icon name="forward" size={18} />}
        </button>)}
    </div>

    <Card className="connection-card">
      <div className="result-line">
        <span className="result-label">{t("连接", "LINK")}</span>
        <div className="result-text" style={{ fontSize: 13.5 }}>
          {t("界面与数据来自电脑上的 Local Runtime，学习记录与桌面端共用。",
            "This app talks to the Local Runtime on your computer. Learning records are shared with the desktop workspace.")}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Button variant="soft" icon="refresh" onClick={() => { reload(); toast(t("已刷新", "Refreshed")); }}>
          {t("刷新数据", "Refresh")}
        </Button>
        <Button variant="secondary" icon="settings" onClick={() => go("/settings")}>{t("设置", "Settings")}</Button>
      </div>
    </Card>
    <div className="hero-space" />
  </div>;
}
