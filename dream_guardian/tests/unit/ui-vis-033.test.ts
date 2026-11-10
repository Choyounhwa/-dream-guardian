import { describe, expect, it, beforeEach } from "vitest";
import {
  UIResourceCatalog,
  defaultResourceCatalog,
  resetResourceCatalog,
  type ImageAssetRecord,
  APPROVED_RESOURCES,
} from "../../src/editor/ui/data/UIResourceCatalog";
import {
  importLocalImage,
  validateImageImport,
  parseImageBinary,
  calculateFitBounds,
  MAX_IMAGE_FILE_BYTES,
  MAX_IMAGE_DIMENSION,
} from "../../src/editor/ui/io/UIVisualImageImport";

function createPngBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  // PNG signature
  bytes.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
  // IHDR length 13
  bytes.set([0x00, 0x00, 0x00, 0x0D], 8);
  // 'IHDR'
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  // width (4 bytes big-endian)
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  // bit depth 8, color type 6 (RGBA), compression 0, filter 0, interlace 0
  bytes[24] = 8;
  bytes[25] = 6;
  bytes[26] = 0;
  bytes[27] = 0;
  bytes[28] = 0;
  // CRC dummy
  view.setUint32(29, 0x12345678, false);
  return bytes;
}

function createJpegBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(23);
  // SOI
  bytes[0] = 0xFF;
  bytes[1] = 0xD8;
  // SOF0 marker
  bytes[2] = 0xFF;
  bytes[3] = 0xC0;
  // Length 17
  bytes[4] = 0x00;
  bytes[5] = 0x11;
  // Precision 8
  bytes[6] = 0x08;
  // Height & Width (big-endian)
  const view = new DataView(bytes.buffer);
  view.setUint16(7, height, false);
  view.setUint16(9, width, false);
  // 3 components
  bytes[11] = 0x03;
  bytes.set([0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01], 12);
  // EOI
  bytes[21] = 0xFF;
  bytes[22] = 0xD9;
  return bytes;
}

function createWebPLossyBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, 22, true);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x20], 12);
  view.setUint32(16, 10, true);
  bytes[20] = 0x00;
  bytes[21] = 0x00;
  bytes[22] = 0x00;
  bytes[23] = 0x9D;
  bytes[24] = 0x01;
  bytes[25] = 0x2A;
  view.setUint16(26, width & 0x3FFF, true);
  view.setUint16(28, height & 0x3FFF, true);
  return bytes;
}

function createWebPLosslessBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(25);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, 17, true);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x4C], 12);
  view.setUint32(16, 5, true);
  bytes[20] = 0x2F;
  const wMinus1 = width - 1;
  const hMinus1 = height - 1;
  const val = (wMinus1 & 0x3FFF) | ((hMinus1 & 0x3FFF) << 14);
  view.setUint32(21, val, true);
  return bytes;
}

function createWebPBytes(width: number, height: number): Uint8Array {
  // VP8X WebP
  const bytes = new Uint8Array(30);
  // 'RIFF'
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  // file size - 8
  const view = new DataView(bytes.buffer);
  view.setUint32(4, 22, true);
  // 'WEBP'
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  // 'VP8X'
  bytes.set([0x56, 0x50, 0x38, 0x58], 12);
  // chunk length 10
  view.setUint32(16, 10, true);
  // flags (4 bytes at 20)
  view.setUint32(20, 0, true);
  // 24-bit canvas width - 1 (little-endian)
  const wMinus1 = width - 1;
  bytes[24] = wMinus1 & 0xFF;
  bytes[25] = (wMinus1 >> 8) & 0xFF;
  bytes[26] = (wMinus1 >> 16) & 0xFF;
  // 24-bit canvas height - 1 (little-endian)
  const hMinus1 = height - 1;
  bytes[27] = hMinus1 & 0xFF;
  bytes[28] = (hMinus1 >> 8) & 0xFF;
  bytes[29] = (hMinus1 >> 16) & 0xFF;
  return bytes;
}

describe("[UI-VIS-033] Image Catalog & Local Import Verification Model", () => {
  beforeEach(() => {
    resetResourceCatalog();
  });

  describe("1. Magic byte signature and MIME verification", () => {
    it("successfully imports valid PNG, JPEG, and WebP images", () => {
      const png = createPngBytes(120, 80);
      const resPng = importLocalImage({ name: "panel.png", bytes: png, mimeType: "image/png" });
      expect(resPng.ok).toBe(true);
      if (resPng.ok) {
        expect(resPng.asset.format).toBe("png");
        expect(resPng.asset.width).toBe(120);
        expect(resPng.asset.height).toBe(80);
        expect(resPng.asset.id.startsWith("asset-img-")).toBe(true);
      }

      const jpeg = createJpegBytes(300, 200);
      const resJpeg = importLocalImage({ name: "photo.jpg", bytes: jpeg, mimeType: "image/jpeg" });
      expect(resJpeg.ok).toBe(true);
      if (resJpeg.ok) {
        expect(resJpeg.asset.format).toBe("jpeg");
        expect(resJpeg.asset.width).toBe(300);
        expect(resJpeg.asset.height).toBe(200);
      }

      const webp = createWebPBytes(400, 300);
      const resWebp = importLocalImage({ name: "banner.webp", bytes: webp, mimeType: "image/webp" });
      expect(resWebp.ok).toBe(true);
      if (resWebp.ok) {
        expect(resWebp.asset.format).toBe("webp");
        expect(resWebp.asset.width).toBe(400);
        expect(resWebp.asset.height).toBe(300);
      }

      // WebP VP8 lossy
      const webpLossy = createWebPLossyBytes(320, 240);
      const resLossy = importLocalImage({ name: "lossy.webp", bytes: webpLossy });
      expect(resLossy.ok).toBe(true);
      if (resLossy.ok) {
        expect(resLossy.asset.format).toBe("webp");
        expect(resLossy.asset.width).toBe(320);
        expect(resLossy.asset.height).toBe(240);
      }

      // WebP VP8L lossless
      const webpLossless = createWebPLosslessBytes(256, 256);
      const resLossless = importLocalImage({ name: "lossless.webp", bytes: webpLossless });
      expect(resLossless.ok).toBe(true);
      if (resLossless.ok) {
        expect(resLossless.asset.format).toBe("webp");
        expect(resLossless.asset.width).toBe(256);
        expect(resLossless.asset.height).toBe(256);
      }
    });

    it("rejects forged MIME where declared MIME does not match magic bytes", () => {
      // Content is JPEG magic bytes, but declared as PNG
      const jpegContent = createJpegBytes(100, 100);
      const res = importLocalImage({
        name: "trick.png",
        bytes: jpegContent,
        mimeType: "image/png",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("FORGED_MIME_DETECTED");
      }
    });

    it("rejects extension mismatch where extension does not match magic bytes", () => {
      const pngContent = createPngBytes(100, 100);
      const res = importLocalImage({
        name: "trick.jpg",
        bytes: pngContent,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("FORGED_EXTENSION_DETECTED");
      }
    });

    it("rejects unsupported format magic bytes (e.g. GIF, BMP)", () => {
      const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00]);
      const res = importLocalImage({
        name: "anim.gif",
        bytes: gifBytes,
        mimeType: "image/gif",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("UNSUPPORTED_FORMAT");
      }
    });
  });

  describe("2. Limits and corrupted file rejection", () => {
    it("rejects empty files (0 bytes)", () => {
      const res = importLocalImage({
        name: "empty.png",
        bytes: new Uint8Array(0),
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("EMPTY_FILE");
      }
    });

    it("rejects files exceeding maximum byte size (10MB)", () => {
      const bigBytes = new Uint8Array(MAX_IMAGE_FILE_BYTES + 1);
      bigBytes.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
      const res = importLocalImage({
        name: "huge.png",
        bytes: bigBytes,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("EXCEEDS_MAX_BYTES");
      }
    });

    it("rejects images exceeding maximum pixel dimension (4096px)", () => {
      const hugePng = createPngBytes(MAX_IMAGE_DIMENSION + 10, 100);
      const res = importLocalImage({
        name: "wide.png",
        bytes: hugePng,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("EXCEEDS_MAX_DIMENSION");
      }
    });

    it("rejects corrupted headers (incomplete PNG, missing IHDR, corrupted markers)", () => {
      // Incomplete PNG signature
      const truncated = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
      const res1 = importLocalImage({ name: "corrupt.png", bytes: truncated });
      expect(res1.ok).toBe(false);
      if (!res1.ok) {
        expect(res1.code).toBe("CORRUPTED_IMAGE");
      }

      // JPEG SOI without SOF marker
      const corruptJpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xDB, 0x00, 0x04, 0x00, 0x00, 0xFF, 0xD9]);
      const res2 = importLocalImage({ name: "corrupt.jpg", bytes: corruptJpeg });
      expect(res2.ok).toBe(false);
      if (!res2.ok) {
        expect(res2.code).toBe("CORRUPTED_IMAGE");
      }
    });
  });

  describe("3. Security constraints (URL, SVG, script injection, path traversal)", () => {
    it("rejects remote URLs (http, https, //, ftp) and data/blob URLs", () => {
      const res1 = importLocalImage({
        name: "https://evil.com/payload.png",
        bytes: createPngBytes(10, 10),
      });
      expect(res1.ok).toBe(false);
      if (!res1.ok) {
        expect(res1.code).toBe("URL_IMPORT_FORBIDDEN");
      }

      const res2 = importLocalImage({
        name: "http://attacker.com/test.jpg",
        bytes: createJpegBytes(10, 10),
      });
      expect(res2.ok).toBe(false);
      if (!res2.ok) {
        expect(res2.code).toBe("URL_IMPORT_FORBIDDEN");
      }

      const res3 = importLocalImage({
        name: "data:image/png;base64,iVBORw0KGgo...",
        bytes: createPngBytes(10, 10),
      });
      expect(res3.ok).toBe(false);
      if (!res3.ok) {
        expect(res3.code).toBe("URL_IMPORT_FORBIDDEN");
      }

      const res4 = importLocalImage({
        name: "blob:http://localhost:3000/1234-5678",
        bytes: createPngBytes(10, 10),
      });
      expect(res4.ok).toBe(false);
      if (!res4.ok) {
        expect(res4.code).toBe("URL_IMPORT_FORBIDDEN");
      }
    });

    it("rejects SVG files and SVG MIME types due to XSS risk", () => {
      const svgText = "<svg xmlns='http://www.w3.org/2000/svg'><circle/></svg>";
      const svgBytes = new TextEncoder().encode(svgText);
      const res = importLocalImage({
        name: "vector.svg",
        bytes: svgBytes,
        mimeType: "image/svg+xml",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("SVG_FORBIDDEN");
      }
    });

    it("rejects script execution payload in bytes or name", () => {
      const scriptBytes = new TextEncoder().encode("<script>alert('xss')</script>");
      const res = importLocalImage({
        name: "test<script>.png",
        bytes: scriptBytes,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(["SCRIPT_FORBIDDEN", "PATH_TRAVERSAL_DETECTED", "CORRUPTED_IMAGE", "UNSUPPORTED_FORMAT"]).toContain(res.code);
      }
    });

    it("rejects path traversal characters (.., /, \\)", () => {
      const png = createPngBytes(50, 50);
      const res1 = importLocalImage({ name: "../escape.png", bytes: png });
      expect(res1.ok).toBe(false);
      if (!res1.ok) {
        expect(res1.code).toBe("PATH_TRAVERSAL_DETECTED");
      }

      const res2 = importLocalImage({ name: "..\\windows\\escape.png", bytes: png });
      expect(res2.ok).toBe(false);
      if (!res2.ok) {
        expect(res2.code).toBe("PATH_TRAVERSAL_DETECTED");
      }

      const res3 = importLocalImage({ name: "/root/escape.png", bytes: png });
      expect(res3.ok).toBe(false);
      if (!res3.ok) {
        expect(res3.code).toBe("PATH_TRAVERSAL_DETECTED");
      }
    });
  });

  describe("4. Deduplication and durable asset ID stability", () => {
    it("deduplicates identical bytes and reuses existing durable asset ID", () => {
      const pngBytes = createPngBytes(64, 64);
      const first = importLocalImage({ name: "icon.png", bytes: pngBytes });
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      const second = importLocalImage({ name: "another_icon.png", bytes: pngBytes });
      expect(second.ok).toBe(true);
      if (!second.ok) return;

      expect(second.deduplicated).toBe(true);
      expect(second.asset.id).toBe(first.asset.id);
      expect(second.asset.hash).toBe(first.asset.hash);
    });

    it("issues distinct durable asset IDs for same filename but different contents", () => {
      const png1 = createPngBytes(64, 64);
      const png2 = createPngBytes(80, 80);

      const first = importLocalImage({ name: "avatar.png", bytes: png1 });
      const second = importLocalImage({ name: "avatar.png", bytes: png2 });

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (first.ok && second.ok) {
        expect(first.asset.id).not.toBe(second.asset.id);
        expect(first.asset.hash).not.toBe(second.asset.hash);
        expect(first.asset.width).toBe(64);
        expect(second.asset.width).toBe(80);
      }
    });

    it("ensures durable asset ID is never an ephemeral blob URL", () => {
      const png = createPngBytes(32, 32);
      const res = importLocalImage({ name: "badge.png", bytes: png });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.asset.id.startsWith("blob:")).toBe(false);
        expect(res.asset.id.startsWith("http")).toBe(false);
        expect(res.asset.id.startsWith("asset-img-")).toBe(true);
      }
    });
  });

  describe("5. Session retention and Undo/Redo GC protection", () => {
    it("preserves previous assets referenced in undo history from garbage collection", () => {
      const catalog = new UIResourceCatalog();
      const png1 = createPngBytes(10, 10);
      const png2 = createPngBytes(20, 20);
      const png3 = createPngBytes(30, 30);

      const res1 = importLocalImage({ name: "first.png", bytes: png1 }, catalog);
      const res2 = importLocalImage({ name: "second.png", bytes: png2 }, catalog);
      const res3 = importLocalImage({ name: "third.png", bytes: png3 }, catalog);

      if (!res1.ok || !res2.ok || !res3.ok) throw new Error("Import failed");

      const id1 = res1.asset.id;
      const id2 = res2.asset.id;
      const id3 = res3.asset.id;

      // Active is id3, undo history holds id1 and id2
      const gcResult = catalog.collectGarbage({
        activeAssetIds: [id3],
        undoHistoryAssetIds: [id1, id2],
        forcePrune: true,
      });

      expect(gcResult.collected).toHaveLength(0);
      expect(catalog.hasAsset(id1)).toBe(true);
      expect(catalog.hasAsset(id2)).toBe(true);
      expect(catalog.hasAsset(id3)).toBe(true);
    });

    it("never collects approved static resources during GC", () => {
      const catalog = new UIResourceCatalog();
      expect(catalog.hasAsset("image-ui-panel")).toBe(true);

      const gcResult = catalog.collectGarbage({
        activeAssetIds: [],
        undoHistoryAssetIds: [],
        forcePrune: true,
      });

      expect(gcResult.collected).not.toContain("image-ui-panel");
      expect(catalog.hasAsset("image-ui-panel")).toBe(true);
    });

    it("only purges unreferenced local assets when explicit prune is called", () => {
      const catalog = new UIResourceCatalog();
      const png1 = createPngBytes(10, 10);
      const png2 = createPngBytes(20, 20);

      const res1 = importLocalImage({ name: "kept.png", bytes: png1 }, catalog);
      const res2 = importLocalImage({ name: "orphan.png", bytes: png2 }, catalog);

      if (!res1.ok || !res2.ok) throw new Error("Import failed");

      const gcResult = catalog.collectGarbage({
        activeAssetIds: [res1.asset.id],
        undoHistoryAssetIds: [],
        forcePrune: true,
      });

      expect(gcResult.collected).toContain(res2.asset.id);
      expect(catalog.hasAsset(res1.asset.id)).toBe(true);
      expect(catalog.hasAsset(res2.asset.id)).toBe(false);
    });

    it("respects session retention policy and explicit retain/release", () => {
      const catalog = new UIResourceCatalog();
      const png1 = createPngBytes(10, 10);
      const res = importLocalImage({ name: "retained.png", bytes: png1 }, catalog);
      if (!res.ok) throw new Error("Import failed");

      // By default session retention is true, so collectGarbage without forcePrune retains all
      const gcDefault = catalog.collectGarbage({
        activeAssetIds: [],
      });
      expect(gcDefault.collected).toHaveLength(0);
      expect(catalog.hasAsset(res.asset.id)).toBe(true);

      // Explicit retain protects even during forcePrune
      catalog.retainAsset(res.asset.id);
      const gcExplicit = catalog.collectGarbage({
        activeAssetIds: [],
        undoHistoryAssetIds: [],
        forcePrune: true,
      });
      expect(gcExplicit.collected).toHaveLength(0);
      expect(catalog.hasAsset(res.asset.id)).toBe(true);

      // After release, forcePrune collects it
      catalog.releaseAsset(res.asset.id);
      const gcReleased = catalog.collectGarbage({
        activeAssetIds: [],
        undoHistoryAssetIds: [],
        forcePrune: true,
      });
      expect(gcReleased.collected).toContain(res.asset.id);
      expect(catalog.hasAsset(res.asset.id)).toBe(false);
    });
  });

  describe("6. Metadata calculation and Fit mode layout", () => {
    it("computes accurate dimensions, aspect ratio, and metadata", () => {
      const png = createPngBytes(1920, 1080);
      const res = importLocalImage({ name: "bg.png", bytes: png });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.metadata.width).toBe(1920);
        expect(res.metadata.height).toBe(1080);
        expect(res.metadata.aspectRatio).toBeCloseTo(16 / 9, 3);
        expect(res.metadata.format).toBe("png");
        expect(res.metadata.hash).toBe(res.asset.hash);
      }
    });

    it("calculates contain, cover, and fill fit bounds correctly", () => {
      const source = { width: 1000, height: 500 }; // 2:1 aspect ratio
      const target = { x: 50, y: 100, width: 400, height: 400 };

      // contain: fits width (400), height becomes 200, centered vertically
      const contain = calculateFitBounds(source, target, "contain");
      expect(contain.width).toBe(400);
      expect(contain.height).toBe(200);
      expect(contain.x).toBe(50);
      expect(contain.y).toBe(100 + (400 - 200) / 2); // 200

      // cover: fits height (400), width becomes 800, centered horizontally
      const cover = calculateFitBounds(source, target, "cover");
      expect(cover.width).toBe(800);
      expect(cover.height).toBe(400);
      expect(cover.x).toBe(50 + (400 - 800) / 2); // -150
      expect(cover.y).toBe(100);

      // fill: stretches exactly to target bounds
      const fill = calculateFitBounds(source, target, "fill");
      expect(fill.width).toBe(400);
      expect(fill.height).toBe(400);
      expect(fill.x).toBe(50);
      expect(fill.y).toBe(100);
    });
  });

  describe("7. Unified catalog access for approved and local assets", () => {
    it("directly validates image binary headers using parseImageBinary and validateImageImport", () => {
      const parsedPng = parseImageBinary(createPngBytes(64, 32));
      expect(parsedPng.ok).toBe(true);
      if (parsedPng.ok) {
        expect(parsedPng.header.format).toBe("png");
        expect(parsedPng.header.width).toBe(64);
        expect(parsedPng.header.height).toBe(32);
      }

      const validResult = validateImageImport({
        name: "test.png",
        bytes: createPngBytes(10, 10),
      });
      expect(validResult.ok).toBe(true);
    });

    it("allows listing and querying both approved resources and local images", () => {
      expect(APPROVED_RESOURCES.length).toBeGreaterThanOrEqual(2);
      expect(defaultResourceCatalog).toBeDefined();

      const catalog = new UIResourceCatalog();
      // Approved resources present by default
      const panel = catalog.getAsset("image-ui-panel");
      expect(panel).not.toBeNull();
      expect(panel?.kind).toBe("image");

      // Local asset import
      const png = createPngBytes(100, 100);
      const res = importLocalImage({ name: "user_box.png", bytes: png }, catalog);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const typedRecord: ImageAssetRecord = res.asset;
      expect(typedRecord.id).toBe(res.asset.id);

      const assets = catalog.listAssets();
      expect(assets.length).toBeGreaterThanOrEqual(3); // 2 approved + 1 local
      expect(catalog.hasAsset(res.asset.id)).toBe(true);
      expect(catalog.findAssetByHash(res.asset.hash)?.id).toBe(res.asset.id);
    });
  });
});
