import {
  RESOURCE_BINARY_GUARANTEED,
  lookupApprovedResource,
  type ApprovedResource,
  type ResourceKind,
} from "../UIResourceCatalog";

export const ASSET_STYLE_ID = "asset";
export const ASSET_STYLE_VERSION = "1.0.0";

export const ASSET_JSON_LIMITS = Object.freeze({
  maxBytes: 1024 * 1024,
  maxDepth: 16,
  maxName: 80,
});

export const ASSET_LOCK_REASONS = Object.freeze({
  unconnected: "asset-lock:unconnected-slot",
  unapproved: "asset-lock:unapproved-id",
  externalUrl: "asset-lock:external-url",
  kindMismatch: "asset-lock:kind-mismatch",
  tamperedHash: "asset-lock:tampered-hash",
  unknownSlot: "asset-lock:unknown-slot",
});

export const ASSET_SLOT_POLICY = Object.freeze({
  missing: "lock" as const,
  fallback: "none" as const,
  binaryGuaranteed: RESOURCE_BINARY_GUARANTEED,
  copiesFile: false as const,
  uploads: false as const,
  network: false as const,
  bootsGame: false as const,
  writesStorage: false as const,
});

export type AssetSlotId = "fontBody" | "panelImage";

export type AssetRequirement = {
  readonly slot: AssetSlotId;
  readonly resourceId: string;
  readonly kind: ResourceKind;
  readonly required: true;
  readonly missing: "lock";
  readonly fallback: "none";
};

export const REQUIRED_ASSET_REQUIREMENTS: readonly AssetRequirement[] = Object.freeze([
  Object.freeze({
    slot: "fontBody" as const,
    resourceId: "font-ui-body",
    kind: "font" as const,
    required: true as const,
    missing: "lock" as const,
    fallback: "none" as const,
  }),
  Object.freeze({
    slot: "panelImage" as const,
    resourceId: "image-ui-panel",
    kind: "image" as const,
    required: true as const,
    missing: "lock" as const,
    fallback: "none" as const,
  }),
]);

const SLOT_BY_ID = new Map(REQUIRED_ASSET_REQUIREMENTS.map((item) => [item.slot, item]));

const EXTERNAL = /^(https?:|blob:|data:)/i;

export type AssetSelection =
  | { ok: true; slot: AssetSlotId; resource: ApprovedResource; exportable: false }
  | { ok: false; locked: true; reason: string; exportable: false };

export function selectApprovedAsset(
  slot: string,
  selection: string | { id: string; hash?: string } | null,
): AssetSelection {
  const requirement = SLOT_BY_ID.get(slot as AssetSlotId);
  if (!requirement) {
    return { ok: false, locked: true, reason: ASSET_LOCK_REASONS.unknownSlot, exportable: false };
  }
  if (selection == null || selection === "") {
    return { ok: false, locked: true, reason: ASSET_LOCK_REASONS.unconnected, exportable: false };
  }
  const id = typeof selection === "string" ? selection : selection.id;
  if (EXTERNAL.test(id) || id.includes("://") || id.startsWith("data:")) {
    return { ok: false, locked: true, reason: ASSET_LOCK_REASONS.externalUrl, exportable: false };
  }
  const resource = lookupApprovedResource(id);
  if (!resource || resource.id !== requirement.resourceId) {
    return { ok: false, locked: true, reason: ASSET_LOCK_REASONS.unapproved, exportable: false };
  }
  if (resource.kind !== requirement.kind) {
    return { ok: false, locked: true, reason: ASSET_LOCK_REASONS.kindMismatch, exportable: false };
  }
  if (typeof selection !== "string" && selection.hash !== undefined && selection.hash !== resource.hash) {
    return { ok: false, locked: true, reason: ASSET_LOCK_REASONS.tamperedHash, exportable: false };
  }
  return { ok: true, slot: requirement.slot, resource, exportable: false };
}

export const ASSET_CONTRACT = Object.freeze({
  id: ASSET_STYLE_ID,
  screen: ASSET_STYLE_ID,
  version: ASSET_STYLE_VERSION,
  scope: ASSET_STYLE_ID,
  registered: true as const,
  editEnabled: false as const,
  exportEnabled: false as const,
  supportStatus: "locked" as const,
  requirements: REQUIRED_ASSET_REQUIREMENTS,
  policy: ASSET_SLOT_POLICY,
  binaryGuaranteed: RESOURCE_BINARY_GUARANTEED,
  bootsGame: false as const,
  writesStorage: false as const,
});
