import { useEffect, useRef, useState, type ReactNode } from 'react';
import { webApi } from './api/client';
import type { GrowthDetail, GrowthError, GrowthFilters, GrowthOverview, GrowthPoint, GrowthRecord, GrowthRecords } from './api/learning-growth';
import { Icon } from './Icon';
import { Markdown } from './Markdown';
import { State } from './Page';
import { useLearningCopy } from './LearningCopy';
import { asText, object, markdownBody } from './LearningPresentation';
import './LearningDashboard.css';

type Query = Partial<GrowthFilters> & { days?: number };
type RecordQuery = Query & { group?: string; diagnosis?: string; offset?: number; limit?: number };
type DrawerRequest = { title: string; options?: RecordQuery; key?: string };
type Translate = (value: string) => string;
const DAY = 86400000;
const day = (time: number) => new Date(time + 8 * 3600000).toISOString().slice(0, 10);
const pct = (n: number | null | undefined) => n == null ? '—' : `${n.toFixed(1)}%`;
const number = (n: number | null | undefined) => n == null ? '—' : n.toLocaleString();
const statusLabels: Record<string, string> = { new: 'New', learning: 'Learning', 'needs-reinforcement': 'Needs reinforcement', retained: 'Retained', 'well-retained': 'Well retained', 'insufficient-history': 'Insufficient history', unavailable: 'Status unavailable' };
const moduleLabels: Record<string, string> = { all: 'All modules', grammar: 'Grammar checks', text: 'Text analysis', review: 'Vocabulary review', practice: 'Chinese → English', vocabulary: 'Saved words', ask: 'Ask notes', coach: 'Learning reports', unclassified: 'Learning record', 'practice-log': 'Practice log', 'practice-choice': 'Choice practice', 'practice-word': 'Word practice', 'practice-expression': 'Expression practice' };
const metricLabels: Record<string, string> = { recall: 'Unaided word recall', score: 'Translation score', errors: 'Saved diagnosis share', effort: 'Recorded sentence work' };
const ratingLabels: Record<string, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' };
const kindIcons = { word: 'bookmark', grammar: 'grammar', note: 'ask', report: 'document', practice: 'practice', review: 'word-review', 'practice-log': 'document' } as const;
const time = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' }).format(new Date(value)) : '';
const date = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'Asia/Shanghai' }).format(new Date(`${value}T00:00:00+08:00`)) : '';
const recordTitle = (record: GrowthRecord, t: Translate) => asText(record.title) || t('Learning record');

function initialQuery(): Query {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  let stored: Query = {};
  try { stored = JSON.parse(sessionStorage.getItem('clearwrite-overview-filters') || '{}'); } catch { /* A fresh session uses the default window. */ }
  const query: Query = { days: 30, module: 'all', category: 'all', errorType: 'all', status: 'all', ...stored };
  for (const key of ['start', 'end'] as const) if (params.has(key)) query[key] = params.get(key)!;
  if (params.has('days')) { query.days = Number(params.get('days')); if (!params.has('start')) { delete query.start; delete query.end; } }
  return { ...query, module: 'all', category: 'all', errorType: 'all', status: 'all' };
}

function SectionTitle({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="growth-section-title"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>;
}
function Delta({ current, previous, unit = 'pp' }: { current: number | null; previous: number | null; unit?: string }) {
  if (current === null || previous === null) return <span className="growth-delta is-unknown">—</span>;
  const difference = current - previous;
  const direction = difference > 0 ? 'is-up' : difference < 0 ? 'is-down' : 'is-flat';
  return <span className={`growth-delta ${direction}`}>{difference > 0 ? '+' : ''}{difference.toFixed(unit === 'records' ? 0 : 1)} {unit}</span>;
}

function EvidenceRows({ records, onSelect, t }: { records: GrowthRecord[]; onSelect: (key: string) => void; t: Translate }) {
  return <div className="growth-activity-list">{records.map(record => <button type="button" className="growth-activity-row" key={record.key} onClick={() => onSelect(record.key)}>
    <span className="growth-activity-icon"><Icon name={kindIcons[record.kind as keyof typeof kindIcons] || 'document'} /></span>
    <span className="growth-activity-copy"><strong>{recordTitle(record, t)}</strong><small>{t(moduleLabels[record.module] || 'Learning record')}{record.kind === 'review' && <> · {t(record.correct === true ? 'Correct recall' : record.correct === false ? 'Needs another look' : 'Outcome unknown')}</>}</small></span>
    <time dateTime={record.timestamp || undefined}>{time(record.timestamp) || t('Date unavailable')}</time><Icon name="arrow" />
  </button>)}</div>;
}

function TrendChart({ current, previous, compare, countMetric, title, onPoint, t }: {
  current: GrowthPoint[]; previous: GrowthPoint[]; compare: boolean; countMetric: boolean; title: string;
  onPoint: (point: GrowthPoint) => void; t: Translate;
}) {
  if (![...current, ...(compare ? previous : [])].some(p => p.value !== null)) return <State title={t('No observations in this period.')} detail={t('Expand the time range or adjust your filters. Missing observations are left blank.')} />;
  const width = 680, height = 238, left = 39, right = 14, top = 18, bottom = 31;
  const max = countMetric ? Math.max(4, Math.ceil(Math.max(0, ...current.map(p => p.value || 0), ...(compare ? previous : []).map(p => p.value || 0)) / 4) * 4) : 100;
  const x = (i: number) => current.length <= 1 ? (width + left - right) / 2 : left + i / (current.length - 1) * (width - left - right);
  const y = (value: number) => top + (1 - value / max) * (height - top - bottom);
  function line(points: GrowthPoint[], previousLine = false) {
    let open = false;
    const path = points.map((p, i) => { if (p.value === null) { open = false; return ''; } const command = open ? 'L' : 'M'; open = true; return `${command}${x(i)},${y(p.value)}`; }).join(' ');
    return <g className={previousLine ? 'growth-series is-previous' : 'growth-series'}><path d={path} />{points.map((p, i) => p.value === null ? null : <g key={p.start} role="button" tabIndex={0} aria-label={`${p.start} – ${p.end}: ${p.value.toFixed(1)}, n=${p.denominator}`} onClick={() => onPoint(p)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPoint(p); } }}><title>{p.start} – {p.end}: {p.value.toFixed(1)} · n={p.denominator}</title><circle className="growth-point-hit" cx={x(i)} cy={y(p.value)} r="12" /><circle cx={x(i)} cy={y(p.value)} r="4" /></g>)}</g>;
  }
  return <svg className="growth-chart" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={title}>
    <g aria-hidden="true">{[0, 1, 2, 3, 4].map(i => { const value = max * i / 4; return <g key={i}><line x1={left} y1={y(value)} x2={width - right} y2={y(value)} /><text x={left - 10} y={y(value) + 4} textAnchor="end">{value}</text></g>; })}
      {current.map((point, i) => i === 0 || i === current.length - 1 || i % Math.ceil(current.length / 5) === 0 ? <text key={point.start} x={x(i)} y={height - 4} textAnchor="middle">{point.start.slice(5).replace('-', '/')}</text> : null)}</g>
    {compare && line(previous, true)}{line(current)}
    <desc>{t('Select a point to inspect its saved records. Values and observation counts are included in each point label.')}</desc>
  </svg>;
}

export function Dashboard() {
  const { t, language } = useLearningCopy();
  // The opening window is fixed for the page; only the trend panel owns a movable period.
  const [query] = useState<Query>(initialQuery);
  const [data, setData] = useState<GrowthOverview>();
  const [busy, setBusy] = useState(true), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  const [trendQuery, setTrendQuery] = useState<Query>(() => ({ days: query.days, start: query.start, end: query.end }));
  const [trend, setTrend] = useState<GrowthOverview>();
  const [trendBusy, setTrendBusy] = useState(true), [trendError, setTrendError] = useState(''), [trendRefresh, setTrendRefresh] = useState(0);
  const [metric, setMetric] = useState('recall');
  const compare = true;
  const [trendDraftStart, setTrendDraftStart] = useState(query.start || day(Date.now() - 29 * DAY));
  const [trendDraftEnd, setTrendDraftEnd] = useState(query.end || day(Date.now()));
  const [dateError, setDateError] = useState('');
  const [drawer, setDrawer] = useState<DrawerRequest | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setBusy(true); setError('');
    void webApi.getLearningGrowth(query, controller.signal).then(result => {
      if (!active) return;
      setData(result);
    }, () => { if (active) setError('The records could not be loaded.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; controller.abort(); };
  }, [query, refresh]);
  // A second, panel-scoped request keeps the chart's period from re-labelling any other figure on the page.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setTrendBusy(true); setTrendError('');
    void webApi.getLearningGrowth({ ...query, ...trendQuery }, controller.signal).then(result => {
      if (!active) return;
      setTrend(result);
      setTrendDraftStart(result.filters.start); setTrendDraftEnd(result.filters.end);
    }, () => { if (active) setTrendError('The records could not be loaded.'); })
      .finally(() => { if (active) setTrendBusy(false); });
    return () => { active = false; controller.abort(); };
  }, [query, trendQuery, trendRefresh, refresh]);
  useEffect(() => {
    try { sessionStorage.setItem('clearwrite-overview-filters', JSON.stringify(query)); } catch { /* Filtering still works without session storage. */ }
    const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
    if (location.hash.split('?')[0] === '#dashboard') history.replaceState(history.state, '', `#dashboard?${params}`);
  }, [query]);

  const filters = data?.filters;
  function open(request: DrawerRequest) { opener.current = document.activeElement as HTMLElement; setDrawer(request); }
  function close() { setDrawer(null); requestAnimationFrame(() => opener.current?.isConnected && opener.current.focus({ preventScroll: true })); }
  function list(title: string, extra: RecordQuery = {}) { if (filters) open({ title, options: { ...filters, ...extra } }); }
  function errorList(row: GrowthError) { list(row.type, { category: 'all', errorType: row.type, group: 'grammar' }); }
  function preset(days: number) { setDateError(''); setTrendQuery(q => ({ ...q, days, start: undefined, end: undefined })); }
  const unavailable = data?.coverage.filter(source => source.status !== 'available') || [];
  const isAvailable = (source: string) => !data?.coverage.some(item => item.source === source && item.status !== 'available');
  const series = trend?.series[metric];
  function pointRecords(point: GrowthPoint) { list(`${point.start} – ${point.end} · ${t(metricLabels[metric])}`, {
    start: point.start, end: point.end, group: metric === 'recall' ? 'recall' : metric === 'score' ? 'practice' : metric === 'errors' ? 'grammar' : 'effort',
  }); }
  const diagnosis = data ? (() => {
    const patterns = data.diagnosis.patterns;
    const names = patterns.map(row => `${row.type} (${row.count} ${language === 'zh-CN' ? '条记录' : 'records'}, ${row.distinct} ${language === 'zh-CN' ? '个不同输入' : 'distinct inputs'})`).join(language === 'zh-CN' ? '、' : ' and ');
    const observations = patterns.length ? language === 'zh-CN' ? `${names} 在保存的诊断中较突出。可关注这些规则在不同语境中的适用条件，并核对修正是否保留原意。` : `${names} stand out in your saved feedback. Pay attention to how these choices work in different contexts, and check that corrections preserve your meaning.`
      : language === 'zh-CN' ? '当前记录不足以确认反复出现的具体错误模式。可先核对原句和修正理由。' : 'The current records do not establish a recurring concrete error pattern. Start by checking the original expressions and correction reasons.';
    return <><p>{observations}</p>{data.metrics.recall.n > 0 && <p>{language === 'zh-CN' ? '无音频提示的回忆正确率' : 'Recall without a recorded audio hint'}: {pct(data.metrics.recall.value)} ({data.metrics.recall.correct}/{data.metrics.recall.n}).</p>}</>;
  })() : null;

  // A runtime started before this bundle answers without the per-source detail, which must not blank the rest of the page.
  const saved = data?.inventoryDetail;
  const categories = [...(data?.categories || [])].sort((a, b) => b.count - a.count);
  const largestCategory = Math.max(0, ...categories.map(row => row.count));

  return <div className="learning-dashboard">
    {saved && <nav className="growth-saved-section" aria-label={t('Your saved material')}>
      <div className="growth-saved-heading"><h2>{t('Saved material')}</h2></div>
      <div className="growth-saved-grid">{([
        ['words', 'Saved words', 'bookmark', '#word-library'], ['grammar', 'Grammar corrections', 'grammar', '#handbook?days=0'],
        ['notes', 'Ask notes', 'ask', '#ask?view=notes'], ['reports', 'Learning reports', 'trend', '#coach'],
      ] as const).map(([key, label, icon, href]) => {
        const detail = saved[key];
        return <a className="growth-saved-card" key={key} href={href}><span><Icon name={icon} />{t(label)}</span><strong className={detail.total == null ? 'is-empty' : undefined}>{number(detail.total)}</strong><small className="growth-saved-meta"><span>{t('Added in this period:')} <b className={detail.inWindow ? undefined : 'is-empty'}>{number(detail.inWindow)}</b></span><span>{t('Last saved:')} <span className="growth-saved-date">{date(detail.latest) || t('No dated record')}</span></span></small><span className="growth-saved-card-action">{t('Open')}<Icon name="arrow" /></span></a>;
      })}</div>
    </nav>}
    {error && <div className="growth-error" role="alert"><strong>{t('Overview is unavailable')}</strong><p>{t(error)}</p><button className="secondary" onClick={() => setRefresh(n => n + 1)}>{t('Try again')}</button>{data && <p>{t('Previous results remain visible while refreshing.')}</p>}</div>}
    {busy && <p className="growth-loading" role="status">{t(data ? 'Previous results remain visible while refreshing.' : 'Loading learning records…')}</p>}
    <div aria-busy={busy}>{data && <>
      {unavailable.length > 0 && <p className="growth-notice" role="status">{t('Some sources could not be read. Counts and comparisons may be incomplete.')}</p>}
      <div className="growth-metric-grid">
        <button className="growth-metric-card" type="button" onClick={() => list(t('Unaided word recall'), { group: 'recall' })}><span>{t('Unaided word recall')}</span><div><strong className={data.metrics.recall.value == null ? 'is-empty' : undefined}>{pct(data.metrics.recall.value)}</strong>{compare && <Delta current={data.metrics.recall.value} previous={data.previous.metrics.recall.value} />}</div><small>{data.metrics.recall.correct} / {data.metrics.recall.n} · {t('No recorded audio hint')}</small></button>
        <button className="growth-metric-card" type="button" onClick={() => list(t('Translation score'), { group: 'practice' })}><span>{t('Translation score')}</span><div><strong className={data.metrics.translation.value == null ? 'is-empty' : undefined}>{data.metrics.translation.value?.toFixed(1) ?? '—'}<small> / 100</small></strong>{compare && <Delta current={data.metrics.translation.value} previous={data.previous.metrics.translation.value} unit={language === 'zh-CN' ? '分' : 'pts'} />}</div><small>{data.metrics.translation.n} {t('Scored translation attempts')}</small></button>
        <button className="growth-metric-card" type="button" onClick={() => list(t('Checks with saved diagnoses'), { group: 'grammar', diagnosis: 'with' })}><span>{t('Checks with saved diagnoses')}</span><div><strong className={isAvailable('Grammar corrections') ? undefined : 'is-empty'}>{isAvailable('Grammar corrections') ? data.metrics.diagnosed.count : '—'}<small> / {data.metrics.diagnosed.n}</small></strong>{compare && isAvailable('Grammar corrections') && <Delta current={data.metrics.diagnosed.count} previous={data.previous.metrics.diagnosed.count} unit={language === 'zh-CN' ? '条' : 'records'} />}</div><small>{t('Saved checks in this period')}</small></button>
        <button className="growth-metric-card" type="button" onClick={() => list(t('Current word retention'), { group: 'retained', status: 'all' })}><span>{t('Current word retention')}</span><div><strong className={data.retention.available ? undefined : 'is-empty'}>{data.retention.available ? number((data.retention.distribution.retained || 0) + (data.retention.distribution['well-retained'] || 0)) : '—'}<small> / {number(data.retention.total)}</small></strong></div><small>{t('Retained + Well retained')}</small></button>
      </div>
      <div className="growth-insights-grid">
        <section className="growth-panel growth-trend" aria-busy={trendBusy}><SectionTitle title={t('How performance changes')} detail={`${(trend || data).filters.start} — ${(trend || data).filters.end}`} action={<label><span className="sr-only">{t('Metric')}</span><select aria-label={t('Metric')} value={metric} onChange={event => setMetric(event.target.value)}>{Object.entries(metricLabels).map(([key, label]) => <option value={key} key={key}>{t(label)}</option>)}</select></label>} />
          <div className="growth-trend-controls" aria-label={t('Period')}><div className="growth-periods" role="group" aria-label={t('Period')}>{[7, 30, 90, 0].map(days => <button key={days} type="button" aria-pressed={trendQuery.days === days && !trendQuery.start} onClick={() => preset(days)}>{t(days ? `Last ${days} days` : 'All history')}</button>)}</div>
        <form className="growth-date-range" onSubmit={event => { event.preventDefault(); if (!trendDraftStart || !trendDraftEnd || trendDraftStart > trendDraftEnd || Date.parse(trendDraftEnd) - Date.parse(trendDraftStart) > 3650 * DAY) { setDateError(t('Choose a valid date range of at most ten years.')); return; } setDateError(''); setTrendQuery(q => ({ ...q, start: trendDraftStart, end: trendDraftEnd })); }}><label><span className="sr-only">{t('Start date')}</span><input aria-label={t('Start date')} type="date" required value={trendDraftStart} onChange={event => setTrendDraftStart(event.target.value)} /></label><span aria-hidden="true">–</span><label><span className="sr-only">{t('End date')}</span><input aria-label={t('End date')} type="date" required value={trendDraftEnd} onChange={event => setTrendDraftEnd(event.target.value)} /></label><button type="submit" className="growth-text-button">{t('Apply dates')}</button></form>
          </div>
          {dateError && <p className="growth-error" role="alert">{dateError}</p>}
          {trendError && <div className="growth-error" role="alert"><p>{t(trendError)}</p><button type="button" className="growth-text-button" onClick={() => setTrendRefresh(n => n + 1)}>{t('Try again')}</button></div>}
          {trendBusy && !trend && <p className="growth-loading" role="status">{t('Loading learning records…')}</p>}
          {series && <><TrendChart current={series.current} previous={series.previous} compare={compare} countMetric={metric === 'effort'} title={t(metricLabels[metric])} onPoint={pointRecords} t={t} />
            <div className="growth-chart-legend"><span><i />{t('Current period')}</span>{compare && <span><i className="is-previous" />{t('Previous period')}</span>}</div>
          </>}
        </section>
        <section className="growth-panel growth-distribution"><SectionTitle title={t('Error distribution')} /><div className="growth-bar-list">{categories.map(row => <button type="button" key={row.category} className={`growth-bar-row${row.count > 0 && row.count === largestCategory ? ' is-leading' : ''}${row.count ? '' : ' is-empty'}`} title={t('View all records')} onClick={() => list(row.category, { category: row.category, errorType: 'all', group: 'grammar' })}><span>{row.category}</span><span className="growth-bar-track"><i style={{ width: `${row.count / Math.max(1, largestCategory) * 100}%` }} /></span><b>{row.count}</b></button>)}</div></section>
        <section className="growth-panel growth-retention"><SectionTitle title={t('Word retention')} action={<span className="growth-tag">{language === 'zh-CN' ? '当前状态' : 'Current state'}</span>} />{data.retention.available ? <><div className="growth-status-stack" aria-hidden="true">{Object.entries(data.retention.distribution).map(([status, count]) => <i key={status} className={`growth-status-${status}`} style={{ width: `${count / Math.max(1, data.retention.total || 0) * 100}%` }} />)}</div><div className="growth-status-list">{Object.entries(data.retention.distribution).filter(([status, count]) => status !== 'unavailable' || count).map(([status, count]) => <button type="button" key={status} className={count ? undefined : 'is-empty'} onClick={() => list(t(statusLabels[status]), { group: 'inventory', status })}><i className={`growth-status-${status}`} /><span>{t(statusLabels[status])}</span><b>{count}</b></button>)}</div></> : <State title={t('Status unavailable')} />}</section>
        <section className="growth-panel growth-diagnosis"><SectionTitle title={t('A brief observation')} action={<Icon name="spark" />} />{diagnosis}<a className="growth-inline-link" href="#coach">{t('Open English skills report')}<Icon name="arrow" /></a></section>
        <section className="growth-panel growth-priorities"><SectionTitle title={t('Top priorities')} action={<span className="growth-tag growth-priority-count">{data.priorities.length} / 5</span>} />{data.priorities.length ? <ol className="growth-activity-list">{data.priorities.map((row, index) => <li key={row.type}><button type="button" className="growth-activity-row" onClick={() => errorList(row)} aria-label={`${row.type}: ${t('View examples')}`}><span className="growth-activity-icon growth-rank">{index + 1}</span><span className="growth-activity-copy"><strong>{row.type}</strong><small>{t(row.category)} · {row.count} {language === 'zh-CN' ? '条记录' : 'records'} · {row.distinct} {t('Distinct inputs').toLowerCase()}</small></span><Icon name="arrow" /></button></li>)}</ol> : <State title={t('No concrete error types in this period.')} />}</section>
        <section className="growth-panel growth-recent"><SectionTitle title={t('Recent activity')} action={<button type="button" className="growth-inline-link" onClick={() => list(t('Recent activity'))}>{t('View all records')}<Icon name="arrow" /></button>} />{data.recent.length ? <EvidenceRows records={data.recent} onSelect={key => open({ title: t('Learning record'), key })} t={t} /> : <State title={t('No matching records.')} />}<a className="growth-inline-link growth-practice-log" href="#dashboard?view=practice-log">{t('Open practice log')}<Icon name="arrow" /></a></section>
      </div>
    </>}</div>
    {drawer && <LearningEvidenceDrawer request={drawer} onClose={close} />}
  </div>;
}

function DetailField({ label, value, corrected = false }: { label: string; value: unknown; corrected?: boolean }) {
  const text = asText(value);
  if (!text) return null;
  return <section className={`growth-detail-field${corrected ? ' is-corrected' : ''}`}><h3>{label}</h3><div>{text}</div></section>;
}

function LearningEvidenceDrawer({ request, onClose }: { request: DrawerRequest; onClose: () => void }) {
  const { t, language } = useLearningCopy();
  const dialog = useRef<HTMLDialogElement>(null), content = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(request.key || '');
  const [list, setList] = useState<GrowthRecords>(), [detail, setDetail] = useState<GrowthDetail>();
  const [offset, setOffset] = useState(0), [historyOffset, setHistoryOffset] = useState(0);
  const [trail, setTrail] = useState<{ key: string; historyOffset: number; scroll: number }[]>([]);
  const [status, setStatus] = useState(request.options?.status || 'all');
  const [busy, setBusy] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const listScroll = useRef(0), closeButton = useRef<HTMLButtonElement>(null);
  const restoreScroll = useRef<number | null>(null), paginationFocus = useRef<'previous' | 'next' | null>(null);
  const previousButton = useRef<HTMLButtonElement>(null), nextButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const overflow = document.body.style.overflow, scroll = window.scrollY;
    document.body.style.overflow = 'hidden'; dialog.current?.showModal(); closeButton.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = overflow; window.scrollTo({ top: scroll, behavior: 'instant' }); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setBusy(true); setError('');
    // A failed new page/filter request must never relabel the previous payload.
    if (selected) setDetail(undefined); else setList(undefined);
    const load = selected ? webApi.getLearningRecord(selected, historyOffset, controller.signal) : webApi.getLearningRecords({ ...request.options, status, offset }, controller.signal);
    void load.then(result => { if (!active) return; if ('raw' in result) setDetail(result); else setList(result); }, () => { if (active) setError(t('The records could not be loaded.')); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; controller.abort(); };
  }, [selected, offset, historyOffset, status, request, retry]);
  useEffect(() => {
    if (busy) return;
    if (restoreScroll.current !== null) { content.current?.scrollTo({ top: restoreScroll.current }); restoreScroll.current = null; }
    if (paginationFocus.current) {
      const preferred = paginationFocus.current === 'next' ? nextButton.current : previousButton.current;
      const alternate = paginationFocus.current === 'next' ? previousButton.current : nextButton.current;
      (preferred && !preferred.disabled ? preferred : alternate && !alternate.disabled ? alternate : closeButton.current)?.focus({ preventScroll: true });
      paginationFocus.current = null;
    }
  }, [busy]);
  function select(key: string) {
    if (selected) setTrail(current => [...current, { key: selected, historyOffset, scroll: content.current?.scrollTop || 0 }]);
    else listScroll.current = content.current?.scrollTop || 0;
    setDetail(undefined); setHistoryOffset(0); setSelected(key); content.current?.scrollTo({ top: 0 });
  }
  function back() {
    const previous = trail.at(-1);
    setDetail(undefined);
    if (previous) { setTrail(current => current.slice(0, -1)); setSelected(previous.key); setHistoryOffset(previous.historyOffset); restoreScroll.current = previous.scroll; }
    else { setSelected(''); restoreScroll.current = listScroll.current; }
  }
  const raw = detail?.raw || {}, feedback = object(raw.feedback), next = object(object(feedback.result).next);
  const diagnoses = Array.isArray(raw.diagnoses) ? raw.diagnoses.map(object).filter(item => asText(item.explanation) || asText(item.evidence)) : [];
  const title = !selected && request.options?.group === 'inventory'
    ? t(statusLabels[status] || 'Word retention') : detail ? recordTitle(detail, t) : request.title;
  return <dialog ref={dialog} className="growth-drawer" aria-labelledby="growth-detail-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); }}>
    <header className="growth-drawer-heading"><div>{selected && (!request.key || trail.length > 0) ? <button type="button" className="growth-text-button" onClick={back}>← {trail.length ? language === 'zh-CN' ? '返回上一条详情' : 'Back to previous detail' : t('Back to records')}</button> : <span>{t('Learning record')}</span>}</div><button ref={closeButton} type="button" className="growth-icon-button" aria-label={t('Close details')} onClick={onClose}><Icon name="close" /></button></header>
    <div ref={content} className="growth-drawer-content" aria-busy={busy}><h2 id="growth-detail-title">{title}</h2>{busy && <p role="status">{t('Loading records…')}</p>}{error && <div role="alert" className="growth-error"><p>{error}</p><button className="secondary" onClick={() => setRetry(n => n + 1)}>{t('Try again')}</button></div>}
      {!selected && request.options?.group === 'inventory' && <label className="growth-detail-status">{t('Word retention')}<select value={status} onChange={event => { setStatus(event.target.value); setOffset(0); }}><option value="all">{t('All categories')}</option>{Object.entries(statusLabels).map(([key, label]) => <option value={key} key={key}>{t(label)}</option>)}</select></label>}
      {!selected && list && !busy && <>{list.records.length ? <EvidenceRows records={list.records} onSelect={select} t={t} /> : <State title={t('No matching records.')} />}<div className="growth-pagination"><button ref={previousButton} type="button" className="secondary" disabled={!offset || busy} onClick={() => { paginationFocus.current = 'previous'; setOffset(Math.max(0, offset - list.limit)); content.current?.scrollTo({ top: 0 }); }}>{t('Previous')}</button><span>{list.records.length ? `${offset + 1}–${offset + list.records.length}` : '0'} / {list.total}</span><button ref={nextButton} type="button" className="secondary" disabled={!list.hasMore || busy} onClick={() => { paginationFocus.current = 'next'; setOffset(offset + list.limit); content.current?.scrollTo({ top: 0 }); }}>{t('Next')}</button></div></>}
      {selected && detail && !busy && <>
        <p className="growth-record-meta">{t(moduleLabels[detail.module] || 'Learning record')} · {time(detail.timestamp) || t('Date unavailable')}</p>
        {detail.kind === 'word' ? <><span className="growth-tag">{t(statusLabels[asText(raw.learningStatus)] || 'Status unavailable')}</span><DetailField label={t('Meaning')} value={raw.meaning} /><DetailField label={t('Chinese meaning')} value={raw.zh} /><DetailField label={t('Part of speech / pronunciation')} value={[raw.pos, raw.phonetic].map(asText).filter(Boolean).join(' · ')} /><DetailField label={t('Collocations')} value={raw.collocations} /><DetailField label={raw.plural ? 'Plural' : 'Verb forms'} value={raw.plural || raw.verbForms} /><DetailField label={t('Examples')} value={[raw.example, raw.example2, raw.example3].map(asText).filter(Boolean).join('\n\n')} /><DetailField label={t('Word note')} value={raw.note} />
          <section className="growth-word-history"><h3>{t('Review history')} ({detail.history.total})</h3>{detail.history.records.length ? detail.history.records.map(row => <details key={row.key}><summary>{time(row.timestamp)} · {t(row.correct === true ? 'Correct recall' : row.correct === false ? 'Needs another look' : 'Outcome unknown')} · {t(ratingLabels[row.rating || ''] || 'Not recorded')}</summary><DetailField label={t('Your answer')} value={row.original} /><DetailField label={t('Saved correction / reference answer')} value={row.correction} corrected /><DetailField label={t('Hints used')} value={t(row.audioPlayed === true ? 'Audio played' : row.audioPlayed === false ? 'No audio played' : 'Not recorded')} /><DetailField label={t('Resulting interval')} value={row.intervalDays === null ? t('Not recorded') : `${row.intervalDays} ${language === 'zh-CN' ? '天' : 'days'}`} /><button type="button" className="growth-inline-link" onClick={() => select(row.key)}>{t('View review details')}<Icon name="arrow" /></button></details>) : <State title={t('No linked review history.')} />}
          {detail.history.total > 20 && <div className="growth-pagination"><button type="button" className="secondary" disabled={!historyOffset} onClick={() => setHistoryOffset(Math.max(0, historyOffset - 20))}>{t('Previous')}</button><span>{historyOffset + 1}–{Math.min(historyOffset + 20, detail.history.total)} / {detail.history.total}</span><button type="button" className="secondary" disabled={!detail.history.hasMore} onClick={() => setHistoryOffset(historyOffset + 20)}>{t('Next')}</button></div>}</section>
        </> : detail.kind === 'note' || detail.kind === 'report' ? <div className="growth-detail-markdown"><Markdown source={markdownBody(asText(detail.content))} /></div> : <>
          <DetailField label={t(detail.kind === 'grammar' ? 'Original expression' : 'Chinese prompt / original task')} value={detail.kind === 'grammar' ? detail.original : detail.prompt} />
          {detail.kind !== 'grammar' && <DetailField label={t('Your answer')} value={detail.original} />}
          <DetailField label={t(detail.kind === 'grammar' ? 'Saved correction' : 'Saved correction / reference answer')} value={detail.correction} corrected />
          <DetailField label={t('More natural')} value={raw.refine} />
          {detail.kind === 'grammar' && diagnoses.length > 0 && <section className="growth-detail-diagnoses"><h3>{t('Correction notes')}</h3>{diagnoses.map((item, index) => <div key={index}><strong>{asText(item.error_type)}</strong><span className="growth-tag">{asText(item.severity)}</span><p>{asText(item.evidence)}</p><p>{asText(item.explanation)}</p>{item.suggestion != null && <p>{asText(item.suggestion)}</p>}</div>)}</section>}
          <DetailField label={t('Remember')} value={raw.remember} />
          <DetailField label={t('Feedback')} value={feedback.feedback_zh || feedback.feedback || feedback.explanation || detail.content} />
          {detail.kind === 'practice' && <DetailField label={t('Overall score')} value={detail.score} />}
          {detail.kind === 'review' && <><DetailField label={t('Hints used')} value={t(feedback.audioPlayed === true ? 'Audio played' : feedback.audioPlayed === false ? 'No audio played' : 'Not recorded')} /><DetailField label={t('Scheduling rating')} value={t(ratingLabels[asText(feedback.rating)] || 'Not recorded')} /><DetailField label={t('Resulting interval')} value={next.intervalDays == null ? t('Not recorded') : `${asText(next.intervalDays)} ${language === 'zh-CN' ? '天' : 'days'}`} /></>}
          {detail.kind === 'practice' && <DetailField label={t('Hints used')} value={feedback.hints_used == null ? t('Not recorded') : `${asText(feedback.hints_used)} / 3`} />}
          {detail.targets.length > 0 && <DetailField label={t('Practice targets')} value={detail.targets.join(' · ')} />}
        </>}
        {detail.related.length > 0 && <section><h3>{t('Related saved records')}</h3><EvidenceRows records={detail.related} onSelect={select} t={t} /></section>}
      </>}
    </div>
  </dialog>;
}
