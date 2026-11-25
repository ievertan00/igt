import React, { useEffect, useState } from "react";
import { api } from "../api";
import { errorMessage, go, useApp, useRefresh, useResource } from "../core";
import {
  Badge, Busy, Button, Card, Chip, Empty, ErrorNote, Icon, IconButton, Input,
  ListRow, Progress, RichText, SectionTitle, Sheet, Skeleton, relativeTime,
} from "../ui";

/* ------------------------------------------------------------------- hub -- */
export function MeScreen() {
  const { t, lang } = useApp();
  const { data, loading, error, stale, reload } = useResource<any>("me.v1", async (signal) => {
    const [dash, growth, runtime] = await Promise.all([
      api.dashboard({ days: 30, limit: 5 }, signal),
      api.growth({ days: 30 }, signal).catch(() => null),
      api.runtime().catch(() => null),
    ]);
    return { dash, growth, runtime };
  }, [], { dash: null, growth: null, runtime: null });
  useRefresh(reload);

  const dash = data.dash || {};
  const momentum = dash.effort?.momentum || {};
  const inventory = data.growth?.inventory || {};
  const events = dash.events || [];

  return <div className="stack">
    {stale && <div className="stale-note"><Icon name="offline" size={16} />{t("离线，显示缓存数据", "Offline — cached data")}</div>}
    {error && !stale && <ErrorNote message={error} onRetry={reload} retryLabel={t("重试", "Retry")} />}

    <Card className="card--hero">
      <div className="hero-stat">
        <div><div className="big-number">{momentum.current ?? "–"}</div>
          <div style={{ fontWeight: 650 }}>{t("近 30 天记录", "records in 30 days")}</div></div>
        <span className="hero-icon">
          <Icon name="chart" size={23} />
        </span>
      </div>
      {momentum.percent != null && <p className="card-note">
        {momentum.percent >= 0 ? "+" : ""}{momentum.percent}% {t("相比上一个周期", "vs. previous period")}
      </p>}
    </Card>

    <div className="metric-grid metric-grid--3">
      <div className="metric"><strong>{inventory.words ?? "–"}</strong><span>{t("词条", "Words")}</span></div>
      <div className="metric"><strong>{inventory.grammar ?? "–"}</strong><span>{t("语法记录", "Checks")}</span></div>
      <div className="metric"><strong>{inventory.notes ?? "–"}</strong><span>{t("笔记", "Notes")}</span></div>
    </div>

    <div>
      <SectionTitle title={t("学习资料", "Your material")} kicker={t("全部入口", "LIBRARY")} />
      <ListRow icon="chart" title={t("学习概览", "Learning overview")} sub={t("趋势、指标与优先项", "Trends, metrics and priorities")}
        onClick={() => go("/me/overview")} tone="primary" />
      <ListRow icon="book" title={t("语法手册", "Grammar check log")} sub={t("按类型回看每次纠错", "Browse saved corrections")}
        onClick={() => go("/me/handbook")} tone="primary" />
      <ListRow icon="sparkles" title={t("学习教练", "Learning coach")} sub={t("反复出现问题的解释与练习", "Explanations for recurring mistakes")}
        onClick={() => go("/me/coach")} tone="accent" />
      <ListRow icon="note" title={t("收藏笔记", "Saved notes")} sub={t("问答保存的 Markdown", "Markdown from Ask")}
        onClick={() => go("/me/notes")} tone="success" />
      <ListRow icon="settings" title={t("设置与连接", "Settings & connection")} sub={t("语言、主题、模型", "Language, theme, model")}
        onClick={() => go("/settings")} />
    </div>

    <div>
      <SectionTitle title={t("最近记录", "Recent records")} />
      {loading && !data.dash ? <Card><Skeleton lines={3} /></Card> : events.length === 0 ?
        <Empty icon="list" title={t("暂无记录", "No records")} /> :
        events.slice(0, 4).map((event: any, index: number) => <div key={index} className="list-row" style={{ cursor: "default" }}>
          <span className="list-row-icon"><Icon name="note" size={18} /></span>
          <span className="list-row-text"><strong>{event.title}</strong><small>{relativeTime(event.timestamp, lang)}</small></span>
        </div>)}
    </div>

    <Card className="card--tint"><p style={{ margin: 0, fontSize: 13 }}>
      {t("纠错成功、当次答对与自评分数都只是单次证据，界面不会把它们当作长期掌握。",
        "A correction, one correct answer or a self-rating is a single observation — never proof of durable mastery.")}
    </p></Card>
    <div className="hero-space" />
  </div>;
}

/* --------------------------------------------------------------- overview -- */
export function OverviewScreen() {
  const { t, lang } = useApp();
  const [days, setDays] = useState(30);
  const { data, loading, error, stale, reload } = useResource<any>(`me.overview.v1.${days}`, async (signal) => {
    const [growth, dash] = await Promise.all([
      api.growth({ days }, signal),
      api.dashboard({ days, limit: 10 }, signal),
    ]);
    return { growth, dash };
  }, [days], { growth: null, dash: null });
  useRefresh(reload);

  const growth = data.growth || {};
  const metrics = growth.metrics || {};
  const retention = growth.retention || { distribution: {}, total: 0 };
  const distribution = retention.distribution || {};
  const categories: Array<{ category: string; count: number }> = growth.categories || [];
  const priorities: Array<{ type: string; count: number; distinct: number }> = growth.priorities || [];
  const events = data.dash?.events || [];
  const maxCategory = Math.max(1, ...categories.map((item) => item.count));

  return <div className="stack">
    <div className="chip-row">
      {[7, 30, 90].map((value) => <Chip key={value} selected={days === value} onClick={() => setDays(value)}>
        {value} {t("天", "days")}
      </Chip>)}
    </div>
    {stale && <div className="stale-note"><Icon name="offline" size={16} />{t("离线，显示缓存数据", "Offline — cached data")}</div>}
    {error && !stale && <ErrorNote message={error} onRetry={reload} retryLabel={t("重试", "Retry")} />}
    {loading && !data.growth ? <Card><Skeleton lines={5} /></Card> : <>
      <div>
        <SectionTitle title={t("表现快照", "Performance snapshot")} kicker={t("本次时段", "CURRENT PERIOD")} />
        <div className="metric-grid">
          <Metric label={t("词汇回忆率", "Recall rate")} value={metrics.recall?.value} suffix="%" />
          <Metric label={t("翻译平均分", "Translation score")} value={metrics.translation?.value} suffix="" />
          <Metric label={t("有诊断占比", "Diagnosed share")} value={metrics.diagnosed?.n ? Math.round((metrics.diagnosed.count / metrics.diagnosed.n) * 100) : null} suffix="%" />
          <Metric label={t("期内记录", "Records")} value={growth.total} suffix="" />
        </div>
      </div>

      <Card>
        <p className="card-kicker">{t("词汇状态分布", "WORD RETENTION")}</p>
        {Object.keys(distribution).length === 0 ? <p className="card-note">{t("暂无词汇状态数据", "No retention data yet")}</p> :
          Object.entries(distribution).map(([status, count]) => <div key={status} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>{status}</span><strong>{String(count)}</strong>
            </div>
            <Progress value={retention.total ? (Number(count) / retention.total) * 100 : 0} />
          </div>)}
      </Card>

      <Card>
        <p className="card-kicker">{t("问题分布", "ERROR DISTRIBUTION")}</p>
        {categories.length === 0 ? <p className="card-note">{t("本时段没有标记的问题", "No flagged issues in this period")}</p> :
          categories.slice(0, 6).map((item) => <div key={item.category} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>{item.category}</span><strong>{item.count}</strong>
            </div>
            <Progress value={(item.count / maxCategory) * 100} tone="accent" />
          </div>)}
      </Card>

      <div>
        <SectionTitle title={t("优先关注", "Top priorities")} kicker={`${Math.min(3, priorities.length)} / 3`} />
        {priorities.length === 0 ? <Empty icon="check" title={t("暂无需要优先处理的问题", "No priorities yet")} /> :
          priorities.slice(0, 3).map((item, index) => <Card key={item.type} className={index === 0 ? "card--tint" : ""} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span className="brand-mark" style={{ width: 30, height: 30, fontSize: 13, fontWeight: 700 }}>{index + 1}</span>
              <div style={{ flex: 1 }}><strong className="break">{item.type}</strong>
                <p className="card-note">{item.count} {t("次", "records")} · {item.distinct} {t("种输入", "distinct inputs")}</p></div>
              <IconButton name="target" label={t("针对练习", "Practice this")} tone="soft"
                onClick={() => go(`/practice?targetErrorType=${encodeURIComponent(item.type)}`)} />
            </div>
          </Card>)}
      </div>

      <div>
        <SectionTitle title={t("最近活动", "Recent activity")} />
        {events.length === 0 ? <Empty icon="list" title={t("暂无记录", "No records")} /> :
          events.slice(0, 8).map((event: any, index: number) => <div key={index} className="list-row" style={{ cursor: "default" }}>
            <span className="list-row-icon"><Icon name="note" size={18} /></span>
            <span className="list-row-text"><strong>{event.title}</strong><small>{relativeTime(event.timestamp, lang)}</small></span>
            {event.score != null && <Badge tone="primary">{event.score}</Badge>}
          </div>)}
      </div>
    </>}
    <div className="hero-space" />
  </div>;
}

function Metric({ label, value, suffix }: { label: string; value: number | null | undefined; suffix: string }) {
  return <div className="metric"><strong>{value == null ? "–" : `${Math.round(Number(value))}${suffix}`}</strong><span>{label}</span></div>;
}

/* --------------------------------------------------------------- handbook -- */
export function HandbookScreen() {
  const { t, lang, toast } = useApp();
  const [search, setSearch] = useState("");
  const [errorType, setErrorType] = useState("");
  const [diagnosis, setDiagnosis] = useState("all");
  const [detail, setDetail] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const { data, loading, error, stale, reload } = useResource<any>(
    `me.handbook.v1.${search}.${errorType}.${diagnosis}`,
    (signal) => api.handbook({ days: 90, search, errorType, diagnosis, limit: 20 }, signal),
    [search, errorType, diagnosis],
    { entries: [], categories: [], pagination: {}, coverage: {} },
  );
  useRefresh(reload);
  useEffect(() => {
    const timer = setTimeout(() => reload(), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const entries: any[] = data.entries || [];
  const categories: Array<{ errorType: string; checks: number }> = data.categories || [];

  async function remove() {
    if (!confirmDelete) return;
    try {
      await api.deleteHandbookCheck(confirmDelete.entryId);
      setConfirmDelete(null);
      setDetail(null);
      toast(t("记录已删除", "Record deleted"));
      reload();
    } catch (reason) { toast(errorMessage(reason), "err"); }
  }

  return <div className="stack">
    <Card>
      <Input value={search} onChange={setSearch} icon="search" placeholder={t("搜索原文或说明", "Search original text or notes")} />
      <div className="chip-row" style={{ marginTop: 10 }}>
        {[["all", t("全部", "All")], ["with", t("有诊断", "With diagnosis")], ["none", t("无诊断", "No diagnosis")]].map(([value, label]) =>
          <Chip key={value} selected={diagnosis === value} onClick={() => setDiagnosis(value)}>{label}</Chip>)}
      </div>
    </Card>
    {categories.length > 0 && <div className="chip-row">
      <Chip selected={errorType === ""} onClick={() => setErrorType("")}>{t("所有类型", "All types")}</Chip>
      {categories.slice(0, 8).map((item) => <Chip key={item.errorType} selected={errorType === item.errorType}
        onClick={() => setErrorType(item.errorType)}>{item.errorType} · {item.checks}</Chip>)}
    </div>}
    {stale && <div className="stale-note"><Icon name="offline" size={16} />{t("离线，显示缓存记录", "Offline — cached log")}</div>}
    {error && !stale && <ErrorNote message={error} onRetry={reload} retryLabel={t("重试", "Retry")} />}

    {loading && entries.length === 0 ? <Card><Skeleton lines={4} /></Card> : entries.length === 0 ?
      <Empty icon="book" title={t("没有符合条件的记录", "No matching records")}
        hint={t("在写作页保存一次纠错后，记录会出现在这里。", "Save a correction in Writing to see it here.")} /> :
      entries.map((entry) => <Card key={entry.entryId} padded>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span className="muted tiny">{relativeTime(entry.timestamp, lang)}</span>
          <IconButton name="forward" label={t("查看详情", "Details")} onClick={() => setDetail(entry)} size={18} />
        </div>
        <p className="card-kicker" style={{ marginTop: 8 }}>{t("原文", "ORIGINAL")}</p>
        <p style={{ margin: 0, color: "var(--muted)" }} className="break">{entry.userInput}</p>
        {entry.correction && <><p className="card-kicker" style={{ marginTop: 10 }}>{t("修正", "CORRECTED")}</p>
          <p style={{ margin: 0, fontWeight: 650 }} className="break">{entry.correction}</p></>}
        {entry.refine && <div className="diagnosis" style={{ marginTop: 10 }}>
          <strong>{t("更自然的说法", "More natural")}</strong><p style={{ margin: 0 }}>{entry.refine}</p>
        </div>}
        {Array.isArray(entry.diagnoses) && entry.diagnoses.length > 0 && <div className="chip-row" style={{ marginTop: 10 }}>
          {entry.diagnoses.slice(0, 3).map((item: any, index: number) =>
            <Chip key={index}>{item.error_type}</Chip>)}
        </div>}
      </Card>)}

    <Sheet open={Boolean(detail)} onClose={() => setDetail(null)} title={t("记录详情", "Record details")}
      footer={<><Button variant="secondary" icon="target" onClick={() => {
        const type = detail?.diagnoses?.[0]?.error_type;
        go(type ? `/practice?targetErrorType=${encodeURIComponent(type)}` : "/practice");
      }}>{t("针对练习", "Practice")}</Button>
        <Button variant="danger" icon="trash" onClick={() => setConfirmDelete(detail)}>{t("删除", "Delete")}</Button></>}>
      {detail && <>
        <p className="muted tiny">{relativeTime(detail.timestamp, lang)}</p>
        <p className="eyebrow">{t("原文", "ORIGINAL")}</p><p className="break">{detail.userInput}</p>
        {detail.correction && <><p className="eyebrow">{t("修正", "CORRECTED")}</p><p className="break">{detail.correction}</p></>}
        {detail.refine && <><p className="eyebrow">{t("更自然", "MORE NATURAL")}</p><p className="break">{detail.refine}</p></>}
        {detail.evaluate && <><p className="eyebrow">{t("评价", "FEEDBACK")}</p><RichText text={detail.evaluate} /></>}
        {Array.isArray(detail.diagnoses) && detail.diagnoses.map((item: any, index: number) => <div key={index} className="diagnosis" style={{ marginBottom: 8 }}>
          <strong>{item.error_type}</strong><p>{item.explanation || item.suggestion || ""}</p>
        </div>)}
      </>}
    </Sheet>

    <Sheet open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} title={t("删除这条记录？", "Delete this record?")}
      footer={<><Button variant="secondary" onClick={() => setConfirmDelete(null)}>{t("取消", "Cancel")}</Button>
        <Button variant="danger" onClick={remove}>{t("确认删除", "Delete")}</Button></>}>
      <p>{t("删除后这条语法检查记录将不再出现在手册与统计中。", "This saved check will no longer appear in the handbook or statistics.")}</p>
    </Sheet>
    <div className="hero-space" />
  </div>;
}

/* ------------------------------------------------------------------ coach -- */
export function CoachScreen() {
  const { t, lang, toast } = useApp();
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { data, loading, error, stale, reload } = useResource<any>("me.coach.v1", async (signal) => {
    const [patterns, reports] = await Promise.all([
      api.coach(90, signal),
      api.coachReports().catch(() => []),
    ]);
    return { patterns, reports };
  }, [], { patterns: null, reports: [] });
  useRefresh(reload);

  const patterns: any[] = data.patterns?.patterns || [];
  const reports: any[] = Array.isArray(data.reports) ? data.reports : [];

  async function open(pattern: any) {
    setLoadingDetail(true);
    try {
      const response = await api.explainCoach(pattern.errorType, data.patterns?.days || 90, pattern.version || "");
      setDetail({ ...response, errorType: pattern.errorType });
    } catch (reason) { toast(errorMessage(reason), "err"); }
    finally { setLoadingDetail(false); }
  }

  async function generateReport() {
    setGenerating(true);
    try {
      await api.generateCoachReport(90, lang === "zh" ? "zh-CN" : "en");
      toast(t("报告已生成", "Report generated"));
      reload();
    } catch (reason) { toast(errorMessage(reason), "err"); }
    finally { setGenerating(false); }
  }

  return <div className="stack">
    <Card className="card--tint">
      <p className="card-kicker">{t("近 90 天的检查", "CHECKS IN 90 DAYS")}</p>
      <div className="big-number">{data.patterns?.checks ?? "–"}</div>
      <p className="card-note">{t("教练只解释反复出现的错误类型，不把单次记录当成结论。",
        "The coach explains recurring patterns; a single record is never a conclusion.")}</p>
    </Card>
    {stale && <div className="stale-note"><Icon name="offline" size={16} />{t("离线，显示缓存数据", "Offline — cached data")}</div>}
    {error && !stale && <ErrorNote message={error} onRetry={reload} retryLabel={t("重试", "Retry")} />}

    <div>
      <SectionTitle title={t("反复出现的问题", "Recurring patterns")} kicker={`${patterns.length}`} />
      {loading && !data.patterns ? <Card><Skeleton lines={3} /></Card> : patterns.length === 0 ?
        <Empty icon="sparkles" title={t("还没有反复出现的问题", "No recurring patterns yet")}
          hint={t("保存更多写作检查后，教练会开始归纳。", "Save more writing checks for the coach to find patterns.")} />
        : patterns.map((pattern) => <ListRow key={pattern.errorType} icon="sparkles" tone="accent"
          title={pattern.errorType} sub={`${pattern.priorityArea} · ${pattern.checks} ${t("次", "checks")} · ${pattern.observations} ${t("条观察", "observations")}`}
          onClick={() => open(pattern)} right={<Icon name="forward" size={18} />} />)}
      {loadingDetail && <Busy label={t("正在生成解释…", "Generating explanation…")} />}
    </div>

    <div>
      <SectionTitle title={t("学习报告", "Saved reports")} kicker={`${reports.length}`}
        action={t("生成报告", "Generate")} onAction={generateReport} />
      {generating && <Busy label={t("正在汇总记录…", "Compiling records…")} />}
      {reports.length === 0 ? <p className="muted tiny">{t("暂无已保存的报告", "No saved reports yet")}</p> :
        reports.slice(0, 6).map((report) => <div key={report.savedId} className="list-row" style={{ cursor: "default" }}>
          <span className="list-row-icon"><Icon name="chart" size={18} /></span>
          <span className="list-row-text"><strong>{relativeTime(report.generatedAt, lang)}</strong>
            <small>{report.days} {t("天", "days")} · {report.totalChecks} {t("条检查", "checks")}</small></span>
        </div>)}
    </div>

    <Sheet open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.errorType || t("解释", "Explanation")}>
      {detail && <>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {detail.cached && <Badge tone="primary">{t("缓存", "Cached")}</Badge>}
          {detail.sampled && <Badge tone="warning">{t("抽样", "Sampled")}</Badge>}
        </div>
        <p className="eyebrow">{t("观察到的模式", "OBSERVED PATTERN")}</p><RichText text={detail.explanation?.observedPattern || ""} />
        <p className="eyebrow">{t("原则", "PRINCIPLE")}</p><RichText text={detail.explanation?.principle || ""} />
        <p className="eyebrow">{t("关键结构", "KEY STRUCTURE")}</p><RichText text={detail.explanation?.keyStructure || ""} />
        <p className="eyebrow">{t("适用条件", "QUALIFICATIONS")}</p><RichText text={detail.explanation?.qualifications || ""} />
        {detail.explanation?.drills?.phase1_selfCorrect?.length > 0 && <>
          <p className="eyebrow">{t("自我纠正练习", "SELF-CORRECTION DRILLS")}</p>
          {detail.explanation.drills.phase1_selfCorrect.map((drill: any, index: number) => <div key={index} className="diagnosis" style={{ marginBottom: 8 }}>
            <strong>{drill.incorrect}</strong><p>{drill.hint} → {drill.answer}</p>
          </div>)}
        </>}
        {Array.isArray(detail.evidence) && detail.evidence.length > 0 && <>
          <p className="eyebrow">{t("证据记录", "EVIDENCE")}</p>
          {detail.evidence.slice(0, 5).map((item: any, index: number) => <div key={index} className="kv">
            <strong>{relativeTime(item.timestamp, lang)}</strong><span>{item.original} {item.correction ? `→ ${item.correction}` : ""}</span>
          </div>)}
        </>}
      </>}
    </Sheet>
    <div className="hero-space" />
  </div>;
}

/* ------------------------------------------------------------------ notes -- */
export function NotesScreen() {
  const { t, lang, toast } = useApp();
  const [note, setNote] = useState<any>(null);
  const { data, loading, error, stale, reload } = useResource<any>("me.notes.v1", () => api.listAskNotes(), [], { notes: [] });
  useRefresh(reload);
  const notes: any[] = data.notes || [];

  async function open(item: any) {
    try {
      const detail = item.content ? item : await api.readAskNote(item.id);
      setNote({ ...item, content: detail?.content || "" });
    } catch (reason) { toast(errorMessage(reason), "err"); }
  }

  return <div className="stack">
    <p className="eyebrow">{t("问答保存的 Markdown 笔记", "MARKDOWN NOTES FROM ASK")}</p>
    {stale && <div className="stale-note"><Icon name="offline" size={16} />{t("离线，显示缓存笔记", "Offline — cached notes")}</div>}
    {error && !stale && <ErrorNote message={error} onRetry={reload} retryLabel={t("重试", "Retry")} />}
    {loading && notes.length === 0 ? <Busy /> : notes.length === 0 ?
      <Empty icon="note" title={t("还没有收藏的问答", "No saved notes yet")}
        action={t("去提问", "Ask a question")} onAction={() => go("/ask")} /> :
      notes.map((item) => <button key={item.id} type="button" className="list-row" onClick={() => open(item)}>
        <span className="list-row-icon list-row-icon--accent"><Icon name="note" size={20} /></span>
        <span className="list-row-text"><strong>{item.title || item.id.replace(/\.md$/, "")}</strong>
          <small>{item.category || "—"} · {relativeTime(item.modifiedAt, lang)}</small></span>
        <Icon name="forward" size={18} />
      </button>)}

    <Sheet open={Boolean(note)} onClose={() => setNote(null)} title={note?.title || note?.id || ""}
      footer={<Button variant="danger" icon="trash" block onClick={async () => {
        try { await api.deleteAskNote(note.id); setNote(null); toast(t("已删除笔记", "Note deleted")); reload(); }
        catch (reason) { toast(errorMessage(reason), "err"); }
      }}>{t("删除笔记", "Delete note")}</Button>}>
      {note && <RichText text={String(note.content || "").replace(/^---[\s\S]*?---\n/, "")} />}
    </Sheet>
    <div className="hero-space" />
  </div>;
}
