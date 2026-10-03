/**
 * scripts/generate-icon-assets.js
 *
 * Dream Guardian 신체 부위 벡터 아이콘 5종 이미지 에셋 생성기 (Issue #289 / UI-ASSET-008)
 * Node.js 내장 zlib, fs, path만을 사용하여 투명 배경의 표준 규격 128x128 PNG 바이너리 파일을 직접 생성합니다.
 *
 * 생성 파일:
 * 1. public/assets/ui/icon/icon_hand_left.png (128x128, 시안 #28E6FF 좌향 손바닥)
 * 2. public/assets/ui/icon/icon_hand_right.png (128x128, 노랑 #FFCB4D 우향 손바닥)
 * 3. public/assets/ui/icon/icon_head.png (128x128, 보라 #C889FF 원형 얼굴 + 2점 눈)
 * 4. public/assets/ui/icon/icon_hip.png (128x128, 주황 #FF865E 마름모 다이아몬드)
 * 5. public/assets/ui/icon/icon_shoulder.png (128x128, 청록/보라 #4DFFAA 어깨 라인)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, '../public/assets/ui/icon');

// ─── 1. PNG 인코딩 헬퍼 ───

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}
const crcTable = makeCrcTable();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const rowSize = width * 4;
  const scanlines = Buffer.alloc((rowSize + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowSize + 1);
    scanlines[rowOffset] = 0; // Filter None
    rgbaBuffer.copy(scanlines, rowOffset + 1, y * rowSize, (y + 1) * rowSize);
  }

  const idat = zlib.deflateSync(scanlines, { level: 9 });
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', iend),
  ]);
}

// ─── 2. 2D 소프트웨어 렌더링 캔버스 버퍼 ───

class RGBAImage {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4, 0);
  }

  setPixel(x, y, r, g, b, a = 255) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;

    const srcA = a / 255;
    if (srcA <= 0) return;
    if (srcA >= 1) {
      this.data[idx] = Math.min(255, Math.max(0, Math.round(r)));
      this.data[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      this.data[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      this.data[idx + 3] = 255;
      return;
    }

    const dstA = this.data[idx + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) return;

    this.data[idx] = Math.round((r * srcA + this.data[idx] * dstA * (1 - srcA)) / outA);
    this.data[idx + 1] = Math.round((g * srcA + this.data[idx + 1] * dstA * (1 - srcA)) / outA);
    this.data[idx + 2] = Math.round((b * srcA + this.data[idx + 2] * dstA * (1 - srcA)) / outA);
    this.data[idx + 3] = Math.round(outA * 255);
  }

  drawCircle(cx, cy, r, color, fill = true, stroke = false, strokeWidth = 3, glow = 0) {
    const minX = Math.max(0, Math.floor(cx - r - strokeWidth - glow));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + r + strokeWidth + glow));
    const minY = Math.max(0, Math.floor(cy - r - strokeWidth - glow));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + r + strokeWidth + glow));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (fill && dist <= r) {
          this.setPixel(x, y, color.r, color.g, color.b, color.a ?? 255);
        } else if (stroke && Math.abs(dist - r) <= strokeWidth / 2) {
          const edgeAlpha = Math.max(0, 1 - Math.abs(dist - r) / (strokeWidth / 2));
          this.setPixel(x, y, color.r, color.g, color.b, (color.a ?? 255) * edgeAlpha);
        } else if (glow > 0 && dist > r && dist <= r + glow) {
          const glowAlpha = Math.max(0, (1 - (dist - r) / glow) * 0.35);
          this.setPixel(x, y, color.r, color.g, color.b, (color.a ?? 255) * glowAlpha);
        }
      }
    }
  }

  drawCapsule(x1, y1, x2, y2, radius, color, fill = true) {
    const minX = Math.max(0, Math.floor(Math.min(x1, x2) - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(x1, x2) + radius));
    const minY = Math.max(0, Math.floor(Math.min(y1, y2) - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(y1, y2) + radius));

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        let t = lenSq === 0 ? 0 : ((x - x1) * dx + (y - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        const dist = Math.hypot(x - projX, y - projY);
        if (dist <= radius) {
          const edge = Math.min(1, radius - dist + 0.5);
          this.setPixel(x, y, color.r, color.g, color.b, (color.a ?? 255) * edge);
        }
      }
    }
  }

  toBuffer() {
    return encodePNG(this.width, this.height, this.data);
  }
}

// ─── 3. 에셋 생성 로직 ───

/**
 * 손 아이콘 생성 (isLeft: boolean)
 * - 시안(#28E6FF) 또는 노랑(#FFCB4D)
 * - 손바닥 타원 + 5개 손가락(엄지 + 검지 + 중지 + 약지 + 소지)
 */
function generateHandIcon(isLeft) {
  const size = 128;
  const img = new RGBAImage(size, size);
  const color = isLeft
    ? { r: 0x28, g: 0xE6, b: 0xFF, a: 255 } // #28E6FF 시안
    : { r: 0xFF, g: 0xCB, b: 0x4D, a: 255 }; // #FFCB4D 노랑

  const glowColor = isLeft
    ? { r: 0x28, g: 0xE6, b: 0xFF, a: 90 }
    : { r: 0xFF, g: 0xCB, b: 0x4D, a: 90 };

  const cx = 64;
  const cy = 64;
  const dir = isLeft ? 1 : -1;

  // 1. 손바닥 본체 (중앙 타원)
  const palmRadius = 26;
  img.drawCircle(cx, cy + 12, palmRadius, glowColor, false, true, 8, 12);
  img.drawCircle(cx, cy + 12, palmRadius, color, true);

  // 2. 엄지손가락 (측면으로 뻗음)
  const thumbBaseX = cx - dir * 18;
  const thumbBaseY = cy + 16;
  const thumbTipX = cx - dir * 36;
  const thumbTipY = cy + 4;
  img.drawCapsule(thumbBaseX, thumbBaseY, thumbTipX, thumbTipY, 8, color);

  // 3. 검지손가락
  const indexBaseX = cx - dir * 12;
  const indexBaseY = cy;
  const indexTipX = cx - dir * 14;
  const indexTipY = cy - 36;
  img.drawCapsule(indexBaseX, indexBaseY, indexTipX, indexTipY, 7, color);

  // 4. 중지손가락 (가장 긺)
  const middleBaseX = cx - dir * 2;
  const middleBaseY = cy - 2;
  const middleTipX = cx - dir * 2;
  const middleTipY = cy - 42;
  img.drawCapsule(middleBaseX, middleBaseY, middleTipX, middleTipY, 7.5, color);

  // 5. 약지손가락
  const ringBaseX = cx + dir * 8;
  const ringBaseY = cy;
  const ringTipX = cx + dir * 10;
  const ringTipY = cy - 36;
  img.drawCapsule(ringBaseX, ringBaseY, ringTipX, ringTipY, 7, color);

  // 6. 소지 (새끼손가락)
  const pinkyBaseX = cx + dir * 18;
  const pinkyBaseY = cy + 6;
  const pinkyTipX = cx + dir * 22;
  const pinkyTipY = cy - 26;
  img.drawCapsule(pinkyBaseX, pinkyBaseY, pinkyTipX, pinkyTipY, 6, color);

  // 7. 손목 베이스
  img.drawCapsule(cx - 10, cy + 34, cx + 10, cy + 34, 9, color);

  return img.toBuffer();
}

/**
 * 머리 아이콘 생성
 * - 보라(#C889FF)
 * - 원형 얼굴 + 2점 눈
 */
function generateHeadIcon() {
  const size = 128;
  const img = new RGBAImage(size, size);
  const color = { r: 0xC8, g: 0x89, b: 0xFF, a: 255 }; // #C889FF 보라
  const glowColor = { r: 0xC8, g: 0x89, b: 0xFF, a: 100 };
  const eyeColor = { r: 0x1A, g: 0x0A, b: 0x2A, a: 255 }; // 다크 퍼플 눈

  const cx = 64;
  const cy = 64;
  const faceR = 46;

  // 글로우 & 얼굴 원형
  img.drawCircle(cx, cy, faceR, glowColor, false, true, 8, 14);
  img.drawCircle(cx, cy, faceR, color, true);

  // 두 눈 (반짝이는 눈)
  const eyeOffsetX = 18;
  const eyeOffsetY = -6;
  const eyeR = 7;
  img.drawCircle(cx - eyeOffsetX, cy + eyeOffsetY, eyeR, eyeColor, true);
  img.drawCircle(cx + eyeOffsetX, cy + eyeOffsetY, eyeR, eyeColor, true);

  // 눈 하이라이트 (백색 점)
  const hlColor = { r: 255, g: 255, b: 255, a: 220 };
  img.drawCircle(cx - eyeOffsetX + 2, cy + eyeOffsetY - 2, 2.5, hlColor, true);
  img.drawCircle(cx + eyeOffsetX + 2, cy + eyeOffsetY - 2, 2.5, hlColor, true);

  // 미소 호 (부드러운 입)
  const smileY = cy + 18;
  img.drawCapsule(cx - 12, smileY, cx + 12, smileY, 3, eyeColor);

  return img.toBuffer();
}

/**
 * 골반 아이콘 생성
 * - 주황(#FF865E)
 * - 라운드 마름모 다이아몬드 형상
 */
function generateHipIcon() {
  const size = 128;
  const img = new RGBAImage(size, size);
  const color = { r: 0xFF, g: 0x86, b: 0x5E, a: 255 }; // #FF865E 주황
  const glowColor = { r: 0xFF, g: 0x86, b: 0x5E, a: 90 };

  const cx = 64;
  const cy = 64;
  const hw = 52;
  const hh = 34;

  // 마름모 내부 및 경계 드로잉
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(x - cx) / hw;
      const dy = Math.abs(y - cy) / hh;
      const dist = dx + dy; // 마름모(L1 norm)

      if (dist <= 1.0) {
        // 내부 채움
        const edge = Math.min(1, (1.0 - dist) * 16);
        img.setPixel(x, y, color.r, color.g, color.b, color.a * edge);
      } else if (dist <= 1.3) {
        // 네온 발광
        const glowAlpha = Math.max(0, (1.3 - dist) / 0.3) * (glowColor.a / 255);
        img.setPixel(x, y, glowColor.r, glowColor.g, glowColor.b, glowAlpha * 255);
      }
    }
  }

  // 중앙 코어 링 강조
  img.drawCircle(cx, cy, 14, { r: 0xFF, g: 0xD0, b: 0xBB, a: 200 }, false, true, 4);

  return img.toBuffer();
}

/**
 * 어깨 아이콘 생성
 * - 청록(#4DFFAA) / 보라
 * - 수평 아치형 어깨 라인 + 좌우 관절 캡슐
 */
function generateShoulderIcon() {
  const size = 128;
  const img = new RGBAImage(size, size);
  const color = { r: 0x4D, g: 0xFF, b: 0xAA, a: 255 }; // #4DFFAA 청록
  const glowColor = { r: 0x4D, g: 0xFF, b: 0xAA, a: 90 };

  const cx = 64;
  const cy = 64;

  // 어깨 중심 뼈대 캡슐
  img.drawCapsule(cx - 48, cy, cx + 48, cy, 10, color);
  // 목 연결 아치형 캡슐
  img.drawCapsule(cx - 24, cy - 18, cx + 24, cy - 18, 7, color);
  img.drawCapsule(cx - 24, cy - 18, cx - 48, cy, 8, color);
  img.drawCapsule(cx + 24, cy - 18, cx + 48, cy, 8, color);

  // 좌우 어깨 관절 조인트 링
  img.drawCircle(cx - 48, cy, 16, glowColor, false, true, 6, 10);
  img.drawCircle(cx - 48, cy, 12, color, true);

  img.drawCircle(cx + 48, cy, 16, glowColor, false, true, 6, 10);
  img.drawCircle(cx + 48, cy, 12, color, true);

  // 중앙 흉골 조인트
  img.drawCircle(cx, cy, 8, { r: 255, g: 255, b: 255, a: 230 }, true);

  return img.toBuffer();
}

// ─── 4. 실행 및 파일 저장 ───

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const assets = [
    { name: 'icon_hand_left.png', buffer: generateHandIcon(true) },
    { name: 'icon_hand_right.png', buffer: generateHandIcon(false) },
    { name: 'icon_head.png', buffer: generateHeadIcon() },
    { name: 'icon_hip.png', buffer: generateHipIcon() },
    { name: 'icon_shoulder.png', buffer: generateShoulderIcon() },
  ];

  for (const asset of assets) {
    const filePath = path.join(OUT_DIR, asset.name);
    fs.writeFileSync(filePath, asset.buffer);
    console.log(`[Asset Generated] ${asset.name} (${asset.buffer.length} bytes) -> ${filePath}`);
  }

  console.log(`\n총 ${assets.length}개 신체 부위 아이콘 PNG 생성 완료: ${OUT_DIR}`);
}

main();
