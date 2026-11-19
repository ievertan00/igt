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
  synonyms: '', collocations: '', verbForms: '', plural: '', comparative: '', example: `A ${word} example.`, example2: '', example3: '', note: '', memory: '', added: '2025-01-01',
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
      else if (url.pathname === '/dashboard/record') {
        if (failHistory) throw Error('Synthetic history failure');
        const detail = await getGrowthRecord(options, deps);
        // Unknown payloads must not leak through either text fields or debug disclosures.
        detail.raw.internal_debug = { token: 'internal-payload-marker' };
        if (detail.kind === 'word') {
          detail.raw.collocations = { internal: 'internal-object-marker' };
          detail.raw.note = JSON.stringify({ internal: 'internal-json-marker' });
        }
        await json(detail);
      }
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
  // The primary topbar is global: My learning must not resize or re-font it, so an in-place page switch cannot move the main navigation.
  const navFingerprint = () => page.evaluate(() => {
    const rect = sel => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.top, r.left, r.width, r.height].map(value => Math.round(value * 100) / 100); };
    const style = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
    return {
      bar: rect('.topbar'), mark: rect('.brand-mark'),
      wordmark: [style('.brand-wordmark', 'fontSize'), style('.brand-wordmark', 'fontWeight')],
      nav: [style('.top-nav', 'fontSize'), style('.top-nav', 'fontWeight'), style('.top-nav', 'gap')],
      link: [style('.nav-primary > .nav-link', 'fontSize'), style('.nav-primary > .nav-link', 'padding')],
      language: style('.learner-language-menu > summary', 'fontSize'),
    };
  });
  const learningNav = await navFingerprint();
  assert.equal(await page.$eval('.shell', node => node.className.includes('my-learning-shell')), true);
  await page.evaluate(() => { location.hash = '#grammar'; }); await ready();
  const otherNav = await navFingerprint();
  assert.equal(await page.$eval('.shell', node => node.className.includes('my-learning-shell')), false);
  assert.deepEqual(learningNav, otherNav, 'the primary navigation stays identical when switching between My learning and other pages');
  await page.evaluate(() => { location.hash = '#dashboard?days=30'; }); await ready();
  assert.equal(await page.$$eval('.my-learning-tabs a', nodes => nodes.length), 5);
  // The strip names the sub-page, so the title is no longer replaced by the tabs.
  assert.equal(await page.$eval('.my-learning-navigation-title', node => node.textContent), 'Overview');
  assert.equal(await page.$eval('.my-learning-navigation-kicker', node => node.textContent), 'My learning');
  assert.equal(await page.$$eval('h1', nodes => nodes.length), 1, 'exactly one page title on the sub-page');
  assert.equal(await page.$('#workspace-nav .my-learning-menu'), null);
  assert.equal(await page.$eval('#workspace-nav a[href="#dashboard"]', node => node.textContent), 'My learning');
  // The linked Overview uses a transparent underline row, exactly as wide as the content below.
  const track = await page.$eval('.my-learning-tabs', node => {
    const style = getComputedStyle(node), rect = node.getBoundingClientRect();
    return { background: style.backgroundColor, border: style.borderBottomWidth, shadow: style.boxShadow, left: rect.left, width: rect.width };
  });
  const workspace = await page.$eval('main.workspace', node => { const rect = node.getBoundingClientRect(); return { left: rect.left, width: rect.width }; });
  assert.equal(track.background, 'rgba(0, 0, 0, 0)', 'tabs sit directly on the page ground');
  assert.equal(track.border, '1px', 'the row closes with a single hairline');
  assert.equal(track.shadow, 'none', 'no white track surface remains');
  assert.ok(Math.abs(track.left - workspace.left) < 1.5, 'tabs and content share the workspace left edge');
  assert.ok(Math.abs(track.width - workspace.width) < 1.5, 'tabs and content share the workspace width');
  assert.ok(Math.abs(track.left + track.width - workspace.left - workspace.width) < 1.5, 'tabs and content share the workspace right edge');
  // Labels stay at their natural width; the unused right side of the row is blank space, not stretched chips.
  assert.equal(await page.$$eval('.my-learning-tabs a', nodes => nodes.every(node => getComputedStyle(node).flexGrow === '0')), true, 'tabs keep their natural width');
  const labelBounds = await page.$$eval('.my-learning-tabs a', nodes => ({ first: nodes[0].getBoundingClientRect().left, last: nodes[nodes.length - 1].getBoundingClientRect().right }));
  assert.ok(labelBounds.first - track.left < 16, 'tabs start at the row edge');
  assert.ok(track.left + track.width - labelBounds.last > 40, 'the right side of the row is left blank');
  assert.equal(await page.$eval('.my-learning-tabs a[aria-current="page"]', node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)', 'the active tab is an underline, not a chip');
  assert.equal(await page.$eval('.my-learning-tabs a[aria-current="page"]', node => getComputedStyle(node, '::after').backgroundColor), 'rgb(47, 190, 99)', 'the active tab carries the brand underline');
  assert.equal(await page.$eval('.my-learning-navigation', node => getComputedStyle(node).backgroundColor), 'rgb(246, 248, 251)', 'the strip and the page share the calm canvas ground');
  // Only the primary header sticks; the tab strip must travel with the page.
  const navTop = await page.$eval('.my-learning-navigation', node => node.getBoundingClientRect().top);
  const scrolled = await page.evaluate(() => { window.scrollTo(0, 500); return window.scrollY; });
  assert.ok(scrolled > 0, 'the overview page is scrollable');
  const navScrolledTop = await page.$eval('.my-learning-navigation', node => node.getBoundingClientRect().top);
  assert.ok(Math.abs(navScrolledTop - (navTop - scrolled)) < 2, 'the tab strip scrolls with the page instead of sticking');
  await page.evaluate(() => window.scrollTo(0, 0));
  assert.equal(await page.$$eval('.growth-saved-card', nodes => nodes.length), 4);
  assert.equal(await page.$$eval('.growth-metric-card', nodes => nodes.length), 4);
  // Type colour is semantic, not decorative: it moves to the icon tile, while every figure reads in ink.
  assert.equal(new Set(await page.$$eval('.growth-metric-card strong', nodes => nodes.map(node => getComputedStyle(node).color))).size, 1, 'snapshot figures read in ink');
  assert.equal(new Set(await page.$$eval('.growth-saved-card strong', nodes => nodes.map(node => getComputedStyle(node).color))).size, 1, 'saved-material totals read in ink');
  assert.equal(new Set(await page.$$eval('.growth-saved-icon', nodes => nodes.map(node => getComputedStyle(node).color))).size, 4, 'saved-material icon tiles carry four semantic hues');
  assert.equal(await page.$$eval('.growth-saved-chip', nodes => nodes.length), 4, 'each saved-material card carries a period delta chip');
  assert.equal(await page.$$eval('.growth-metric-progress', nodes => nodes.length), 4, 'each snapshot readout carries a progress meter');
  assert.equal(await page.$$eval('.growth-bar-row', nodes => nodes.length), 5);
  assert.equal(await page.$$eval('.growth-distribution .growth-total-badge', nodes => nodes.length), 1, 'error distribution states the period total');
  assert.equal(await page.$$eval('.growth-distribution .growth-focus', nodes => nodes.length), 1, 'the leading category becomes a focus callout');
  assert.equal(await page.$$eval('.growth-diagnosis .growth-priorities', nodes => nodes.length), 1, 'observation and priorities share one card');
  assert.equal(await page.$('.growth-recent'), null, 'the Recent activity panel is removed');
  assert.equal(await page.$$eval('.growth-insights-grid > .growth-panel', nodes => nodes.length), 4, 'the insights grid holds four panels in two rows');
  // The second row gives the state rail one column less and the conclusion card one column more; both stretch to a shared height.
  const secondRow = await page.evaluate(() => {
    const rect = sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    return { grid: rect('.growth-insights-grid'), retention: rect('.growth-retention'), diagnosis: rect('.growth-diagnosis') };
  });
  assert.ok(Math.abs(secondRow.retention.top - secondRow.diagnosis.top) < 1.5, 'retention and observation share a row');
  assert.ok(Math.abs(secondRow.retention.height - secondRow.diagnosis.height) < 1.5, 'word retention matches the observation card height');
  assert.ok(secondRow.diagnosis.width - secondRow.retention.width > 250, 'the observation card owns the extra columns');
  assert.ok(Math.abs(secondRow.retention.width + secondRow.diagnosis.width + 20 - secondRow.grid.width) < 1.5, 'the second row still fills the grid');
  // Both first-row panels were compressed together.
  const firstRow = await page.evaluate(() => {
    const trend = document.querySelector('.growth-trend').getBoundingClientRect();
    const distribution = document.querySelector('.growth-distribution').getBoundingClientRect();
    return { trend: trend.height, distribution: distribution.height, top: trend.top };
  });
  assert.ok(firstRow.trend < 540 && firstRow.distribution < 540, 'the trend/distribution row is compressed');
  assert.ok(Math.abs(firstRow.trend - firstRow.distribution) < 1.5, 'the first row stays equal height');
  // The comparison series is dashed, so its legend key must be dashed too — and both keys are plain line samples with no point marker.
  assert.match(await page.$eval('.growth-chart-legend i.is-previous', node => getComputedStyle(node).backgroundImage), /repeating-linear-gradient/, 'the previous-period key is a dashed swatch');
  const legendKeys = await page.evaluate(() => {
    const current = getComputedStyle(document.querySelector('.growth-chart-legend i:not(.is-previous)'));
    const previous = document.querySelector('.growth-chart-legend i.is-previous');
    const style = getComputedStyle(previous);
    return { radius: [current.borderTopLeftRadius, style.borderTopLeftRadius],
      marker: getComputedStyle(previous, '::after').content, currentMarker: getComputedStyle(document.querySelector('.growth-chart-legend i:not(.is-previous)'), '::after').content };
  });
  assert.equal(legendKeys.radius[0], legendKeys.radius[1], 'both legend keys share one line shape');
  assert.equal(legendKeys.marker, 'none', 'the previous-period legend carries no circle marker');
  assert.equal(legendKeys.currentMarker, 'none', 'the current-period legend carries no circle marker');
  // On the plot: current points are solid, comparison points are hollow, and the invisible hit area never paints a halo around either.
  // The fixture has no observations in the comparison period, so probe the cascade with the exact point markup rather than depend on data.
  assert.ok(await page.$('.growth-series.is-previous'), 'the comparison series is rendered');
  const plotPoints = await page.evaluate(() => {
    const resolve = name => {
      const probe = document.createElement('span'); probe.style.color = `var(${name})`;
      document.body.appendChild(probe); const result = getComputedStyle(probe).color; probe.remove(); return result;
    };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'growth-chart'); svg.style.cssText = 'position:absolute;opacity:0;pointer-events:none';
    svg.innerHTML = '<g class="growth-series"><g role="button"><circle class="growth-point-hit" r="12" /><circle r="4" /></g></g>'
      + '<g class="growth-series is-previous"><g role="button"><circle class="growth-point-hit" r="12" /><circle r="4" /></g></g>';
    document.querySelector('.learning-dashboard').appendChild(svg);
    const read = selector => {
      const circles = [...svg.querySelectorAll(`${selector} [role="button"] circle`)];
      const hit = getComputedStyle(circles.find(node => node.classList.contains('growth-point-hit')));
      const dot = getComputedStyle(circles[circles.length - 1]);
      return { hitFill: hit.fill, hitStroke: hit.stroke, fill: dot.fill, stroke: dot.stroke, strokeWidth: parseFloat(dot.strokeWidth) };
    };
    const result = { current: read('.growth-series:not(.is-previous)'), previous: read('.growth-series.is-previous'),
      paper: resolve('--paper'), accent: resolve('--accent'), control: resolve('--control') };
    svg.remove();
    return result;
  });
  for (const key of ['current', 'previous']) {
    assert.equal(plotPoints[key].hitFill, 'rgba(0, 0, 0, 0)', `the ${key} hit area is invisible`);
    assert.equal(plotPoints[key].hitStroke, 'none', `the ${key} hit area has no outline`);
  }
  assert.equal(plotPoints.current.fill, plotPoints.accent, 'current-period points are solid green');
  assert.equal(plotPoints.previous.fill, plotPoints.paper, 'previous-period points are hollow (no filled outer circle)');
  assert.equal(plotPoints.previous.stroke, plotPoints.control, 'previous-period points are outlined in the comparison colour');
  assert.ok(plotPoints.previous.strokeWidth >= 2, 'the hollow comparison ring is clearly visible');
  // The legend moved above the plot to its right edge, and the taller chart reaches the card's bottom padding.
  const chartLegend = await page.evaluate(() => {
    const card = document.querySelector('.growth-trend').getBoundingClientRect();
    const svg = document.querySelector('.growth-chart').getBoundingClientRect();
    const legend = document.querySelector('.growth-chart-legend');
    const box = legend.getBoundingClientRect();
    const controls = document.querySelector('.growth-trend-controls').getBoundingClientRect();
    const current = document.querySelector('.growth-chart-legend i:not(.is-previous)');
    const previous = document.querySelector('.growth-chart-legend i.is-previous');
    const size = node => { const style = getComputedStyle(node); return [parseFloat(style.width), parseFloat(style.height)]; };
    return { above: box.bottom <= svg.top + 1, rightAligned: Math.abs(legend.querySelector('span:last-child').getBoundingClientRect().right - controls.right) < 2,
      blank: card.bottom - svg.bottom, current: size(current), previous: size(previous) };
  });
  assert.ok(chartLegend.above && chartLegend.rightAligned, 'the legend sits above the plot at its right edge');
  assert.ok(chartLegend.blank <= 26, 'the chart reaches the card bottom instead of leaving a blank band');
  assert.deepEqual(chartLegend.previous, chartLegend.current, 'both legend keys share one length and weight');
  // Optical inset: the kicker and both section headings start a few pixels inside the content edge, never outside it.
  const headingNudge = await page.evaluate(() => {
    const base = document.querySelector('.growth-saved-card').getBoundingClientRect().left;
    const offset = sel => document.querySelector(sel).getBoundingClientRect().left - base;
    return ['.my-learning-navigation-kicker', '.growth-saved-heading h2', '.growth-snapshot-heading h2'].map(offset);
  });
  assert.ok(headingNudge.every(value => value > 1 && value < 12 && Math.abs(value - headingNudge[0]) < 1.5), 'section headings share one small optical inset inside the content edge');
  // Renaming keeps the entry to all records (the removed panel's old action) and the practice log reachable.
  assert.equal(await page.$eval('.growth-saved-heading .growth-heading-action', node => node.textContent.trim()), 'View recent activity');
  assert.equal(await page.$eval('.growth-heading-actions a', node => node.getAttribute('href')), '#dashboard?view=practice-log');
  // The two summary entries are real navigation, not decoration.
  await page.click('.growth-saved-heading .growth-heading-action'); await ready();
  assert.ok(await page.$('.growth-drawer'), 'View recent activity opens the record drawer');
  await page.keyboard.press('Escape');
  await page.click('.growth-focus-link'); await ready();
  assert.ok(await page.$('.growth-drawer'), 'the focus callout opens the leading category');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('.growth-priorities h2', node => node.textContent), 'Top priorities');
  assert.equal(await page.$$eval('.growth-priorities .growth-activity-row', nodes => nodes.length), 3);
  // The list is capped at three rows; the tag states the cap and the actual count together.
  assert.equal(await page.$eval('.growth-priorities .growth-priority-count', node => node.textContent), '3 / 3');
  // Compact text, balanced padding: the freed line height lives at the top of each bar instead of below it.
  const priorityBarShape = await page.evaluate(() => {
    const row = document.querySelector('.growth-priority-row');
    const rowStyle = getComputedStyle(row);
    const title = getComputedStyle(row.querySelector('.growth-priority-title strong'));
    const note = getComputedStyle(row.querySelector('.growth-priority-body small'));
    return { top: parseFloat(rowStyle.paddingTop), bottom: parseFloat(rowStyle.paddingBottom),
      titleLine: parseFloat(title.lineHeight), noteLine: parseFloat(note.lineHeight),
      height: row.getBoundingClientRect().height };
  });
  assert.ok(priorityBarShape.top >= 10 && priorityBarShape.bottom >= 10 && Math.abs(priorityBarShape.top - priorityBarShape.bottom) < 1, 'priority bars give their top edge as much room as the bottom');
  assert.ok(priorityBarShape.titleLine <= 18 && priorityBarShape.noteLine <= 16 && priorityBarShape.height <= 66, 'priority text stays short and the bars stay compact');
  await page.click('.growth-priorities .growth-activity-row'); await ready();
  assert.ok(await page.$('.growth-drawer .growth-activity-row'));
  await page.keyboard.press('Escape');
  await page.focus('select[aria-label="Metric"]'); await page.select('select[aria-label="Metric"]', 'score');
  assert.equal(await page.$eval('select[aria-label="Metric"]', node => node === document.activeElement), true);
  assert.equal(await page.$('.growth-filters'), null);
  assert.equal(await page.$('.growth-data-table'), null);
  // Trend controls: one full-width period row, compact date inputs, and no descriptive footnotes.
  const trendLayout = await page.evaluate(() => {
    const panel = document.querySelector('.growth-trend');
    const style = getComputedStyle(panel);
    const contentWidth = panel.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const periodsWidth = panel.querySelector('.growth-periods').getBoundingClientRect().width;
    const dateInputs = [...panel.querySelectorAll('.growth-date-range input[type="date"]')].map(node => node.getBoundingClientRect().height);
    return { contentWidth, periodsWidth, dateInputs, notes: panel.querySelectorAll('.growth-panel-note').length };
  });
  assert.ok(Math.abs(trendLayout.periodsWidth - trendLayout.contentWidth) < 1.5, 'period buttons fill the panel width');
  assert.equal(trendLayout.dateInputs.length, 2);
  assert.ok(trendLayout.dateInputs.every(height => height <= 34), 'date inputs stay compact');
  assert.equal(trendLayout.notes, 0, 'trend panel carries no descriptive notes');
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
  assert.equal(await page.$('.growth-original-record'), null, 'raw vocabulary payload is never rendered');
  assert.doesNotMatch(await page.$eval('.growth-drawer', node => node.textContent), /internal-(?:payload|object|json)-marker/);
  assert.doesNotMatch(await page.$eval('.growth-drawer', node => node.textContent), /Original record and fields|Saved report evidence|"cardId"|"feedback"|\[object Object\]/);
  await page.click('.growth-word-history details summary');
  assert.match(await page.$eval('.growth-word-history details', node => node.textContent), /View review details/);
  await page.click('.growth-word-history details button'); await ready();
  assert.equal(await page.$('.growth-original-record'), null, 'raw review payload is never rendered');
  assert.match(await page.$eval('.growth-drawer', node => node.textContent), /Your answer|Good/);
  assert.doesNotMatch(await page.$eval('.growth-drawer', node => node.textContent), /"cardId"|"intervalDays"|"feedback"/);
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('.growth-metric-card:nth-child(4)', node => node === document.activeElement), true);
  await page.click('.growth-saved-heading .growth-heading-action'); await ready();
  const oldTitles = await page.$$eval('.growth-drawer .growth-activity-copy strong', nodes => nodes.map(node => node.textContent));
  failRecords = true;
  await page.click('.growth-drawer .growth-pagination button:last-child'); await ready();
  assert.equal(await page.$$eval('.growth-drawer .growth-activity-row', nodes => nodes.length), 0);
  assert.match(await page.$eval('.growth-drawer [role="alert"]', node => node.textContent), /The records could not be loaded/);
  assert.doesNotMatch(await page.$eval('.growth-drawer [role="alert"]', node => node.textContent), /Synthetic record failure/);
  failRecords = false; await page.click('.growth-drawer [role="alert"] button'); await ready();
  assert.notDeepEqual(await page.$$eval('.growth-drawer .growth-activity-copy strong', nodes => nodes.map(node => node.textContent)), oldTitles);
  await page.keyboard.press('Escape');
  await page.click('.growth-status-list button:first-child'); await ready();
  failRecords = true; await page.select('.growth-detail-status select', 'well-retained'); await ready();
  assert.equal(await page.$$eval('.growth-drawer .growth-activity-row', nodes => nodes.length), 0);
  failRecords = false; await page.click('.growth-drawer [role="alert"] button'); await ready();
  assert.deepEqual(await page.$$eval('.growth-drawer .growth-activity-copy strong', nodes => nodes.map(node => node.textContent)), ['durable']);
  await page.keyboard.press('Escape');
  // Overview carries no folded disclosure panels, no explanatory notes, and no page footer evidence copy.
  assert.equal(await page.$('.growth-comparison'), null, 'Compare evidence panel is removed');
  assert.equal(await page.$('.growth-evidence-footer'), null, 'Overview page footer is removed');
  assert.equal(await page.$$eval('.growth-panel-note', nodes => nodes.length), 0, 'explanatory panel notes are removed');
  assert.equal(await page.$('.growth-distribution .growth-tag'), null, 'Error distribution n= badge is removed');
  assert.equal(await page.$$eval('.growth-section-title p', nodes => nodes.length), 1, 'only the trend date range remains as a section detail');
  assert.doesNotMatch(await page.$eval('.learning-dashboard', node => node.textContent), /Compare evidence|Sources and evidence boundaries|counted once per category|Based on locally saved records|do not prove mastery|independent of the time filter|Click a bar to inspect/);
  const output = path.resolve('.tmp/my-learning-integration-qa'); fs.mkdirSync(output, { recursive: true });
  const titleAnchor = {};
  for (const route of ['dashboard', 'word-library', 'ask?view=notes', 'handbook', 'coach']) {
    await page.goto(`${base}/#${route}`); await ready();
    assert.equal(await page.$$eval('.my-learning-tabs a[aria-current="page"]', nodes => nodes.length), 1);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewport({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route} overflow at ${width}`);
      // The sub-page name (kicker + title) must sit at the same inset on every My learning page and width.
      const titleInset = await page.evaluate(() => {
        const content = document.querySelector('main.workspace').getBoundingClientRect().left;
        const kicker = document.querySelector('.my-learning-navigation-kicker').getBoundingClientRect().left - content;
        const title = document.querySelector('.my-learning-navigation-title').getBoundingClientRect().left - content;
        return { kicker: Math.round(kicker * 100) / 100, title: Math.round(title * 100) / 100 };
      });
      assert.ok(titleInset.kicker > 1 && titleInset.kicker < 12, `${route} sub-page name starts just inside the content edge at ${width}`);
      if (titleAnchor[width] === undefined) titleAnchor[width] = titleInset;
      else assert.ok(Math.abs(titleInset.kicker - titleAnchor[width].kicker) < 1.5 && Math.abs(titleInset.title - titleAnchor[width].title) < 1.5, `${route} shares the sub-page name position at ${width}`);
      // The strip shares both workspace edges at every width; scroll controls are fixed overlays and reserve no rail.
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
