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
  /** 손목에서 손바닥 중심까지 뼈대 연장 드로잉 여부 (기본 false) */
  renderHandBones?: boolean;
}

export class BoneRenderer {
  private _color: string;
  private _lineWidth: number;
  private _visibilityThreshold: number;
  private _renderHandBones: boolean;

  constructor(options?: BoneRendererOptions) {
    this._color = options?.color ?? 'rgba(40, 230, 255, 0.6)';
    this._lineWidth = options?.lineWidth ?? 3;
    this._visibilityThreshold = options?.visibilityThreshold ?? 0.5;
    this._renderHandBones = options?.renderHandBones ?? false;
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

    // 옵션 활성화 시: 손목 → 손바닥 중심 뼈대 연장 (스켈레톤 손목이 아닌 손바닥 도달)
    if (this._renderHandBones) {
      const renderHandBone = (wristIdx: number, elbowIdx: number, indexIdx: number, pinkyIdx: number, shoulderIdx: number) => {
        const wrist = landmarks[wristIdx];
        if (!wrist || wrist.visibility < this._visibilityThreshold) return;
        const elbow = landmarks[elbowIdx];
        const indexKnuckle = landmarks[indexIdx];
        const pinkyKnuckle = landmarks[pinkyIdx];
        const shoulder = landmarks[shoulderIdx];

        let palmX = wrist.x;
        let palmY = wrist.y;
        if (indexKnuckle && pinkyKnuckle && (indexKnuckle.visibility ?? 0) >= 0.35 && (pinkyKnuckle.visibility ?? 0) >= 0.35) {
          palmX = wrist.x * 0.4 + indexKnuckle.x * 0.35 + pinkyKnuckle.x * 0.25;
          palmY = wrist.y * 0.4 + indexKnuckle.y * 0.35 + pinkyKnuckle.y * 0.25;
        } else if (elbow && (elbow.visibility ?? 0) >= 0.35) {
          palmX = wrist.x + (wrist.x - elbow.x) * 0.18;
          palmY = wrist.y + (wrist.y - elbow.y) * 0.18;
        } else if (shoulder && (shoulder.visibility ?? 0) >= 0.35) {
          const dx = wrist.x - shoulder.x;
          const dy = wrist.y - shoulder.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 20) {
            const adv = Math.max(40, Math.min(70, len * 0.12));
            palmX = wrist.x + (dx / len) * adv;
            palmY = wrist.y + (dy / len) * adv;
          }
        }

        if (palmX !== wrist.x || palmY !== wrist.y) {
          ctx.beginPath();
          ctx.moveTo(wrist.x, wrist.y);
          ctx.lineTo(palmX, palmY);
          ctx.stroke();
        }
      };

      renderHandBone(15, 13, 19, 17, 11); // 왼손
      renderHandBone(16, 14, 20, 18, 12); // 오른손
    }
  }
}
