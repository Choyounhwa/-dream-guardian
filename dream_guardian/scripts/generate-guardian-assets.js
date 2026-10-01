/**
 * scripts/generate-guardian-assets.js
 *
 * Dream Guardian 수호신(깨비) 4단계 캐릭터 이미지 에셋 생성기 (Issue #271 / UI-ASSET-006)
 * Node.js 내장 zlib, fs, path만을 사용하여 고품질 투명 PNG 바이너리 파일을 직접 생성합니다.
 *
 * 생성 파일 (총 11개):
 * - public/assets/guardian/stage1/ : idle.png, cast.png (128x128, 빛 구슬 요정)
 * - public/assets/guardian/stage2/ : idle.png, cast.png (192x192, 작은 날개 깨비)
 * - public/assets/guardian/stage3/ : idle.png, cast.png, shield.png (256x256, 중간 수호신 깨비)
 * - public/assets/guardian/stage4/ : idle.png, cast.png, shield.png, ultimate.png (320x320, 완전체 대수호신 깨비)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';

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

  // IHDR: 13 bytes
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  // Scanlines with filter type 0 (None)
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0;
    rgbaBuffer.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
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

  drawDisc(cx, cy, radius, r, g, b, a) {
    const minX = Math.max(0, Math.floor(cx - radius - 1));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius + 1));
    const minY = Math.max(0, Math.floor(cy - radius - 1));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius + 1));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= radius - 0.5) {
          this.setPixel(x, y, r, g, b, a);
        } else if (dist <= radius + 0.5) {
          const alphaFactor = radius + 0.5 - dist;
          this.setPixel(x, y, r, g, b, Math.round(a * alphaFactor));
        }
      }
    }
  }

  drawRadialGlow(cx, cy, innerR, outerR, r, g, b, innerA, outerA = 0) {
    const minX = Math.max(0, Math.floor(cx - outerR));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + outerR));
    const minY = Math.max(0, Math.floor(cy - outerR));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + outerR));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= innerR) {
          this.setPixel(x, y, r, g, b, innerA);
        } else if (dist <= outerR) {
          const t = (dist - innerR) / (outerR - innerR);
          const alpha = Math.round(innerA * (1 - t) + outerA * t);
          this.setPixel(x, y, r, g, b, alpha);
        }
      }
    }
  }

  fillEllipse(cx, cy, rx, ry, r, g, b, a, angle = 0) {
    const maxR = Math.max(rx, ry);
    const minX = Math.max(0, Math.floor(cx - maxR - 1));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + maxR + 1));
    const minY = Math.max(0, Math.floor(cy - maxR - 1));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + maxR + 1));

    const cosA = Math.cos(-angle);
    const sinA = Math.sin(-angle);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const rotX = dx * cosA - dy * sinA;
        const rotY = dx * sinA + dy * cosA;
        const norm = (rotX * rotX) / (rx * rx) + (rotY * rotY) / (ry * ry);
        if (norm <= 1) {
          const edgeDist = (1 - norm) * Math.min(rx, ry);
          const alphaFactor = Math.min(1, edgeDist);
          this.setPixel(x, y, r, g, b, Math.round(a * alphaFactor));
        }
      }
    }
  }

  drawLine(x0, y0, x1, y1, r, g, b, a, thickness = 1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const steps = Math.max(dx, dy) * 2;
    if (steps === 0) {
      this.drawDisc(x0, y0, thickness / 2, r, g, b, a);
      return;
    }
    const rad = thickness / 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const curX = x0 + (x1 - x0) * t;
      const curY = y0 + (y1 - y0) * t;
      if (thickness <= 1.2) {
        this.setPixel(curX, curY, r, g, b, a);
      } else {
        this.drawDisc(curX, curY, rad, r, g, b, a);
      }
    }
  }

  drawRing(cx, cy, innerR, outerR, r, g, b, a) {
    const minX = Math.max(0, Math.floor(cx - outerR - 1));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + outerR + 1));
    const minY = Math.max(0, Math.floor(cy - outerR - 1));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + outerR + 1));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d >= innerR && d <= outerR) {
          const edgeInner = Math.min(1, d - innerR);
          const edgeOuter = Math.min(1, outerR - d);
          const alpha = Math.round(a * Math.min(edgeInner, edgeOuter));
          this.setPixel(x, y, r, g, b, alpha);
        }
      }
    }
  }

  drawStar(cx, cy, points, outerR, innerR, r, g, b, a) {
    // 4각 또는 다각 별빛 채우기
    const minX = Math.max(0, Math.floor(cx - outerR - 1));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + outerR + 1));
    const minY = Math.max(0, Math.floor(cy - outerR - 1));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + outerR + 1));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > outerR) continue;

        let angle = Math.atan2(dy, dx);
        if (angle < 0) angle += Math.PI * 2;
        const step = (Math.PI * 2) / points;
        const modAngle = (angle % step) / step; // 0 to 1
        // 삼각형 보간
        const peakT = Math.abs(modAngle - 0.5) * 2; // 0 at peak, 1 at valley
        const thresholdR = outerR * peakT + innerR * (1 - peakT);

        if (dist <= thresholdR) {
          const edgeFactor = Math.min(1, thresholdR - dist);
          this.setPixel(x, y, r, g, b, Math.round(a * edgeFactor));
        }
      }
    }
  }

  toBuffer() {
    return encodePNG(this.width, this.height, this.data);
  }
}

// ─── 3. 단계별 수호신 에셋 생성 알고리즘 ───

/**
 * [Stage 1: 빛 구슬 요정 (128x128)]
 * - idle: 따뜻한 금빛 코어와 부드러운 시안 후광, 앙증맞은 요정 날개
 * - cast: 강렬한 별빛 방출, 빛의 십자 광선 및 마법 입자 방출
 */
function generateStage1(action) {
  const w = 128;
  const h = 128;
  const img = new RGBAImage(w, h);
  const cx = 64;
  const cy = 64;

  if (action === 'idle') {
    // 1. 외곽 시안/골드 방사형 후광
    img.drawRadialGlow(cx, cy, 14, 56, 40, 230, 255, 120, 0);
    img.drawRadialGlow(cx, cy, 8, 38, 255, 210, 80, 180, 0);

    // 2. 작은 앙증맞은 요정 날개 (좌/우)
    img.fillEllipse(cx - 26, cy - 6, 18, 9, 255, 255, 255, 180, -0.4);
    img.fillEllipse(cx + 26, cy - 6, 18, 9, 255, 255, 255, 180, 0.4);
    img.fillEllipse(cx - 22, cy + 8, 12, 6, 40, 230, 255, 160, -0.2);
    img.fillEllipse(cx + 22, cy + 8, 12, 6, 40, 230, 255, 160, 0.2);

    // 3. 코어 빛 구슬 (골드 외곽 + 순백 중심)
    img.drawDisc(cx, cy, 18, 255, 200, 60, 240);
    img.drawDisc(cx, cy, 13, 255, 240, 180, 255);
    img.drawDisc(cx, cy, 8, 255, 255, 255, 255);

    // 4. 귀여운 반짝임 눈/표정 점
    img.drawDisc(cx - 5, cy - 2, 2.5, 50, 40, 80, 220);
    img.drawDisc(cx + 5, cy - 2, 2.5, 50, 40, 80, 220);
    img.drawDisc(cx - 4, cy - 3, 1, 255, 255, 255, 240);
    img.drawDisc(cx + 6, cy - 3, 1, 255, 255, 255, 240);
    img.drawDisc(cx, cy + 4, 1.5, 255, 120, 140, 180); // 볼터치
  } else {
    // 'cast'
    // 1. 강렬한 십자 빛 방출
    img.drawRadialGlow(cx, cy, 20, 60, 255, 215, 0, 160, 0);
    img.drawRadialGlow(cx, cy, 10, 44, 40, 230, 255, 200, 0);

    // 십자 광선
    img.drawLine(cx - 58, cy, cx + 58, cy, 255, 255, 255, 230, 3);
    img.drawLine(cx, cy - 58, cx, cy + 58, 255, 255, 255, 230, 3);
    img.drawLine(cx - 42, cy - 42, cx + 42, cy + 42, 255, 220, 100, 180, 2);
    img.drawLine(cx - 42, cy + 42, cx + 42, cy - 42, 255, 220, 100, 180, 2);

    // 2. 펼쳐진 마법 날개
    img.fillEllipse(cx - 32, cy - 10, 24, 11, 255, 255, 255, 220, -0.5);
    img.fillEllipse(cx + 32, cy - 10, 24, 11, 255, 255, 255, 220, 0.5);
    img.fillEllipse(cx - 26, cy + 12, 16, 7, 40, 230, 255, 200, -0.2);
    img.fillEllipse(cx + 26, cy + 12, 16, 7, 40, 230, 255, 200, 0.2);

    // 3. 에너지 링
    img.drawRing(cx, cy, 24, 28, 40, 230, 255, 210);

    // 4. 발광 코어
    img.drawDisc(cx, cy, 20, 255, 215, 60, 255);
    img.drawDisc(cx, cy, 14, 255, 250, 200, 255);
    img.drawDisc(cx, cy, 9, 255, 255, 255, 255);

    // 5. 4각 별빛
    img.drawStar(cx, cy, 4, 34, 10, 255, 255, 255, 250);
  }

  return img;
}

/**
 * [Stage 2: 작은 날개 깨비 (192x192)]
 * - 꼬마 도깨비 몸체, 이마의 쫑긋 솟은 도깨비뿔, 작은 깃털 날개
 * - idle: 사랑스럽게 부유하는 포즈
 * - cast: 날개를 활짝 펴고 뿔에서 무지개/별빛 마법 발사
 */
function generateStage2(action) {
  const w = 192;
  const h = 192;
  const img = new RGBAImage(w, h);
  const cx = 96;
  const cy = action === 'cast' ? 92 : 98;

  // 배경 후광
  img.drawRadialGlow(cx, cy, 20, 84, 255, 200, 60, action === 'cast' ? 140 : 80, 0);
  img.drawRadialGlow(cx, cy, 10, 54, 40, 230, 255, action === 'cast' ? 120 : 60, 0);

  // 날개 (몸통 뒤)
  const wingAngle = action === 'cast' ? 0.6 : 0.35;
  const wingRx = action === 'cast' ? 44 : 36;
  const wingRy = action === 'cast' ? 16 : 14;
  img.fillEllipse(cx - 44, cy - 14, wingRx, wingRy, 255, 240, 180, 220, -wingAngle);
  img.fillEllipse(cx + 44, cy - 14, wingRx, wingRy, 255, 240, 180, 220, wingAngle);
  img.fillEllipse(cx - 36, cy + 10, wingRx * 0.7, wingRy * 0.7, 40, 230, 255, 180, -wingAngle * 0.6);
  img.fillEllipse(cx + 36, cy + 10, wingRx * 0.7, wingRy * 0.7, 40, 230, 255, 180, wingAngle * 0.6);

  // 깨비 몸체 (포동포동한 타원형)
  img.fillEllipse(cx, cy + 12, 34, 30, 255, 180, 70, 255); // 몸통 기본
  img.fillEllipse(cx, cy - 10, 30, 26, 255, 200, 90, 255); // 머리
  img.fillEllipse(cx, cy + 14, 22, 18, 255, 245, 200, 240); // 배 부분 밝은 털

  // 귀여운 귀 (좌/우)
  img.fillEllipse(cx - 24, cy - 24, 10, 14, 255, 170, 60, 255, -0.4);
  img.fillEllipse(cx + 24, cy - 24, 10, 14, 255, 170, 60, 255, 0.4);
  img.fillEllipse(cx - 24, cy - 24, 6, 9, 255, 130, 130, 220, -0.4);
  img.fillEllipse(cx + 24, cy - 24, 6, 9, 255, 130, 130, 220, 0.4);

  // 도깨비뿔 (이마 중앙 솟은 뿔)
  const hornGlow = action === 'cast' ? 255 : 190;
  img.drawLine(cx, cy - 30, cx, cy - 48, 40, 230, 255, hornGlow, 5);
  img.drawLine(cx - 4, cy - 30, cx, cy - 48, 255, 255, 255, hornGlow, 3);
  img.drawDisc(cx, cy - 48, action === 'cast' ? 8 : 5, 255, 255, 255, 255);
  img.drawRadialGlow(cx, cy - 48, 4, action === 'cast' ? 28 : 16, 40, 230, 255, 220, 0);

  // 얼굴 표정
  img.drawDisc(cx - 10, cy - 10, 4, 40, 30, 70, 240); // 눈
  img.drawDisc(cx + 10, cy - 10, 4, 40, 30, 70, 240);
  img.drawDisc(cx - 8, cy - 12, 1.5, 255, 255, 255, 255); // 눈동자 반사광
  img.drawDisc(cx + 12, cy - 12, 1.5, 255, 255, 255, 255);
  img.drawDisc(cx - 16, cy - 4, 4, 255, 120, 130, 150); // 볼터치
  img.drawDisc(cx + 16, cy - 4, 4, 255, 120, 130, 150);

  // 작은 앞발
  img.fillEllipse(cx - 14, cy + 24, 7, 5, 255, 220, 140, 255);
  img.fillEllipse(cx + 14, cy + 24, 7, 5, 255, 220, 140, 255);

  if (action === 'cast') {
    // 뿔에서 뻗어나가는 마법 별빛 및 링
    img.drawStar(cx, cy - 48, 4, 30, 8, 255, 255, 255, 250);
    img.drawRing(cx, cy - 48, 18, 22, 255, 215, 60, 200);
    img.drawLine(cx, cy - 48, cx, 10, 255, 255, 255, 220, 3);
    img.drawLine(cx, cy - 48, cx - 35, 15, 40, 230, 255, 180, 2);
    img.drawLine(cx, cy - 48, cx + 35, 15, 40, 230, 255, 180, 2);
  }

  return img;
}

/**
 * [Stage 3: 중간 수호신 깨비 (256x256)]
 * - 위엄 있는 자태, 커진 날개, 머리 위 신비로운 룬 왕관/후광
 * - idle: 우아한 부유
 * - cast: 양손 마법 캐스팅 룬 서클 및 별빛 불꽃
 * - shield: 육각형 프리즘 에너지 방어막(Aegis Dome)에 둘러싸임
 */
function generateStage3(action) {
  const w = 256;
  const h = 256;
  const img = new RGBAImage(w, h);
  const cx = 128;
  const cy = 132;

  // 배경 오라
  img.drawRadialGlow(cx, cy, 30, 115, 255, 210, 60, 90, 0);
  img.drawRadialGlow(cx, cy, 15, 75, 40, 230, 255, 80, 0);

  // 날개 (양옆 대형 2쌍 날개)
  const wingSpan = action === 'cast' ? 70 : 60;
  const wingAngle = action === 'cast' ? 0.45 : 0.3;
  // 상단 날개
  img.fillEllipse(cx - 62, cy - 24, wingSpan, 20, 255, 235, 160, 230, -wingAngle);
  img.fillEllipse(cx + 62, cy - 24, wingSpan, 20, 255, 235, 160, 230, wingAngle);
  // 하단 날개
  img.fillEllipse(cx - 52, cy + 12, wingSpan * 0.75, 15, 40, 230, 255, 200, -wingAngle * 0.5);
  img.fillEllipse(cx + 52, cy + 12, wingSpan * 0.75, 15, 40, 230, 255, 200, wingAngle * 0.5);

  // 수호신 본체
  img.fillEllipse(cx, cy + 20, 40, 36, 255, 185, 70, 255); // 몸통
  img.fillEllipse(cx, cy - 12, 34, 30, 255, 205, 90, 255); // 머리
  img.fillEllipse(cx, cy + 20, 26, 24, 255, 250, 210, 250); // 성스러운 배 문양

  // 신비로운 기하학 문양
  img.drawLine(cx, cy + 10, cx, cy + 30, 40, 230, 255, 220, 2);
  img.drawLine(cx - 10, cy + 20, cx + 10, cy + 20, 40, 230, 255, 220, 2);

  // 귀 & 장식
  img.fillEllipse(cx - 28, cy - 28, 12, 18, 255, 180, 70, 255, -0.4);
  img.fillEllipse(cx + 28, cy - 28, 12, 18, 255, 180, 70, 255, 0.4);
  img.fillEllipse(cx - 28, cy - 28, 7, 12, 255, 140, 140, 220, -0.4);
  img.fillEllipse(cx + 28, cy - 28, 7, 12, 255, 140, 140, 220, 0.4);

  // 발달한 수호신 뿔 (청록빛 + 금빛)
  img.drawLine(cx, cy - 36, cx, cy - 62, 40, 230, 255, 255, 6);
  img.drawLine(cx - 5, cy - 36, cx, cy - 62, 255, 255, 255, 240, 3);
  img.drawDisc(cx, cy - 62, 8, 255, 255, 255, 255);
  img.drawRadialGlow(cx, cy - 62, 5, 26, 40, 230, 255, 240, 0);

  // 머리 위 룬 서클 왕관
  img.drawRing(cx, cy - 64, 18, 22, 255, 215, 60, 200);
  img.drawStar(cx, cy - 64, 4, 12, 4, 255, 255, 255, 240);

  // 얼굴
  img.drawDisc(cx - 12, cy - 12, 4.5, 30, 25, 60, 250);
  img.drawDisc(cx + 12, cy - 12, 4.5, 30, 25, 60, 250);
  img.drawDisc(cx - 10, cy - 14, 1.8, 255, 255, 255, 255);
  img.drawDisc(cx + 14, cy - 14, 1.8, 255, 255, 255, 255);
  img.drawDisc(cx - 18, cy - 6, 5, 255, 130, 140, 150);
  img.drawDisc(cx + 18, cy - 6, 5, 255, 130, 140, 150);

  if (action === 'cast') {
    // 거대한 마법 룬 서클 및 별빛
    img.drawRing(cx, cy, 80, 85, 40, 230, 255, 210);
    img.drawRing(cx, cy, 92, 95, 255, 215, 60, 180);
    img.drawStar(cx, cy - 62, 8, 40, 12, 255, 255, 255, 255);

    // 룬 입자
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const rx = cx + Math.cos(a) * 88;
      const ry = cy + Math.sin(a) * 88;
      img.drawDisc(rx, ry, 3.5, 255, 255, 255, 240);
    }
  } else if (action === 'shield') {
    // 육각 결정 프리즘 에너지 방어막
    const shieldR = 108;
    img.drawRadialGlow(cx, cy, 70, shieldR + 10, 40, 230, 255, 90, 0);

    // 육각형 외곽 라인
    const points = [];
    for (let i = 0; i < 6; i++) {
      const rad = (i * Math.PI) / 3 - Math.PI / 6;
      points.push({
        x: cx + Math.cos(rad) * shieldR,
        y: cy + Math.sin(rad) * shieldR,
      });
    }
    for (let i = 0; i < 6; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % 6];
      img.drawLine(p1.x, p1.y, p2.x, p2.y, 40, 230, 255, 240, 4);
      img.drawLine(p1.x, p1.y, p2.x, p2.y, 255, 255, 255, 200, 2);
      img.drawLine(cx, cy, p1.x, p1.y, 255, 215, 60, 120, 1.5);
      img.drawDisc(p1.x, p1.y, 6, 255, 255, 255, 255);
    }

    // 보호막 에너지 링
    img.drawRing(cx, cy, shieldR - 14, shieldR - 10, 255, 215, 60, 170);
  }

  return img;
}

/**
 * [Stage 4: 완전체 대수호신 깨비 (320x320)]
 * - 최고위 대도깨비 각성 상태
 * - idle: 웅장한 4대 천상 날개, 성스러운 오로라 후광
 * - cast: 전설급 마법 탄막 및 십자 성좌 에너지
 * - shield: 무적의 천상 이지스(Aegis) 방어막
 * - ultimate: 대우주 초신성 대폭발(Supernova) & 전 악기 앙상블 오색 불꽃
 */
function generateStage4(action) {
  const w = 320;
  const h = 320;
  const img = new RGBAImage(w, h);
  const cx = 160;
  const cy = 168;

  // 1. 대우주 배경 후광
  const auraR = action === 'ultimate' ? 150 : 135;
  img.drawRadialGlow(cx, cy, 40, auraR, 255, 215, 60, action === 'ultimate' ? 150 : 100, 0);
  img.drawRadialGlow(cx, cy, 20, 95, 40, 230, 255, action === 'ultimate' ? 160 : 90, 0);

  // 2. 4대 천상 날개 (상단 대형 날개 1쌍 + 하단 중간 날개 1쌍)
  const wingSpread = action === 'ultimate' ? 0.55 : (action === 'cast' ? 0.45 : 0.32);
  const upperRx = action === 'ultimate' ? 95 : 82;
  const upperRy = action === 'ultimate' ? 26 : 22;
  // 상단 황금 날개
  img.fillEllipse(cx - 78, cy - 36, upperRx, upperRy, 255, 230, 140, 240, -wingSpread);
  img.fillEllipse(cx + 78, cy - 36, upperRx, upperRy, 255, 230, 140, 240, wingSpread);
  // 하단 오색/시안 날개
  img.fillEllipse(cx - 68, cy + 18, upperRx * 0.75, upperRy * 0.75, 40, 230, 255, 210, -wingSpread * 0.5);
  img.fillEllipse(cx + 68, cy + 18, upperRx * 0.75, upperRy * 0.75, 40, 230, 255, 210, wingSpread * 0.5);

  // 3. 대수호신 깨비 본체
  img.fillEllipse(cx, cy + 24, 46, 42, 255, 190, 70, 255); // 몸통
  img.fillEllipse(cx, cy - 16, 40, 34, 255, 210, 90, 255); // 머리
  img.fillEllipse(cx, cy + 24, 30, 28, 255, 250, 215, 255); // 신성한 코어 털

  // 온몸의 고대 도깨비 문양
  img.drawLine(cx, cy + 8, cx, cy + 38, 255, 40, 100, 200, 2.5);
  img.drawLine(cx - 15, cy + 22, cx + 15, cy + 22, 40, 230, 255, 220, 2.5);
  img.drawRing(cx, cy + 22, 8, 11, 255, 215, 60, 220);

  // 수호신 귀 & 깃털 장식
  img.fillEllipse(cx - 34, cy - 34, 14, 22, 255, 185, 70, 255, -0.4);
  img.fillEllipse(cx + 34, cy - 34, 14, 22, 255, 185, 70, 255, 0.4);
  img.fillEllipse(cx - 34, cy - 34, 8, 14, 255, 130, 150, 220, -0.4);
  img.fillEllipse(cx + 34, cy - 34, 8, 14, 255, 130, 150, 220, 0.4);

  // 완전 각성 대도깨비뿔 (거대한 쌍룡 형상 또는 거대 크리스탈 뿔)
  img.drawLine(cx, cy - 42, cx, cy - 78, 40, 230, 255, 255, 8);
  img.drawLine(cx - 6, cy - 42, cx, cy - 78, 255, 255, 255, 250, 4);
  img.drawDisc(cx, cy - 78, 10, 255, 255, 255, 255);
  img.drawRadialGlow(cx, cy - 78, 6, 32, 40, 230, 255, 255, 0);

  // 성스러운 삼중 룬 왕관
  img.drawRing(cx, cy - 80, 22, 27, 255, 215, 60, 230);
  img.drawRing(cx, cy - 80, 32, 35, 40, 230, 255, 190);
  img.drawStar(cx, cy - 80, 6, 18, 6, 255, 255, 255, 255);

  // 얼굴
  img.drawDisc(cx - 14, cy - 16, 5, 30, 25, 60, 255);
  img.drawDisc(cx + 14, cy - 16, 5, 30, 25, 60, 255);
  img.drawDisc(cx - 12, cy - 18, 2, 255, 255, 255, 255);
  img.drawDisc(cx + 16, cy - 18, 2, 255, 255, 255, 255);
  img.drawDisc(cx - 20, cy - 8, 6, 255, 120, 140, 160);
  img.drawDisc(cx + 20, cy - 8, 6, 255, 120, 140, 160);

  // 상태별 특수 효과
  if (action === 'cast') {
    // 대마법 탄막 발사 성좌
    img.drawRing(cx, cy, 100, 106, 40, 230, 255, 230);
    img.drawRing(cx, cy, 118, 122, 255, 215, 60, 200);
    img.drawStar(cx, cy - 78, 8, 55, 16, 255, 255, 255, 255);

    // 전방으로 뻗는 광선
    img.drawLine(cx, cy - 78, cx, 10, 255, 255, 255, 240, 5);
    img.drawLine(cx - 30, cy - 78, cx - 60, 10, 40, 230, 255, 200, 3);
    img.drawLine(cx + 30, cy - 78, cx + 60, 10, 40, 230, 255, 200, 3);
  } else if (action === 'shield') {
    // 완전체 성벽 이지스 쉴드 (다중 팔각형 마법진)
    const shieldR = 138;
    img.drawRadialGlow(cx, cy, 90, shieldR + 14, 40, 230, 255, 110, 0);

    const octPoints = [];
    for (let i = 0; i < 8; i++) {
      const rad = (i * Math.PI) / 4;
      octPoints.push({
        x: cx + Math.cos(rad) * shieldR,
        y: cy + Math.sin(rad) * shieldR,
      });
    }
    for (let i = 0; i < 8; i++) {
      const p1 = octPoints[i];
      const p2 = octPoints[(i + 1) % 8];
      img.drawLine(p1.x, p1.y, p2.x, p2.y, 40, 230, 255, 255, 5);
      img.drawLine(p1.x, p1.y, p2.x, p2.y, 255, 255, 255, 220, 2.5);
      img.drawLine(cx, cy, p1.x, p1.y, 255, 215, 60, 140, 2);
      img.drawDisc(p1.x, p1.y, 7, 255, 255, 255, 255);
    }
    img.drawRing(cx, cy, shieldR - 18, shieldR - 13, 255, 215, 60, 200);
  } else if (action === 'ultimate') {
    // 대도깨비 궁극 각성 (슈퍼노바 & 무지개 오로라 광휘)
    img.drawStar(cx, cy, 8, 148, 48, 255, 255, 255, 255);
    img.drawRing(cx, cy, 120, 128, 255, 220, 80, 240);
    img.drawRing(cx, cy, 134, 140, 40, 230, 255, 220);
    img.drawRing(cx, cy, 146, 150, 255, 80, 160, 200);

    // 8방향 초신성 방출선
    for (let i = 0; i < 12; i++) {
      const rad = (i * Math.PI) / 6;
      const lx = cx + Math.cos(rad) * 150;
      const ly = cy + Math.sin(rad) * 150;
      const r = i % 3 === 0 ? 255 : (i % 3 === 1 ? 40 : 255);
      const g = i % 3 === 0 ? 220 : (i % 3 === 1 ? 230 : 80);
      const b = i % 3 === 0 ? 80 : (i % 3 === 1 ? 255 : 200);
      img.drawLine(cx, cy, lx, ly, r, g, b, 230, 3);
    }
  }

  return img;
}

// ─── 4. 실행 및 파일 생성 ───

function main() {
  const rootDir = process.cwd();
  const baseDir = path.resolve(rootDir, 'public/assets/guardian');

  console.log(`[generate-guardian-assets] Generating 11 Guardian PNG assets in: ${baseDir}`);

  const manifest = [
    // Stage 1 (128x128)
    { dir: 'stage1', file: 'idle.png', generator: () => generateStage1('idle') },
    { dir: 'stage1', file: 'cast.png', generator: () => generateStage1('cast') },
    // Stage 2 (192x192)
    { dir: 'stage2', file: 'idle.png', generator: () => generateStage2('idle') },
    { dir: 'stage2', file: 'cast.png', generator: () => generateStage2('cast') },
    // Stage 3 (256x256)
    { dir: 'stage3', file: 'idle.png', generator: () => generateStage3('idle') },
    { dir: 'stage3', file: 'cast.png', generator: () => generateStage3('cast') },
    { dir: 'stage3', file: 'shield.png', generator: () => generateStage3('shield') },
    // Stage 4 (320x320)
    { dir: 'stage4', file: 'idle.png', generator: () => generateStage4('idle') },
    { dir: 'stage4', file: 'cast.png', generator: () => generateStage4('cast') },
    { dir: 'stage4', file: 'shield.png', generator: () => generateStage4('shield') },
    { dir: 'stage4', file: 'ultimate.png', generator: () => generateStage4('ultimate') },
  ];

  for (const item of manifest) {
    const targetDir = path.join(baseDir, item.dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filePath = path.join(targetDir, item.file);
    const img = item.generator();
    const buf = img.toBuffer();
    fs.writeFileSync(filePath, buf);
    console.log(`  ✓ Created: ${item.dir}/${item.file} (${img.width}x${img.height}, ${buf.length} bytes)`);
  }

  console.log(`[generate-guardian-assets] Successfully created all 11 Guardian assets!`);
}

main();
