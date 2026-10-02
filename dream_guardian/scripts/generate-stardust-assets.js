/**
 * scripts/generate-stardust-assets.js
 *
 * Dream Guardian 별가루(Stardust / 별똥별) 이미지 및 벡터 에셋 생성기
 * 동시집 '별똥별' 참고 이미지 기반:
 * - 통통하고 따뜻한 5각 황금 별똥별 실루엣 (둥근 꼭짓점, 따뜻한 백색/노랑 그라디언트)
 * - 좌상단에서 우하단으로 시원하게 뻗는 풍성한 유성 꼬리(Meteor Tail Plume)
 * - 부드럽고 눈에 띄는 금빛 후광(Aura Glow) 및 흩날리는 반짝이 별가루(Stardust Embers)
 *
 * 생성 파일 (각 대상 디렉터리당 11종):
 *  1. stardust_icon_gold.svg (512x512)
 *  2. stardust_icon_gold.png (512x512)
 *  3. stardust_icon_cyan.svg (512x512)
 *  4. stardust_icon_cyan.png (512x512)
 *  5. stardust_icon_violet.svg (512x512)
 *  6. stardust_icon_violet.png (512x512)
 *  7. stardust_icon_8p.svg (512x512)
 *  8. stardust_icon_8p.png (512x512)
 *  9. stardust_stream.png (1000x600, 유성우 스트림)
 * 10. stardust_burst.png (800x800, 별가루 폭발 버스트)
 * 11. stardust_counter_badge.png (600x200, 별가루 UI 카운터 뱃지)
 *
 * 배포 대상 경로:
 *  - img/stardust/
 *  - public/img/stardust/
 *  - public/assets/effect/stardust/
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

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
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

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
          const factor = radius + 0.5 - dist;
          this.setPixel(x, y, r, g, b, Math.round(a * factor));
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

  drawSoftLine(x0, y0, x1, y1, width, r, g, b, a) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len === 0) return;
    const steps = Math.ceil(len * 2);
    const radius = width * 0.5;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      this.drawDisc(x, y, radius, r, g, b, a);
    }
  }

  /**
   * 유성 꼬리 플룸(Meteor Plume) 드로잉
   * (headX, headY)에서 시작해 (tailX, tailY)로 뻗는 부드러운 그라디언트 꼬리
   */
  drawMeteorTail(headX, headY, tailX, tailY, headWidth, tailWidth, colorStart, colorEnd, alpha = 240) {
    const dx = tailX - headX;
    const dy = tailY - headY;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;

    const dirX = dx / len;
    const dirY = dy / len;
    const perpX = -dirY;
    const perpY = dirX;

    const steps = Math.ceil(len * 1.5);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps; // 0 (머리) ~ 1 (꼬리 끝)
      const cx = headX + dx * t;
      const cy = headY + dy * t;
      const currentW = headWidth * (1 - t * 0.85) + tailWidth * (t * 0.85);

      // 색상 보간
      const r = Math.round(colorStart.r * (1 - t) + colorEnd.r * t);
      const g = Math.round(colorStart.g * (1 - t) + colorEnd.g * t);
      const b = Math.round(colorStart.b * (1 - t) + colorEnd.b * t);
      const a = Math.round(alpha * Math.pow(1 - t, 1.2));

      // 가로 폭 디스크 렌더링
      const halfW = currentW * 0.5;
      this.drawSoftLine(
        cx - perpX * halfW,
        cy - perpY * halfW,
        cx + perpX * halfW,
        cy + perpY * halfW,
        Math.max(2, currentW * 0.4),
        r,
        g,
        b,
        a,
      );

      // 중앙 고휘도 코어 빔
      const coreA = Math.round(255 * (1 - t * 0.9));
      this.drawDisc(cx, cy, Math.max(1.5, currentW * 0.22), 255, 255, 255, coreA);
    }
  }

  /**
   * 통통하고 둥근 5각/8각 별 드로잉
   */
  drawShootingStar(cx, cy, points, outerR, innerR, colorPalette, rotation = 0) {
    const minX = Math.max(0, Math.floor(cx - outerR - 2));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + outerR + 2));
    const minY = Math.max(0, Math.floor(cy - outerR - 2));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + outerR + 2));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > outerR) continue;

        let angle = Math.atan2(dy, dx) - rotation;
        while (angle < 0) angle += Math.PI * 2;
        while (angle >= Math.PI * 2) angle -= Math.PI * 2;

        const step = (Math.PI * 2) / points;
        const modAngle = (angle % step) / step; // 0 to 1
        // 부드럽게 둥근 코사인 곡선 보간
        const peakT = (Math.cos(modAngle * Math.PI * 2) + 1) * 0.5; // 1 at peak, 0 at valley
        const thresholdR = innerR + (outerR - innerR) * peakT;

        if (dist <= thresholdR) {
          const distFactor = dist / thresholdR; // 0 at center, 1 at edge
          const edgeAlpha = Math.min(1, Math.max(0, (thresholdR - dist) * 1.5));

          // 중심 백색 -> 중간 화사한 노랑 -> 외곽 테두리 황금/오렌지
          let r = 255, g = 255, b = 255;
          if (distFactor < 0.25) {
            r = 255;
            g = 255;
            b = 255;
          } else if (distFactor < 0.7) {
            const t = (distFactor - 0.25) / 0.45;
            r = Math.round(255 * (1 - t) + colorPalette.mid.r * t);
            g = Math.round(255 * (1 - t) + colorPalette.mid.g * t);
            b = Math.round(240 * (1 - t) + colorPalette.mid.b * t);
          } else {
            const t = (distFactor - 0.7) / 0.3;
            r = Math.round(colorPalette.mid.r * (1 - t) + colorPalette.edge.r * t);
            g = Math.round(colorPalette.mid.g * (1 - t) + colorPalette.edge.g * t);
            b = Math.round(colorPalette.mid.b * (1 - t) + colorPalette.edge.b * t);
          }

          this.setPixel(x, y, r, g, b, Math.round(255 * edgeAlpha));
        }
      }
    }

    // 외곽 테두리 샤프닝
    this.drawRadialGlow(cx, cy, outerR * 0.8, outerR * 1.25, colorPalette.edge.r, colorPalette.edge.g, colorPalette.edge.b, 100, 0);
    // 중심 백색 펄스 코어
    this.drawDisc(cx, cy - outerR * 0.05, innerR * 0.45, 255, 255, 255, 220);
  }

  toBuffer() {
    return encodePNG(this.width, this.height, this.data);
  }
}

// ─── 3. SVG 생성 헬퍼 ───

function createShootingStarSvg({
  colorName = 'gold',
  points = 5,
  coreColor = '#FFFFFF',
  midColor = '#FFF59D',
  edgeColor = '#FFB300',
  glowColor = '#FFA000',
  auraColor = '#FFE082',
  withTail = true,
}) {
  const outerR = 140;
  const innerR = points === 5 ? 72 : 46;
  const cx = withTail ? 285 : 256;
  const cy = withTail ? 275 : 256;

  // 10개(또는 16개) 꼭짓점 좌표 계산
  const totalVertices = points * 2;
  const pts = [];
  for (let i = 0; i < totalVertices; i++) {
    const angle = (Math.PI * 2 * i) / totalVertices - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push({
      x: (cx + Math.cos(angle) * r).toFixed(2),
      y: (cy + Math.sin(angle) * r).toFixed(2),
    });
  }

  // 둥근 별 패스 생성
  let starPath = '';
  if (points === 5) {
    const midPoints = pts.map((p, idx) => {
      const next = pts[(idx + 1) % totalVertices];
      return {
        x: ((parseFloat(p.x) + parseFloat(next.x)) * 0.5).toFixed(2),
        y: ((parseFloat(p.y) + parseFloat(next.y)) * 0.5).toFixed(2),
      };
    });
    starPath = `M ${midPoints[totalVertices - 1].x} ${midPoints[totalVertices - 1].y} `;
    for (let i = 0; i < totalVertices; i++) {
      starPath += `Q ${pts[i].x} ${pts[i].y}, ${midPoints[i].x} ${midPoints[i].y} `;
    }
    starPath += 'Z';
  } else {
    starPath = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + ' Z';
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- 외곽 금빛 후광 블러 필터 -->
    <filter id="softGlow_${colorName}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="24" result="blur1" />
      <feGaussianBlur stdDeviation="10" result="blur2" />
      <feMerge>
        <feMergeNode in="blur1" />
        <feMergeNode in="blur2" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <!-- 유성 꼬리 그라디언트 -->
    <linearGradient id="tailGrad_${colorName}" x1="0.8" y1="0.8" x2="0.05" y2="0.05">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95" />
      <stop offset="25%" stop-color="${midColor}" stop-opacity="0.85" />
      <stop offset="65%" stop-color="${edgeColor}" stop-opacity="0.45" />
      <stop offset="100%" stop-color="${glowColor}" stop-opacity="0" />
    </linearGradient>

    <!-- 별 본체 방사형 따뜻한 그라디언트 -->
    <radialGradient id="starGrad_${colorName}" cx="38%" cy="32%" r="68%">
      <stop offset="0%" stop-color="${coreColor}" />
      <stop offset="35%" stop-color="${midColor}" />
      <stop offset="75%" stop-color="${edgeColor}" />
      <stop offset="100%" stop-color="${glowColor}" />
    </radialGradient>

    <!-- 원형 후광 그라디언트 -->
    <radialGradient id="haloGrad_${colorName}" cx="50%" cy="50%" r="50%">
      <stop offset="20%" stop-color="${auraColor}" stop-opacity="0.7" />
      <stop offset="70%" stop-color="${glowColor}" stop-opacity="0.25" />
      <stop offset="100%" stop-color="${glowColor}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- 1. 좌상단으로 뻗는 풍성한 유성 꼬리 (동시집 '별똥별' 스타일) -->
  ${withTail ? `
  <path d="M ${cx - 75} ${cy + 75} L 40 40 L 70 20 L ${cx + 75} ${cy - 75} Z" fill="url(#tailGrad_${colorName})" opacity="0.9" />
  <line x1="${cx}" y1="${cy}" x2="45" y2="35" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round" opacity="0.75" />
  <!-- 꼬리 주변 흩날리는 별가루 파티클 -->
  <circle cx="120" cy="90" r="7" fill="#FFFFFF" opacity="0.85" />
  <circle cx="170" cy="130" r="5" fill="${midColor}" opacity="0.9" />
  <circle cx="95" cy="140" r="4" fill="${edgeColor}" opacity="0.75" />
  <circle cx="210" cy="180" r="8" fill="#FFFFFF" opacity="0.85" />
  <circle cx="140" cy="220" r="5.5" fill="${midColor}" opacity="0.8" />
  ` : ''}

  <!-- 2. 따뜻한 외곽 후광(Aura Glow) -->
  <circle cx="${cx}" cy="${cy}" r="${outerR * 1.5}" fill="url(#haloGrad_${colorName})" />

  <!-- 3. 통통하고 따뜻한 별똥별 본체 -->
  <path d="${starPath}" fill="url(#starGrad_${colorName})" stroke="${edgeColor}" stroke-width="6" stroke-linejoin="round" filter="url(#softGlow_${colorName})" />

  <!-- 4. 중심부 눈부신 백색 빛 코어 -->
  <circle cx="${cx - 8}" cy="${cy - 8}" r="${innerR * 0.45}" fill="#FFFFFF" opacity="0.9" />
  <circle cx="${cx + 12}" cy="${cy + 10}" r="${innerR * 0.22}" fill="#FFFFFF" opacity="0.7" />
</svg>
`;
}

// ─── 4. 에셋 생성 파이프라인 ───

const PALETTES = {
  gold: {
    name: 'gold',
    mid: { r: 255, g: 245, b: 157 },  // #FFF59D
    edge: { r: 255, g: 179, b: 0 },   // #FFB300
    glow: { r: 255, g: 143, b: 0 },   // #FF8F00
    svgMid: '#FFF59D',
    svgEdge: '#FFB300',
    svgGlow: '#FF8F00',
    svgAura: '#FFE082',
  },
  cyan: {
    name: 'cyan',
    mid: { r: 167, g: 243, b: 255 },  // 시안 소프트
    edge: { r: 40, g: 230, b: 255 },   // #28E6FF
    glow: { r: 0, g: 160, b: 220 },
    svgMid: '#A7F3FF',
    svgEdge: '#28E6FF',
    svgGlow: '#0091EA',
    svgAura: '#80D8FF',
  },
  violet: {
    name: 'violet',
    mid: { r: 243, g: 215, b: 255 },  // 라벤더 소프트
    edge: { r: 200, g: 137, b: 255 },  // #C889FF
    glow: { r: 156, g: 39, b: 176 },
    svgMid: '#F3D7FF',
    svgEdge: '#C889FF',
    svgGlow: '#9C27B0',
    svgAura: '#EA80FC',
  },
};

// 4.1. stardust_icon_gold.png (512x512)
function generateIconPng(palette, points = 5) {
  const img = new RGBAImage(512, 512);
  const cx = 285;
  const cy = 275;
  const tailX = 45;
  const tailY = 35;

  // 1. 유성 꼬리 플룸
  img.drawMeteorTail(cx, cy, tailX, tailY, 110, 16, palette.mid, palette.glow, 230);

  // 꼬리 주변 반짝이
  const embers = [
    { x: 120, y: 90, r: 7 },
    { x: 170, y: 130, r: 5 },
    { x: 95, y: 140, r: 4 },
    { x: 210, y: 180, r: 8 },
    { x: 140, y: 220, r: 6 },
    { x: 80, y: 70, r: 5 },
    { x: 230, y: 120, r: 6 },
  ];
  for (const e of embers) {
    img.drawDisc(e.x, e.y, e.r, 255, 255, 255, 220);
    img.drawRadialGlow(e.x, e.y, e.r, e.r * 2.5, palette.mid.r, palette.mid.g, palette.mid.b, 160, 0);
  }

  // 2. 외곽 부드러운 금빛 후광
  img.drawRadialGlow(cx, cy, 100, 230, palette.edge.r, palette.edge.g, palette.edge.b, 130, 0);

  // 3. 통통하고 따뜻한 5각 별
  const outerR = 140;
  const innerR = points === 5 ? 74 : 48;
  img.drawShootingStar(cx, cy, points, outerR, innerR, palette, 0);

  return img.toBuffer();
}

// 4.2. stardust_stream.png (1000x600, 밤하늘에 쏟아지는 유성우)
function generateStreamPng() {
  const img = new RGBAImage(1000, 600);

  // 여러 줄기의 크고 작은 별똥별들이 좌상단 -> 우하단으로 비행
  const meteors = [
    // 주 대형 별똥별 (중앙 우하단)
    { headX: 680, headY: 420, tailX: 180, tailY: 80, outerR: 70, innerR: 36, w: 75 },
    // 중형 별똥별 1 (상단)
    { headX: 420, headY: 260, tailX: 100, tailY: 40, outerR: 44, innerR: 22, w: 45 },
    // 중형 별똥별 2 (하단)
    { headX: 860, headY: 520, tailX: 520, tailY: 270, outerR: 38, innerR: 19, w: 38 },
    // 소형 별똥별 3 (좌하단)
    { headX: 300, headY: 480, tailX: 60, tailY: 300, outerR: 28, innerR: 14, w: 28 },
    // 소형 별똥별 4 (우상단)
    { headX: 840, headY: 180, tailX: 560, tailY: 20, outerR: 30, innerR: 15, w: 30 },
  ];

  for (const m of meteors) {
    // 꼬리
    img.drawMeteorTail(m.headX, m.headY, m.tailX, m.tailY, m.w, 8, PALETTES.gold.mid, PALETTES.gold.glow, 220);
    // 후광
    img.drawRadialGlow(m.headX, m.headY, m.outerR * 0.7, m.outerR * 2.0, 255, 180, 0, 140, 0);
    // 별 본체
    img.drawShootingStar(m.headX, m.headY, 5, m.outerR, m.innerR, PALETTES.gold);
  }

  // 주변에 유영하는 25개의 반짝이 별가루들
  const sparkles = [
    [150, 180, 6], [280, 110, 4], [350, 190, 7], [480, 140, 5],
    [540, 320, 8], [610, 220, 6], [720, 280, 7], [220, 390, 5],
    [380, 410, 6], [510, 460, 8], [750, 490, 5], [920, 380, 6],
    [880, 90, 5], [90, 420, 4], [430, 530, 6], [660, 530, 7],
  ];
  for (const [sx, sy, sr] of sparkles) {
    img.drawDisc(sx, sy, sr, 255, 255, 255, 240);
    img.drawRadialGlow(sx, sy, sr, sr * 3, 255, 220, 100, 180, 0);
  }

  return img.toBuffer();
}

// 4.3. stardust_burst.png (800x800, 사방으로 터지는 화려한 별가루 폭발)
function generateBurstPng() {
  const img = new RGBAImage(800, 800);
  const cx = 400;
  const cy = 400;

  // 8방향으로 뻗어나가는 유성 광선
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;
    const tailX = cx + Math.cos(angle) * 320;
    const tailY = cy + Math.sin(angle) * 320;
    img.drawMeteorTail(cx, cy, tailX, tailY, 50, 6, PALETTES.gold.mid, PALETTES.gold.glow, 200);

    // 각 끝자락의 작은 별
    const tipStarX = cx + Math.cos(angle) * 270;
    const tipStarY = cy + Math.sin(angle) * 270;
    img.drawShootingStar(tipStarX, tipStarY, 5, 28, 14, PALETTES.gold, angle);
  }

  // 중심 대형 후광
  img.drawRadialGlow(cx, cy, 80, 360, 255, 190, 0, 160, 0);

  // 중앙 초대형 황금빛 별똥별
  img.drawShootingStar(cx, cy, 5, 120, 62, PALETTES.gold);

  return img.toBuffer();
}

// 4.4. stardust_counter_badge.png (600x200, UI 카운터 뱃지)
function generateBadgePng() {
  const img = new RGBAImage(600, 200);

  // 반투명 다크 둥근 사각 배경 (필름)
  const pad = 12;
  const bw = 600 - pad * 2;
  const bh = 200 - pad * 2;
  const radius = bh * 0.5;

  // 둥근 캡슐 배경
  for (let y = pad; y < pad + bh; y++) {
    for (let x = pad; x < pad + bw; x++) {
      let d = 0;
      if (x < pad + radius) {
        d = Math.hypot(x - (pad + radius), y - (pad + radius));
      } else if (x > pad + bw - radius) {
        d = Math.hypot(x - (pad + bw - radius), y - (pad + radius));
      }

      if (d <= radius) {
        // 다크 네온 반투명 채우기
        img.setPixel(x, y, 15, 23, 42, 210);

        // 황금빛 테두리 (두께 4px)
        if (d >= radius - 4) {
          img.setPixel(x, y, 255, 203, 77, 230);
        }
      }
    }
  }

  // 좌측 대표 별똥별 아이콘 드로잉
  const starX = pad + radius + 15;
  const starY = pad + radius;
  // 미니 유성 꼬리
  img.drawMeteorTail(starX, starY, starX - 55, starY - 45, 34, 6, PALETTES.gold.mid, PALETTES.gold.glow, 220);
  img.drawRadialGlow(starX, starY, 25, 75, 255, 190, 0, 160, 0);
  img.drawShootingStar(starX, starY, 5, 52, 26, PALETTES.gold);

  return img.toBuffer();
}

// ─── 5. 실행 및 파일 저장 ───

function main() {
  const targetDirs = [
    path.join(ROOT_DIR, 'img', 'stardust'),
    path.join(ROOT_DIR, 'public', 'img', 'stardust'),
    path.join(ROOT_DIR, 'public', 'assets', 'effect', 'stardust'),
  ];

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  console.log('✨ [StardustAssetGenerator] 별가루(별똥별) 고품질 에셋 생성 시작...');

  // 1. SVGs 생성
  const svgGold = createShootingStarSvg({
    colorName: 'gold',
    points: 5,
    coreColor: '#FFFFFF',
    midColor: PALETTES.gold.svgMid,
    edgeColor: PALETTES.gold.svgEdge,
    glowColor: PALETTES.gold.svgGlow,
    auraColor: PALETTES.gold.svgAura,
    withTail: true,
  });

  const svgCyan = createShootingStarSvg({
    colorName: 'cyan',
    points: 5,
    coreColor: '#FFFFFF',
    midColor: PALETTES.cyan.svgMid,
    edgeColor: PALETTES.cyan.svgEdge,
    glowColor: PALETTES.cyan.svgGlow,
    auraColor: PALETTES.cyan.svgAura,
    withTail: true,
  });

  const svgViolet = createShootingStarSvg({
    colorName: 'violet',
    points: 5,
    coreColor: '#FFFFFF',
    midColor: PALETTES.violet.svgMid,
    edgeColor: PALETTES.violet.svgEdge,
    glowColor: PALETTES.violet.svgGlow,
    auraColor: PALETTES.violet.svgAura,
    withTail: true,
  });

  const svg8p = createShootingStarSvg({
    colorName: '8p',
    points: 8,
    coreColor: '#FFFFFF',
    midColor: PALETTES.gold.svgMid,
    edgeColor: PALETTES.gold.svgEdge,
    glowColor: PALETTES.gold.svgGlow,
    auraColor: PALETTES.gold.svgAura,
    withTail: true,
  });

  // 2. PNGs 생성
  console.log(' - Rasterizing stardust_icon_gold.png...');
  const pngGold = generateIconPng(PALETTES.gold, 5);

  console.log(' - Rasterizing stardust_icon_cyan.png...');
  const pngCyan = generateIconPng(PALETTES.cyan, 5);

  console.log(' - Rasterizing stardust_icon_violet.png...');
  const pngViolet = generateIconPng(PALETTES.violet, 5);

  console.log(' - Rasterizing stardust_icon_8p.png...');
  const png8p = generateIconPng(PALETTES.gold, 8);

  console.log(' - Rasterizing stardust_stream.png...');
  const pngStream = generateStreamPng();

  console.log(' - Rasterizing stardust_burst.png...');
  const pngBurst = generateBurstPng();

  console.log(' - Rasterizing stardust_counter_badge.png...');
  const pngBadge = generateBadgePng();

  const fileMap = {
    'stardust_icon_gold.svg': Buffer.from(svgGold, 'utf-8'),
    'stardust_icon_cyan.svg': Buffer.from(svgCyan, 'utf-8'),
    'stardust_icon_violet.svg': Buffer.from(svgViolet, 'utf-8'),
    'stardust_icon_8p.svg': Buffer.from(svg8p, 'utf-8'),

    'stardust_icon_gold.png': pngGold,
    'stardust_icon_cyan.png': pngCyan,
    'stardust_icon_violet.png': pngViolet,
    'stardust_icon_8p.png': png8p,
    'stardust_stream.png': pngStream,
    'stardust_burst.png': pngBurst,
    'stardust_counter_badge.png': pngBadge,
  };

  for (const [filename, buffer] of Object.entries(fileMap)) {
    for (const targetDir of targetDirs) {
      const outPath = path.join(targetDir, filename);
      fs.writeFileSync(outPath, buffer);
    }
    console.log(` ✅ ${filename} (${buffer.length} bytes) -> 3곳 동기화 완료`);
  }

  console.log('🎉 모든 별가루(별똥별) 에셋 11종 재생성 및 동기화 완료!');
}

main();
