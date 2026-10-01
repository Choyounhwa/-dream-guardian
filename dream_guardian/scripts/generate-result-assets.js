/**
 * scripts/generate-result-assets.js
 *
 * Dream Guardian UI 결과 화면 이미지 에셋 생성기 (Issue #268 / UI-ASSET-003)
 * Node.js 내장 zlib, fs, path만을 사용하여 표준 규격의 유효한 PNG 바이너리 파일을 직접 생성합니다.
 *
 * 생성 파일:
 *  1. public/assets/ui/result/panel_bg.png (880x1580, 네온 마젠타 테두리와 다크 반투명 패널, 투명 PNG)
 *  2. public/assets/ui/result/victory_title.png (600x160, 에메랄드/골드 네온 'VICTORY' 투명 PNG)
 *  3. public/assets/ui/result/defeat_title.png (600x160, 크림슨 네온 'DEFEAT' 투명 PNG)
 *  4. public/assets/ui/result/stat_accuracy.png (48x48, 정답률 타겟 과녁 아이콘)
 *  5. public/assets/ui/result/stat_combo.png (48x48, 콤보 화염 아이콘)
 *  6. public/assets/ui/result/stat_time.png (48x48, 시간 스톱워치 아이콘)
 *  7. public/assets/ui/result/stat_run.png (48x48, 달리기 러너/신발 아이콘)
 *  8. public/assets/ui/result/stat_squat.png (48x48, 스쿼트/바벨 아이콘)
 *  9. public/assets/ui/result/stat_jump.png (48x48, 점프 스프링/도약 아이콘)
 * 10. public/assets/ui/result/stat_pose.png (48x48, 자세 유지/명상 아이콘)
 * 11. public/assets/ui/result/stat_calorie.png (48x48, 칼로리 번개/에너지 아이콘)
 * 12. public/assets/ui/result/star_filled.png (54x54, 황금 별 아이콘)
 * 13. public/assets/ui/result/star_empty.png (54x54, 반투명 회색 외곽선 별 아이콘)
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

  drawDisc(cx, cy, radius, r, g, b, a) {
    const minX = Math.max(0, Math.floor(cx - radius - 1));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius + 1));
    const minY = Math.max(0, Math.floor(cy - radius - 1));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius + 1));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= radius - 0.5) {
          this.setPixel(x, y, r, g, b, a);
        } else if (d < radius + 0.5) {
          const factor = radius + 0.5 - d;
          this.setPixel(x, y, r, g, b, a * factor);
        }
      }
    }
  }

  toBuffer() {
    return encodePNG(this.width, this.height, this.data);
  }
}

// ─── SDF 헬퍼 함수들 ───

function roundedBoxSDF(px, py, bx, by, bw, bh, r) {
  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  const qx = Math.abs(px - cx) - (bw / 2 - r);
  const qy = Math.abs(py - cy) - (bh / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function starSDF(x, y, cx, cy, rOut, rIn) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }

  let inside = false;
  for (let i = 0, j = 9; i < 10; j = i++) {
    const xi = pts[i][0], yi = pts[i][1];
    const xj = pts[j][0], yj = pts[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  let minDist = Infinity;
  for (let i = 0, j = 9; i < 10; j = i++) {
    const x1 = pts[j][0], y1 = pts[j][1];
    const x2 = pts[i][0], y2 = pts[i][1];
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx, projY = y1 + t * dy;
    const d = Math.hypot(x - projX, y - projY);
    if (d < minDist) minDist = d;
  }

  return inside ? -minDist : minDist;
}

// ─── 3. 에셋 생성 함수들 ───

/**
 * 1. panel_bg.png (880 x 1580)
 * 결과 카드 패널 배경 (네온 마젠타 테두리와 다크 반투명 패널, 투명 PNG)
 */
function generatePanelBg() {
  const w = 880;
  const h = 1580;
  const img = new RGBAImage(w, h);

  const radius = 28;
  const strokeW = 4;
  const inset = 12;

  for (let y = 0; y < h; y++) {
    const ny = y / h;
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const dist = roundedBoxSDF(x, y, inset, inset, w - inset * 2, h - inset * 2, radius);

      if (dist <= 0) {
        // 내부 영역
        if (dist > -strokeW) {
          // 메인 네온 마젠타 테두리 (#FF28D8)
          const edgeAlpha = Math.min(1, Math.max(0, -dist));
          const t = Math.abs(dist + strokeW / 2) / (strokeW / 2);
          // 글로우 림
          const r = 255;
          const g = Math.round(40 + (1 - t) * 60);
          const b = Math.round(216 + (1 - t) * 39);
          img.setPixel(x, y, r, g, b, Math.round(255 * edgeAlpha));
        } else if (dist > -strokeW - 4) {
          // 안쪽 네온 글로우 감쇠선
          const t = (-dist - strokeW) / 4;
          const r = Math.round(255 * (1 - t) + 20 * t);
          const g = Math.round(60 * (1 - t) + 10 * t);
          const b = Math.round(220 * (1 - t) + 35 * t);
          const a = Math.round(240 * (1 - t) + 225 * t);
          img.setPixel(x, y, r, g, b, a);
        } else {
          // 다크 반투명 패널 본체: rgba(20, 10, 30, 0.95)
          // 상단/하단 미세 네온 마젠타 그라데이션
          const centerGlow = Math.max(0, 1 - Math.hypot((nx - 0.5) * 1.5, (ny - 0.3) * 1.8));
          const r = Math.round(20 + centerGlow * 18 + ny * 6);
          const g = Math.round(10 + centerGlow * 6 + ny * 4);
          const b = Math.round(32 + centerGlow * 24 + ny * 12);
          const a = 242; // 약 0.95 불투명도
          img.setPixel(x, y, r, g, b, a);
        }
      } else if (dist < 8) {
        // 외곽 앰비언트 마젠타 블러 글로우
        const alpha = Math.max(0, (1 - dist / 8) * 0.45);
        img.setPixel(x, y, 255, 40, 216, Math.round(alpha * 255));
      }
    }
  }

  // 모서리 사이버 테크 브래킷 액센트
  const accents = [
    [inset + radius, inset + 4],
    [w - inset - radius, inset + 4],
    [inset + radius, h - inset - 4],
    [w - inset - radius, h - inset - 4],
  ];
  for (const [ax, ay] of accents) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -14; dx <= 14; dx++) {
        img.setPixel(ax + dx, ay + dy, 255, 180, 240, 220);
      }
    }
  }

  return img.toBuffer();
}

/**
 * 2. victory_title.png (600 x 160)
 * 에메랄드/골드 네온 'VICTORY' 타이틀 이미지
 */
function generateVictoryTitle() {
  const w = 600;
  const h = 160;
  const img = new RGBAImage(w, h);

  // 1) 배경 네온 리본/배지 프레임
  const bw = 540;
  const bh = 110;
  const bx = (w - bw) / 2;
  const by = (h - bh) / 2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = roundedBoxSDF(x, y, bx, by, bw, bh, 20);
      if (dist <= 0) {
        if (dist > -4) {
          // 에메랄드 네온 프레임 (#4DFFAA)
          const t = Math.abs(dist + 2) / 2;
          const r = Math.round(77 * (1 - t) + 200 * t);
          const g = 255;
          const b = Math.round(170 * (1 - t) + 240 * t);
          img.setPixel(x, y, r, g, b, 255);
        } else {
          // 반투명 다크 에메랄드 틴트
          const ny = (y - by) / bh;
          const r = 10 + Math.round(ny * 8);
          const g = 32 + Math.round(ny * 24);
          const b = 24 + Math.round(ny * 16);
          img.setPixel(x, y, r, g, b, 230);
        }
      } else if (dist < 10) {
        const glow = (1 - dist / 10) * 0.5;
        img.setPixel(x, y, 77, 255, 170, Math.round(glow * 255));
      }
    }
  }

  // 2) 'VICTORY' 레터링 렌더링 (에메랄드/황금 그라데이션)
  // 7글자: V, I, C, T, O, R, Y
  const startX = 85;
  const letterW = 42;
  const letterH = 56;
  const gap = 18;
  const topY = (h - letterH) / 2;
  const strokeThick = 7;

  // Helper for drawing letter segments with emerald-gold glow
  function drawLetterStroke(x0, y0, x1, y1) {
    // Halo glow
    img.drawLine(x0, y0, x1, y1, 77, 255, 170, 100, strokeThick + 4);
    // Core bold line (Golden Emerald)
    img.drawLine(x0, y0, x1, y1, 240, 255, 220, 255, strokeThick);
  }

  // V
  let lx = startX;
  drawLetterStroke(lx, topY, lx + letterW / 2, topY + letterH);
  drawLetterStroke(lx + letterW / 2, topY + letterH, lx + letterW, topY);

  // I
  lx += letterW + gap;
  drawLetterStroke(lx, topY, lx + letterW, topY);
  drawLetterStroke(lx + letterW / 2, topY, lx + letterW / 2, topY + letterH);
  drawLetterStroke(lx, topY + letterH, lx + letterW, topY + letterH);

  // C
  lx += letterW + gap;
  drawLetterStroke(lx + letterW, topY, lx, topY);
  drawLetterStroke(lx, topY, lx, topY + letterH);
  drawLetterStroke(lx, topY + letterH, lx + letterW, topY + letterH);

  // T
  lx += letterW + gap;
  drawLetterStroke(lx, topY, lx + letterW, topY);
  drawLetterStroke(lx + letterW / 2, topY, lx + letterW / 2, topY + letterH);

  // O
  lx += letterW + gap;
  drawLetterStroke(lx, topY, lx + letterW, topY);
  drawLetterStroke(lx + letterW, topY, lx + letterW, topY + letterH);
  drawLetterStroke(lx + letterW, topY + letterH, lx, topY + letterH);
  drawLetterStroke(lx, topY + letterH, lx, topY);

  // R
  lx += letterW + gap;
  drawLetterStroke(lx, topY, lx, topY + letterH);
  drawLetterStroke(lx, topY, lx + letterW, topY);
  drawLetterStroke(lx + letterW, topY, lx + letterW, topY + letterH / 2);
  drawLetterStroke(lx + letterW, topY + letterH / 2, lx, topY + letterH / 2);
  drawLetterStroke(lx + letterW / 3, topY + letterH / 2, lx + letterW, topY + letterH);

  // Y
  lx += letterW + gap;
  drawLetterStroke(lx, topY, lx + letterW / 2, topY + letterH / 2);
  drawLetterStroke(lx + letterW, topY, lx + letterW / 2, topY + letterH / 2);
  drawLetterStroke(lx + letterW / 2, topY + letterH / 2, lx + letterW / 2, topY + letterH);

  // 양옆 장식 황금 미니 별
  const starL = starSDF(45, h / 2, 45, h / 2, 14, 6);
  const starR = starSDF(w - 45, h / 2, w - 45, h / 2, 14, 6);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (Math.hypot(x - 45, y - h / 2) <= 16) {
        const d = starSDF(x, y, 45, h / 2, 14, 6);
        if (d <= 0) img.setPixel(x, y, 255, 203, 77, 255);
      }
      if (Math.hypot(x - (w - 45), y - h / 2) <= 16) {
        const d = starSDF(x, y, w - 45, h / 2, 14, 6);
        if (d <= 0) img.setPixel(x, y, 255, 203, 77, 255);
      }
    }
  }

  return img.toBuffer();
}

/**
 * 3. defeat_title.png (600 x 160)
 * 크림슨 네온 'DEFEAT' 타이틀 이미지
 */
function generateDefeatTitle() {
  const w = 600;
  const h = 160;
  const img = new RGBAImage(w, h);

  const bw = 520;
  const bh = 110;
  const bx = (w - bw) / 2;
  const by = (h - bh) / 2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = roundedBoxSDF(x, y, bx, by, bw, bh, 20);
      if (dist <= 0) {
        if (dist > -4) {
          // 크림슨 네온 프레임 (#FF4444)
          const t = Math.abs(dist + 2) / 2;
          const r = 255;
          const g = Math.round(68 * (1 - t) + 120 * t);
          const b = Math.round(68 * (1 - t) + 120 * t);
          img.setPixel(x, y, r, g, b, 255);
        } else {
          // 반투명 다크 크림슨
          const ny = (y - by) / bh;
          const r = 36 + Math.round(ny * 16);
          const g = 12 + Math.round(ny * 8);
          const b = 16 + Math.round(ny * 8);
          img.setPixel(x, y, r, g, b, 230);
        }
      } else if (dist < 10) {
        const glow = (1 - dist / 10) * 0.45;
        img.setPixel(x, y, 255, 68, 68, Math.round(glow * 255));
      }
    }
  }

  // 'DEFEAT' 6글자: D, E, F, E, A, T
  const startX = 110;
  const letterW = 44;
  const letterH = 56;
  const gap = 20;
  const topY = (h - letterH) / 2;
  const strokeThick = 7;

  function drawCrimsonStroke(x0, y0, x1, y1) {
    img.drawLine(x0, y0, x1, y1, 255, 68, 68, 100, strokeThick + 4);
    img.drawLine(x0, y0, x1, y1, 255, 220, 220, 255, strokeThick);
  }

  // D
  let lx = startX;
  drawCrimsonStroke(lx, topY, lx, topY + letterH);
  drawCrimsonStroke(lx, topY, lx + letterW - 10, topY);
  drawCrimsonStroke(lx + letterW - 10, topY, lx + letterW, topY + letterH / 2);
  drawCrimsonStroke(lx + letterW, topY + letterH / 2, lx + letterW - 10, topY + letterH);
  drawCrimsonStroke(lx + letterW - 10, topY + letterH, lx, topY + letterH);

  // E
  lx += letterW + gap;
  drawCrimsonStroke(lx, topY, lx, topY + letterH);
  drawCrimsonStroke(lx, topY, lx + letterW, topY);
  drawCrimsonStroke(lx, topY + letterH / 2, lx + letterW * 0.8, topY + letterH / 2);
  drawCrimsonStroke(lx, topY + letterH, lx + letterW, topY + letterH);

  // F
  lx += letterW + gap;
  drawCrimsonStroke(lx, topY, lx, topY + letterH);
  drawCrimsonStroke(lx, topY, lx + letterW, topY);
  drawCrimsonStroke(lx, topY + letterH / 2, lx + letterW * 0.75, topY + letterH / 2);

  // E
  lx += letterW + gap;
  drawCrimsonStroke(lx, topY, lx, topY + letterH);
  drawCrimsonStroke(lx, topY, lx + letterW, topY);
  drawCrimsonStroke(lx, topY + letterH / 2, lx + letterW * 0.8, topY + letterH / 2);
  drawCrimsonStroke(lx, topY + letterH, lx + letterW, topY + letterH);

  // A
  lx += letterW + gap;
  drawCrimsonStroke(lx, topY + letterH, lx + letterW / 2, topY);
  drawCrimsonStroke(lx + letterW / 2, topY, lx + letterW, topY + letterH);
  drawCrimsonStroke(lx + letterW * 0.25, topY + letterH * 0.6, lx + letterW * 0.75, topY + letterH * 0.6);

  // T
  lx += letterW + gap;
  drawCrimsonStroke(lx, topY, lx + letterW, topY);
  drawCrimsonStroke(lx + letterW / 2, topY, lx + letterW / 2, topY + letterH);

  return img.toBuffer();
}

/**
 * 4. stat_accuracy.png (48 x 48)
 * 정답률 타겟 과녁 아이콘 (시안/화이트 네온)
 */
function generateStatAccuracy() {
  const img = new RGBAImage(48, 48);
  const cx = 24, cy = 24;

  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      const d = Math.hypot(x - cx, y - cy);
      // 외곽 링: r=18..21
      if (d >= 17 && d <= 21) {
        img.setPixel(x, y, 40, 230, 255, 240);
      } else if (d >= 9 && d <= 12) {
        // 중간 링: r=9..12
        img.setPixel(x, y, 255, 203, 77, 240);
      } else if (d <= 5) {
        // 중앙 불스아이: r=5
        img.setPixel(x, y, 255, 68, 68, 255);
      }
    }
  }
  // 십자선 (Crosshairs)
  img.drawLine(cx - 22, cy, cx - 13, cy, 255, 255, 255, 230, 2);
  img.drawLine(cx + 13, cy, cx + 22, cy, 255, 255, 255, 230, 2);
  img.drawLine(cx, cy - 22, cx, cy - 13, 255, 255, 255, 230, 2);
  img.drawLine(cx, cy + 13, cx, cy + 22, 255, 255, 255, 230, 2);

  return img.toBuffer();
}

/**
 * 5. stat_combo.png (48 x 48)
 * 콤보 화염 아이콘 (오렌지/옐로우/레드)
 */
function generateStatCombo() {
  const img = new RGBAImage(48, 48);
  const cx = 24, cy = 28;

  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      const dx = (x - cx) / 16;
      const dy = (cy - y) / 22; // 0 at base, 1 at peak
      if (dy >= -0.2 && dy <= 1.2) {
        // 화염 프로파일: 폭은 dy에 따라 변화
        const widthProf = Math.sin(Math.max(0, dy) * Math.PI) * 1.1 + (1 - dy) * 0.4;
        const dist = Math.abs(dx) / Math.max(0.1, widthProf);
        if (dist <= 1.0) {
          const t = dist;
          let r = 255;
          let g = Math.round(220 * (1 - dy) * (1 - t * 0.8));
          let b = Math.round(40 * (1 - t));
          let a = Math.round(250 * (1 - t * 0.4));
          // 중심 백색 화염 코어
          if (dist < 0.35 && dy > 0.1 && dy < 0.6) {
            r = 255;
            g = 255;
            b = 180;
            a = 255;
          }
          img.setPixel(x, y, r, g, b, a);
        }
      }
    }
  }
  return img.toBuffer();
}

/**
 * 6. stat_time.png (48 x 48)
 * 시간 스톱워치 아이콘 (원형 시계 + 상단 버튼 + 시계 바늘)
 */
function generateStatTime() {
  const img = new RGBAImage(48, 48);
  const cx = 24, cy = 26;

  // 상단 버튼 (x: 21..27, y: 5..9)
  for (let y = 5; y <= 9; y++) {
    for (let x = 21; x <= 27; x++) {
      img.setPixel(x, y, 255, 203, 77, 240);
    }
  }

  // 시계 본체 원형 테두리
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d >= 15 && d <= 18) {
        img.setPixel(x, y, 77, 255, 170, 245);
      } else if (d < 15) {
        img.setPixel(x, y, 20, 36, 40, 200);
      }
    }
  }

  // 시계 바늘: 중심 (cx, cy)에서 10시 10분 방향
  img.drawLine(cx, cy, cx - 7, cy - 6, 255, 255, 255, 255, 2.5); // 시침
  img.drawLine(cx, cy, cx + 8, cy - 8, 255, 203, 77, 255, 2);   // 분침
  img.drawDisc(cx, cy, 2.5, 255, 255, 255, 255);

  return img.toBuffer();
}

/**
 * 7. stat_run.png (48 x 48)
 * 달리기 러너/신발 아이콘 (시안 네온 러너 실루엣)
 */
function generateStatRun() {
  const img = new RGBAImage(48, 48);

  // 헤드
  img.drawDisc(32, 10, 4.5, 40, 230, 255, 255);
  // 상체 (몸통)
  img.drawLine(30, 14, 23, 27, 40, 230, 255, 255, 4);
  // 앞팔 (앞으로 뻗음)
  img.drawLine(28, 17, 36, 21, 40, 230, 255, 240, 3);
  img.drawLine(36, 21, 38, 15, 40, 230, 255, 240, 3);
  // 뒷팔 (뒤로)
  img.drawLine(28, 17, 20, 21, 40, 230, 255, 240, 3);
  img.drawLine(20, 21, 14, 18, 40, 230, 255, 240, 3);
  // 앞다리 (도약)
  img.drawLine(23, 27, 32, 33, 40, 230, 255, 255, 3.5);
  img.drawLine(32, 33, 37, 42, 255, 203, 77, 255, 3.5); // 운동화 골드
  // 뒷다리 (차고 나감)
  img.drawLine(23, 27, 13, 31, 40, 230, 255, 255, 3.5);
  img.drawLine(13, 31, 8, 38, 255, 203, 77, 255, 3.5);

  // 속도감 모션 트레일 라인
  img.drawLine(4, 25, 14, 25, 40, 230, 255, 160, 1.5);
  img.drawLine(6, 30, 15, 30, 40, 230, 255, 160, 1.5);

  return img.toBuffer();
}

/**
 * 8. stat_squat.png (48 x 48)
 * 스쿼트 / 바벨 아이콘
 */
function generateStatSquat() {
  const img = new RGBAImage(48, 48);

  // 가로 바벨 봉
  img.drawLine(6, 24, 42, 24, 220, 230, 245, 255, 3.5);
  // 좌측 원판 2개
  img.drawLine(10, 14, 10, 34, 255, 203, 77, 255, 5);
  img.drawLine(14, 17, 14, 31, 40, 230, 255, 255, 4);
  // 우측 원판 2개
  img.drawLine(38, 14, 38, 34, 255, 203, 77, 255, 5);
  img.drawLine(34, 17, 34, 31, 40, 230, 255, 255, 4);

  // 하단 스쿼트 화살표 (다운&업 파워 표시)
  img.drawLine(24, 31, 24, 42, 77, 255, 170, 240, 3);
  img.drawLine(20, 38, 24, 42, 77, 255, 170, 240, 2.5);
  img.drawLine(28, 38, 24, 42, 77, 255, 170, 240, 2.5);

  return img.toBuffer();
}

/**
 * 9. stat_jump.png (48 x 48)
 * 점프 스프링 / 도약 아이콘
 */
function generateStatJump() {
  const img = new RGBAImage(48, 48);

  // 상향 3중 도약 애로우 (상승 에너지 화살표)
  // Arrow 1 (대형 상단)
  img.drawLine(24, 6, 12, 18, 255, 203, 77, 255, 3.5);
  img.drawLine(24, 6, 36, 18, 255, 203, 77, 255, 3.5);
  // Arrow 2 (중간)
  img.drawLine(24, 16, 14, 26, 255, 140, 40, 240, 3);
  img.drawLine(24, 16, 34, 26, 255, 140, 40, 240, 3);
  // 지면 스프링 / 반발 코일 (하단)
  img.drawLine(16, 34, 32, 34, 40, 230, 255, 240, 3);
  img.drawLine(18, 39, 30, 39, 40, 230, 255, 220, 2.5);
  img.drawLine(20, 44, 28, 44, 40, 230, 255, 200, 2);

  return img.toBuffer();
}

/**
 * 10. stat_pose.png (48 x 48)
 * 자세 유지 / 명상 아이콘 (연꽃/선 자세 네온 실루엣)
 */
function generateStatPose() {
  const img = new RGBAImage(48, 48);
  const cx = 24;

  // 후광 아우라 (외곽 원)
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      const d = Math.hypot(x - cx, y - 24);
      if (d >= 19 && d <= 21) {
        img.setPixel(x, y, 200, 137, 255, 180);
      }
    }
  }

  // 머리
  img.drawDisc(cx, 13, 4.5, 200, 137, 255, 255);
  // 몸통 (수직 중심)
  img.drawLine(cx, 17, cx, 30, 200, 137, 255, 255, 4);
  // 합장/양팔 (가슴 앞 다이아몬드 아치)
  img.drawLine(cx - 9, 21, cx, 23, 240, 200, 255, 255, 3);
  img.drawLine(cx + 9, 21, cx, 23, 240, 200, 255, 255, 3);
  img.drawLine(cx, 19, cx - 9, 21, 240, 200, 255, 255, 3);
  img.drawLine(cx, 19, cx + 9, 21, 240, 200, 255, 255, 3);
  // 다리 (가부좌 / 연꽃 자세)
  img.drawLine(cx, 30, cx - 12, 38, 200, 137, 255, 255, 3.5);
  img.drawLine(cx, 30, cx + 12, 38, 200, 137, 255, 3.5);
  img.drawLine(cx - 12, 38, cx + 12, 38, 255, 203, 77, 255, 3);

  return img.toBuffer();
}

/**
 * 11. stat_calorie.png (48 x 48)
 * 칼로리 번개 / 에너지 아이콘
 */
function generateStatCalorie() {
  const img = new RGBAImage(48, 48);

  // 번개 볼트 다각형 경로
  const poly = [
    [26, 4],
    [12, 24],
    [23, 24],
    [18, 44],
    [36, 20],
    [25, 20],
  ];

  function pointInPoly(px, py) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const intersect = ((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      if (pointInPoly(x, y)) {
        // 상단 밝은 레몬 옐로우 -> 하단 비비드 오렌지 골드
        const ny = y / 48;
        const r = 255;
        const g = Math.round(230 * (1 - ny) + 120 * ny);
        const b = Math.round(40 * (1 - ny));
        img.setPixel(x, y, r, g, b, 255);
      }
    }
  }

  // 번개 외곽선 네온 글로우
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    img.drawLine(p1[0], p1[1], p2[0], p2[1], 255, 255, 200, 220, 1.8);
  }

  return img.toBuffer();
}

/**
 * 12. star_filled.png (54 x 54)
 * 황금 별 아이콘
 */
function generateStarFilled() {
  const img = new RGBAImage(54, 54);
  const cx = 27;
  const cy = 28;
  const rOut = 23;
  const rIn = 10;

  for (let y = 0; y < 54; y++) {
    for (let x = 0; x < 54; x++) {
      let fillCount = 0;
      let centerDistSum = 0;

      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const px = x + (sx + 0.5) * 0.5;
          const py = y + (sy + 0.5) * 0.5;
          const d = starSDF(px, py, cx, cy, rOut, rIn);
          if (d <= 0) {
            fillCount++;
            centerDistSum += Math.hypot(px - cx, py - cy);
          }
        }
      }

      if (fillCount > 0) {
        const coverage = fillCount / 4;
        const avgDist = centerDistSum / fillCount;
        const normDist = avgDist / rOut;

        let r, g, b;
        if (normDist < 0.4) {
          const t = normDist / 0.4;
          r = 255;
          g = Math.round(255 * (1 - t) + 203 * t);
          b = Math.round(240 * (1 - t) + 77 * t);
        } else {
          const t = (normDist - 0.4) / 0.6;
          r = 255;
          g = Math.round(203 * (1 - t) + 150 * t);
          b = Math.round(77 * (1 - t) + 20 * t);
        }

        img.setPixel(x, y, r, g, b, Math.round(255 * coverage));
      }
    }
  }

  return img.toBuffer();
}

/**
 * 13. star_empty.png (54 x 54)
 * 반투명 회색 외곽선 별 아이콘
 */
function generateStarEmpty() {
  const img = new RGBAImage(54, 54);
  const cx = 27;
  const cy = 28;
  const rOut = 23;
  const rIn = 10;
  const strokeW = 3;

  for (let y = 0; y < 54; y++) {
    for (let x = 0; x < 54; x++) {
      let strokeCount = 0;

      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const px = x + (sx + 0.5) * 0.5;
          const py = y + (sy + 0.5) * 0.5;
          const d = starSDF(px, py, cx, cy, rOut, rIn);
          if (d <= 0 && d >= -strokeW) {
            strokeCount++;
          }
        }
      }

      if (strokeCount > 0) {
        const coverage = strokeCount / 4;
        // 은은한 메탈릭 실버 그레이 외곽선 (#A0A6B8)
        img.setPixel(x, y, 160, 166, 184, Math.round(220 * coverage));
      } else {
        // 내부 반투명 다크 틴트
        const d = starSDF(x, y, cx, cy, rOut, rIn);
        if (d < -strokeW) {
          img.setPixel(x, y, 40, 44, 60, 80);
        }
      }
    }
  }

  return img.toBuffer();
}

// ─── 4. 실행 및 파일 저장 ───

function main() {
  const outDir = path.resolve(process.cwd(), 'public/assets/ui/result');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
    console.log(`[generate-result-assets] 생성된 디렉토리: ${outDir}`);
  }

  const tasks = [
    { file: 'panel_bg.png', fn: generatePanelBg },
    { file: 'victory_title.png', fn: generateVictoryTitle },
    { file: 'defeat_title.png', fn: generateDefeatTitle },
    { file: 'stat_accuracy.png', fn: generateStatAccuracy },
    { file: 'stat_combo.png', fn: generateStatCombo },
    { file: 'stat_time.png', fn: generateStatTime },
    { file: 'stat_run.png', fn: generateStatRun },
    { file: 'stat_squat.png', fn: generateStatSquat },
    { file: 'stat_jump.png', fn: generateStatJump },
    { file: 'stat_pose.png', fn: generateStatPose },
    { file: 'stat_calorie.png', fn: generateStatCalorie },
    { file: 'star_filled.png', fn: generateStarFilled },
    { file: 'star_empty.png', fn: generateStarEmpty },
  ];

  for (const { file, fn } of tasks) {
    const buf = fn();
    const filePath = path.join(outDir, file);
    fs.writeFileSync(filePath, buf);
    console.log(`[generate-result-assets] ${file} 생성 완료 (${buf.length} bytes)`);
  }

  console.log('[generate-result-assets] 전체 13개 결과 화면 에셋 생성 완료!');
}

main();
