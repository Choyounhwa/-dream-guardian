export const STYLE_TRANSFER_VERSION = "style-1.0.0" as const;

export const RESOURCE_BINARY_GUARANTEED = false as const;

export type ResourceKind = "font" | "image";

export type ApprovedResource = {
  readonly id: string;
  readonly path: string;
  readonly kind: ResourceKind;
  readonly width: number | null;
  readonly height: number | null;
  readonly hash: string;
};

const FONT_HASH = "a".repeat(64);
const IMAGE_HASH = "b".repeat(64);

export const APPROVED_RESOURCES: readonly ApprovedResource[] = Object.freeze([
  Object.freeze({
    id: "font-ui-body",
    path: "assets/ui/font-ui-body.woff2",
    kind: "font" as const,
    width: null,
    height: null,
    hash: FONT_HASH,
  }),
  Object.freeze({
    id: "image-ui-panel",
    path: "assets/ui/image-ui-panel.png",
    kind: "image" as const,
    width: 1080,
    height: 2160,
    hash: IMAGE_HASH,
  }),
]);

const BY_ID = new Map(APPROVED_RESOURCES.map((item) => [item.id, item]));

export function lookupApprovedResource(id: string): ApprovedResource | null {
  return BY_ID.get(id) ?? null;
}

export type AssetSource = "approved" | "local";
export type ImageFormat = "png" | "jpeg" | "webp";

export type ImageAssetRecord = {
  readonly id: string;
  readonly name: string;
  readonly kind: "image";
  readonly source: AssetSource;
  readonly format: ImageFormat;
  readonly mimeType: string;
  readonly hash: string;
  readonly byteLength: number;
  readonly width: number;
  readonly height: number;
  readonly aspectRatio: number;
  readonly path?: string;
  readonly bytes?: Uint8Array;
  readonly createdAt: number;
  readonly isApproved: boolean;
};

export type AnyCatalogAsset = ImageAssetRecord | ApprovedResource;

export interface GarbageCollectionOptions {
  readonly activeAssetIds: Iterable<string>;
  readonly undoHistoryAssetIds?: Iterable<string>;
  readonly forcePrune?: boolean;
}

export interface GarbageCollectionResult {
  readonly collected: string[];
  readonly retained: string[];
}

export class UIResourceCatalog {
  private readonly localAssetsById = new Map<string, ImageAssetRecord>();
  private readonly assetsByHash = new Map<string, ImageAssetRecord>();
  private readonly explicitlyRetainedIds = new Set<string>();
  private sessionRetention = true;

  constructor(initialApproved: readonly ApprovedResource[] = APPROVED_RESOURCES) {
    // Approved resources are available in the lookup map
    for (const res of initialApproved) {
      if (res.kind === "image" && res.width !== null && res.height !== null) {
        const imageRecord: ImageAssetRecord = {
          id: res.id,
          name: res.id,
          kind: "image",
          source: "approved",
          format: "png",
          mimeType: "image/png",
          hash: res.hash,
          byteLength: 0,
          width: res.width,
          height: res.height,
          aspectRatio: res.width / res.height,
          path: res.path,
          createdAt: 0,
          isApproved: true,
        };
        this.assetsByHash.set(res.hash, imageRecord);
      }
    }
  }

  public registerLocalAsset(
    record: Omit<ImageAssetRecord, "isApproved" | "source"> & {
      source?: AssetSource;
      isApproved?: boolean;
    },
  ): ImageAssetRecord {
    const fullRecord: ImageAssetRecord = {
      ...record,
      source: record.source ?? "local",
      isApproved: record.isApproved ?? false,
    };
    this.localAssetsById.set(fullRecord.id, fullRecord);
    this.assetsByHash.set(fullRecord.hash, fullRecord);
    return fullRecord;
  }

  public getAsset(id: string): AnyCatalogAsset | null {
    const local = this.localAssetsById.get(id);
    if (local) return local;
    return lookupApprovedResource(id);
  }

  public hasAsset(id: string): boolean {
    return this.localAssetsById.has(id) || BY_ID.has(id);
  }

  public findAssetByHash(hash: string): ImageAssetRecord | null {
    return this.assetsByHash.get(hash) ?? null;
  }

  public listAssets(options?: {
    kind?: ResourceKind;
    source?: AssetSource;
  }): AnyCatalogAsset[] {
    const results: AnyCatalogAsset[] = [];

    // Approved resources
    if (!options?.source || options.source === "approved") {
      for (const res of APPROVED_RESOURCES) {
        if (!options?.kind || res.kind === options.kind) {
          results.push(res);
        }
      }
    }

    // Local assets
    if (!options?.source || options.source === "local") {
      for (const asset of this.localAssetsById.values()) {
        if (!options?.kind || asset.kind === options.kind) {
          results.push(asset);
        }
      }
    }

    return results;
  }

  public listImageAssets(): ImageAssetRecord[] {
    const list: ImageAssetRecord[] = [];
    for (const res of this.listAssets({ kind: "image" })) {
      if ("format" in res) {
        list.push(res);
      } else if (res.width !== null && res.height !== null) {
        list.push({
          id: res.id,
          name: res.id,
          kind: "image",
          source: "approved",
          format: "png",
          mimeType: "image/png",
          hash: res.hash,
          byteLength: 0,
          width: res.width,
          height: res.height,
          aspectRatio: res.width / res.height,
          path: res.path,
          createdAt: 0,
          isApproved: true,
        });
      }
    }
    return list;
  }

  public retainAsset(id: string): void {
    this.explicitlyRetainedIds.add(id);
  }

  public releaseAsset(id: string): void {
    this.explicitlyRetainedIds.delete(id);
  }

  public setSessionRetention(enabled: boolean): void {
    this.sessionRetention = enabled;
  }

  public isSessionRetentionEnabled(): boolean {
    return this.sessionRetention;
  }

  public collectGarbage(options: GarbageCollectionOptions): GarbageCollectionResult {
    // If sessionRetention is true and not forcing prune, retain all
    if (this.sessionRetention && !options.forcePrune) {
      return {
        collected: [],
        retained: Array.from(this.localAssetsById.keys()),
      };
    }

    const activeSet = new Set(options.activeAssetIds);
    const undoSet = new Set(options.undoHistoryAssetIds ?? []);
    const collected: string[] = [];
    const retained: string[] = [];

    for (const [id, asset] of Array.from(this.localAssetsById.entries())) {
      // NEVER collect if active in document, in undo history, or explicitly retained
      if (activeSet.has(id) || undoSet.has(id) || this.explicitlyRetainedIds.has(id)) {
        retained.push(id);
      } else {
        // Collect orphan local asset
        this.localAssetsById.delete(id);
        if (this.assetsByHash.get(asset.hash)?.id === id) {
          this.assetsByHash.delete(asset.hash);
        }
        collected.push(id);
      }
    }

    return { collected, retained };
  }

  public clearLocalAssets(): void {
    this.localAssetsById.clear();
    this.explicitlyRetainedIds.clear();
    // Re-seed approved hashes
    this.assetsByHash.clear();
    for (const res of APPROVED_RESOURCES) {
      if (res.kind === "image" && res.width !== null && res.height !== null) {
        this.assetsByHash.set(res.hash, {
          id: res.id,
          name: res.id,
          kind: "image",
          source: "approved",
          format: "png",
          mimeType: "image/png",
          hash: res.hash,
          byteLength: 0,
          width: res.width,
          height: res.height,
          aspectRatio: res.width / res.height,
          path: res.path,
          createdAt: 0,
          isApproved: true,
        });
      }
    }
  }
}

export const defaultResourceCatalog = new UIResourceCatalog();

export function resetResourceCatalog(): void {
  defaultResourceCatalog.clearLocalAssets();
}

export function lookupCatalogAsset(id: string): AnyCatalogAsset | null {
  return defaultResourceCatalog.getAsset(id);
}
