/**
 * StickmanPunchStroke.ts - 졸라맨 팔 뻗기 방향·신전율 기반 동적 찌르기(Stroke) 펀치 연산 모듈 (#726)
 *
 * 순수 연산 모듈: 클래스, 전역 상태, DOM/타이머 일체 사용 금지.
 */

import { STICKMAN_CONFIG } from '../../config/skeleton.config.js';
import { GEOM_EPSILON, calcDistance, type Point2D } from '../utils/PoseGeometry.js';
import type { AssaultInputConfig } from '../../config/assault-input.config.js';
import type { HandPunchState, AssaultHand } from './AssaultPunchAdapter.js';

export interface StickmanArmPose {
  readonly upperArm: number;
  readonly forearm: number;
  readonly confidence: number;
}

export interface StickmanArmReach {
  readonly extension: number;
  readonly side: AssaultHand;
  readonly directionValid: boolean;
  readonly vx: number;
  readonly vy: number;
}

export interface StrokeHandMemory {
  readonly state: HandPunchState;
  readonly prevExtension: number | null;
  readonly prevTimestampMs: number | null;
  readonly holdMs: number;
  readonly holdNotified: boolean;
}

export interface StrokeHandResult {
  readonly memory: StrokeHandMemory;
  readonly fire: boolean;
  readonly holdReached: boolean;
  readonly reach: StickmanArmReach | null;
}

/**
 * 졸라맨 관절 각도로부터 팔 합성 벡터 및 신전율 계산
 */
export function calcStickmanArmReach(
  pose: StickmanArmPose,
  cfg: AssaultInputConfig
): StickmanArmReach {
  const { upperArm: L1, forearm: L2 } = STICKMAN_CONFIG.limbLengths;
  const vx = L1 * Math.cos(pose.upperArm) + L2 * Math.cos(pose.forearm);
  const vy = L1 * Math.sin(pose.upperArm) + L2 * Math.sin(pose.forearm);
  const len = Math.hypot(vx, vy);
  const extension = len / (L1 + L2);
  const side: AssaultHand = vx < 0 ? 'left' : 'right';
  const directionValid =
    len > 1e-6 &&
    Math.abs(vx) / len >= cfg.strokeMinLateralRatio &&
    vy / len <= cfg.strokeMaxDownwardRatio;

  return {
    extension,
    side,
    directionValid,
    vx,
    vy,
  };
}

/**
 * 2D 랜드마크 점 3개(어깨, 팔꿈치, 손목)로부터 ArmPose 생성 (Fallback 경로)
 */
export function armPoseFromPoints(
  shoulder: Point2D,
  elbow: Point2D,
  wrist: Point2D,
  visibility?: number
): StickmanArmPose {
  const dUpper = calcDistance(shoulder, elbow);
  const dForearm = calcDistance(elbow, wrist);
  const isValid = dUpper > GEOM_EPSILON && dForearm > GEOM_EPSILON;

  return {
    upperArm: Math.atan2(elbow.y - shoulder.y, elbow.x - shoulder.x),
    forearm: Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x),
    confidence: isValid ? (visibility !== undefined ? visibility : 1) : 0,
  };
}

/**
 * 손별 스트로크 메모리 초기 생성
 */
export function createStrokeHandMemory(): StrokeHandMemory {
  return {
    state: 'IDLE',
    prevExtension: null,
    prevTimestampMs: null,
    holdMs: 0,
    holdNotified: false,
  };
}

/**
 * 단일 손에 대한 Stroke 펀치 판정 및 상태머신 전이
 */
export function evaluateStrokeHand(params: {
  memory: StrokeHandMemory;
  hand: AssaultHand;
  pose: StickmanArmPose | null;
  timestampMs: number;
  justRecovered: boolean;
  cfg: AssaultInputConfig;
}): StrokeHandResult {
  const { memory, hand, pose, timestampMs, justRecovered, cfg } = params;

  if (!pose || pose.confidence < cfg.strokeMinArmConfidence) {
    return {
      memory,
      fire: false,
      holdReached: false,
      reach: null,
    };
  }

  const reach = calcStickmanArmReach(pose, cfg);
  const { extension, side, directionValid } = reach;

  let nextState: HandPunchState = memory.state;
  let fire = false;

  // 1. 상태 전이
  if (justRecovered) {
    nextState = extension <= cfg.strokeRecoverRatio ? 'READY' : 'EXTENDED';
  } else {
    switch (memory.state) {
      case 'IDLE':
        if (extension <= cfg.strokeRecoverRatio) {
          nextState = 'READY';
        } else if (extension >= cfg.strokeTriggerRatio) {
          nextState = 'EXTENDED';
        }
        break;

      case 'READY':
        if (extension >= cfg.strokeTriggerRatio) {
          nextState = 'EXTENDED';
          if (directionValid && side === hand) {
            fire = true;
          }
        }
        break;

      case 'EXTENDED':
        if (extension <= cfg.strokeRecoverRatio) {
          nextState = 'READY';
        }
        break;

      default:
        break;
    }
  }

  // 2. 미리 뻗고 멈춤(onPreExtendedHold) 계산
  let holdMs = memory.holdMs;
  let holdNotified = memory.holdNotified;
  let holdReached = false;

  if (nextState === 'READY') {
    holdMs = 0;
    holdNotified = false;
  } else if (
    memory.prevExtension !== null &&
    memory.prevTimestampMs !== null &&
    timestampMs - memory.prevTimestampMs > 0
  ) {
    const dtSeconds = (timestampMs - memory.prevTimestampMs) / 1000;
    const rate = Math.abs(extension - memory.prevExtension) / dtSeconds;

    if (
      nextState === 'EXTENDED' &&
      extension >= cfg.strokeTriggerRatio &&
      directionValid &&
      rate <= cfg.preExtendedHoldMaxRatePerSec
    ) {
      holdMs += timestampMs - memory.prevTimestampMs;
    } else {
      holdMs = 0;
    }

    if (holdMs >= cfg.preExtendedHoldMs && !holdNotified) {
      holdReached = true;
      holdNotified = true;
    }
  }

  // 3. prevExtension/prevTimestampMs 갱신
  const nextMemory: StrokeHandMemory = {
    state: nextState,
    prevExtension: extension,
    prevTimestampMs: timestampMs,
    holdMs,
    holdNotified,
  };

  return {
    memory: nextMemory,
    fire,
    holdReached,
    reach,
  };
}
