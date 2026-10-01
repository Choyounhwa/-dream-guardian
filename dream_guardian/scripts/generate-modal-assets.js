/**
 * scripts/generate-modal-assets.js
 *
 * Dream Guardian UI 하단 바 / 설정 / 일시정지 모달 이미지 에셋 생성기 (Issue #269 / UI-ASSET-004)
 * Node.js 내장 zlib, fs, path만을 사용하여 표준 규격의 유효한 PNG 바이너리 파일을 직접 생성합니다.
 *
 * 생성 파일:
 *  1. public/assets/ui/bottombar/bar_bg.png (1080x200, 네온 골드 림 포함 다크 네이비 배경)
 *  2. public/assets/ui/bottombar/settings_icon.png (140x140, 네온 사이버 시안 기어 아이콘 투명 PNG)
 *  3. public/assets/ui/bottombar/mana_frame.png (560x50, 네온 바이올렛/핑크 마나 바 외곽 프레임 투명 PNG)
 *  4. public/assets/ui/bottombar/mana_fill.png (560x50, 바이올렛→마젠타 핑크 그라디언트 채움 텍스처 PNG)
 *  5. public/assets/ui/settings/modal_bg.png (800x1200, 네온 사이버 다크 글래스 모달 카드 배경 투명 PNG)
 *  6. public/assets/ui/settings/toggle_on.png (100x50, ON 스위치 버튼 PNG)
 *  7. public/assets/ui/settings/toggle_off.png (100x50, OFF 스위치 버튼 PNG)
 *  8. public/assets/ui/pause/modal_bg.png (800x740, 네온 골드 림 일시정지 모달 카드 배경 투명 PNG)
 *  9. public/assets/ui/pause/resume_btn.png (600x120, 에메랄드/그린 네온 Resume 버튼 PNG)
 * 10. public/assets/ui/pause/quit_btn.png (600x120, 크림슨/오렌지 네온 Quit 버튼 PNG)
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

// ─── 3. 기하학 및 드로잉 유틸리티 ───

function roundBoxSDF(px, py, bx, by, bw, bh, r) {
  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  const hx = bw / 2 - r;
  const hy = bh / 2 - r;
  const dx = Math.abs(px - cx) - hx;
  const dy = Math.abs(py - cy) - hy;

  if (dx > 0 && dy > 0) {
    return Math.hypot(dx, dy) - r;
  }
  return Math.max(dx, dy) - r;
}

// ─── 4. 에셋 생성 함수들 ───

/**
 * 1. bar_bg.png (1080x200)
 * 하단 바 배경: 상단 네온 골드 림 (#FFCB4D) + 다크 네이비 반투명 사이버 글래스
 */
function generateBarBg() {
  const w = 1080;
  const h = 200;
  const img = new RGBAImage(w, h);

  for (let y = 0; y < h; y++) {
    const yRatio = y / h;
    for (let x = 0; x < w; x++) {
      // 상단 0~2px 네온 골드 라인 & 글로우
      if (y < 3) {
        img.setPixel(x, y, 255, 203, 77, 255); // #FFCB4D
      } else if (y < 8) {
        const glow = 1 - (y - 3) / 5;
        img.setPixel(x, y, 255, 210, 100, Math.round(180 * glow));
      } else {
        // 다크 네이비 배경 (#0A0E1A -> #060912)
        const r = Math.round(10 * (1 - yRatio * 0.4));
        const g = Math.round(14 * (1 - yRatio * 0.4));
        const b = Math.round(26 * (1 - yRatio * 0.4));
        const a = 238; // ~0.93 opacity
        img.setPixel(x, y, r, g, b, a);

        // 미세한 테크 그리드 패턴 (격자 라인)
        if (x % 60 === 0 || (y - 8) % 40 === 0) {
          img.setPixel(x, y, 40, 60, 100, 30);
        }
      }
    }
  }

  return img.toBuffer();
}

/**
 * 2. settings_icon.png (140x140)
 * 사이버 시안 네온 기어 아이콘 투명 PNG
 */
function generateSettingsIcon() {
  const w = 140;
  const h = 140;
  const img = new RGBAImage(w, h);

  const cx = w / 2;
  const cy = h / 2;

  // 외곽 라운드 박스
  const boxR = 20;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dBox = roundBoxSDF(x, y, 4, 4, w - 8, h - 8, boxR);
      if (dBox <= 0) {
        // 내부 반투명 배경
        img.setPixel(x, y, 40, 230, 255, 30);
        // 테두리
        if (dBox >= -3) {
          img.setPixel(x, y, 40, 230, 255, 230);
        }
      }
    }
  }

  // 기어 아이콘 그리기
  const gearOuterR = 38;
  const gearInnerR = 26;
  const gearHoleR = 14;
  const teethCount = 8;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      // 중심 홀
      if (dist <= gearHoleR) {
        // 홀 내부 투명/배경 유지
        continue;
      }

      // 기어 이빨 변조
      const toothAngle = (angle + Math.PI) * (teethCount / (2 * Math.PI));
      const toothFraction = toothAngle - Math.floor(toothAngle);
      const isTooth = toothFraction > 0.25 && toothFraction < 0.75;
      const effectiveR = isTooth ? gearOuterR : gearInnerR;

      if (dist <= effectiveR) {
        // 기어 본체 (시안 그라디언트 + 메탈릭 하이라이트)
        const shine = Math.max(0, Math.cos(angle - Math.PI / 4));
        const r = Math.round(40 + shine * 160);
        const g = Math.round(230 + shine * 25);
        const b = 255;
        img.setPixel(x, y, r, g, b, 245);
      }
    }
  }

  return img.toBuffer();
}

/**
 * 3. mana_frame.png (560x50)
 * 네온 바이올렛/핑크 마나 바 외곽 프레임 투명 PNG
 */
function generateManaFrame() {
  const w = 560;
  const h = 50;
  const img = new RGBAImage(w, h);

  const radius = 14;
  const borderW = 3;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dOuter = roundBoxSDF(x, y, 1, 1, w - 2, h - 2, radius);
      const dInner = roundBoxSDF(x, y, 1 + borderW, 1 + borderW, w - 2 - borderW * 2, h - 2 - borderW * 2, radius - borderW);

      if (dOuter <= 0) {
        if (dInner > 0) {
          // 프레임 테두리 영역: 바이올렛→마젠타 핑크 그라디언트
          const xRatio = x / w;
          const r = Math.round(200 * (1 - xRatio) + 255 * xRatio);
          const g = Math.round(137 * (1 - xRatio) + 101 * xRatio);
          const b = Math.round(255 * (1 - xRatio) + 195 * xRatio);

          // 상단 하이라이트 림
          const isTop = y <= 3;
          const a = isTop ? 255 : 220;
          img.setPixel(x, y, r, g, b, a);
        } else {
          // 중앙 영역 투명
          img.setPixel(x, y, 0, 0, 0, 0);
        }
      }
    }
  }

  return img.toBuffer();
}

/**
 * 4. mana_fill.png (560x50)
 * 바이올렛→마젠타 핑크 그라디언트 채움 텍스처 PNG
 */
function generateManaFill() {
  const w = 560;
  const h = 50;
  const img = new RGBAImage(w, h);

  const radius = 14;

  for (let y = 0; y < h; y++) {
    const yDistFromCenter = Math.abs(y - h / 2) / (h / 2);
    for (let x = 0; x < w; x++) {
      const d = roundBoxSDF(x, y, 0, 0, w, h, radius);
      if (d <= 0) {
        const xRatio = x / w;
        // #C889FF (200, 137, 255) -> #FF65C3 (255, 101, 195)
        let r = Math.round(200 * (1 - xRatio) + 255 * xRatio);
        let g = Math.round(137 * (1 - xRatio) + 101 * xRatio);
        let b = Math.round(255 * (1 - xRatio) + 195 * xRatio);

        // 중앙 광택 하이라이트 (수평 빔)
        if (yDistFromCenter < 0.4) {
          const shine = (1 - yDistFromCenter / 0.4) * 0.4;
          r = Math.min(255, Math.round(r + 255 * shine));
          g = Math.min(255, Math.round(g + 200 * shine));
          b = Math.min(255, Math.round(b + 255 * shine));
        }

        img.setPixel(x, y, r, g, b, 240);
      }
    }
  }

  return img.toBuffer();
}

/**
 * 5. settings/modal_bg.png (800x1200)
 * 네온 사이버 다크 글래스 모달 카드 배경 투명 PNG
 */
function generateSettingsModalBg() {
  const w = 800;
  const h = 1200;
  const img = new RGBAImage(w, h);

  const radius = 28;
  const borderW = 3.5;

  for (let y = 0; y < h; y++) {
    const yRatio = y / h;
    for (let x = 0; x < w; x++) {
      const dOuter = roundBoxSDF(x, y, 6, 6, w - 12, h - 12, radius);
      if (dOuter <= 0) {
        const dInner = roundBoxSDF(x, y, 6 + borderW, 6 + borderW, w - 12 - borderW * 2, h - 12 - borderW * 2, radius - borderW);
        if (dInner > 0) {
          // 외곽 네온 시안 테두리 (#28E6FF)
          img.setPixel(x, y, 40, 230, 255, 250);
        } else {
          // 다크 네이비 글래스 본체 (rgba(15, 20, 36, 0.98))
          const r = Math.round(15 * (1 - yRatio * 0.2));
          const g = Math.round(20 * (1 - yRatio * 0.2));
          const b = Math.round(36 * (1 - yRatio * 0.2));
          img.setPixel(x, y, r, g, b, 250);

          // 상단 헤더 분리 가이드 라인 (y: 110 근처)
          if (y === 110) {
            img.setPixel(x, y, 40, 230, 255, 120);
          }
        }
      } else if (dOuter <= 6) {
        // 외곽 은은한 네온 시안 글로우
        const glow = 1 - dOuter / 6;
        img.setPixel(x, y, 40, 230, 255, Math.round(100 * glow));
      }
    }
  }

  return img.toBuffer();
}

/**
 * 6. settings/toggle_on.png (100x50)
 * ON 스위치 버튼 PNG (시안 활성 캡슐 + 우측 화이트 노브)
 */
function generateToggleOn() {
  const w = 100;
  const h = 50;
  const img = new RGBAImage(w, h);

  const radius = 24;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = roundBoxSDF(x, y, 1, 1, w - 2, h - 2, radius);
      if (d <= 0) {
        // 배경: 에메랄드/시안 네온 그라디언트
        const r = 40;
        const g = 230;
        const b = 255;
        img.setPixel(x, y, r, g, b, 230);
      }
    }
  }

  // 우측 원형 노브 (cx: 74, cy: 25, r: 18)
  const kx = 74;
  const ky = 25;
  const kr = 18;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = Math.hypot(x - kx, y - ky);
      if (dist <= kr) {
        const factor = 1 - dist / kr;
        const col = Math.round(230 + 25 * factor);
        img.setPixel(x, y, col, col, col, 255);
      }
    }
  }

  return img.toBuffer();
}

/**
 * 7. settings/toggle_off.png (100x50)
 * OFF 스위치 버튼 PNG (다크 그레이 비활성 캡슐 + 좌측 노브)
 */
function generateToggleOff() {
  const w = 100;
  const h = 50;
  const img = new RGBAImage(w, h);

  const radius = 24;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = roundBoxSDF(x, y, 1, 1, w - 2, h - 2, radius);
      if (d <= 0) {
        // 배경: 짙은 회색 / 다크 슬레이트
        img.setPixel(x, y, 50, 60, 80, 220);
        if (d >= -2) {
          img.setPixel(x, y, 90, 105, 130, 255);
        }
      }
    }
  }

  // 좌측 원형 노브 (cx: 26, cy: 25, r: 18)
  const kx = 26;
  const ky = 25;
  const kr = 18;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = Math.hypot(x - kx, y - ky);
      if (dist <= kr) {
        const factor = 1 - dist / kr;
        const col = Math.round(150 + 40 * factor);
        img.setPixel(x, y, col, col, col + 10, 255);
      }
    }
  }

  return img.toBuffer();
}

/**
 * 8. pause/modal_bg.png (800x740)
 * 네온 골드 림 일시정지 모달 카드 배경 투명 PNG
 */
function generatePauseModalBg() {
  const w = 800;
  const h = 740;
  const img = new RGBAImage(w, h);

  const radius = 28;
  const borderW = 3.5;

  for (let y = 0; y < h; y++) {
    const yRatio = y / h;
    for (let x = 0; x < w; x++) {
      const dOuter = roundBoxSDF(x, y, 6, 6, w - 12, h - 12, radius);
      if (dOuter <= 0) {
        const dInner = roundBoxSDF(x, y, 6 + borderW, 6 + borderW, w - 12 - borderW * 2, h - 12 - borderW * 2, radius - borderW);
        if (dInner > 0) {
          // 외곽 네온 골드 테두리 (#FFCB4D)
          img.setPixel(x, y, 255, 203, 77, 255);
        } else {
          // 다크 네이비 카드 본체 (rgba(15, 20, 36, 0.98))
          const r = Math.round(15 * (1 - yRatio * 0.2));
          const g = Math.round(20 * (1 - yRatio * 0.2));
          const b = Math.round(36 * (1 - yRatio * 0.2));
          img.setPixel(x, y, r, g, b, 250);
        }
      } else if (dOuter <= 6) {
        // 외곽 골드 글로우
        const glow = 1 - dOuter / 6;
        img.setPixel(x, y, 255, 203, 77, Math.round(120 * glow));
      }
    }
  }

  return img.toBuffer();
}

/**
 * 9. pause/resume_btn.png (600x120)
 * 에메랄드/그린 네온 Resume 버튼 PNG
 */
function generateResumeBtn() {
  const w = 600;
  const h = 120;
  const img = new RGBAImage(w, h);

  const radius = 20;
  const borderW = 3.5;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dOuter = roundBoxSDF(x, y, 4, 4, w - 8, h - 8, radius);
      if (dOuter <= 0) {
        const dInner = roundBoxSDF(x, y, 4 + borderW, 4 + borderW, w - 8 - borderW * 2, h - 8 - borderW * 2, radius - borderW);
        if (dInner > 0) {
          // 테두리: 에메랄드 / 시안 그린 (#4DFFAA)
          img.setPixel(x, y, 77, 255, 170, 255);
        } else {
          // 내부: 어두운 에메랄드 반투명 베이스
          img.setPixel(x, y, 16, 50, 40, 220);
        }
      } else if (dOuter <= 4) {
        const glow = 1 - dOuter / 4;
        img.setPixel(x, y, 77, 255, 170, Math.round(100 * glow));
      }
    }
  }

  // 재생 화살표 아이콘 (▶) (cx: 80, cy: 60)
  const icx = 80;
  const icy = 60;
  const size = 18;
  for (let y = icy - size; y <= icy + size; y++) {
    for (let x = icx - size * 0.7; x <= icx + size * 0.9; x++) {
      const dy = Math.abs(y - icy);
      const maxDx = (1 - dy / size) * (size * 1.6);
      if (x - (icx - size * 0.7) <= maxDx && x >= icx - size * 0.7) {
        img.setPixel(x, y, 255, 255, 255, 240);
      }
    }
  }

  return img.toBuffer();
}

/**
 * 10. pause/quit_btn.png (600x120)
 * 크림슨/오렌지 네온 Quit 버튼 PNG
 */
function generateQuitBtn() {
  const w = 600;
  const h = 120;
  const img = new RGBAImage(w, h);

  const radius = 20;
  const borderW = 3.5;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dOuter = roundBoxSDF(x, y, 4, 4, w - 8, h - 8, radius);
      if (dOuter <= 0) {
        const dInner = roundBoxSDF(x, y, 4 + borderW, 4 + borderW, w - 8 - borderW * 2, h - 8 - borderW * 2, radius - borderW);
        if (dInner > 0) {
          // 테두리: 코랄 오렌지 / 크림슨 (#FF865E / #FF4444)
          img.setPixel(x, y, 255, 134, 94, 255);
        } else {
          // 내부: 어두운 크림슨 반투명 베이스
          img.setPixel(x, y, 50, 20, 24, 220);
        }
      } else if (dOuter <= 4) {
        const glow = 1 - dOuter / 4;
        img.setPixel(x, y, 255, 134, 94, Math.round(100 * glow));
      }
    }
  }

  // 홈 아이콘 (🏠 지붕 + 본체) (cx: 80, cy: 60)
  const icx = 80;
  const icy = 60;
  for (let y = icy - 18; y <= icy + 16; y++) {
    for (let x = icx - 18; x <= icx + 18; x++) {
      const dy = y - (icy - 6);
      if (dy < 0) {
        // 지붕 삼각
        const roofH = 12;
        const progress = (y - (icy - 18)) / roofH;
        if (Math.abs(x - icx) <= progress * 18) {
          img.setPixel(x, y, 255, 255, 255, 240);
        }
      } else {
        // 벽체 사각 (문 제외)
        if (Math.abs(x - icx) <= 12 && y <= icy + 14) {
          const isDoor = Math.abs(x - icx) <= 4 && y >= icy + 2;
          if (!isDoor) {
            img.setPixel(x, y, 255, 255, 255, 240);
          }
        }
      }
    }
  }

  return img.toBuffer();
}

// ─── 5. 메인 실행기 ───

function main() {
  const root = process.cwd();
  const bottomBarDir = path.resolve(root, 'public/assets/ui/bottombar');
  const settingsDir = path.resolve(root, 'public/assets/ui/settings');
  const pauseDir = path.resolve(root, 'public/assets/ui/pause');

  fs.mkdirSync(bottomBarDir, { recursive: true });
  fs.mkdirSync(settingsDir, { recursive: true });
  fs.mkdirSync(pauseDir, { recursive: true });

  const tasks = [
    { dir: bottomBarDir, name: 'bar_bg.png', fn: generateBarBg },
    { dir: bottomBarDir, name: 'settings_icon.png', fn: generateSettingsIcon },
    { dir: bottomBarDir, name: 'mana_frame.png', fn: generateManaFrame },
    { dir: bottomBarDir, name: 'mana_fill.png', fn: generateManaFill },

    { dir: settingsDir, name: 'modal_bg.png', fn: generateSettingsModalBg },
    { dir: settingsDir, name: 'toggle_on.png', fn: generateToggleOn },
    { dir: settingsDir, name: 'toggle_off.png', fn: generateToggleOff },

    { dir: pauseDir, name: 'modal_bg.png', fn: generatePauseModalBg },
    { dir: pauseDir, name: 'resume_btn.png', fn: generateResumeBtn },
    { dir: pauseDir, name: 'quit_btn.png', fn: generateQuitBtn },
  ];

  console.log(`[generate-modal-assets] Starting generation of ${tasks.length} UI assets...`);

  for (const t of tasks) {
    const dest = path.join(t.dir, t.name);
    const buf = t.fn();
    fs.writeFileSync(dest, buf);
    console.log(`  ✓ Generated: ${path.relative(root, dest)} (${buf.length} bytes)`);
  }

  console.log('[generate-modal-assets] All assets successfully generated!');
}

main();
