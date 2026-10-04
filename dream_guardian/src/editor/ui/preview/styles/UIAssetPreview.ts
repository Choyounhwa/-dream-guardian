import { lookupAssetContract } from "../../data/UIProperties";
import {
  RESOURCE_BINARY_GUARANTEED,
  lookupApprovedResource,
  type ApprovedResource,
} from "../../data/UIResourceCatalog";
import { buildTransfer } from "../../data/UITransferBuilder";
import { inspectTransfer } from "../../io/UITransferInspector";
import {
  ASSET_LOCK_REASONS,
  ASSET_SLOT_POLICY,
  ASSET_STYLE_ID,
  ASSET_STYLE_VERSION,
  REQUIRED_ASSET_REQUIREMENTS,
  selectApprovedAsset,
  type AssetSlotId,
} from "../../data/styles/UIAssetContract";

const PREVIEW_CONTEXT_ID = "dream-guardian-ui-preview";

export const ASSET_PREVIEW_ID = "asset";

export type AssetPorts = {
  storage?: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    keys: () => string[];
  };
  bootGame?: () => void;
  camera?: { start: () => void };
  network?: { send: (payload: unknown) => void };
  onDanger?: () => void;
  copyBinary?: (resource: ApprovedResource) => void;
  upload?: (resource: ApprovedResource) => void;
};

export type SlotBinding = {
  slot: AssetSlotId;
  resource: ApprovedResource;
};

export type AssetForm = {
  screen: "asset";
  slots: Record<AssetSlotId, SlotBinding | null>;
  dirty: boolean;
  editEnabled: false;
  exportEnabled: false;
  binaryGuaranteed: false;
  binaryExists: false;
  copiesFile: false;
  uploads: false;
  writesStorage: false;
  bootsGame: false;
  missingPolicy: "lock";
  fallback: "none";
};

export type AssetSelectResult =
  | {
      ok: true;
      screen: "asset";
      registry: ReturnType<typeof lookupAssetContract> & { registered: true };
      editEnabled: false;
      exportEnabled: false;
      form: AssetForm;
    }
  | { ok: false; reason: string; locked?: boolean; exportable?: false };

type SlotMap = Record<AssetSlotId, SlotBinding | null>;

const SLOTS: readonly AssetSlotId[] = ["fontBody", "panelImage"];

function emptySlots(): SlotMap {
  return { fontBody: null, panelImage: null };
}

function copySlots(slots: SlotMap): SlotMap {
  return {
    fontBody: slots.fontBody ? { ...slots.fontBody, resource: { ...slots.fontBody.resource } } : null,
    panelImage: slots.panelImage
      ? { ...slots.panelImage, resource: { ...slots.panelImage.resource } }
      : null,
  };
}

function isSlot(value: string): value is AssetSlotId {
  return SLOTS.includes(value as AssetSlotId);
}

export function createAssetPreview(ports: AssetPorts = {}) {
  void ports.storage;
  void ports.bootGame;
  void ports.camera;
  void ports.network;
  void ports.onDanger;
  void ports.copyBinary;
  void ports.upload;

  let slots = emptySlots();
  let dirty = false;
  let generation = 0;
  const history: SlotMap[] = [];

  function bump(): void {
    generation += 1;
  }

  function form(): AssetForm {
    return {
      screen: "asset",
      slots: copySlots(slots),
      dirty,
      editEnabled: false,
      exportEnabled: false,
      binaryGuaranteed: RESOURCE_BINARY_GUARANTEED,
      binaryExists: false,
      copiesFile: ASSET_SLOT_POLICY.copiesFile,
      uploads: ASSET_SLOT_POLICY.uploads,
      writesStorage: false,
      bootsGame: false,
      missingPolicy: ASSET_SLOT_POLICY.missing,
      fallback: ASSET_SLOT_POLICY.fallback,
    };
  }

  function requirements() {
    return REQUIRED_ASSET_REQUIREMENTS.map((item) => ({
      ...item,
      connected: slots[item.slot] !== null,
      locked: slots[item.slot] === null,
    }));
  }

  function select(slot: string, value: unknown): AssetSelectResult {
    if (!isSlot(slot)) return { ok: false, reason: ASSET_LOCK_REASONS.unknownSlot };
    const raw = typeof value === "string" ? value : value && typeof value === "object" ? value : null;
    const id = typeof raw === "string" ? raw : raw && "id" in raw && typeof raw.id === "string" ? raw.id : "";
    if (id.trim() === "") {
      if (slots[slot]) {
        history.push(copySlots(slots));
        slots = { ...slots, [slot]: null };
        dirty = true;
        bump();
      }
      return { ok: false, reason: ASSET_LOCK_REASONS.unconnected };
    }
    if (/^(https?:|blob:|data:)/i.test(id) || id.includes("://")) {
      return { ok: false, reason: ASSET_LOCK_REASONS.externalUrl };
    }
    const approved = lookupApprovedResource(id);
    const picked = selectApprovedAsset(slot, id);
    if (!picked.ok) return picked;
    if (raw && typeof raw === "object" && "hash" in raw && raw.hash !== approved?.hash) {
      return { ok: false, reason: ASSET_LOCK_REASONS.tamperedHash };
    }
    history.push(copySlots(slots));
    slots = { ...slots, [slot]: { slot, resource: { ...picked.resource } } };
    dirty = true;
    bump();
    return selected();
  }

  function undo(): AssetForm {
    const previous = history.pop();
    if (previous) slots = previous;
    dirty = history.length > 0;
    bump();
    return form();
  }

  function remove(slot: AssetSlotId): AssetForm {
    if (slots[slot]) {
      history.push(copySlots(slots));
      slots = { ...slots, [slot]: null };
      dirty = true;
      bump();
    }
    return form();
  }

  function changeScreen(): AssetForm {
    slots = emptySlots();
    dirty = false;
    history.length = 0;
    bump();
    return form();
  }

  function restore(seen: number, _resource: unknown): { restored: false; reason: "stale-context" } {
    void _resource;
    if (seen !== generation) return { restored: false, reason: "stale-context" };
    return { restored: false, reason: "stale-context" };
  }

  function preview() {
    return {
      contextId: PREVIEW_CONTEXT_ID,
      generation,
      screen: "asset" as const,
      slots: copySlots(slots),
      requirements: requirements(),
      binaryGuaranteed: RESOURCE_BINARY_GUARANTEED,
      binaryExists: false as const,
      copiesFile: false as const,
      uploads: false as const,
      network: false as const,
      missingPolicy: ASSET_SLOT_POLICY.missing,
      fallback: ASSET_SLOT_POLICY.fallback,
      exportEnabled: false as const,
      editEnabled: false as const,
    };
  }

  function snapshot() {
    return {
      checkpoint: {
        screen: "asset" as const,
        slots: {
          fontBody: slots.fontBody
            ? {
                id: slots.fontBody.resource.id,
                path: slots.fontBody.resource.path,
                kind: slots.fontBody.resource.kind,
                hash: slots.fontBody.resource.hash,
              }
            : null,
          panelImage: slots.panelImage
            ? {
                id: slots.panelImage.resource.id,
                path: slots.panelImage.resource.path,
                kind: slots.panelImage.resource.kind,
                width: slots.panelImage.resource.width,
                height: slots.panelImage.resource.height,
                hash: slots.panelImage.resource.hash,
              }
            : null,
        },
        binaryGuaranteed: false as const,
        binaryExists: false as const,
        copiesFile: false as const,
        missingPolicy: "lock" as const,
        fallback: "none" as const,
      },
    };
  }

  function selected(): Extract<AssetSelectResult, { ok: true }> & { ok: true } {
    const registry = lookupAssetContract();
    return {
      ok: true as const,
      screen: "asset" as const,
      registry: { ...registry, registered: true as const },
      editEnabled: false as const,
      exportEnabled: false as const,
      form: form(),
    };
  }

  return { select, undo, remove, changeScreen, restore, preview, snapshot, form, requirements };
}

export type AssetPreview = ReturnType<typeof createAssetPreview>;

export function roundTripAsset(preview: AssetPreview = createAssetPreview()) {
  const selected = preview.form().slots.fontBody || preview.form().slots.panelImage
    ? {
        ok: true as const,
        screen: "asset" as const,
        registry: { ...lookupAssetContract(), registered: true as const },
        editEnabled: false as const,
        exportEnabled: false as const,
        form: preview.form(),
      }
    : preview.select("fontBody", "font-ui-body");
  const shown = preview.preview();
  const snap = preview.snapshot();
  const transfer = buildTransfer({
    checkpoint: snap.checkpoint,
    scope: ASSET_STYLE_ID,
    sourceId: "src-asset",
    exportId: "exp-asset",
    screen: ASSET_STYLE_ID,
    version: ASSET_STYLE_VERSION,
    previewLinked: true,
  });
  const inspected = inspectTransfer({
    file: transfer.ok ? transfer.transfer : { kind: "blocked", reason: transfer.reason },
  });
  return { selected, shown, snapshot: snap, transfer, inspected };
}

export function registerAssetPreview(): {
  registered: true;
  exportEnabled: false;
  screen: "asset";
} {
  lookupAssetContract();
  return { registered: true, exportEnabled: false, screen: "asset" };
}
