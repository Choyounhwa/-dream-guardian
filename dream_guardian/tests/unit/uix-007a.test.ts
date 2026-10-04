import { describe, expect, it } from "vitest";
import { LIMITS } from "../../src/editor/ui/data/UIContracts";
import {
  GAME_APPLY_VERIFIED,
  acceptProfileRaw,
  createProfile,
  listCases,
} from "../../src/editor/ui/preview/UIValidationProfiles";
import {
  VISUAL_BROWSER_VERIFIED,
  runCase,
} from "../../src/editor/ui/preview/UIVisualValidator";

const fields = {
  rendererFingerprint: "renderer-v1",
  dependencyFingerprint: "deps-v1",
  fixtureId: "menu-fixture",
  displayWidth: 1080,
  displayHeight: 2160,
  dpr: 1,
  fixedTimeMs: 1000,
};

const probe = {
  runnable: true,
  contrastMeasurable: true,
  protectedRegion: true,
  readability: true,
};

describe("UIX-007A visual validation profiles", () => {
  it("fixes fingerprints, fixture, size, dpr, and time into id and hash", () => {
    const a = createProfile(fields);
    const b = createProfile({ ...fields });
    expect(a.id).toBe(b.id);
    expect(a.hash).toBe(b.hash);
    expect(a.id.startsWith("vp-")).toBe(true);
    expect(a.id).toBe(`vp-${a.hash.slice(0, 12)}`);
    expect(a.rendererFingerprint).toBe(fields.rendererFingerprint);
    expect(a.dependencyFingerprint).toBe(fields.dependencyFingerprint);
    expect(a.fixtureId).toBe(fields.fixtureId);
    expect(a.displayWidth).toBe(fields.displayWidth);
    expect(a.displayHeight).toBe(fields.displayHeight);
    expect(a.dpr).toBe(fields.dpr);
    expect(a.fixedTimeMs).toBe(fields.fixedTimeMs);
    const changed = createProfile({ ...fields, dpr: 2 });
    expect(changed.hash).not.toBe(a.hash);
    expect(changed.id).not.toBe(a.id);
    expect(createProfile({ ...fields, rendererFingerprint: "other" }).hash).not.toBe(a.hash);
    expect(createProfile({ ...fields, dependencyFingerprint: "other" }).hash).not.toBe(a.hash);
    expect(createProfile({ ...fields, fixtureId: "other" }).hash).not.toBe(a.hash);
    expect(createProfile({ ...fields, displayWidth: 720 }).hash).not.toBe(a.hash);
    expect(createProfile({ ...fields, displayHeight: 1280 }).hash).not.toBe(a.hash);
    expect(createProfile({ ...fields, fixedTimeMs: 2000 }).hash).not.toBe(a.hash);
    expect(GAME_APPLY_VERIFIED).toBe(false);
    expect(VISUAL_BROWSER_VERIFIED).toBe(false);
  });

  it("separates font scale, high contrast, and missing image results", () => {
    const profile = createProfile(fields);
    const cases = listCases(profile);
    const scales = cases.map((item) => item.fontScale);
    expect(scales).toEqual(expect.arrayContaining([1, 1.5, 2]));
    expect(cases.map((item) => item.contrast)).toEqual(expect.arrayContaining(["normal", "high"]));
    expect(cases.map((item) => item.image)).toEqual(expect.arrayContaining(["present", "missing"]));
    expect(new Set(cases.map((item) => item.caseId)).size).toBe(cases.length);
    expect(cases.length).toBe(12);
    const reports = cases.map((spec) =>
      runCase(profile, spec, {
        ...probe,
        protectedRegion: spec.fontScale !== 2,
        readability: spec.image !== "missing" && spec.contrast !== "high",
      }),
    );
    expect(reports.map((item) => item.caseId)).toEqual(cases.map((item) => item.caseId));
    const byId = new Map(reports.map((item) => [item.caseId, item]));
    const scale1 = cases.find((item) => item.fontScale === 1 && item.contrast === "normal" && item.image === "present")!;
    const scale2 = cases.find((item) => item.fontScale === 2 && item.contrast === "normal" && item.image === "present")!;
    const missing = cases.find((item) => item.fontScale === 1 && item.contrast === "normal" && item.image === "missing")!;
    const high = cases.find((item) => item.fontScale === 1 && item.contrast === "high" && item.image === "present")!;
    expect(byId.get(scale1.caseId)?.status).toBe("pass");
    expect(byId.get(scale2.caseId)?.status).toBe("fail");
    expect(byId.get(scale2.caseId)?.protectedRegion).toBe(false);
    expect(byId.get(missing.caseId)?.status).toBe("fail");
    expect(byId.get(missing.caseId)?.readability).toBe(false);
    expect(byId.get(high.caseId)?.status).toBe("fail");
    expect(byId.get(high.caseId)?.readability).toBe(false);
    expect(byId.get(scale1.caseId)?.status).not.toBe(byId.get(scale2.caseId)?.status);
  });

  it("records unverified instead of pass when the profile cannot run or contrast cannot be measured", () => {
    const profile = createProfile(fields);
    const spec = listCases(profile)[0]!;
    const blocked = runCase(profile, spec, { ...probe, runnable: false });
    expect(blocked.status).toBe("unverified");
    expect(blocked.status).not.toBe("pass");
    const unmeasured = runCase(profile, spec, { ...probe, contrastMeasurable: false });
    expect(unmeasured.status).toBe("unverified");
    expect(unmeasured.status).not.toBe("pass");
    const sibling = listCases(profile)[1]!;
    const passed = runCase(profile, spec, probe);
    const stillBlocked = runCase(profile, sibling, { ...probe, runnable: false });
    expect(passed.status).toBe("pass");
    expect(stillBlocked.status).toBe("unverified");
    const again = runCase(profile, spec, probe);
    expect(again).toEqual(passed);
    expect(GAME_APPLY_VERIFIED).toBe(false);
    expect(VISUAL_BROWSER_VERIFIED).toBe(false);
  });

  it("rejects unsafe raw profile JSON without dropping fields", () => {
    const raw = JSON.stringify(fields);
    const accepted = acceptProfileRaw(raw);
    expect(accepted.ok).toBe(true);
    expect(acceptProfileRaw(raw.replace("{", '{"__proto__":{},')).ok).toBe(false);
    expect(acceptProfileRaw(raw.replace("{", '{"constructor":{},')).ok).toBe(false);
    expect(acceptProfileRaw(raw.replace("{", '{"prototype":{},')).ok).toBe(false);
    const dup = `{"rendererFingerprint":"a","rendererFingerprint":"b","dependencyFingerprint":"d","fixtureId":"f","displayWidth":1,"displayHeight":1,"dpr":1,"fixedTimeMs":1}`;
    expect(acceptProfileRaw(dup).ok).toBe(false);
    expect(acceptProfileRaw("x".repeat(LIMITS.maxBytes + 1)).ok).toBe(false);
    let deep = "1";
    for (let i = 0; i < LIMITS.maxDepth + 2; i += 1) deep = `{"n":${deep}}`;
    expect(acceptProfileRaw(deep).ok).toBe(false);
    const longName = { ...fields, fixtureId: "n".repeat(LIMITS.maxNameLength + 1) };
    expect(acceptProfileRaw(JSON.stringify(longName)).ok).toBe(false);
    const extra = acceptProfileRaw(JSON.stringify({ ...fields, unknown: true }));
    expect(extra.ok).toBe(false);
  });
});
