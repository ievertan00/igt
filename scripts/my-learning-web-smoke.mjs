import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { preview } from 'vite';
import { getGrowthOverview, getGrowthRecords, getGrowthRecord } from '../lib/application/learning-growth.mjs';
import { buildGrammarHistory } from '../lib/application/grammar-history.mjs';
import { getErrorTypesByCategory } from '../lib/domain/error-types.mjs';

// Synthetic data only; never start the Local Runtime, migrate a DB or call a model.
const now = Date.now(), HOUR = 3600000;
const stamp = delta => new Date(now - delta).toISOString();
const wall = delta => new Date(now - delta + 8 * HOUR).toISOString();
const reviews = Array.from({ length: 24 }, (_, i) => ({ source: 'grammar', entryId: `check-${i}`, formatSupported: true,
  timestamp: wall((i + 1) * HOUR), userInput: `I bought book ${i}.`, correction: `I bought a book ${i}.`,
  diagnoses: [{ error_type: ['Verb Tense', 'Article Usage', 'Subject-Verb Agreement', 'Word Choice', 'Sentence Structure', 'Preposition Usage'][i % 6], severity: 'Minor', explanation: 'Inspect the original context.' }] }));
const words = ['steady', 'durable', 'new'].map((word, i) => ({ id: word, word, pos: 'adjective', phonetic: '/demo/', meaning: `The meaning of ${word}.`, zh: '演示词条',
  synonyms: '', collocations: '', verbForms: '', plural: '', example: `A ${word} example.`, example2: '', example3: '', note: '', memory: '', added: '2025-01-01',
  learningStatus: ['retained', 'well-retained', 'new'][i], recordedReviews: i < 2 ? 4 : 0,
  srs: { id: i + 7, due_date: stamp(0).slice(0, 10), total_reviews: i < 2 ? 4 : 0, last_reviewed: null, interval_days: 7 } }));
const attempts = Array.from({ length: 8 }, (_, i) => ({ id: i, activity_type: 'review-vocabulary', target_pattern: i % 2 ? 'steady' : 'durable',
  prompt: 'word', learner_answer: i % 2 ? 'steady' : 'durable', reference_answer: i % 2 ? 'steady' : 'durable', score: i === 0 ? 0 : 100,
  feedback: JSON.stringify({ correct: i !== 0, audioPlayed: false, cardId: i % 2 ? 7 : 8, rating: 'good', result: { next: { intervalDays: 7 } } }), created_at: stamp((i + 1) * HOUR) }));
attempts.push(...[100, 101].map(id => ({ id, activity_type: 'practice-sentence', prompt: '我昨天买了一本书。', learner_answer: 'I buy a book yesterday.', reference_answer: 'I bought a book yesterday.', target_pattern: 'Past tense', score: 80,
  feedback: JSON.stringify({ hints_used: 0, corrected_answer: 'I bought a book yesterday.', feedback_zh: '注意过去时。' }), created_at: stamp(HOUR) })));
const notes = [{ id: '中文笔记.md', title: 'Chinese note', category: 'Grammar', tags: ['grammar'], content: `**Date**: ${wall(0).slice(0, 16).replace('T', ' ')}\n\n# 笔记\n\nObserve article usage.`, modifiedAt: stamp(0) }];
const snapshot = { format: 'clearwrite-growth', version: 1, exportedAt: stamp(0), taxonomy: getErrorTypesByCategory(),
  coverage: ['Grammar corrections', 'Practice & vocabulary reviews', 'Vocabulary schedules', 'Saved words', 'Ask notes', 'Coach reports', 'Practice Markdown', 'Live Practice targets'].map(source => ({ source, status: 'available' })),
  reviews, words, cards: [], attempts, notes, reports: [], practiceLog: [], practiceTargets: { 100: ['Verb Tense'], 101: ['Verb Tense'] } };
const deps = { now, loadData: async () => snapshot };
let failRecords = false, failHistory = false, browser, server;
try {
  server = await preview({ configFile: 'apps/web/vite.config.ts', preview: { host: '127.0.0.1', port: 0, open: false } });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await puppeteer.launch({ headless: true, ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', async request => {
    try {
      const url = new URL(request.url()), options = Object.fromEntries(url.searchParams);
      if (url.origin !== base) { await request.abort(); return; }
      const json = body => request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname === '/dashboard/growth') await json(await getGrowthOverview(options, deps));
      else if (url.pathname === '/dashboard/records') { if (failRecords) throw Error('Synthetic record failure'); await json(await getGrowthRecords(options, deps)); }
      else if (url.pathname === '/dashboard/record') { if (failHistory) throw Error('Synthetic history failure'); await json(await getGrowthRecord(options, deps)); }
      else if (url.pathname === '/handbook') await json(buildGrammarHistory(reviews, options, now));
      else if (url.pathname === '/vocab/words') {
        const selected = words.filter(word => !options.status || options.status === 'all' || word.learningStatus === options.status);
        await json({ words: selected, total: selected.length, totalSaved: words.length, sourceAvailable: true, limit: 25, offset: 0, hasMore: false, overview: { due: 3, overdue: 0, dueToday: 3, retained: 1, wellRetained: 1, distribution: { retained: 1, 'well-retained': 1, new: 1 } }, today: stamp(0).slice(0, 10) });
      } else if (url.pathname === '/vocab/history') await json({ records: [], total: 0, offset: 0, hasMore: false });
      else if (url.pathname === '/ask/notes') await json({ notes });
      else if (url.pathname === '/coach/reports') await json([]);
      else if (url.pathname === '/runtime') await json({ runtime: 'local', storage: { database: 'sqlite', assets: 'markdown' } });
      else if (url.pathname === '/status-message') await json({ content: '' });
      else if (url.pathname === '/handbook/reports') await json({ reports: [] });
      else if (url.pathname === '/dashboard/practice-log') await json({ count: 1, markdown: '## Saved practice\n\nA fixture entry.' });
      else if (url.pathname.startsWith('/settings/')) await request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture model unavailable' }) });
      else await request.continue();
    } catch (error) { if (!request.isInterceptResolutionHandled()) await request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: error.message }) }); }
  });
  const ready = async () => { await page.waitForNetworkIdle({ idleTime: 100 }); await page.waitForFunction(() => ![...document.querySelectorAll('[aria-busy]')].some(node => node.getAttribute('aria-busy') === 'true')); };
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${base}/#dashboard?days=30`); await ready();
  assert.equal(await page.$$eval('.my-learning-tabs a', nodes => nodes.length), 5);
  assert.equal(await page.$('#workspace-nav .my-learning-menu'), null);
  assert.equal(await page.$eval('#workspace-nav a[href="#dashboard"]', node => node.textContent), 'My learning');
  // The tab track is a control: deep enough to read on a low-gamut screen, edged with its own stroke, and exactly as wide as the content below.
  const track = await page.$eval('.my-learning-tabs', node => {
    const style = getComputedStyle(node), rect = node.getBoundingClientRect();
    return { background: style.backgroundColor, shadow: style.boxShadow, left: rect.left, width: rect.width };
  });
  const workspace = await page.$eval('main.workspace', node => { const rect = node.getBoundingClientRect(); return { left: rect.left, width: rect.width }; });
  assert.equal(track.background, 'rgb(232, 239, 247)', 'track keeps its deeper #e8eff7 ground');
  assert.match(track.shadow, /227, 234, 243/, 'track keeps the 1px #e3eaf3 outline');
  assert.match(track.shadow, /inset/, 'track outline is inset so tabs stay 40px tall');
  assert.ok(Math.abs(track.left - workspace.left) < 1.5, 'track and content share the workspace left edge');
  assert.ok(Math.abs(track.width - workspace.width) < 1.5, 'track and content share the workspace width');
  assert.ok(Math.abs(track.left + track.width - workspace.left - workspace.width) < 1.5, 'track and content share the workspace right edge');
  // Labels stay at their natural width; the unused right side of the track is blank space, not stretched chips.
  assert.equal(await page.$$eval('.my-learning-tabs a', nodes => nodes.every(node => getComputedStyle(node).flexGrow === '0')), true, 'tabs keep their natural width');
  const labelBounds = await page.$$eval('.my-learning-tabs a', nodes => ({ first: nodes[0].getBoundingClientRect().left, last: nodes[nodes.length - 1].getBoundingClientRect().right }));
  assert.ok(labelBounds.first - track.left < 16, 'tabs start at the track inset');
  assert.ok(track.left + track.width - labelBounds.last > 40, 'the right side of the track is left blank');
  assert.equal(await page.$eval('.my-learning-tabs a[aria-current="page"]', node => getComputedStyle(node).backgroundColor), 'rgb(255, 255, 255)');
  // Only the primary header sticks; the tab strip must travel with the page.
  const navTop = await page.$eval('.my-learning-navigation', node => node.getBoundingClientRect().top);
  const scrolled = await page.evaluate(() => { window.scrollTo(0, 500); return window.scrollY; });
  assert.ok(scrolled > 0, 'the overview page is scrollable');
  const navScrolledTop = await page.$eval('.my-learning-navigation', node => node.getBoundingClientRect().top);
  assert.ok(Math.abs(navScrolledTop - (navTop - scrolled)) < 2, 'the tab strip scrolls with the page instead of sticking');
  await page.evaluate(() => window.scrollTo(0, 0));
  assert.equal(await page.$$eval('.growth-saved-card', nodes => nodes.length), 4);
  assert.equal(await page.$$eval('.growth-metric-card', nodes => nodes.length), 4);
  // Type colour is semantic, not decorative: each data family owns a readable hue.
  assert.equal(new Set(await page.$$eval('.growth-metric-card strong', nodes => nodes.map(node => getComputedStyle(node).color))).size, 4, 'metric values carry four semantic hues');
  assert.equal(new Set(await page.$$eval('.growth-saved-card strong', nodes => nodes.map(node => getComputedStyle(node).color))).size, 4, 'saved-material totals carry four semantic hues');
  assert.equal(await page.$$eval('.growth-bar-row', nodes => nodes.length), 5);
  assert.equal(await page.$eval('.growth-priorities h2', node => node.textContent), 'Top priorities');
  assert.equal(await page.$$eval('.growth-priorities .growth-activity-row', nodes => nodes.length), 5);
  // The title no longer promises a fixed five: the tag states how many types actually occurred in the window.
  assert.equal(await page.$eval('.growth-priorities .growth-priority-count', node => node.textContent), '5 / 5');
  await page.click('.growth-priorities .growth-activity-row'); await ready();
  assert.ok(await page.$('.growth-drawer .growth-activity-row'));
  await page.keyboard.press('Escape');
  await page.focus('select[aria-label="Metric"]'); await page.select('select[aria-label="Metric"]', 'score');
  assert.equal(await page.$eval('select[aria-label="Metric"]', node => node === document.activeElement), true);
  assert.equal(await page.$('.growth-filters'), null);
  assert.equal(await page.$('.growth-data-table'), null);
  // The period control is scoped to the trend panel: the chart window changes, every other figure and the page URL stay put.
  const pageFigures = '.growth-metric-card, .growth-saved-card, .growth-bar-row, .growth-priorities .growth-activity-row';
  const figuresBefore = await page.$$eval(pageFigures, nodes => nodes.map(node => node.textContent));
  const defaultWindow = await page.$eval('.growth-trend .growth-section-title p', node => node.textContent);
  await page.click('.growth-trend .growth-periods button:first-child'); await ready();
  assert.equal(await page.$eval('.growth-trend .growth-periods button:first-child', node => node.getAttribute('aria-pressed')), 'true');
  const weekWindow = await page.$eval('.growth-trend .growth-section-title p', node => node.textContent);
  assert.notEqual(weekWindow, defaultWindow, 'the chart window follows the period control');
  const [weekStart, weekEnd] = weekWindow.split(' — ').map(value => Date.parse(value));
  assert.equal(Math.round((weekEnd - weekStart) / 86400000), 6, 'the chart window spans seven days');
  assert.equal(new URLSearchParams((await page.evaluate(() => location.hash)).split('?')[1]).get('days'), '30', 'the page keeps its opening window');
  assert.deepEqual(await page.$$eval(pageFigures, nodes => nodes.map(node => node.textContent)), figuresBefore, 'the rest of the page is unchanged');
  await page.click('.growth-trend .growth-periods button:nth-child(2)'); await ready();
  await page.click('.growth-metric-card:nth-child(4)'); await ready();
  assert.deepEqual(new Set(await page.$$eval('.growth-drawer .growth-activity-copy strong', nodes => nodes.map(node => node.textContent))), new Set(['steady', 'durable']));
  await page.click('.growth-drawer .growth-activity-row'); await ready();
  assert.ok(await page.$('.growth-word-history'));
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('.growth-metric-card:nth-child(4)', node => node === document.activeElement), true);
  await page.click('.growth-recent .growth-section-title button'); await ready();
  const oldTitles = await page.$$eval('.growth-drawer .growth-activity-copy strong', nodes => nodes.map(node => node.textContent));
  failRecords = true;
  await page.click('.growth-drawer .growth-pagination button:last-child'); await ready();
  assert.equal(await page.$$eval('.growth-drawer .growth-activity-row', nodes => nodes.length), 0);
  assert.match(await page.$eval('.growth-drawer [role="alert"]', node => node.textContent), /Synthetic record failure/);
  failRecords = false; await page.click('.growth-drawer [role="alert"] button'); await ready();
  assert.notDeepEqual(await page.$$eval('.growth-drawer .growth-activity-copy strong', nodes => nodes.map(node => node.textContent)), oldTitles);
  await page.keyboard.press('Escape');
  await page.click('.growth-status-list button:first-child'); await ready();
  failRecords = true; await page.select('.growth-detail-status select', 'well-retained'); await ready();
  assert.equal(await page.$$eval('.growth-drawer .growth-activity-row', nodes => nodes.length), 0);
  failRecords = false; await page.click('.growth-drawer [role="alert"] button'); await ready();
  assert.deepEqual(await page.$$eval('.growth-drawer .growth-activity-copy strong', nodes => nodes.map(node => node.textContent)), ['durable']);
  await page.keyboard.press('Escape');
  await page.click('.growth-comparison > summary'); await page.click('.growth-comparison-tabs button:nth-child(2)');
  assert.equal(await page.$$eval('.growth-compare-selectors select', nodes => nodes.length), 2);
  await page.click('.growth-comparison-tabs button:nth-child(3)');
  assert.equal(await page.$eval('.growth-compare-selectors select', node => node.options.length), 28);
  const output = path.resolve('.tmp/my-learning-integration-qa'); fs.mkdirSync(output, { recursive: true });
  for (const route of ['dashboard', 'word-library', 'ask?view=notes', 'handbook', 'coach']) {
    await page.goto(`${base}/#${route}`); await ready();
    assert.equal(await page.$$eval('.my-learning-tabs a[aria-current="page"]', nodes => nodes.length), 1);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewport({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route} overflow at ${width}`);
      // The strip shares both workspace edges at every width, including pages that reserve a right rail for the scroll controls.
      const edges = await page.evaluate(() => {
        const track = document.querySelector('.my-learning-tabs').getBoundingClientRect();
        const workspace = document.querySelector('main.workspace').getBoundingClientRect();
        return { left: track.left - workspace.left, right: track.right - workspace.right };
      });
      assert.ok(Math.abs(edges.left) < 1.5 && Math.abs(edges.right) < 1.5, `${route} tab track edges match content at ${width}`);
      // A responsive resize must not leave the current page's label outside the scrolling track.
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      const clipped = await page.$eval('.my-learning-tabs a[aria-current="page"]', node => {
        const tab = node.getBoundingClientRect(), track = node.parentElement.getBoundingClientRect();
        return tab.left < track.left - 1 || tab.right > track.right + 1;
      });
      assert.equal(clipped, false, `${route} active tab clipped at ${width}`);
      if (route === 'dashboard' && [1440, 390].includes(width)) await page.screenshot({ path: path.join(output, `overview-${width}.png`), fullPage: true });
      if (process.env.IGT_MY_LEARNING_SHOTS === 'top' && [1440, 768, 390].includes(width)) await page.screenshot({ path: path.join(output, `top-${route.replace('?', '-')}-${width}.png`) });
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    for (const width of [1440, 320]) {
      await page.setViewport({ width, height: 1000 });
      // The top nav keeps its own desktop text-zoom behaviour, so only the page content is asserted here.
      assert.equal(await page.evaluate(() => document.querySelector('.workspace').scrollWidth <= innerWidth), true, `${route} content overflow at ${width} with 200% text`);
      if (width === 320) assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route} overflow at 320 with 200% text`);
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  }
  assert.deepEqual(errors, []);
  console.log('My learning integration web smoke passed (synthetic read-only data).');
} finally { await browser?.close(); await server?.close(); }
