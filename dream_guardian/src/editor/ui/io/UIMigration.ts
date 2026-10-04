import { KINDS, SCHEMA_VERSION } from "../data/UIContracts";
import { lookupScreenContract } from "../data/UIProperties";
import { validateProject } from "../data/UIValidator";

export type MigrationStepReport = { step: string; status: "ok" | "blocked" | "failed"; detail: string };

export type MigrationOk = {
  ok: true;
  document: Record<string, unknown>;
  steps: string[];
  report: MigrationStepReport[];
  sourceProjectId?: string;
};

export type MigrationFail = {
  ok: false;
  reason: string;
  originalBytes: string;
  steps: string[];
};

export type MigrationResult = MigrationOk | MigrationFail;

const TABLE: Record<string, (doc: Record<string, unknown>) => Record<string, unknown>> = {};

function fail(reason: string, originalBytes: string, steps: string[]): MigrationFail {
  return { ok: false, reason, originalBytes, steps };
}

export function migrateStepwise(raw: string): MigrationResult {
  const steps = ["parse"];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail("parse error", raw, steps);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return fail("parse error", raw, steps);
  }
  const doc = parsed as Record<string, unknown>;
  steps.push("kind");
  if (doc.kind === KINDS.transfer) {
    return fail("transfer file is not auto-converted to an edit original", raw, steps);
  }
  if (doc.kind !== KINDS.project) {
    return fail("unknown kind", raw, steps);
  }
  const sourceProjectId = typeof doc.projectId === "string" ? doc.projectId : undefined;
  delete doc.projectId;
  steps.push("schemaVersion");
  const version = doc.schemaVersion;
  if (typeof version !== "string") {
    return fail("future schemaVersion rejected", raw, steps);
  }
  if (version !== SCHEMA_VERSION) {
    const step = TABLE[version];
    if (!step) return fail("future schemaVersion rejected", raw, steps);
    steps.push(`migrate:${version}`);
    const next = step({ ...doc });
    return migrateStepwise(JSON.stringify(next));
  }
  steps.push("registry");
  const contract = lookupScreenContract("menu", version, "menu");
  if (!("requiredFields" in contract)) {
    return fail("unregistered-screen-contract", raw, steps);
  }
  steps.push("validate");
  const validated = validateProject(doc);
  if (!validated.ok) {
    return fail(validated.errors.map((error) => error.code).join(","), raw, steps);
  }
  const report: MigrationStepReport[] = steps.map((step) => ({
    step,
    status: "ok",
    detail: step === "registry" ? contract.supportStatus : "passed",
  }));
  return { ok: true, document: doc, steps, report, sourceProjectId };
}
