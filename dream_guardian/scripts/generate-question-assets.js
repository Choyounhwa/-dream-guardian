/**
 * scripts/generate-question-assets.js
 *
 * Dream Guardian 문제 수식 배경 패널 및 답안 버튼 2종 UI 에셋 생성기 (Issue #290 / UI-ASSET-009)
 * Node.js 내장 zlib, fs, path를 사용하여 고품질 네온 사이버펑크 스타일의 PNG 바이너리를 직접 생성합니다.
 *
 * 생성 파일:
 * 1. public/assets/ui/question/question_board_bg.png (880x280, 상단 수식 배경 네온 패널)
 * 2. public/assets/ui/question/answer_btn_default.png (320x260, 답안 버튼 기본 상태)
 * 3. public/assets/ui/question/answer_btn_hover.png (320x260, 답안 버튼 호버/타겟팅 상태)
 * 4. public/assets/ui/question/answer_btn_selected.png (320x260, 답안 버튼 선택 확정 상태)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// SDF for rounded rectangle
function roundedRectSDF(px, py, rx, ry, rw, rh, rad) {
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const qx = Math.abs(px - cx) - (rw / 2 - rad);
  const qy = Math.abs(py - cy) - (rh / 2 - rad);
  const outerDist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const innerDist = Math.min(Math.max(qx, qy), 0);
  return outerDist + innerDist - rad;
}

// ─── 3. 에셋 생성 함수들 ───

/**
 * 1. question_board_bg.png (880 x 280)
 * 상단 수식 배경 네온 패널:
 * - 챔퍼/라운드 테두리 (반투명 사이버 다크 블루 베이스)
 * - 상단/외곽 시안 네온 림 라이트 (#28E6FF)
 * - 네 모서리 브래킷 악센트 및 사이버 격자 패턴
 */
function generateQuestionBoardBg() {
  const w = 880;
  const h = 280;
  const img = new RGBAImage(w, h);
  const pad = 12;
  const rad = 28;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = roundedRectSDF(x, y, pad, pad, w - pad * 2, h - pad * 2, rad);

      if (d <= 0) {
        // 내부 영역: 수직 그라디언트 + 은은한 비네팅
        const ny = y / h;
        const nx = (x - w / 2) / (w / 2);
        const centerDist = Math.sqrt(nx * nx * 0.3 + (ny - 0.5) * (ny - 0.5));
        
        // 베이스 다크 네이비: #0B132B -> #1C2541
        let r = 11 + ny * 16 - centerDist * 8;
        let g = 19 + ny * 22 - centerDist * 10;
        let b = 43 + ny * 35 - centerDist * 12;
        let a = 230 - centerDist * 30;

        // 미세 사이버 격자 도트 (16px 간격)
        if (x % 32 === 0 || y % 32 === 0) {
          r += 12;
          g += 20;
          b += 35;
          a = Math.min(255, a + 15);
        }

        img.setPixel(x, y, r, g, b, a);
      } else if (d < 10) {
        // 외곽 네온 글로우 (#28E6FF)
        const glow = Math.max(0, 1 - d / 10);
        img.setPixel(x, y, 40, 230, 255, glow * 210);
      }
    }
  }

  // 테두리 림 (border stroke: 3px)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = roundedRectSDF(x, y, pad, pad, w - pad * 2, h - pad * 2, rad);
      if (Math.abs(d) <= 2.2) {
        const ny = y / h;
        // 상단은 밝은 시안, 하단은 딥 시안
        const r = Math.round(40 + ny * 20);
        const g = Math.round(230 - ny * 30);
        const b = 255;
        img.setPixel(x, y, r, g, b, 245);
      }
    }
  }

  // 코너 브래킷 (L자형 사이버 악센트)
  const bracketLen = 36;
  const bracketThickness = 4;
  const corners = [
    { cx: pad + 8, cy: pad + 8, dx: 1, dy: 1 },
    { cx: w - pad - 8, cy: pad + 8, dx: -1, dy: 1 },
    { cx: pad + 8, cy: h - pad - 8, dx: 1, dy: -1 },
    { cx: w - pad - 8, cy: h - pad - 8, dx: -1, dy: -1 },
  ];

  for (const { cx, cy, dx, dy } of corners) {
    // 가로 막대
    for (let i = 0; i < bracketLen; i++) {
      for (let t = -bracketThickness / 2; t <= bracketThickness / 2; t++) {
        img.setPixel(cx + i * dx, cy + t, 255, 203, 77, 240);
      }
    }
    // 세로 막대
    for (let j = 0; j < bracketLen; j++) {
      for (let t = -bracketThickness / 2; t <= bracketThickness / 2; t++) {
        img.setPixel(cx + t, cy + j * dy, 255, 203, 77, 240);
      }
    }
  }

  return img;
}

/**
 * 2. answer_btn_default.png (320 x 260)
 * 답안 버튼 기본 상태:
 * - 둥근 직사각형 (r = 22)
 * - 반투명 다크 딥 블루 (#101830, a = 230)
 * - 미세 네온 시안/인디고 보더
 */
function generateAnswerBtnDefault() {
  const w = 320;
  const h = 260;
  const img = new RGBAImage(w, h);
  const pad = 10;
  const rad = 22;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = roundedRectSDF(x, y, pad, pad, w - pad * 2, h - pad * 2, rad);

      if (d <= 0) {
        const ny = y / h;
        const r = 16 + ny * 12;
        const g = 24 + ny * 16;
        const b = 48 + ny * 24;
        img.setPixel(x, y, r, g, b, 230);
      } else if (d < 8) {
        const glow = Math.max(0, 1 - d / 8);
        img.setPixel(x, y, 40, 200, 255, glow * 120);
      }
    }
  }

  // 테두리
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = roundedRectSDF(x, y, pad, pad, w - pad * 2, h - pad * 2, rad);
      if (Math.abs(d) <= 2.0) {
        img.setPixel(x, y, 60, 210, 255, 200);
      }
    }
  }

  return img;
}

/**
 * 3. answer_btn_hover.png (320 x 260)
 * 답안 버튼 호버/타겟팅 상태:
 * - 활성화된 밝은 시안/골드 네온 글로우 외곽
 * - 내부 조명 하이라이트 워시
 */
function generateAnswerBtnHover() {
  const w = 320;
  const h = 260;
  const img = new RGBAImage(w, h);
  const pad = 10;
  const rad = 22;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = roundedRectSDF(x, y, pad, pad, w - pad * 2, h - pad * 2, rad);

      if (d <= 0) {
        const ny = y / h;
        // 호버 시 밝은 블루 틴트 워시
        const r = 24 + ny * 16;
        const g = 45 + ny * 35;
        const b = 85 + ny * 45;
        img.setPixel(x, y, r, g, b, 240);
      } else if (d < 12) {
        const glow = Math.max(0, 1 - d / 12);
        img.setPixel(x, y, 40, 230, 255, glow * 220);
      }
    }
  }

  // 강력한 네온 림
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = roundedRectSDF(x, y, pad, pad, w - pad * 2, h - pad * 2, rad);
      if (Math.abs(d) <= 2.5) {
        img.setPixel(x, y, 100, 245, 255, 255);
      }
    }
  }

  return img;
}

/**
 * 4. answer_btn_selected.png (320 x 260)
 * 답안 버튼 선택 확정 상태:
 * - 비비드 에메랄드 그린 네온 테두리 (#00FF88)
 * - 내부 딥 에메랄드 틴트
 */
function generateAnswerBtnSelected() {
  const w = 320;
  const h = 260;
  const img = new RGBAImage(w, h);
  const pad = 10;
  const rad = 22;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = roundedRectSDF(x, y, pad, pad, w - pad * 2, h - pad * 2, rad);

      if (d <= 0) {
        const ny = y / h;
        // 에메랄드 다크 틴트
        const r = 10 + ny * 10;
        const g = 42 + ny * 30;
        const b = 28 + ny * 15;
        img.setPixel(x, y, r, g, b, 245);
      } else if (d < 14) {
        const glow = Math.max(0, 1 - d / 14);
        img.setPixel(x, y, 0, 255, 136, glow * 230);
      }
    }
  }

  // 강력한 에메랄드 테두리
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = roundedRectSDF(x, y, pad, pad, w - pad * 2, h - pad * 2, rad);
      if (Math.abs(d) <= 3.0) {
        img.setPixel(x, y, 0, 255, 136, 255);
      }
    }
  }

  return img;
}

// ─── 4. 실행 및 파일 저장 ───

export function generateAllQuestionAssets() {
  const outDir = path.resolve(__dirname, '../public/assets/ui/question');
  fs.mkdirSync(outDir, { recursive: true });

  const tasks = [
    { file: 'question_board_bg.png', fn: generateQuestionBoardBg },
    { file: 'answer_btn_default.png', fn: generateAnswerBtnDefault },
    { file: 'answer_btn_hover.png', fn: generateAnswerBtnHover },
    { file: 'answer_btn_selected.png', fn: generateAnswerBtnSelected },
  ];

  console.log('[generate-question-assets] Generating UI Question Assets into:', outDir);
  for (const { file, fn } of tasks) {
    const img = fn();
    const buf = img.toBuffer();
    const dest = path.join(outDir, file);
    fs.writeFileSync(dest, buf);
    console.log(`  ✓ Created: ${file} (${img.width}x${img.height}, ${buf.length} bytes)`);
  }
}

// 직접 실행 시 구동
if (process.argv[1] && process.argv[1].endsWith('generate-question-assets.js')) {
  generateAllQuestionAssets();
}
