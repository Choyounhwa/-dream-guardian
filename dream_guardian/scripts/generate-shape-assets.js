/**
 * scripts/generate-shape-assets.js
 *
 * Dream Guardian 49종 표준 수학/기하 도형 이미지 에셋 생성기 (Issue #247 / FEAT-QUESTION-SHAPE-001)
 * questions.csv Level 7(평면/입체/각도 79문항) 및 Level 9(쌓기나무/전개도 205문항) 전수 대응
 * Node.js 내장 zlib, fs, path를 사용하여 투명 배경의 표준 PNG 바이너리 파일을 직접 생성합니다.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, '../public/assets/shapes');

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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type 6: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const scanlines = Buffer.alloc((1 + width * 4) * height);
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

  drawLine(x0, y0, x1, y1, color, thickness = 2) {
    const [r, g, b, a] = color;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    if (dist === 0) {
      this.drawDisc(x0, y0, thickness / 2, r, g, b, a);
      return;
    }
    const steps = Math.ceil(dist * 2);
    const radius = thickness / 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      this.drawDisc(x, y, radius, r, g, b, a);
    }
  }

  drawDisc(cx, cy, radius, r, g, b, a = 255) {
    const minX = Math.max(0, Math.floor(cx - radius - 1));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius + 1));
    const minY = Math.max(0, Math.floor(cy - radius - 1));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius + 1));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= radius) {
          const edgeA = radius - d < 1 ? Math.max(0, radius - d) : 1;
          this.setPixel(x, y, r, g, b, Math.round(a * edgeA));
        }
      }
    }
  }

  drawPolygon(points, fillColor, strokeColor, strokeW = 3) {
    if (points.length < 3) return;

    // 1. Fill polygon with Scanline / Raycasting
    let minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      minY = Math.min(minY, Math.floor(p.y));
      maxY = Math.max(maxY, Math.ceil(p.y));
    }
    minY = Math.max(0, minY);
    maxY = Math.min(this.height - 1, maxY);

    const [fr, fg, fb, fa] = fillColor;
    if (fa > 0) {
      for (let y = minY; y <= maxY; y++) {
        const nodeX = [];
        let j = points.length - 1;
        for (let i = 0; i < points.length; i++) {
          const pi = points[i];
          const pj = points[j];
          if ((pi.y < y && pj.y >= y) || (pj.y < y && pi.y >= y)) {
            nodeX.push(pi.x + ((y - pi.y) / (pj.y - pi.y)) * (pj.x - pi.x));
          }
          j = i;
        }
        nodeX.sort((a, b) => a - b);
        for (let i = 0; i < nodeX.length; i += 2) {
          if (i + 1 < nodeX.length) {
            const startX = Math.max(0, Math.ceil(nodeX[i]));
            const endX = Math.min(this.width - 1, Math.floor(nodeX[i + 1]));
            for (let x = startX; x <= endX; x++) {
              this.setPixel(x, y, fr, fg, fb, fa);
            }
          }
        }
      }
    }

    // 2. Stroke edges
    if (strokeColor && strokeW > 0) {
      for (let i = 0; i < points.length; i++) {
        const next = (i + 1) % points.length;
        this.drawLine(points[i].x, points[i].y, points[next].x, points[next].y, strokeColor, strokeW);
      }
      for (const p of points) {
        this.drawDisc(p.x, p.y, strokeW * 0.8, strokeColor[0], strokeColor[1], strokeColor[2], strokeColor[3]);
      }
    }
  }

  drawCircle(cx, cy, radius, fillColor, strokeColor, strokeW = 3) {
    const minX = Math.max(0, Math.floor(cx - radius - strokeW));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius + strokeW));
    const minY = Math.max(0, Math.floor(cy - radius - strokeW));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius + strokeW));

    const [fr, fg, fb, fa] = fillColor;
    const [sr, sg, sb, sa] = strokeColor || [0, 0, 0, 0];

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= radius - strokeW / 2) {
          if (fa > 0) this.setPixel(x, y, fr, fg, fb, fa);
        } else if (d <= radius + strokeW / 2) {
          if (sa > 0) this.setPixel(x, y, sr, sg, sb, sa);
        }
      }
    }
  }

  toBuffer() {
    return encodePNG(this.width, this.height, this.data);
  }
}

// ─── 3. 색상 팔레트 (사이버네온 / 크리스탈) ───

const COLOR = {
  stroke: [40, 230, 255, 255],       // #28E6FF 네온 시안
  strokeGold: [255, 203, 77, 255],   // #FFCB4D 네온 골드
  fillPlane: [14, 165, 233, 90],     // 반투명 스카이블루
  fillTop: [111, 227, 255, 240],     // #6FE3FF 아이소메트릭 상단
  fillLeft: [2, 132, 199, 240],      // #0284C7 아이소메트릭 좌측
  fillRight: [29, 78, 216, 240],     // #1D4ED8 아이소메트릭 우측
  fillBack: [15, 23, 42, 140],       // 어두운 네이비 배경
  edge3D: [8, 24, 43, 255],          // 3D 큐브 테두리 다크
  highlight: [255, 255, 255, 200],   // 정점 하이라이트
};

// ─── 4. 도형 생성기 목록 ───

// 17종 쌓기나무 카탈로그
const STACK_CUBES = {
  a: [[2, 1], [1, 0]],
  b: [[2, 2], [1, 0]],
  c: [[2, 1], [2, 1]],
  d: [[3, 2], [1, 1]],
  e: [[3, 2], [2, 1]],
  f: [[3, 1], [2, 2]],
  g: [[2, 2], [2, 2]],
  h: [[3, 3], [1, 0]],
  i: [[3, 2], [2, 2]],
  j: [[3, 3], [2, 1]],
  k: [[1, 2], [3, 1]],
  l: [[2, 3], [1, 2]],
  m: [[2, 1], [3, 2], [1, 0]],
  n: [[2, 3, 1], [1, 2, 2]],
  o: [[0, 2, 0], [1, 3, 2], [0, 2, 0]],
  p: [[3, 2, 1], [2, 2, 0], [1, 1, 0]],
  q: [[2, 1, 1], [2, 2, 1], [1, 1, 0]],
};

function renderStackCubeImage(grid, size = 256) {
  const img = new RGBAImage(size, size);
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);

  const cubes = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r] || []).length; c++) {
      const h = grid[r][c] || 0;
      for (let z = 0; z < h; z++) cubes.push({ r, c, z });
    }
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const cube of cubes) {
    const px = (cube.c - cube.r) * cos30;
    const py = (cube.c + cube.r) * sin30 - cube.z;
    minX = Math.min(minX, px - cos30);
    maxX = Math.max(maxX, px + cos30);
    minY = Math.min(minY, py - 1);
    maxY = Math.max(maxY, py + 2 * sin30);
  }

  const unscaledW = Math.max(0.1, maxX - minX);
  const unscaledH = Math.max(0.1, maxY - minY);
  const cubeSize = Math.min((size * 0.74) / unscaledW, (size * 0.74) / unscaledH, 50);

  const stepX = cubeSize * cos30;
  const stepY = cubeSize * sin30;
  const cubeH = cubeSize;

  const midX = ((minX + maxX) / 2) * cubeSize;
  const midY = ((minY + maxY) / 2) * cubeSize;
  const originX = size / 2 - midX;
  const originY = size / 2 - midY + 12;

  // Painter's algorithm
  cubes.sort((a, b) => a.r + a.c - (b.r + b.c) || a.z - b.z);

  for (const cube of cubes) {
    const x = originX + (cube.c - cube.r) * stepX;
    const y = originY + (cube.c + cube.r) * stepY - cube.z * cubeH;

    // 좌측면
    img.drawPolygon([
      { x: x - stepX, y: y + stepY - cubeH },
      { x: x, y: y + 2 * stepY - cubeH },
      { x: x, y: y + 2 * stepY },
      { x: x - stepX, y: y + stepY },
    ], COLOR.fillLeft, COLOR.edge3D, 2);

    // 우측면
    img.drawPolygon([
      { x: x, y: y + 2 * stepY - cubeH },
      { x: x + stepX, y: y + stepY - cubeH },
      { x: x + stepX, y: y + stepY },
      { x: x, y: y + 2 * stepY },
    ], COLOR.fillRight, COLOR.edge3D, 2);

    // 상단면
    img.drawPolygon([
      { x: x, y: y - cubeH },
      { x: x + stepX, y: y + stepY - cubeH },
      { x: x, y: y + 2 * stepY - cubeH },
      { x: x - stepX, y: y + stepY - cubeH },
    ], COLOR.fillTop, COLOR.edge3D, 2);
  }

  return img.toBuffer();
}

function renderPlanePolygon(points, size = 256) {
  const img = new RGBAImage(size, size);
  img.drawPolygon(points, COLOR.fillPlane, COLOR.stroke, 3);
  return img.toBuffer();
}

function renderRegularPolygon(n, size = 256, rotOffset = -Math.PI / 2) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const points = [];
  for (let i = 0; i < n; i++) {
    const angle = rotOffset + (i * 2 * Math.PI) / n;
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return renderPlanePolygon(points, size);
}

// ─── 5. 49종 전체 생성 실행 ───

console.log('🚀 Dream Guardian 49종 도형 에셋 생성 시작...');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

let generatedCount = 0;

// (1) 17종 쌓기나무
for (const [letter, grid] of Object.entries(STACK_CUBES)) {
  const filename = `stack_cube_${letter}.png`;
  const buf = renderStackCubeImage(grid, 256);
  fs.writeFileSync(path.join(OUT_DIR, filename), buf);
  generatedCount++;
}

// (2) 2종 전개도 및 회전 가이드
// cube_net
{
  const img = new RGBAImage(256, 256);
  const cell = 46;
  const ox = 256 / 2 - 2 * cell;
  const oy = 256 / 2 - 1.5 * cell;
  const cells = [
    { r: 0, c: 1, target: false },
    { r: 1, c: 0, target: false },
    { r: 1, c: 1, target: true },
    { r: 1, c: 2, target: false },
    { r: 1, c: 3, target: false },
    { r: 2, c: 1, target: false },
  ];
  for (const c of cells) {
    const bx = ox + c.c * cell;
    const by = oy + c.r * cell;
    img.drawPolygon([
      { x: bx, y: by },
      { x: bx + cell, y: by },
      { x: bx + cell, y: by + cell },
      { x: bx, y: by + cell },
    ], c.target ? [255, 203, 77, 80] : COLOR.fillPlane, c.target ? COLOR.strokeGold : COLOR.stroke, 2);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'cube_net.png'), img.toBuffer());
  generatedCount++;
}

// arrow_rot
{
  const img = new RGBAImage(256, 256);
  const cx = 128, cy = 128;
  img.drawCircle(cx, cy, 70, [0, 0, 0, 0], COLOR.strokeGold, 3);
  // 화살표 머리
  img.drawPolygon([
    { x: cx + 70, y: cy - 12 },
    { x: cx + 86, y: cy },
    { x: cx + 70, y: cy + 12 },
  ], COLOR.strokeGold, COLOR.strokeGold, 2);
  // 중앙 화살표 기호
  img.drawLine(cx - 35, cy, cx + 35, cy, COLOR.stroke, 6);
  img.drawPolygon([
    { x: cx + 30, y: cy - 20 },
    { x: cx + 55, y: cy },
    { x: cx + 30, y: cy + 20 },
  ], COLOR.stroke, COLOR.stroke, 3);
  fs.writeFileSync(path.join(OUT_DIR, 'arrow_rot.png'), img.toBuffer());
  generatedCount++;
}

// (3) 15종 평면도형
// triangle (일반삼각형)
fs.writeFileSync(path.join(OUT_DIR, 'triangle.png'), renderPlanePolygon([
  { x: 128, y: 45 },
  { x: 215, y: 205 },
  { x: 45, y: 205 },
]));
generatedCount++;

// right_triangle (직각삼각형)
{
  const img = new RGBAImage(256, 256);
  img.drawPolygon([
    { x: 50, y: 50 },
    { x: 210, y: 205 },
    { x: 50, y: 205 },
  ], COLOR.fillPlane, COLOR.stroke, 3);
  // 직각 기호
  img.drawLine(50, 185, 70, 185, COLOR.strokeGold, 2);
  img.drawLine(70, 185, 70, 205, COLOR.strokeGold, 2);
  fs.writeFileSync(path.join(OUT_DIR, 'right_triangle.png'), img.toBuffer());
  generatedCount++;
}

// equilateral_triangle (정삼각형)
fs.writeFileSync(path.join(OUT_DIR, 'equilateral_triangle.png'), renderRegularPolygon(3));
generatedCount++;

// isosceles_triangle (이등변삼각형)
fs.writeFileSync(path.join(OUT_DIR, 'isosceles_triangle.png'), renderPlanePolygon([
  { x: 128, y: 35 },
  { x: 205, y: 215 },
  { x: 51, y: 215 },
]));
generatedCount++;

// rect (직사각형)
fs.writeFileSync(path.join(OUT_DIR, 'rect.png'), renderPlanePolygon([
  { x: 40, y: 65 },
  { x: 216, y: 65 },
  { x: 216, y: 190 },
  { x: 40, y: 190 },
]));
generatedCount++;

// square (정사각형)
fs.writeFileSync(path.join(OUT_DIR, 'square.png'), renderPlanePolygon([
  { x: 52, y: 52 },
  { x: 204, y: 52 },
  { x: 204, y: 204 },
  { x: 52, y: 204 },
]));
generatedCount++;

// parallelogram (평행사변형)
fs.writeFileSync(path.join(OUT_DIR, 'parallelogram.png'), renderPlanePolygon([
  { x: 80, y: 65 },
  { x: 225, y: 65 },
  { x: 176, y: 190 },
  { x: 31, y: 190 },
]));
generatedCount++;

// trapezoid (사다리꼴)
fs.writeFileSync(path.join(OUT_DIR, 'trapezoid.png'), renderPlanePolygon([
  { x: 75, y: 65 },
  { x: 181, y: 65 },
  { x: 225, y: 190 },
  { x: 31, y: 190 },
]));
generatedCount++;

// rhombus (마름모)
fs.writeFileSync(path.join(OUT_DIR, 'rhombus.png'), renderPlanePolygon([
  { x: 128, y: 35 },
  { x: 220, y: 128 },
  { x: 128, y: 221 },
  { x: 36, y: 128 },
]));
generatedCount++;

// pentagon ~ decagon (정다각형 5종)
fs.writeFileSync(path.join(OUT_DIR, 'pentagon.png'), renderRegularPolygon(5)); generatedCount++;
fs.writeFileSync(path.join(OUT_DIR, 'hexagon.png'), renderRegularPolygon(6)); generatedCount++;
fs.writeFileSync(path.join(OUT_DIR, 'heptagon.png'), renderRegularPolygon(7)); generatedCount++;
fs.writeFileSync(path.join(OUT_DIR, 'octagon.png'), renderRegularPolygon(8)); generatedCount++;
fs.writeFileSync(path.join(OUT_DIR, 'decagon.png'), renderRegularPolygon(10)); generatedCount++;

// circle (원)
{
  const img = new RGBAImage(256, 256);
  img.drawCircle(128, 128, 92, COLOR.fillPlane, COLOR.stroke, 3);
  fs.writeFileSync(path.join(OUT_DIR, 'circle.png'), img.toBuffer());
  generatedCount++;
}

// (4) 10종 입체도형
// cube (정육면체)
{
  const img = new RGBAImage(256, 256);
  const cx = 128, cy = 135, s = 62;
  const cos = Math.cos(Math.PI / 6) * s;
  const sin = Math.sin(Math.PI / 6) * s;
  img.drawPolygon([{ x: cx, y: cy - s }, { x: cx + cos, y: cy + sin - s }, { x: cx, y: cy + 2 * sin - s }, { x: cx - cos, y: cy + sin - s }], COLOR.fillTop, COLOR.stroke, 2);
  img.drawPolygon([{ x: cx - cos, y: cy + sin - s }, { x: cx, y: cy + 2 * sin - s }, { x: cx, y: cy + 2 * sin }, { x: cx - cos, y: cy + sin }], COLOR.fillLeft, COLOR.stroke, 2);
  img.drawPolygon([{ x: cx, y: cy + 2 * sin - s }, { x: cx + cos, y: cy + sin - s }, { x: cx + cos, y: cy + sin }, { x: cx, y: cy + 2 * sin }], COLOR.fillRight, COLOR.stroke, 2);
  fs.writeFileSync(path.join(OUT_DIR, 'cube.png'), img.toBuffer());
  generatedCount++;
}

// cuboid (직육면체)
{
  const img = new RGBAImage(256, 256);
  const cx = 128, cy = 145, sx = 80, sy = 40, h = 75;
  img.drawPolygon([{ x: cx, y: cy - h }, { x: cx + sx, y: cy + sy - h }, { x: cx, y: cy + 2 * sy - h }, { x: cx - sx, y: cy + sy - h }], COLOR.fillTop, COLOR.stroke, 2);
  img.drawPolygon([{ x: cx - sx, y: cy + sy - h }, { x: cx, y: cy + 2 * sy - h }, { x: cx, y: cy + 2 * sy }, { x: cx - sx, y: cy + sy }], COLOR.fillLeft, COLOR.stroke, 2);
  img.drawPolygon([{ x: cx, y: cy + 2 * sy - h }, { x: cx + sx, y: cy + sy - h }, { x: cx + sx, y: cy + sy }, { x: cx, y: cy + 2 * sy }], COLOR.fillRight, COLOR.stroke, 2);
  fs.writeFileSync(path.join(OUT_DIR, 'cuboid.png'), img.toBuffer());
  generatedCount++;
}

// tetrahedron (정사면체)
{
  const img = new RGBAImage(256, 256);
  const top = { x: 128, y: 35 };
  const left = { x: 45, y: 195 };
  const mid = { x: 135, y: 225 };
  const right = { x: 215, y: 175 };
  img.drawPolygon([top, left, mid], COLOR.fillLeft, COLOR.stroke, 2);
  img.drawPolygon([top, mid, right], COLOR.fillRight, COLOR.stroke, 2);
  img.drawLine(left.x, left.y, right.x, right.y, [40, 230, 255, 120], 1); // 뒷면 모서리 점선 느낌
  fs.writeFileSync(path.join(OUT_DIR, 'tetrahedron.png'), img.toBuffer());
  generatedCount++;
}

// square_pyramid (사각뿔)
{
  const img = new RGBAImage(256, 256);
  const apex = { x: 128, y: 35 };
  const bl = { x: 40, y: 185 };
  const bm = { x: 120, y: 225 };
  const br = { x: 220, y: 195 };
  img.drawPolygon([apex, bl, bm], COLOR.fillLeft, COLOR.stroke, 2);
  img.drawPolygon([apex, bm, br], COLOR.fillRight, COLOR.stroke, 2);
  fs.writeFileSync(path.join(OUT_DIR, 'square_pyramid.png'), img.toBuffer());
  generatedCount++;
}

// triangular_prism (삼각기둥)
{
  const img = new RGBAImage(256, 256);
  const t1 = { x: 80, y: 40 }, t2 = { x: 180, y: 65 }, t3 = { x: 120, y: 95 };
  const b1 = { x: 80, y: 165 }, b2 = { x: 180, y: 190 }, b3 = { x: 120, y: 220 };
  img.drawPolygon([t1, t2, t3], COLOR.fillTop, COLOR.stroke, 2);
  img.drawPolygon([t1, t3, b3, b1], COLOR.fillLeft, COLOR.stroke, 2);
  img.drawPolygon([t3, t2, b2, b3], COLOR.fillRight, COLOR.stroke, 2);
  fs.writeFileSync(path.join(OUT_DIR, 'triangular_prism.png'), img.toBuffer());
  generatedCount++;
}

// pentagonal_prism (오각기둥)
{
  const img = new RGBAImage(256, 256);
  const cx = 128, ty = 75, by = 180, r = 60;
  const topPts = [], botPts = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    topPts.push({ x: cx + r * Math.cos(a), y: ty + r * 0.45 * Math.sin(a) });
    botPts.push({ x: cx + r * Math.cos(a), y: by + r * 0.45 * Math.sin(a) });
  }
  img.drawPolygon(topPts, COLOR.fillTop, COLOR.stroke, 2);
  for (let i = 1; i < 4; i++) {
    const next = (i + 1) % 5;
    img.drawPolygon([topPts[i], topPts[next], botPts[next], botPts[i]], COLOR.fillLeft, COLOR.stroke, 2);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'pentagonal_prism.png'), img.toBuffer());
  generatedCount++;
}

// hexagonal_prism (육각기둥)
{
  const img = new RGBAImage(256, 256);
  const cx = 128, ty = 70, by = 185, r = 62;
  const topPts = [], botPts = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
    topPts.push({ x: cx + r * Math.cos(a), y: ty + r * 0.45 * Math.sin(a) });
    botPts.push({ x: cx + r * Math.cos(a), y: by + r * 0.45 * Math.sin(a) });
  }
  img.drawPolygon(topPts, COLOR.fillTop, COLOR.stroke, 2);
  for (let i = 1; i < 5; i++) {
    const next = (i + 1) % 6;
    img.drawPolygon([topPts[i], topPts[next], botPts[next], botPts[i]], COLOR.fillLeft, COLOR.stroke, 2);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'hexagonal_prism.png'), img.toBuffer());
  generatedCount++;
}

// cylinder (원기둥)
{
  const img = new RGBAImage(256, 256);
  const cx = 128, r = 70, ty = 70, by = 185;
  // 몸통
  img.drawPolygon([
    { x: cx - r, y: ty },
    { x: cx + r, y: ty },
    { x: cx + r, y: by },
    { x: cx - r, y: by },
  ], COLOR.fillLeft, COLOR.stroke, 2);
  // 밑면 타원
  for (let x = cx - r; x <= cx + r; x++) {
    const dy = Math.sqrt(Math.max(0, 1 - Math.pow((x - cx) / r, 2))) * 22;
    img.drawLine(x, by, x, by + dy, COLOR.fillRight, 2);
  }
  img.drawLine(cx - r, by, cx - r, ty, COLOR.stroke, 3);
  img.drawLine(cx + r, by, cx + r, ty, COLOR.stroke, 3);
  // 상단 밑면 타원
  for (let x = cx - r; x <= cx + r; x++) {
    const dy = Math.sqrt(Math.max(0, 1 - Math.pow((x - cx) / r, 2))) * 22;
    img.drawLine(x, ty - dy, x, ty + dy, COLOR.fillTop, 2);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'cylinder.png'), img.toBuffer());
  generatedCount++;
}

// cone (원뿔)
{
  const img = new RGBAImage(256, 256);
  const cx = 128, r = 75, apexY = 40, baseY = 195;
  img.drawPolygon([
    { x: cx, y: apexY },
    { x: cx + r, y: baseY },
    { x: cx - r, y: baseY },
  ], COLOR.fillLeft, COLOR.stroke, 2);
  for (let x = cx - r; x <= cx + r; x++) {
    const dy = Math.sqrt(Math.max(0, 1 - Math.pow((x - cx) / r, 2))) * 22;
    img.drawLine(x, baseY, x, baseY + dy, COLOR.fillRight, 2);
  }
  img.drawLine(cx, apexY, cx - r, baseY, COLOR.stroke, 3);
  img.drawLine(cx, apexY, cx + r, baseY, COLOR.stroke, 3);
  fs.writeFileSync(path.join(OUT_DIR, 'cone.png'), img.toBuffer());
  generatedCount++;
}

// sphere (구)
{
  const img = new RGBAImage(256, 256);
  const cx = 128, cy = 128, r = 88;
  img.drawCircle(cx, cy, r, COLOR.fillRight, COLOR.stroke, 3);
  // 입체감 음영 원호 및 적도선
  img.drawCircle(cx - 25, cy - 25, 45, [111, 227, 255, 60], null, 0);
  for (let x = cx - r; x <= cx + r; x += 4) {
    const dy = Math.sqrt(Math.max(0, 1 - Math.pow((x - cx) / r, 2))) * 22;
    img.setPixel(x, cy + dy, 255, 203, 77, 180);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'sphere.png'), img.toBuffer());
  generatedCount++;
}

// (5) 5종 각도 표시 기하도형
// triangle_angle (삼각형 두 각 표시)
{
  const img = new RGBAImage(256, 256);
  const p1 = { x: 128, y: 45 }, p2 = { x: 215, y: 205 }, p3 = { x: 45, y: 205 };
  img.drawPolygon([p1, p2, p3], COLOR.fillPlane, COLOR.stroke, 3);
  // 밑각 두 호 표시
  img.drawCircle(p3.x + 22, p3.y - 12, 16, [0, 0, 0, 0], COLOR.strokeGold, 3);
  img.drawCircle(p2.x - 22, p2.y - 12, 16, [0, 0, 0, 0], COLOR.strokeGold, 3);
  fs.writeFileSync(path.join(OUT_DIR, 'triangle_angle.png'), img.toBuffer());
  generatedCount++;
}

// right_triangle_angle (직각삼각형 예각)
{
  const img = new RGBAImage(256, 256);
  img.drawPolygon([
    { x: 50, y: 50 },
    { x: 210, y: 205 },
    { x: 50, y: 205 },
  ], COLOR.fillPlane, COLOR.stroke, 3);
  // 직각 표시
  img.drawLine(50, 185, 70, 185, COLOR.stroke, 2);
  img.drawLine(70, 185, 70, 205, COLOR.stroke, 2);
  // 예각 호
  img.drawCircle(210 - 24, 205 - 8, 16, [0, 0, 0, 0], COLOR.strokeGold, 3);
  fs.writeFileSync(path.join(OUT_DIR, 'right_triangle_angle.png'), img.toBuffer());
  generatedCount++;
}

// isosceles_angle (이등변 꼭지각/밑각)
{
  const img = new RGBAImage(256, 256);
  const p1 = { x: 128, y: 35 }, p2 = { x: 205, y: 215 }, p3 = { x: 51, y: 215 };
  img.drawPolygon([p1, p2, p3], COLOR.fillPlane, COLOR.stroke, 3);
  // 꼭지각 호
  img.drawCircle(p1.x, p1.y + 24, 18, [0, 0, 0, 0], COLOR.strokeGold, 3);
  fs.writeFileSync(path.join(OUT_DIR, 'isosceles_angle.png'), img.toBuffer());
  generatedCount++;
}

// parallelogram_angle (평행사변형 대각/이웃각)
{
  const img = new RGBAImage(256, 256);
  const pts = [{ x: 80, y: 65 }, { x: 225, y: 65 }, { x: 176, y: 190 }, { x: 31, y: 190 }];
  img.drawPolygon(pts, COLOR.fillPlane, COLOR.stroke, 3);
  // 둔각/예각 호
  img.drawCircle(pts[3].x + 24, pts[3].y - 12, 18, [0, 0, 0, 0], COLOR.strokeGold, 3);
  fs.writeFileSync(path.join(OUT_DIR, 'parallelogram_angle.png'), img.toBuffer());
  generatedCount++;
}

// polygon_internal_angle (정다각형 내각)
{
  const img = new RGBAImage(256, 256);
  const cx = 128, cy = 128, r = 90;
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  img.drawPolygon(pts, COLOR.fillPlane, COLOR.stroke, 3);
  img.drawCircle(pts[0].x, pts[0].y + 20, 16, [0, 0, 0, 0], COLOR.strokeGold, 3);
  fs.writeFileSync(path.join(OUT_DIR, 'polygon_internal_angle.png'), img.toBuffer());
  generatedCount++;
}

console.log(`✅ 총 ${generatedCount}개 도형 에셋 생성 완료: ${OUT_DIR}`);
