import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/connection.mjs';
import configLoader from '../shared/config-loader.mjs';
import { readReviewLog } from '../db/review-log.mjs';
import { listSavedVocabulary } from './vocabulary-library.mjs';
import { listAskNotes } from './ask-notes.mjs';
import { listCoachReports, readCoachReport } from './coach-report-store.mjs';
import { resolvePracticePath } from './practice.mjs';
import { parseCoachPracticeLog } from './coach-sources.mjs';
import { getErrorTypesByCategory } from '../domain/error-types.mjs';
import { matchesHandbookTarget } from '../features/practice/handbook-targets.mjs';

// Read-only transport envelope. Original record fields and evidence are retained.
// No migrations, model calls, scheduling changes, or copying secrets/configuration.
export async function exportGrowthData({ config = configLoader.load(), db, now = new Date() } = {}) {
  let database = db;
  if (database === undefined) {
    try { database = await getDb({ readonly: true }); }
    catch { database = null; }
  }
  const coverage = [];
  const read = (source, fn) => {
    try { const records = fn(); coverage.push({ source, status: 'available', count: records.length }); return records; }
    catch (error) { coverage.push({ source, status: error.code === 'ENOENT' ? 'missing' : 'unavailable' }); return []; }
  };
  const root = path.join(import.meta.dirname, '../..');
  const resolve = file => path.isAbsolute(file) ? file : path.join(root, file);
  const reviews = read('Grammar corrections', () => {
    const file = resolve(config.ReviewPath || '00_Review_logs.md');
    fs.accessSync(file);
    return readReviewLog(file);
  });
  const attempts = read('Practice & vocabulary reviews', () => database.prepare('SELECT * FROM practice_attempts ORDER BY created_at DESC, id DESC').all());
  const cards = read('Vocabulary schedules', () => database.prepare("SELECT * FROM srs_cards WHERE source_type = 'vocab'").all());
  const words = read('Saved words', () => {
    const first = listSavedVocabulary({ config, db: database, limit: 100 });
    if (!first.sourceAvailable) throw Object.assign(new Error('Missing vocabulary'), { code: 'ENOENT' });
    const result = [...first.words];
    for (let offset = 100; offset < first.total; offset += 100) result.push(...listSavedVocabulary({ config, db: database, limit: 100, offset }).words);
    return result;
  });
  const notes = read('Ask notes', () => listAskNotes(config).notes);
  const directory = config.CoachReportsDir || config.ReportPath || path.join(root, 'output', 'coach-reports');
  const reports = read('Coach reports', () => listCoachReports({ directory }).map(item => {
    const { savedPath, ...report } = readCoachReport(item.savedId, { directory });
    return report;
  }));
  const practiceLog = read('Practice Markdown', () => parseCoachPracticeLog(fs.readFileSync(resolvePracticePath(config), 'utf8')));
  const practiceTargets = {};
  try {
    const question = database.prepare('SELECT practice_fields_json FROM practice_questions WHERE id = ?');
    for (const attempt of attempts.filter(item => item.activity_type === 'practice-sentence')) {
      const feedback = JSON.parse(attempt.feedback || '{}');
      const row = question.get(feedback.question_id || '');
      if (row) practiceTargets[attempt.id] = Object.values(getErrorTypesByCategory()).flat().filter(type =>
        matchesHandbookTarget({ practice_fields: JSON.parse(row.practice_fields_json) }, type));
    }
    coverage.push({ source: 'Live Practice targets', status: 'available', count: Object.keys(practiceTargets).length });
  } catch { coverage.push({ source: 'Live Practice targets', status: 'unavailable' }); }
  return { format: 'clearwrite-growth', version: 1, exportedAt: now.toISOString(), taxonomy: getErrorTypesByCategory(),
    coverage, reviews, attempts, cards, words, notes, reports, practiceLog, practiceTargets };
}
