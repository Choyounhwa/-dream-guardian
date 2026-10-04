export const RESULT_SCREEN_ID = "result";
export const RESULT_VERSION = "1.0.0";

export const RESULT_PUBLISHED = Object.freeze({
  design: Object.freeze({ width: 1080, height: 2160 }),
  bounds: Object.freeze({ x: 100, y: 240, w: 880, h: 1580 }),
  panel: Object.freeze({ x: 100, y: 240, w: 880, h: 1580 }),
  title: Object.freeze({ x: 540, y: 360 }),
  stars: Object.freeze({ x: 540, y: 490 }),
  chapter: Object.freeze({ x: 540, y: 580 }),
  statLineHeight: 74,
});

export const RESULT_LOCK_REASONS = Object.freeze({
  recordWriteBlocked: "result-lock:record-write-blocked",
  profileClosed: "result-lock:profile-closed",
  unknownBaseline: "result-lock:unknown-baseline",
  unknownField: "result-lock:unknown-field",
  exportBlocked: "result-lock:export-blocked",
});

export const RESULT_ALLOWED_FIELDS = Object.freeze(["panel", "title", "stars", "chapter", "statLineHeight"]);

const PROFILE_KEYS = new Set(["profile", "profileInput", "inputs"]);
const BASELINE_KEYS = new Set(["unknownBaseline", "baseline", "presetHash"]);

export type ResultRegion = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  role: "panel" | "title" | "stars" | "chapter";
  locked: boolean;
  reason: string;
};

export const RESULT_REGIONS: readonly ResultRegion[] = Object.freeze([
  Object.freeze({
    id: "result-panel",
    x: RESULT_PUBLISHED.panel.x,
    y: RESULT_PUBLISHED.panel.y,
    width: RESULT_PUBLISHED.panel.w,
    height: RESULT_PUBLISHED.panel.h,
    role: "panel" as const,
    locked: true,
    reason: RESULT_LOCK_REASONS.exportBlocked,
  }),
  Object.freeze({
    id: "result-title",
    x: RESULT_PUBLISHED.title.x,
    y: RESULT_PUBLISHED.title.y,
    width: 0,
    height: 0,
    role: "title" as const,
    locked: true,
    reason: RESULT_LOCK_REASONS.exportBlocked,
  }),
  Object.freeze({
    id: "result-stars",
    x: RESULT_PUBLISHED.stars.x,
    y: RESULT_PUBLISHED.stars.y,
    width: 0,
    height: 0,
    role: "stars" as const,
    locked: true,
    reason: RESULT_LOCK_REASONS.exportBlocked,
  }),
  Object.freeze({
    id: "result-chapter",
    x: RESULT_PUBLISHED.chapter.x,
    y: RESULT_PUBLISHED.chapter.y,
    width: 0,
    height: 0,
    role: "chapter" as const,
    locked: true,
    reason: RESULT_LOCK_REASONS.exportBlocked,
  }),
]);

export type ResultPropertyResolution = {
  status: "locked";
  reason: string;
  exportEnabled: false;
};

export function resolveResultProperty(key: string): ResultPropertyResolution {
  if (PROFILE_KEYS.has(key)) {
    return { status: "locked", reason: RESULT_LOCK_REASONS.profileClosed, exportEnabled: false };
  }
  if (BASELINE_KEYS.has(key)) {
    return { status: "locked", reason: RESULT_LOCK_REASONS.unknownBaseline, exportEnabled: false };
  }
  if ((RESULT_ALLOWED_FIELDS as readonly string[]).includes(key)) {
    return { status: "locked", reason: RESULT_LOCK_REASONS.exportBlocked, exportEnabled: false };
  }
  return { status: "locked", reason: RESULT_LOCK_REASONS.unknownField, exportEnabled: false };
}

export type ResultPersistAttempt = {
  blocked: true;
  persisted: false;
  reason: string;
};

export function attemptPersistResultRecord(_record: unknown): ResultPersistAttempt {
  return {
    blocked: true,
    persisted: false,
    reason: RESULT_LOCK_REASONS.recordWriteBlocked,
  };
}

export function rejectResultExport(): { ok: false; reason: string; exportEnabled: false } {
  return { ok: false, reason: RESULT_LOCK_REASONS.exportBlocked, exportEnabled: false };
}

export type ResultFixture = {
  id: string;
  screen: "result";
  version: "1.0.0";
  closed: true;
  outcome?: "victory" | "defeat";
  rank?: string;
  stats: string;
};

const LONG_STATS = "steps:99999 squats:99999 jumps:99999 dwell:99999 kcal:99999.99 combo:99999 accuracy:100.00";

export const RESULT_FIXTURES: readonly ResultFixture[] = Object.freeze([
  Object.freeze({
    id: "result-victory",
    screen: "result" as const,
    version: "1.0.0" as const,
    closed: true as const,
    outcome: "victory" as const,
    rank: "S",
    stats: "score:100",
  }),
  Object.freeze({
    id: "result-defeat",
    screen: "result" as const,
    version: "1.0.0" as const,
    closed: true as const,
    outcome: "defeat" as const,
    rank: "C",
    stats: "score:0",
  }),
  Object.freeze({
    id: "result-long-stats",
    screen: "result" as const,
    version: "1.0.0" as const,
    closed: true as const,
    outcome: "victory" as const,
    rank: "A",
    stats: LONG_STATS,
  }),
  Object.freeze({
    id: "result-rank",
    screen: "result" as const,
    version: "1.0.0" as const,
    closed: true as const,
    rank: "A",
    stats: "rank-only",
  }),
]);

export const RESULT_CONTRACT = Object.freeze({
  registered: true as const,
  screen: RESULT_SCREEN_ID,
  version: RESULT_VERSION,
  scope: "result",
  requiredFields: Object.freeze(["panel", "title", "stars", "chapter"]),
  cardFields: Object.freeze([] as string[]),
  workoutFields: Object.freeze([] as string[]),
  supportStatus: "locked" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  fingerprint: "result@1.0.0:panel+title+stars+chapter+fixture-only",
  units: Object.freeze({ length: "px", design: "1080x2160" }),
  ranges: Object.freeze({
    x: Object.freeze({ min: 0, max: 1080 }),
    y: Object.freeze({ min: 0, max: 2160 }),
    statLineHeight: Object.freeze({ min: 1, max: 2160 }),
  }),
  protectedRegions: Object.freeze(RESULT_REGIONS),
  fixtures: RESULT_FIXTURES,
});
