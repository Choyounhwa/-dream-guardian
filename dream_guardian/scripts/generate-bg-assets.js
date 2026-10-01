/**
 * scripts/generate-bg-assets.js
 *
 * Dream Guardian 챕터별 및 메인 메뉴 배경 이미지 에셋 생성기 (Issue #272 / UI-ASSET-007)
 * Node.js 내장 zlib, fs, path만을 사용하여 1080x2160 규격의 고품질 PNG 바이너리 파일을 직접 생성합니다.
 *
 * 생성 파일 (총 6개, 1080 x 2160):
 * 1. public/assets/bg/menu_bg.png - 메인 메뉴 꿈나라 심해 우주 테마 (코스믹 인디고/스타더스트/성운)
 * 2. public/assets/bg/ch1_bg.png  - Ch.1 포겟 에메랄드 심해 산호 테마 (심해 청록/발광 산호/수중 기포)
 * 3. public/assets/bg/ch2_bg.png  - Ch.2 후다닥 사탕 바구니 별자리 숲 테마 (황혼 자수정/별자리 숲/유성우)
 * 4. public/assets/bg/ch3_bg.png  - Ch.3 뒤죽박죽 오르골 구름 서재 테마 (라벤더 페리윙클/오르골 태엽 링/구름 테라스)
 * 5. public/assets/bg/ch4_bg.png  - Ch.4 에라 색종이 크레용 사파리 테마 (석양 코랄 크림슨/크레용 컨페티/사파리 실루엣)
 * 6. public/assets/bg/ch5_bg.png  - Ch.5 나이트메어 은하 회전목마 어둠 대왕 테마 (옵시디언 보이드/진홍 소용돌이/회전목마 링)
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

  const idat = zlib.deflateSync(scanlines, { level: 6 });
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', iend),
  ]);
}

// ─── 2. 고성능 2D 소프트웨어 렌더러 ───

class FastCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4, 0);
  }

  fillVerticalGradient(colorStops) {
    // colorStops: [ { pos: 0.0, r, g, b }, { pos: 1.0, r, g, b } ]
    for (let y = 0; y < this.height; y++) {
      const t = y / (this.height - 1);
      // find stop interval
      let lower = colorStops[0];
      let upper = colorStops[colorStops.length - 1];
      for (let i = 0; i < colorStops.length - 1; i++) {
        if (t >= colorStops[i].pos && t <= colorStops[i + 1].pos) {
          lower = colorStops[i];
          upper = colorStops[i + 1];
          break;
        }
      }

      const span = upper.pos - lower.pos || 1;
      const factor = (t - lower.pos) / span;
      const r = Math.round(lower.r + (upper.r - lower.r) * factor);
      const g = Math.round(lower.g + (upper.g - lower.g) * factor);
      const b = Math.round(lower.b + (upper.b - lower.b) * factor);

      const rowStart = y * this.width * 4;
      for (let x = 0; x < this.width; x++) {
        const idx = rowStart + x * 4;
        this.data[idx] = r;
        this.data[idx + 1] = g;
        this.data[idx + 2] = b;
        this.data[idx + 3] = 255;
      }
    }
  }

  blendPixel(x, y, r, g, b, a) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    if (a <= 0) return;

    const idx = (y * this.width + x) * 4;
    const srcA = Math.min(1, a / 255);
    const dstA = this.data[idx + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) return;

    this.data[idx] = Math.round((r * srcA + this.data[idx] * dstA * (1 - srcA)) / outA);
    this.data[idx + 1] = Math.round((g * srcA + this.data[idx + 1] * dstA * (1 - srcA)) / outA);
    this.data[idx + 2] = Math.round((b * srcA + this.data[idx + 2] * dstA * (1 - srcA)) / outA);
    this.data[idx + 3] = Math.round(outA * 255);
  }

  drawRadialGlow(cx, cy, radius, r, g, b, maxAlpha = 180) {
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius));

    const rSq = radius * radius;
    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy;
      const dySq = dy * dy;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dSq = dx * dx + dySq;
        if (dSq < rSq) {
          const dist = Math.sqrt(dSq);
          const factor = 1 - dist / radius;
          // smooth cosine bell
          const alpha = maxAlpha * (factor * factor);
          this.blendPixel(x, y, r, g, b, alpha);
        }
      }
    }
  }

  drawStar(cx, cy, size, r, g, b, a = 255) {
    // Center bright dot
    this.blendPixel(cx, cy, 255, 255, 255, a);
    this.blendPixel(cx - 1, cy, r, g, b, a * 0.8);
    this.blendPixel(cx + 1, cy, r, g, b, a * 0.8);
    this.blendPixel(cx, cy - 1, r, g, b, a * 0.8);
    this.blendPixel(cx, cy + 1, r, g, b, a * 0.8);

    // 4-point light ray spikes
    for (let i = 2; i <= size; i++) {
      const rayAlpha = Math.max(0, a * (1 - i / size) * 0.7);
      this.blendPixel(cx - i, cy, r, g, b, rayAlpha);
      this.blendPixel(cx + i, cy, r, g, b, rayAlpha);
      this.blendPixel(cx, cy - i, r, g, b, rayAlpha);
      this.blendPixel(cx, cy + i, r, g, b, rayAlpha);
    }
  }

  drawCircle(cx, cy, radius, r, g, b, a) {
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius));
    const rSq = radius * radius;

    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy;
      const dySq = dy * dy;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        if (dx * dx + dySq <= rSq) {
          this.blendPixel(x, y, r, g, b, a);
        }
      }
    }
  }

  drawRing(cx, cy, radius, thickness, r, g, b, a) {
    const minX = Math.max(0, Math.floor(cx - radius - thickness));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius + thickness));
    const minY = Math.max(0, Math.floor(cy - radius - thickness));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius + thickness));

    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const diff = Math.abs(dist - radius);
        if (diff <= thickness) {
          const factor = 1 - diff / thickness;
          this.blendPixel(x, y, r, g, b, a * factor);
        }
      }
    }
  }

  drawLine(x1, y1, x2, y2, r, g, b, a, width = 1) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const steps = Math.ceil(len);
    for (let i = 0; i <= steps; i++) {
      const px = x1 + (dx * i) / steps;
      const py = y1 + (dy * i) / steps;
      for (let w = -Math.floor(width / 2); w <= Math.floor(width / 2); w++) {
        this.blendPixel(px, py + w, r, g, b, a);
      }
    }
  }

  toBuffer() {
    return encodePNG(this.width, this.height, this.data);
  }
}

// ─── 3. 의사 난수 생성기 (결정론적 시드) ───

function createRng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ─── 4. 테마별 6개 배경 생성 ───

/**
 * 1. menu_bg.png (1080x2160, 메인 메뉴 꿈나라 심해 우주 테마)
 */
function generateMenuBg() {
  const canvas = new FastCanvas(1080, 2160);
  const rng = createRng(1001);

  // 딥 코스믹 네이비/인디고 수직 그라데이션
  canvas.fillVerticalGradient([
    { pos: 0.0, r: 8, g: 8, b: 24 },     // 심연 보이드
    { pos: 0.25, r: 12, g: 14, b: 44 },  // 밤하늘 인디고
    { pos: 0.55, r: 18, g: 24, b: 58 },  // 코스믹 미드나잇
    { pos: 0.85, r: 14, g: 32, b: 64 },  // 심해 드림 블루
    { pos: 1.0, r: 8, g: 18, b: 38 },    // 하단 심연
  ]);

  // 대형 성운 앰비언트 글로우
  canvas.drawRadialGlow(540, 600, 480, 40, 230, 255, 60);  // 시안 코스믹 중심
  canvas.drawRadialGlow(320, 1100, 360, 200, 137, 255, 45); // 바이올렛 성운
  canvas.drawRadialGlow(760, 1400, 400, 30, 180, 220, 50);  // 아쿠아 하단 성운
  canvas.drawRadialGlow(540, 1850, 420, 150, 80, 220, 40);  // 하단 몽환 글로우

  // 꿈나라 별자리 링 & 기하학 패턴
  canvas.drawRing(540, 580, 240, 1.8, 40, 230, 255, 70);
  canvas.drawRing(540, 580, 360, 1.2, 200, 137, 255, 40);

  // 별자리 라인
  const stars = [];
  for (let i = 0; i < 40; i++) {
    stars.push({
      x: 80 + rng() * 920,
      y: 120 + rng() * 1920,
      size: 2 + Math.floor(rng() * 4),
    });
  }
  for (let i = 0; i < 18; i++) {
    const s1 = stars[Math.floor(rng() * stars.length)];
    const s2 = stars[Math.floor(rng() * stars.length)];
    const dist = Math.hypot(s1.x - s2.x, s1.y - s2.y);
    if (dist > 50 && dist < 220) {
      canvas.drawLine(s1.x, s1.y, s2.x, s2.y, 100, 220, 255, 35, 1);
    }
  }

  // 반짝이는 별무리 (120개)
  for (let i = 0; i < 120; i++) {
    const sx = 40 + rng() * 1000;
    const sy = 40 + rng() * 2080;
    const size = 1 + Math.floor(rng() * 4);
    const bright = rng() > 0.3;
    const r = bright ? 220 : 140;
    const g = bright ? 245 : 200;
    const b = 255;
    canvas.drawStar(sx, sy, size, r, g, b, 140 + rng() * 100);
  }

  return canvas.toBuffer();
}

/**
 * 2. ch1_bg.png (1080x2160, 에메랄드 심해 산호 테마)
 */
function generateCh1Bg() {
  const canvas = new FastCanvas(1080, 2160);
  const rng = createRng(2002);

  // 에메랄드 딥 오션 수직 그라데이션
  canvas.fillVerticalGradient([
    { pos: 0.0, r: 3, g: 14, b: 24 },    // 심해 상층부 딥 틸
    { pos: 0.28, r: 6, g: 38, b: 46 },   // 에메랄드 심해 층
    { pos: 0.58, r: 10, g: 58, b: 62 },  // 발광 산호 수심
    { pos: 0.85, r: 4, g: 32, b: 42 },   // 산호 바닥
    { pos: 1.0, r: 2, g: 18, b: 26 },    // 해저 심연
  ]);

  // 심해 수중 광원 및 생체 발광 글로우
  canvas.drawRadialGlow(540, 520, 440, 20, 230, 180, 75);  // 에메랄드 메인 광원
  canvas.drawRadialGlow(280, 1300, 380, 40, 200, 240, 55); // 시안 해양 글로우
  canvas.drawRadialGlow(800, 1550, 360, 10, 190, 150, 60); // 녹색 해초 글로우

  // 수중 광선 (빛줄기 스트림)
  for (let i = 0; i < 6; i++) {
    const xTop = 300 + i * 80 + rng() * 40;
    const xBot = 100 + i * 160 + rng() * 60;
    canvas.drawLine(xTop, 0, xBot, 1800, 40, 240, 210, 22, 2);
  }

  // 발광 기포 & 플랑크톤 (140개)
  for (let i = 0; i < 140; i++) {
    const bx = 50 + rng() * 980;
    const by = 80 + rng() * 2000;
    const radius = 2 + Math.floor(rng() * 5);
    const alpha = 120 + rng() * 110;
    canvas.drawRadialGlow(bx, by, radius * 2, 80, 255, 220, alpha * 0.6);
    canvas.drawCircle(bx, by, radius, 180, 255, 240, alpha);
  }

  // 하단 심해 산호 실루엣 기둥
  for (let i = 0; i < 14; i++) {
    const cx = 60 + i * 75 + rng() * 20;
    const h = 200 + rng() * 300;
    canvas.drawLine(cx, 2160, cx, 2160 - h, 5, 25, 30, 140, 12);
    canvas.drawRadialGlow(cx, 2160 - h, 28, 40, 230, 180, 90);
  }

  return canvas.toBuffer();
}

/**
 * 3. ch2_bg.png (1080x2160, 사탕 바구니 별자리 숲 테마)
 */
function generateCh2Bg() {
  const canvas = new FastCanvas(1080, 2160);
  const rng = createRng(3003);

  // 황혼 자수정 / 캔디 마젠타 앰버 그라데이션
  canvas.fillVerticalGradient([
    { pos: 0.0, r: 24, g: 10, b: 36 },   // 자수정 밤하늘
    { pos: 0.28, r: 48, g: 20, b: 54 },  // 황혼 핑크 퍼플
    { pos: 0.58, r: 68, g: 32, b: 48 },  // 캔디 앰버 황혼
    { pos: 0.82, r: 42, g: 18, b: 38 },  // 숲 지평선 어스름
    { pos: 1.0, r: 18, g: 8, b: 24 },    // 숲 바닥
  ]);

  // 따뜻한 별자리 & 캔디 성운 글로우
  canvas.drawRadialGlow(540, 520, 460, 255, 180, 60, 65);  // 황금 별빛 중심
  canvas.drawRadialGlow(300, 950, 360, 255, 110, 180, 50); // 캔디 핑크 글로우
  canvas.drawRadialGlow(780, 1350, 380, 200, 140, 255, 45); // 바이올렛 숲 구름

  // 유성우 궤적선 (빠른 번개새 테마 반영)
  for (let i = 0; i < 8; i++) {
    const startX = 200 + rng() * 700;
    const startY = 150 + rng() * 800;
    const len = 120 + rng() * 160;
    canvas.drawLine(startX, startY, startX + len * 0.7, startY + len, 255, 220, 120, 75, 2);
    canvas.drawStar(startX + len * 0.7, startY + len, 4, 255, 250, 180, 220);
  }

  // 캔디 별무리 & 별자리 (130개)
  for (let i = 0; i < 130; i++) {
    const sx = 40 + rng() * 1000;
    const sy = 60 + rng() * 1700;
    const size = 1 + Math.floor(rng() * 4);
    const colorType = rng();
    const r = colorType > 0.5 ? 255 : 255;
    const g = colorType > 0.5 ? 220 : 160;
    const b = colorType > 0.5 ? 120 : 220;
    canvas.drawStar(sx, sy, size, r, g, b, 150 + rng() * 95);
  }

  // 하단 별자리 숲 나무 실루엣
  for (let i = 0; i < 18; i++) {
    const tx = 40 + i * 60 + rng() * 20;
    const th = 150 + rng() * 220;
    canvas.drawLine(tx, 2160, tx, 2160 - th, 15, 6, 20, 180, 8);
    canvas.drawStar(tx, 2160 - th, 3, 255, 200, 100, 140);
  }

  return canvas.toBuffer();
}

/**
 * 4. ch3_bg.png (1080x2160, 오르골 구름 서재 테마)
 */
function generateCh3Bg() {
  const canvas = new FastCanvas(1080, 2160);
  const rng = createRng(4004);

  // 라벤더 / 페리윙클 / 구름 서재 그라데이션
  canvas.fillVerticalGradient([
    { pos: 0.0, r: 16, g: 14, b: 42 },   // 딥 라벤더 밤
    { pos: 0.28, r: 28, g: 26, b: 68 },  // 페리윙클 성운
    { pos: 0.58, r: 42, g: 40, b: 86 },  // 구름 서재 미드나잇
    { pos: 0.85, r: 26, g: 24, b: 58 },  // 구름 테라스 층
    { pos: 1.0, r: 12, g: 10, b: 32 },   // 심연 베이스
  ]);

  // 신비로운 오르골 음악 광원
  canvas.drawRadialGlow(540, 520, 480, 180, 160, 255, 70); // 라벤더 코어
  canvas.drawRadialGlow(760, 1100, 360, 240, 200, 255, 50); // 프리즘 광선
  canvas.drawRadialGlow(300, 1450, 400, 120, 160, 255, 45); // 블루 페리윙클

  // 오르골 태엽 동심원 링 (음악 상자 기어 메타포)
  canvas.drawRing(540, 520, 180, 1.5, 200, 180, 255, 80);
  canvas.drawRing(540, 520, 300, 1.2, 170, 150, 240, 50);
  canvas.drawRing(540, 520, 420, 1.0, 140, 130, 210, 35);

  // 음표 & 크리스털 별무리 (120개)
  for (let i = 0; i < 120; i++) {
    const sx = 50 + rng() * 980;
    const sy = 60 + rng() * 1950;
    const size = 1 + Math.floor(rng() * 4);
    canvas.drawStar(sx, sy, size, 220, 210, 255, 140 + rng() * 100);
  }

  // 몽환적인 수평 구름 테라스 레이어
  for (let l = 0; l < 5; l++) {
    const cy = 1350 + l * 150;
    canvas.drawRadialGlow(540 + (l % 2 === 0 ? -120 : 120), cy, 450, 140, 150, 220, 30);
  }

  return canvas.toBuffer();
}

/**
 * 5. ch4_bg.png (1080x2160, 색종이 크레용 사파리 테마)
 */
function generateCh4Bg() {
  const canvas = new FastCanvas(1080, 2160);
  const rng = createRng(5005);

  // 황혼 사파리 선셋 / 크림슨 코랄 그라데이션
  canvas.fillVerticalGradient([
    { pos: 0.0, r: 38, g: 12, b: 30 },   // 사파리 황혼 상층
    { pos: 0.28, r: 76, g: 26, b: 36 },  // 선셋 코랄 크림슨
    { pos: 0.58, r: 96, g: 44, b: 32 },  // 황혼 앰버 엠버
    { pos: 0.82, r: 52, g: 22, b: 24 },  // 사파리 지평선
    { pos: 1.0, r: 22, g: 8, b: 14 },    // 대지 실루엣
  ]);

  // 타오르는 황혼 태양 & 사파리 앰비언트 글로우
  canvas.drawRadialGlow(540, 520, 480, 255, 120, 80, 80);  // 황혼 코랄 코어
  canvas.drawRadialGlow(320, 1200, 360, 255, 180, 60, 55); // 앰버 광원
  canvas.drawRadialGlow(760, 1500, 400, 220, 80, 120, 50); // 마젠타 어스름

  // 크레용 색종이 컨페티 파티클 (160개 다채로운 색상)
  const confettiPalette = [
    { r: 255, g: 90, b: 120 },  // 크레용 코랄
    { r: 255, g: 200, b: 70 },  // 크레용 옐로
    { r: 80, g: 220, b: 220 },  // 크레용 터콰이즈
    { r: 200, g: 140, b: 255 }, // 크레용 라벤더
    { r: 255, g: 150, b: 200 }, // 크레용 핑크
  ];

  for (let i = 0; i < 160; i++) {
    const cx = 40 + rng() * 1000;
    const cy = 60 + rng() * 2000;
    const p = confettiPalette[Math.floor(rng() * confettiPalette.length)];
    const size = 2 + Math.floor(rng() * 4);
    canvas.drawStar(cx, cy, size, p.r, p.g, p.b, 160 + rng() * 85);
  }

  // 지평선 아카시아 나무 & 사파리 지평선 실루엣
  canvas.drawLine(0, 1920, 1080, 1920, 18, 6, 12, 160, 4);
  for (let i = 0; i < 8; i++) {
    const ax = 120 + i * 130 + rng() * 40;
    const ah = 100 + rng() * 140;
    canvas.drawLine(ax, 1920, ax, 1920 - ah, 16, 6, 10, 190, 8);
    canvas.drawRadialGlow(ax, 1920 - ah, 45, 255, 130, 70, 40);
  }

  return canvas.toBuffer();
}

/**
 * 6. ch5_bg.png (1080x2160, 은하 회전목마 어둠 대왕 테마)
 */
function generateCh5Bg() {
  const canvas = new FastCanvas(1080, 2160);
  const rng = createRng(6006);

  // 옵시디언 보이드 / 심연 진홍 수직 그라데이션
  canvas.fillVerticalGradient([
    { pos: 0.0, r: 10, g: 4, b: 18 },    // 옵시디언 나이트메어
    { pos: 0.28, r: 28, g: 8, b: 32 },   // 심연 퍼플
    { pos: 0.58, r: 46, g: 12, b: 28 },  // 어둠 대왕 진홍
    { pos: 0.85, r: 22, g: 6, b: 20 },   // 나이트메어 심연
    { pos: 1.0, r: 6, g: 2, b: 10 },     // 절대 암흑 보이드
  ]);

  // 대왕의 어둠 보이드 & 불길한 진홍/보라 코스믹 글로우
  canvas.drawRadialGlow(540, 520, 480, 220, 40, 80, 85);  // 불길한 진홍 코어
  canvas.drawRadialGlow(540, 520, 280, 160, 20, 180, 70); // 다크 퍼플 안쪽 구역
  canvas.drawRadialGlow(280, 1250, 420, 180, 30, 90, 55); // 좌측 진홍 소용돌이
  canvas.drawRadialGlow(800, 1450, 400, 120, 20, 160, 50); // 우측 암흑 오라

  // 은하 회전목마(Galactic Carousel) 궤도 링 & 소용돌이
  canvas.drawRing(540, 520, 220, 2.0, 255, 60, 100, 80);
  canvas.drawRing(540, 520, 360, 1.5, 200, 50, 180, 55);
  canvas.drawRing(540, 520, 500, 1.2, 140, 30, 120, 35);

  // 회전목마 스포크 라인 (8방향 방사선)
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const xEnd = 540 + Math.cos(angle) * 480;
    const yEnd = 520 + Math.sin(angle) * 480;
    canvas.drawLine(540, 520, xEnd, yEnd, 220, 60, 110, 40, 1);
  }

  // 어둠의 파편 & 붕괴된 별가루 (140개)
  for (let i = 0; i < 140; i++) {
    const sx = 40 + rng() * 1000;
    const sy = 50 + rng() * 2050;
    const size = 1 + Math.floor(rng() * 4);
    const bright = rng() > 0.4;
    const r = bright ? 255 : 180;
    const g = bright ? 80 : 30;
    const b = bright ? 120 : 90;
    canvas.drawStar(sx, sy, size, r, g, b, 140 + rng() * 110);
  }

  return canvas.toBuffer();
}

// ─── 5. 실행 및 파일 저장 ───

function main() {
  const outDir = path.resolve(process.cwd(), 'public/assets/bg');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
    console.log(`[generate-bg-assets] Created directory: ${outDir}`);
  }

  const tasks = [
    { name: 'menu_bg.png', fn: generateMenuBg, desc: '메인 메뉴 꿈나라 심해 우주 테마' },
    { name: 'ch1_bg.png', fn: generateCh1Bg, desc: 'Ch.1 포겟 에메랄드 심해 산호 테마' },
    { name: 'ch2_bg.png', fn: generateCh2Bg, desc: 'Ch.2 후다닥 사탕 바구니 별자리 숲 테마' },
    { name: 'ch3_bg.png', fn: generateCh3Bg, desc: 'Ch.3 뒤죽박죽 오르골 구름 서재 테마' },
    { name: 'ch4_bg.png', fn: generateCh4Bg, desc: 'Ch.4 에라 색종이 크레용 사파리 테마' },
    { name: 'ch5_bg.png', fn: generateCh5Bg, desc: 'Ch.5 나이트메어 은하 회전목마 어둠 대왕 테마' },
  ];

  console.log(`[generate-bg-assets] 총 ${tasks.length}개 배경 이미지 에셋 생성 시작 (1080x2160)...`);
  const startTime = Date.now();

  for (const task of tasks) {
    const t0 = Date.now();
    const buf = task.fn();
    const filePath = path.join(outDir, task.name);
    fs.writeFileSync(filePath, buf);
    const elapsed = Date.now() - t0;
    console.log(`  ✓ ${task.name} (${(buf.length / 1024).toFixed(1)} KB, ${elapsed}ms) - ${task.desc}`);
  }

  console.log(`[generate-bg-assets] 완료! (소요 시간: ${Date.now() - startTime}ms)`);
}

main();
