export const TEXT_STYLE_ID = "textStyle";
export const TEXT_STYLE_VERSION = "1.0.0";

export const TEXT_STYLE_ROLES = Object.freeze([
  "hero",
  "title",
  "heading",
  "subheading",
  "body",
  "label",
  "badge",
  "caption",
] as const);

export type TextStyleRole = (typeof TEXT_STYLE_ROLES)[number];

export const TEXT_STYLE_PUBLISHED = Object.freeze({
  roles: Object.freeze({
    hero: Object.freeze({ base: 100, min: 36, weight: "bold" as const }),
    title: Object.freeze({ base: 76, min: 32, weight: "bold" as const }),
    heading: Object.freeze({ base: 54, min: 28, weight: "bold" as const }),
    subheading: Object.freeze({ base: 44, min: 24, weight: "bold" as const }),
    body: Object.freeze({ base: 36, min: 20, weight: "normal" as const }),
    label: Object.freeze({ base: 28, min: 18, weight: "normal" as const }),
    badge: Object.freeze({ base: 24, min: 16, weight: "bold" as const }),
    caption: Object.freeze({ base: 20, min: 16, weight: "normal" as const }),
  }),
});

export const TEXT_STYLE_LOCK_REASONS = Object.freeze({
  displayOnly: "text-style-lock:display-only",
  customFont: "no unmodified editor consumer for custom fonts",
  arbitraryCss: "text-style-lock:arbitrary-css-rejected",
  fontPath: "text-style-lock:font-path-rejected",
  accessibility: "player accessibility is not a transfer override",
  unknownField: "text-style-lock:unknown-field",
});

const FONT_KEYS = new Set(["fontFamily", "fontPath", "fontFile", "font"]);
const CSS_KEYS = new Set(["css", "letterSpacing", "lineHeight", "style", "fontStyle"]);
const A11Y_KEYS = new Set(["fontScale", "highContrast", "minPhysicalPx"]);
const PATH_PATTERN = /[\\/]|\.(ttf|otf|woff2?|eot)$/i;

export const TEXT_STYLE_SUPPORTED_FIELDS = Object.freeze(
  TEXT_STYLE_ROLES.flatMap((role) => [`${role}.base`, `${role}.min`, `${role}.weight`]),
);

export type TextStyleFixture = {
  id: string;
  screen: "textStyle";
  version: "1.0.0";
  closed: true;
  displayOnly: true;
  exportEnabled: false;
  editEnabled: false;
  scales?: readonly number[];
  sample?: string;
};

export const TEXT_STYLE_FIXTURES: readonly TextStyleFixture[] = Object.freeze([
  Object.freeze({
    id: "text-style-long-text",
    screen: "textStyle" as const,
    version: "1.0.0" as const,
    closed: true as const,
    displayOnly: true as const,
    exportEnabled: false as const,
    editEnabled: false as const,
    sample: "long-text-display-only",
  }),
  Object.freeze({
    id: "text-style-scale",
    screen: "textStyle" as const,
    version: "1.0.0" as const,
    closed: true as const,
    displayOnly: true as const,
    exportEnabled: false as const,
    editEnabled: false as const,
    scales: Object.freeze([1, 1.5, 2]),
  }),
]);

export const TEXT_STYLE_CONTRACT = Object.freeze({
  id: TEXT_STYLE_ID,
  screen: TEXT_STYLE_ID,
  version: TEXT_STYLE_VERSION,
  scope: TEXT_STYLE_ID,
  unit: "px" as const,
  supportStatus: "locked" as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  fingerprint: "text-style-v1",
  supportedFields: TEXT_STYLE_SUPPORTED_FIELDS,
  requiredFields: TEXT_STYLE_SUPPORTED_FIELDS,
  cardFields: Object.freeze([] as string[]),
  workoutFields: Object.freeze([] as string[]),
  protectedRegions: Object.freeze([] as { id: string; x: number; y: number; width: number; height: number }[]),
});

export type TextStyleResolution =
  | {
      status: "supported";
      locked: true;
      reason: string;
      unit: "px";
      min: number;
      max: number;
      defaultValue: number;
    }
  | {
      status: "supported";
      locked: true;
      reason: string;
      unit: "px";
      allowed: readonly ["normal", "bold"];
      defaultValue: "normal" | "bold";
    }
  | {
      status: "locked";
      locked: true;
      reason: string;
      exportable?: false;
    };

export function resolveTextStyleProperty(key: string): TextStyleResolution {
  const match = /^([a-z]+)\.(base|min|weight)$/.exec(key);
  if (match && (TEXT_STYLE_ROLES as readonly string[]).includes(match[1])) {
    const role = match[1] as TextStyleRole;
    const token = TEXT_STYLE_PUBLISHED.roles[role];
    if (match[2] === "weight") {
      return {
        status: "supported",
        locked: true,
        reason: TEXT_STYLE_LOCK_REASONS.displayOnly,
        unit: "px",
        allowed: ["normal", "bold"],
        defaultValue: token.weight,
      };
    }
    return {
      status: "supported",
      locked: true,
      reason: TEXT_STYLE_LOCK_REASONS.displayOnly,
      unit: "px",
      min: token.min,
      max: token.base,
      defaultValue: match[2] === "base" ? token.base : token.min,
    };
  }
  if (A11Y_KEYS.has(key)) {
    return {
      status: "locked",
      locked: true,
      reason: TEXT_STYLE_LOCK_REASONS.accessibility,
      exportable: false,
    };
  }
  if (FONT_KEYS.has(key)) {
    return {
      status: "locked",
      locked: true,
      reason: TEXT_STYLE_LOCK_REASONS.customFont,
    };
  }
  if (CSS_KEYS.has(key)) {
    return {
      status: "locked",
      locked: true,
      reason: TEXT_STYLE_LOCK_REASONS.arbitraryCss,
    };
  }
  return {
    status: "locked",
    locked: true,
    reason: TEXT_STYLE_LOCK_REASONS.unknownField,
  };
}

export function rejectTextStyleValue(key: string, value: unknown): { ok: false; reason: string } {
  if (A11Y_KEYS.has(key)) return { ok: false, reason: TEXT_STYLE_LOCK_REASONS.accessibility };
  if (FONT_KEYS.has(key) || (typeof value === "string" && PATH_PATTERN.test(value))) {
    if (key === "fontPath" || key === "fontFile" || (typeof value === "string" && PATH_PATTERN.test(value))) {
      if (key === "fontPath" || key === "fontFile") return { ok: false, reason: TEXT_STYLE_LOCK_REASONS.fontPath };
    }
    return { ok: false, reason: TEXT_STYLE_LOCK_REASONS.customFont };
  }
  if (CSS_KEYS.has(key) || (typeof value === "string" && /[{}:]/.test(value))) {
    return { ok: false, reason: TEXT_STYLE_LOCK_REASONS.arbitraryCss };
  }
  return { ok: false, reason: TEXT_STYLE_LOCK_REASONS.displayOnly };
}
