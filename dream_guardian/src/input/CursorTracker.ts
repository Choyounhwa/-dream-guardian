/**
 * CursorTracker - MediaPipe Pose 및 Hands 기반 4색 신체 커서 좌표 추적기
 *
 * 4색 신체 커서:
 * - leftHand: 왼쪽 손바닥(Hands #9) 우선, Pose #15(왼쪽 손목) 대체 (#28E6FF)
 * - rightHand: 오른쪽 손바닥(Hands #9) 우선, Pose #16(오른쪽 손목) 대체 (#FFCB4D)
 * - head: 코 중심/얼굴 중점(Pose #0) (#C889FF)
 * - hip: 양 골반 중점(Pose #23, #24) (#FF865E)
 *
 * @see Issue #104, Issue #105
 */

import type { NormalizedLandmark } from '../types/index.js';
import type { CursorType } from './AnswerSelector.js';

export interface CursorPosition {
  type: CursorType;
  /** 정규화 좌표 (0~1) */
  x: number;
  y: number;
  confidence: number;
  source: 'hands' | 'pose';
}

export interface PalmPositions {
  leftPalm?: { x: number; y: number; confidence?: number };
  rightPalm?: { x: number; y: number; confidence?: number };
}

const CONFIDENCE_THRESHOLD = 0.45;

export class CursorTracker {
  private _cursors = new Map<CursorType, CursorPosition>();

  get cursors(): ReadonlyMap<CursorType, CursorPosition> {
    return this._cursors;
  }

  getCursor(type: CursorType): CursorPosition | null {
    return this._cursors.get(type) ?? null;
  }

  /**
   * 랜드마크 프레임으로부터 4색 커서 정규화 좌표 갱신
   * @param landmarks Pose 정규화 랜드마크 33개
   * @param palms MediaPipe Hands 손바닥 랜드마크 (선택)
   * @param isMirrored 좌우 반전 여부
   */
  update(
    landmarks: readonly NormalizedLandmark[] | null | undefined,
    palms?: PalmPositions,
    isMirrored = false,
  ): Map<CursorType, CursorPosition> {
    this._cursors.clear();
    if (!landmarks || landmarks.length < 25) return this._cursors;

    // 1. 머리/얼굴 커서 (Pose #0: 코)
    const nose = landmarks[0];
    if (nose && (nose.visibility ?? 1) >= CONFIDENCE_THRESHOLD) {
      const x = isMirrored ? 1 - nose.x : nose.x;
      this._cursors.set('head', {
        type: 'head',
        x,
        y: nose.y,
        confidence: nose.visibility ?? 1,
        source: 'pose',
      });
    }

    // 2. 골반 커서 (Pose #23: 왼골반, #24: 오른골반 중점)
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    if (
      leftHip &&
      rightHip &&
      (leftHip.visibility ?? 1) >= CONFIDENCE_THRESHOLD &&
      (rightHip.visibility ?? 1) >= CONFIDENCE_THRESHOLD
    ) {
      const midX = (leftHip.x + rightHip.x) / 2;
      const midY = (leftHip.y + rightHip.y) / 2;
      const x = isMirrored ? 1 - midX : midX;
      const conf = Math.min(leftHip.visibility ?? 1, rightHip.visibility ?? 1);
      this._cursors.set('hip', {
        type: 'hip',
        x,
        y: midY,
        confidence: conf,
        source: 'pose',
      });
    }

    // 3. 왼손 커서 (Hands 손바닥 우선, Pose #15 손목 대체)
    if (palms?.leftPalm && (palms.leftPalm.confidence ?? 1) >= CONFIDENCE_THRESHOLD) {
      this._cursors.set('leftHand', {
        type: 'leftHand',
        x: palms.leftPalm.x,
        y: palms.leftPalm.y,
        confidence: palms.leftPalm.confidence ?? 1,
        source: 'hands',
      });
    } else {
      const leftWrist = landmarks[15];
      if (leftWrist && (leftWrist.visibility ?? 1) >= CONFIDENCE_THRESHOLD) {
        const x = isMirrored ? 1 - leftWrist.x : leftWrist.x;
        this._cursors.set('leftHand', {
          type: 'leftHand',
          x,
          y: leftWrist.y,
          confidence: leftWrist.visibility ?? 1,
          source: 'pose',
        });
      }
    }

    // 4. 오른손 커서 (Hands 손바닥 우선, Pose #16 손목 대체)
    if (palms?.rightPalm && (palms.rightPalm.confidence ?? 1) >= CONFIDENCE_THRESHOLD) {
      this._cursors.set('rightHand', {
        type: 'rightHand',
        x: palms.rightPalm.x,
        y: palms.rightPalm.y,
        confidence: palms.rightPalm.confidence ?? 1,
        source: 'hands',
      });
    } else {
      const rightWrist = landmarks[16];
      if (rightWrist && (rightWrist.visibility ?? 1) >= CONFIDENCE_THRESHOLD) {
        const x = isMirrored ? 1 - rightWrist.x : rightWrist.x;
        this._cursors.set('rightHand', {
          type: 'rightHand',
          x,
          y: rightWrist.y,
          confidence: rightWrist.visibility ?? 1,
          source: 'pose',
        });
      }
    }

    return this._cursors;
  }
}
