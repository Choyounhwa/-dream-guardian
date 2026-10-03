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
