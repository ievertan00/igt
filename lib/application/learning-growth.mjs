import { exportGrowthData } from './growth-export.mjs';
import { DAY, day, normalize, matches, summarize, previousWindow, trend } from '../domain/learning-growth.mjs';
import { getErrorTypesByCategory } from '../domain/error-types.mjs';

const modules = ['all', 'grammar', 'text', 'review', 'practice', 'vocabulary', 'ask', 'coach', 'unclassified', 'practice-log', 'practice-choice', 'practice-word', 'practice-expression'];
const statuses = ['all', 'new', 'learning', 'needs-reinforcement', 'retained', 'well-retained', 'insufficient-history', 'unavailable'];
const invalid = message => Object.assign(new Error(message), { status: 400, code: 'INVALID_REQUEST' });
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString().slice(0, 10) === value;
const integer = (value, fallback, min, max) => {
  const n = Number(value ?? fallback);
  if (!Number.isInteger(n) || n < min || n > max) throw invalid('Invalid learning record pagination.');
  return n;
};

export function growthFilters(options = {}, { now = Date.now(), earliest } = {}) {
  const taxonomy = getErrorTypesByCategory();
  const days = integer(options.days, 30, 0, 3650);
  const start = String(options.start || (days === 0 ? earliest || day(now - 3649 * DAY) : day(now - (days - 1) * DAY)));
  const end = String(options.end || day(now));
  const module = String(options.module || 'all'), category = String(options.category || 'all');
  const errorType = String(options.errorType || 'all'), status = String(options.status || 'all');
  if (!validDate(start) || !validDate(end) || start > end || Date.parse(end) - Date.parse(start) > 3650 * DAY) throw invalid('Choose a valid date range of at most ten years.');
  if (!modules.includes(module) || !['all', ...Object.keys(taxonomy)].includes(category)
    || !['all', ...Object.values(taxonomy).flat()].includes(errorType) || !statuses.includes(status)) throw invalid('Choose an existing learning module, category, error type or retention state.');
  if (category !== 'all' && errorType !== 'all' && !taxonomy[category].includes(errorType)) throw invalid('The error type does not belong to the selected category.');
  return { start, end, module, category, errorType, status, search: '', includeUndated: false };
}

const serialRecord = record => ({ key: record.key, kind: record.kind, module: record.module,
  timestamp: Number.isFinite(record.date) ? new Date(record.date).toISOString() : null,
  title: String(record.title || ''), types: record.types, targets: record.targets || [],
  correct: record.correct ?? null, score: record.score ?? null, status: record.status || null });
function metrics(summary) {
  return {
    recall: { value: summary.independentRecall, correct: summary.unaided.filter(r => r.correct).length, n: summary.unaided.length },
    translation: { value: summary.practiceScore, n: summary.practice.length },
    diagnosed: { count: summary.affected, n: summary.grammar.length },
  };
}

async function load(options, dependencies) {
  const now = dependencies.now ?? Date.now();
  // Reject invalid input before opening any configured data source.
  growthFilters(options, { now });
  const snapshot = await (dependencies.loadData || exportGrowthData)({ config: dependencies.config, now: new Date(now) });
  const allRecords = normalize(snapshot);
  const records = allRecords.filter(r => !Number.isFinite(r.date) || r.date <= now);
  const dates = records.filter(r => Number.isFinite(r.date)).map(r => r.date);
  const earliest = day(Math.max(now - 3650 * DAY, dates.length ? Math.min(...dates) : now));
  const filters = growthFilters(options, { now, earliest });
  return { snapshot, records, allRecords, filters, now };
}

function select(records, filters, taxonomy) {
  return records.filter(r => matches(r, filters, taxonomy));
}
const statusDistribution = words => Object.fromEntries(statuses.slice(1).map(status => [status, words.filter(r => r.status === status).length]));
const segments = new Intl.Segmenter('en', { granularity: 'sentence' });
function effortSeries(records, start, end) {
  return trend([], start, end).map(point => {
    const rows = records.filter(r => day(r.date) >= point.start && day(r.date) <= point.end);
    const count = rows.reduce((sum, r) => sum + (r.module === 'practice' ? 1
      : r.kind === 'grammar' && ['grammar', 'text'].includes(r.module)
        ? [...segments.segment(r.original || '')].filter(s => /[\p{L}\p{N}]/u.test(s.segment)).length : 0), 0);
    return { ...point, value: count, numerator: count, denominator: rows.filter(r => r.module === 'practice' || (r.kind === 'grammar' && ['grammar', 'text'].includes(r.module))).length };
  });
}

export async function getGrowthOverview(options = {}, dependencies = {}) {
  const { snapshot, records, allRecords, filters, now } = await load(options, dependencies);
  const taxonomy = snapshot.taxonomy;
  const currentRows = select(records, filters, taxonomy), summary = summarize(currentRows, taxonomy);
  const previous = previousWindow(filters.start, filters.end);
  const previousRows = select(records, { ...filters, ...previous }, taxonomy), before = summarize(previousRows, taxonomy);
  const all = summarize(allRecords, taxonomy);
  const unavailable = source => snapshot.coverage.some(c => c.source === source && c.status !== 'available');
  const count = (source, n) => unavailable(source) ? null : n;
  const inventory = {
    words: count('Saved words', snapshot.words.length),
    grammar: count('Grammar corrections', allRecords.filter(r => r.kind === 'grammar' && r.module === 'grammar').length),
    notes: count('Ask notes', snapshot.notes.length), reports: count('Coach reports', snapshot.reports.length),
  };
  // Per-source reading of the same library: the total stays filter-independent, the period count and the last saved date come from dated records.
  const inventorySources = { words: 'word', grammar: 'grammar', notes: 'note', reports: 'report' };
  const inventoryDetail = Object.fromEntries(Object.entries(inventorySources).map(([source, kind]) => {
    const dates = allRecords.filter(r => r.kind === kind && (source !== 'grammar' || r.module === 'grammar')).map(r => r.date).filter(Number.isFinite).map(day);
    return [source, { total: inventory[source], inWindow: dates.filter(value => value >= filters.start && value <= filters.end).length,
      latest: dates.length ? dates.reduce((latest, value) => value > latest ? value : latest) : null }];
  }));
  const series = Object.fromEntries(['recall', 'score', 'errors'].map(metric => [metric, {
    current: trend(currentRows, filters.start, filters.end, metric), previous: trend(previousRows, previous.start, previous.end, metric),
  }]));
  series.effort = { current: effortSeries(currentRows, filters.start, filters.end), previous: effortSeries(previousRows, previous.start, previous.end) };
  const top = summary.counts.filter(row => row.distinct >= 2).slice(0, 2);
  const categories = summary.categories;
  const comparisons = {
    modules: modules.slice(1).filter(module => ['grammar', 'text', 'review', 'practice'].includes(module)).map(module => ({ module,
      ...metrics(summarize(select(records, { ...filters, module }, taxonomy), taxonomy)),
    })),
    types: summarize(select(records, { ...filters, category: 'all', errorType: 'all' }, taxonomy), taxonomy).counts,
  };
  return {
    filters, taxonomy, asOf: new Date(now).toISOString(), inventory, inventoryDetail,
    metrics: metrics(summary), previous: { filters: previous, metrics: metrics(before) },
    categories, errorTypes: summary.counts, series, comparisons,
    retention: { total: inventory.words, distribution: statusDistribution(all.words),
      available: !unavailable('Saved words') && !unavailable('Vocabulary schedules') && !unavailable('Practice & vocabulary reviews') },
    diagnosis: { patterns: top, recall: metrics(summary).recall, writingChecks: summary.grammar.length },
    priorities: summary.counts.slice(0, 5),
    recent: currentRows.filter(r => r.kind !== 'practice-log' || filters.module === 'practice-log').slice(0, 6).map(serialRecord),
    total: currentRows.length, undated: records.filter(r => !Number.isFinite(r.date)).length,
    coverage: snapshot.coverage,
  };
}

export async function getGrowthRecords(options = {}, dependencies = {}) {
  const offset = integer(options.offset, 0, 0, Number.MAX_SAFE_INTEGER), limit = integer(options.limit, 20, 1, 100);
  const group = String(options.group || 'all');
  const diagnosis = String(options.diagnosis || 'all');
  if (!['all', 'with', 'none'].includes(diagnosis)) throw invalid('Choose a valid saved-diagnosis filter.');
  if (!['all', 'recall', 'practice', 'grammar', 'inventory', 'retained', 'effort'].includes(group)) throw invalid('Choose an existing evidence group.');
  const { snapshot, records, allRecords, filters } = await load(options, dependencies);
  const rows = (group === 'retained' ? allRecords.filter(r => r.kind === 'word' && ['retained', 'well-retained'].includes(r.status))
    : group === 'inventory' ? allRecords.filter(r => r.kind === 'word' && (filters.status === 'all' || r.status === filters.status))
    : select(records, filters, snapshot.taxonomy).filter(r => group === 'all' ? r.kind !== 'practice-log' || filters.module === 'practice-log'
      : group === 'recall' ? r.kind === 'review' && typeof r.correct === 'boolean' && r.feedback.audioPlayed === false
        : group === 'practice' ? r.module === 'practice' && Number.isFinite(r.score) && r.score >= 0 && r.score <= 100
          : group === 'effort' ? r.module === 'practice' || (r.kind === 'grammar' && ['grammar', 'text'].includes(r.module))
            : r.kind === 'grammar' && ['grammar', 'text'].includes(r.module) && r.raw.formatSupported !== false))
    .filter(r => diagnosis === 'all' || (r.kind === 'grammar' && (diagnosis === 'with' ? r.types.length > 0 || r.categories.length > 0 : !r.types.length && !r.categories.length)));
  return { records: rows.slice(offset, offset + limit).map(serialRecord), total: rows.length, offset, limit, hasMore: offset + limit < rows.length };
}

export async function getGrowthRecord(options = {}, dependencies = {}) {
  const key = String(options.key || '');
  if (!key || key.length > 500) throw invalid('Choose a valid learning record.');
  const { allRecords: records } = await load({}, dependencies);
  const record = records.find(r => r.key === key);
  if (!record) throw Object.assign(new Error('This learning record is no longer available. Refresh your overview.'), { status: 404, code: 'NOT_FOUND' });
  const related = record.kind === 'word' && record.raw.srs
    ? records.filter(r => r.kind === 'review' && r.cardId === record.raw.srs.id) : [];
  const historyOffset = integer(options.historyOffset, 0, 0, Number.MAX_SAFE_INTEGER);
  const history = related.slice(historyOffset, historyOffset + 20).map(r => ({ ...serialRecord(r), original: r.original, correction: r.correction,
    audioPlayed: r.feedback.audioPlayed ?? null, rating: r.feedback.rating ?? null, intervalDays: r.feedback.result?.next?.intervalDays ?? null }));
  const evidenceIds = new Set((Array.isArray(record.raw.evidence) ? record.raw.evidence : []).map(item => item.entryId));
  const relatedRecords = records.filter(r => r.key !== key && (evidenceIds.has(r.raw.entryId)
    || (r.kind === 'note' && ((record.raw.entryId && r.content?.includes(record.raw.entryId))
      || (record.original?.length >= 15 && r.content?.includes(record.original)))))).slice(0, 30).map(serialRecord);
  return { ...serialRecord(record), original: record.original || null, correction: record.correction || null,
    prompt: record.prompt || null, content: record.content || null, raw: record.raw,
    related: relatedRecords,
    history: { records: history, total: related.length, offset: historyOffset, hasMore: historyOffset + history.length < related.length } };
}
