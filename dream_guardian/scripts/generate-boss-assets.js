/**
 * scripts/generate-boss-assets.js
 *
 * Dream Guardian 5종 보스 캐릭터 이미지 에셋 생성기 (Issue #270 / UI-ASSET-005)
 * Node.js 내장 zlib, fs, path만을 사용하여 표준 규격의 유효한 투명 PNG 바이너리 파일을 직접 생성합니다.
 *
 * 생성 파일 (총 16개):
 * - public/assets/boss/ch1/ : idle.png, hit.png, enrage.png (256x256, 심해 해파리/망각의 요괴 테마)
 * - public/assets/boss/ch2/ : idle.png, hit.png, enrage.png (256x256, 빠른 번개새/성급의 요괴 테마)
 * - public/assets/boss/ch3/ : idle.png, hit.png, enrage.png (256x256, 거울 프리즘/왜곡의 요괴 테마)
 * - public/assets/boss/ch4/ : idle.png, hit.png, enrage.png (256x256, 시든 꽃/무기력 그림자 테마)
 * - public/assets/boss/ch5/ : idle.png, hit.png, enrage.png, defeat.png (384x384, 어둠 대왕/고립의 지배자 테마)
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

  toBuffer() {
    return encodePNG(this.width, this.height, this.data);
  }
}

// ─── 3. 챕터별 보스 에셋 생성 알고리즘 ───

/**
 * [Ch.1 포겟 - 심해 해파리 / 망각의 요괴] (256x256)
 * 바이올렛/시안 심해 발광 돔, 반투명 베일, 신비로운 촉수, 호롱불 눈
 */
function generateCh1(state) {
  const w = 256;
  const h = 256;
  const img = new RGBAImage(w, h);
  const cx = 128;
  const cy = state === 'hit' ? 122 : 110;

  // 배경 오라 글로우
  const auraR = state === 'enrage' ? 255 : 200;
  const auraG = state === 'enrage' ? 40 : 120;
  const auraB = state === 'enrage' ? 100 : 255;
  img.drawRadialGlow(cx, cy, 30, 110, auraR, auraG, auraB, state === 'enrage' ? 90 : 50, 0);

  // 촉수들 (곡선 라인 시뮬레이션)
  const tentacleCount = state === 'enrage' ? 9 : 7;
  for (let i = 0; i < tentacleCount; i++) {
    const tX = cx - 60 + (120 / (tentacleCount - 1)) * i;
    const waveFreq = 0.08 + i * 0.01;
    const waveAmp = state === 'enrage' ? 24 : (state === 'hit' ? 20 : 12);
    const startY = cy + 25;
    const endY = state === 'hit' ? 230 : (state === 'enrage' ? 245 : 235);

    let prevX = tX;
    let prevY = startY;
    for (let y = startY + 4; y <= endY; y += 4) {
      const offsetX = Math.sin((y - startY) * waveFreq + i) * waveAmp;
      const curX = tX + offsetX;
      const alpha = Math.max(0, 220 - (y - startY) * 1.5);
      const r = state === 'enrage' ? 255 : 160;
      const g = state === 'enrage' ? 60 + i * 15 : 200;
      const b = state === 'enrage' ? 120 : 255;
      img.drawLine(prevX, prevY, curX, y, r, g, b, alpha, state === 'enrage' ? 4 : 3);
      prevX = curX;
      prevY = y;
    }
  }

  // 해파리 본체 돔 (반투명 겹층 타원)
  const domeRy = state === 'hit' ? 48 : (state === 'enrage' ? 65 : 58);
  const domeRx = state === 'hit' ? 76 : (state === 'enrage' ? 74 : 68);

  // 외부 껍질
  const shellR = state === 'enrage' ? 180 : 100;
  const shellG = state === 'enrage' ? 20 : 40;
  const shellB = state === 'enrage' ? 90 : 180;
  img.fillEllipse(cx, cy, domeRx, domeRy, shellR, shellG, shellB, 210);

  // 돔 내부 코어 글로우
  const coreR = state === 'enrage' ? 255 : 180;
  const coreG = state === 'enrage' ? 80 : 140;
  const coreB = state === 'enrage' ? 140 : 255;
  img.fillEllipse(cx, cy - 8, domeRx * 0.75, domeRy * 0.75, coreR, coreG, coreB, 180);

  // 돔 하단 리본 물결 테두리
  for (let x = cx - domeRx; x <= cx + domeRx; x += 2) {
    const waveY = cy + domeRy * 0.7 + Math.sin(x * 0.25) * 6;
    const rimR = state === 'enrage' ? 255 : 140;
    const rimG = state === 'enrage' ? 120 : 230;
    const rimB = state === 'enrage' ? 180 : 255;
    img.drawDisc(x, waveY, 3, rimR, rimG, rimB, 230);
  }

  // 눈 및 감각핵
  if (state === 'hit') {
    // 충격 받은 감긴 눈 + 파열 스파크
    img.drawLine(cx - 30, cy - 4, cx - 12, cy + 6, 255, 255, 255, 255, 3);
    img.drawLine(cx + 12, cy + 6, cx + 30, cy - 4, 255, 255, 255, 255, 3);
    // 균열 선
    img.drawLine(cx - 10, cy - 35, cx + 5, cy - 10, 255, 220, 255, 240, 2);
    img.drawLine(cx + 5, cy - 10, cx + 18, cy + 5, 255, 200, 255, 240, 2);
  } else if (state === 'enrage') {
    // 붉게 타오르는 사나운 눈
    img.fillEllipse(cx - 24, cy - 6, 12, 6, 255, 255, 80, 255, -0.2);
    img.fillEllipse(cx + 24, cy - 6, 12, 6, 255, 255, 80, 255, 0.2);
    img.fillEllipse(cx - 24, cy - 6, 6, 3, 255, 50, 50, 255, -0.2);
    img.fillEllipse(cx + 24, cy - 6, 6, 3, 255, 50, 50, 255, 0.2);
  } else {
    // 몽환적인 황금빛 눈
    img.fillEllipse(cx - 22, cy - 6, 10, 6, 255, 230, 100, 240);
    img.fillEllipse(cx + 22, cy - 6, 10, 6, 255, 230, 100, 240);
    img.fillEllipse(cx - 22, cy - 6, 4, 4, 255, 255, 255, 255);
    img.fillEllipse(cx + 22, cy - 6, 4, 4, 255, 255, 255, 255);
  }

  return img.toBuffer();
}

/**
 * [Ch.2 후다닥 - 빠른 번개새 / 성급의 요괴] (256x256)
 * 날카로운 번개 날개, 전기 골드/옐로우 스파크, 벼락 깃털, 날렵한 매 부리
 */
function generateCh2(state) {
  const w = 256;
  const h = 256;
  const img = new RGBAImage(w, h);
  const cx = 128;
  const cy = state === 'hit' ? 135 : 120;

  // 전기 오라 방전 효과
  const auraR = state === 'enrage' ? 255 : (state === 'hit' ? 255 : 255);
  const auraG = state === 'enrage' ? 120 : (state === 'hit' ? 160 : 210);
  const auraB = state === 'enrage' ? 20 : (state === 'hit' ? 40 : 40);
  img.drawRadialGlow(cx, cy, 35, 115, auraR, auraG, auraB, state === 'enrage' ? 95 : 55, 0);

  // 좌우 번개 날개 (지그재그 날카로운 깃털)
  const wingSpan = state === 'enrage' ? 115 : (state === 'hit' ? 85 : 100);
  const wingColor = state === 'enrage' ? [255, 160, 20] : [255, 215, 0];
  const wingEdge = state === 'enrage' ? [255, 255, 160] : [255, 255, 220];

  for (const side of [-1, 1]) {
    const tipX = cx + side * wingSpan;
    const tipY = cy - 25 + (state === 'hit' ? 20 : (state === 'enrage' ? -25 : 0));
    // 주 날개 뼈대
    img.drawLine(cx, cy - 10, tipX, tipY, wingColor[0], wingColor[1], wingColor[2], 255, 7);
    img.drawLine(tipX, tipY, cx + side * (wingSpan * 0.6), cy + 40, wingColor[0], wingColor[1], wingColor[2], 255, 5);
    img.drawLine(cx + side * (wingSpan * 0.6), cy + 40, cx, cy + 20, wingColor[0], wingColor[1], wingColor[2], 255, 4);

    // 날카로운 번개 깃털 3단
    for (let f = 1; f <= 3; f++) {
      const fX = cx + side * (wingSpan * (0.3 + f * 0.22));
      const fY = tipY + f * 16;
      img.drawLine(cx, cy, fX, fY, wingEdge[0], wingEdge[1], wingEdge[2], 230, 3);
    }
  }

  // 꼬리 번개 깃
  img.drawLine(cx, cy + 30, cx - 35, cy + 90, wingColor[0], wingColor[1], wingColor[2], 220, 4);
  img.drawLine(cx, cy + 30, cx + 35, cy + 90, wingColor[0], wingColor[1], wingColor[2], 220, 4);
  img.drawLine(cx, cy + 30, cx, cy + 105, 255, 255, 200, 255, 5);

  // 번개새 몸통 (날렵한 유선형 다이아몬드/타원)
  const bodyR = state === 'enrage' ? 220 : 180;
  const bodyG = state === 'enrage' ? 80 : 120;
  const bodyB = state === 'enrage' ? 10 : 20;
  img.fillEllipse(cx, cy, 34, 48, bodyR, bodyG, bodyB, 255);
  img.fillEllipse(cx, cy - 2, 24, 36, 255, 200, 40, 255);

  // 머리 벼락 볏 (Crest)
  const crestColor = state === 'enrage' ? [255, 60, 20] : [255, 240, 60];
  img.drawLine(cx, cy - 35, cx - 18, cy - 75, crestColor[0], crestColor[1], crestColor[2], 255, 4);
  img.drawLine(cx, cy - 35, cx, cy - 85, 255, 255, 255, 255, 5);
  img.drawLine(cx, cy - 35, cx + 18, cy - 75, crestColor[0], crestColor[1], crestColor[2], 255, 4);

  // 날카로운 부리
  img.drawLine(cx - 10, cy - 12, cx, cy + 6, 255, 140, 0, 255, 4);
  img.drawLine(cx + 10, cy - 12, cx, cy + 6, 255, 140, 0, 255, 4);

  // 눈
  if (state === 'hit') {
    // 기절 X자 눈
    img.drawLine(cx - 18, cy - 26, cx - 8, cy - 16, 255, 255, 255, 255, 3);
    img.drawLine(cx - 8, cy - 26, cx - 18, cy - 16, 255, 255, 255, 255, 3);
    img.drawLine(cx + 8, cy - 26, cx + 18, cy - 16, 255, 255, 255, 255, 3);
    img.drawLine(cx + 18, cy - 26, cx + 8, cy - 16, 255, 255, 255, 255, 3);
  } else if (state === 'enrage') {
    // 불타는 날카로운 슬릿 눈
    img.fillEllipse(cx - 14, cy - 20, 8, 4, 255, 255, 255, 255, -0.3);
    img.fillEllipse(cx + 14, cy - 20, 8, 4, 255, 255, 255, 255, 0.3);
    img.fillEllipse(cx - 14, cy - 20, 4, 2, 255, 0, 0, 255, -0.3);
    img.fillEllipse(cx + 14, cy - 20, 4, 2, 255, 0, 0, 255, 0.3);
  } else {
    // 날카로운 청록/화이트 눈
    img.fillEllipse(cx - 14, cy - 20, 7, 4, 255, 255, 255, 255, -0.2);
    img.fillEllipse(cx + 14, cy - 20, 7, 4, 255, 255, 255, 255, 0.2);
    img.drawDisc(cx - 14, cy - 20, 2.5, 0, 220, 255, 255);
    img.drawDisc(cx + 14, cy - 20, 2.5, 0, 220, 255, 255);
  }

  return img.toBuffer();
}

/**
 * [Ch.3 뒤죽박죽 - 거울 프리즘 / 왜곡의 요괴] (256x256)
 * 만화경 다각 굴절 결정체, 사이안/마젠타/에메랄드 색수차 분광, 프리즘 파편
 */
function generateCh3(state) {
  const w = 256;
  const h = 256;
  const img = new RGBAImage(w, h);
  const cx = 128;
  const cy = 128;

  // 무지개 프리즘 굴절 오라
  img.drawRadialGlow(cx, cy, 30, 115, 40, 230, 255, state === 'enrage' ? 90 : 50, 0);
  img.drawRadialGlow(cx, cy, 20, 95, 255, 80, 220, state === 'enrage' ? 80 : 40, 0);

  // 육각형 링 그리기 도우미
  function drawHexRing(radius, rot, r, g, b, a, thick = 3) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const angle = rot + (Math.PI * 2 * i) / 6;
      pts.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
    }
    for (let i = 0; i < 6; i++) {
      const next = (i + 1) % 6;
      img.drawLine(pts[i].x, pts[i].y, pts[next].x, pts[next].y, r, g, b, a, thick);
    }
  }

  // 3중 회전 육각 링 (만화경 프리즘)
  const ring1R = state === 'hit' ? 70 : (state === 'enrage' ? 95 : 85);
  const ring2R = state === 'hit' ? 52 : (state === 'enrage' ? 72 : 62);
  const ring3R = state === 'hit' ? 32 : (state === 'enrage' ? 46 : 40);

  drawHexRing(ring1R, 0, 40, 230, 255, 240, state === 'enrage' ? 5 : 3); // Cyan
  drawHexRing(ring2R, Math.PI / 6, 255, 80, 200, 240, state === 'enrage' ? 4 : 3); // Magenta
  drawHexRing(ring3R, Math.PI / 12, 80, 255, 170, 240, state === 'enrage' ? 4 : 2); // Emerald

  // 중앙 코어 결정석
  const coreRad = state === 'enrage' ? 30 : 24;
  img.drawDisc(cx, cy, coreRad, 255, 255, 255, 230);
  img.drawRadialGlow(cx, cy, 5, coreRad, 180, 60, 240, 255, 160);

  // 결정 대각선 굴절 선들
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6;
    const edgeX = cx + Math.cos(angle) * ring1R;
    const edgeY = cy + Math.sin(angle) * ring1R;
    img.drawLine(cx, cy, edgeX, edgeY, 255, 255, 255, state === 'enrage' ? 220 : 160, 2);
  }

  // 외곽 부유 결정 샤드 (8개)
  const shardCount = state === 'enrage' ? 12 : 8;
  for (let s = 0; s < shardCount; s++) {
    const angle = (Math.PI * 2 * s) / shardCount + (state === 'hit' ? 0.3 : 0);
    const dist = state === 'hit' ? 105 : 98;
    const sx = cx + Math.cos(angle) * dist;
    const sy = cy + Math.sin(angle) * dist;
    const color = s % 2 === 0 ? [40, 230, 255] : [255, 100, 220];
    img.fillEllipse(sx, sy, 7, 14, color[0], color[1], color[2], 220, angle);
  }

  // 눈 / 중심 표식
  if (state === 'hit') {
    // 프리즘 균열 (찌그러짐)
    img.drawLine(cx - 40, cy - 20, cx + 10, cy + 5, 255, 255, 255, 255, 3);
    img.drawLine(cx + 10, cy + 5, cx + 45, cy + 30, 255, 255, 255, 255, 3);
    img.drawLine(cx - 15, cy - 40, cx - 10, cy + 35, 255, 220, 255, 220, 2);
  } else if (state === 'enrage') {
    // 붉은 악마 프리즘 안광
    img.drawDisc(cx, cy, 14, 255, 40, 40, 255);
    img.drawDisc(cx, cy, 6, 255, 255, 255, 255);
  } else {
    // 왜곡의 외눈 렌즈
    img.drawDisc(cx, cy, 10, 30, 10, 60, 255);
    img.drawDisc(cx, cy, 5, 40, 230, 255, 255);
  }

  return img.toBuffer();
}

/**
 * [Ch.4 에라 - 시든 꽃 / 무기력 그림자] (256x256)
 * 가시 넝쿨, 시든 검붉은 꽃잎, 솟구치는 암흑 미아스마, 눈물 흘리는 공허의 눈
 */
function generateCh4(state) {
  const w = 256;
  const h = 256;
  const img = new RGBAImage(w, h);
  const cx = 128;
  const cy = state === 'hit' ? 135 : 124;

  // 어둠의 미아스마 오라 (스모크)
  const auraR = state === 'enrage' ? 180 : 60;
  const auraG = state === 'enrage' ? 10 : 15;
  const auraB = state === 'enrage' ? 80 : 90;
  img.drawRadialGlow(cx, cy, 30, 115, auraR, auraG, auraB, state === 'enrage' ? 110 : 70, 0);

  // 솟구치는 그림자 텐타클 / 연기 기둥 (8방향)
  const tentacleCount = state === 'enrage' ? 10 : 8;
  for (let i = 0; i < tentacleCount; i++) {
    const angle = (Math.PI * 2 * i) / tentacleCount;
    const tLen = state === 'enrage' ? 105 : (state === 'hit' ? 70 : 88);
    const tipX = cx + Math.cos(angle) * tLen;
    const tipY = cy + Math.sin(angle) * tLen - (state === 'enrage' ? 20 : 0);

    const midX = cx + Math.cos(angle + 0.3) * (tLen * 0.55);
    const midY = cy + Math.sin(angle + 0.3) * (tLen * 0.55);

    const colR = state === 'enrage' ? 140 : 45;
    const colG = state === 'enrage' ? 10 : 15;
    const colB = state === 'enrage' ? 60 : 75;

    img.drawLine(cx, cy, midX, midY, colR, colG, colB, 220, 6);
    img.drawLine(midX, midY, tipX, tipY, colR, colG, colB, 220, 3);
  }

  // 시든 꽃잎 층 (6장)
  const petalCount = 6;
  const petalColor = state === 'enrage' ? [120, 20, 60] : [55, 25, 80];
  const petalEdge = state === 'enrage' ? [255, 60, 100] : [130, 70, 180];
  for (let p = 0; p < petalCount; p++) {
    const angle = (Math.PI * 2 * p) / petalCount;
    const pLen = state === 'enrage' ? 56 : 48;
    const px = cx + Math.cos(angle) * pLen;
    const py = cy + Math.sin(angle) * pLen;
    img.fillEllipse(px, py, 22, 38, petalColor[0], petalColor[1], petalColor[2], 240, angle);
    img.fillEllipse(px, py, 14, 28, petalEdge[0], petalEdge[1], petalEdge[2], 180, angle);
  }

  // 꽃 심장 코어 (어둠의 눈동자 방석)
  img.drawDisc(cx, cy, 32, 20, 8, 35, 255);
  img.drawDisc(cx, cy, 24, 40, 12, 60, 255);

  // 가시 넝쿨 (Thorn Vines)
  for (const dir of [-1, 1]) {
    const vx = cx + dir * 65;
    const vy = cy + 45;
    img.drawLine(cx, cy + 20, vx, vy, 30, 60, 20, 255, 4);
    // 가시 돌기
    img.drawLine(vx, vy, vx + dir * 15, vy - 10, 200, 40, 60, 255, 3);
  }

  // 중심 공허의 눈
  if (state === 'hit') {
    // 부서진 시든 꽃술
    img.drawLine(cx - 20, cy - 8, cx + 20, cy + 8, 255, 100, 100, 255, 3);
    img.drawLine(cx - 20, cy + 8, cx + 20, cy - 8, 255, 100, 100, 255, 3);
  } else if (state === 'enrage') {
    // 붉게 타오르는 흉폭한 응시
    img.fillEllipse(cx, cy, 18, 9, 255, 30, 50, 255);
    img.fillEllipse(cx, cy, 8, 4, 255, 255, 200, 255);
  } else {
    // 무기력하게 눈물 흘리는 공허한 눈
    img.fillEllipse(cx, cy, 14, 7, 180, 140, 255, 230);
    img.drawDisc(cx, cy, 4, 20, 5, 30, 255);
    // 눈물 줄기
    img.drawLine(cx, cy + 7, cx, cy + 32, 100, 180, 255, 200, 2);
  }

  return img.toBuffer();
}

/**
 * [Ch.5 나이트메어 - 어둠 대왕 / 고립의 지배자] (384x384)
 * 거대한 흑요석 왕관, 칠흑의 악마 날개, 진홍의 4연 안광, 심연의 보석 코어
 */
function generateCh5(state) {
  const w = 384;
  const h = 384;
  const img = new RGBAImage(w, h);
  const cx = 192;
  const cy = state === 'hit' ? 205 : 185;

  if (state === 'defeat') {
    // [패배 상태]: 왕관 산산조각, 흐려지는 날개, 흩날리는 잿가루 파편
    img.drawRadialGlow(cx, cy, 20, 120, 40, 15, 60, 45, 0);

    // 부서지는 날개 흔적
    img.fillEllipse(cx - 90, cy + 20, 70, 30, 30, 15, 45, 80, -0.4);
    img.fillEllipse(cx + 90, cy + 20, 70, 30, 30, 15, 45, 80, 0.4);

    // 무너진 몸체 잔해
    img.fillEllipse(cx, cy + 25, 45, 60, 25, 10, 35, 120);

    // 흩날리는 암흑 재 파편 35개
    for (let p = 0; p < 35; p++) {
      const pX = cx - 120 + Math.sin(p * 2.3) * 110;
      const pY = cy - 80 + (p * 7);
      const pr = 2 + (p % 3);
      img.drawDisc(pX, pY, pr, 180, 40, 60, Math.max(0, 200 - p * 5));
    }

    // 부서진 왕관 파편 3조각
    img.drawLine(cx - 35, cy - 50, cx - 15, cy - 70, 60, 20, 80, 160, 4);
    img.drawLine(cx + 20, cy - 65, cx + 45, cy - 45, 60, 20, 80, 160, 4);

    // 꺼져가는 눈빛
    img.drawDisc(cx - 20, cy - 10, 3, 255, 60, 60, 90);
    img.drawDisc(cx + 20, cy - 10, 3, 255, 60, 60, 90);

    return img.toBuffer();
  }

  // 강력한 암흑 진홍 오라
  const auraR = state === 'enrage' ? 255 : 120;
  const auraG = state === 'enrage' ? 20 : 10;
  const auraB = state === 'enrage' ? 60 : 40;
  img.drawRadialGlow(cx, cy, 50, 175, auraR, auraG, auraB, state === 'enrage' ? 120 : 65, 0);

  // 거대한 심연의 날개 (좌우 펼침)
  const wingSpan = state === 'enrage' ? 170 : (state === 'hit' ? 130 : 155);
  const wingY = cy - 20 + (state === 'enrage' ? -30 : 0);

  for (const side of [-1, 1]) {
    const tipX = cx + side * wingSpan;
    const tipY = wingY - 50;

    // 주 날개 뼈대
    img.drawLine(cx, cy - 10, tipX, tipY, 40, 10, 50, 255, 10);
    img.drawLine(tipX, tipY, cx + side * (wingSpan * 0.7), cy + 80, 30, 8, 40, 255, 8);
    img.drawLine(cx + side * (wingSpan * 0.7), cy + 80, cx, cy + 60, 25, 6, 35, 255, 6);

    // 날개 깃 가시 4단
    for (let f = 1; f <= 4; f++) {
      const fX = cx + side * (wingSpan * (0.35 + f * 0.16));
      const fY = tipY + f * 26;
      const spikeR = state === 'enrage' ? 255 : 140;
      const spikeG = state === 'enrage' ? 30 : 20;
      const spikeB = state === 'enrage' ? 80 : 50;
      img.drawLine(cx, cy, fX, fY, spikeR, spikeG, spikeB, 220, 4);
    }
  }

  // 대왕 본체 몸통 (갑주 실루엣)
  img.fillEllipse(cx, cy + 20, 52, 75, 20, 8, 30, 255);
  img.fillEllipse(cx, cy + 18, 40, 60, 40, 15, 55, 255);

  // 가슴 중앙 공허의 심장 (붉은 루비 보석 코어)
  const coreRad = state === 'enrage' ? 22 : 16;
  img.drawDisc(cx, cy + 25, coreRad, 255, 20, 60, 255);
  img.drawDisc(cx, cy + 25, coreRad * 0.6, 255, 200, 220, 255);

  // 흑요석 왕관 (Head Horns / Crown)
  const crownColor = state === 'enrage' ? [255, 40, 80] : [80, 25, 100];
  const hornTipY = state === 'enrage' ? cy - 130 : cy - 110;
  // 좌/우 거대한 뿔
  img.drawLine(cx - 30, cy - 35, cx - 75, hornTipY, crownColor[0], crownColor[1], crownColor[2], 255, 8);
  img.drawLine(cx + 30, cy - 35, cx + 75, hornTipY, crownColor[0], crownColor[1], crownColor[2], 255, 8);
  // 중앙 왕관 첨탑 3개
  img.drawLine(cx, cy - 40, cx, hornTipY + 15, 255, 215, 0, 255, 7);
  img.drawLine(cx - 20, cy - 40, cx - 28, hornTipY + 30, 210, 160, 0, 255, 5);
  img.drawLine(cx + 20, cy - 40, cx + 28, hornTipY + 30, 210, 160, 0, 255, 5);

  // 어둠의 어깨 견갑
  img.fillEllipse(cx - 50, cy - 5, 24, 18, 60, 20, 80, 255, -0.4);
  img.fillEllipse(cx + 50, cy - 5, 24, 18, 60, 20, 80, 255, 0.4);

  // 4연 안광 (2쌍의 불타는 눈)
  if (state === 'hit') {
    // 타격에 흔들리며 번뜩이는 흰색/진홍 섬광
    img.fillEllipse(cx - 26, cy - 25, 12, 6, 255, 255, 255, 255, -0.2);
    img.fillEllipse(cx + 26, cy - 25, 12, 6, 255, 255, 255, 255, 0.2);
    img.fillEllipse(cx - 22, cy - 10, 9, 5, 255, 255, 255, 255, -0.1);
    img.fillEllipse(cx + 22, cy - 10, 9, 5, 255, 255, 255, 255, 0.1);
    // 갑옷 균열선
    img.drawLine(cx - 30, cy - 15, cx + 5, cy + 40, 255, 100, 120, 240, 3);
  } else if (state === 'enrage') {
    // 흉포하게 타오르는 초열 진홍 안광 + 레이저 궤적
    img.fillEllipse(cx - 28, cy - 26, 15, 6, 255, 0, 40, 255, -0.3);
    img.fillEllipse(cx + 28, cy - 26, 15, 6, 255, 0, 40, 255, 0.3);
    img.fillEllipse(cx - 28, cy - 26, 7, 3, 255, 255, 255, 255, -0.3);
    img.fillEllipse(cx + 28, cy - 26, 7, 3, 255, 255, 255, 255, 0.3);

    img.fillEllipse(cx - 22, cy - 10, 12, 5, 255, 30, 60, 255, -0.2);
    img.fillEllipse(cx + 22, cy - 10, 12, 5, 255, 30, 60, 255, 0.2);
    img.fillEllipse(cx - 22, cy - 10, 6, 2, 255, 255, 255, 255, -0.2);
    img.fillEllipse(cx + 22, cy - 10, 6, 2, 255, 255, 255, 255, 0.2);
  } else {
    // 차갑고 위압적인 4개의 진홍빛 눈
    img.fillEllipse(cx - 26, cy - 24, 12, 5, 255, 30, 70, 255, -0.2);
    img.fillEllipse(cx + 26, cy - 24, 12, 5, 255, 30, 70, 255, 0.2);
    img.drawDisc(cx - 26, cy - 24, 3, 255, 230, 240, 255);
    img.drawDisc(cx + 26, cy - 24, 3, 255, 230, 240, 255);

    img.fillEllipse(cx - 20, cy - 9, 9, 4, 230, 20, 50, 255, -0.1);
    img.fillEllipse(cx + 20, cy - 9, 9, 4, 230, 20, 50, 255, 0.1);
    img.drawDisc(cx - 20, cy - 9, 2, 255, 200, 220, 255);
    img.drawDisc(cx + 20, cy - 9, 2, 255, 200, 220, 255);
  }

  return img.toBuffer();
}

// ─── 4. 실행 및 파일 저장 ───

function main() {
  const rootDir = process.cwd();
  const baseDir = path.join(rootDir, 'public', 'assets', 'boss');

  console.log(`[generate-boss-assets] Generating 16 boss assets in ${baseDir}...`);

  const chapters = [
    { name: 'ch1', generator: generateCh1, states: ['idle', 'hit', 'enrage'] },
    { name: 'ch2', generator: generateCh2, states: ['idle', 'hit', 'enrage'] },
    { name: 'ch3', generator: generateCh3, states: ['idle', 'hit', 'enrage'] },
    { name: 'ch4', generator: generateCh4, states: ['idle', 'hit', 'enrage'] },
    { name: 'ch5', generator: generateCh5, states: ['idle', 'hit', 'enrage', 'defeat'] },
  ];

  let totalCount = 0;
  for (const ch of chapters) {
    const chDir = path.join(baseDir, ch.name);
    fs.mkdirSync(chDir, { recursive: true });

    for (const state of ch.states) {
      const buffer = ch.generator(state);
      const outPath = path.join(chDir, `${state}.png`);
      fs.writeFileSync(outPath, buffer);
      console.log(`  ✓ Generated ${ch.name}/${state}.png (${buffer.length} bytes)`);
      totalCount++;
    }
  }

  console.log(`[generate-boss-assets] Successfully created all ${totalCount} boss sprite assets!`);
}

main();
