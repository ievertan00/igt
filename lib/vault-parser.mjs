import fs from 'node:fs';
import path from 'node:path';

export function parseVocab(content, now = new Date()) {
  const entries = content.match(/###\s+.+/g) || [];
  const addedDates = content.match(/\*Added:\s+(\d{4}-\d{2}-\d{2})\*/g) || [];
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  const addedThisWeek = addedDates.filter(d => {
    const match = d.match(/\d{4}-\d{2}-\d{2}/);
    if (!match) return false;
    const date = new Date(match[0]);
    return date >= oneWeekAgo;
  }).length;

  return { total: entries.length, addedThisWeek };
}

export function parsePractice(content) {
  const matches = content.match(/(\d+)\/(\d+)\s+\((\d+)%\)/g) || [];
  const scores = matches.slice(0, 5).map(m => {
    const match = m.match(/\((\d+)%\)/);
    return match ? parseInt(match[1]) : 0;
  });
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : 0;
  return { avgScore: avg };
}

export function parseAssessmentReport(content, filename = "") {
  // Extract level like **C1**
  const levelMatch = content.match(/Estimated CEFR Level:\s+\*\*(A1|A2|B1|B2|C1|C2)\*\*/i);
  const level = levelMatch ? levelMatch[1].toUpperCase() : null;

  // Extract date from filename assessment_2026-04-17.md or from content
  let date = null;
  const fileDateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
  if (fileDateMatch) {
    date = fileDateMatch[1];
  } else {
    const generatedMatch = content.match(/\*\*Generated\*\*:\s+(\d{4}-\d{2}-\d{2})/i);
    if (generatedMatch) date = generatedMatch[1];
  }

  return { level, date };
}
