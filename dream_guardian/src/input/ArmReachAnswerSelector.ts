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
  type ArmReachJudgmentMode,
} from '../../config/beat-motion.config.js';
import {
  DEFAULT_ARM_REACH_JUDGMENT_CONFIG,
  DEFAULT_ARM_DIRECTION_ANSWER_CONFIG,
  type ArmReachJudgmentConfig,
  type ArmReachGateScores,
} from '../../config/judgment.config.js';

export type { ArmReachJudgmentMode };
import { AdaptiveToleranceTracker } from './AdaptiveTolerance.js';
import {
  CursorTracker,
  type CursorUpdateOptions,
  type PalmPositions,
  type ViewportProjectFn,
} from './CursorTracker.js';
import { isInsideZone } from './PostureMatcher.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../types/index.js';
import type { MotionIntentBus } from '../motion/MotionIntentBus.js';
import type { MotionIntent, UnsubscribeFn } from '../types/motion-intent.js';
import {
  calcShoulderWidth,
  mirrorPoint,
  GEOM_EPSILON,
} from '../utils/PoseGeometry.js';
import {
  ArmReachGateEvaluator,
  type ArmEvaluationResult,
  type ArmCandidateStatus,
  type TrackedHandPoint,
} from './arm/ArmReachGateEvaluator.js';

export type {
  ArmEvaluationResult,
  ArmCandidateStatus,
  TrackedHandPoint,
};
export { ArmReachGateEvaluator };

export type ArmHandType = 'left' | 'right' | 'fallback';

export interface ArmReachAnswerResult {
  answerIndex: 0 | 1;
  zoneId: 4 | 5;
  hand: ArmHandType;
  timestamp: number;
  source: 'motion' | 'keyboard' | 'touch';
  position?: { x: number; y: number };
  velocity?: { vx: number; vy: number };
  isDynamicReach?: boolean;
  score?: number;
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

const EPSILON = GEOM_EPSILON;

export class ArmReachAnswerSelector {
  private readonly _config: ArmReachAnswerConfig;
  private readonly _judgmentConfig: ArmReachJudgmentConfig;
  private readonly _cursorTracker: CursorTracker;
  private readonly _gateEvaluator: ArmReachGateEvaluator;
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
  private _monotonicTime = 0;
  private _isPaused = false;
  private _pendingExplicitDt = 0;
  private _baseLeftWristX: number | null = null;
  private _baseRightWristX: number | null = null;
  private _heldDirection: 0 | 1 | null = null;
  private _heldHand: ArmHandType | null = null;
  private _heldDuration = 0;
  private _intentBus: MotionIntentBus | null = null;
  private _intentBusUnsub: UnsubscribeFn | null = null;
  private _adaptiveTolerance?: AdaptiveToleranceTracker;
  private _isWindowOpen = false;
  private _windowGen = 0;
  private _windowOpenedAt: number | null = null;
  private _pendingIntent: {
    side: 0 | 1;
    zoneId: 4 | 5;
    windowGen: number;
    arrivedAt: number;
    confidence: number;
  } | null = null;

  private _listeners: Set<ArmReachSelectCallback> = new Set();
  public onSelect?: ArmReachSelectCallback;
  public onAnswerSelected?: ArmReachSelectCallback;

  constructor(
    config?: Partial<ArmReachAnswerConfig>,
    cursorTracker?: CursorTracker,
    zones: readonly FitnessZone[] = DEFAULT_FITNESS_ZONES,
    judgmentConfig?: Partial<ArmReachJudgmentConfig>,
    intentBus?: MotionIntentBus,
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
      direction: {
        ...DEFAULT_ARM_DIRECTION_ANSWER_CONFIG,
        ...judgmentConfig?.direction,
      },
    };
    this._zones = zones;
    this._zone4 = this._zones.find((z) => z.id === 4) ?? DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
    this._zone5 = this._zones.find((z) => z.id === 5) ?? DEFAULT_FITNESS_ZONES.find((z) => z.id === 5)!;

    this._cursorTracker = cursorTracker ?? new CursorTracker();
    this._gateEvaluator = new ArmReachGateEvaluator({
      config: this._config,
      judgmentConfig: this._judgmentConfig,
      zone4: this._zone4,
      zone5: this._zone5,
    });
    if (intentBus) {
      this.attachIntentBus(intentBus);
    }
  }

  /**
   * MotionIntentBus 연결 (Issue #252 어댑터 패턴)
   */
  public attachIntentBus(bus: MotionIntentBus): UnsubscribeFn {
    if (this._intentBusUnsub) {
      this._intentBusUnsub();
      this._intentBusUnsub = null;
    }
    this._intentBus = bus;
    const unsub = bus.subscribe((intent) => {
      if (this._isConfirmed) return;
      if (intent.type === 'reachLeft') {
        this.selectByReachIntent(0, 4, intent);
      } else if (intent.type === 'reachRight') {
        this.selectByReachIntent(1, 5, intent);
      }
    });
    this._intentBusUnsub = () => {
      unsub();
      if (this._intentBus === bus) {
        this._intentBus = null;
      }
      this._intentBusUnsub = null;
    };
    return this._intentBusUnsub;
  }

  /**
   * MotionIntent를 현재 창의 후보로만 등록한다.
   * 최종 확정은 update()의 기존 포즈 판정 경로에서만 이루어진다. (#306)
   * 현재 포즈가 이미 최종 게이트를 통과한 경우에만 확정 결과를 반환한다.
   */
  public selectByReachIntent(
    answerIndex: 0 | 1,
    zoneId: 4 | 5,
    intent: MotionIntent,
  ): ArmReachAnswerResult | null {
    if (this._isConfirmed) return null;
    if (!this._isWindowOpen) return null;
    if (this._windowOpenedAt !== null && intent.timestamp + 1e-6 < this._windowOpenedAt) {
      return null;
    }

    const arrivedAt = this._lastTime ?? intent.timestamp;
    this._pendingIntent = {
      side: answerIndex,
      zoneId,
      windowGen: this._windowGen,
      arrivedAt,
      confidence: intent.confidence,
    };

    return this._confirmPendingIfPoseAgrees(arrivedAt);
  }

  /**
   * 이미 평가된 현재 창 포즈가 후보 측면과 최종 게이트에 일치할 때만 확정한다.
   */
  private _confirmPendingIfPoseAgrees(currentTime: number): ArmReachAnswerResult | null {
    const pending = this._pendingIntent;
    if (!pending || !this._isWindowOpen) return null;
    if (pending.windowGen !== this._windowGen) return null;
    if (this._windowOpenedAt !== null && pending.arrivedAt + 1e-6 < this._windowOpenedAt) return null;

    const leftEval = this._lastLeftEval;
    const rightEval = this._lastRightEval;
    if (!leftEval || !rightEval) return null;

    if (leftEval.isValid && rightEval.isValid) return null;
    if (
      leftEval.answerIndex !== null &&
      rightEval.answerIndex !== null &&
      leftEval.answerIndex !== rightEval.answerIndex
    ) {
      return null;
    }

    const chosen = pending.side === 0 ? leftEval : rightEval;
    const other = pending.side === 0 ? rightEval : leftEval;
    if (!chosen.isValid || chosen.answerIndex !== pending.side || chosen.zoneId !== pending.zoneId) {
      return null;
    }
    if (other.answerIndex !== null && other.answerIndex !== pending.side) return null;
    if (this._isJumpBlocked) return null;

    const pt = pending.side === 0 ? this._prevLeftHand : this._prevRightHand;
    this._pendingIntent = null;
    return this._confirmAnswer(
      pending.side,
      pending.zoneId,
      pending.side === 0 ? 'left' : 'right',
      currentTime,
      'motion',
      pt ? { x: pt.x, y: pt.y } : undefined,
      { vx: chosen.vx, vy: chosen.vy },
      chosen.isDynamicReach,
      chosen.score,
      chosen.gates,
    );
  }

  get config(): ArmReachAnswerConfig {
    return this._config;
  }

  public setAdaptiveTolerance(tracker?: AdaptiveToleranceTracker): void {
    this._adaptiveTolerance = tracker;
  }

  get adaptiveTolerance(): AdaptiveToleranceTracker | undefined {
    return this._adaptiveTolerance;
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

  get heldDirection(): 0 | 1 | null {
    return this._heldDirection;
  }

  get heldDuration(): number {
    return this._heldDuration;
  }

  /** updateDelta가 수용한 dt(초)만 누적한 내부 단조 시계. */
  get monotonicTime(): number {
    return this._monotonicTime;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  /** 로컬 pause. true면 updateDelta가 Hold/시계를 전진시키지 않는다. */
  setPaused(paused: boolean): void {
    this._isPaused = paused;
  }

  get heldHand(): ArmHandType | null {
    return this._heldHand;
  }

  get gateEvaluator(): ArmReachGateEvaluator {
    return this._gateEvaluator;
  }

  get state(): ArmReachAnswerState {
    const leftStatus = this._gateEvaluator.buildCandidateStatus(
      this._lastLeftEval,
      'left',
      this._prevLeftHand,
      this._prevLeftInside4,
      this._prevLeftInside5,
    );

    const rightStatus = this._gateEvaluator.buildCandidateStatus(
      this._lastRightEval,
      'right',
      this._prevRightHand,
      this._prevRightInside4,
      this._prevRightInside5,
    );

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
    this._baseLeftWristX = null;
    this._baseRightWristX = null;
    this._heldDirection = null;
    this._heldHand = null;
    this._heldDuration = 0;
    this._pendingIntent = null;
    this._cursorTracker.reset();
  }

  /**
   * 답안 입력 창 개방.
   * 이미 열린 창의 재호출은 Hold/기준점을 유지한다(basic→extension은 재오픈이 아님).
   * closeWindow 이후의 openWindow만 새 창으로 Hold를 리셋한다.
   */
  openWindow(): void {
    if (this._isWindowOpen) return;
    this.reset();
    this._isWindowOpen = true;
    this._windowGen += 1;
    this._windowOpenedAt = this._lastTime;
    this._pendingIntent = null;
  }

  /**
   * 명시적 dt(초) 진입. 인자 증감으로 절대시각/델타를 추론하지 않는다.
   * dt === 0, dt < 0, 비유한 값(NaN/Infinity), pause 중에는 누적하지 않고 시계를 뒤로 돌리지 않는다.
   */
  updateDelta(
    dt: number,
    landmarks?: readonly NormalizedLandmark[] | null,
    palms?: PalmPositions,
    _isMirrored?: boolean,
    options?: CursorUpdateOptions,
  ): ArmReachAnswerResult | null {
    if (!Number.isFinite(dt) || dt < 0) return null;
    if (this._isPaused || dt === 0) return null;
    this._pendingExplicitDt = dt;
    this._monotonicTime += dt;
    try {
      return this.update(this._monotonicTime, landmarks, palms, options);
    } finally {
      this._pendingExplicitDt = 0;
    }
  }

  /**
   * 답안 입력 창 닫기. 미확정 후보를 폐기해 늦은 intent가 확정되지 않게 한다.
   */
  closeWindow(): void {
    this._isWindowOpen = false;
    this._windowGen += 1;
    this._pendingIntent = null;
  }

  private _toScreenPoint(pt: { x: number; y: number }): { x: number; y: number } {
    return mirrorPoint(pt, this._config.isMirrored);
  }

  private _extractTrackedPoint(
    palm: { x: number; y: number; confidence?: number } | undefined,
    wristLM: NormalizedLandmark | undefined,
    elbowLM: NormalizedLandmark | undefined,
    hardMinVis: number,
  ): TrackedHandPoint {
    if (palm && (palm.confidence ?? 1) >= hardMinVis) {
      const sp = this._toScreenPoint(palm);
      return { x: sp.x, y: sp.y, visibility: palm.confidence ?? 1 };
    }
    if (wristLM && (wristLM.visibility ?? 1) >= hardMinVis) {
      const sp = this._toScreenPoint(wristLM);
      return { x: sp.x, y: sp.y, visibility: wristLM.visibility ?? 1 };
    }
    if (elbowLM && (elbowLM.visibility ?? 1) >= hardMinVis) {
      const sp = this._toScreenPoint(elbowLM);
      return { x: sp.x, y: sp.y, visibility: elbowLM.visibility ?? 1 };
    }
    return { x: 0.5, y: 0.5, visibility: 0 };
  }

  private _resetHeldState(): void {
    this._heldDirection = null;
    this._heldDuration = 0;
    this._heldHand = null;
  }

  private _blockMutualExclusion(): null {
    this._isMutualExclusionBlocked = true;
    this._resetHeldState();
    return null;
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
    if (isBodyJumping) {
      this._isJumpBlocked = true;
    }
    const baseWristX = hand === 'left' ? this._baseLeftWristX : this._baseRightWristX;
    const toleranceMultiplier = this._adaptiveTolerance ? this._adaptiveTolerance.multiplier : 1.0;
    return this._gateEvaluator.evaluateArm({
      hand,
      pos,
      prevPos,
      prevInside4,
      prevInside5,
      dt,
      shoulderPos,
      shoulderWidth,
      isBodyJumping,
      isJumpBlocked: this._isJumpBlocked,
      baseWristX,
      toleranceMultiplier,
    });
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

    if (this._intentBus) {
      this._intentBus.triggerRefractory(currentTime);
    }

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

    // 2. 시간 및 dt 산출. updateDelta는 이미 초 단위 dt를 확정했으므로 증감 추론을 하지 않는다.
    let dt = 0;
    let currentTime = currentTimeOrDt;
    if (this._pendingExplicitDt > 0) {
      dt = this._pendingExplicitDt;
    } else if (this._lastTime !== null) {
      if (currentTimeOrDt > this._lastTime) {
        dt = currentTimeOrDt - this._lastTime;
      } else if (currentTimeOrDt > 0 && currentTimeOrDt < 1.0) {
        dt = currentTimeOrDt;
        currentTime = this._lastTime + dt;
      }
    }
    this._lastTime = currentTime;
    if (this._isWindowOpen && this._windowOpenedAt === null) {
      this._windowOpenedAt = currentTime;
    }

    // 3. 랜드마크 존재 여부 검증
    if (!landmarks || landmarks.length === 0) {
      this._isTrackingLost = true;
      return null;
    }

    const minVis = this._config.minVisibility;
    const hardMinVis = this._judgmentConfig.hardMinVisibility;

    // 4. 손/팔 판정점 추출: 보이는 손목(palm/wrist) > 보이는 팔꿈치(elbow) > 실패 (#303)
    const lWristLM = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rWristLM = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    const lElbowLM = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
    const rElbowLM = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];

    const leftPt = this._extractTrackedPoint(palms?.leftPalm, lWristLM, lElbowLM, hardMinVis);
    const rightPt = this._extractTrackedPoint(palms?.rightPalm, rWristLM, rElbowLM, hardMinVis);

    // 양손 모두 가시성 미달 시 추적 유실
    if (leftPt.visibility < hardMinVis && rightPt.visibility < hardMinVis) {
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
      ? calcShoulderWidth(leftShoulderPos, rightShoulderPos)
      : 0.20;

    const currentBodyY = hasShoulders && lShoulderLM && rShoulderLM
      ? (lShoulderLM.y + rShoulderLM.y) / 2
      : null;

    let isBodyJumping = false;
    if (this._prevBodyY !== null && currentBodyY !== null && dt > EPSILON) {
      const bodyVy = (currentBodyY - this._prevBodyY) / dt;
      // In normalized coords: moving UP means currentBodyY < prevBodyY -> bodyVy < 0 (upward speed = -bodyVy > 0).
      // Squatting DOWN means currentBodyY > prevBodyY -> bodyVy > 0.
      // Jump blocking only checks UPWARD speed! (Issue #287)
      const upwardBodySpeed = -bodyVy;
      if (upwardBodySpeed >= this._config.jumpVerticalSpeedThreshold) {
        isBodyJumping = true;
        this._isJumpBlocked = true;
      }
    }
    this._prevBodyY = currentBodyY;

    // 6. 창 개방 이후 첫 프레임 기준 손목 위치 기록 (Issue #287)
    if (this._baseLeftWristX === null && leftPt.visibility >= this._judgmentConfig.hardMinVisibility) {
      this._baseLeftWristX = leftPt.x;
    }
    if (this._baseRightWristX === null && rightPt.visibility >= this._judgmentConfig.hardMinVisibility) {
      this._baseRightWristX = rightPt.x;
    }

    // 각 손에 대한 독립 평가
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

    if (this._adaptiveTolerance) {
      this._adaptiveTolerance.recordAttempt(
        Math.max(leftEval.score, rightEval.score),
        this._judgmentConfig.confirmThreshold
      );
    }

    // 7. 양팔 결과 종합 및 최종 확정 판정
    if (this._config.mode !== 'legacy_weighted') {
      // Issue #287: Strict Mutual Exclusion (양팔 동시 유효 및 반대 방향 차단)
      if (leftEval.isValid && rightEval.isValid) {
        return this._blockMutualExclusion();
      }
      if (
        leftEval.answerIndex !== null &&
        rightEval.answerIndex !== null &&
        leftEval.answerIndex !== rightEval.answerIndex
      ) {
        return this._blockMutualExclusion();
      }
      if (leftEval.isValid && !rightEval.isValid) {
        if (rightEval.answerIndex !== null && rightEval.answerIndex !== leftEval.answerIndex) {
          return this._blockMutualExclusion();
        }
        this._resetHeldState();
        this._pendingIntent = null;
        return this._confirmAnswer(
          leftEval.answerIndex!,
          leftEval.zoneId!,
          'left',
          currentTime,
          'motion',
          { x: leftPt.x, y: leftPt.y },
          { vx: leftEval.vx, vy: leftEval.vy },
          leftEval.isDynamicReach,
          leftEval.score,
          leftEval.gates,
        );
      }
      if (rightEval.isValid && !leftEval.isValid) {
        if (leftEval.answerIndex !== null && leftEval.answerIndex !== rightEval.answerIndex) {
          return this._blockMutualExclusion();
        }
        this._resetHeldState();
        this._pendingIntent = null;
        return this._confirmAnswer(
          rightEval.answerIndex!,
          rightEval.zoneId!,
          'right',
          currentTime,
          'motion',
          { x: rightPt.x, y: rightPt.y },
          { vx: rightEval.vx, vy: rightEval.vy },
          rightEval.isDynamicReach,
          rightEval.score,
          rightEval.gates,
        );
      }

      // 7-B. 사전 뻗기 1초 유지 (Hold) 판정 (#303 / INPUT-ARM-HOLD-001)
      const leftSatisfied = leftEval.isDirectionSatisfied ?? false;
      const rightSatisfied = rightEval.isDirectionSatisfied ?? false;

      let candidateDir: 0 | 1 | null = null;
      let candidateHand: ArmHandType | null = null;
      let candidateEval: ArmEvaluationResult | null = null;
      let candidatePt: TrackedHandPoint | null = null;

      if (leftSatisfied && rightSatisfied) {
        if (leftEval.answerIndex !== rightEval.answerIndex) {
          return this._blockMutualExclusion();
        } else if (leftEval.answerIndex !== null) {
          candidateDir = leftEval.answerIndex;
          candidateHand = 'left';
          candidateEval = leftEval;
          candidatePt = leftPt;
        }
      } else if (leftSatisfied && !rightSatisfied) {
        if (rightEval.answerIndex !== null && rightEval.answerIndex !== leftEval.answerIndex) {
          return this._blockMutualExclusion();
        }
        candidateDir = leftEval.answerIndex;
        candidateHand = 'left';
        candidateEval = leftEval;
        candidatePt = leftPt;
      } else if (rightSatisfied && !leftSatisfied) {
        if (leftEval.answerIndex !== null && leftEval.answerIndex !== rightEval.answerIndex) {
          return this._blockMutualExclusion();
        }
        candidateDir = rightEval.answerIndex;
        candidateHand = 'right';
        candidateEval = rightEval;
        candidatePt = rightPt;
      }

      if (candidateDir !== null && candidateHand !== null && candidateEval !== null && candidatePt !== null) {
        if (this._heldDirection === candidateDir) {
          this._heldDuration += dt;
        } else {
          this._heldDirection = candidateDir;
          this._heldHand = candidateHand;
          this._heldDuration = dt;
        }

        const dirConfig = this._judgmentConfig.direction ?? DEFAULT_ARM_DIRECTION_ANSWER_CONFIG;
        const heldConfirmSec = dirConfig.heldReachConfirmSec ?? 1.0;

        if (this._heldDuration >= (heldConfirmSec - 1e-4)) {
          const zoneId: 4 | 5 = candidateDir === 0 ? 4 : 5;
          const score = Math.max(this._judgmentConfig.confirmThreshold, candidateEval.score);
          return this._confirmAnswer(
            candidateDir,
            zoneId,
            candidateHand,
            currentTime,
            'motion',
            { x: candidatePt.x, y: candidatePt.y },
            { vx: candidateEval.vx, vy: candidateEval.vy },
            candidateEval.isDynamicReach,
            score,
            candidateEval.gates,
          );
        }
      } else {
        this._resetHeldState();
      }

      return null;
    }

    // Legacy Weighted Mode (Issue #249 / Dominance Ratio 완화)
    let selectedHand: 'left' | 'right' | null = null;
    let selectedEval: ArmEvaluationResult | null = null;

    const arb = this._gateEvaluator.arbitrateWeightedCandidates(leftEval, rightEval);
    if (arb.isBlocked) {
      this._isMutualExclusionBlocked = true;
      return null;
    }
    if (arb.winner === 'left') {
      selectedHand = 'left';
      selectedEval = leftEval;
    } else if (arb.winner === 'right') {
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
    if (this._isConfirmed) return null;
    const zoneId: 4 | 5 = choice === 0 ? 4 : 5;
    return this._confirmAnswer(choice, zoneId, 'fallback', currentTime, 'keyboard');
  }

  fromKeyboard(key: string, currentTime = 0): ArmReachAnswerResult | null {
    if (key === '1') return this.selectByFallback(0, currentTime);
    if (key === '2') return this.selectByFallback(1, currentTime);
    return null;
  }

  fromTouch(choiceOrZoneId: 0 | 1 | 4 | 5, currentTime = 0): ArmReachAnswerResult | null {
    if (this._isConfirmed) return null;
    const choice: 0 | 1 = choiceOrZoneId === 1 || choiceOrZoneId === 5 ? 1 : 0;
    const zoneId: 4 | 5 = choice === 0 ? 4 : 5;
    return this._confirmAnswer(choice, zoneId, 'fallback', currentTime, 'touch');
  }
}
