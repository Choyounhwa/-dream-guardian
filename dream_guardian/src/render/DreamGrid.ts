/**
 * DreamGrid - 3D 원근 와이어프레임 드림 그리드 렌더러
 *
 * Issue #27 & 피드백 반영:
 * - 보스 위치를 단일 소실점(Vanishing Point)으로 설정
 * - 3D 투영 공식 기반 가로/세로 그리드 정방형(Square Cell) 비율 계산
 * - 바닥 및 천장 원근 와이어프레임과 중앙 심도 암흑 공간 연출
 * - 달리기 속도 연동 및 챕터별 테마 색상 보간
 */

export interface DreamGridConfig {
  vanishingX?: number; // 기본값: w * 0.5
  vanishingY?: number; // 기본값: h * 0.26
  color?: string;
  speed?: number;
  cellAspect?: number; // 정방형 보정 계수
  hasCeiling?: boolean;
  alpha?: number;
}

export class DreamGrid {
  private _offset = 0;
  private _speed = 1.2;
  private _color = '#28E6FF';
  private _alpha = 0.22;
  private _hasCeiling = true;

  constructor(config?: DreamGridConfig) {
    if (config?.color) this._color = config.color;
    if (config?.speed !== undefined) this._speed = config.speed;
    if (config?.alpha !== undefined) this._alpha = config.alpha;
    if (config?.hasCeiling !== undefined) this._hasCeiling = config.hasCeiling;
  }

  get offset(): number {
    return this._offset;
  }

  setColor(color: string): void {
    this._color = color;
  }

  setSpeed(speed: number): void {
    this._speed = speed;
  }

  /**
   * 매 프레임 스크롤 오프셋 갱신
   * @param dt 델타 타임
   * @param speedMultiplier 달리기 속도 배율
   */
  update(dt: number, speedMultiplier = 1.0): void {
    const delta = dt * this._speed * speedMultiplier;
    this._offset = (this._offset + delta) % 1.0;
  }

  /**
   * 3D 원근 그리드 렌더링
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number, config?: DreamGridConfig): void {
    const vx = config?.vanishingX ?? w * 0.5;
    const vy = config?.vanishingY ?? h * 0.26;
    const color = config?.color ?? this._color;
    const baseAlpha = config?.alpha ?? this._alpha;
    const hasCeiling = config?.hasCeiling ?? this._hasCeiling;

    ctx.save();

    // 1. 소실점 중심의 깊은 심도 암흑 구역 (보스가 돋보이도록)
    const voidRadius = Math.min(w, h) * 0.35;
    const voidGrad = ctx.createRadialGradient(vx, vy, 0, vx, vy, voidRadius);
    voidGrad.addColorStop(0, 'rgba(5, 5, 15, 0.95)');
    voidGrad.addColorStop(0.6, 'rgba(8, 8, 22, 0.7)');
    voidGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = voidGrad;
    ctx.beginPath();
    ctx.arc(vx, vy, voidRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. 바닥 그리드 렌더링
    this._renderFloorGrid(ctx, w, h, vx, vy, color, baseAlpha);

    // 3. 천장 그리드 렌더링 (옵션)
    if (hasCeiling) {
      this._renderCeilingGrid(ctx, w, vx, vy, color, baseAlpha * 0.65);
    }

    ctx.restore();
  }

  /**
   * 바닥 3D 원근 그리드 (정방형 격자 계산)
   */
  private _renderFloorGrid(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    vx: number,
    vy: number,
    color: string,
    baseAlpha: number,
  ): void {
    const floorH = h - vy;
    if (floorH <= 0) return;

    const zNear = 1.0;
    const deltaZ = 0.18;
    const lineCountZ = 18;

    // 가로선 깊이 및 Y 좌표 계산
    const hLinesY: number[] = [];
    for (let k = 0; k < lineCountZ; k++) {
      const z = zNear + (k - this._offset) * deltaZ;
      if (z <= 0.1) continue;
      const y = vy + (floorH * zNear) / z;
      if (y >= vy && y <= h + 10) {
        hLinesY.push(y);
      }
    }

    // 전경(화면 하단)에서의 정방형 셀 폭 계산:
    // deltaY_bottom = floorH * deltaZ / (zNear + deltaZ)
    const stepXBottom = Math.max(30, floorH * (deltaZ / (zNear + deltaZ)) * 1.8);
    const colCount = Math.ceil((w * 0.5) / stepXBottom) + 2;

    // ── 가로(Horizontal) 라인 드로잉 ──
    for (let i = 0; i < hLinesY.length; i++) {
      const y = hLinesY[i];
      const depthRatio = (y - vy) / floorH; // 0 (소실점) ~ 1 (하단)
      const lineAlpha = baseAlpha * Math.pow(depthRatio, 1.2);
      if (lineAlpha < 0.01) continue;

      const halfW = (w * 0.5 + 40) * depthRatio;

      ctx.strokeStyle = color;
      ctx.globalAlpha = Math.min(1, lineAlpha);
      ctx.lineWidth = Math.max(1, depthRatio * 2.5);

      ctx.beginPath();
      ctx.moveTo(vx - halfW, y);
      ctx.lineTo(vx + halfW, y);
      ctx.stroke();
    }

    // ── 세로(Vertical) 원근 방사선 드로잉 ──
    for (let j = -colCount; j <= colCount; j++) {
      const xBottom = vx + j * stepXBottom;

      ctx.strokeStyle = color;
      ctx.globalAlpha = baseAlpha * 0.85;
      ctx.lineWidth = j === 0 ? 2.5 : 1.2;

      ctx.beginPath();
      // 소실점에서 출발하여 하단 경계까지
      ctx.moveTo(vx, vy);
      ctx.lineTo(xBottom, h);
      ctx.stroke();
    }
  }

  /**
   * 천장 3D 원근 그리드
   */
  private _renderCeilingGrid(
    ctx: CanvasRenderingContext2D,
    w: number,
    vx: number,
    vy: number,
    color: string,
    baseAlpha: number,
  ): void {
    const ceilH = vy;
    if (ceilH <= 0) return;

    const zNear = 1.0;
    const deltaZ = 0.22;
    const lineCountZ = 12;

    const hLinesY: number[] = [];
    for (let k = 0; k < lineCountZ; k++) {
      const z = zNear + (k - this._offset) * deltaZ;
      if (z <= 0.1) continue;
      const y = vy - (ceilH * zNear) / z;
      if (y >= -10 && y <= vy) {
        hLinesY.push(y);
      }
    }

    const stepXTop = Math.max(40, ceilH * (deltaZ / (zNear + deltaZ)) * 2.2);
    const colCount = Math.ceil((w * 0.5) / stepXTop) + 1;

    for (let i = 0; i < hLinesY.length; i++) {
      const y = hLinesY[i];
      const depthRatio = (vy - y) / ceilH;
      const lineAlpha = baseAlpha * Math.pow(depthRatio, 1.2);
      if (lineAlpha < 0.01) continue;

      const halfW = (w * 0.5 + 20) * depthRatio;

      ctx.strokeStyle = color;
      ctx.globalAlpha = Math.min(1, lineAlpha);
      ctx.lineWidth = Math.max(1, depthRatio * 1.8);

      ctx.beginPath();
      ctx.moveTo(vx - halfW, y);
      ctx.lineTo(vx + halfW, y);
      ctx.stroke();
    }

    for (let j = -colCount; j <= colCount; j++) {
      const xTop = vx + j * stepXTop;

      ctx.strokeStyle = color;
      ctx.globalAlpha = baseAlpha * 0.7;
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.lineTo(xTop, 0);
      ctx.stroke();
    }
  }
}
