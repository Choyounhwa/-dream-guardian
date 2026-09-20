/**
 * JointRenderer - 관절 마커 렌더링
 *
 * 주요 관절에 색상 코딩된 마커 드로잉
 * 왼손(시안), 오른손(노랑), 어깨(보라), 골반(다이아몬드 주황)
 *
 * @see Issue #9 (GitHub #74)
 */

import type { NormalizedLandmark, JointStyle } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';

/** 기본 관절 스타일 맵 */
const DEFAULT_JOINT_STYLES: Record<number, JointStyle> = {
  // 왼손 계열 - 시안
  [POSE_LANDMARKS.LEFT_WRIST]:    { color: '#28E6FF', size: 10, shape: 'circle' },
  [POSE_LANDMARKS.LEFT_ELBOW]:    { color: '#28E6FF', size: 8,  shape: 'circle' },
  // 오른손 계열 - 노랑
  [POSE_LANDMARKS.RIGHT_WRIST]:   { color: '#FFCB4D', size: 10, shape: 'circle' },
  [POSE_LANDMARKS.RIGHT_ELBOW]:   { color: '#FFCB4D', size: 8,  shape: 'circle' },
  // 어깨 계열 - 보라
  [POSE_LANDMARKS.LEFT_SHOULDER]: { color: '#C889FF', size: 9,  shape: 'square' },
  [POSE_LANDMARKS.RIGHT_SHOULDER]:{ color: '#C889FF', size: 9,  shape: 'square' },
  // 엉덩이 - 주황 다이아몬드
  [POSE_LANDMARKS.LEFT_HIP]:      { color: '#FF865E', size: 9,  shape: 'diamond' },
  [POSE_LANDMARKS.RIGHT_HIP]:     { color: '#FF865E', size: 9,  shape: 'diamond' },
  // 무릎
  [POSE_LANDMARKS.LEFT_KNEE]:     { color: '#28E6FF', size: 7,  shape: 'circle' },
  [POSE_LANDMARKS.RIGHT_KNEE]:    { color: '#FFCB4D', size: 7,  shape: 'circle' },
  // 발목
  [POSE_LANDMARKS.LEFT_ANKLE]:    { color: '#28E6FF', size: 6,  shape: 'circle' },
  [POSE_LANDMARKS.RIGHT_ANKLE]:   { color: '#FFCB4D', size: 6,  shape: 'circle' },
  // 코
  [POSE_LANDMARKS.NOSE]:          { color: '#FFFFFF', size: 6,  shape: 'circle' },
};

/** 렌더링할 관절 인덱스 목록 */
const RENDER_JOINTS = Object.keys(DEFAULT_JOINT_STYLES).map(Number);

export class JointRenderer {
  private _styles: Record<number, JointStyle>;
  private _visibilityThreshold: number;

  constructor(
    customStyles?: Record<number, Partial<JointStyle>>,
    visibilityThreshold = 0.5,
  ) {
    this._visibilityThreshold = visibilityThreshold;
    this._styles = { ...DEFAULT_JOINT_STYLES };

    if (customStyles) {
      for (const [key, overrides] of Object.entries(customStyles)) {
        const idx = Number(key);
        if (this._styles[idx]) {
          this._styles[idx] = { ...this._styles[idx], ...overrides };
        }
      }
    }
  }

  /** 렌더링할 관절 목록 */
  get jointIndices(): readonly number[] {
    return RENDER_JOINTS;
  }

  /** 관절 스타일 조회 */
  getStyle(index: number): JointStyle | undefined {
    return this._styles[index];
  }

  /**
   * 모든 관절 마커를 캔버스에 드로잉
   */
  render(
    ctx: CanvasRenderingContext2D,
    landmarks: readonly NormalizedLandmark[],
    scale = 1,
  ): void {
    for (const idx of RENDER_JOINTS) {
      const lm = landmarks[idx];
      if (!lm || lm.visibility < this._visibilityThreshold) continue;

      const style = this._styles[idx];
      if (!style) continue;

      const size = style.size * scale;

      ctx.fillStyle = style.color;
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 2;

      switch (style.shape) {
        case 'circle':
          this._drawCircle(ctx, lm.x, lm.y, size);
          break;
        case 'square':
          this._drawSquare(ctx, lm.x, lm.y, size);
          break;
        case 'diamond':
          this._drawDiamond(ctx, lm.x, lm.y, size);
          break;
      }
    }
  }

  private _drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private _drawSquare(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    const half = s;
    ctx.fillRect(x - half, y - half, half * 2, half * 2);
  }

  private _drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    ctx.beginPath();
    ctx.moveTo(x, y - s);      // top
    ctx.lineTo(x + s, y);      // right
    ctx.lineTo(x, y + s);      // bottom
    ctx.lineTo(x - s, y);      // left
    ctx.closePath();
    ctx.fill();
  }
}
