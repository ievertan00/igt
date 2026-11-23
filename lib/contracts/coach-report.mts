export type CoachReport = {
  days: number;
  language: string;
  totalChecks: number;
  duplicateInputs?: number;
  sampled: boolean;
  truncated: boolean;
  coverage?: {
    grammar: number;
    excludedOtherSources: number;
    unclassified: number;
    undated: number;
    legacyIncluded?: number;
  };
  markdown: string;
  evidenceIds: string[];
  generatedAt: string;
  cached?: boolean;
  sourceCounts?: { grammar: number; practice: number };
  sourceStatus?: { grammar: string; practice: string };
  evidence: Array<{
    entryId: string;
    timestamp: string;
    original: string;
    correction: string;
    refine?: string;
    source?: "grammar" | "practice";
    practice?: {
      mode: string;
      context: string;
      prompt: string;
      referenceAnswer: string;
      feedback: string;
      hintsUsed: number | null;
    };
  }>;
  savedId?: string;
  savedPath?: string;
  saveError?: string;
};

function invalidField(path: string): never {
  throw Object.assign(new Error(`Invalid Coach Report response at ${path}.`), {
    code: "INVALID_RESPONSE",
    retryable: false,
  });
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidField(path);
  return value as Record<string, unknown>;
}

type FieldType = "string" | "number" | "boolean";

function fields(value: Record<string, unknown>, path: string, type: FieldType, keys: string[], optional = false) {
  for (const key of keys) {
    const field = value[key];
    if (optional && field === undefined) continue;
    if (typeof field !== type || (type === "number" && !Number.isFinite(field))) invalidField(`${path}.${key}`);
  }
}

export function readCoachReportResponse(value: unknown): CoachReport {
  const report = record(value, "report");
  fields(report, "report", "string", ["language", "markdown", "generatedAt"]);
  fields(report, "report", "number", ["days", "totalChecks"]);
  fields(report, "report", "boolean", ["sampled", "truncated"]);

  // Saved reports predate some metadata added by later generators.
  fields(report, "report", "number", ["duplicateInputs"], true);
  fields(report, "report", "boolean", ["cached"], true);
  fields(report, "report", "string", ["savedId", "savedPath", "saveError"], true);
  if (report.coverage !== undefined) {
    const coverage = record(report.coverage, "report.coverage");
    fields(coverage, "report.coverage", "number", ["grammar", "excludedOtherSources", "unclassified", "undated"]);
    fields(coverage, "report.coverage", "number", ["legacyIncluded"], true);
  }
  if (report.sourceCounts !== undefined) {
    fields(record(report.sourceCounts, "report.sourceCounts"), "report.sourceCounts", "number", ["grammar", "practice"]);
  }
  if (report.sourceStatus !== undefined) {
    fields(record(report.sourceStatus, "report.sourceStatus"), "report.sourceStatus", "string", ["grammar", "practice"]);
  }

  if (!Array.isArray(report.evidenceIds)) invalidField("report.evidenceIds");
  report.evidenceIds.forEach((id, index) => {
    if (typeof id !== "string") invalidField(`report.evidenceIds[${index}]`);
  });
  if (!Array.isArray(report.evidence)) invalidField("report.evidence");
  report.evidence.forEach((item, index) => {
    const path = `report.evidence[${index}]`;
    const entry = record(item, path);
    fields(entry, path, "string", ["entryId", "timestamp", "original", "correction"]);
    fields(entry, path, "string", ["refine"], true);
    if (entry.source !== undefined && entry.source !== "grammar" && entry.source !== "practice") {
      invalidField(`${path}.source`);
    }
    if (entry.practice !== undefined) {
      const practice = record(entry.practice, `${path}.practice`);
      fields(practice, `${path}.practice`, "string", ["mode", "context", "prompt", "referenceAnswer", "feedback"]);
      if (practice.hintsUsed !== null) fields(practice, `${path}.practice`, "number", ["hintsUsed"]);
    }
  });
  return value as CoachReport;
}
