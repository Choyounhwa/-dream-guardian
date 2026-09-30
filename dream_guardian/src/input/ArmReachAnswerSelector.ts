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
  DEFAULT_ARM_REACH_JUDGMENT_CONFIG,
  type ArmReachJudgmentConfig,
  type ArmReachGateScores,
  computeWeightedArmScore,
} from '../../config/judgment.config.js';
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
  score?: number;
  gates?: ArmReachGateScores;
}

export interface ArmEvaluationResult {
  isValid: boolean;
  score: number;
  gates: ArmReachGateScores;
  answerIndex: 0 | 1 | null;
  zoneId: 4 | 5 | null;
  vx: number;
  vy: number;
  armExtensionRatio: number;
  isInside: boolean;
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
  /** 가중 신뢰도 종합 점수 (0~1) */
  score?: number;
  /** 5개 세부 게이트 점수 */
  gates?: ArmReachGateScores;
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
  private readonly _judgmentConfig: ArmReachJudgmentConfig;
  private readonly _cursorTracker: CursorTracker;
  private readonly _zones: readonly FitnessZone[];
  private readonly _zone4: FitnessZone;
  private readonly _zone5: FitnessZone;

  private _isConfirmed = false;
  private _confirmedAnswerIndex: 0 | 1 | null = null;
  private _confirmedZoneId: 4 | 5 | null = null;
  private _confirmedHand: ArmHandType | null = null;
  private _lastResult: ArmReachAnswerResult | null = null;

  private _lastLeftEval: ArmEvaluationResult | null = null;
  private _lastRightEval: ArmEvaluationResult | null = null;

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
    judgmentConfig?: Partial<ArmReachJudgmentConfig>,
  ) {
    this._config = {
      ...DEFAULT_ARM_REACH_ANSWER_CONFIG,
      ...config,
    };
    this._judgmentConfig = {
      ...DEFAULT_ARM_REACH_JUDGMENT_CONFIG,
      ...judgmentConfig,
      weights: {
        ...DEFAULT_ARM_REACH_JUDGMENT_CONFIG.weights,
        ...judgmentConfig?.weights,
      },
      baselines: {
        ...DEFAULT_ARM_REACH_JUDGMENT_CONFIG.baselines,
        ...judgmentConfig?.baselines,
      },
    };
    this._zones = zones;
    this._zone4 = this._zones.find((z) => z.id === 4) ?? DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
    this._zone5 = this._zones.find((z) => z.id === 5) ?? DEFAULT_FITNESS_ZONES.find((z) => z.id === 5)!;

    this._cursorTracker = cursorTracker ?? new CursorTracker();
  }

  get config(): ArmReachAnswerConfig {
    return this._config;
  }

  get judgmentConfig(): ArmReachJudgmentConfig {
    return this._judgmentConfig;
  }

  get isConfirmed(): boolean {
    return this._isConfirmed;
  }

  get confirmedAnswerIndex(): 0 | 1 | null {
    return this._confirmedAnswerIndex;
  }

  get confirmedChoiceIndex(): 0 | 1 | null {
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
    const leftStatus = this._lastLeftEval
      ? {
          hand: 'left' as const,
          zoneId: this._lastLeftEval.zoneId,
          answerIndex: this._lastLeftEval.answerIndex,
          x: this._prevLeftHand?.x ?? 0,
          y: this._prevLeftHand?.y ?? 0,
          vx: this._lastLeftEval.vx,
          vy: this._lastLeftEval.vy,
          armExtensionRatio: this._lastLeftEval.armExtensionRatio,
          isInside: this._lastLeftEval.isInside,
          isValid: this._lastLeftEval.isValid,
          isDynamicReach: this._lastLeftEval.isDynamicReach,
          score: this._lastLeftEval.score,
          gates: this._lastLeftEval.gates,
        }
      : this._buildCandidateStatus('left');

    const rightStatus = this._lastRightEval
      ? {
          hand: 'right' as const,
          zoneId: this._lastRightEval.zoneId,
          answerIndex: this._lastRightEval.answerIndex,
          x: this._prevRightHand?.x ?? 0,
          y: this._prevRightHand?.y ?? 0,
          vx: this._lastRightEval.vx,
          vy: this._lastRightEval.vy,
          armExtensionRatio: this._lastRightEval.armExtensionRatio,
          isInside: this._lastRightEval.isInside,
          isValid: this._lastRightEval.isValid,
          isDynamicReach: this._lastRightEval.isDynamicReach,
          score: this._lastRightEval.score,
          gates: this._lastRightEval.gates,
        }
      : this._buildCandidateStatus('right');

    let activeAnswerIndex: 0 | 1 | null = null;
    let activeZoneId: 4 | 5 | null = null;

    if (!this._isMutualExclusionBlocked && !this._isJumpBlocked) {
      if (leftStatus.isValid && !rightStatus.isValid) {
        activeAnswerIndex = leftStatus.answerIndex;
        activeZoneId = leftStatus.zoneId as 4 | 5 | null;
      } else if (!leftStatus.isValid && rightStatus.isValid) {
        activeAnswerIndex = rightStatus.answerIndex;
        activeZoneId = rightStatus.zoneId as 4 | 5 | null;
      } else if (leftStatus.isValid && rightStatus.isValid) {
        const dom = this._judgmentConfig.dominanceRatio;
        const lScore = leftStatus.score ?? 0;
        const rScore = rightStatus.score ?? 0;
        if (lScore >= rScore * dom) {
          activeAnswerIndex = leftStatus.answerIndex;
          activeZoneId = leftStatus.zoneId as 4 | 5 | null;
        } else if (rScore >= lScore * dom) {
          activeAnswerIndex = rightStatus.answerIndex;
          activeZoneId = rightStatus.zoneId as 4 | 5 | null;
        }
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
    this._lastLeftEval = null;
    this._lastRightEval = null;
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

  /**
   * 답안 입력 창 개방 (리셋 및 입력 수신 시작)
   */
  openWindow(): void {
    this.reset();
  }

  /**
   * 답안 입력 창 닫기
   */
  closeWindow(): void {
    // 확정 상태 보존
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

  evaluateArm(
    hand: 'left' | 'right',
    pos: TrackedHandPoint,
    prevPos: TrackedHandPoint | null,
    prevInside4: boolean,
    prevInside5: boolean,
    dt: number,
    shoulderPos: { x: number; y: number },
    shoulderWidth: number,
    isBodyJumping: boolean,
  ): ArmEvaluationResult {
    return this._evaluateArm(
      hand,
      pos,
      prevPos,
      prevInside4,
      prevInside5,
      dt,
      shoulderPos,
      shoulderWidth,
      isBodyJumping,
    );
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
  ): ArmEvaluationResult {
    // 1. 가시성 최소 하드 가드 (0.30 미만은 완전 미검출 상태로 간주하여 차단)
    const hardMinVis = this._judgmentConfig.hardMinVisibility;
    if (pos.visibility < hardMinVis) {
      return {
        isValid: false,
        score: 0,
        gates: {
          zonePenetration: 0,
          armExtension: 0,
          horizontalDominance: 0,
          velocity: 0,
          visibility: pos.visibility,
        },
        answerIndex: null,
        zoneId: null,
        vx: 0,
        vy: 0,
        armExtensionRatio: 0,
        isInside: false,
        isDynamicReach: false,
      };
    }

    // 2. 존 판정 및 침투 깊이 (zonePenetration)
    const inZone4 = isInsideZone(pos, this._zone4);
    const inZone5 = isInsideZone(pos, this._zone5);
    const isInside = inZone4 || inZone5;

    let targetZone: FitnessZone;
    let targetZoneId: 4 | 5;
    let targetAnswerIndex: 0 | 1;

    if (inZone4) {
      targetZone = this._zone4;
      targetZoneId = 4;
      targetAnswerIndex = 0;
    } else if (inZone5) {
      targetZone = this._zone5;
      targetZoneId = 5;
      targetAnswerIndex = 1;
    } else {
      targetZoneId = pos.x < 0.5 ? 4 : 5;
      targetZone = targetZoneId === 4 ? this._zone4 : this._zone5;
      targetAnswerIndex = targetZoneId === 4 ? 0 : 1;
    }

    const cx = targetZone.x + targetZone.width / 2;
    const cy = targetZone.y + targetZone.height / 2;
    const halfW = targetZone.width / 2;
    const halfH = targetZone.height / 2;
    const dx = Math.abs(pos.x - cx) / (halfW > EPSILON ? halfW : 0.13);
    const dy = Math.abs(pos.y - cy) / (halfH > EPSILON ? halfH : 0.08);
    const normDist = Math.max(dx, dy);

    // normDist: 0(중심) -> 1.0, 1.0(경계) -> 0.50, 2.0(외부 1반폭) -> 0.0
    const zonePenetrationScore = Math.max(0, Math.min(1, 1.0 - 0.5 * normDist));

    // 3. 속도 계산
    let vx = 0;
    let vy = 0;
    if (prevPos && dt > EPSILON) {
      vx = (pos.x - prevPos.x) / dt;
      vy = (pos.y - prevPos.y) / dt;
    }

    // 4. 어깨 대비 뻗음 비율 계산 (armExtension)
    const armExtensionDist = Math.hypot(pos.x - shoulderPos.x, pos.y - shoulderPos.y);
    const armExtensionRatio = armExtensionDist / (shoulderWidth > EPSILON ? shoulderWidth : 0.20);
    const baseArmRatio = this._judgmentConfig.baselines.armExtensionRatio; // 0.25
    // baseArmRatio(0.25) -> 0.50, 2 * baseArmRatio(0.50) -> 1.00
    const armExtensionScore = Math.max(0, Math.min(1, armExtensionRatio / (2 * baseArmRatio)));

    // 5. 수직 점프 동작 검증 (하드 블록 유지)
    const handSpeedY = Math.abs(vy);
    if (handSpeedY >= this._config.jumpVerticalSpeedThreshold || isBodyJumping) {
      this._isJumpBlocked = true;
      return {
        isValid: false,
        score: 0,
        gates: {
          zonePenetration: zonePenetrationScore,
          armExtension: armExtensionScore,
          horizontalDominance: 0,
          velocity: 0,
          visibility: pos.visibility,
        },
        answerIndex: null,
        zoneId: null,
        vx,
        vy,
        armExtensionRatio,
        isInside,
        isDynamicReach: false,
      };
    }

    // 6. 정적 손 위치 vs 동적 뻗기 보조 검증 (velocity & horizontalDominance)
    const wasInZone = targetZoneId === 4 ? prevInside4 : prevInside5;
    const baseSpeed = this._judgmentConfig.baselines.horizontalSpeed; // 0.25
    const baseDominance = this._judgmentConfig.baselines.horizontalDominanceRatio; // 1.2

    // Zone 4는 좌측 방향(vx < 0)이 바깥쪽(-vx > 0), Zone 5는 우측 방향(vx > 0)이 바깥쪽(vx > 0)
    const outwardVx = targetZoneId === 4 ? -vx : vx;
    const isInwardReturn = wasInZone && (outwardVx < -baseSpeed);

    let isDynamicReach = false;
    let velocityScore = 0;
    let dominanceScore = 0;

    if (wasInZone || prevPos === null) {
      // 정적 손 위치 체류 모드
      if (isInwardReturn) {
        velocityScore = 0;
        dominanceScore = 0;
      } else if (prevPos === null || Math.hypot(vx, vy) < 0.05) {
        // 정지 체류 상태: 프레임 간 속도가 거의 없는 정적 자세이므로 기본 기준값(0.50) 부여
        if (outwardVx > 0) {
          velocityScore = Math.max(0.5, Math.min(1, outwardVx / (2 * baseSpeed)));
          const R = outwardVx / (handSpeedY + 1e-4);
          dominanceScore = Math.max(0.5, Math.min(1, R / (2 * baseDominance)));
        } else {
          velocityScore = 0.50;
          dominanceScore = 0.50;
        }
      } else if (outwardVx > 0) {
        velocityScore = Math.max(0, Math.min(1, outwardVx / (2 * baseSpeed)));
        const R = outwardVx / (handSpeedY + 1e-4);
        dominanceScore = Math.max(0, Math.min(1, R / (2 * baseDominance)));
      } else {
        // 존 안에서 몸통 방향으로 되돌아오는 이동
        velocityScore = 0;
        dominanceScore = 0;
      }
    } else {
      // 동적 뻗기 진입 모드
      isDynamicReach = true;
      if (outwardVx > 0) {
        velocityScore = Math.max(0, Math.min(1, outwardVx / (2 * baseSpeed)));
        const R = outwardVx / (handSpeedY + 1e-4);
        dominanceScore = Math.max(0, Math.min(1, R / (2 * baseDominance)));
      } else {
        // 역방향(안쪽 방향) 진입은 0점
        velocityScore = 0;
        dominanceScore = 0;
      }
    }

    // 7. 가시성 점수
    const visibilityScore = Math.max(0, Math.min(1, pos.visibility));

    // 8. 5개 게이트 가중 신뢰도 종합 점수 계산
    const gates: ArmReachGateScores = {
      zonePenetration: zonePenetrationScore,
      armExtension: armExtensionScore,
      horizontalDominance: dominanceScore,
      velocity: velocityScore,
      visibility: visibilityScore,
    };

    const score = computeWeightedArmScore(gates, this._judgmentConfig.weights);
    const isValid = score >= this._judgmentConfig.confirmThreshold;

    return {
      isValid,
      score,
      gates,
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
    score?: number,
    gates?: ArmReachGateScores,
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
      score,
      gates,
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

    this._lastLeftEval = leftEval;
    this._lastRightEval = rightEval;

    // 7. 양팔 경합 및 우세 판정 (Dominance Ratio 완화)
    let selectedHand: 'left' | 'right' | null = null;
    let selectedEval: ArmEvaluationResult | null = null;

    if (leftEval.isValid && rightEval.isValid) {
      const dominanceRatio = this._judgmentConfig.dominanceRatio;
      if (leftEval.score >= rightEval.score * dominanceRatio) {
        selectedHand = 'left';
        selectedEval = leftEval;
      } else if (rightEval.score >= leftEval.score * dominanceRatio) {
        selectedHand = 'right';
        selectedEval = rightEval;
      } else {
        // 1.25배 미만일 때 판정 보류 (양손 동시 유효 상호 배제)
        this._isMutualExclusionBlocked = true;
        return null;
      }
    } else if (leftEval.isValid) {
      selectedHand = 'left';
      selectedEval = leftEval;
    } else if (rightEval.isValid) {
      selectedHand = 'right';
      selectedEval = rightEval;
    }

    // 8. 선택된 유효 팔 즉시 확정
    if (selectedHand && selectedEval && selectedEval.answerIndex !== null && selectedEval.zoneId !== null) {
      const chosenPt = selectedHand === 'left' ? leftPt : rightPt;
      return this._confirmAnswer(
        selectedEval.answerIndex,
        selectedEval.zoneId,
        selectedHand,
        currentTime,
        'motion',
        { x: chosenPt.x, y: chosenPt.y },
        { vx: selectedEval.vx, vy: selectedEval.vy },
        selectedEval.isDynamicReach,
        selectedEval.score,
        selectedEval.gates,
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
