/**
 * BoneRenderer - 뼈대 라인 렌더링
 *
 * SKELETON_CONNECTIONS에 정의된 쌍을 네온 라인으로 연결
 *
 * @see Issue #9 (GitHub #74)
 */

import type { NormalizedLandmark } from '../types/index.js';
import { SKELETON_CONNECTIONS } from '../types/index.js';

export interface BoneRendererOptions {
  /** 뼈대 라인 색상 (기본 반투명 시안) */
  color?: string;
  /** 뼈대 라인 두께 (기본 3) */
  lineWidth?: number;
  /** 신뢰도 임계값 */
  visibilityThreshold?: number;
}

export class BoneRenderer {
  private _color: string;
  private _lineWidth: number;
  private _visibilityThreshold: number;

  constructor(options?: BoneRendererOptions) {
    this._color = options?.color ?? 'rgba(40, 230, 255, 0.6)';
    this._lineWidth = options?.lineWidth ?? 3;
    this._visibilityThreshold = options?.visibilityThreshold ?? 0.5;
  }

  /** 뼈대 연결 수 */
  get connectionCount(): number {
    return SKELETON_CONNECTIONS.length;
  }

  /**
   * 모든 뼈대 라인을 캔버스에 드로잉
   */
  render(
    ctx: CanvasRenderingContext2D,
    landmarks: readonly NormalizedLandmark[],
    scale = 1,
  ): void {
    ctx.strokeStyle = this._color;
    ctx.lineWidth = this._lineWidth * scale;
    ctx.lineCap = 'round';

    for (const [a, b] of SKELETON_CONNECTIONS) {
      const lmA = landmarks[a];
      const lmB = landmarks[b];

      if (!lmA || !lmB) continue;
      if (lmA.visibility < this._visibilityThreshold) continue;
      if (lmB.visibility < this._visibilityThreshold) continue;

      ctx.beginPath();
      ctx.moveTo(lmA.x, lmA.y);
      ctx.lineTo(lmB.x, lmB.y);
      ctx.stroke();
    }
  }
}
