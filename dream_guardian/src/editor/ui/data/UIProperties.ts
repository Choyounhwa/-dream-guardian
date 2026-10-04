import { BOTTOM_BAR_CONTRACT } from "./screens/UIBottomBarContract";
import { HUD_CONTRACT } from "./screens/UIHUDContract";
import { SUBMENU_CONTRACT } from "./screens/UISubmenuContract";

export { BOTTOM_BAR_SCREEN_ID, resolveBottomBarProperty } from "./screens/UIBottomBarContract";
export { HUD_SCREEN_ID, resolveHudProperty } from "./screens/UIHUDContract";
export { SUBMENU_SCREEN_ID, resolveSubmenuProperty } from "./screens/UISubmenuContract";

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

const SCREEN_CONTRACTS: readonly ScreenContract[] = Object.freeze([MENU_V1, SUBMENU_V1, HUD_V1, BOTTOM_BAR_V1]);

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
