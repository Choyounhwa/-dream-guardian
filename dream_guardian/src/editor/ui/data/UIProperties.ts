import { BOTTOM_BAR_CONTRACT } from "./screens/UIBottomBarContract";
import { HUD_CONTRACT } from "./screens/UIHUDContract";
import { PAUSE_CONTRACT } from "./screens/UIPauseContract";
import { RESULT_CONTRACT } from "./screens/UIResultContract";
import { SETTINGS_CONTRACT } from "./screens/UISettingsContract";
import { SUBMENU_CONTRACT } from "./screens/UISubmenuContract";
import { ASSET_CONTRACT } from "./styles/UIAssetContract";
import { TEXT_STYLE_CONTRACT } from "./styles/UITextStyleContract";
import { THEME_CONTRACT } from "./styles/UIThemeContract";
import type {
  UIVisualDocument,
  UIVisualElement,
  UIVisualElementType,
  UIVisualPageId,
} from "./UIVisualDocument";
import { UI_VISUAL_PAGE_IDS } from "./UIVisualDocument";

export { BOTTOM_BAR_SCREEN_ID, resolveBottomBarProperty } from "./screens/UIBottomBarContract";
export { RESULT_SCREEN_ID, resolveResultProperty } from "./screens/UIResultContract";
export { PAUSE_SCREEN_ID, resolvePauseProperty } from "./screens/UIPauseContract";
export { SETTINGS_SCREEN_ID, resolveSettingsProperty } from "./screens/UISettingsContract";
export { HUD_SCREEN_ID, resolveHudProperty } from "./screens/UIHUDContract";
export { SUBMENU_SCREEN_ID, resolveSubmenuProperty } from "./screens/UISubmenuContract";
export { resolveTextStyleProperty } from "./styles/UITextStyleContract";
export { resolveThemeProperty } from "./styles/UIThemeContract";

export function lookupAssetContract() {
  return ASSET_CONTRACT;
}

export const MENU_SHARED_SIZE_FIELDS = ["width", "height"] as const;

export const WORKOUT_BUTTON_FIELDS = ["x", "y", "width", "height"] as const;

export const MENU_CARD_FIELDS = ["id", "x", "y"] as const;

export const GAME_STAT_KEYS = [
  "hp",
  "damage",
  "mana",
  "playerHp",
  "bossHp",
  "spellDamage",
] as const;

export const PATH_KEYS = ["file", "path", "href", "url", "src", "image"] as const;

export const ASSET_OVERRIDE_KEYS = ["assetOverride", "assetOverrides", "assets"] as const;

const GAME_STAT_SET = new Set<string>(GAME_STAT_KEYS);

export function isRejectedCategoryKey(key: string): boolean {
  return GAME_STAT_SET.has(key);
}

export type ScreenSupportStatus = "supported" | "locked";

export type ScreenContract = {
  registered: true;
  screen: string;
  version: string;
  scope: string;
  requiredFields: readonly string[];
  cardFields: readonly string[];
  workoutFields: readonly string[];
  supportStatus: ScreenSupportStatus;
  editEnabled: false;
  exportEnabled: false;
  fingerprint: string;
  protectedRegions: ReadonlyArray<{ id: string; x: number; y: number; width: number; height: number }>;
};

export type ScreenFixture = {
  id: string;
  screen: string;
  version: string;
  closed: true;
};

const MENU_V1: ScreenContract = Object.freeze({
  registered: true as const,
  screen: "menu",
  version: "1.0.0",
  scope: "menu",
  requiredFields: Object.freeze(["cards", ...MENU_SHARED_SIZE_FIELDS, "workoutButton"]),
  cardFields: Object.freeze(["id", "x", "y"]),
  workoutFields: Object.freeze([...WORKOUT_BUTTON_FIELDS]),
  supportStatus: "supported" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  fingerprint: "menu@1.0.0:cards5+shared-size+workout-rect",
  protectedRegions: Object.freeze([
    Object.freeze({ id: "hud-safe", x: 0, y: 0, width: 1080, height: 120 }),
  ]),
});

const FIXTURES: readonly ScreenFixture[] = Object.freeze([
  Object.freeze({ id: "menu-v1-default", screen: "menu", version: "1.0.0", closed: true as const }),
]);

const SUBMENU_V1: ScreenContract = Object.freeze({
  registered: true as const,
  screen: SUBMENU_CONTRACT.screen,
  version: SUBMENU_CONTRACT.version,
  scope: SUBMENU_CONTRACT.scope,
  requiredFields: SUBMENU_CONTRACT.requiredFields,
  cardFields: SUBMENU_CONTRACT.cardFields,
  workoutFields: SUBMENU_CONTRACT.workoutFields,
  supportStatus: "locked" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  fingerprint: SUBMENU_CONTRACT.fingerprint,
  protectedRegions: SUBMENU_CONTRACT.protectedRegions,
});

const HUD_V1: ScreenContract = Object.freeze({
  registered: true as const,
  screen: HUD_CONTRACT.screen,
  version: HUD_CONTRACT.version,
  scope: HUD_CONTRACT.scope,
  requiredFields: HUD_CONTRACT.requiredFields,
  cardFields: HUD_CONTRACT.cardFields,
  workoutFields: HUD_CONTRACT.workoutFields,
  supportStatus: "locked" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  fingerprint: HUD_CONTRACT.fingerprint,
  protectedRegions: HUD_CONTRACT.protectedRegions,
});

const BOTTOM_BAR_V1: ScreenContract = Object.freeze({
  registered: true as const,
  screen: BOTTOM_BAR_CONTRACT.screen,
  version: BOTTOM_BAR_CONTRACT.version,
  scope: BOTTOM_BAR_CONTRACT.scope,
  requiredFields: BOTTOM_BAR_CONTRACT.requiredFields,
  cardFields: BOTTOM_BAR_CONTRACT.cardFields,
  workoutFields: BOTTOM_BAR_CONTRACT.workoutFields,
  supportStatus: "locked" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  fingerprint: BOTTOM_BAR_CONTRACT.fingerprint,
  protectedRegions: BOTTOM_BAR_CONTRACT.protectedRegions,
});

const RESULT_V1: ScreenContract = Object.freeze({
  registered: true as const,
  screen: RESULT_CONTRACT.screen,
  version: RESULT_CONTRACT.version,
  scope: RESULT_CONTRACT.scope,
  requiredFields: RESULT_CONTRACT.requiredFields,
  cardFields: RESULT_CONTRACT.cardFields,
  workoutFields: RESULT_CONTRACT.workoutFields,
  supportStatus: "locked" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  fingerprint: RESULT_CONTRACT.fingerprint,
  protectedRegions: RESULT_CONTRACT.protectedRegions,
});

const SETTINGS_V1: ScreenContract = Object.freeze({
  registered: true as const,
  screen: SETTINGS_CONTRACT.screen,
  version: SETTINGS_CONTRACT.version,
  scope: SETTINGS_CONTRACT.scope,
  requiredFields: SETTINGS_CONTRACT.requiredFields,
  cardFields: SETTINGS_CONTRACT.cardFields,
  workoutFields: SETTINGS_CONTRACT.workoutFields,
  supportStatus: "locked" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  fingerprint: SETTINGS_CONTRACT.fingerprint,
  protectedRegions: SETTINGS_CONTRACT.protectedRegions,
});

const PAUSE_V1: ScreenContract = Object.freeze({
  registered: true as const,
  screen: PAUSE_CONTRACT.screen,
  version: PAUSE_CONTRACT.version,
  scope: PAUSE_CONTRACT.scope,
  requiredFields: PAUSE_CONTRACT.requiredFields,
  cardFields: PAUSE_CONTRACT.cardFields,
  workoutFields: PAUSE_CONTRACT.workoutFields,
  supportStatus: "locked" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  fingerprint: PAUSE_CONTRACT.fingerprint,
  protectedRegions: PAUSE_CONTRACT.protectedRegions,
});

const TEXT_STYLE_V1: ScreenContract = Object.freeze({
  registered: true as const,
  screen: TEXT_STYLE_CONTRACT.screen,
  version: TEXT_STYLE_CONTRACT.version,
  scope: TEXT_STYLE_CONTRACT.scope,
  requiredFields: TEXT_STYLE_CONTRACT.requiredFields,
  cardFields: TEXT_STYLE_CONTRACT.cardFields,
  workoutFields: TEXT_STYLE_CONTRACT.workoutFields,
  supportStatus: "locked" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  fingerprint: TEXT_STYLE_CONTRACT.fingerprint,
  protectedRegions: TEXT_STYLE_CONTRACT.protectedRegions,
});

const THEME_V1: ScreenContract = Object.freeze({
  registered: true as const,
  screen: THEME_CONTRACT.screen,
  version: THEME_CONTRACT.version,
  scope: THEME_CONTRACT.scope,
  requiredFields: THEME_CONTRACT.requiredFields,
  cardFields: THEME_CONTRACT.cardFields,
  workoutFields: THEME_CONTRACT.workoutFields,
  supportStatus: "locked" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  fingerprint: THEME_CONTRACT.fingerprint,
  protectedRegions: THEME_CONTRACT.protectedRegions,
});

const SCREEN_CONTRACTS: readonly ScreenContract[] = Object.freeze([
  MENU_V1,
  SUBMENU_V1,
  HUD_V1,
  BOTTOM_BAR_V1,
  RESULT_V1,
  SETTINGS_V1,
  PAUSE_V1,
  TEXT_STYLE_V1,
  THEME_V1,
]);

function contractKey(input: { screen: string; version: string; scope: string }): string {
  return `${input.screen}|${input.version}|${input.scope}`;
}

const REGISTRY = new Map<string, ScreenContract>(SCREEN_CONTRACTS.map((item) => [contractKey(item), item]));

export function lookupScreenContract(screen: string, version: string, scope: string): ScreenContract | { registered: false } {
  const found = REGISTRY.get(contractKey({ screen, version, scope }));
  if (!found) return { registered: false };
  return found;
}

export function registerScreenContract(input: { screen: string; version: string; scope: string }): {
  accepted: boolean;
  editEnabled: false;
  exportEnabled: false;
} {
  const found = REGISTRY.get(contractKey(input));
  if (!found || found.screen !== input.screen || found.version !== input.version || found.scope !== input.scope || found.supportStatus === "locked") {
    return { accepted: false, editEnabled: false, exportEnabled: false };
  }
  return { accepted: true, editEnabled: false, exportEnabled: false };
}

export function listScreenFixtures(screen: string, version: string): readonly ScreenFixture[] {
  return FIXTURES.filter((fixture) => fixture.screen === screen && fixture.version === version);
}

export function consumeScreenContract(screen: string, version: string, scope: string): {
  registered: boolean;
  requiredFields: readonly string[];
  supportStatus: ScreenSupportStatus | "rejected";
} {
  const found = lookupScreenContract(screen, version, scope);
  if (!("fingerprint" in found)) {
    return { registered: false, requiredFields: [], supportStatus: "rejected" };
  }
  return {
    registered: true,
    requiredFields: found.requiredFields,
    supportStatus: found.supportStatus,
  };
}

// ============================================================================
// Issue #436 (UI-VIS-006): 선택 요소 속성 조회 모델
// ============================================================================

export type FoundVisualElement = {
  element: UIVisualElement;
  pageId: UIVisualPageId;
};

export function findVisualElement(
  doc: UIVisualDocument,
  elementId: string,
  preferredPageId?: UIVisualPageId
): FoundVisualElement | null {
  if (!doc || !doc.pages) return null;

  if (preferredPageId && doc.pages[preferredPageId]) {
    const el = doc.pages[preferredPageId].elements.find((e) => e.id === elementId);
    if (el) return { element: el, pageId: preferredPageId };
  }

  for (const pageKey of UI_VISUAL_PAGE_IDS) {
    const page = doc.pages[pageKey];
    if (!page) continue;
    const el = page.elements.find((e) => e.id === elementId);
    if (el) return { element: el, pageId: pageKey };
  }

  return null;
}

export function findVisualElements(
  doc: UIVisualDocument,
  elementIds: string[],
  preferredPageId?: UIVisualPageId
): FoundVisualElement[] {
  const result: FoundVisualElement[] = [];
  for (const id of elementIds) {
    const found = findVisualElement(doc, id, preferredPageId);
    if (found) result.push(found);
  }
  return result;
}

export type VisualPropertyKey =
  | "x"
  | "y"
  | "width"
  | "height"
  | "name"
  | "text"
  | "fontSize"
  | "assetId";

export function isPropertySupportedForType(
  type: UIVisualElementType,
  prop: VisualPropertyKey
): boolean {
  switch (prop) {
    case "x":
    case "y":
    case "width":
    case "height":
    case "name":
      return true;
    case "text":
    case "fontSize":
      return type === "text" || type === "button";
    case "assetId":
      return type === "image" || type === "button";
    default:
      return false;
  }
}

export function getUnsupportedPropertyReason(
  type: UIVisualElementType,
  prop: string
): string | undefined {
  if (isPropertySupportedForType(type, prop as VisualPropertyKey)) {
    return undefined;
  }
  if (prop === "assetId") {
    return `${type}-element-does-not-support-asset`;
  }
  return `${type}-element-does-not-support-${prop}`;
}

export type PropertyInspectionValue<T = unknown> = {
  value: T | "mixed" | null;
  isMixed: boolean;
  supported: boolean;
  unsupportedReason?: string;
  isLocked: boolean;
  lockReason?: string;
  editable: boolean;
};

export type ElementInspectionResult = {
  isValidSelection: boolean;
  count: number;
  selectedIds: string[];
  pageId?: UIVisualPageId;
  error?: { code: string; message: string };
  x: PropertyInspectionValue<number>;
  y: PropertyInspectionValue<number>;
  width: PropertyInspectionValue<number>;
  height: PropertyInspectionValue<number>;
  name: PropertyInspectionValue<string>;
  text: PropertyInspectionValue<string>;
  fontSize: PropertyInspectionValue<number>;
  assetId: PropertyInspectionValue<string>;
};

export function inspectElementsProperties(input: {
  doc: UIVisualDocument;
  selectedIds: string[];
  activePageId?: UIVisualPageId;
}): ElementInspectionResult {
  const { doc, selectedIds, activePageId } = input;

  const createEmptyValue = <T>(reason?: string): PropertyInspectionValue<T> => ({
    value: null,
    isMixed: false,
    supported: false,
    unsupportedReason: reason,
    isLocked: false,
    editable: false,
  });

  if (!selectedIds || selectedIds.length === 0) {
    return {
      isValidSelection: false,
      count: 0,
      selectedIds: [],
      error: { code: "empty-selection", message: "No elements selected" },
      x: createEmptyValue(),
      y: createEmptyValue(),
      width: createEmptyValue(),
      height: createEmptyValue(),
      name: createEmptyValue(),
      text: createEmptyValue(),
      fontSize: createEmptyValue(),
      assetId: createEmptyValue(),
    };
  }

  const foundList: FoundVisualElement[] = [];
  for (const id of selectedIds) {
    const found = findVisualElement(doc, id, activePageId);
    if (!found) {
      return {
        isValidSelection: false,
        count: 0,
        selectedIds,
        error: { code: "unknown-id", message: `Element "${id}" not found` },
        x: createEmptyValue("unknown-id"),
        y: createEmptyValue("unknown-id"),
        width: createEmptyValue("unknown-id"),
        height: createEmptyValue("unknown-id"),
        name: createEmptyValue("unknown-id"),
        text: createEmptyValue("unknown-id"),
        fontSize: createEmptyValue("unknown-id"),
        assetId: createEmptyValue("unknown-id"),
      };
    }
    foundList.push(found);
  }

  const anyLocked = foundList.some((f) => f.element.isLocked);
  const lockReason = foundList.find((f) => f.element.isLocked)?.element.lockReason;
  const primaryPageId = foundList[0]?.pageId;

  function inspectField<T>(
    prop: VisualPropertyKey,
    extractor: (el: UIVisualElement) => T | undefined
  ): PropertyInspectionValue<T> {
    const allSupported = foundList.every((f) => isPropertySupportedForType(f.element.type, prop));
    if (!allSupported) {
      const unsupportedReason =
        foundList
          .map((f) => getUnsupportedPropertyReason(f.element.type, prop))
          .find(Boolean) ?? `${prop}-not-supported`;
      return {
        value: null,
        isMixed: false,
        supported: false,
        unsupportedReason,
        isLocked: anyLocked,
        lockReason,
        editable: false,
      };
    }

    const values = foundList.map((f) => extractor(f.element));
    const firstVal = values[0];
    const isMixed = values.some((v) => v !== firstVal);

    return {
      value: isMixed ? "mixed" : (firstVal ?? null),
      isMixed,
      supported: true,
      isLocked: anyLocked,
      lockReason,
      editable: !anyLocked,
    };
  }

  return {
    isValidSelection: true,
    count: foundList.length,
    selectedIds,
    pageId: primaryPageId,
    x: inspectField<number>("x", (el) => el.bounds.x),
    y: inspectField<number>("y", (el) => el.bounds.y),
    width: inspectField<number>("width", (el) => el.bounds.width),
    height: inspectField<number>("height", (el) => el.bounds.height),
    name: inspectField<string>("name", (el) => el.name),
    text: inspectField<string>("text", (el) => el.text),
    fontSize: inspectField<number>("fontSize", (el) => el.fontSize),
    assetId: inspectField<string>("assetId", (el) => el.assetId),
  };
}

