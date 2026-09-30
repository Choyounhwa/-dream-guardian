/**
 * StarSequenceGenerator - fitness pattern.csv를 순차 단일 별 안무로 변환한다.
 *
 * CSV의 동시 다부위 패턴은 부위-존 쌍별로 한 비트에 하나씩 분해한다. 이 모듈은
 * 안무 후보만 생성하며, 별 타이밍 판정과 렌더링은 후속 카드의 책임이다.
 *
 * @see Issue #181 (CHOREO-STAR-001)
 */
import {
  HEAD_ZONES,
  HIP_ZONES,
  LEFT_HAND_ZONES,
  RIGHT_HAND_ZONES,
  isCrossBodyViolation,
} from '../../config/zone.config.js';
import type { FitnessPatternRecord } from '../types/posture.js';
import type { StarTarget } from '../types/star.js';

export type { StarTarget } from '../types/star.js';

export interface StarSequenceGeneratorOptions {
  /** 재현 가능한 후보 선택에 쓰는 32비트 seed */
  seed?: number;
}

export interface StarTargetValidationResult {
  valid: boolean;
  reason?: string;
}

const ZONE_GRID: Readonly<Record<number, readonly [row: number, column: number]>> = {
  1: [0, 0], 2: [0, 1], 3: [0, 2],
  4: [1, 0], 5: [1, 2],
  6: [2, 0], 7: [2, 1], 8: [2, 2],
  9: [3, 0], 10: [3, 1], 11: [3, 2],
};

/**
 * 별 목표의 독립 안전성 검사.
 * 같은 부위/같은 존의 연속 반복과 동일 부위의 장거리 왕복을 막는다.
 */
export function validateStarTargets(
  targets: readonly StarTarget[],
): StarTargetValidationResult {
  for (let index = 0; index < targets.length; index++) {
    const target = targets[index];
    if (target.beatIndex !== index + 1) {
      return { valid: false, reason: '별 목표의 beatIndex는 1부터 연속되어야 합니다.' };
    }
    if (!isAllowedZone(target.part, target.zoneId)) {
      return { valid: false, reason: `${target.part}은 존 ${target.zoneId}에 배치할 수 없습니다.` };
    }

    const previous = targets[index - 1];
    if (previous && previous.part === target.part && previous.zoneId === target.zoneId) {
      return { valid: false, reason: '직전 별과 동일 부위/동일 존을 반복할 수 없습니다.' };
    }

    const twoBeatsAgo = targets[index - 2];
    if (
      twoBeatsAgo
      && twoBeatsAgo.part === target.part
      && twoBeatsAgo.zoneId === target.zoneId
      && previous?.part === target.part
      && zoneDistance(twoBeatsAgo.zoneId, previous.zoneId) >= 3
    ) {
      return { valid: false, reason: '같은 부위의 장거리 왕복은 안전하지 않습니다.' };
    }
  }

  return { valid: true };
}

/** CSV 패턴에서 안전한 순차 별 안무 후보를 선택한다. */
export class StarSequenceGenerator {
  private readonly _patterns: readonly FitnessPatternRecord[];
  private _state: number;

  constructor(patterns: readonly FitnessPatternRecord[], options?: StarSequenceGeneratorOptions) {
    this._patterns = [...patterns];
    this._state = (options?.seed ?? 0x9e3779b9) >>> 0;
  }

  /**
   * 남은 비트에 맞는 가장 짧은 안전 후보군에서 결정적으로 한 패턴을 고른다.
   * 적합한 후보가 없다면 안전한 패턴 하나를 남은 비트 수만큼 절단한다.
   */
  generate(remainingBeats: number): StarTarget[] {
    const beatLimit = Math.max(0, Math.floor(remainingBeats));
    if (beatLimit === 0) return [];

    const safePatterns = this._patterns.filter((pattern) => this.isSafePattern(pattern));
    if (safePatterns.length === 0) return [];

    const fitting = safePatterns.filter((pattern) => pattern.parts.length <= beatLimit);
    const candidates = fitting.length > 0 ? fitting : safePatterns;
    const shortestLength = Math.min(...candidates.map((pattern) => pattern.parts.length));
    const shortestCandidates = candidates.filter((pattern) => pattern.parts.length === shortestLength);
    const selected = shortestCandidates[Math.floor(this.nextRandom() * shortestCandidates.length)];

    return this.generateFromPattern(selected, beatLimit);
  }

  /** 하나의 CSV 패턴을 입력 순서대로 한 비트당 한 별로 분해한다. */
  generateFromPattern(pattern: FitnessPatternRecord, remainingBeats: number): StarTarget[] {
    const beatLimit = Math.max(0, Math.floor(remainingBeats));
    const targetCount = Math.min(pattern.parts.length, beatLimit);

    return pattern.parts.slice(0, targetCount).map((part, index) => ({
      patternId: pattern.id,
      part,
      zoneId: pattern.zoneIds[index],
      beatIndex: index + 1,
    }));
  }

  private isSafePattern(pattern: FitnessPatternRecord): boolean {
    if (pattern.parts.length === 0 || pattern.parts.length !== pattern.zoneIds.length) return false;
    if (pattern.hip !== null) {
      if (pattern.leftHand !== null && isCrossBodyViolation(pattern.leftHand, pattern.hip)) return false;
      if (pattern.rightHand !== null && isCrossBodyViolation(pattern.rightHand, pattern.hip)) return false;
    }

    return validateStarTargets(this.generateFromPattern(pattern, pattern.parts.length)).valid;
  }

  private nextRandom(): number {
    this._state = (Math.imul(1664525, this._state) + 1013904223) >>> 0;
    return this._state / 0x1_0000_0000;
  }
}

function isAllowedZone(part: StarTarget['part'], zoneId: number): boolean {
  if (part === 'leftHand') return LEFT_HAND_ZONES.has(zoneId);
  if (part === 'rightHand') return RIGHT_HAND_ZONES.has(zoneId);
  if (part === 'head') return HEAD_ZONES.has(zoneId);
  return HIP_ZONES.has(zoneId);
}

function zoneDistance(firstZoneId: number, secondZoneId: number): number {
  const first = ZONE_GRID[firstZoneId];
  const second = ZONE_GRID[secondZoneId];
  if (!first || !second) return Number.POSITIVE_INFINITY;
  return Math.abs(first[0] - second[0]) + Math.abs(first[1] - second[1]);
}
