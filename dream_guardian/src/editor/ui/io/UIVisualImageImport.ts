import {
  type ImageAssetRecord,
  type ImageFormat,
  type UIResourceCatalog,
  defaultResourceCatalog,
} from "../data/UIResourceCatalog";

export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_IMAGE_DIMENSION = 4096;
export const ALLOWED_IMAGE_FORMATS = ["png", "jpeg", "webp"] as const;

export type ImageImportErrorCode =
  | "INVALID_INPUT"
  | "URL_IMPORT_FORBIDDEN"
  | "PATH_TRAVERSAL_DETECTED"
  | "SVG_FORBIDDEN"
  | "SCRIPT_FORBIDDEN"
  | "UNSUPPORTED_FORMAT"
  | "FORGED_MIME_DETECTED"
  | "FORGED_EXTENSION_DETECTED"
  | "EXCEEDS_MAX_BYTES"
  | "EXCEEDS_MAX_DIMENSION"
  | "INVALID_DIMENSIONS"
  | "CORRUPTED_IMAGE"
  | "EMPTY_FILE";

export interface ImageImportInput {
  name: string;
  bytes: Uint8Array | ArrayBuffer;
  mimeType?: string;
}

export interface ImageImportMetadata {
  width: number;
  height: number;
  aspectRatio: number;
  format: ImageFormat;
  sizeBytes: number;
  hash: string;
}

export type ImageImportResult =
  | {
      ok: true;
      asset: ImageAssetRecord;
      deduplicated: boolean;
      metadata: ImageImportMetadata;
    }
  | {
      ok: false;
      code: ImageImportErrorCode;
      error: string;
      details?: Record<string, unknown>;
    };

export interface FitTargetBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface FitBoundsResult {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
}

// -------------------------------------------------------------
// Pure TypeScript SHA-256 (FIPS 180-4 compliant)
// -------------------------------------------------------------
const K_SHA256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Hex(bytes: Uint8Array): string {
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const len = bytes.length;
  // Padding: len + 1 + padZeros + 8 is a multiple of 64
  const bitLen = BigInt(len) * 8n;
  const padZeros = (119 - (len % 64)) % 64;
  const totalPaddedLen = len + 1 + padZeros + 8;
  const padded = new Uint8Array(totalPaddedLen);
  padded.set(bytes, 0);
  padded[len] = 0x80;

  // Append 64-bit length big endian
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  view.setBigUint64(totalPaddedLen - 8, bitLen, false);

  const w = new Uint32Array(64);

  for (let offset = 0; offset < totalPaddedLen; offset += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(offset + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let t = 0; t < 64; t++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K_SHA256[t] + w[t]) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4) + toHex(h5) + toHex(h6) + toHex(h7);
}

// -------------------------------------------------------------
// Format & Signature Parsers
// -------------------------------------------------------------
export interface ParsedImageHeader {
  readonly format: ImageFormat;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
}

export type ParseHeaderResult =
  | { ok: true; header: ParsedImageHeader }
  | { ok: false; code: ImageImportErrorCode; error: string };

export function parseImageBinary(bytes: Uint8Array): ParseHeaderResult {
  if (bytes.length < 4) {
    return { ok: false, code: "CORRUPTED_IMAGE", error: "File buffer too short for image header" };
  }

  // 1. Check PNG signature / attempted PNG
  if (bytes[0] === 0x89) {
    if (
      bytes.length < 8 ||
      bytes[1] !== 0x50 ||
      bytes[2] !== 0x4E ||
      bytes[3] !== 0x47 ||
      bytes[4] !== 0x0D ||
      bytes[5] !== 0x0A ||
      bytes[6] !== 0x1A ||
      bytes[7] !== 0x0A
    ) {
      return { ok: false, code: "CORRUPTED_IMAGE", error: "Incomplete or corrupt PNG signature" };
    }
    if (bytes.length < 24) {
      return { ok: false, code: "CORRUPTED_IMAGE", error: "Truncated PNG IHDR chunk" };
    }
    // Must contain IHDR chunk type
    if (
      bytes[12] !== 0x49 ||
      bytes[13] !== 0x48 ||
      bytes[14] !== 0x44 ||
      bytes[15] !== 0x52
    ) {
      return { ok: false, code: "CORRUPTED_IMAGE", error: "PNG missing initial IHDR chunk" };
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    return {
      ok: true,
      header: {
        format: "png",
        mimeType: "image/png",
        width,
        height,
      },
    };
  }

  // 2. Check JPEG: starts with FF D8
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    if (bytes.length < 4 || bytes[2] !== 0xFF) {
      return { ok: false, code: "CORRUPTED_IMAGE", error: "Corrupted JPEG header" };
    }
    let offset = 2;
    let width = 0;
    let height = 0;
    let foundSof = false;

    while (offset < bytes.length) {
      if (bytes[offset] !== 0xFF) {
        return { ok: false, code: "CORRUPTED_IMAGE", error: "Invalid JPEG marker align" };
      }
      while (offset < bytes.length && bytes[offset] === 0xFF) {
        offset++;
      }
      if (offset >= bytes.length) break;
      const marker = bytes[offset++];
      if (marker === 0xD9 || marker === 0xDA) {
        break; // EOI or SOS reached
      }
      if (marker === 0xD8 || marker === 0x00 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
        continue;
      }
      if (offset + 2 > bytes.length) {
        return { ok: false, code: "CORRUPTED_IMAGE", error: "Truncated JPEG segment length" };
      }
      const segLen = (bytes[offset] << 8) | bytes[offset + 1];
      if (segLen < 2 || offset + segLen > bytes.length) {
        return { ok: false, code: "CORRUPTED_IMAGE", error: "Invalid JPEG segment length" };
      }

      const isSOF =
        (marker >= 0xC0 && marker <= 0xC3) ||
        (marker >= 0xC5 && marker <= 0xC7) ||
        (marker >= 0xC9 && marker <= 0xCB) ||
        (marker >= 0xCD && marker <= 0xCF);

      if (isSOF) {
        if (segLen < 7) {
          return { ok: false, code: "CORRUPTED_IMAGE", error: "Truncated JPEG SOF segment" };
        }
        height = (bytes[offset + 3] << 8) | bytes[offset + 4];
        width = (bytes[offset + 5] << 8) | bytes[offset + 6];
        foundSof = true;
        break;
      }
      offset += segLen;
    }

    if (!foundSof) {
      return { ok: false, code: "CORRUPTED_IMAGE", error: "JPEG missing SOF segment" };
    }

    return {
      ok: true,
      header: {
        format: "jpeg",
        mimeType: "image/jpeg",
        width,
        height,
      },
    };
  }

  // 3. Check WebP: starts with 'RIFF'
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    if (
      bytes.length < 16 ||
      bytes[8] !== 0x57 ||
      bytes[9] !== 0x45 ||
      bytes[10] !== 0x42 ||
      bytes[11] !== 0x50
    ) {
      return { ok: false, code: "CORRUPTED_IMAGE", error: "Truncated or invalid WebP RIFF header" };
    }
    if (bytes.length < 20) {
      return { ok: false, code: "CORRUPTED_IMAGE", error: "Truncated WebP header" };
    }
    const fourCC = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

    if (fourCC === "VP8 ") {
      if (bytes.length < 30) {
        return { ok: false, code: "CORRUPTED_IMAGE", error: "Truncated WebP VP8 chunk" };
      }
      // Check start code 9D 01 2A
      if (bytes[23] !== 0x9D || bytes[24] !== 0x01 || bytes[25] !== 0x2A) {
        return { ok: false, code: "CORRUPTED_IMAGE", error: "Invalid WebP VP8 start code" };
      }
      const width = (bytes[26] | (bytes[27] << 8)) & 0x3FFF;
      const height = (bytes[28] | (bytes[29] << 8)) & 0x3FFF;
      return {
        ok: true,
        header: {
          format: "webp",
          mimeType: "image/webp",
          width,
          height,
        },
      };
    } else if (fourCC === "VP8L") {
      if (bytes.length < 25) {
        return { ok: false, code: "CORRUPTED_IMAGE", error: "Truncated WebP VP8L chunk" };
      }
      if (bytes[20] !== 0x2F) {
        return { ok: false, code: "CORRUPTED_IMAGE", error: "Invalid WebP VP8L signature" };
      }
      const val = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
      const width = (val & 0x3FFF) + 1;
      const height = ((val >>> 14) & 0x3FFF) + 1;
      return {
        ok: true,
        header: {
          format: "webp",
          mimeType: "image/webp",
          width,
          height,
        },
      };
    } else if (fourCC === "VP8X") {
      if (bytes.length < 30) {
        return { ok: false, code: "CORRUPTED_IMAGE", error: "Truncated WebP VP8X chunk" };
      }
      const width = (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1;
      const height = (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1;
      return {
        ok: true,
        header: {
          format: "webp",
          mimeType: "image/webp",
          width,
          height,
        },
      };
    }

    return { ok: false, code: "CORRUPTED_IMAGE", error: `Unsupported WebP chunk type: ${fourCC}` };
  }

  // Not recognized
  return { ok: false, code: "UNSUPPORTED_FORMAT", error: "Unsupported or unknown image magic bytes" };
}

// -------------------------------------------------------------
// Validation Pipeline
// -------------------------------------------------------------
export function validateImageImport(input: ImageImportInput): {
  ok: true;
  bytes: Uint8Array;
  header: ParsedImageHeader;
} | {
  ok: false;
  code: ImageImportErrorCode;
  error: string;
} {
  if (!input || typeof input.name !== "string" || !input.bytes) {
    return { ok: false, code: "INVALID_INPUT", error: "Invalid input structure" };
  }

  const name = input.name.trim();

  // 1. URL pattern rejection (including data: and blob: schemes)
  if (
    /^(https?:|\/\/|ftp:|data:|blob:)/i.test(name) ||
    name.includes("://") ||
    name.startsWith("//") ||
    name.startsWith("data:") ||
    name.startsWith("blob:")
  ) {
    return { ok: false, code: "URL_IMPORT_FORBIDDEN", error: "External URL or data/blob scheme import is strictly forbidden" };
  }

  // 2. Path traversal rejection
  if (
    name.includes("..") ||
    name.includes("/") ||
    name.includes("\\") ||
    name.startsWith(".") ||
    name.includes("\0")
  ) {
    return { ok: false, code: "PATH_TRAVERSAL_DETECTED", error: "Path traversal characters are forbidden in filename" };
  }

  // 3. SVG and Script in filename
  if (name.toLowerCase().endsWith(".svg") || input.mimeType?.toLowerCase() === "image/svg+xml") {
    return { ok: false, code: "SVG_FORBIDDEN", error: "SVG images are rejected to eliminate script injection / XSS risks" };
  }

  if (/<script/i.test(name) || /javascript:/i.test(name)) {
    return { ok: false, code: "SCRIPT_FORBIDDEN", error: "Script injection patterns detected in filename" };
  }

  // 4. Bytes conversion and size limit
  const bytes = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes);

  if (bytes.byteLength === 0) {
    return { ok: false, code: "EMPTY_FILE", error: "Image byte payload is empty" };
  }

  if (bytes.byteLength > MAX_IMAGE_FILE_BYTES) {
    return {
      ok: false,
      code: "EXCEEDS_MAX_BYTES",
      error: `File size ${bytes.byteLength} exceeds maximum limit of ${MAX_IMAGE_FILE_BYTES} bytes`,
    };
  }

  // 5. Inspect bytes for embedded SVG or Script tags
  const probeLen = Math.min(bytes.length, 2048);
  let asciiText = "";
  for (let i = 0; i < probeLen; i++) {
    asciiText += String.fromCharCode(bytes[i]);
  }
  const asciiLower = asciiText.toLowerCase();

  if (asciiLower.includes("<svg") || asciiLower.includes("<?xml") || asciiLower.includes("xmlns=\"http://www.w3.org/2000/svg\"")) {
    return { ok: false, code: "SVG_FORBIDDEN", error: "SVG content detected in byte payload" };
  }

  if (asciiLower.includes("<script") || asciiLower.includes("javascript:") || asciiLower.includes("data:text/html")) {
    return { ok: false, code: "SCRIPT_FORBIDDEN", error: "Script payload detected in byte payload" };
  }

  // 6. Magic bytes signature and header parsing
  const parsed = parseImageBinary(bytes);
  if (!parsed.ok) {
    return parsed;
  }

  const { header } = parsed;

  // 7. Verify declared MIME type against detected format
  if (input.mimeType) {
    const normMime = input.mimeType.toLowerCase();
    if (normMime === "image/png" && header.format !== "png") {
      return { ok: false, code: "FORGED_MIME_DETECTED", error: "Declared MIME is image/png but magic bytes do not match" };
    }
    if ((normMime === "image/jpeg" || normMime === "image/jpg") && header.format !== "jpeg") {
      return { ok: false, code: "FORGED_MIME_DETECTED", error: "Declared MIME is image/jpeg but magic bytes do not match" };
    }
    if (normMime === "image/webp" && header.format !== "webp") {
      return { ok: false, code: "FORGED_MIME_DETECTED", error: "Declared MIME is image/webp but magic bytes do not match" };
    }
  }

  // 8. Verify extension against detected magic bytes
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : "";

  if (ext) {
    if (ext === "png" && header.format !== "png") {
      return { ok: false, code: "FORGED_EXTENSION_DETECTED", error: "File extension is .png but magic bytes do not match" };
    }
    if ((ext === "jpg" || ext === "jpeg") && header.format !== "jpeg") {
      return { ok: false, code: "FORGED_EXTENSION_DETECTED", error: "File extension is .jpg/.jpeg but magic bytes do not match" };
    }
    if (ext === "webp" && header.format !== "webp") {
      return { ok: false, code: "FORGED_EXTENSION_DETECTED", error: "File extension is .webp but magic bytes do not match" };
    }
  }

  // 9. Dimension limits
  if (header.width <= 0 || header.height <= 0) {
    return { ok: false, code: "INVALID_DIMENSIONS", error: `Invalid image dimensions: ${header.width}x${header.height}` };
  }

  if (header.width > MAX_IMAGE_DIMENSION || header.height > MAX_IMAGE_DIMENSION) {
    return {
      ok: false,
      code: "EXCEEDS_MAX_DIMENSION",
      error: `Image dimensions ${header.width}x${header.height} exceed maximum allowed dimension ${MAX_IMAGE_DIMENSION}`,
    };
  }

  return { ok: true, bytes, header };
}

// -------------------------------------------------------------
// Fit Bounds Calculation
// -------------------------------------------------------------
export function calculateFitBounds(
  source: { width: number; height: number },
  target: FitTargetBounds,
  fitMode: "contain" | "cover" | "fill",
): FitBoundsResult {
  const targetX = target.x ?? 0;
  const targetY = target.y ?? 0;
  const targetW = target.width;
  const targetH = target.height;

  if (fitMode === "fill") {
    return {
      x: targetX,
      y: targetY,
      width: targetW,
      height: targetH,
      scaleX: targetW / source.width,
      scaleY: targetH / source.height,
    };
  }

  if (fitMode === "contain") {
    const scale = Math.min(targetW / source.width, targetH / source.height);
    const fitW = source.width * scale;
    const fitH = source.height * scale;
    const x = targetX + (targetW - fitW) / 2;
    const y = targetY + (targetH - fitH) / 2;
    return {
      x,
      y,
      width: fitW,
      height: fitH,
      scaleX: scale,
      scaleY: scale,
    };
  }

  // fitMode === "cover"
  const scale = Math.max(targetW / source.width, targetH / source.height);
  const fitW = source.width * scale;
  const fitH = source.height * scale;
  const x = targetX + (targetW - fitW) / 2;
  const y = targetY + (targetH - fitH) / 2;
  return {
    x,
    y,
    width: fitW,
    height: fitH,
    scaleX: scale,
    scaleY: scale,
  };
}

// -------------------------------------------------------------
// Import Local Image Main API
// -------------------------------------------------------------
export function importLocalImage(
  input: ImageImportInput,
  catalog: UIResourceCatalog = defaultResourceCatalog,
): ImageImportResult {
  const validated = validateImageImport(input);
  if (!validated.ok) {
    return validated;
  }

  const { bytes, header } = validated;
  const hash = sha256Hex(bytes);
  const durableAssetId = `asset-img-${hash.slice(0, 16)}`;

  const metadata: ImageImportMetadata = {
    width: header.width,
    height: header.height,
    aspectRatio: header.width / header.height,
    format: header.format,
    sizeBytes: bytes.byteLength,
    hash,
  };

  // Check deduplication in catalog
  const existing = catalog.findAssetByHash(hash);
  if (existing) {
    return {
      ok: true,
      asset: existing,
      deduplicated: true,
      metadata,
    };
  }

  // Register new asset in catalog
  const assetRecord: ImageAssetRecord = {
    id: durableAssetId,
    name: input.name,
    kind: "image",
    source: "local",
    format: header.format,
    mimeType: header.mimeType,
    hash,
    byteLength: bytes.byteLength,
    width: header.width,
    height: header.height,
    aspectRatio: metadata.aspectRatio,
    bytes,
    createdAt: Date.now(),
    isApproved: false,
  };

  catalog.registerLocalAsset(assetRecord);

  return {
    ok: true,
    asset: assetRecord,
    deduplicated: false,
    metadata,
  };
}
