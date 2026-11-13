export type GrowthFilters = {
  start: string; end: string; module: string; category: string; errorType: string;
  status: string;
};
export type GrowthRecord = {
  key: string; kind: string; module: string; timestamp: string | null; title: string;
  types: string[]; targets: string[]; correct: boolean | null; score: number | null; status: string | null;
};
export type GrowthRecords = { records: GrowthRecord[]; total: number; offset: number; limit: number; hasMore: boolean };
export type GrowthMetric = {
  recall: { value: number | null; correct: number; n: number };
  translation: { value: number | null; n: number };
  diagnosed: { count: number; n: number };
};
export type GrowthPoint = { start: string; end: string; value: number | null; numerator: number | null; denominator: number };
export type GrowthError = { type: string; category: string; count: number; distinct: number };
export type GrowthInventory = { total: number | null; inWindow: number; latest: string | null };
export type GrowthOverview = {
  filters: GrowthFilters; taxonomy: Record<string, string[]>; asOf: string;
  inventory: { words: number | null; grammar: number | null; notes: number | null; reports: number | null };
  inventoryDetail?: Record<'words' | 'grammar' | 'notes' | 'reports', GrowthInventory>;
  metrics: GrowthMetric; previous: { filters: { start: string; end: string }; metrics: GrowthMetric };
  categories: { category: string; count: number }[]; errorTypes: GrowthError[];
  series: Record<string, { current: GrowthPoint[]; previous: GrowthPoint[] }>;
  comparisons: { modules: (GrowthMetric & { module: string })[]; types: GrowthError[] };
  retention: { total: number | null; distribution: Record<string, number>; available: boolean };
  diagnosis: { patterns: GrowthError[]; recall: GrowthMetric['recall']; writingChecks: number };
  priorities: GrowthError[]; recent: GrowthRecord[]; total: number; undated: number;
  coverage: { source: string; status: string; count?: number }[];
};
export type GrowthDetail = GrowthRecord & {
  original: string | null; correction: string | null; prompt: string | null; content: string | null;
  raw: Record<string, unknown>;
  related: GrowthRecord[];
  history: { total: number; offset: number; hasMore: boolean; records: (GrowthRecord & {
    original: string; correction: string; audioPlayed: boolean | null; rating: string | null; intervalDays: number | null;
  })[] };
};
