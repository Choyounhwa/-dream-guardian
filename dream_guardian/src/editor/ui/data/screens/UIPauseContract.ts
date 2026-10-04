export const PAUSE_SCREEN_ID = "pause";
export const PAUSE_VERSION = "1.0.0";

export const PAUSE_PUBLISHED = Object.freeze({
  design: Object.freeze({ width: 1080, height: 2160 }),
  bounds: Object.freeze({ x: 140, y: 720, w: 800, h: 720 }),
  modal: Object.freeze({ x: 140, y: 720, w: 800, h: 720 }),
  resumeBtn: Object.freeze({ x: 200, y: 980, w: 680, h: 130 }),
  quitBtn: Object.freeze({ x: 200, y: 1160, w: 680, h: 130 }),
});

export const PAUSE_LOCK_REASONS = Object.freeze({
  pauseBlocked: "pause-lock:pause-callback-blocked",
  resumeBlocked: "pause-lock:resume-callback-blocked",
  quitBlocked: "pause-lock:quit-to-menu-blocked",
  profileClosed: "pause-lock:profile-closed",
  unknownBaseline: "pause-lock:unknown-baseline",
  unknownField: "pause-lock:unknown-field",
  exportBlocked: "pause-lock:export-blocked",
});

export const PAUSE_ALLOWED_FIELDS = Object.freeze(["modal", "resumeBtn", "quitBtn"]);

const PROFILE_KEYS = new Set(["profile", "profileInput", "inputs"]);
const BASELINE_KEYS = new Set(["unknownBaseline", "baseline", "presetHash"]);
const ACTION_KEYS = new Set(["pause", "resume", "quit-to-menu", "quit", "quitToMenu"]);

export type PauseRegion = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  role: "modal" | "resume" | "quit";
  locked: boolean;
  reason: string;
};

function region(
  id: string,
  slot: { x: number; y: number; w: number; h: number },
  role: PauseRegion["role"],
): PauseRegion {
  return Object.freeze({
    id,
    x: slot.x,
    y: slot.y,
    width: slot.w,
    height: slot.h,
    role,
    locked: true,
    reason: PAUSE_LOCK_REASONS.exportBlocked,
  });
}

export const PAUSE_REGIONS: readonly PauseRegion[] = Object.freeze([
  region("pause-modal", PAUSE_PUBLISHED.modal, "modal"),
  region("pause-resume", PAUSE_PUBLISHED.resumeBtn, "resume"),
  region("pause-quit", PAUSE_PUBLISHED.quitBtn, "quit"),
]);

export type PauseFixture = {
  id: string;
  screen: "pause";
  open: boolean;
  mockedResume: boolean;
  mockedMenu: boolean;
  invokesPause: false;
  profileInputs: "closed";
};

export const PAUSE_FIXTURES: readonly PauseFixture[] = Object.freeze([
  Object.freeze({
    id: "pause-open",
    screen: "pause" as const,
    open: true,
    mockedResume: false,
    mockedMenu: false,
    invokesPause: false as const,
    profileInputs: "closed" as const,
  }),
  Object.freeze({
    id: "pause-closed",
    screen: "pause" as const,
    open: false,
    mockedResume: false,
    mockedMenu: false,
    invokesPause: false as const,
    profileInputs: "closed" as const,
  }),
  Object.freeze({
    id: "pause-resume-mock",
    screen: "pause" as const,
    open: true,
    mockedResume: true,
    mockedMenu: false,
    invokesPause: false as const,
    profileInputs: "closed" as const,
  }),
  Object.freeze({
    id: "pause-menu-mock",
    screen: "pause" as const,
    open: true,
    mockedResume: false,
    mockedMenu: true,
    invokesPause: false as const,
    profileInputs: "closed" as const,
  }),
]);

export const PAUSE_CONTRACT = Object.freeze({
  registered: true as const,
  screen: "pause" as const,
  version: PAUSE_VERSION,
  scope: "pause",
  requiredFields: PAUSE_ALLOWED_FIELDS,
  cardFields: Object.freeze([] as string[]),
  workoutFields: Object.freeze([] as string[]),
  supportStatus: "locked" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  fingerprint: "pause@1.0.0:modal+resume+quit",
  protectedRegions: Object.freeze(
    PAUSE_REGIONS.map((item) =>
      Object.freeze({ id: item.id, x: item.x, y: item.y, width: item.width, height: item.height }),
    ),
  ),
});

const SLOT_VALUES: Record<string, { x: number; y: number; w: number; h: number }> = {
  modal: PAUSE_PUBLISHED.modal,
  resumeBtn: PAUSE_PUBLISHED.resumeBtn,
  quitBtn: PAUSE_PUBLISHED.quitBtn,
};

export function resolvePauseProperty(key: string):
  | { ok: true; locked: true; reason: string; value: { x: number; y: number; w: number; h: number } }
  | { ok: false; locked: true; reason: string } {
  if (key.length > 80) {
    return { ok: false, locked: true, reason: PAUSE_LOCK_REASONS.unknownField };
  }
  if (PROFILE_KEYS.has(key)) {
    return { ok: false, locked: true, reason: PAUSE_LOCK_REASONS.profileClosed };
  }
  if (BASELINE_KEYS.has(key)) {
    return { ok: false, locked: true, reason: PAUSE_LOCK_REASONS.unknownBaseline };
  }
  if (ACTION_KEYS.has(key)) {
    return { ok: false, locked: true, reason: PAUSE_LOCK_REASONS.pauseBlocked };
  }
  const value = SLOT_VALUES[key];
  if (!value) {
    return { ok: false, locked: true, reason: PAUSE_LOCK_REASONS.unknownField };
  }
  return { ok: true, locked: true, reason: PAUSE_LOCK_REASONS.exportBlocked, value };
}

export type PauseActionName = "pause" | "resume" | "quit-to-menu";

export function attemptPauseAction(
  action: string,
  _callbacks?: {
    pause?: () => void;
    resume?: () => void;
    quitToMenu?: () => void;
  },
): { blocked: true; reason: string } {
  if (action === "resume") {
    return { blocked: true, reason: PAUSE_LOCK_REASONS.resumeBlocked };
  }
  if (action === "quit-to-menu" || action === "quit") {
    return { blocked: true, reason: PAUSE_LOCK_REASONS.quitBlocked };
  }
  return { blocked: true, reason: PAUSE_LOCK_REASONS.pauseBlocked };
}

export function rejectPauseExport(): { blocked: true; reason: string } {
  return { blocked: true, reason: PAUSE_LOCK_REASONS.exportBlocked };
}
