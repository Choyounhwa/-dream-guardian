/**
 * scripts/generate-hud-assets.js
 *
 * Dream Guardian UI HUD 이미지 에셋 생성기 (Issue #267 / UI-ASSET-002)
 * Node.js 내장 zlib, fs, path만을 사용하여 표준 규격의 유효한 PNG 바이너리 파일을 직접 생성합니다.
 *
 * 생성 파일:
 * 1. public/assets/ui/hud/hp_bar_frame.png (320x48, 네온 사이버 프레임 테두리 투명 PNG)
 * 2. public/assets/ui/hud/hp_bar_fill_player.png (320x48, 시안→에메랄드 그라디언트 텍스처 PNG)
 * 3. public/assets/ui/hud/hp_bar_fill_boss.png (320x48, 진홍→주황 그라디언트 텍스처 PNG)
 * 4. public/assets/ui/hud/combo_icon.png (48x48, 네온 화염/스파크 불꽃 아이콘 투명 PNG)
 * 5. public/assets/ui/hud/boss_nameplate.png (400x60, 반투명 네온 다크 명패 배경 투명 PNG)
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
 * 1. hp_bar_frame.png (320 x 48)
 * 네온 사이버 프레임 테두리 투명 PNG
 * 외곽: 사이버 네온 메탈 프레임 (모서리 각면 베벨 + 네온 림 라이트 + 코너 브래킷)
 * 내부: 투명 (게이지 채움 텍스처 표시 영역)
 */
function generateHpBarFrame() {
  const w = 320;
  const h = 48;
  const img = new RGBAImage(w, h);

  const borderW = 4;
  const chamfer = 7;

  // Signed distance function for chamfered box
  // x: [0, w-1], y: [0, h-1]
  function boxSDF(px, py, bx, by, bw, bh, ch) {
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    const dx = Math.abs(px - cx) - (bw / 2 - ch);
    const dy = Math.abs(py - cy) - (bh / 2 - ch);

    if (dx > 0 && dy > 0) {
      // Corner chamfer plane distance: (dx + dy - ch * sqrt(2) / 2)
      return (dx + dy - ch);
    }
    return Math.max(dx - ch, dy - ch);
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dOuter = boxSDF(x, y, 0, 0, w, h, chamfer);
      const dInner = boxSDF(x, y, borderW, borderW, w - borderW * 2, h - borderW * 2, Math.max(1, chamfer - borderW));

      if (dOuter <= 0) {
        if (dInner > 0) {
          // 프레임 테두리 영역
          const edgeFactor = Math.min(1, Math.max(0, -dOuter));
          const innerFactor = Math.min(1, Math.max(0, dInner));

          // 기본 사이버 메탈 베이스 (#182236)
          let r = 24;
          let g = 34;
          let b = 54;
          let a = 240 * edgeFactor;

          // 상단 및 하단 네온 림 하이라이트
          if (y <= 2 || y >= h - 3) {
            r = 60;
            g = 210;
            b = 255;
            a = 255;
          }

          // 안쪽 림 라이트 (시안 네온 글로우)
          if (innerFactor > 0.3) {
            r = Math.round(r * 0.4 + 40 * 0.6);
            g = Math.round(g * 0.4 + 230 * 0.6);
            b = Math.round(b * 0.4 + 255 * 0.6);
            a = 255;
          }

          img.setPixel(x, y, r, g, b, a);
        } else {
          // 내부 영역: 완벽한 투명 (혹은 매우 미세한 고스트 스크린 글래스)
          img.setPixel(x, y, 0, 0, 0, 0);
        }
      }
    }
  }

  // 모서리 4방향 사이버 테크 브래킷 액센트
  const bracketCoords = [
    [chamfer + 2, 2],
    [w - chamfer - 3, 2],
    [chamfer + 2, h - 3],
    [w - chamfer - 3, h - 3],
  ];

  for (const [bx, by] of bracketCoords) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        img.setPixel(bx + dx, by + dy, 255, 255, 255, 240);
      }
    }
  }

  // 25%, 50%, 75% 눈금 틱 마크 (상단/하단 테두리)
  const ticks = [0.25, 0.5, 0.75];
  for (const t of ticks) {
    const tx = Math.round(w * t);
    for (let dy = 0; dy < 3; dy++) {
      img.setPixel(tx, dy, 100, 240, 255, 230);
      img.setPixel(tx, h - 1 - dy, 100, 240, 255, 230);
    }
  }

  return img.toBuffer();
}

/**
 * 2. hp_bar_fill_player.png (320 x 48)
 * 시안→에메랄드 그라디언트 텍스처 PNG
 * 수평: #28E6FF(시안) -> #4DFFAA(에메랄드)
 * 수직: 상단 스펙큘러 하이라이트 광택선 + 미세 사이버 대각선 에너지 패턴
 */
function generateHpBarFillPlayer() {
  const w = 320;
  const h = 48;
  const img = new RGBAImage(w, h);

  for (let y = 0; y < h; y++) {
    const ny = y / h;
    for (let x = 0; x < w; x++) {
      const nx = x / w;

      // 수평 그라디언트: 시안(40, 230, 255) -> 에메랄드(77, 255, 170)
      let r = 40 * (1 - nx) + 77 * nx;
      let g = 230 * (1 - nx) + 255 * nx;
      let b = 255 * (1 - nx) + 170 * nx;

      // 수직 광택 (스펙큘러 글래스 효과)
      if (ny < 0.45) {
        const spec = (1 - ny / 0.45) * 0.45;
        r = r * (1 - spec) + 255 * spec;
        g = g * (1 - spec) + 255 * spec;
        b = b * (1 - spec) + 255 * spec;
      } else {
        const depth = (ny - 0.45) / 0.55 * 0.25;
        r *= (1 - depth);
        g *= (1 - depth * 0.5);
        b *= (1 - depth);
      }

      // 최상단 2px 하이라이트 림선
      if (y <= 2) {
        r = 220;
        g = 255;
        b = 255;
      }

      // 대각선 사이버 에너지 빗살 무늬 (주기 16px)
      if ((x + y * 2) % 18 < 4) {
        r = Math.min(255, r + 22);
        g = Math.min(255, g + 22);
        b = Math.min(255, b + 22);
      }

      // 중앙 수평 펄스 라인 (y = 24 근방)
      const distFromCenter = Math.abs(y - 24);
      if (distFromCenter <= 1) {
        r = Math.min(255, r + 35);
        g = Math.min(255, g + 35);
        b = Math.min(255, b + 35);
      }

      img.setPixel(x, y, r, g, b, 255);
    }
  }

  return img.toBuffer();
}

/**
 * 3. hp_bar_fill_boss.png (320 x 48)
 * 진홍→주황 그라디언트 텍스처 PNG
 * 수평: #FF2A4A(진홍 크림슨) -> #FF8844(마그마 주황)
 * 수직: 상단 스펙큘러 하이라이트 광택선 + 미세 사이버 대각선 에너지 패턴
 */
function generateHpBarFillBoss() {
  const w = 320;
  const h = 48;
  const img = new RGBAImage(w, h);

  for (let y = 0; y < h; y++) {
    const ny = y / h;
    for (let x = 0; x < w; x++) {
      const nx = x / w;

      // 수평 그라디언트: 크림슨(255, 42, 74) -> 오렌지(255, 136, 68)
      // 보스는 좌측에서 우측으로 갈수록 주황(에너지 활성)
      let r = 255;
      let g = 42 * (1 - nx) + 136 * nx;
      let b = 74 * (1 - nx) + 68 * nx;

      // 수직 광택 (스펙큘러 글래스 효과)
      if (ny < 0.45) {
        const spec = (1 - ny / 0.45) * 0.45;
        r = r * (1 - spec) + 255 * spec;
        g = g * (1 - spec) + 240 * spec;
        b = b * (1 - spec) + 200 * spec;
      } else {
        const depth = (ny - 0.45) / 0.55 * 0.28;
        r *= (1 - depth * 0.5);
        g *= (1 - depth);
        b *= (1 - depth);
      }

      // 최상단 2px 하이라이트 림선
      if (y <= 2) {
        r = 255;
        g = 245;
        b = 210;
      }

      // 대각선 사이버 에너지 빗살 무늬 (역방향 주기 18px)
      if ((x - y * 2 + 360) % 18 < 4) {
        r = Math.min(255, r + 25);
        g = Math.min(255, g + 30);
        b = Math.min(255, b + 20);
      }

      // 중앙 수평 펄스 라인 (y = 24 근방)
      const distFromCenter = Math.abs(y - 24);
      if (distFromCenter <= 1) {
        r = 255;
        g = Math.min(255, g + 40);
        b = Math.min(255, b + 30);
      }

      img.setPixel(x, y, r, g, b, 255);
    }
  }

  return img.toBuffer();
}

/**
 * 4. combo_icon.png (48 x 48)
 * 네온 화염/스파크 불꽃 아이콘 투명 PNG
 * 외곽: 네온 오렌지 화염 (#FF4500, #FF7700)
 * 내부: 골든 옐로우 코어 (#FFCB4D) 및 화이트-스파크 다이아몬드
 */
function generateComboIcon() {
  const size = 48;
  const img = new RGBAImage(size, size);
  const cx = 24;
  const cy = 25;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - cx);
      const dy = (y - cy);

      // 화염 형태 모델링:
      // 아래쪽은 둥근 구형 베이스, 위쪽은 뾰족한 불꽃 팁 3개 (좌, 중, 우)
      const distBase = Math.hypot(dx, dy + 2); // r ~ 16

      // 세 불꽃 팁
      const tipCenterDist = Math.hypot(dx * 1.5, y - 6);  // 중앙 팁 (24, 6)
      const tipLeftDist = Math.hypot((dx + 8) * 1.3, y - 13); // 좌측 팁 (16, 13)
      const tipRightDist = Math.hypot((dx - 8) * 1.3, y - 14); // 우측 팁 (32, 14)

      let flameVal = 0;

      // 베이스 화염 바디
      if (y >= 14 && y <= 42) {
        const bodyWidth = 14 * Math.sin(((y - 12) / 30) * Math.PI);
        if (Math.abs(dx) <= bodyWidth) {
          flameVal = Math.max(flameVal, 1 - (Math.abs(dx) / (bodyWidth + 1)));
        }
      }

      // 팁 기여도
      if (tipCenterDist < 12) {
        flameVal = Math.max(flameVal, 1 - tipCenterDist / 12);
      }
      if (tipLeftDist < 9) {
        flameVal = Math.max(flameVal, 1 - tipLeftDist / 9);
      }
      if (tipRightDist < 9) {
        flameVal = Math.max(flameVal, 1 - tipRightDist / 9);
      }

      if (flameVal > 0) {
        // 외곽 화염: 네온 오렌지-레드 (#FF3A00 -> #FF7700)
        let r = 255;
        let g = Math.round(50 + flameVal * 150);
        let b = 10;
        let a = Math.round(Math.min(1, flameVal * 1.8) * 255);

        // 내부 코어: 황금빛 옐로우 (#FFCB4D) 및 화이트
        if (flameVal > 0.55) {
          const coreT = (flameVal - 0.55) / 0.45;
          r = 255;
          g = Math.round(203 * (1 - coreT) + 255 * coreT);
          b = Math.round(77 * (1 - coreT) + 230 * coreT);
          a = 255;
        }

        img.setPixel(x, y, r, g, b, a);
      }

      // 중앙 4방향 네온 스파크 크로스 다이아몬드 (중심 (24, 27))
      const sparkDx = Math.abs(x - 24);
      const sparkDy = Math.abs(y - 27);
      if (sparkDx + sparkDy <= 5) {
        const sp = 1 - (sparkDx + sparkDy) / 5;
        img.setPixel(x, y, 255, 255, 255, Math.round(sp * 255));
      }
    }
  }

  return img.toBuffer();
}

/**
 * 5. boss_nameplate.png (400 x 60)
 * 반투명 네온 다크 명패 배경 투명 PNG
 * 중앙: 반투명 네온 다크 배경 (rgba(12, 16, 32, 0.88))
 * 양끝: 화살표형 각면 베벨 사이버 컷
 * 테두리: 진홍(#FF3366)→골드(#FFCB4D) 그라데이션 림 + 테크 브래킷
 */
function generateBossNameplate() {
  const w = 400;
  const h = 60;
  const img = new RGBAImage(w, h);

  const chamfer = 14;

  // 좌우 양끝이 안쪽으로 꺾이거나 밖으로 뾰족한 사이버 명패 형태
  function nameplateSDF(x, y) {
    const cx = w / 2;
    const cy = h / 2;
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);

    // 기본 사각 경계: 폭 380, 높이 52
    const halfW = (w - 16) / 2;
    const halfH = (h - 12) / 2;

    const qx = dx - (halfW - chamfer);
    const qy = dy - (halfH - chamfer);

    if (qx > 0 && qy > 0) {
      return (qx + qy - chamfer);
    }
    return Math.max(qx - chamfer, qy - chamfer);
  }

  for (let y = 0; y < h; y++) {
    const ny = y / h;
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const d = nameplateSDF(x, y);

      if (d <= 0) {
        // 내부 반투명 다크 사이버 배경
        const distFromCenter = Math.hypot((x - w / 2) / (w * 0.4), (y - h / 2) / (h * 0.4));
        const centerFactor = Math.max(0, 1 - distFromCenter);

        let r = 12 + centerFactor * 16;
        let g = 14 + centerFactor * 10;
        let b = 28 + centerFactor * 24;
        let a = 220; // 약 0.86 알파

        // 테두리 림 (d가 -3 ~ 0 사이)
        if (d >= -3) {
          const rimT = Math.abs(nx - 0.5) * 2; // 중심에서 가장자리로
          // 진홍(#FF3366) -> 골드(#FFCB4D) 림 그라데이션
          r = Math.round(255 * (1 - rimT * 0.3));
          g = Math.round(51 * (1 - rimT) + 203 * rimT);
          b = Math.round(102 * (1 - rimT) + 77 * rimT);
          a = 255;
        }

        // 상단 & 하단 1px 미세 네온 엣지
        if (y === 6 || y === h - 7) {
          if (x >= chamfer + 8 && x <= w - chamfer - 8) {
            r = 255;
            g = 180;
            b = 100;
            a = 230;
          }
        }

        img.setPixel(x, y, r, g, b, a);
      }
    }
  }

  // 좌우 끝단 사이버 테크 버티컬 인디케이터
  const leftX = 18;
  const rightX = w - 19;
  for (let dy = -12; dy <= 12; dy++) {
    const y = 30 + dy;
    img.setPixel(leftX, y, 255, 68, 85, 240);
    img.setPixel(leftX + 2, y, 255, 140, 60, 200);

    img.setPixel(rightX, y, 255, 68, 85, 240);
    img.setPixel(rightX - 2, y, 255, 140, 60, 200);
  }

  return img.toBuffer();
}

// ─── 4. 실행 및 파일 저장 ───

function main() {
  const outDir = path.resolve(process.cwd(), 'public/assets/ui/hud');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
    console.log(`[HUD Assets] 디렉토리 생성: ${outDir}`);
  }

  const assets = [
    { name: 'hp_bar_frame.png', gen: generateHpBarFrame, w: 320, h: 48 },
    { name: 'hp_bar_fill_player.png', gen: generateHpBarFillPlayer, w: 320, h: 48 },
    { name: 'hp_bar_fill_boss.png', gen: generateHpBarFillBoss, w: 320, h: 48 },
    { name: 'combo_icon.png', gen: generateComboIcon, w: 48, h: 48 },
    { name: 'boss_nameplate.png', gen: generateBossNameplate, w: 400, h: 60 },
  ];

  for (const asset of assets) {
    const outPath = path.join(outDir, asset.name);
    const buf = asset.gen();
    fs.writeFileSync(outPath, buf);
    console.log(`[HUD Assets] 생성 완료: ${asset.name} (${asset.w}x${asset.h}, ${buf.length} bytes)`);
  }

  console.log('[HUD Assets] 모든 HUD 에셋 생성 완료!');
}

main();
