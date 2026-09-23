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
import { CURSOR_CONFIDENCE_THRESHOLD, CURSOR_DIMENSIONS } from '../../config/cursor.config.js';

export interface CursorSize {
  /** 원형/손 커서의 경우 반지름 (픽셀 단위) */
  radius?: number;
  /** 타원/머리 커서의 경우 가로/세로 반지름 (픽셀 단위) */
  radiusX?: number;
  radiusY?: number;
  /** 역삼각/골반 커서의 경우 반너비 및 높이 오프셋 (픽셀 단위) */
  halfWidth?: number;
  topOffset?: number;
  bottomOffset?: number;
}

export interface CursorPosition {
  type: CursorType;
  /** 정규화 좌표 (0~1) */
  x: number;
  y: number;
  confidence: number;
  source: 'hands' | 'pose';
  /** 신체 부위 크기 추정 기반 동적 크기 (Issue #117) */
  size?: CursorSize;
}

export interface PalmPositions {
  leftPalm?: { x: number; y: number; confidence?: number };
  rightPalm?: { x: number; y: number; confidence?: number };
}

/** 뷰포트 프로젝션 함수 (Cover 변환 등) */
export type ViewportProjectFn = (
  lm: { x: number; y: number },
  vw: number,
  vh: number,
) => { x: number; y: number };

export interface CursorTrackerOptions {
  virtualWidth?: number;
  virtualHeight?: number;
  projectFn?: ViewportProjectFn;
}

export interface CursorUpdateOptions {
  /** 이미 가상 캔버스 픽셀 좌표(0~vw, 0~vh)로 투영된 랜드마크인지 여부 */
  isVirtual?: boolean;
  virtualWidth?: number;
  virtualHeight?: number;
  projectFn?: ViewportProjectFn;
}

const CONFIDENCE_THRESHOLD = CURSOR_CONFIDENCE_THRESHOLD;

export class CursorTracker {
  private _cursors = new Map<CursorType, CursorPosition>();
  private _smoothedPositions = new Map<CursorType, { x: number; y: number }>();
  private _virtualWidth = 1;
  private _virtualHeight = 1;
  private _projectFn?: ViewportProjectFn;

  constructor(options?: CursorTrackerOptions) {
    if (options?.virtualWidth) this._virtualWidth = options.virtualWidth;
    if (options?.virtualHeight) this._virtualHeight = options.virtualHeight;
    this._projectFn = options?.projectFn;
  }

  /** 커서 및 스무딩 위치 초기화 */
  reset(): void {
    this._cursors.clear();
    this._smoothedPositions.clear();
  }

  get cursors(): ReadonlyMap<CursorType, CursorPosition> {
    return this._cursors;
  }

  get virtualWidth(): number {
    return this._virtualWidth;
  }

  get virtualHeight(): number {
    return this._virtualHeight;
  }

  get projectFn(): ViewportProjectFn | undefined {
    return this._projectFn;
  }

  /**
   * 뷰포트 해상도 및 비디오 Cover 프로젝션 함수 설정
   */
  setViewport(virtualWidth: number, virtualHeight: number, projectFn?: ViewportProjectFn): void {
    this._virtualWidth = virtualWidth;
    this._virtualHeight = virtualHeight;
    if (projectFn !== undefined) {
      this._projectFn = projectFn;
    }
  }

  getCursor(type: CursorType): CursorPosition | null {
    return this._cursors.get(type) ?? null;
  }

  /**
   * 단일 좌표를 캔버스 정규화 좌표(0~1)로 변환
   */
  private _transformPoint(
    pt: { x: number; y: number },
    isMirrored: boolean,
    options?: CursorUpdateOptions,
  ): { x: number; y: number } {
    const vw = options?.virtualWidth ?? this._virtualWidth;
    const vh = options?.virtualHeight ?? this._virtualHeight;
    const isVirtual = options?.isVirtual ?? false;
    const projectFn = options?.projectFn ?? this._projectFn;

    if (isVirtual && vw > 0 && vh > 0) {
      // 이미 Cover 변환 + 미러링이 적용된 가상 캔버스 픽셀 좌표 (0~vw, 0~vh)
      return {
        x: pt.x / vw,
        y: pt.y / vh,
      };
    }

    if (projectFn && vw > 0 && vh > 0) {
      // Cover 변환 프로젝션 적용 (Cover 함수 내부에서 미러링 및 확대 적용)
      const projected = projectFn(pt, vw, vh);
      return {
        x: projected.x / vw,
        y: projected.y / vh,
      };
    }

    // 기본 정규화(0~1) 좌표
    return {
      x: isMirrored ? 1 - pt.x : pt.x,
      y: pt.y,
    };
  }

  /**
   * Pose 관절로부터 손바닥(Palm) 중심점 및 손 길이 추정 (Issue #117, Issue #144)
   * 1순위: 손목(#15/#16), 검지 기저(#19/#20), 소지 기저(#17/#18)의 가중 중심
   * 2순위: 단일 손가락 기저부 방향 전진
   * 3순위: 팔꿈치 유효 시 전완 벡터 16% 연장
   * 4순위: 팔꿈치 결손(화면 밖 이탈) 시 어깨-손목 벡터 기반 40~70px 전진 (상반신 근접 가상 뷰포트 환경)
   */
  private _estimatePalmCenter(
    wrist: NormalizedLandmark,
    elbow: NormalizedLandmark | undefined,
    indexKnuckle: NormalizedLandmark | undefined,
    pinkyKnuckle: NormalizedLandmark | undefined,
    shoulder?: NormalizedLandmark | undefined,
    isVirtual = false,
  ): { pt: { x: number; y: number }; confidence: number; handLength: number } {
    const wristConf = wrist.visibility ?? 1;
    const indexConf = indexKnuckle?.visibility ?? 0;
    const pinkyConf = pinkyKnuckle?.visibility ?? 0;
    const maxHandLen = isVirtual ? 260 : 0.22;
    const maxArmLen = isVirtual ? 600 : 0.45;
    const maxFullArmLen = isVirtual ? 1200 : 0.90;

    // 1순위: 양 손가락 관절 모두 유효 -> 가중 중심 (실제 손바닥 중심점)
    if (indexKnuckle && pinkyKnuckle && indexConf >= 0.35 && pinkyConf >= 0.35) {
      const handDx = indexKnuckle.x - wrist.x;
      const handDy = indexKnuckle.y - wrist.y;
      const handLength = Math.sqrt(handDx * handDx + handDy * handDy);

      if (handLength > 0.005 && handLength <= maxHandLen) {
        return {
          pt: {
            x: wrist.x * 0.4 + indexKnuckle.x * 0.35 + pinkyKnuckle.x * 0.25,
            y: wrist.y * 0.4 + indexKnuckle.y * 0.35 + pinkyKnuckle.y * 0.25,
          },
          confidence: Math.max(wristConf, Math.min(indexConf, pinkyConf)),
          handLength,
        };
      }
    }

    // 2순위: 단일 손가락 관절 유효 (검지 기저 또는 소지 기저)
    if (indexKnuckle && indexConf >= 0.35) {
      const handDx = indexKnuckle.x - wrist.x;
      const handDy = indexKnuckle.y - wrist.y;
      const handLength = Math.sqrt(handDx * handDx + handDy * handDy);
      if (handLength > 0.005 && handLength <= maxHandLen) {
        return {
          pt: {
            x: wrist.x + handDx * 0.55,
            y: wrist.y + handDy * 0.55,
          },
          confidence: Math.max(wristConf, indexConf),
          handLength,
        };
      }
    }
    if (pinkyKnuckle && pinkyConf >= 0.35) {
      const handDx = pinkyKnuckle.x - wrist.x;
      const handDy = pinkyKnuckle.y - wrist.y;
      const handLength = Math.sqrt(handDx * handDx + handDy * handDy);
      if (handLength > 0.005 && handLength <= maxHandLen) {
        return {
          pt: {
            x: wrist.x + handDx * 0.55,
            y: wrist.y + handDy * 0.55,
          },
          confidence: Math.max(wristConf, pinkyConf),
          handLength,
        };
      }
    }

    // 3순위: 손가락 관절 부재/이탈 시 팔꿈치가 손목과 유효 범위 내에 있는 경우: 전완 방향 16% 연장
    if (elbow && (elbow.visibility ?? 0) >= 0.35) {
      const armDx = wrist.x - elbow.x;
      const armDy = wrist.y - elbow.y;
      const armLen = Math.sqrt(armDx * armDx + armDy * armDy);
      if (armLen > 0.01 && armLen <= maxArmLen) {
        return {
          pt: {
            x: wrist.x + armDx * 0.16,
            y: wrist.y + armDy * 0.16,
          },
          confidence: wristConf,
          handLength: armLen * 0.25,
        };
      }
    }

    // 4순위 (Issue #144): 팔꿈치 결손(화면 밖 이탈) 시 어깨-손목 벡터 기반 40~70px 전진 (상반신 근접 가상 뷰포트 환경)
    if (isVirtual && shoulder && (shoulder.visibility ?? 0) >= 0.35) {
      const fullArmDx = wrist.x - shoulder.x;
      const fullArmDy = wrist.y - shoulder.y;
      const fullArmLen = Math.sqrt(fullArmDx * fullArmDx + fullArmDy * fullArmDy);
      if (fullArmLen > 20 && fullArmLen <= maxFullArmLen) {
        const advance = Math.max(40, Math.min(70, fullArmLen * 0.12));
        return {
          pt: {
            x: wrist.x + (fullArmDx / fullArmLen) * advance,
            y: wrist.y + (fullArmDy / fullArmLen) * advance,
          },
          confidence: wristConf,
          handLength: advance * 2.0,
        };
      }
    }

    // 손목 관절 단독 fallback
    return {
      pt: { x: wrist.x, y: wrist.y },
      confidence: wristConf,
      handLength: 0,
    };
  }

  /**
   * 다계층 안면 크기 추정 파이프라인 (Issue #144 / BUG-SCALE-002)
   * 1순위: 양 귀 간격 (#7-#8)
   * 2순위: 양 눈 간격 (#2-#5)에 안면 비례계수(2.6) 적용
   * 3순위: 어깨 너비 기반 scaleFactor 적용
   * Fallback: scaleFactor 기반 기본값
   */
  private _estimateHeadSize(
    landmarks: readonly NormalizedLandmark[],
    isVirtual: boolean,
    vw: number,
    _vh: number,
    scaleFactor: number,
  ): { radiusX: number; radiusY: number } {
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    const leftEye = landmarks[2];
    const rightEye = landmarks[5];

    const earConf = Math.min(leftEar?.visibility ?? 0, rightEar?.visibility ?? 0);
    const eyeConf = Math.min(leftEye?.visibility ?? 0, rightEye?.visibility ?? 0);

    // 1순위: 양 귀 간격 (#7-#8)
    if (leftEar && rightEar && earConf >= 0.35) {
      const eDx = leftEar.x - rightEar.x;
      const eDy = leftEar.y - rightEar.y;
      const earDist = Math.sqrt(eDx * eDx + eDy * eDy);
      const earDistPx = isVirtual ? earDist : earDist * vw;
      if (earDistPx >= 30) {
        return {
          radiusX: Math.max(CURSOR_DIMENSIONS.head.minRadiusX, Math.min(CURSOR_DIMENSIONS.head.maxRadiusX, Math.round(earDistPx * 0.45))),
          radiusY: Math.max(CURSOR_DIMENSIONS.head.minRadiusY, Math.min(CURSOR_DIMENSIONS.head.maxRadiusY, Math.round(earDistPx * 0.60))),
        };
      }
    }

    // 2순위 (귀 가림/헤드셋 시): 양 눈 간격 (#2-#5) × 2.6
    if (leftEye && rightEye && eyeConf >= 0.35) {
      const eyeDx = leftEye.x - rightEye.x;
      const eyeDy = leftEye.y - rightEye.y;
      const eyeDist = Math.sqrt(eyeDx * eyeDx + eyeDy * eyeDy);
      const eyeDistPx = isVirtual ? eyeDist : eyeDist * vw;
      if (eyeDistPx >= 12) {
        const estimatedHeadWidth = eyeDistPx * 2.6;
        return {
          radiusX: Math.max(CURSOR_DIMENSIONS.head.minRadiusX, Math.min(CURSOR_DIMENSIONS.head.maxRadiusX, Math.round(estimatedHeadWidth * 0.45))),
          radiusY: Math.max(CURSOR_DIMENSIONS.head.minRadiusY, Math.min(CURSOR_DIMENSIONS.head.maxRadiusY, Math.round(estimatedHeadWidth * 0.60))),
        };
      }
    }

    // 3순위 (눈도 가림 시) 및 기본 Fallback: 어깨 너비 기반 scaleFactor 비례
    return {
      radiusX: Math.max(CURSOR_DIMENSIONS.head.minRadiusX, Math.min(CURSOR_DIMENSIONS.head.maxRadiusX, Math.round(CURSOR_DIMENSIONS.head.defaultRadiusX * scaleFactor))),
      radiusY: Math.max(CURSOR_DIMENSIONS.head.minRadiusY, Math.min(CURSOR_DIMENSIONS.head.maxRadiusY, Math.round(CURSOR_DIMENSIONS.head.defaultRadiusY * scaleFactor))),
    };
  }

  /**
   * 화면 경계 클램핑 및 지수 보간(Lerp Factor 0.25) (Issue #118)
   */
  private _smoothAndClamp(
    type: CursorType,
    targetX: number,
    targetY: number,
    isFallback: boolean,
    lerpFactor = 0.25,
    margin = 0.02,
  ): { x: number; y: number } {
    const prev = this._smoothedPositions.get(type);
    let smoothedX = targetX;
    let smoothedY = targetY;

    if (isFallback && prev) {
      smoothedX = prev.x + (targetX - prev.x) * lerpFactor;
      smoothedY = prev.y + (targetY - prev.y) * lerpFactor;
    }

    const clampedX = Math.max(margin, Math.min(1 - margin, smoothedX));
    const clampedY = Math.max(margin, Math.min(1 - margin, smoothedY));

    this._smoothedPositions.set(type, { x: clampedX, y: clampedY });
    return { x: clampedX, y: clampedY };
  }

  /**
   * 계층적 관절 후보 중 유효한(신뢰도 충족 및 화면 내부) 최상위 관절 탐색 (Issue #118)
   */
  private _resolveHierarchy(
    type: CursorType,
    candidates: Array<{ pt: { x: number; y: number }; confidence: number }>,
    isMirrored: boolean,
    effectiveOptions: CursorUpdateOptions,
  ): { x: number; y: number; confidence: number; isFallback: boolean } | null {
    if (candidates.length === 0) return null;

    // 1순위 후보 (기본 손바닥/코/골반)
    const primary = candidates[0];
    if (primary && primary.confidence >= CONFIDENCE_THRESHOLD) {
      const primaryTrans = this._transformPoint(primary.pt, isMirrored, effectiveOptions);
      const isPrimaryInBounds =
        primaryTrans.x >= 0.0 && primaryTrans.x <= 1.0 && primaryTrans.y >= 0.0 && primaryTrans.y <= 1.0;

      if (isPrimaryInBounds) {
        // 기본 관절이 정상 화면 내부인 경우 지연 없이 1:1 동기화
        this._smoothedPositions.set(type, { x: primaryTrans.x, y: primaryTrans.y });
        return { x: primaryTrans.x, y: primaryTrans.y, confidence: primary.confidence, isFallback: false };
      }
    }

    // 1순위가 화면 밖이거나 신뢰도 부족 시: 상위 계층 순차 탐색 (Fallback)
    for (let i = 1; i < candidates.length; i++) {
      const cand = candidates[i];
      if (cand.confidence < CONFIDENCE_THRESHOLD) continue;
      const trans = this._transformPoint(cand.pt, isMirrored, effectiveOptions);
      const isInBounds = trans.x >= 0.0 && trans.x <= 1.0 && trans.y >= 0.0 && trans.y <= 1.0;
      if (isInBounds) {
        const smoothed = this._smoothAndClamp(type, trans.x, trans.y, true);
        return { x: smoothed.x, y: smoothed.y, confidence: cand.confidence, isFallback: true };
      }
    }

    // 모든 상위 관절도 화면 밖이면 최상위 유효 관절을 마진 클램프
    const fallbackCand = candidates.find((c) => c.confidence >= CONFIDENCE_THRESHOLD) ?? primary;
    if (fallbackCand) {
      const trans = this._transformPoint(fallbackCand.pt, isMirrored, effectiveOptions);
      const clamped = this._smoothAndClamp(type, trans.x, trans.y, true);
      return { x: clamped.x, y: clamped.y, confidence: fallbackCand.confidence, isFallback: true };
    }

    return null;
  }

  /**
   * 랜드마크 프레임으로부터 4색 커서 정규화 좌표 갱신
   * @param landmarks Pose 정규화 랜드마크 33개 또는 가상 픽셀 랜드마크
   * @param palms MediaPipe Hands 손바닥 랜드마크 (선택)
   * @param isMirrored 좌우 반전 여부 (projectFn 또는 isVirtual 사용 시 내부 처리됨)
   * @param options 뷰포트 프로젝션 및 가상 좌표계 옵션 (Issue #116)
   */
  update(
    landmarks: readonly NormalizedLandmark[] | null | undefined,
    palms?: PalmPositions,
    isMirrored = false,
    options?: CursorUpdateOptions,
  ): Map<CursorType, CursorPosition> {
    this._cursors.clear();
    if (!landmarks || landmarks.length < 25) return this._cursors;

    // 가상 좌표(픽셀 단위) 자동 감지: 임의의 랜드마크 좌표가 1.5를 초과하면 가상 좌표로 판정
    const isVirtual =
      options?.isVirtual ??
      (this._virtualWidth > 1 && landmarks.some((lm) => lm.x > 1.5 || lm.y > 1.5));
    const effectiveOptions: CursorUpdateOptions = {
      ...options,
      isVirtual,
      virtualWidth: options?.virtualWidth ?? this._virtualWidth,
      virtualHeight: options?.virtualHeight ?? this._virtualHeight,
      projectFn: options?.projectFn ?? this._projectFn,
    };
    const vw = effectiveOptions.virtualWidth ?? 1080;

    // 신체 크기 및 거리(깊이) 추정: 양 어깨 간격 (#11, #12)
    // Issue #144: PC 1.5m 표준 거리 기준 baselineShoulder = 350px (정규화 0.18)
    // scaleFactor 하한 0.70으로 상향하여 PC 원거리에서도 최소 70% 크기 보장
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const baselineShoulder = isVirtual ? 350 : 0.18;
    let shoulderDist = baselineShoulder;
    if (
      leftShoulder &&
      rightShoulder &&
      (leftShoulder.visibility ?? 1) >= 0.35 &&
      (rightShoulder.visibility ?? 1) >= 0.35
    ) {
      const sDx = leftShoulder.x - rightShoulder.x;
      const sDy = leftShoulder.y - rightShoulder.y;
      shoulderDist = Math.sqrt(sDx * sDx + sDy * sDy);
    }
    const scaleFactor = Math.max(0.70, Math.min(2.0, shoulderDist / baselineShoulder));

    // 1. 머리/얼굴 커서 (코 #0 → 양 눈 중점 → 양 귀 중점 → 양 어깨 중점 4단계 Fallback)
    const nose = landmarks[0];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    const leftEye = landmarks[2];
    const rightEye = landmarks[5];
    const headCandidates: Array<{ pt: { x: number; y: number }; confidence: number }> = [];

    if (nose && (nose.visibility ?? 1) >= CONFIDENCE_THRESHOLD) {
      headCandidates.push({ pt: nose, confidence: nose.visibility ?? 1 });
    }
    if (leftEye && rightEye && (leftEye.visibility ?? 1) >= 0.35 && (rightEye.visibility ?? 1) >= 0.35) {
      headCandidates.push({
        pt: { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 },
        confidence: Math.min(leftEye.visibility ?? 1, rightEye.visibility ?? 1),
      });
    }
    if (leftEar && rightEar && (leftEar.visibility ?? 1) >= 0.35 && (rightEar.visibility ?? 1) >= 0.35) {
      headCandidates.push({
        pt: { x: (leftEar.x + rightEar.x) / 2, y: (leftEar.y + rightEar.y) / 2 },
        confidence: Math.min(leftEar.visibility ?? 1, rightEar.visibility ?? 1),
      });
    }
    if (leftShoulder && rightShoulder && (leftShoulder.visibility ?? 1) >= 0.35 && (rightShoulder.visibility ?? 1) >= 0.35) {
      headCandidates.push({
        pt: { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 },
        confidence: Math.min(leftShoulder.visibility ?? 1, rightShoulder.visibility ?? 1),
      });
    }

    const resolvedHead = this._resolveHierarchy('head', headCandidates, isMirrored, effectiveOptions);
    if (resolvedHead) {
      const vh = effectiveOptions.virtualHeight ?? 2160;
      const headSize = this._estimateHeadSize(landmarks, isVirtual, vw, vh, scaleFactor);

      this._cursors.set('head', {
        type: 'head',
        x: resolvedHead.x,
        y: resolvedHead.y,
        confidence: resolvedHead.confidence,
        source: 'pose',
        size: headSize,
      });
    }

    // 2. 골반 커서 (양 골반 중점 #23/#24 → 체간 중점 → 양 어깨 중점 3단계 Fallback)
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const hipCandidates: Array<{ pt: { x: number; y: number }; confidence: number }> = [];

    if (leftHip && rightHip && (leftHip.visibility ?? 1) >= CONFIDENCE_THRESHOLD && (rightHip.visibility ?? 1) >= CONFIDENCE_THRESHOLD) {
      const midX = (leftHip.x + rightHip.x) / 2;
      const midY = (leftHip.y + rightHip.y) / 2;
      hipCandidates.push({ pt: { x: midX, y: midY }, confidence: Math.min(leftHip.visibility ?? 1, rightHip.visibility ?? 1) });

      if (leftShoulder && rightShoulder && (leftShoulder.visibility ?? 1) >= 0.35 && (rightShoulder.visibility ?? 1) >= 0.35) {
        const sMidX = (leftShoulder.x + rightShoulder.x) / 2;
        const sMidY = (leftShoulder.y + rightShoulder.y) / 2;
        hipCandidates.push({
          pt: { x: (midX + sMidX) / 2, y: (midY + sMidY) / 2 },
          confidence: Math.min(leftHip.visibility ?? 1, rightHip.visibility ?? 1),
        });
        hipCandidates.push({
          pt: { x: sMidX, y: sMidY },
          confidence: Math.min(leftShoulder.visibility ?? 1, rightShoulder.visibility ?? 1),
        });
      }
    }

    const resolvedHip = this._resolveHierarchy('hip', hipCandidates, isMirrored, effectiveOptions);
    if (resolvedHip) {
      let hipHalfWidth = Math.round(CURSOR_DIMENSIONS.hip.defaultHalfWidth * scaleFactor);
      if (leftHip && rightHip) {
        const hDx = leftHip.x - rightHip.x;
        const hDy = leftHip.y - rightHip.y;
        const hipDist = Math.sqrt(hDx * hDx + hDy * hDy);
        const hipDistPx = isVirtual ? hipDist : hipDist * vw;
        if (hipDistPx > 20) {
          hipHalfWidth = Math.max(CURSOR_DIMENSIONS.hip.minHalfWidth, Math.min(CURSOR_DIMENSIONS.hip.maxHalfWidth, Math.round(hipDistPx * 0.28)));
        }
      }
      hipHalfWidth = Math.max(CURSOR_DIMENSIONS.hip.minHalfWidth, Math.min(CURSOR_DIMENSIONS.hip.maxHalfWidth, hipHalfWidth));
      const hipTopOffset = Math.round(hipHalfWidth * 0.58);
      const hipBottomOffset = Math.round(hipHalfWidth * 0.75);

      this._cursors.set('hip', {
        type: 'hip',
        x: resolvedHip.x,
        y: resolvedHip.y,
        confidence: resolvedHip.confidence,
        source: 'pose',
        size: { halfWidth: hipHalfWidth, topOffset: hipTopOffset, bottomOffset: hipBottomOffset },
      });
    }

    // 3. 왼손 커서 (손바닥 → 손목 #15 → 전완 중점 → 팔꿈치 #13 → 상완 중점 → 어깨 #11 6단계 Fallback)
    const leftWrist = landmarks[15];
    const leftElbow = landmarks[13];
    const leftPinky = landmarks[17];
    const leftIndex = landmarks[19];
    const leftHandCandidates: Array<{ pt: { x: number; y: number }; confidence: number }> = [];
    let leftSource: 'hands' | 'pose' = 'pose';
    let leftPalmEst = { pt: { x: 0, y: 0 }, confidence: 0, handLength: 0 };

    if (palms?.leftPalm && (palms.leftPalm.confidence ?? 1) >= CONFIDENCE_THRESHOLD) {
      leftHandCandidates.push({ pt: palms.leftPalm, confidence: palms.leftPalm.confidence ?? 1 });
      leftSource = 'hands';
    } else if (leftWrist && (leftWrist.visibility ?? 1) >= CONFIDENCE_THRESHOLD) {
      leftPalmEst = this._estimatePalmCenter(leftWrist, leftElbow, leftIndex, leftPinky, leftShoulder, isVirtual);
      leftHandCandidates.push({ pt: leftPalmEst.pt, confidence: leftPalmEst.confidence });
    }

    if (leftWrist && (leftWrist.visibility ?? 1) >= CONFIDENCE_THRESHOLD) {
      leftHandCandidates.push({ pt: leftWrist, confidence: leftWrist.visibility ?? 1 });

      if (leftElbow && (leftElbow.visibility ?? 0) >= 0.35) {
        // 전완 중점
        leftHandCandidates.push({
          pt: { x: (leftWrist.x + leftElbow.x) / 2, y: (leftWrist.y + leftElbow.y) / 2 },
          confidence: Math.min(leftWrist.visibility ?? 1, leftElbow.visibility ?? 0),
        });
        // 팔꿈치
        leftHandCandidates.push({ pt: leftElbow, confidence: leftElbow.visibility ?? 0 });

        if (leftShoulder && (leftShoulder.visibility ?? 0) >= 0.35) {
          // 상완 중점
          leftHandCandidates.push({
            pt: { x: (leftElbow.x + leftShoulder.x) / 2, y: (leftElbow.y + leftShoulder.y) / 2 },
            confidence: Math.min(leftElbow.visibility ?? 0, leftShoulder.visibility ?? 0),
          });
          // 어깨
          leftHandCandidates.push({ pt: leftShoulder, confidence: leftShoulder.visibility ?? 0 });
        }
      } else if (leftShoulder && (leftShoulder.visibility ?? 0) >= 0.35) {
        // 팔꿈치 결손 시 어깨 직접 연결 Fallback
        leftHandCandidates.push({
          pt: { x: (leftWrist.x + leftShoulder.x) / 2, y: (leftWrist.y + leftShoulder.y) / 2 },
          confidence: Math.min(leftWrist.visibility ?? 1, leftShoulder.visibility ?? 0),
        });
        leftHandCandidates.push({ pt: leftShoulder, confidence: leftShoulder.visibility ?? 0 });
      }
    }

    const resolvedLeft = this._resolveHierarchy('leftHand', leftHandCandidates, isMirrored, effectiveOptions);
    if (resolvedLeft) {
      let handRadius = Math.round(CURSOR_DIMENSIONS.hand.defaultRadius * scaleFactor);
      if (leftPalmEst.handLength > 0) {
        const handLenPx = isVirtual ? leftPalmEst.handLength : leftPalmEst.handLength * vw;
        if (handLenPx >= 30) {
          handRadius = Math.max(handRadius, Math.round(handLenPx * 0.45));
        }
      }
      handRadius = Math.max(CURSOR_DIMENSIONS.hand.minRadius, Math.min(CURSOR_DIMENSIONS.hand.maxRadius, handRadius));

      this._cursors.set('leftHand', {
        type: 'leftHand',
        x: resolvedLeft.x,
        y: resolvedLeft.y,
        confidence: resolvedLeft.confidence,
        source: leftSource,
        size: { radius: handRadius },
      });
    }

    // 4. 오른손 커서 (손바닥 → 손목 #16 → 전완 중점 → 팔꿈치 #14 → 상완 중점 → 어깨 #12 6단계 Fallback)
    const rightWrist = landmarks[16];
    const rightElbow = landmarks[14];
    const rightPinky = landmarks[18];
    const rightIndex = landmarks[20];
    const rightHandCandidates: Array<{ pt: { x: number; y: number }; confidence: number }> = [];
    let rightSource: 'hands' | 'pose' = 'pose';
    let rightPalmEst = { pt: { x: 0, y: 0 }, confidence: 0, handLength: 0 };

    if (palms?.rightPalm && (palms.rightPalm.confidence ?? 1) >= CONFIDENCE_THRESHOLD) {
      rightHandCandidates.push({ pt: palms.rightPalm, confidence: palms.rightPalm.confidence ?? 1 });
      rightSource = 'hands';
    } else if (rightWrist && (rightWrist.visibility ?? 1) >= CONFIDENCE_THRESHOLD) {
      rightPalmEst = this._estimatePalmCenter(rightWrist, rightElbow, rightIndex, rightPinky, rightShoulder, isVirtual);
      rightHandCandidates.push({ pt: rightPalmEst.pt, confidence: rightPalmEst.confidence });
    }

    if (rightWrist && (rightWrist.visibility ?? 1) >= CONFIDENCE_THRESHOLD) {
      rightHandCandidates.push({ pt: rightWrist, confidence: rightWrist.visibility ?? 1 });

      if (rightElbow && (rightElbow.visibility ?? 0) >= 0.35) {
        // 전완 중점
        rightHandCandidates.push({
          pt: { x: (rightWrist.x + rightElbow.x) / 2, y: (rightWrist.y + rightElbow.y) / 2 },
          confidence: Math.min(rightWrist.visibility ?? 1, rightElbow.visibility ?? 0),
        });
        // 팔꿈치
        rightHandCandidates.push({ pt: rightElbow, confidence: rightElbow.visibility ?? 0 });

        if (rightShoulder && (rightShoulder.visibility ?? 0) >= 0.35) {
          // 상완 중점
          rightHandCandidates.push({
            pt: { x: (rightElbow.x + rightShoulder.x) / 2, y: (rightElbow.y + rightShoulder.y) / 2 },
            confidence: Math.min(rightElbow.visibility ?? 0, rightShoulder.visibility ?? 0),
          });
          // 어깨
          rightHandCandidates.push({ pt: rightShoulder, confidence: rightShoulder.visibility ?? 0 });
        }
      } else if (rightShoulder && (rightShoulder.visibility ?? 0) >= 0.35) {
        // 팔꿈치 결손 시 어깨 직접 연결 Fallback
        rightHandCandidates.push({
          pt: { x: (rightWrist.x + rightShoulder.x) / 2, y: (rightWrist.y + rightShoulder.y) / 2 },
          confidence: Math.min(rightWrist.visibility ?? 1, rightShoulder.visibility ?? 0),
        });
        rightHandCandidates.push({ pt: rightShoulder, confidence: rightShoulder.visibility ?? 0 });
      }
    }

    const resolvedRight = this._resolveHierarchy('rightHand', rightHandCandidates, isMirrored, effectiveOptions);
    if (resolvedRight) {
      let handRadius = Math.round(CURSOR_DIMENSIONS.hand.defaultRadius * scaleFactor);
      if (rightPalmEst.handLength > 0) {
        const handLenPx = isVirtual ? rightPalmEst.handLength : rightPalmEst.handLength * vw;
        if (handLenPx >= 30) {
          handRadius = Math.max(handRadius, Math.round(handLenPx * 0.45));
        }
      }
      handRadius = Math.max(CURSOR_DIMENSIONS.hand.minRadius, Math.min(CURSOR_DIMENSIONS.hand.maxRadius, handRadius));

      this._cursors.set('rightHand', {
        type: 'rightHand',
        x: resolvedRight.x,
        y: resolvedRight.y,
        confidence: resolvedRight.confidence,
        source: rightSource,
        size: { radius: handRadius },
      });
    }

    return this._cursors;
  }
}
