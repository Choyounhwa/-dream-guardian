import { LIMITS } from "../data/UIContracts";
import { contentHash, rejectDuplicateKeys } from "../data/UICanonicalJSON";

export const GAME_APPLY_VERIFIED = false;

export const PROFILE_FIELDS = [
  "rendererFingerprint",
  "dependencyFingerprint",
  "fixtureId",
  "displayWidth",
  "displayHeight",
  "dpr",
  "fixedTimeMs",
] as const;

const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);
const FONT_SCALES = [1, 1.5, 2] as const;
const CONTRASTS = ["normal", "high"] as const;
const IMAGES = ["present", "missing"] as const;

export type ProfileFields = {
  rendererFingerprint: string;
  dependencyFingerprint: string;
  fixtureId: string;
  displayWidth: number;
  displayHeight: number;
  dpr: number;
  fixedTimeMs: number;
};

export type ValidationProfile = ProfileFields & { id: string; hash: string };

export type CaseSpec = {
  caseId: string;
  fontScale: 1 | 1.5 | 2;
  contrast: "normal" | "high";
  image: "present" | "missing";
};

function pickFields(input: ProfileFields): ProfileFields {
  return {
    rendererFingerprint: input.rendererFingerprint,
    dependencyFingerprint: input.dependencyFingerprint,
    fixtureId: input.fixtureId,
    displayWidth: input.displayWidth,
    displayHeight: input.displayHeight,
    dpr: input.dpr,
    fixedTimeMs: input.fixedTimeMs,
  };
}

export function createProfile(input: ProfileFields): ValidationProfile {
  const fields = pickFields(input);
  const hash = contentHash(fields);
  return { id: `vp-${hash.slice(0, 12)}`, hash, ...fields };
}

export function listCases(profile: ValidationProfile): CaseSpec[] {
  const cases: CaseSpec[] = [];
  for (const fontScale of FONT_SCALES) {
    for (const contrast of CONTRASTS) {
      for (const image of IMAGES) {
        cases.push({
          caseId: `${profile.id}:fs${fontScale}:c${contrast}:i${image}`,
          fontScale,
          contrast,
          image,
        });
      }
    }
  }
  return cases;
}

function depthOf(value: unknown, depth: number): number {
  if (value === null || typeof value !== "object") return depth;
  let max = depth;
  const nested = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  for (const item of nested) {
    const next = depthOf(item, depth + 1);
    if (next > max) max = next;
  }
  return max;
}

function hasForbidden(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => hasForbidden(item));
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (FORBIDDEN.has(key)) return true;
    if (hasForbidden((value as Record<string, unknown>)[key])) return true;
  }
  return false;
}

function nameTooLong(value: unknown): boolean {
  if (typeof value === "string") return value.length > LIMITS.maxNameLength;
  if (value === null || typeof value !== "object") return false;
  const nested = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  return nested.some((item) => nameTooLong(item));
}

export function acceptProfileRaw(raw: string): { ok: true; profile: ValidationProfile } | { ok: false; reason: string } {
  if (new TextEncoder().encode(raw).length > LIMITS.maxBytes) return { ok: false, reason: "max bytes exceeded" };
  const dup = rejectDuplicateKeys(raw);
  if (!dup.ok) return { ok: false, reason: dup.reason ?? "duplicate key" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid json" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "invalid profile" };
  }
  if (hasForbidden(parsed)) return { ok: false, reason: "forbidden key" };
  if (depthOf(parsed, 0) > LIMITS.maxDepth) return { ok: false, reason: "max depth exceeded" };
  if (nameTooLong(parsed)) return { ok: false, reason: "max name length exceeded" };
  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== PROFILE_FIELDS.length || PROFILE_FIELDS.some((key) => !keys.includes(key))) {
    return { ok: false, reason: "unexpected fields" };
  }
  const profile = createProfile(record as ProfileFields);
  return { ok: true, profile };
}
