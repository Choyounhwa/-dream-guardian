export const SETTINGS_SCREEN_ID = "settings";
export const SETTINGS_VERSION = "1.0.0";

const SLOT = Object.freeze({ w: 680, h: 110 });

export const SETTINGS_PUBLISHED = Object.freeze({
  design: Object.freeze({ width: 1080, height: 2160 }),
  bounds: Object.freeze({ x: 140, y: 480, w: 800, h: 1080 }),
  modal: Object.freeze({ x: 140, y: 480, w: 800, h: 1080 }),
  closeBtn: Object.freeze({ x: 850, y: 510, w: 60, h: 60 }),
  buttons: Object.freeze({
    camera: Object.freeze({ x: 200, y: 620, w: SLOT.w, h: SLOT.h }),
    fullscreen: Object.freeze({ x: 200, y: 750, w: SLOT.w, h: SLOT.h }),
    skeleton: Object.freeze({ x: 200, y: 880, w: SLOT.w, h: SLOT.h }),
    sound: Object.freeze({ x: 200, y: 1010, w: SLOT.w, h: SLOT.h }),
    locomotion: Object.freeze({ x: 200, y: 1140, w: SLOT.w, h: SLOT.h }),
    fontScale: Object.freeze({ x: 200, y: 1270, w: SLOT.w, h: SLOT.h }),
    highContrast: Object.freeze({ x: 200, y: 1400, w: SLOT.w, h: SLOT.h }),
  }),
});

export const SETTINGS_LOCK_REASONS = Object.freeze({
  settingsWriteBlocked: "settings-lock:player-settings-write-blocked",
  profileClosed: "settings-lock:profile-closed",
  unknownBaseline: "settings-lock:unknown-baseline",
  unknownField: "settings-lock:unknown-field",
  exportBlocked: "settings-lock:export-blocked",
});

export const SETTINGS_ALLOWED_FIELDS = Object.freeze([
  "modal",
  "closeBtn",
  "camera",
  "fullscreen",
  "skeleton",
  "sound",
  "locomotion",
  "fontScale",
  "highContrast",
]);

const PROFILE_KEYS = new Set(["profile", "profileInput", "inputs"]);
const BASELINE_KEYS = new Set(["unknownBaseline", "baseline", "presetHash"]);
const SETTINGS_WRITE_KEYS = new Set([
  "camera",
  "sound",
  "accessibility",
  "fontScale",
  "highContrast",
  "localStorage",
  "indexedDB",
  "cameraEnabled",
  "soundEnabled",
  "skeletonEnabled",
  "fullscreen",
  "locomotion",
  "save",
  "persist",
]);

export type SettingsRegion = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  role: "modal" | "close" | "button";
  locked: boolean;
  reason: string;
};

function region(
  id: string,
  slot: { x: number; y: number; w: number; h: number },
  role: SettingsRegion["role"],
): SettingsRegion {
  return Object.freeze({
    id,
    x: slot.x,
    y: slot.y,
    width: slot.w,
    height: slot.h,
    role,
    locked: true,
    reason: SETTINGS_LOCK_REASONS.exportBlocked,
  });
}

export const SETTINGS_REGIONS: readonly SettingsRegion[] = Object.freeze([
  region("settings-modal", SETTINGS_PUBLISHED.modal, "modal"),
  region("settings-close", SETTINGS_PUBLISHED.closeBtn, "close"),
  region("settings-camera", SETTINGS_PUBLISHED.buttons.camera, "button"),
  region("settings-fullscreen", SETTINGS_PUBLISHED.buttons.fullscreen, "button"),
  region("settings-skeleton", SETTINGS_PUBLISHED.buttons.skeleton, "button"),
  region("settings-sound", SETTINGS_PUBLISHED.buttons.sound, "button"),
  region("settings-locomotion", SETTINGS_PUBLISHED.buttons.locomotion, "button"),
  region("settings-font-scale", SETTINGS_PUBLISHED.buttons.fontScale, "button"),
  region("settings-high-contrast", SETTINGS_PUBLISHED.buttons.highContrast, "button"),
]);

export type SettingsFixture = {
  id: string;
  screen: "settings";
  open: boolean;
  largeText: boolean;
  mockedOptions: boolean;
  writesPlayerSettings: false;
  profileInputs: "closed";
};

export const SETTINGS_FIXTURES: readonly SettingsFixture[] = Object.freeze([
  Object.freeze({
    id: "settings-open",
    screen: "settings" as const,
    open: true,
    largeText: false,
    mockedOptions: false,
    writesPlayerSettings: false as const,
    profileInputs: "closed" as const,
  }),
  Object.freeze({
    id: "settings-closed",
    screen: "settings" as const,
    open: false,
    largeText: false,
    mockedOptions: false,
    writesPlayerSettings: false as const,
    profileInputs: "closed" as const,
  }),
  Object.freeze({
    id: "settings-large-text",
    screen: "settings" as const,
    open: true,
    largeText: true,
    mockedOptions: false,
    writesPlayerSettings: false as const,
    profileInputs: "closed" as const,
  }),
  Object.freeze({
    id: "settings-mocked-options",
    screen: "settings" as const,
    open: true,
    largeText: false,
    mockedOptions: true,
    writesPlayerSettings: false as const,
    profileInputs: "closed" as const,
  }),
]);

export const SETTINGS_CONTRACT = Object.freeze({
  registered: true as const,
  screen: "settings" as const,
  version: SETTINGS_VERSION,
  scope: "settings",
  requiredFields: SETTINGS_ALLOWED_FIELDS,
  cardFields: Object.freeze([]),
  workoutFields: Object.freeze([]),
  supportStatus: "locked" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  units: Object.freeze({ length: "px", design: "1080x2160" }),
  ranges: Object.freeze({
    x: Object.freeze({ min: 0, max: SETTINGS_PUBLISHED.design.width }),
    y: Object.freeze({ min: 0, max: SETTINGS_PUBLISHED.design.height }),
  }),
  profileInputs: "closed" as const,
  protectedRegions: SETTINGS_REGIONS,
  fixtures: SETTINGS_FIXTURES,
  fingerprint: "settings@1.0.0:modal+close+button-slots+fixture-only",
});

export function resolveSettingsProperty(key: string): { ok: false; locked: true; reason: string } {
  if (PROFILE_KEYS.has(key)) {
    return { ok: false, locked: true, reason: SETTINGS_LOCK_REASONS.profileClosed };
  }
  if (BASELINE_KEYS.has(key)) {
    return { ok: false, locked: true, reason: SETTINGS_LOCK_REASONS.unknownBaseline };
  }
  return { ok: false, locked: true, reason: SETTINGS_LOCK_REASONS.unknownField };
}

export function attemptPersistSettings(
  key: string,
  _value: unknown,
): { ok: false; reason: string } {
  if (!SETTINGS_WRITE_KEYS.has(key) && key.length > 80) {
    return { ok: false, reason: SETTINGS_LOCK_REASONS.unknownField };
  }
  return { ok: false, reason: SETTINGS_LOCK_REASONS.settingsWriteBlocked };
}

export function rejectSettingsExport(): { ok: false; reason: string } {
  return { ok: false, reason: SETTINGS_LOCK_REASONS.exportBlocked };
}

