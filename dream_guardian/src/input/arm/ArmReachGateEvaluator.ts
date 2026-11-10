/**
 * ArmReachGateEvaluator - 5대 게이트 평가 및 후보 점수 산출기
 *
 * 팔 뻗기 기반 답안 선택(Zone 4/5)을 위한 5대 게이트 평가 및 점수 산출 전담 클래스.
 *
 * 5대 게이트:
 * 1. 가시성 (visibility): 최소 검출 임계치 (0.30)
 * 2. 신체 점프 차단 (isBodyJumping / isJumpBlocked)
 * 3. 목표 존 침투 및 방향성 (zonePenetration / lateralReach)
 * 4. 팔 신전 (armExtension / lateralProgress)
 * 5. 수평 우세 및 속도 (horizontalDominance / velocity)
 *
 * @see Issue #622 [REFACTOR-INPUT-002]
 * @see Issue #287 [INPUT-ARM-DIRECTION-001]
 * @see Issue #249 [INPUT-TOLERANCE-001]
 */

import {
  DEFAULT_FITNESS_ZONES,
  type FitnessZone,
} from '../../../config/zone.config.js';
import {
  DEFAULT_ARM_REACH_ANSWER_CONFIG,
  type ArmReachAnswerConfig,
} from '../../../config/beat-motion.config.js';
import {
  DEFAULT_ARM_REACH_JUDGMENT_CONFIG,
  DEFAULT_ARM_DIRECTION_ANSWER_CONFIG,
  type ArmReachJudgmentConfig,
  type ArmReachGateScores,
  computeWeightedArmScore,
} from '../../../config/judgment.config.js';
import { isInsideZone } from '../PostureMatcher.js';
import {
  calcArmExtensionRatio,
  calcDominanceRatio,
  calcLateralReach,
  calcNormalizedZoneDistance,
  calcVelocity,
  normalizeByShoulder,
  GEOM_EPSILON,
} from '../../utils/PoseGeometry.js';

export interface TrackedHandPoint {
  x: number;
  y: number;
  visibility: number;
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
  isDirectionSatisfied?: boolean;
}

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

export interface ArmGateEvaluationInput {
  hand: 'left' | 'right';
  pos: TrackedHandPoint;
  prevPos: TrackedHandPoint | null;
  prevInside4: boolean;
  prevInside5: boolean;
  dt: number;
  shoulderPos: { x: number; y: number };
  shoulderWidth: number;
  isBodyJumping: boolean;
  isJumpBlocked?: boolean;
  baseWristX?: number | null;
  toleranceMultiplier?: number;
}

export interface ArmGateEvaluationOptions {
  isJumpBlocked?: boolean;
  baseWristX?: number | null;
  toleranceMultiplier?: number;
}

export interface CandidateArbitrationResult {
  winner: 'left' | 'right' | null;
  isBlocked: boolean;
}

export interface ArmReachGateEvaluatorOptions {
  config?: ArmReachAnswerConfig;
  judgmentConfig?: ArmReachJudgmentConfig;
  zone4?: FitnessZone;
  zone5?: FitnessZone;
}

export class ArmReachGateEvaluator {
  private _config: ArmReachAnswerConfig;
  private _judgmentConfig: ArmReachJudgmentConfig;
  private _zone4: FitnessZone;
  private _zone5: FitnessZone;

  constructor(options?: ArmReachGateEvaluatorOptions) {
    this._config = {
      ...DEFAULT_ARM_REACH_ANSWER_CONFIG,
      ...options?.config,
    };
    this._judgmentConfig = {
      ...DEFAULT_ARM_REACH_JUDGMENT_CONFIG,
      ...options?.judgmentConfig,
      weights: {
        ...DEFAULT_ARM_REACH_JUDGMENT_CONFIG.weights,
        ...options?.judgmentConfig?.weights,
      },
      baselines: {
        ...DEFAULT_ARM_REACH_JUDGMENT_CONFIG.baselines,
        ...options?.judgmentConfig?.baselines,
      },
      direction: {
        ...DEFAULT_ARM_DIRECTION_ANSWER_CONFIG,
        ...options?.judgmentConfig?.direction,
      },
    };
    this._zone4 = options?.zone4 ?? DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
    this._zone5 = options?.zone5 ?? DEFAULT_FITNESS_ZONES.find((z) => z.id === 5)!;
  }

  get config(): ArmReachAnswerConfig {
    return this._config;
  }

  setConfig(config: Partial<ArmReachAnswerConfig>): void {
    this._config = {
      ...this._config,
      ...config,
    };
  }

  get judgmentConfig(): ArmReachJudgmentConfig {
    return this._judgmentConfig;
  }

  setJudgmentConfig(judgmentConfig: Partial<ArmReachJudgmentConfig>): void {
    this._judgmentConfig = {
      ...this._judgmentConfig,
      ...judgmentConfig,
      weights: {
        ...this._judgmentConfig.weights,
        ...judgmentConfig?.weights,
      },
      baselines: {
        ...this._judgmentConfig.baselines,
        ...judgmentConfig?.baselines,
      },
      direction: {
        ...this._judgmentConfig.direction,
        ...judgmentConfig?.direction,
      },
    };
  }

  setZones(zone4: FitnessZone, zone5: FitnessZone): void {
    this._zone4 = zone4;
    this._zone5 = zone5;
  }

  /**
   * 팔 신전, 속도, 방향성 및 5대 게이트 가중 종합 점수 평가
   */
  evaluateArm(input: ArmGateEvaluationInput): ArmEvaluationResult;
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
    extra?: ArmGateEvaluationOptions,
  ): ArmEvaluationResult;
  evaluateArm(
    handOrInput: 'left' | 'right' | ArmGateEvaluationInput,
    pos?: TrackedHandPoint,
    prevPos?: TrackedHandPoint | null,
    prevInside4?: boolean,
    prevInside5?: boolean,
    dt?: number,
    shoulderPos?: { x: number; y: number },
    shoulderWidth?: number,
    isBodyJumping?: boolean,
    extra?: ArmGateEvaluationOptions,
  ): ArmEvaluationResult {
    let input: ArmGateEvaluationInput;
    if (typeof handOrInput === 'object') {
      input = handOrInput;
    } else {
      input = {
        hand: handOrInput,
        pos: pos!,
        prevPos: prevPos ?? null,
        prevInside4: !!prevInside4,
        prevInside5: !!prevInside5,
        dt: dt ?? 0,
        shoulderPos: shoulderPos!,
        shoulderWidth: shoulderWidth ?? 0.20,
        isBodyJumping: !!isBodyJumping,
        isJumpBlocked: extra?.isJumpBlocked,
        baseWristX: extra?.baseWristX,
        toleranceMultiplier: extra?.toleranceMultiplier,
      };
    }

    return this._evaluate(input);
  }

  private _evaluate(input: ArmGateEvaluationInput): ArmEvaluationResult {
    const {
      pos,
      prevPos,
      prevInside4,
      prevInside5,
      dt,
      shoulderPos,
      shoulderWidth,
      isBodyJumping,
      isJumpBlocked,
      baseWristX,
      toleranceMultiplier,
    } = input;

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

    const normDist = calcNormalizedZoneDistance(pos, targetZone);
    // normDist: 0(중심) -> 1.0, 1.0(경계) -> 0.50, 2.0(외부 1반폭) -> 0.0
    const zonePenetrationScore = Math.max(0, Math.min(1, 1.0 - 0.5 * normDist));

    // 3. 속도 계산
    const { vx, vy } = calcVelocity(pos, prevPos, dt);

    // 4. 신체 점프 차단 가드 (Issue #287)
    if (isBodyJumping) {
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
        vx,
        vy,
        armExtensionRatio: 0,
        isInside: false,
        isDynamicReach: false,
      };
    }

    // 5. 모드별 판정: 방향성 모드 vs 레거시 가중치 모드
    if (this._config.mode !== 'legacy_weighted') {
      const effectiveShoulderWidth = shoulderWidth > GEOM_EPSILON ? shoulderWidth : 0.20;
      // lateral = (어깨X - 손목X) / 어깨너비 (Issue #287)
      const lateral = calcLateralReach(pos.x, shoulderPos.x, shoulderWidth);
      const dirConfig = this._judgmentConfig.direction ?? DEFAULT_ARM_DIRECTION_ANSWER_CONFIG;
      const lateralThreshold = dirConfig.lateralThreshold; // 0.55

      const isLeft = lateral >= lateralThreshold;
      const isRight = lateral <= -lateralThreshold;

      let targetAnswerIndexDir: 0 | 1 | null = null;
      let targetZoneIdDir: 4 | 5 | null = null;
      if (isLeft) {
        targetAnswerIndexDir = 0;
        targetZoneIdDir = 4;
      } else if (isRight) {
        targetAnswerIndexDir = 1;
        targetZoneIdDir = 5;
      }

      // Horizontal dominance: |가로 뻗음| >= 1.6 * |세로 뻗음|
      const dx = Math.abs(pos.x - shoulderPos.x);
      const dy = Math.abs(pos.y - shoulderPos.y);
      const isHorizontalDominant = dx >= dirConfig.horizontalDominanceRatio * dy;

      // 창 개방 이후 바깥 방향 이동 거리 검증
      const effectiveBaseX = baseWristX ?? prevPos?.x ?? pos.x;
      let outwardTravel = 0;
      if (isLeft) {
        outwardTravel = effectiveBaseX - pos.x;
      } else if (isRight) {
        outwardTravel = pos.x - effectiveBaseX;
      }
      const minOutwardTravel = dirConfig.outwardTravelRatio * effectiveShoulderWidth;
      const isOutwardTraveled = outwardTravel >= minOutwardTravel;

      const jumpBlocked = !!isJumpBlocked || isBodyJumping;
      const isDirectionSatisfied =
        (isLeft || isRight) && isHorizontalDominant && !jumpBlocked && pos.visibility >= hardMinVis;
      const isValid = isDirectionSatisfied && isOutwardTraveled;

      // 5대 게이트 진행도 환산
      const lateralProgress = Math.min(1.0, Math.max(0, Math.abs(lateral) / lateralThreshold));
      const dominanceProgress =
        dy > 0 ? Math.min(1.0, (dx / dy) / dirConfig.horizontalDominanceRatio) : 1.0;
      const travelProgress =
        minOutwardTravel > 0 ? Math.min(1.0, Math.max(0, outwardTravel / minOutwardTravel)) : 1.0;
      const visibilityScore = Math.max(0, Math.min(1, pos.visibility));
      const armExtensionRatio = normalizeByShoulder(dx, effectiveShoulderWidth);
      const isInsideDir =
        (targetZoneIdDir === 4 && inZone4) || (targetZoneIdDir === 5 && inZone5);

      const gates: ArmReachGateScores = {
        zonePenetration: travelProgress,
        armExtension: lateralProgress,
        horizontalDominance: dominanceProgress,
        velocity: travelProgress,
        visibility: visibilityScore,
      };

      let score = 0;
      if (isValid) {
        const avg = (lateralProgress + dominanceProgress + travelProgress) / 3;
        score = Math.max(
          this._judgmentConfig.confirmThreshold,
          Math.min(1.0, 0.70 + 0.30 * avg),
        );
      } else {
        const avg = lateralProgress * 0.4 + dominanceProgress * 0.3 + travelProgress * 0.3;
        score = Math.min(
          this._judgmentConfig.confirmThreshold - 0.01,
          Math.max(0, avg * 0.69),
        );
      }

      return {
        isValid,
        score,
        gates,
        answerIndex: targetAnswerIndexDir,
        zoneId: targetZoneIdDir,
        vx,
        vy,
        armExtensionRatio,
        isInside: isInsideDir,
        isDynamicReach: Math.abs(vx) >= this._config.dynamicMinHorizontalSpeed,
        isDirectionSatisfied,
      };
    }

    // 6. 레거시 가중치 모드 (Legacy Weighted Mode, Issue #249)
    const armExtensionRatio = calcArmExtensionRatio(pos, shoulderPos, shoulderWidth);
    const baseArmRatio = this._judgmentConfig.baselines.armExtensionRatio; // 0.25
    const armExtensionScore = Math.max(0, Math.min(1, armExtensionRatio / (2 * baseArmRatio)));
    const handSpeedY = Math.abs(vy);

    const wasInZone = targetZoneId === 4 ? prevInside4 : prevInside5;
    const baseSpeed = this._judgmentConfig.baselines.horizontalSpeed; // 0.25
    const baseDominance = this._judgmentConfig.baselines.horizontalDominanceRatio; // 1.2

    // Zone 4는 좌측 방향(vx < 0)이 바깥쪽(-vx > 0), Zone 5는 우측 방향(vx > 0)이 바깥쪽(vx > 0)
    const outwardVx = targetZoneId === 4 ? -vx : vx;
    const isInwardReturn = wasInZone && outwardVx < -baseSpeed;

    let isDynamicReach = false;
    let velocityScore = 0;
    let dominanceScore = 0;

    if (wasInZone || prevPos === null) {
      if (isInwardReturn) {
        velocityScore = 0;
        dominanceScore = 0;
      } else if (prevPos === null || Math.hypot(vx, vy) < 0.05) {
        if (outwardVx > 0) {
          velocityScore = Math.max(0.5, Math.min(1, outwardVx / (2 * baseSpeed)));
          const R = calcDominanceRatio(outwardVx, handSpeedY, 1e-4);
          dominanceScore = Math.max(0.5, Math.min(1, R / (2 * baseDominance)));
        } else {
          velocityScore = 0.50;
          dominanceScore = 0.50;
        }
      } else if (outwardVx > 0) {
        velocityScore = Math.max(0.5, Math.min(1, outwardVx / (2 * baseSpeed)));
        const R = outwardVx / (handSpeedY + 1e-4);
        dominanceScore = Math.max(0.5, Math.min(1, R / (2 * baseDominance)));
      } else {
        velocityScore = 0;
        dominanceScore = 0;
      }
    } else {
      isDynamicReach = true;
      if (outwardVx > 0) {
        velocityScore = Math.max(0.5, Math.min(1, outwardVx / (2 * baseSpeed)));
        const R = outwardVx / (handSpeedY + 1e-4);
        dominanceScore = Math.max(0.5, Math.min(1, R / (2 * baseDominance)));
      } else {
        velocityScore = 0;
        dominanceScore = 0;
      }
    }

    const visibilityScore = Math.max(0, Math.min(1, pos.visibility));

    const gates: ArmReachGateScores = {
      zonePenetration: zonePenetrationScore,
      armExtension: armExtensionScore,
      horizontalDominance: dominanceScore,
      velocity: velocityScore,
      visibility: visibilityScore,
    };

    const score = computeWeightedArmScore(gates, this._judgmentConfig.weights);
    const effectiveThreshold =
      toleranceMultiplier && toleranceMultiplier > 0
        ? this._judgmentConfig.confirmThreshold / toleranceMultiplier
        : this._judgmentConfig.confirmThreshold;
    const isValid = score >= effectiveThreshold && pos.visibility >= hardMinVis;

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

  /**
   * 레거시 가중 모드 양팔 우세 판정 (Dominance Arbitration)
   */
  arbitrateWeightedCandidates(
    leftEval: ArmEvaluationResult | null,
    rightEval: ArmEvaluationResult | null,
  ): CandidateArbitrationResult {
    if (!leftEval && !rightEval) {
      return { winner: null, isBlocked: false };
    }

    if (leftEval?.isValid && rightEval?.isValid) {
      const dominanceRatio = this._judgmentConfig.dominanceRatio; // 1.25
      if (leftEval.score >= dominanceRatio * rightEval.score) {
        return { winner: 'left', isBlocked: false };
      } else if (rightEval.score >= dominanceRatio * leftEval.score) {
        return { winner: 'right', isBlocked: false };
      } else {
        return { winner: null, isBlocked: true };
      }
    } else if (leftEval?.isValid) {
      return { winner: 'left', isBlocked: false };
    } else if (rightEval?.isValid) {
      return { winner: 'right', isBlocked: false };
    }

    return { winner: null, isBlocked: false };
  }

  /**
   * 팔 후보 상태 객체 생성 도우미
   */
  buildCandidateStatus(
    evalResult: ArmEvaluationResult | null,
    hand: 'left' | 'right',
    pt: TrackedHandPoint | null,
    prevInside4: boolean,
    prevInside5: boolean,
  ): ArmCandidateStatus {
    if (evalResult) {
      return {
        hand,
        zoneId: evalResult.zoneId,
        answerIndex: evalResult.answerIndex,
        x: pt?.x ?? 0,
        y: pt?.y ?? 0,
        vx: evalResult.vx,
        vy: evalResult.vy,
        armExtensionRatio: evalResult.armExtensionRatio,
        isInside: evalResult.isInside,
        isValid: evalResult.isValid,
        isDynamicReach: evalResult.isDynamicReach,
        score: evalResult.score,
        gates: evalResult.gates,
      };
    }

    let zoneId: number | null = null;
    let answerIndex: 0 | 1 | null = null;
    if (prevInside4) {
      zoneId = 4;
      answerIndex = 0;
    } else if (prevInside5) {
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
      isInside: prevInside4 || prevInside5,
      isValid: false,
      isDynamicReach: false,
    };
  }
}
