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

// =========================================================================
// UI-VIS-034: Preview Asset Cache, Decode Lifecycle & Bridge Validation
// =========================================================================

export interface AssetPreviewEntry {
  readonly assetId: string;
  readonly blobUrl: string;
  readonly width: number;
  readonly height: number;
  readonly decoded: boolean;
  readonly createdAt: number;
}

export interface AssetPreviewCacheOptions {
  previewId?: string;
  allowedOrigins?: readonly string[];
  createObjectURL?: (blob: any) => string;
  revokeObjectURL?: (url: string) => void;
  imageDecoder?: (blobUrl: string, width?: number, height?: number) => Promise<{ width: number; height: number }>;
}

export class UIAssetPreviewCache {
  private readonly _previewId: string;
  private readonly _allowedOrigins: readonly string[];
  private readonly _createObjectURL: (blob: any) => string;
  private readonly _revokeObjectURL: (url: string) => void;
  private readonly _imageDecoder: (blobUrl: string, width?: number, height?: number) => Promise<{ width: number; height: number }>;
  private readonly _entries = new Map<string, AssetPreviewEntry>();

  constructor(options?: AssetPreviewCacheOptions) {
    this._previewId = options?.previewId ?? `preview-cache-${Date.now()}`;
    this._allowedOrigins = options?.allowedOrigins ?? ["http://localhost:3000", "http://127.0.0.1:3000"];

    this._createObjectURL =
      options?.createObjectURL ??
      (typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
        ? URL.createObjectURL.bind(URL)
        : (_blob: any) => `blob:dg-preview-${Math.random().toString(36).slice(2, 9)}`);

    this._revokeObjectURL =
      options?.revokeObjectURL ??
      (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function"
        ? URL.revokeObjectURL.bind(URL)
        : (_url: string) => {});

    this._imageDecoder =
      options?.imageDecoder ??
      (async (blobUrl: string, width?: number, height?: number) => {
        if (typeof Image !== "undefined") {
          return new Promise<{ width: number; height: number }>((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth || width || 100, height: img.naturalHeight || height || 100 });
            img.onerror = () => resolve({ width: width || 100, height: height || 100 });
            img.src = blobUrl;
          });
        }
        return { width: width || 100, height: height || 100 };
      });
  }

  get previewId(): string {
    return this._previewId;
  }

  get allowedOrigins(): readonly string[] {
    return this._allowedOrigins;
  }

  verifyOrigin(origin: string): boolean {
    return validatePreviewBridgeOrigin(origin, this._allowedOrigins);
  }

  get activeUrlCount(): number {
    return this._entries.size;
  }

  getEntry(assetId: string): AssetPreviewEntry | null {
    return this._entries.get(assetId) ?? null;
  }

  has(assetId: string): boolean {
    return this._entries.has(assetId);
  }

  async resolveAssetUrl(asset: {
    id: string;
    bytes?: Uint8Array | ArrayBuffer;
    mimeType?: string;
    width?: number;
    height?: number;
  }): Promise<string> {
    const existing = this._entries.get(asset.id);
    if (existing) {
      return existing.blobUrl;
    }

    let blobUrl = "";
    if (asset.bytes) {
      const bytesPart = asset.bytes as any;
      const blob = typeof Blob !== "undefined"
        ? new Blob([bytesPart], { type: asset.mimeType || "image/png" })
        : { size: (asset.bytes as any).byteLength || 0, type: asset.mimeType || "image/png" };
      blobUrl = this._createObjectURL(blob);
    } else {
      blobUrl = `blob:dg-asset-${asset.id}`;
    }

    const dims = await this._imageDecoder(blobUrl, asset.width, asset.height);

    const entry: AssetPreviewEntry = {
      assetId: asset.id,
      blobUrl,
      width: dims.width,
      height: dims.height,
      decoded: true,
      createdAt: Date.now(),
    };

    this._entries.set(asset.id, entry);
    return blobUrl;
  }

  releaseAsset(assetId: string): boolean {
    const entry = this._entries.get(assetId);
    if (!entry) return false;
    this._revokeObjectURL(entry.blobUrl);
    this._entries.delete(assetId);
    return true;
  }

  clear(): void {
    for (const entry of this._entries.values()) {
      this._revokeObjectURL(entry.blobUrl);
    }
    this._entries.clear();
  }

  dispose(): void {
    this.clear();
  }
}

export function createAssetPreviewCache(options?: AssetPreviewCacheOptions): UIAssetPreviewCache {
  return new UIAssetPreviewCache(options);
}

export function validatePreviewBridgeOrigin(
  origin: string,
  allowedOrigins: readonly string[] = ["http://localhost:3000", "http://127.0.0.1:3000"]
): boolean {
  if (!origin || origin === "*" || origin === "null") {
    return false;
  }
  return allowedOrigins.includes(origin);
}

export function filterSafeAssetBridgePayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const raw = payload as Record<string, unknown>;
  const safe: Record<string, unknown> = {};

  const allowedKeys = [
    "assetId",
    "bytes",
    "mimeType",
    "width",
    "height",
    "contentHash",
    "name",
    "format",
    "aspectRatio",
    "byteLength",
  ];

  for (const key of allowedKeys) {
    if (raw[key] !== undefined) {
      safe[key] = raw[key];
    }
  }

  return safe;
}
