export const SUBMENU_SCREEN_ID = "submenu";
export const SUBMENU_VERSION = "1.0.0";
export const SUBMENU_BACK_ID = "submenu-back";
export const SUBMENU_TITLE_ID = "submenu-title";

export const SUBMENU_PUBLISHED = Object.freeze({
  design: Object.freeze({ width: 1080, height: 2160 }),
  grid: Object.freeze({
    startX: 80,
    startY: 440,
    gapX: 80,
    gapY: 60,
    cols: 2,
    w: 420,
    h: 380,
  }),
  cardWidth: 420,
  cardHeight: 380,
  backBtn: Object.freeze({ x: 780, y: 1990, w: 270, h: 140 }),
  title: Object.freeze({ x: 80, y: 160, w: 920, h: 200 }),
  rows: 3,
});

export const SUBMENU_GRID = SUBMENU_PUBLISHED.grid;

export const SUBMENU_CELL_IDS = Object.freeze([
  "submenu-cell-0",
  "submenu-cell-1",
  "submenu-cell-2",
  "submenu-cell-3",
  "submenu-cell-4",
  "submenu-cell-5",
]);

export const SUBMENU_ALLOWED_FIELDS = Object.freeze([
  "cols",
  "rows",
  "width",
  "height",
  "startX",
  "startY",
  "gapX",
  "gapY",
]);

export const SUBMENU_LOCK_REASONS = Object.freeze({
  freeCardXY: "submenu-lock:free-card-xy",
  arbitraryColor: "submenu-lock:arbitrary-color",
  assetPath: "submenu-lock:asset-path",
  gameStat: "submenu-lock:game-stat",
  unknownField: "submenu-lock:unknown-field",
  previewUnlinked: "submenu-lock:preview-unlinked",
  exportBlocked: "submenu-lock:export-blocked-until-preview",
});

const COLOR_KEYS = new Set(["color", "fill", "stroke", "background", "opacity"]);
const PATH_KEYS = new Set(["file", "path", "href", "url", "src", "image", "assetOverride", "assetOverrides", "assets"]);
const STAT_KEYS = new Set(["hp", "damage", "mana", "playerHp", "bossHp", "spellDamage"]);
const FREE_PLACEMENT_KEYS = new Set(["x", "y"]);

export type SubmenuCell = {
  id: string;
  col: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function deriveSubmenuCell(index: number): SubmenuCell {
  const cols = SUBMENU_GRID.cols;
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    id: `submenu-cell-${index}`,
    col,
    row,
    x: SUBMENU_GRID.startX + col * (SUBMENU_GRID.w + SUBMENU_GRID.gapX),
    y: SUBMENU_GRID.startY + row * (SUBMENU_GRID.h + SUBMENU_GRID.gapY),
    width: SUBMENU_GRID.w,
    height: SUBMENU_GRID.h,
  };
}

export type SubmenuPropertyResolution = {
  locked: boolean;
  reason: string | null;
  exportEnabled: false;
};

export function resolveSubmenuProperty(key: string): SubmenuPropertyResolution {
  if ((SUBMENU_ALLOWED_FIELDS as readonly string[]).includes(key)) {
    return { locked: false, reason: null, exportEnabled: false };
  }
  if (FREE_PLACEMENT_KEYS.has(key)) {
    return { locked: true, reason: SUBMENU_LOCK_REASONS.freeCardXY, exportEnabled: false };
  }
  if (COLOR_KEYS.has(key)) {
    return { locked: true, reason: SUBMENU_LOCK_REASONS.arbitraryColor, exportEnabled: false };
  }
  if (PATH_KEYS.has(key)) {
    return { locked: true, reason: SUBMENU_LOCK_REASONS.assetPath, exportEnabled: false };
  }
  if (STAT_KEYS.has(key)) {
    return { locked: true, reason: SUBMENU_LOCK_REASONS.gameStat, exportEnabled: false };
  }
  return { locked: true, reason: SUBMENU_LOCK_REASONS.unknownField, exportEnabled: false };
}

export type SubmenuFixture = {
  id: string;
  screen: "submenu";
  version: "1.0.0";
  closed: true;
  profile: "long-name" | "selection-state";
  label: string;
  selectedId: string | null;
};

export const SUBMENU_FIXTURES: readonly SubmenuFixture[] = Object.freeze([
  Object.freeze({
    id: "submenu-long-name",
    screen: "submenu" as const,
    version: "1.0.0" as const,
    closed: true as const,
    profile: "long-name" as const,
    label: "아주 긴 서브메뉴 단계 이름 확인용 고정 픽스처 라벨 — long closed name",
    selectedId: null,
  }),
  Object.freeze({
    id: "submenu-selection",
    screen: "submenu" as const,
    version: "1.0.0" as const,
    closed: true as const,
    profile: "selection-state" as const,
    label: "선택 상태",
    selectedId: "submenu-cell-0",
  }),
]);

export const SUBMENU_CONTRACT = Object.freeze({
  registered: true as const,
  screen: SUBMENU_SCREEN_ID,
  version: SUBMENU_VERSION,
  scope: SUBMENU_SCREEN_ID,
  placement: "grid" as const,
  requiredFields: Object.freeze(["grid", "sharedSize", "backButton"]),
  cardFields: Object.freeze(["id", "col", "row"]),
  workoutFields: Object.freeze([]) as readonly string[],
  supportStatus: "locked" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  fingerprint: "submenu-grid-v1",
  units: Object.freeze({ length: "px", design: "1080x2160" }),
  ranges: Object.freeze({
    cols: Object.freeze({ min: 2, max: 2 }),
    width: Object.freeze({ min: 420, max: 420 }),
    height: Object.freeze({ min: 380, max: 380 }),
  }),
  lockReasons: SUBMENU_LOCK_REASONS,
  protectedRegions: Object.freeze([
    Object.freeze({
      id: SUBMENU_BACK_ID,
      x: SUBMENU_PUBLISHED.backBtn.x,
      y: SUBMENU_PUBLISHED.backBtn.y,
      width: SUBMENU_PUBLISHED.backBtn.w,
      height: SUBMENU_PUBLISHED.backBtn.h,
    }),
    Object.freeze({
      id: SUBMENU_TITLE_ID,
      x: SUBMENU_PUBLISHED.title.x,
      y: SUBMENU_PUBLISHED.title.y,
      width: SUBMENU_PUBLISHED.title.w,
      height: SUBMENU_PUBLISHED.title.h,
    }),
  ]),
});
