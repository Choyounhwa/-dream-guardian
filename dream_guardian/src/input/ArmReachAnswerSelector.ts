/**
 * ArmReachAnswerSelector - Zone 4/5 한 팔 도달 기반 무체류 즉시 답안 선택기
 *
 * 8박 라운드 중 답안 단계(최대 2박)에서 한 팔을 Zone 4(좌측, 0번) 또는 Zone 5(우측, 1번)에
 * 도달시키는 방식으로 좌우 답안을 무체류(0초)로 즉시 확정하는 입력 처리기.
 *
 * - Zone 4 도달 = 0번 답안 / Zone 5 도달 = 1번 답안 고정 매핑
 * - 손 커서 색상(시안/노랑) 및 왼손/오른손 종류 무관
 * - 정적 손 위치 0s 즉시 선택 인정 (답안 창 개방 시 이미 정지 상태여도 즉시 확정)
 * - 동적 뻗기 보조 검증: 바깥 방향 수평 이동 속도 및 수평 우세비(|vx| > 1.2 * |vy|) 검증
 * - 양팔 동시 유효 시 미선택 유지 (Strict Mutual Exclusion: 4+5 또는 동시 같은 존 차단)
 * - 수직 점프 동작 오선택 차단 (수직 속도 상한 검증)
 * - 1회 단일 확정 (Idempotent Trigger) 및 키보드/터치 fallback 완전 지원
 *
 * @see Issue #224 [INPUT-ARM-ANSWER-001]
 * @see Issue #176 [BEAT-SPEC-001]
 */

import {
  DEFAULT_FITNESS_ZONES,
  type FitnessZone,
} from '../../config/zone.config.js';
import {
  DEFAULT_ARM_REACH_ANSWER_CONFIG,
  type ArmReachAnswerConfig,
} from '../../config/beat-motion.config.js';
import {
  CursorTracker,
  type CursorUpdateOptions,
  type PalmPositions,
  type ViewportProjectFn,
} from './CursorTracker.js';
import { isInsideZone } from './PostureMatcher.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../types/index.js';

export type ArmHandType = 'left' | 'right' | 'fallback';

export interface ArmCandidateStatus {
  hand: 'left' | 'right';
  zoneId: number | null;
  answerIndex: 0 | 1 | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  armExtensionRatio: number;
  isInside: boolean;
  isValid: boolean;
  isDynamicReach: boolean;
}

export interface ArmReachAnswerResult {
  /** 선택된 답안 인덱스 (0: Zone 4, 1: Zone 5) */
  answerIndex: 0 | 1;
  /** 도달한 피트니스 존 ID (4: 좌, 5: 우) */
  zoneId: 4 | 5;
  /** 선택에 사용된 손 */
  hand: ArmHandType;
  /** 판정 시점 타임스탬프 (초) */
  timestamp: number;
  /** 입력 소스 */
  source: 'motion' | 'keyboard' | 'touch';
  /** 선택 시점 손의 정규화 좌표 */
  position?: { x: number; y: number };
  /** 선택 시점 손의 속도 */
  velocity?: { vx: number; vy: number };
  /** 동적 뻗기 여부 */
  isDynamicReach?: boolean;
}

export interface ArmReachAnswerState {
  activeAnswerIndex: 0 | 1 | null;
  activeZoneId: 4 | 5 | null;
  isConfirmed: boolean;
  confirmedAnswerIndex: 0 | 1 | null;
  confirmedZoneId: 4 | 5 | null;
  confirmedHand: ArmHandType | null;
  isMutualExclusionBlocked: boolean;
  isJumpBlocked: boolean;
  isTrackingLost: boolean;
  leftHand: ArmCandidateStatus;
  rightHand: ArmCandidateStatus;
}

export type ArmReachSelectCallback = (result: ArmReachAnswerResult) => void;

interface TrackedHandPoint {
  x: number;
  y: number;
  visibility: number;
}

const EPSILON = 1e-5;

export class ArmReachAnswerSelector {
  private readonly _config: ArmReachAnswerConfig;
  private readonly _cursorTracker: CursorTracker;
  private readonly _zones: readonly FitnessZone[];
  private readonly _zone4: FitnessZone;
  private readonly _zone5: FitnessZone;

  private _isConfirmed = false;
  private _confirmedAnswerIndex: 0 | 1 | null = null;
  private _confirmedZoneId: 4 | 5 | null = null;
  private _confirmedHand: ArmHandType | null = null;
  private _lastResult: ArmReachAnswerResult | null = null;

  private _isMutualExclusionBlocked = false;
  private _isJumpBlocked = false;
  private _isTrackingLost = false;

  private _prevLeftHand: TrackedHandPoint | null = null;
  private _prevRightHand: TrackedHandPoint | null = null;
  private _prevLeftInside4 = false;
  private _prevLeftInside5 = false;
  private _prevRightInside4 = false;
  private _prevRightInside5 = false;
  private _prevBodyY: number | null = null;
  private _lastTime: number | null = null;

  private _listeners: Set<ArmReachSelectCallback> = new Set();
  public onSelect?: ArmReachSelectCallback;
  public onAnswerSelected?: ArmReachSelectCallback;

  constructor(
    config?: Partial<ArmReachAnswerConfig>,
    cursorTracker?: CursorTracker,
    zones: readonly FitnessZone[] = DEFAULT_FITNESS_ZONES,
  ) {
    this._config = {
      ...DEFAULT_ARM_REACH_ANSWER_CONFIG,
      ...config,
    };
    this._zones = zones;
    this._zone4 = this._zones.find((z) => z.id === 4) ?? DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
    this._zone5 = this._zones.find((z) => z.id === 5) ?? DEFAULT_FITNESS_ZONES.find((z) => z.id === 5)!;

    this._cursorTracker = cursorTracker ?? new CursorTracker();
  }

  get config(): ArmReachAnswerConfig {
    return this._config;
  }

  get isConfirmed(): boolean {
    return this._isConfirmed;
  }

  get confirmedAnswerIndex(): 0 | 1 | null {
    return this._confirmedAnswerIndex;
  }

  get confirmedZoneId(): 4 | 5 | null {
    return this._confirmedZoneId;
  }

  get confirmedHand(): ArmHandType | null {
    return this._confirmedHand;
  }

  get lastResult(): ArmReachAnswerResult | null {
    return this._lastResult;
  }

  get state(): ArmReachAnswerState {
    const leftStatus = this._buildCandidateStatus('left');
    const rightStatus = this._buildCandidateStatus('right');

    let activeAnswerIndex: 0 | 1 | null = null;
    let activeZoneId: 4 | 5 | null = null;

    if (!this._isMutualExclusionBlocked && !this._isJumpBlocked) {
      if (leftStatus.isValid && !rightStatus.isValid) {
        activeAnswerIndex = leftStatus.answerIndex;
        activeZoneId = leftStatus.zoneId as 4 | 5 | null;
      } else if (!leftStatus.isValid && rightStatus.isValid) {
        activeAnswerIndex = rightStatus.answerIndex;
        activeZoneId = rightStatus.zoneId as 4 | 5 | null;
      }
    }

    return {
      activeAnswerIndex,
      activeZoneId,
      isConfirmed: this._isConfirmed,
      confirmedAnswerIndex: this._confirmedAnswerIndex,
      confirmedZoneId: this._confirmedZoneId,
      confirmedHand: this._confirmedHand,
      isMutualExclusionBlocked: this._isMutualExclusionBlocked,
      isJumpBlocked: this._isJumpBlocked,
      isTrackingLost: this._isTrackingLost,
      leftHand: leftStatus,
      rightHand: rightStatus,
    };
  }

  addSelectListener(fn: ArmReachSelectCallback): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  setViewport(virtualWidth: number, virtualHeight: number, projectFn?: ViewportProjectFn): void {
    this._cursorTracker.setViewport(virtualWidth, virtualHeight, projectFn);
  }

  reset(): void {
    this._isConfirmed = false;
    this._confirmedAnswerIndex = null;
    this._confirmedZoneId = null;
    this._confirmedHand = null;
    this._lastResult = null;
    this._isMutualExclusionBlocked = false;
    this._isJumpBlocked = false;
    this._isTrackingLost = false;
    this._prevLeftHand = null;
    this._prevRightHand = null;
    this._prevLeftInside4 = false;
    this._prevLeftInside5 = false;
    this._prevRightInside4 = false;
    this._prevRightInside5 = false;
    this._prevBodyY = null;
    this._lastTime = null;
    this._cursorTracker.reset();
  }

  private _toScreenPoint(pt: { x: number; y: number }): { x: number; y: number } {
    return {
      x: this._config.isMirrored ? 1 - pt.x : pt.x,
      y: pt.y,
    };
  }

  private _buildCandidateStatus(hand: 'left' | 'right'): ArmCandidateStatus {
    const pt = hand === 'left' ? this._prevLeftHand : this._prevRightHand;
    const isInside4 = hand === 'left' ? this._prevLeftInside4 : this._prevRightInside4;
    const isInside5 = hand === 'left' ? this._prevLeftInside5 : this._prevRightInside5;

    let zoneId: number | null = null;
    let answerIndex: 0 | 1 | null = null;
    if (isInside4) {
      zoneId = 4;
      answerIndex = 0;
    } else if (isInside5) {
      zoneId = 5;
      answerIndex = 1;
    }

    return {
      hand,
      zoneId,
      answerIndex,
      x: pt?.x ?? 0,
      y: pt?.y ?? 0,
      vx: 0,
      vy: 0,
      armExtensionRatio: 0,
      isInside: isInside4 || isInside5,
      isValid: false,
      isDynamicReach: false,
    };
  }

  private _evaluateArm(
    _hand: 'left' | 'right',
    pos: TrackedHandPoint,
    prevPos: TrackedHandPoint | null,
    prevInside4: boolean,
    prevInside5: boolean,
    dt: number,
    shoulderPos: { x: number; y: number },
    shoulderWidth: number,
    isBodyJumping: boolean,
  ): {
    isValid: boolean;
    answerIndex: 0 | 1 | null;
    zoneId: 4 | 5 | null;
    vx: number;
    vy: number;
    armExtensionRatio: number;
    isInside: boolean;
    isDynamicReach: boolean;
  } {
    // 1. 가시성 검증
    if (pos.visibility < this._config.minVisibility) {
      return {
        isValid: false,
        answerIndex: null,
        zoneId: null,
        vx: 0,
        vy: 0,
        armExtensionRatio: 0,
        isInside: false,
        isDynamicReach: false,
      };
    }

    // 2. 존 내부 여부 확인
    const inZone4 = isInsideZone(pos, this._zone4);
    const inZone5 = isInsideZone(pos, this._zone5);
    const isInside = inZone4 || inZone5;

    if (!isInside) {
      return {
        isValid: false,
        answerIndex: null,
        zoneId: null,
        vx: 0,
        vy: 0,
        armExtensionRatio: 0,
        isInside: false,
        isDynamicReach: false,
      };
    }

    const targetAnswerIndex: 0 | 1 = inZone4 ? 0 : 1;
    const targetZoneId: 4 | 5 = inZone4 ? 4 : 5;

    // 3. 속도 계산
    let vx = 0;
    let vy = 0;
    if (prevPos && dt > EPSILON) {
      vx = (pos.x - prevPos.x) / dt;
      vy = (pos.y - prevPos.y) / dt;
    }

    // 4. 어깨 대비 뻗음 비율 계산
    const armExtensionDist = Math.hypot(pos.x - shoulderPos.x, pos.y - shoulderPos.y);
    const armExtensionRatio = armExtensionDist / (shoulderWidth > EPSILON ? shoulderWidth : 0.20);
    if (armExtensionRatio < this._config.minArmExtensionRatio) {
      return {
        isValid: false,
        answerIndex: null,
        zoneId: null,
        vx,
        vy,
        armExtensionRatio,
        isInside,
        isDynamicReach: false,
      };
    }

    // 5. 수직 점프 동작 검증
    const handSpeedY = Math.abs(vy);
    if (handSpeedY >= this._config.jumpVerticalSpeedThreshold || isBodyJumping) {
      this._isJumpBlocked = true;
      return {
        isValid: false,
        answerIndex: null,
        zoneId: null,
        vx,
        vy,
        armExtensionRatio,
        isInside,
        isDynamicReach: false,
      };
    }

    // 6. 정적 손 위치 vs 동적 뻗기 보조 검증
    const wasInZone = inZone4 ? prevInside4 : prevInside5;
    let isDynamicReach = false;

    if (wasInZone || prevPos === null) {
      // 이미 존 내부에 정지/체류 중이거나 첫 판정 프레임인 경우 (정적 손 위치 인정)
      // 단, 존 내부에서 몸통/중앙 방향으로 빠르게 되돌아오는 역방향 동작은 제외
      const isInwardReturn = inZone4
        ? (vx > this._config.dynamicMinHorizontalSpeed)
        : (vx < -this._config.dynamicMinHorizontalSpeed);

      if (isInwardReturn) {
        return {
          isValid: false,
          answerIndex: null,
          zoneId: null,
          vx,
          vy,
          armExtensionRatio,
          isInside,
          isDynamicReach: false,
        };
      }
    } else {
      // 바깥에서 존 내부로 새롭게 진입한 경우 (동적 뻗기 보조 검증)
      isDynamicReach = true;
      const speedX = Math.abs(vx);

      // (1) 최소 수평 속도 검증
      if (speedX < this._config.dynamicMinHorizontalSpeed) {
        return {
          isValid: false,
          answerIndex: null,
          zoneId: null,
          vx,
          vy,
          armExtensionRatio,
          isInside,
          isDynamicReach,
        };
      }

      // (2) 수평 우세비 검증 (|vx| > 1.2 * |vy|)
      if (speedX <= this._config.horizontalDominanceRatio * handSpeedY) {
        return {
          isValid: false,
          answerIndex: null,
          zoneId: null,
          vx,
          vy,
          armExtensionRatio,
          isInside,
          isDynamicReach,
        };
      }

      // (3) 중앙에서 바깥으로 뻗는 방향 검증 (Zone 4: 좌측(-vx), Zone 5: 우측(+vx))
      const isOutwardDirection = inZone4 ? (vx < 0) : (vx > 0);
      if (!isOutwardDirection) {
        return {
          isValid: false,
          answerIndex: null,
          zoneId: null,
          vx,
          vy,
          armExtensionRatio,
          isInside,
          isDynamicReach,
        };
      }
    }

    return {
      isValid: true,
      answerIndex: targetAnswerIndex,
      zoneId: targetZoneId,
      vx,
      vy,
      armExtensionRatio,
      isInside,
      isDynamicReach,
    };
  }

  private _confirmAnswer(
    answerIndex: 0 | 1,
    zoneId: 4 | 5,
    hand: ArmHandType,
    currentTime: number,
    source: 'motion' | 'keyboard' | 'touch',
    position?: { x: number; y: number },
    velocity?: { vx: number; vy: number },
    isDynamicReach?: boolean,
  ): ArmReachAnswerResult {
    this._isConfirmed = true;
    this._confirmedAnswerIndex = answerIndex;
    this._confirmedZoneId = zoneId;
    this._confirmedHand = hand;

    const result: ArmReachAnswerResult = {
      answerIndex,
      zoneId,
      hand,
      timestamp: currentTime,
      source,
      position,
      velocity,
      isDynamicReach,
    };

    this._lastResult = result;

    for (const listener of this._listeners) {
      try {
        listener(result);
      } catch (err) {
        console.error('[ArmReachAnswerSelector] select listener error:', err);
      }
    }

    if (this.onSelect) {
      try {
        this.onSelect(result);
      } catch (err) {
        console.error('[ArmReachAnswerSelector] onSelect error:', err);
      }
    }

    if (this.onAnswerSelected) {
      try {
        this.onAnswerSelected(result);
      } catch (err) {
        console.error('[ArmReachAnswerSelector] onAnswerSelected error:', err);
      }
    }

    return result;
  }

  update(
    currentTimeOrDt: number,
    landmarks?: readonly NormalizedLandmark[] | null,
    palms?: PalmPositions,
    _options?: CursorUpdateOptions,
  ): ArmReachAnswerResult | null {
    // 1. 이미 확정된 경우 추가 이벤트 차단 (1회 단일 확정 보장)
    if (this._isConfirmed) {
      return null;
    }

    this._isMutualExclusionBlocked = false;
    this._isJumpBlocked = false;

    // 2. 시간 및 dt 산출
    let dt = 0;
    let currentTime = currentTimeOrDt;
    if (this._lastTime !== null) {
      if (currentTimeOrDt > this._lastTime) {
        dt = currentTimeOrDt - this._lastTime;
      } else if (currentTimeOrDt > 0 && currentTimeOrDt < 1.0) {
        dt = currentTimeOrDt;
        currentTime = this._lastTime + dt;
      }
    }
    this._lastTime = currentTime;

    // 3. 랜드마크 존재 여부 검증
    if (!landmarks || landmarks.length === 0) {
      this._isTrackingLost = true;
      return null;
    }

    const minVis = this._config.minVisibility;

    // 4. 손 위치 추출: MediaPipe Hands palm 우선, 없으면 MediaPipe Pose 손목 사용
    const lWristLM = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rWristLM = landmarks[POSE_LANDMARKS.RIGHT_WRIST];

    let leftPt: TrackedHandPoint;
    if (palms?.leftPalm && (palms.leftPalm.confidence ?? 1) >= minVis) {
      const sp = this._toScreenPoint(palms.leftPalm);
      leftPt = { x: sp.x, y: sp.y, visibility: palms.leftPalm.confidence ?? 1 };
    } else if (lWristLM) {
      const sp = this._toScreenPoint(lWristLM);
      leftPt = { x: sp.x, y: sp.y, visibility: lWristLM.visibility ?? 1 };
    } else {
      leftPt = { x: 0.5, y: 0.5, visibility: 0 };
    }

    let rightPt: TrackedHandPoint;
    if (palms?.rightPalm && (palms.rightPalm.confidence ?? 1) >= minVis) {
      const sp = this._toScreenPoint(palms.rightPalm);
      rightPt = { x: sp.x, y: sp.y, visibility: palms.rightPalm.confidence ?? 1 };
    } else if (rWristLM) {
      const sp = this._toScreenPoint(rWristLM);
      rightPt = { x: sp.x, y: sp.y, visibility: rWristLM.visibility ?? 1 };
    } else {
      rightPt = { x: 0.5, y: 0.5, visibility: 0 };
    }

    // 양손 모두 가시성 미달 시 추적 유실
    if (leftPt.visibility < minVis && rightPt.visibility < minVis) {
      this._isTrackingLost = true;
      return null;
    }
    this._isTrackingLost = false;

    // 5. 어깨 기준점 및 신체 수직 이동 계산
    const lShoulderLM = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulderLM = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

    const hasShoulders = Boolean(
      lShoulderLM &&
      rShoulderLM &&
      (lShoulderLM.visibility ?? 1) >= minVis &&
      (rShoulderLM.visibility ?? 1) >= minVis,
    );

    const leftShoulderPos = hasShoulders && lShoulderLM
      ? this._toScreenPoint(lShoulderLM)
      : { x: 0.40, y: 0.35 };

    const rightShoulderPos = hasShoulders && rShoulderLM
      ? this._toScreenPoint(rShoulderLM)
      : { x: 0.60, y: 0.35 };

    const shoulderWidth = hasShoulders && lShoulderLM && rShoulderLM
      ? Math.hypot(rightShoulderPos.x - leftShoulderPos.x, rightShoulderPos.y - leftShoulderPos.y)
      : 0.20;

    const currentBodyY = hasShoulders && lShoulderLM && rShoulderLM
      ? (lShoulderLM.y + rShoulderLM.y) / 2
      : null;

    let isBodyJumping = false;
    if (this._prevBodyY !== null && currentBodyY !== null && dt > EPSILON) {
      const bodyVy = (currentBodyY - this._prevBodyY) / dt;
      if (Math.abs(bodyVy) >= this._config.jumpVerticalSpeedThreshold) {
        isBodyJumping = true;
        this._isJumpBlocked = true;
      }
    }
    this._prevBodyY = currentBodyY;

    // 6. 각 손에 대한 독립 평가
    const leftEval = this._evaluateArm(
      'left',
      leftPt,
      this._prevLeftHand,
      this._prevLeftInside4,
      this._prevLeftInside5,
      dt,
      leftShoulderPos,
      shoulderWidth,
      isBodyJumping,
    );

    const rightEval = this._evaluateArm(
      'right',
      rightPt,
      this._prevRightHand,
      this._prevRightInside4,
      this._prevRightInside5,
      dt,
      rightShoulderPos,
      shoulderWidth,
      isBodyJumping,
    );

    // 이전 상태 업데이트
    this._prevLeftHand = { ...leftPt };
    this._prevRightHand = { ...rightPt };
    this._prevLeftInside4 = isInsideZone(leftPt, this._zone4);
    this._prevLeftInside5 = isInsideZone(leftPt, this._zone5);
    this._prevRightInside4 = isInsideZone(rightPt, this._zone4);
    this._prevRightInside5 = isInsideZone(rightPt, this._zone5);

    // 7. 양팔 동시 유효 시 미선택 (Strict Mutual Exclusion)
    if (leftEval.isValid && rightEval.isValid) {
      this._isMutualExclusionBlocked = true;
      return null;
    }

    // 8. 단일 유효 팔 즉시 확정
    if (leftEval.isValid && leftEval.answerIndex !== null && leftEval.zoneId !== null) {
      return this._confirmAnswer(
        leftEval.answerIndex,
        leftEval.zoneId,
        'left',
        currentTime,
        'motion',
        { x: leftPt.x, y: leftPt.y },
        { vx: leftEval.vx, vy: leftEval.vy },
        leftEval.isDynamicReach,
      );
    }

    if (rightEval.isValid && rightEval.answerIndex !== null && rightEval.zoneId !== null) {
      return this._confirmAnswer(
        rightEval.answerIndex,
        rightEval.zoneId,
        'right',
        currentTime,
        'motion',
        { x: rightPt.x, y: rightPt.y },
        { vx: rightEval.vx, vy: rightEval.vy },
        rightEval.isDynamicReach,
      );
    }

    return null;
  }

  selectByFallback(choice: 0 | 1, currentTime = 0): ArmReachAnswerResult | null {
    if (this._isConfirmed) {
      return null;
    }
    const zoneId: 4 | 5 = choice === 0 ? 4 : 5;
    return this._confirmAnswer(choice, zoneId, 'fallback', currentTime, 'keyboard');
  }

  fromKeyboard(key: string, currentTime = 0): ArmReachAnswerResult | null {
    if (key === '1') {
      return this.selectByFallback(0, currentTime);
    }
    if (key === '2') {
      return this.selectByFallback(1, currentTime);
    }
    return null;
  }

  fromTouch(choiceOrZoneId: 0 | 1 | 4 | 5, currentTime = 0): ArmReachAnswerResult | null {
    const choice: 0 | 1 = choiceOrZoneId === 1 || choiceOrZoneId === 5 ? 1 : 0;
    const zoneId: 4 | 5 = choice === 0 ? 4 : 5;
    if (this._isConfirmed) {
      return null;
    }
    return this._confirmAnswer(choice, zoneId, 'fallback', currentTime, 'touch');
  }
}
