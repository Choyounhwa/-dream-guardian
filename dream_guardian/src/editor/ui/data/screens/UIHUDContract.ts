export const HUD_SCREEN_ID = "hud";
export const HUD_VERSION = "1.0.0";

export const HUD_PUBLISHED = Object.freeze({
  design: Object.freeze({ width: 1080, height: 2160 }),
  bounds: Object.freeze({ x: 0, y: 0, w: 1080, h: 200 }),
  playerHpBar: Object.freeze({ x: 20, y: 20, w: 320, h: 32 }),
  bossHpBar: Object.freeze({ x: 740, y: 20, w: 320, h: 32 }),
  combo: Object.freeze({ x: 540, y: 120, w: 200, h: 60 }),
  bossName: Object.freeze({ x: 740, y: 60, w: 320, h: 30 }),
  comboBadge: Object.freeze({ w: 160, h: 48, y: 48, marginRight: 24 }),
});

export const HUD_SLOT_IDS = Object.freeze([
  "hud-player-hp-bar",
  "hud-boss-hp-bar",
  "hud-combo",
  "hud-boss-name",
  "hud-combo-badge",
]);

export const HUD_ALLOWED_FIELDS = Object.freeze([
  "playerHpBar",
  "bossHpBar",
  "combo",
  "bossName",
  "comboBadge",
]);

export const HUD_LOCK_REASONS = Object.freeze({
  computedPlacement: "hud-lock:computed-placement",
  arbitraryColor: "hud-lock:arbitrary-color",
  assetPath: "hud-lock:asset-path",
  unknownField: "hud-lock:unknown-field",
  unknownBaseline: "hud-lock:unknown-baseline",
  previewUnlinked: "hud-lock:preview-unlinked",
  exportBlocked: "hud-lock:export-blocked-until-preview",
});

const COLOR_KEYS = new Set(["color", "fill", "stroke", "background", "opacity"]);
const PATH_KEYS = new Set(["file", "path", "href", "url", "src", "image", "assetOverride", "assetOverrides", "assets"]);
const COMPUTED_KEYS = new Set([
  "hp",
  "damage",
  "mana",
  "playerHp",
  "bossHp",
  "spellDamage",
  "fillPercent",
  "computedFill",
  "fill",
]);
const BASELINE_KEYS = new Set(["unknownBaseline", "baseline", "presetHash"]);

export type HudSlot = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const SLOT_KEY_TO_ID: Record<(typeof HUD_ALLOWED_FIELDS)[number], string> = {
  playerHpBar: "hud-player-hp-bar",
  bossHpBar: "hud-boss-hp-bar",
  combo: "hud-combo",
  bossName: "hud-boss-name",
  comboBadge: "hud-combo-badge",
};

export function deriveHudSlot(key: (typeof HUD_ALLOWED_FIELDS)[number]): HudSlot {
  if (key === "comboBadge") {
    const badge = HUD_PUBLISHED.comboBadge;
    return {
      id: SLOT_KEY_TO_ID.comboBadge,
      x: HUD_PUBLISHED.design.width - badge.w - badge.marginRight,
      y: badge.y,
      width: badge.w,
      height: badge.h,
    };
  }
  const slot =
    key === "playerHpBar"
      ? HUD_PUBLISHED.playerHpBar
      : key === "bossHpBar"
        ? HUD_PUBLISHED.bossHpBar
        : key === "combo"
          ? HUD_PUBLISHED.combo
          : HUD_PUBLISHED.bossName;
  return {
    id: SLOT_KEY_TO_ID[key],
    x: slot.x,
    y: slot.y,
    width: slot.w,
    height: slot.h,
  };
}

export type HudPropertyResolution = {
  locked: boolean;
  reason: string | null;
  exportEnabled: false;
};

export function resolveHudProperty(key: string): HudPropertyResolution {
  if ((HUD_ALLOWED_FIELDS as readonly string[]).includes(key)) {
    return { locked: false, reason: null, exportEnabled: false };
  }
  if (COMPUTED_KEYS.has(key)) {
    return { locked: true, reason: HUD_LOCK_REASONS.computedPlacement, exportEnabled: false };
  }
  if (COLOR_KEYS.has(key)) {
    return { locked: true, reason: HUD_LOCK_REASONS.arbitraryColor, exportEnabled: false };
  }
  if (PATH_KEYS.has(key)) {
    return { locked: true, reason: HUD_LOCK_REASONS.assetPath, exportEnabled: false };
  }
  if (BASELINE_KEYS.has(key)) {
    return { locked: true, reason: HUD_LOCK_REASONS.unknownBaseline, exportEnabled: false };
  }
  return { locked: true, reason: HUD_LOCK_REASONS.unknownField, exportEnabled: false };
}

export type HudFixture = {
  id: string;
  screen: "hud";
  version: "1.0.0";
  closed: true;
  profile: "hp-zero" | "hp-max" | "mana" | "long-combo";
  label: string;
  playerHp: number;
  playerMaxHp: number;
  mana: number;
  combo: number;
};

export const HUD_FIXTURES: readonly HudFixture[] = Object.freeze([
  Object.freeze({
    id: "hud-hp-zero",
    screen: "hud" as const,
    version: "1.0.0" as const,
    closed: true as const,
    profile: "hp-zero" as const,
    label: "HP 0",
    playerHp: 0,
    playerMaxHp: 100,
    mana: 0,
    combo: 0,
  }),
  Object.freeze({
    id: "hud-hp-max",
    screen: "hud" as const,
    version: "1.0.0" as const,
    closed: true as const,
    profile: "hp-max" as const,
    label: "HP max",
    playerHp: 100,
    playerMaxHp: 100,
    mana: 0,
    combo: 0,
  }),
  Object.freeze({
    id: "hud-mana",
    screen: "hud" as const,
    version: "1.0.0" as const,
    closed: true as const,
    profile: "mana" as const,
    label: "mana full",
    playerHp: 100,
    playerMaxHp: 100,
    mana: 100,
    combo: 0,
  }),
  Object.freeze({
    id: "hud-long-combo",
    screen: "hud" as const,
    version: "1.0.0" as const,
    closed: true as const,
    profile: "long-combo" as const,
    label: "COMBO x999999999 — closed long combo profile fixture label",
    playerHp: 100,
    playerMaxHp: 100,
    mana: 25,
    combo: 999999999,
  }),
]);

const HUD_REGIONS = HUD_ALLOWED_FIELDS.map((key) => Object.freeze(deriveHudSlot(key)));

export const HUD_CONTRACT = Object.freeze({
  registered: true as const,
  screen: HUD_SCREEN_ID,
  version: HUD_VERSION,
  scope: HUD_SCREEN_ID,
  placement: "slots" as const,
  requiredFields: Object.freeze(["slots"]),
  cardFields: Object.freeze(["id"]) as readonly string[],
  workoutFields: Object.freeze([]) as readonly string[],
  supportStatus: "locked" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  fingerprint: "hud-slots-v1",
  units: Object.freeze({ length: "px", design: "1080x2160" }),
  ranges: Object.freeze({
    x: Object.freeze({ min: 0, max: 1080 }),
    y: Object.freeze({ min: 0, max: 2160 }),
    width: Object.freeze({ min: 1, max: 1080 }),
    height: Object.freeze({ min: 1, max: 2160 }),
  }),
  lockReasons: HUD_LOCK_REASONS,
  protectedRegions: Object.freeze(HUD_REGIONS),
});
