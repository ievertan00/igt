import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { growthFilters, getGrowthOverview, getGrowthRecords, getGrowthRecord } from '../lib/application/learning-growth.mjs';
import { getErrorTypesByCategory } from '../lib/domain/error-types.mjs';
import { registerDashboardRoutes } from '../lib/server/routes/dashboard.mjs';
import { dispatch } from '../lib/server/router.mjs';

const now = Date.parse('2026-11-11T10:00:00Z');
function fixture() {
  const review = (id, diagnoses, source = 'grammar', timestamp = '2026-11-10T12:00:00Z') => ({ entryId: id, source, timestamp, userInput: id === 'b' ? 'She go yesterday.' : 'I go yesterday.', correction: 'I went yesterday.', formatSupported: true, diagnoses: diagnoses.map(error_type => ({ error_type })) });
  const attempt = (id, feedback, extra = {}) => ({ id, activity_type: 'review-vocabulary', created_at: '2026-11-10 02:00:00', prompt: 'retained', learner_answer: 'retained', reference_answer: 'retained', target_pattern: 'retained', score: 100, feedback: JSON.stringify(feedback), ...extra });
  return { format: 'clearwrite-growth', version: 1, exportedAt: new Date(now).toISOString(), taxonomy: getErrorTypesByCategory(),
    coverage: ['Saved words', 'Grammar corrections', 'Ask notes', 'Coach reports', 'Vocabulary schedules', 'Practice & vocabulary reviews', 'Practice Markdown', 'Live Practice targets'].map(source => ({ source, status: 'available' })),
    reviews: [review('a', ['Grammar / Verb Tense', 'Grammar / Verb Tense']), review('b', ['Verb Tense', 'Word Choice']), review('text', ['Punctuation'], 'text'), review('unknown', ['Verb Tense'], 'unknown'), review('old', ['Verb Tense'], 'grammar', '2026-10-01T12:00:00Z')],
    attempts: [attempt(1, { correct: true, audioPlayed: false, cardId: 7 }), attempt(2, { correct: false, audioPlayed: false, cardId: 7 }), attempt(3, { correct: true, audioPlayed: true }), attempt(4, { rating: 'easy' }), attempt(5, { hints_used: 2 }, { activity_type: 'practice-sentence', score: 80 }), attempt(6, {}, { activity_type: 'practice-choice', score: 100 })],
    cards: [], words: [{ id: 'retained', word: 'retained', added: '2025-01-01', learningStatus: 'retained', srs: { id: 7 } }, { id: 'new', word: 'new', added: '2026-11-10', learningStatus: 'new', srs: null }],
    notes: [{ id: '中文文件名.md', title: 'English metadata', content: '**Date**: 2026-11-10 11:00\nQuoted record: a\nI go yesterday.' }],
    reports: [{ savedId: 'report', generatedAt: '2026-11-10T12:00:00Z', markdown: '# Report', evidence: [{ entryId: 'a' }] }],
    practiceLog: [{ entryId: 'log', timestamp: '2026-11-10T12:00:00Z', userInput: 'I go yesterday.', practice: { prompt: '中文提示', referenceAnswer: 'I went yesterday.' } }], practiceTargets: { 5: ['Verb Tense'] },
  };
}
const dependencies = data => ({ now, loadData: async () => data });
const window = { start: '2026-11-01', end: '2026-11-11' };

test('inventory is independent of analysis filters, performance keeps provenance and denominators', async () => {
  const result = await getGrowthOverview(window, dependencies(fixture()));
  assert.deepEqual(result.inventory, { words: 2, grammar: 3, notes: 1, reports: 1 });
  assert.deepEqual(result.metrics.recall, { value: 50, correct: 1, n: 2 });
  assert.deepEqual(result.metrics.translation, { value: 80, n: 1 });
  assert.deepEqual(result.metrics.diagnosed, { count: 3, n: 3 });
  assert.equal(result.retention.distribution.retained, 1);
  assert.equal(result.errorTypes.find(r => r.type === 'Verb Tense').count, 2);
  assert.equal(result.errorTypes.find(r => r.type === 'Verb Tense').distinct, 2);
  assert.equal(result.categories.find(r => r.category === 'Grammar').count, 2);
  assert.equal(result.categories.find(r => r.category === 'Mechanics').count, 1);
  const filtered = await getGrowthOverview({ ...window, module: 'practice', category: 'Grammar', errorType: 'Verb Tense' }, dependencies(fixture()));
  assert.deepEqual(filtered.inventory, result.inventory);
  assert.deepEqual(filtered.metrics.translation, { value: 80, n: 1 });
  assert.equal(filtered.metrics.diagnosed.n, 0);
  assert.equal(filtered.retention.distribution.retained, 1);
});

test('same-length comparison can see prior evidence without mixing it into the current window', async () => {
  const data = fixture();
  const result = await getGrowthOverview({ start: '2026-11-01', end: '2026-11-11' }, dependencies(data));
  assert.deepEqual(result.previous.filters, { start: '2026-10-21', end: '2026-10-31' });
  assert.ok(result.series.recall.current.some(r => r.value === 50 && r.denominator === 2));
  assert.ok(result.series.recall.previous.every(r => r.value === null));
});

test('drill-down records reconcile to summary denominators and omit raw payloads', async () => {
  const deps = dependencies(fixture());
  const summary = await getGrowthOverview(window, deps);
  const recalls = await getGrowthRecords({ ...window, group: 'recall' }, deps);
  const practice = await getGrowthRecords({ ...window, group: 'practice' }, deps);
  const grammar = await getGrowthRecords({ ...window, group: 'grammar' }, deps);
  assert.equal(recalls.total, summary.metrics.recall.n);
  assert.equal(practice.total, summary.metrics.translation.n);
  assert.equal(grammar.total, summary.metrics.diagnosed.n);
  assert.ok(!('raw' in grammar.records[0]));
  assert.equal((await getGrowthRecords({ ...window, group: 'effort' }, deps)).total, 4);
  assert.equal((await getGrowthRecords({ ...window, group: 'inventory', status: 'retained' }, deps)).records[0].key, 'word:retained');
  assert.equal((await getGrowthRecords({ ...window, group: 'retained' }, deps)).total, 1);
});

test('details retain originals, notes use filenames and reports link existing original evidence', async () => {
  const deps = dependencies(fixture());
  const word = await getGrowthRecord({ key: 'word:retained' }, deps);
  assert.equal(word.history.total, 2);
  assert.equal(word.history.records[0].intervalDays, null);
  const note = await getGrowthRecord({ key: 'note:中文文件名.md' }, deps);
  assert.equal(note.title, '中文文件名');
  const report = await getGrowthRecord({ key: 'report:report' }, deps);
  assert.ok(report.related.some(r => r.key === 'grammar:a'));
  const check = await getGrowthRecord({ key: 'grammar:a' }, deps);
  assert.equal(check.original, 'I go yesterday.');
  assert.ok(check.related.some(r => r.kind === 'note'));
});

test('combined retention evidence includes both states counted by the card regardless of analysis dates', async () => {
  const data = fixture();
  data.words.push({ id: 'durable', word: 'durable', added: '2024-01-01', learningStatus: 'well-retained', srs: { id: 9 } });
  const deps = dependencies(data);
  const summary = await getGrowthOverview(window, deps);
  const records = await getGrowthRecords({ ...window, group: 'retained' }, deps);
  assert.equal(records.total, summary.retention.distribution.retained + summary.retention.distribution['well-retained']);
  assert.deepEqual(new Set(records.records.map(r => r.status)), new Set(['retained', 'well-retained']));
});

test('invalid query fails before reading, type filters stay inside the canonical taxonomy', async () => {
  let reads = 0;
  const deps = { now, loadData: () => { reads++; return fixture(); } };
  for (const options of [{ start: '2026-02-30' }, { start: '2026-12-01', end: '2026-11-01' }, { module: 'listening' }, { errorType: 'Countability' }, { category: 'Vocabulary', errorType: 'Verb Tense' }, { days: -1 }]) {
    await assert.rejects(() => getGrowthOverview(options, deps), { status: 400 });
  }
  await assert.rejects(() => getGrowthRecords({ offset: -1 }, deps), { status: 400 });
  assert.equal(reads, 0);
  assert.equal(growthFilters({ days: 1 }, { now }).start, '2026-11-11');
});

test('unsupported grammar formats, explicit duplicates, future records and invalid scores cannot imply proficiency', async () => {
  const data = fixture();
  data.reviews.push({ ...data.reviews[0], entryId: 'unsupported', formatSupported: false }, { ...data.reviews[0], entryId: 'duplicate', isDuplicate: true }, { ...data.reviews[0], entryId: 'future', timestamp: '2026-11-12T12:00:00Z' });
  data.attempts[4].score = 150;
  const result = await getGrowthOverview(window, dependencies(data));
  assert.equal(result.metrics.diagnosed.n, 3);
  assert.deepEqual(result.metrics.translation, { value: null, n: 0 });
  assert.equal(result.priorities[0].count, 2);
});

test('missing sources surface incomplete status rather than zero library inventory', async () => {
  const data = fixture(); data.coverage.find(c => c.source === 'Saved words').status = 'unavailable';
  data.coverage.find(c => c.source === 'Vocabulary schedules').status = 'unavailable';
  const result = await getGrowthOverview(window, dependencies(data));
  assert.equal(result.inventory.words, null);
  assert.equal(result.retention.available, false);
});

test('pagination is bounded and nonexistent detail is a recoverable 404', async () => {
  const deps = dependencies(fixture());
  const first = await getGrowthRecords({ ...window, limit: 2 }, deps);
  const second = await getGrowthRecords({ ...window, limit: 2, offset: 2 }, deps);
  assert.equal(first.records.length, 2);
  assert.equal(first.hasMore, true);
  assert.ok(!second.records.some(r => first.records.some(f => f.key === r.key)));
  await assert.rejects(() => getGrowthRecord({ key: 'grammar:removed' }, deps), { status: 404 });
});

test('new dashboard endpoints dispatch locally with no-store responses and no wildcard CORS', async () => {
  const deps = dependencies(fixture());
  registerDashboardRoutes({ loadGrowth: options => getGrowthOverview(options, deps), loadRecords: options => getGrowthRecords(options, deps), loadRecord: options => getGrowthRecord(options, deps) });
  for (const url of ['/dashboard/growth?start=2026-11-01&end=2026-11-11', '/dashboard/records?group=recall', '/dashboard/record?key=word%3Aretained']) {
    const req = Readable.from([]); req.method = 'GET'; req.url = url; req.headers = {};
    const res = { status: null, headers: {}, writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; } };
    await dispatch(req, res);
    assert.equal(res.status, 200); assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
    assert.doesNotThrow(() => JSON.parse(res.body));
  }
});
