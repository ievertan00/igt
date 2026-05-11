import fs from 'node:fs';
import path from 'node:path';

export function parseVocab(content) {
  const entries = content.match(/###\s+.+/g) || [];
  const addedDates = content.match(/\*Added:\s+(\d{4}-\d{2}-\d{2})\*/g) || [];
  const oneWeekAgo = new Date();
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
