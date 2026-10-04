export const THEME_ID = "theme";
export const THEME_VERSION = "1.0.0";
export const THEME_COLOR_CONSUMER = "UIText.getColor token keys";
export const IMAGE_BACKGROUND_CONTRAST = "unverified";

export const THEME_TOKEN_KEYS = Object.freeze([
  "primary",
  "secondary",
  "accent",
  "danger",
  "success",
  "textPrimary",
  "textSecondary",
  "textMuted",
  "textLocked",
  "bgDim",
  "bgCard",
  "border",
  "borderHighlight",
] as const);

export type ThemeTokenKey = (typeof THEME_TOKEN_KEYS)[number];
export type ThemeFixtureId = "default" | "highContrast";

export const THEME_PUBLISHED = Object.freeze({
  default: Object.freeze({
    primary: "#28E6FF",
    secondary: "#FFCB4D",
    accent: "#C889FF",
    danger: "#FF4444",
    success: "#4DFFAA",
    textPrimary: "#FFFFFF",
    textSecondary: "#CCCCCC",
    textMuted: "#BBBBBB",
    textLocked: "#888888",
    bgDim: "rgba(0, 0, 0, 0.7)",
    bgCard: "rgba(20, 24, 40, 0.85)",
    border: "rgba(255, 255, 255, 0.2)",
    borderHighlight: "#28E6FF",
  }),
  highContrast: Object.freeze({
    primary: "#00FFFF",
    secondary: "#FFFF00",
    accent: "#FF00FF",
    danger: "#FF0000",
    success: "#00FF00",
    textPrimary: "#FFFFFF",
    textSecondary: "#FFFFFF",
    textMuted: "#DDDDDD",
    textLocked: "#888888",
    bgDim: "rgba(0, 0, 0, 0.92)",
    bgCard: "rgba(0, 0, 0, 0.95)",
    border: "#FFFFFF",
    borderHighlight: "#FFFF00",
  }),
});

export const THEME_LOCK_REASONS = Object.freeze({
  displayOnly: "theme-lock:display-only",
  unconnected: "theme-lock:unconnected-token",
  arbitraryCss: "theme-lock:arbitrary-css-rejected",
  accessibility: "player accessibility is not a transfer override",
  baselineMismatch: "theme-lock:baseline-mismatch",
  unknownField: "theme-lock:unknown-field",
});

const TOKEN_SET = new Set<string>(THEME_TOKEN_KEYS);
const CSS_KEYS = new Set(["css", "style", "color", "background", "filter"]);
const A11Y_KEYS = new Set(["highContrast", "playerHighContrast", "accessibility"]);
const RGBA_KEYS = new Set(["bgDim", "bgCard", "border"]);

function publishedRange(key: ThemeTokenKey): readonly [string, string] {
  return Object.freeze([THEME_PUBLISHED.default[key], THEME_PUBLISHED.highContrast[key]]);
}

export const THEME_VALUE_RANGES = Object.freeze(
  Object.fromEntries(THEME_TOKEN_KEYS.map((key) => [key, publishedRange(key)])) as {
    [K in ThemeTokenKey]: readonly [string, string];
  },
);

export const THEME_SUPPORTED_FIELDS = Object.freeze([...THEME_TOKEN_KEYS]);

export type ThemeFixture = {
  id: string;
  screen: "theme";
  version: "1.0.0";
  kind: "display";
  fixture: ThemeFixtureId;
  writesPlayerSetting: false;
  closed: true;
  colors: (typeof THEME_PUBLISHED)[ThemeFixtureId];
};

export const THEME_FIXTURES: readonly ThemeFixture[] = Object.freeze([
  Object.freeze({
    id: "theme-default",
    screen: "theme" as const,
    version: "1.0.0" as const,
    kind: "display" as const,
    fixture: "default" as const,
    writesPlayerSetting: false as const,
    closed: true as const,
    colors: THEME_PUBLISHED.default,
  }),
  Object.freeze({
    id: "theme-high-contrast",
    screen: "theme" as const,
    version: "1.0.0" as const,
    kind: "display" as const,
    fixture: "highContrast" as const,
    writesPlayerSetting: false as const,
    closed: true as const,
    colors: THEME_PUBLISHED.highContrast,
  }),
]);

export const THEME_CONTRACT = Object.freeze({
  id: THEME_ID,
  screen: THEME_ID,
  version: THEME_VERSION,
  scope: THEME_ID,
  consumer: THEME_COLOR_CONSUMER,
  consumerMode: "read-only" as const,
  tokens: THEME_TOKEN_KEYS,
  valueRanges: THEME_VALUE_RANGES,
  baselineId: "theme-v1",
  supportedFields: THEME_SUPPORTED_FIELDS,
  requiredFields: THEME_SUPPORTED_FIELDS,
  cardFields: Object.freeze([] as const),
  workoutFields: Object.freeze([] as const),
  supportStatus: "locked" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  fingerprint: "theme@1.0.0:color-tokens+contrast-fixtures",
  protectedRegions: Object.freeze([
    Object.freeze({ id: "theme-tokens", x: 0, y: 0, width: 1080, height: 2160 }),
  ]),
  writesStorage: false as const,
  bootsGame: false as const,
});

export type ThemeReject =
  | { ok: false; reason: string }
  | { ok: true; locked: true; reason: string };

const HEX = /^#[0-9A-F]{6}$/;

export function rejectThemeValue(key: string, value: unknown): ThemeReject {
  if (A11Y_KEYS.has(key)) {
    return { ok: false, reason: THEME_LOCK_REASONS.accessibility };
  }
  if (CSS_KEYS.has(key) || (typeof value === "string" && /[{:;]|rgb\(|rgba\(|hsl\(/i.test(value) && !isPublishedValue(key, value))) {
    return { ok: false, reason: THEME_LOCK_REASONS.arbitraryCss };
  }
  if (!TOKEN_SET.has(key)) {
    return { ok: false, reason: THEME_LOCK_REASONS.unconnected };
  }
  return { ok: false, reason: THEME_LOCK_REASONS.baselineMismatch };
}

function isPublishedValue(key: string, value: string): boolean {
  if (!TOKEN_SET.has(key)) return false;
  const token = key as ThemeTokenKey;
  return value === THEME_PUBLISHED.default[token] || value === THEME_PUBLISHED.highContrast[token];
}

export type ThemeContrastInput = {
  fixture: ThemeFixtureId;
  foreground: string;
  background: string;
};

export type ThemeContrastResult =
  | { status: "judged"; pair: { foreground: string; background: string } }
  | { status: "unverified"; reason: typeof IMAGE_BACKGROUND_CONTRAST };

export function judgeThemeContrast(input: ThemeContrastInput): ThemeContrastResult {
  const colors = THEME_PUBLISHED[input.fixture];
  const foreground = TOKEN_SET.has(input.foreground)
    ? colors[input.foreground as ThemeTokenKey]
    : input.foreground;
  const namedBackground = TOKEN_SET.has(input.background)
    ? colors[input.background as ThemeTokenKey]
    : input.background;
  const image = input.background === "image" || /image|url\(/i.test(input.background);
  const rgba =
    (TOKEN_SET.has(input.background) && RGBA_KEYS.has(input.background)) ||
    namedBackground.startsWith("rgba(");
  if (image || rgba || !HEX.test(foreground) || !HEX.test(namedBackground)) {
    return { status: "unverified", reason: IMAGE_BACKGROUND_CONTRAST };
  }
  return { status: "judged", pair: { foreground, background: namedBackground } };
}

export type ThemeResolution = {
  ok: false;
  locked: true;
  reason: string;
  exportable: false;
};

export function resolveThemeProperty(_screen: string, _version: string, key: string): ThemeResolution {
  if (A11Y_KEYS.has(key)) {
    return {
      ok: false,
      locked: true,
      reason: THEME_LOCK_REASONS.accessibility,
      exportable: false,
    };
  }
  return {
    ok: false,
    locked: true,
    reason: TOKEN_SET.has(key) ? THEME_LOCK_REASONS.baselineMismatch : THEME_LOCK_REASONS.unconnected,
    exportable: false,
  };
}
