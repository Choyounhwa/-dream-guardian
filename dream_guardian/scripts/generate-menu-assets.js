/**
 * scripts/generate-menu-assets.js
 *
 * Dream Guardian UI 메뉴 화면 이미지 에셋 생성기 (Issue #266 / UI-ASSET-001)
 * Node.js 내장 zlib, fs, path만을 사용하여 표준 규격의 유효한 PNG 바이너리 파일을 직접 생성합니다.
 *
 * 생성 파일:
 * 1. public/assets/ui/menu/title_bg.png (1080x300, 네온 사이버/드림 스타일 메인 타이틀 배너)
 * 2. public/assets/ui/menu/chapter_card_frame.png (360x380, 반투명 네온 테두리 챕터 카드 프레임)
 * 3. public/assets/ui/menu/lock_icon.png (96x96, 골드/네온 자물쇠 아이콘)
 * 4. public/assets/ui/menu/star_full.png (64x64, 빛나는 황금 별 아이콘)
 * 5. public/assets/ui/menu/star_empty.png (64x64, 반투명 회색 외곽선 별 아이콘)
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

  toBuffer() {
    return encodePNG(this.width, this.height, this.data);
  }
}

// ─── 3. 에셋 생성 함수들 ───

/**
 * 1. title_bg.png (1080 x 300)
 * 네온 사이버 / 드림 스타일 메인 타이틀 배너
 */
function generateTitleBg() {
  const img = new RGBAImage(1080, 300);
  const w = 1080;
  const h = 300;

  for (let y = 0; y < h; y++) {
    const ny = y / h;
    for (let x = 0; x < w; x++) {
      const nx = x / w;

      // 중앙 강조 타원형 앰비언트 글로우
      const dx = (x - w / 2) / (w * 0.45);
      const dy = (y - h / 2) / (h * 0.45);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const centerFactor = Math.max(0, 1 - Math.min(1, dist));

      // 베이스 그라데이션: 상단 딥 퍼플(#1a0a38) -> 하단 네이비 사이언(#08142b)
      let r = 26 * (1 - ny) + 8 * ny;
      let g = 10 * (1 - ny) + 20 * ny;
      let b = 56 * (1 - ny) + 48 * ny;
      let a = 210 + centerFactor * 40;

      // 중앙 네온 사이언/마젠타 앰비언트 광원
      r += centerFactor * 45;
      g += centerFactor * 25;
      b += centerFactor * 70;

      // 미세 사이버 그리드 수평선 효과
      if (y % 18 === 0) {
        r += 12;
        g += 18;
        b += 30;
      }

      // 상단 & 하단 네온 경계 라인 (글로우 바)
      if (y >= 10 && y <= 16) {
        // 상단 사이언 네온 라인 (#28E6FF)
        const lineDist = Math.abs(y - 13);
        const glow = Math.max(0, 1 - lineDist / 3.5) * (1 - Math.abs(nx - 0.5) * 1.5);
        if (glow > 0) {
          r = r * (1 - glow) + 40 * glow;
          g = g * (1 - glow) + 230 * glow;
          b = b * (1 - glow) + 255 * glow;
          a = Math.max(a, 240);
        }
      }
      if (y >= h - 18 && y <= h - 12) {
        // 하단 마젠타 네온 라인 (#C889FF)
        const lineDist = Math.abs(y - (h - 15));
        const glow = Math.max(0, 1 - lineDist / 3.5) * (1 - Math.abs(nx - 0.5) * 1.5);
        if (glow > 0) {
          r = r * (1 - glow) + 200 * glow;
          g = g * (1 - glow) + 137 * glow;
          b = b * (1 - glow) + 255 * glow;
          a = Math.max(a, 240);
        }
      }

      // 좌우 끝단 페이드아웃 (반투명 라운드 느낌)
      const edgeDist = Math.min(x, w - 1 - x);
      if (edgeDist < 60) {
        a *= edgeDist / 60;
      }

      img.setPixel(x, y, r, g, b, Math.round(a));
    }
  }

  return img.toBuffer();
}

/**
 * 2. chapter_card_frame.png (360 x 380)
 * 챕터 카드 외곽 프레임 (라운드 코너 24px, 반투명 네온 사이언 테두리)
 */
function generateChapterCardFrame() {
  const img = new RGBAImage(360, 380);
  const w = 360;
  const h = 380;
  const radius = 24;
  const strokeW = 3.5;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 둥근 사각형 거리 계산 (SDF)
      const qx = Math.abs(x - w / 2) - (w / 2 - radius);
      const qy = Math.abs(y - h / 2) - (h / 2 - radius);
      const outsideDist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const insideDist = Math.min(Math.max(qx, qy), 0);
      const dist = outsideDist + insideDist - radius;

      if (dist > 2.0) {
        // 완전 외곽 영역 (투명)
        continue;
      }

      // 외곽 앤티앨리어싱
      let edgeAlpha = 1.0;
      if (dist > 0.0) {
        edgeAlpha = Math.max(0, 1 - dist / 2.0);
      }

      if (dist <= 0 && dist >= -strokeW) {
        // 네온 테두리: 상단 사이언(#28E6FF) -> 하단 바이올렛(#C889FF)
        const ny = y / h;
        const r = 40 * (1 - ny) + 200 * ny;
        const g = 230 * (1 - ny) + 137 * ny;
        const b = 255;
        const a = 240 * edgeAlpha;
        img.setPixel(x, y, r, g, b, a);
      } else if (dist < -strokeW && dist >= -strokeW - 2.5) {
        // 부드러운 내부 글로우 라인
        const innerGlow = 1 - Math.abs(dist + strokeW + 1.25) / 1.5;
        const r = 40 + innerGlow * 80;
        const g = 180 + innerGlow * 60;
        const b = 255;
        const a = (120 + innerGlow * 80) * edgeAlpha;
        img.setPixel(x, y, r, g, b, a);
      } else if (dist < -strokeW - 2.5) {
        // 내부 반투명 다크 배경 (rgba(18, 24, 44, 0.85))
        const ny = y / h;
        const r = 16 + ny * 10;
        const g = 22 + ny * 8;
        const b = 42 + ny * 15;
        const a = 215 * edgeAlpha;
        img.setPixel(x, y, r, g, b, a);
      }
    }
  }

  // 모서리 테크 악센트 마크 (사이버 사각 점)
  const accents = [
    [radius, radius],
    [w - radius, radius],
    [radius, h - radius],
    [w - radius, h - radius],
  ];
  for (const [ax, ay] of accents) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 3) {
          img.setPixel(ax + dx, ay + dy, 40, 230, 255, 230);
        }
      }
    }
  }

  return img.toBuffer();
}

/**
 * 3. lock_icon.png (96 x 96)
 * 골드/네온 자물쇠 아이콘
 */
function generateLockIcon() {
  const img = new RGBAImage(96, 96);
  const cx = 48;

  // 자물쇠 샤클(아치형 고리): 중심 (48, 38), 외경 r=22, 내경 r=13, 위쪽 반원 + 직선 하강
  // 자물쇠 몸체: x: 22..74 (폭 52), y: 44..84 (높이 40), 둥근 모서리
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 96; x++) {
      // 1) 샤클 (위쪽 고리)
      let inShackle = false;
      if (y >= 16 && y <= 48) {
        const dx = x - cx;
        const dy = y - 36;
        if (y <= 36) {
          const d = Math.hypot(dx, dy);
          if (d >= 13 && d <= 21) inShackle = true;
        } else {
          // 기둥 부분
          if ((Math.abs(dx) >= 13 && Math.abs(dx) <= 21)) inShackle = true;
        }
      }

      if (inShackle) {
        // 골드 메탈릭 그라데이션
        const ny = (y - 16) / 32;
        const r = 255;
        const g = 210 - ny * 40;
        const b = 77 + ny * 20;
        img.setPixel(x, y, r, g, b, 250);
      }

      // 2) 몸체 (아래쪽 박스)
      const bx = 22;
      const by = 44;
      const bw = 52;
      const bh = 40;
      const br = 8;

      const qx = Math.abs(x - (bx + bw / 2)) - (bw / 2 - br);
      const qy = Math.abs(y - (by + bh / 2)) - (bh / 2 - br);
      const bodyDist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - br;

      if (bodyDist <= 0) {
        // 골드 메탈 그라데이션: 상단 밝은 골드(#FFE58F) -> 하단 딥 골드(#D49200)
        const ny = (y - by) / bh;
        let r = 255 * (1 - ny) + 212 * ny;
        let g = 229 * (1 - ny) + 146 * ny;
        let b = 143 * (1 - ny) + 10 * ny;

        // 몸체 테두리 림 라이트
        if (bodyDist >= -2) {
          r = Math.min(255, r + 40);
          g = Math.min(255, g + 40);
          b = Math.min(255, b + 60);
        }

        // 3) 키홀 (열쇠 구멍): 원 y: 58, r=5 + 하단 사다리꼴
        const kx = x - cx;
        const ky = y - 58;
        const inKeyCircle = (kx * kx + ky * ky) <= 25;
        const inKeySlot = (y >= 58 && y <= 72 && Math.abs(kx) <= (3 - (y - 58) * 0.1));

        if (inKeyCircle || inKeySlot) {
          // 키홀 내부 어두운 홈
          img.setPixel(x, y, 40, 30, 20, 240);
        } else {
          img.setPixel(x, y, Math.round(r), Math.round(g), Math.round(b), 255);
        }
      }
    }
  }

  return img.toBuffer();
}

/**
 * 5포인트 별 폴리곤 SDF 계산
 */
function starSDF(x, y, cx, cy, rOut, rIn) {
  // 별 꼭짓점 10개 좌표 생성 (위쪽 끝점 각도: -pi/2)
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }

  // Winding number / Ray casting point in polygon
  let inside = false;
  for (let i = 0, j = 9; i < 10; j = i++) {
    const xi = pts[i][0], yi = pts[i][1];
    const xj = pts[j][0], yj = pts[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  // 최소 선분 거리
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

/**
 * 4. star_full.png (64 x 64)
 * 빛나는 황금 별 아이콘
 */
function generateStarFull() {
  const img = new RGBAImage(64, 64);
  const cx = 32;
  const cy = 33;
  const rOut = 26;
  const rIn = 11;

  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      // 2x2 안티앨리어싱 수퍼샘플링
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
        const normDist = avgDist / rOut; // 0 (중심) ~ 1 (꼭짓점)

        // 중심 화이트 골드(#FFFDF0) -> 중간 황금빛(#FFCB4D) -> 외곽 오렌지 골드(#FF9E1B)
        let r, g, b;
        if (normDist < 0.4) {
          const t = normDist / 0.4;
          r = 255;
          g = 253 * (1 - t) + 203 * t;
          b = 240 * (1 - t) + 77 * t;
        } else {
          const t = (normDist - 0.4) / 0.6;
          r = 255;
          g = 203 * (1 - t) + 158 * t;
          b = 77 * (1 - t) + 27 * t;
        }

        img.setPixel(x, y, r, g, b, Math.round(255 * coverage));
      }
    }
  }

  return img.toBuffer();
}

/**
 * 5. star_empty.png (64 x 64)
 * 반투명 회색 외곽선 별 아이콘
 */
function generateStarEmpty() {
  const img = new RGBAImage(64, 64);
  const cx = 32;
  const cy = 33;
  const rOut = 26;
  const rIn = 11;
  const strokeW = 2.5;

  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      let strokeCount = 0;
      let insideCount = 0;

      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const px = x + (sx + 0.5) * 0.5;
          const py = y + (sy + 0.5) * 0.5;
          const d = starSDF(px, py, cx, cy, rOut, rIn);
          if (Math.abs(d) <= strokeW / 2) {
            strokeCount++;
          }
          if (d <= 0) {
            insideCount++;
          }
        }
      }

      if (strokeCount > 0) {
        // 외곽선: 은은한 메탈릭 실버/그레이 (#9EA6BA, a=220)
        const alpha = (strokeCount / 4) * 220;
        img.setPixel(x, y, 158, 166, 186, Math.round(alpha));
      } else if (insideCount > 0) {
        // 내부: 은은한 반투명 다크 채움 (a=35)
        const alpha = (insideCount / 4) * 35;
        img.setPixel(x, y, 100, 110, 130, Math.round(alpha));
      }
    }
  }

  return img.toBuffer();
}

// ─── 4. 실행 및 파일 기록 ───

export function generateAllMenuAssets(outDir) {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const assets = [
    { name: 'title_bg.png', buf: generateTitleBg() },
    { name: 'chapter_card_frame.png', buf: generateChapterCardFrame() },
    { name: 'lock_icon.png', buf: generateLockIcon() },
    { name: 'star_full.png', buf: generateStarFull() },
    { name: 'star_empty.png', buf: generateStarEmpty() },
  ];

  for (const asset of assets) {
    const dest = path.join(outDir, asset.name);
    fs.writeFileSync(dest, asset.buf);
    console.log(`[generate-menu-assets] Created: ${dest} (${asset.buf.length} bytes)`);
  }
}

// 직접 스크립트 실행 시
const defaultDir = path.resolve(process.cwd(), 'public/assets/ui/menu');
generateAllMenuAssets(defaultDir);
