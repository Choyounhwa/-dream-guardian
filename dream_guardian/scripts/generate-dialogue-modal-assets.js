/**
 * scripts/generate-dialogue-modal-assets.js
 *
 * Dream Guardian 인게임 대사창 및 설정/일시정지 모달 이미지 에셋 생성기 (Issue #293 / UI-ASSET-012)
 * Node.js 내장 zlib, fs, path만을 사용하여 표준 규격의 유효한 PNG 바이너리 파일을 직접 생성합니다.
 *
 * 생성 파일:
 *  1. public/assets/ui/dialogue/dialogue_box_bg.png (960x140, 대사창 네온 패널)
 *  2. public/assets/ui/dialogue/speaker_badge_kkebi.png (80x80, 깨비 황금 엠블럼)
 *  3. public/assets/ui/dialogue/speaker_badge_boss.png (80x80, 보스 크림슨/바이올렛 엠블럼)
 *  4. public/assets/ui/modal/btn_resume.png (680x130, 에메랄드 네온 재개 액션 버튼)
 *  5. public/assets/ui/modal/btn_quit.png (680x130, 크림슨/코랄 네온 종료 액션 버튼)
 *  6. public/assets/ui/modal/btn_close_x.png (60x60, 원형 닫기 ✕ 버튼)
 *  7. public/assets/ui/modal/icon_camera.png (64x64, 네온 시안 카메라 아이콘)
 *  8. public/assets/ui/modal/icon_sound.png (64x64, 네온 골드 사운드 스피커 아이콘)
 *  9. public/assets/ui/modal/icon_skeleton.png (64x64, 네온 바이올렛 스켈레톤 인체 아이콘)
 * 10. public/assets/ui/modal/icon_fullscreen.png (64x64, 네온 민트 전체화면 아이콘)
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

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0; // Filter: None
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

// ─── 2. 소프트웨어 래스터라이저 (RGBAImage) ───

class RGBAImage {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4, 0);
  }

  setPixel(x, y, r, g, b, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;

    if (a >= 255) {
      this.data[idx] = r;
      this.data[idx + 1] = g;
      this.data[idx + 2] = b;
      this.data[idx + 3] = 255;
    } else if (a > 0) {
      const srcA = a / 255;
      const dstA = this.data[idx + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA > 0) {
        this.data[idx] = Math.round((r * srcA + this.data[idx] * dstA * (1 - srcA)) / outA);
        this.data[idx + 1] = Math.round((g * srcA + this.data[idx + 1] * dstA * (1 - srcA)) / outA);
        this.data[idx + 2] = Math.round((b * srcA + this.data[idx + 2] * dstA * (1 - srcA)) / outA);
        this.data[idx + 3] = Math.round(outA * 255);
      }
    }
  }

  fillRect(x, y, w, h, r, g, b, a = 255) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        this.setPixel(px, py, r, g, b, a);
      }
    }
  }

  fillGradientV(x, y, w, h, cTop, cBottom) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));
    for (let py = y0; py < y1; py++) {
      const t = h <= 1 ? 0 : (py - y) / h;
      const r = Math.round(cTop[0] + (cBottom[0] - cTop[0]) * t);
      const g = Math.round(cTop[1] + (cBottom[1] - cTop[1]) * t);
      const b = Math.round(cTop[2] + (cBottom[2] - cTop[2]) * t);
      const a = Math.round(cTop[3] + (cBottom[3] - cTop[3]) * t);
      for (let px = x0; px < x1; px++) {
        this.setPixel(px, py, r, g, b, a);
      }
    }
  }

  fillRoundRect(x, y, w, h, radius, r, g, b, a = 255) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));

    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        let inside = false;
        const left = x + radius;
        const right = x + w - radius;
        const top = y + radius;
        const bottom = y + h - radius;

        if (px >= left && px <= right && py >= y && py <= y + h) {
          inside = true;
        } else if (py >= top && py <= bottom && px >= x && px <= x + w) {
          inside = true;
        } else {
          const cx = px < left ? left : right;
          const cy = py < top ? top : bottom;
          const dx = px - cx;
          const dy = py - cy;
          if (dx * dx + dy * dy <= radius * radius) {
            inside = true;
          }
        }

        if (inside) {
          this.setPixel(px, py, r, g, b, a);
        }
      }
    }
  }

  strokeRoundRect(x, y, w, h, radius, strokeW, r, g, b, a = 255) {
    const x0 = Math.max(0, Math.floor(x - strokeW));
    const y0 = Math.max(0, Math.floor(y - strokeW));
    const x1 = Math.min(this.width, Math.ceil(x + w + strokeW));
    const y1 = Math.min(this.height, Math.ceil(y + h + strokeW));

    const halfStroke = strokeW / 2;
    const rOuter = radius + halfStroke;
    const rInner = Math.max(0, radius - halfStroke);

    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const left = x + radius;
        const right = x + w - radius;
        const top = y + radius;
        const bottom = y + h - radius;

        let dist = 0;
        if (px >= left && px <= right) {
          dist = py < top ? top - py : (py > bottom ? py - bottom : 0);
        } else if (py >= top && py <= bottom) {
          dist = px < left ? left - px : (px > right ? px - right : 0);
        } else {
          const cx = px < left ? left : right;
          const cy = py < top ? top : bottom;
          const dx = px - cx;
          const dy = py - cy;
          dist = Math.sqrt(dx * dx + dy * dy);
        }

        if (dist >= rInner && dist <= rOuter) {
          this.setPixel(px, py, r, g, b, a);
        }
      }
    }
  }

  fillCircle(cx, cy, radius, r, g, b, a = 255) {
    const x0 = Math.max(0, Math.floor(cx - radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(this.width, Math.ceil(cx + radius));
    const y1 = Math.min(this.height, Math.ceil(cy + radius));
    const r2 = radius * radius;

    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const dx = px - cx;
        const dy = py - cy;
        if (dx * dx + dy * dy <= r2) {
          this.setPixel(px, py, r, g, b, a);
        }
      }
    }
  }

  strokeCircle(cx, cy, radius, strokeW, r, g, b, a = 255) {
    const rOuter = radius + strokeW / 2;
    const rInner = Math.max(0, radius - strokeW / 2);
    const rOuter2 = rOuter * rOuter;
    const rInner2 = rInner * rInner;

    const x0 = Math.max(0, Math.floor(cx - rOuter));
    const y0 = Math.max(0, Math.floor(cy - rOuter));
    const x1 = Math.min(this.width, Math.ceil(cx + rOuter));
    const y1 = Math.min(this.height, Math.ceil(cy + rOuter));

    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const dx = px - cx;
        const dy = py - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rInner2 && d2 <= rOuter2) {
          this.setPixel(px, py, r, g, b, a);
        }
      }
    }
  }

  drawLine(x0, y0, x1, y1, strokeW, r, g, b, a = 255) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const steps = Math.ceil(len * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = x0 + dx * t;
      const cy = y0 + dy * t;
      this.fillCircle(cx, cy, strokeW / 2, r, g, b, a);
    }
  }

  toPNG() {
    return encodePNG(this.width, this.height, this.data);
  }
}

// ─── 3. 에셋 생성 함수들 ───

// 1. 대사창 패널 (960x140)
function generateDialogueBoxBg() {
  const img = new RGBAImage(960, 140);

  // 다크 사이버 글래스 바디 (코너 반경 18)
  img.fillRoundRect(8, 8, 944, 124, 18, 12, 18, 36, 235);
  // 상단 은은한 하이라이트 레이어
  img.fillGradientV(12, 12, 936, 40, [30, 48, 85, 90], [12, 18, 36, 0]);

  // 외부 글로우 림
  img.strokeRoundRect(7, 7, 946, 126, 19, 5, 40, 230, 255, 60);
  // 사이버 네온 골드/시안 테두리 (2.5px)
  img.strokeRoundRect(8, 8, 944, 124, 18, 3, 255, 203, 77, 240);

  // 상단 좌우 테크 데코 라인
  img.fillRect(36, 12, 180, 2, 40, 230, 255, 220);
  img.fillRect(744, 12, 180, 2, 40, 230, 255, 220);

  return img.toPNG();
}

// 2. 깨비 화자 엠블럼 (80x80)
function generateSpeakerBadgeKkebi() {
  const img = new RGBAImage(80, 80);

  // 원형 배경
  img.fillCircle(40, 40, 36, 32, 24, 12, 230);
  // 외부 골드 글로우
  img.strokeCircle(40, 40, 36, 4, 255, 203, 77, 90);
  // 골드 림
  img.strokeCircle(40, 40, 34, 2.5, 255, 203, 77, 240);

  // 깨비 뿔 심볼 (양쪽 뿔)
  img.drawLine(32, 34, 24, 20, 3.5, 255, 215, 104, 255);
  img.drawLine(48, 34, 56, 20, 3.5, 255, 215, 104, 255);

  // 중앙 꼬마 도깨비 얼굴/반짝임 원
  img.fillCircle(40, 44, 16, 255, 180, 40, 240);
  // 귀여운 눈 두 개
  img.fillCircle(35, 42, 2.5, 30, 20, 10, 255);
  img.fillCircle(45, 42, 2.5, 30, 20, 10, 255);
  // 미소
  img.drawLine(36, 50, 44, 50, 2, 30, 20, 10, 255);

  return img.toPNG();
}

// 3. 보스 화자 엠블럼 (80x80)
function generateSpeakerBadgeBoss() {
  const img = new RGBAImage(80, 80);

  // 원형 배경
  img.fillCircle(40, 40, 36, 35, 12, 28, 235);
  // 외부 크림슨 글로우
  img.strokeCircle(40, 40, 36, 4, 255, 51, 102, 110);
  // 크림슨/바이올렛 테두리
  img.strokeCircle(40, 40, 34, 2.5, 255, 60, 100, 240);

  // 보스 왕관 / 뿔 심볼
  img.drawLine(40, 20, 40, 36, 4, 255, 70, 110, 255);
  img.drawLine(26, 25, 36, 38, 3.5, 200, 50, 220, 255);
  img.drawLine(54, 25, 44, 38, 3.5, 200, 50, 220, 255);

  // 날카로운 눈
  img.drawLine(30, 46, 37, 48, 3, 255, 220, 80, 255);
  img.drawLine(50, 46, 43, 48, 3, 255, 220, 80, 255);

  return img.toPNG();
}

// 4. 재개 액션 버튼 (680x130)
function generateBtnResume() {
  const img = new RGBAImage(680, 130);

  // 에메랄드/시안 사이버 그라디언트 바디
  img.fillRoundRect(8, 8, 664, 114, 22, 12, 40, 32, 235);
  img.fillGradientV(12, 12, 656, 50, [32, 90, 70, 120], [12, 40, 32, 0]);

  // 글로우 림
  img.strokeRoundRect(7, 7, 666, 116, 23, 5, 52, 211, 153, 90);
  // 네온 민트 그린 테두리
  img.strokeRoundRect(8, 8, 664, 114, 22, 3, 52, 211, 153, 240);

  // 좌측 재생(Resume) 삼각형 아이콘
  const px = 70;
  const py = 65;
  for (let i = 0; i <= 24; i++) {
    const halfH = Math.round(18 * (1 - i / 24));
    img.drawLine(px - 12 + i, py - halfH, px - 12 + i, py + halfH, 1.5, 52, 211, 153, 255);
  }

  // 상하 데코 테크 라인
  img.fillRect(130, 18, 120, 2, 52, 211, 153, 160);
  img.fillRect(450, 110, 120, 2, 52, 211, 153, 160);

  return img.toPNG();
}

// 5. 종료 액션 버튼 (680x130)
function generateBtnQuit() {
  const img = new RGBAImage(680, 130);

  // 크림슨/코랄 다크 바디
  img.fillRoundRect(8, 8, 664, 114, 22, 42, 16, 22, 235);
  img.fillGradientV(12, 12, 656, 50, [90, 32, 44, 120], [42, 16, 22, 0]);

  // 글로우 림
  img.strokeRoundRect(7, 7, 666, 116, 23, 5, 248, 113, 113, 90);
  // 네온 코랄 테두리
  img.strokeRoundRect(8, 8, 664, 114, 22, 3, 248, 113, 113, 240);

  // 좌측 나가기(Quit/Door) 아이콘
  const px = 70;
  const py = 65;
  // 문 프레임
  img.strokeRoundRect(px - 18, py - 20, 22, 40, 4, 2.5, 248, 113, 113, 255);
  // 화살표
  img.drawLine(px - 6, py, px + 18, py, 3, 255, 160, 160, 255);
  img.drawLine(px + 10, py - 8, px + 18, py, 3, 255, 160, 160, 255);
  img.drawLine(px + 10, py + 8, px + 18, py, 3, 255, 160, 160, 255);

  // 상하 데코 테크 라인
  img.fillRect(130, 18, 120, 2, 248, 113, 113, 160);
  img.fillRect(450, 110, 120, 2, 248, 113, 113, 160);

  return img.toPNG();
}

// 6. 원형 닫기 ✕ 버튼 (60x60)
function generateBtnCloseX() {
  const img = new RGBAImage(60, 60);

  // 원형 배경
  img.fillCircle(30, 30, 26, 28, 34, 52, 220);
  // 은은한 외곽선
  img.strokeCircle(30, 30, 26, 2, 200, 220, 255, 180);

  // ✕ 마크
  img.drawLine(20, 20, 40, 40, 3, 255, 255, 255, 255);
  img.drawLine(40, 20, 20, 40, 3, 255, 255, 255, 255);

  return img.toPNG();
}

// 7. 카메라 아이콘 (64x64)
function generateIconCamera() {
  const img = new RGBAImage(64, 64);

  // 카메라 몸체 (네온 시안)
  img.fillRoundRect(10, 22, 44, 30, 6, 20, 40, 60, 180);
  img.strokeRoundRect(10, 22, 44, 30, 6, 2.5, 40, 230, 255, 255);
  // 상단 셔터 범프
  img.fillRoundRect(22, 16, 20, 8, 3, 40, 230, 255, 255);
  // 중앙 렌즈 원
  img.fillCircle(32, 37, 10, 15, 30, 45, 230);
  img.strokeCircle(32, 37, 10, 2.5, 40, 230, 255, 255);
  img.fillCircle(35, 34, 3, 255, 255, 255, 240); // 렌즈 반사광

  return img.toPNG();
}

// 8. 사운드 아이콘 (64x64)
function generateIconSound() {
  const img = new RGBAImage(64, 64);

  // 스피커 바디
  img.fillRect(12, 26, 10, 12, 255, 203, 77, 255);
  // 스피커 콘
  for (let y = 18; y <= 46; y++) {
    const t = Math.abs(y - 32) / 14;
    const xEnd = Math.round(22 + (1 - t) * 12);
    img.drawLine(22, y, xEnd, y, 1.5, 255, 203, 77, 255);
  }

  // 음파 호선 1
  img.strokeCircle(30, 32, 12, 2, 255, 203, 77, 230);
  // 음파 호선 2
  img.strokeCircle(30, 32, 18, 2.2, 255, 220, 110, 210);

  // 왼쪽 스피커 영역 바깥 지우기 (스피커 오른쪽 반원만 남기기)
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 35; x++) {
      if (x < 12 || (x >= 22 && Math.abs(y - 32) > 14) || (x >= 12 && x < 22 && Math.abs(y - 32) > 6)) {
        const idx = (y * 64 + x) * 4;
        img.data[idx + 3] = 0;
      }
    }
  }

  return img.toPNG();
}

// 9. 스켈레톤 아이콘 (64x64)
function generateIconSkeleton() {
  const img = new RGBAImage(64, 64);

  // 머리 관절 원
  img.fillCircle(32, 16, 6, 200, 137, 255, 255);
  img.strokeCircle(32, 16, 6, 1.5, 255, 255, 255, 220);

  // 척추
  img.drawLine(32, 22, 32, 38, 3, 200, 137, 255, 255);

  // 양팔
  img.drawLine(32, 26, 18, 34, 2.5, 200, 137, 255, 255);
  img.drawLine(32, 26, 46, 34, 2.5, 200, 137, 255, 255);

  // 골반 다이아몬드
  img.fillCircle(32, 40, 3.5, 255, 203, 77, 255);

  // 양다리
  img.drawLine(32, 40, 22, 54, 2.5, 200, 137, 255, 255);
  img.drawLine(32, 40, 42, 54, 2.5, 200, 137, 255, 255);

  // 관절 포인트
  img.fillCircle(18, 34, 2.5, 40, 230, 255, 255);
  img.fillCircle(46, 34, 2.5, 40, 230, 255, 255);
  img.fillCircle(22, 54, 2.5, 40, 230, 255, 255);
  img.fillCircle(42, 54, 2.5, 40, 230, 255, 255);

  return img.toPNG();
}

// 10. 전체화면 아이콘 (64x64)
function generateIconFullscreen() {
  const img = new RGBAImage(64, 64);

  const strokeW = 3;
  const cornerLen = 12;

  // 좌상단 코너
  img.drawLine(14, 14, 14 + cornerLen, 14, strokeW, 52, 211, 153, 255);
  img.drawLine(14, 14, 14, 14 + cornerLen, strokeW, 52, 211, 153, 255);

  // 우상단 코너
  img.drawLine(50, 14, 50 - cornerLen, 14, strokeW, 52, 211, 153, 255);
  img.drawLine(50, 14, 50, 14 + cornerLen, strokeW, 52, 211, 153, 255);

  // 좌하단 코너
  img.drawLine(14, 50, 14 + cornerLen, 50, strokeW, 52, 211, 153, 255);
  img.drawLine(14, 50, 14, 50 - cornerLen, strokeW, 52, 211, 153, 255);

  // 우하단 코너
  img.drawLine(50, 50, 50 - cornerLen, 50, strokeW, 52, 211, 153, 255);
  img.drawLine(50, 50, 50, 50 - cornerLen, strokeW, 52, 211, 153, 255);

  return img.toPNG();
}

// ─── 4. 실행 및 파일 저장 ───

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function generateAllDialogueModalAssets() {
  const dialogueDir = path.resolve(process.cwd(), 'public/assets/ui/dialogue');
  const modalDir = path.resolve(process.cwd(), 'public/assets/ui/modal');

  ensureDir(dialogueDir);
  ensureDir(modalDir);

  const assets = [
    { dir: dialogueDir, file: 'dialogue_box_bg.png', buf: generateDialogueBoxBg() },
    { dir: dialogueDir, file: 'speaker_badge_kkebi.png', buf: generateSpeakerBadgeKkebi() },
    { dir: dialogueDir, file: 'speaker_badge_boss.png', buf: generateSpeakerBadgeBoss() },
    { dir: modalDir, file: 'btn_resume.png', buf: generateBtnResume() },
    { dir: modalDir, file: 'btn_quit.png', buf: generateBtnQuit() },
    { dir: modalDir, file: 'btn_close_x.png', buf: generateBtnCloseX() },
    { dir: modalDir, file: 'icon_camera.png', buf: generateIconCamera() },
    { dir: modalDir, file: 'icon_sound.png', buf: generateIconSound() },
    { dir: modalDir, file: 'icon_skeleton.png', buf: generateIconSkeleton() },
    { dir: modalDir, file: 'icon_fullscreen.png', buf: generateIconFullscreen() },
  ];

  for (const asset of assets) {
    const fullPath = path.join(asset.dir, asset.file);
    fs.writeFileSync(fullPath, asset.buf);
    console.log(`[Asset Generator] Generated: ${path.relative(process.cwd(), fullPath)} (${asset.buf.length} bytes)`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('generate-dialogue-modal-assets.js')) {
  generateAllDialogueModalAssets();
}
