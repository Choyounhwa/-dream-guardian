/**
 * ShapeRenderer - 쌓기나무 3D 아이소메트릭 및 입체도형/전개도 절차적 캔버스 렌더러
 *
 * Issue #247 (FEAT-QUESTION-SHAPE-001):
 * - questions.csv Level 9 SubLevel 4 (쌓기나무 165문항, 모양 A~Q 17종) 3D 아이소메트릭 렌더링
 * - questions.csv Level 9 SubLevel 5 (주사위 전개도, 면/꼭짓점) 2D 정밀 전개도 렌더링
 * - 7초 이내 직관적 인지 가능한 고대비 네온/크리스탈 셰이딩 및 시점 가이드(앞/옆/위)
 */

export interface StackCubesShape {
  type: 'stack_cubes';
  grid: number[][];
  view?: 'top' | 'front' | 'side';
  shapeName?: string;
}

export interface CubeNetPoint {
  r: number;
  c: number;
  t: string;
}

export interface CubeNetShape {
  type: 'cube_net';
  face?: number;
  faces: number[];
  points?: CubeNetPoint[];
}

export interface ArrowRotShape {
  type: 'arrow_rot';
  from: string;
  deg: number;
}

export type ParsedShape = StackCubesShape | CubeNetShape | ArrowRotShape;

/**
 * 17종 쌓기나무 표준 카탈로그 (모양 A ~ 모양 Q)
 * questions.csv 정답 데이터와 100% 일치
 */
export const STACK_CUBE_CATALOG: Record<string, number[][]> = {
  A: [[2, 1], [1, 0]],
  B: [[2, 2], [1, 0]],
  C: [[2, 1], [2, 1]],
  D: [[3, 2], [1, 1]],
  E: [[3, 2], [2, 1]],
  F: [[3, 1], [2, 2]],
  G: [[2, 2], [2, 2]],
  H: [[3, 3], [1, 0]],
  I: [[3, 2], [2, 2]],
  J: [[3, 3], [2, 1]],
  K: [[1, 2], [3, 1]],
  L: [[2, 3], [1, 2]],
  M: [[2, 1], [3, 2], [1, 0]],
  N: [[2, 3, 1], [1, 2, 2]],
  O: [[0, 2, 0], [1, 3, 2], [0, 2, 0]],
  P: [[3, 2, 1], [2, 2, 0], [1, 1, 0]],
  Q: [[2, 1, 1], [2, 2, 1], [1, 1, 0]],
};

/**
 * CSV의 shapeCode 문자열 파싱
 */
export function parseShapeCode(raw: string): ParsedShape | null {
  if (!raw || typeof raw !== 'string') return null;
  let trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  if (!trimmed.includes('{type:')) return null;

  try {
    let jsonLike = trimmed.replace(/'/g, '"');
    jsonLike = jsonLike.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

    const obj = JSON.parse(jsonLike);
    if (!obj || typeof obj !== 'object') return null;

    if (obj.type === 'stack_cubes' && Array.isArray(obj.grid)) {
      return {
        type: 'stack_cubes',
        grid: obj.grid,
        view: obj.view,
        shapeName: obj.shapeName,
      };
    }

    if (obj.type === 'cube_net' && Array.isArray(obj.faces)) {
      return {
        type: 'cube_net',
        face: typeof obj.face === 'number' ? obj.face : undefined,
        faces: obj.faces,
        points: Array.isArray(obj.points) ? obj.points : undefined,
      };
    }

    if (obj.type === 'arrow_rot' && typeof obj.deg === 'number') {
      return {
        type: 'arrow_rot',
        from: String(obj.from || '➡️'),
        deg: obj.deg,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 질문 텍스트 및 shapeCode로부터 도형 데이터 도출
 */
export function deriveShapeFromQuestion(questionText: string, shapeCode?: string): ParsedShape | null {
  if (shapeCode) {
    const parsed = parseShapeCode(shapeCode);
    if (parsed) return parsed;
  }

  // [모양 X] 추출 fallback
  const shapeMatch = questionText.match(/\[모양\s*([A-Q])\]/);
  if (shapeMatch) {
    const letter = shapeMatch[1];
    const grid = STACK_CUBE_CATALOG[letter];
    if (grid) {
      let view: 'top' | 'front' | 'side' | undefined;
      if (questionText.includes('위에서')) view = 'top';
      else if (questionText.includes('앞에서')) view = 'front';
      else if (questionText.includes('옆') || questionText.includes('우측')) view = 'side';

      return {
        type: 'stack_cubes',
        grid,
        view,
        shapeName: `모양 ${letter}`,
      };
    }
  }

  // 주사위 전개도 fallback
  if (questionText.includes('주사위 전개도') || questionText.includes('전개도')) {
    const faceMatch = questionText.match(/\[([1-6])\]/);
    const targetFace = faceMatch ? parseInt(faceMatch[1], 10) : 1;
    return {
      type: 'cube_net',
      face: targetFace,
      faces: [2, 4, 1, 3, 5, 6],
    };
  }

  return null;
}

export interface RenderStackCubesOptions {
  label?: string;
  view?: 'top' | 'front' | 'side';
}

export class ShapeRenderer {
  /**
   * 아이소메트릭 3D 쌓기나무 렌더링
   *
   * @param ctx 캔버스 2D 컨텍스트
   * @param grid 쌓기나무 층수 2D 배열 (행 r = 남서/앞쪽, 열 c = 남동/우측)
   * @param cx 중심 X 좌표
   * @param cy 중심 Y 좌표
   * @param maxW 최대 허용 너비
   * @param maxH 최대 허용 높이
   * @param options 라벨 및 시점 가이드 옵션
   */
  renderStackCubes(
    ctx: CanvasRenderingContext2D,
    grid: number[][],
    cx: number,
    cy: number,
    maxW: number,
    maxH: number,
    options?: RenderStackCubesOptions,
  ): void {
    const numRows = grid.length;
    if (numRows === 0) return;
    const numCols = Math.max(...grid.map((r) => r.length));
    if (numCols === 0) return;

    // 1. 모든 큐브(블록) 좌표 수집
    interface CubeCoord {
      r: number;
      c: number;
      z: number;
    }
    const cubes: CubeCoord[] = [];
    for (let r = 0; r < numRows; r++) {
      const row = grid[r] || [];
      for (let c = 0; c < row.length; c++) {
        const height = row[c] || 0;
        for (let z = 0; z < height; z++) {
          cubes.push({ r, c, z });
        }
      }
    }
    if (cubes.length === 0) return;

    // 2. 투영 경계 계산 (정규화 단위: stepX = cos(30°), stepY = sin(30°), cubeH = 1)
    const cos30 = Math.cos(Math.PI / 6); // ~0.866
    const sin30 = Math.sin(Math.PI / 6); // 0.5

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

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

    // 상/하 여백 (라벨/화살표 공간 포함 80% 가용 영역)
    const availW = maxW * 0.82;
    const availH = maxH * 0.76;
    const cubeSize = Math.min(availW / unscaledW, availH / unscaledH, 72);

    const stepX = cubeSize * cos30;
    const stepY = cubeSize * sin30;
    const cubeH = cubeSize;

    // 바운딩 박스 중심을 cx, cy에 일치
    const midX = ((minX + maxX) / 2) * cubeSize;
    const midY = ((minY + maxY) / 2) * cubeSize;
    const originX = cx - midX;
    const originY = cy - midY + (options?.label ? 10 : 0);

    // 3. Painter's Algorithm: 깊이 정렬 (r + c 오름차순, z 오름차순)
    cubes.sort((a, b) => a.r + a.c - (b.r + b.c) || a.z - b.z);

    ctx.save();

    // 4. 각 큐브 3D 렌더링
    for (const cube of cubes) {
      const x = originX + (cube.c - cube.r) * stepX;
      const y = originY + (cube.c + cube.r) * stepY - cube.z * cubeH;

      // 4-1. 좌측면 (Medium Cyan/Blue)
      ctx.beginPath();
      ctx.moveTo(x - stepX, y + stepY - cubeH);
      ctx.lineTo(x, y + 2 * stepY - cubeH);
      ctx.lineTo(x, y + 2 * stepY);
      ctx.lineTo(x - stepX, y + stepY);
      ctx.closePath();
      ctx.fillStyle = '#0284C7';
      ctx.fill();
      ctx.strokeStyle = '#08182B';
      ctx.lineWidth = Math.max(1.5, cubeSize * 0.05);
      ctx.stroke();

      // 4-2. 우측면 (Deep Navy/Blue)
      ctx.beginPath();
      ctx.moveTo(x, y + 2 * stepY - cubeH);
      ctx.lineTo(x + stepX, y + stepY - cubeH);
      ctx.lineTo(x + stepX, y + stepY);
      ctx.lineTo(x, y + 2 * stepY);
      ctx.closePath();
      ctx.fillStyle = '#1D4ED8';
      ctx.fill();
      ctx.strokeStyle = '#08182B';
      ctx.stroke();

      // 4-3. 상단면 (Luminous Bright Cyan)
      ctx.beginPath();
      ctx.moveTo(x, y - cubeH);
      ctx.lineTo(x + stepX, y + stepY - cubeH);
      ctx.lineTo(x, y + 2 * stepY - cubeH);
      ctx.lineTo(x - stepX, y + stepY - cubeH);
      ctx.closePath();
      ctx.fillStyle = '#6FE3FF';
      ctx.fill();
      ctx.strokeStyle = '#08182B';
      ctx.stroke();

      // 상단면 내부 은은한 광택 테두리
      ctx.beginPath();
      ctx.moveTo(x, y - cubeH + 2);
      ctx.lineTo(x + stepX - 2, y + stepY - cubeH + 1);
      ctx.lineTo(x, y + 2 * stepY - cubeH);
      ctx.lineTo(x - stepX + 2, y + stepY - cubeH + 1);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 5. 시점 가이드 화살표 (Front / Side / Top)
    const view = options?.view;
    if (view === 'front') {
      // 앞(Front): 남서쪽 (좌하단 -> 우상단)
      const fx = cx - maxW * 0.32;
      const fy = cy + maxH * 0.28;
      ctx.save();
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#FFCB4D';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('앞(Front) ↗️', fx, fy);
      ctx.restore();
    } else if (view === 'side') {
      // 옆(Side): 남동쪽 (우하단 -> 좌상단)
      const sx = cx + maxW * 0.32;
      const sy = cy + maxH * 0.28;
      ctx.save();
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#FFCB4D';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('↖️ 옆(Right)', sx, sy);
      ctx.restore();
    } else if (view === 'top') {
      const tx = cx;
      const ty = cy - maxH * 0.38;
      ctx.save();
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#FFCB4D';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('위(Top) ⬇️', tx, ty);
      ctx.restore();
    }

    // 6. 상단 라벨 배지
    if (options?.label) {
      ctx.save();
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#28E6FF';
      ctx.fillText(options.label, cx, cy - maxH * 0.44);
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * 주사위/정육면체 1-4-1 전개도 렌더링
   *
   * @param ctx 캔버스 2D 컨텍스트
   * @param net 전개도 데이터 (face, faces, points)
   * @param cx 중심 X
   * @param cy 중심 Y
   * @param maxW 최대 너비
   * @param maxH 최대 높이
   */
  renderCubeNet(
    ctx: CanvasRenderingContext2D,
    net: CubeNetShape,
    cx: number,
    cy: number,
    maxW: number,
    maxH: number,
  ): void {
    // 1-4-1 전개도 그리드 (3행 4열)
    // Row 0: col 1 -> Face faces[0] (2)
    // Row 1: col 0 -> Face faces[1] (4)
    // Row 1: col 1 -> Face faces[2] (1)
    // Row 1: col 2 -> Face faces[3] (3)
    // Row 1: col 3 -> Face faces[5] (6)
    // Row 2: col 1 -> Face faces[4] (5)

    const faces = net.faces && net.faces.length >= 6 ? net.faces : [2, 4, 1, 3, 5, 6];

    interface CellDef {
      r: number;
      c: number;
      faceNum: number;
    }

    const cells: CellDef[] = [
      { r: 0, c: 1, faceNum: faces[0] }, // 상단 날개
      { r: 1, c: 0, faceNum: faces[1] }, // 가로 스트립 1
      { r: 1, c: 1, faceNum: faces[2] }, // 가로 스트립 2
      { r: 1, c: 2, faceNum: faces[3] }, // 가로 스트립 3
      { r: 1, c: 3, faceNum: faces[5] }, // 가로 스트립 4 (맞은편 1)
      { r: 2, c: 1, faceNum: faces[4] }, // 하단 날개 (맞은편 2)
    ];

    const cellSize = Math.min(maxW / 4.6, maxH / 3.6, 68);
    const originX = cx - 2 * cellSize;
    const originY = cy - 1.5 * cellSize;

    ctx.save();

    // 1. 각 정사각형 면 렌더링
    for (const cell of cells) {
      const bx = originX + cell.c * cellSize;
      const by = originY + cell.r * cellSize;

      const isTarget = net.face !== undefined && net.face === cell.faceNum;

      ctx.save();
      // 배경 채우기
      ctx.fillStyle = isTarget ? 'rgba(255, 203, 77, 0.28)' : 'rgba(18, 30, 58, 0.88)';
      ctx.fillRect(bx, by, cellSize, cellSize);

      // 테두리
      ctx.strokeStyle = isTarget ? '#FFCB4D' : '#28E6FF';
      ctx.lineWidth = isTarget ? 3.5 : 2;
      ctx.strokeRect(bx, by, cellSize, cellSize);

      // 면 번호 텍스트
      ctx.font = `bold ${Math.round(cellSize * 0.44)}px sans-serif`;
      ctx.fillStyle = isTarget ? '#FFCB4D' : '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cell.faceNum), bx + cellSize / 2, by + cellSize / 2);

      ctx.restore();
    }

    // 2. 접는 선 점선 처리 (내부 인접 경계)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    // (0,1)과 (1,1) 사이 가로선
    ctx.beginPath();
    ctx.moveTo(originX + cellSize, originY + cellSize);
    ctx.lineTo(originX + 2 * cellSize, originY + cellSize);
    // (1,1)과 (2,1) 사이 가로선
    ctx.moveTo(originX + cellSize, originY + 2 * cellSize);
    ctx.lineTo(originX + 2 * cellSize, originY + 2 * cellSize);
    // 가로 스트립 세로 접는선들
    ctx.moveTo(originX + cellSize, originY + cellSize);
    ctx.lineTo(originX + cellSize, originY + 2 * cellSize);
    ctx.moveTo(originX + 2 * cellSize, originY + cellSize);
    ctx.lineTo(originX + 2 * cellSize, originY + 2 * cellSize);
    ctx.moveTo(originX + 3 * cellSize, originY + cellSize);
    ctx.lineTo(originX + 3 * cellSize, originY + 2 * cellSize);
    ctx.stroke();
    ctx.restore();

    // 3. 꼭짓점 기호 (점 ㄱ, 점 ㅂ, 점 ㄹ 등) 렌더링
    if (net.points && net.points.length > 0) {
      for (const pt of net.points) {
        const vx = originX + pt.c * cellSize;
        const vy = originY + pt.r * cellSize;

        ctx.save();
        // 점 마커
        ctx.beginPath();
        ctx.arc(vx, vy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#FF865E';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 텍스트 라벨 (살짝 바깥쪽으로 오프셋)
        const offsetX = pt.c <= 1 ? -16 : 16;
        const offsetY = pt.r === 0 ? -16 : 16;

        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#FF865E';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pt.t, vx + offsetX, vy + offsetY);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  /**
   * 화살표 회전(arrow_rot) 렌더링
   */
  renderArrowRot(
    ctx: CanvasRenderingContext2D,
    arrow: ArrowRotShape,
    cx: number,
    cy: number,
    maxW: number,
    maxH: number,
  ): void {
    ctx.save();
    const size = Math.min(maxW, maxH) * 0.45;

    // 회전 각도 가이드 원호
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.7, 0, (arrow.deg * Math.PI) / 180);
    ctx.strokeStyle = '#FFCB4D';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]);
    ctx.stroke();

    // 화살표 텍스트 또는 기호
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((arrow.deg * Math.PI) / 180);
    ctx.font = `${Math.round(size)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(arrow.from, 0, 0);
    ctx.restore();

    // 각도 표시 텍스트
    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#28E6FF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${arrow.deg}° 회전`, cx, cy + size * 0.85);

    ctx.restore();
  }

  /**
   * 문제 영역 내부 겹침 없는 프레임 패널과 함께 도형 렌더링
   */
  renderShape(
    ctx: CanvasRenderingContext2D,
    shape: ParsedShape,
    cx: number,
    cy: number,
    w: number,
    h: number,
  ): boolean {
    ctx.save();

    // 반투명 네온 배경 프레임
    const pad = 12;
    const boxX = cx - w / 2;
    const boxY = cy - h / 2;

    ctx.fillStyle = 'rgba(10, 18, 36, 0.82)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(boxX, boxY, w, h, 16);
    } else {
      ctx.rect(boxX, boxY, w, h);
    }
    ctx.fill();

    ctx.strokeStyle = 'rgba(40, 230, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 내부 실제 도형 렌더링
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;

    if (shape.type === 'stack_cubes') {
      this.renderStackCubes(ctx, shape.grid, cx, cy, innerW, innerH, {
        label: shape.shapeName,
        view: shape.view,
      });
    } else if (shape.type === 'cube_net') {
      this.renderCubeNet(ctx, shape, cx, cy, innerW, innerH);
    } else if (shape.type === 'arrow_rot') {
      this.renderArrowRot(ctx, shape, cx, cy, innerW, innerH);
    }

    ctx.restore();
    return true;
  }
}
