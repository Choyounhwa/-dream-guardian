import { HASHES_ARE_NOT_SIGNATURES, SOURCE_COMPARISON_NOT_PERFORMED } from "../data/UIContracts";
import { artifactHash, contentHash, sourceCheckpointHash } from "../data/UICanonicalJSON";
import { validateTransfer } from "../data/UIValidator";
import { VISUAL_BROWSER_VERIFIED } from "../preview/UIVisualValidator";

export const GAME_APPLY_VERIFIED = false;

export type TransferInspection = {
  contentHashOk: boolean;
  artifactHashOk: boolean;
  validationRecomputed: boolean;
  falsePassRejected: boolean;
  sourceComparison: typeof SOURCE_COMPARISON_NOT_PERFORMED | "match" | "mismatch";
  profileStatus: "미검증";
  projectMutated: false;
  checkpointCreated: false;
  fileCorruptBecauseOriginalMissing: false;
  accepted: boolean;
  provenanceVerified: false;
  gameApplyVerified: false;
  hashesAreSignatures: false;
  diff?: { changed: boolean; fields: string[] };
  profile?: { status: "미검증"; linked: boolean };
  provenance?: { sourceId: string; exportId: string; verified: false };
};

type InspectInput = {
  file: unknown;
  originalCheckpoint?: unknown;
  clock?: () => number;
  database?: { put?: (...args: unknown[]) => unknown; delete?: (...args: unknown[]) => unknown };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function claimedPass(file: Record<string, unknown>): boolean {
  const validation = file.validation;
  if (!isRecord(validation)) return false;
  return validation.passed === true || validation.status === "pass" || validation.ok === true;
}

function storedArtifactHash(file: Record<string, unknown>): unknown {
  if (typeof file.artifactHash === "string") return file.artifactHash;
  const integrity = file.integrity;
  if (isRecord(integrity)) return integrity.artifactHash;
  return undefined;
}

export function inspectTransfer(input: InspectInput): TransferInspection {
  void input.clock;
  void input.database;
  void HASHES_ARE_NOT_SIGNATURES;
  const file = isRecord(input.file) ? input.file : {};
  const recomputed = validateTransfer(input.file);
  let contentHashOk = false;
  let artifactHashOk = false;
  try {
    contentHashOk = typeof file.contentHash === "string" && file.contentHash === contentHash(file.content);
    const stored = storedArtifactHash(file);
    artifactHashOk = typeof stored === "string" && stored === artifactHash(file);
  } catch {
    contentHashOk = false;
    artifactHashOk = false;
  }
  const falsePassRejected = claimedPass(file) && !recomputed.ok;
  let sourceComparison: TransferInspection["sourceComparison"] = SOURCE_COMPARISON_NOT_PERFORMED;
  if (input.originalCheckpoint !== undefined) {
    const claimed = file.sourceCheckpointHash;
    let actual = "";
    try {
      actual = sourceCheckpointHash(input.originalCheckpoint);
    } catch {
      actual = "";
    }
    sourceComparison = claimed === actual ? "match" : "mismatch";
  }
  const profileStatus = VISUAL_BROWSER_VERIFIED ? "미검증" : "미검증";
  const accepted = recomputed.ok && contentHashOk && artifactHashOk && !falsePassRejected;
  const provenance = isRecord(file.provenance) ? file.provenance : {};
  const sourceId = typeof provenance.sourceId === "string" ? provenance.sourceId : "";
  const exportId = typeof provenance.exportId === "string" ? provenance.exportId : "";
  const changed = sourceComparison === "mismatch";
  return {
    contentHashOk,
    artifactHashOk,
    validationRecomputed: true,
    falsePassRejected,
    sourceComparison,
    profileStatus,
    projectMutated: false,
    checkpointCreated: false,
    fileCorruptBecauseOriginalMissing: false,
    accepted,
    provenanceVerified: false,
    gameApplyVerified: GAME_APPLY_VERIFIED,
    hashesAreSignatures: false,
    diff: { changed, fields: changed ? ["sourceCheckpointHash"] : [] },
    profile: { status: "미검증", linked: profileStatus === "미검증" },
    provenance: { sourceId, exportId, verified: false },
  };
}
