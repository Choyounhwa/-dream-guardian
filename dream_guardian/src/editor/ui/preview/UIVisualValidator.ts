import type { CaseSpec, ValidationProfile } from "./UIValidationProfiles";

export const VISUAL_BROWSER_VERIFIED = false;

export type Probe = {
  runnable: boolean;
  contrastMeasurable: boolean;
  protectedRegion: boolean;
  readability: boolean;
};

export type CaseReport = {
  caseId: string;
  status: "pass" | "fail" | "unverified";
  protectedRegion: boolean;
  readability: boolean;
  reason?: string;
};

export function runCase(_profile: ValidationProfile, caseSpec: CaseSpec, probe: Probe): CaseReport {
  const caseId = caseSpec.caseId;
  if (!probe.runnable) {
    return {
      caseId,
      status: "unverified",
      protectedRegion: probe.protectedRegion,
      readability: probe.readability,
      reason: "profile not runnable",
    };
  }
  if (!probe.contrastMeasurable) {
    return {
      caseId,
      status: "unverified",
      protectedRegion: probe.protectedRegion,
      readability: probe.readability,
      reason: "contrast not measurable",
    };
  }
  const status = probe.protectedRegion && probe.readability ? "pass" : "fail";
  return {
    caseId,
    status,
    protectedRegion: probe.protectedRegion,
    readability: probe.readability,
  };
}
