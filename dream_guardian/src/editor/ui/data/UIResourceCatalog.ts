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
