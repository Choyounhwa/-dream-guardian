export const BOTTOM_BAR_SCREEN_ID = "bottomBar";
export const BOTTOM_BAR_VERSION = "1.0.0";

export const BOTTOM_BAR_PUBLISHED = Object.freeze({
  design: Object.freeze({ width: 1080, height: 2160 }),
  bounds: Object.freeze({ x: 0, y: 1960, w: 1080, h: 200 }),
  height: 200,
  settingsBtn: Object.freeze({ x: 30, y: 1990, w: 140, h: 140 }),
  actionBtn: Object.freeze({ x: 810, y: 1990, w: 240, h: 140 }),
  manaBar: Object.freeze({ x: 210, y: 2038, w: 560, h: 50 }),
});

export const BOTTOM_BAR_LOCK_REASONS = Object.freeze({
  sharedActionSlot: "no independent pause slot in published layout; actionBtn is shared",
  buttonOverlap: "bottom-bar-lock:button-overlap",
  profileClosed: "bottom-bar-lock:profile-closed",
  unknownField: "bottom-bar-lock:unknown-field",
  assetPath: "bottom-bar-lock:asset-path",
  exportBlocked: "bottom-bar-lock:export-blocked",
});

export const BOTTOM_BAR_ALLOWED_FIELDS = Object.freeze(["settingsBtn", "actionBtn", "manaBar", "visible"]);

const PATH_KEYS = new Set(["file", "path", "href", "url", "src", "image", "assetPath", "assetOverride", "assets"]);
const PROFILE_KEYS = new Set(["profile", "profileInput", "inputs"]);

export type BottomBarRegion = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  priority: number;
  role: "settings" | "workout" | "pause" | "mana";
  locked: boolean;
  reason?: string;
};

export const BOTTOM_BAR_REGIONS: readonly BottomBarRegion[] = Object.freeze([
  Object.freeze({
    id: "bottom-bar-settings",
    x: BOTTOM_BAR_PUBLISHED.settingsBtn.x,
    y: BOTTOM_BAR_PUBLISHED.settingsBtn.y,
    width: BOTTOM_BAR_PUBLISHED.settingsBtn.w,
    height: BOTTOM_BAR_PUBLISHED.settingsBtn.h,
    priority: 1,
    role: "settings" as const,
    locked: false,
  }),
  Object.freeze({
    id: "bottom-bar-action",
    x: BOTTOM_BAR_PUBLISHED.actionBtn.x,
    y: BOTTOM_BAR_PUBLISHED.actionBtn.y,
    width: BOTTOM_BAR_PUBLISHED.actionBtn.w,
    height: BOTTOM_BAR_PUBLISHED.actionBtn.h,
    priority: 2,
    role: "workout" as const,
    locked: false,
  }),
  Object.freeze({
    id: "bottom-bar-pause",
    x: BOTTOM_BAR_PUBLISHED.actionBtn.x,
    y: BOTTOM_BAR_PUBLISHED.actionBtn.y,
    width: BOTTOM_BAR_PUBLISHED.actionBtn.w,
    height: BOTTOM_BAR_PUBLISHED.actionBtn.h,
    priority: 3,
    role: "pause" as const,
    locked: true,
    reason: BOTTOM_BAR_LOCK_REASONS.sharedActionSlot,
  }),
  Object.freeze({
    id: "bottom-bar-mana",
    x: BOTTOM_BAR_PUBLISHED.manaBar.x,
    y: BOTTOM_BAR_PUBLISHED.manaBar.y,
    width: BOTTOM_BAR_PUBLISHED.manaBar.w,
    height: BOTTOM_BAR_PUBLISHED.manaBar.h,
    priority: 4,
    role: "mana" as const,
    locked: false,
  }),
]);

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function rejectButtonOverlap(
  regions: readonly BottomBarRegion[] = BOTTOM_BAR_REGIONS,
): { ok: true } | { ok: false; reason: string } {
  const buttons = regions.filter((region) => region.role === "settings" || region.role === "workout" || region.role === "pause");
  for (let i = 0; i < buttons.length; i += 1) {
    for (let j = i + 1; j < buttons.length; j += 1) {
      if (boxesOverlap(buttons[i], buttons[j])) {
        return { ok: false, reason: BOTTOM_BAR_LOCK_REASONS.buttonOverlap };
      }
    }
  }
  return { ok: true };
}

export type BottomBarPropertyResolution = {
  status: "locked";
  reason: string;
  exportEnabled: false;
};

export function resolveBottomBarProperty(key: string): BottomBarPropertyResolution {
  if (key === "pause") {
    return { status: "locked", reason: BOTTOM_BAR_LOCK_REASONS.sharedActionSlot, exportEnabled: false };
  }
  if (PROFILE_KEYS.has(key)) {
    return { status: "locked", reason: BOTTOM_BAR_LOCK_REASONS.profileClosed, exportEnabled: false };
  }
  if (PATH_KEYS.has(key)) {
    return { status: "locked", reason: BOTTOM_BAR_LOCK_REASONS.assetPath, exportEnabled: false };
  }
  if ((BOTTOM_BAR_ALLOWED_FIELDS as readonly string[]).includes(key)) {
    return { status: "locked", reason: BOTTOM_BAR_LOCK_REASONS.exportBlocked, exportEnabled: false };
  }
  return { status: "locked", reason: BOTTOM_BAR_LOCK_REASONS.unknownField, exportEnabled: false };
}

export type BottomBarFixture = {
  id: string;
  screen: "bottomBar";
  version: "1.0.0";
  closed: true;
  profile: "visibility" | "workout" | "button-overlap";
  visible?: boolean;
  action?: "workout";
  rejected?: true;
};

export const BOTTOM_BAR_FIXTURES: readonly BottomBarFixture[] = Object.freeze([
  Object.freeze({
    id: "bottom-bar-visibility",
    screen: "bottomBar" as const,
    version: "1.0.0" as const,
    closed: true as const,
    profile: "visibility" as const,
    visible: false,
  }),
  Object.freeze({
    id: "bottom-bar-workout",
    screen: "bottomBar" as const,
    version: "1.0.0" as const,
    closed: true as const,
    profile: "workout" as const,
    action: "workout" as const,
  }),
  Object.freeze({
    id: "bottom-bar-overlap",
    screen: "bottomBar" as const,
    version: "1.0.0" as const,
    closed: true as const,
    profile: "button-overlap" as const,
    rejected: true as const,
  }),
]);

export const BOTTOM_BAR_CONTRACT = Object.freeze({
  registered: true as const,
  screen: BOTTOM_BAR_SCREEN_ID,
  version: BOTTOM_BAR_VERSION,
  scope: "bottomBar",
  requiredFields: Object.freeze(["settingsBtn", "actionBtn", "manaBar"]),
  cardFields: Object.freeze([] as string[]),
  workoutFields: Object.freeze(["x", "y", "width", "height"]),
  supportStatus: "locked" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  actionSlot: "shared" as const,
  fingerprint: "bottomBar@1.0.0:settings+shared-action+mana+pause-lock",
  units: Object.freeze({ length: "px", design: "1080x2160" }),
  ranges: Object.freeze({
    x: Object.freeze({ min: 0, max: 1080 }),
    y: Object.freeze({ min: 0, max: 2160 }),
  }),
  protectedRegions: Object.freeze(BOTTOM_BAR_REGIONS),
  fixtures: BOTTOM_BAR_FIXTURES,
});
