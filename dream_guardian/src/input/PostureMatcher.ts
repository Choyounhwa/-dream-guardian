/**
 * PostureMatcher - 집합 덮기(Set Coverage) 기반 자세 판정 엔진
 *
 * RC-1 (부위<->존 고정 1:1 페어링 한계) 및 RC-5 (진행도 피드백 부재) 완전 해결:
 * - 수학적 집합 덮기(Set Coverage) 판정 술어:
 *     (A) ∀ p ∈ P : ∃ z ∈ Z_target, inside(p, z)  [모든 요구 부위가 목표 존 중 하나에 위치]
 *     (B) ∀ z ∈ Z_target : ∃ p ∈ P, inside(p, z)  [모든 목표 존이 최소 1개 이상의 부위로 덮임]
 * - 2부위 1존, 2부위 2존(좌우 교환 허용), 3부위 1~3존, 4부위 지원
 * - 한 존 몰림 방지 (조건 B)
 * - binding: 'ordered' 시 1:1 순서 엄격 판정
 *
 * @see Issue #124 (POSE-002)
 */

import type { FitnessZone } from '../../config/zone.config.js';
import {
  POSTURE_TIMING_CONFIG,
  CURSOR_ENTRY_MARGIN,
  type CursorEntryMarginConfig,
} from '../../config/posture.config.js';
import {
  DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG,
  DEFAULT_TEMPORAL_COVERAGE_CONFIG,
  type ZoneSoftBoundaryConfig,
  type TemporalCoverageConfig,
} from '../../config/judgment.config.js';
import type { AnswerPosture, BodyPart, PartGate, PostureProgress } from '../types/posture.js';

export type { ZoneSoftBoundaryConfig, TemporalCoverageConfig };

export interface MatcherContext {
  shoulderWidth?: number;
  variance?: number;
  recentPositions?: { x: number; y: number }[];
}

export interface PostureMatchResult {
  /** 조건 충족 여부 */
  met: boolean;
  /** 가중치 평균 (중심 가중치 등 적용) */
  avgWeight: number;
  /** 각 요구 부위별 상태 */
  partStates: {
    part: BodyPart;
    zoneId: number | null;
    inside: boolean;
  }[];
  /** 각 목표 존별 덮임(Covered) 여부 */
  zoneCovered: Record<number, boolean>;
}

export interface MatchPostureOptions {
  centerWeight?: number;
  edgeWeight?: number;
  gateEvaluator?: (gate: PartGate) => boolean;
  cursorEntryMargin?: Partial<Record<string, number>> | CursorEntryMarginConfig;
  /** 자세 난이도 티어 (1 | 2 | 3 | 4) */
  tier?: number;
  /** 현재 프레임 시간 (초 단위 타임스탬프) */
  currentTime?: number;
  /** 존별 최근 덮임 타임스탬프 맵 (zoneId -> timestamp) */
  zoneCoveredTimestamps?: Map<number, number>;
  /** 시간 누적 덮기 완화 설정 */
  temporalConfig?: TemporalCoverageConfig;
  /** 누적 윈도우 시간 (미지정 시 티어별 기본값) */
  coverageWindow?: number;
}

/**
 * 좌표 이력으로부터 2차원 분산 계산
 */
export function computePointVariance(positions: { x: number; y: number }[]): number {
  if (!positions || positions.length < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  for (const p of positions) {
    sumX += p.x;
    sumY += p.y;
  }
  const meanX = sumX / positions.length;
  const meanY = sumY / positions.length;
  let sumSqDist = 0;
  for (const p of positions) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    sumSqDist += dx * dx + dy * dy;
  }
  return sumSqDist / positions.length;
}

/**
 * 부위별 진입 마진값 조회 (기본값: CURSOR_ENTRY_MARGIN, 체격 정규화 및 분산 확장 지원)
 *
 * @see Issue #250 [INPUT-TOLERANCE-002]
 */
export function getCursorMargin(
  part: string,
  margins?: Partial<Record<string, number>> | CursorEntryMarginConfig,
  context?: MatcherContext
): number {
  const marginConfig = {
    ...CURSOR_ENTRY_MARGIN,
    ...margins,
  };

  if (context?.shoulderWidth !== undefined) {
    const ref = DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG.referenceShoulderWidth;
    const ratio = context.shoulderWidth / ref;
    let baseMargin = 0;

    if (part === 'hand' || part === 'leftHand' || part === 'rightHand') {
      if (margins && (margins as Record<string, number>)[part] !== undefined) {
        baseMargin = (margins as Record<string, number>)[part]! * ratio;
      } else {
        baseMargin = DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG.handBaseMarginRatio * context.shoulderWidth;
      }
    } else if (part === 'head') {
      baseMargin = (marginConfig.head ?? 0.03) * ratio;
    } else if (part === 'hip') {
      baseMargin = (marginConfig.hip ?? 0.04) * ratio;
    } else {
      baseMargin = ((marginConfig as Record<string, number>)[part] ?? 0) * ratio;
    }

    let isUnstable = false;
    if (context.variance !== undefined && context.variance >= DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG.varianceThreshold) {
      isUnstable = true;
    } else if (context.recentPositions && context.recentPositions.length >= 2) {
      const v = computePointVariance(context.recentPositions);
      if (v >= DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG.varianceThreshold) {
        isUnstable = true;
      }
    }

    if (isUnstable) {
      baseMargin *= DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG.unstableMarginMultiplier;
    }

    return baseMargin;
  }

  // shoulderWidth 미제공 시 기존 절대 마진값 하위 호환
  if (part === 'head') return marginConfig.head ?? 0;
  if (part === 'hip') return marginConfig.hip ?? 0;
  if (part === 'hand' || part === 'leftHand' || part === 'rightHand') return marginConfig.hand ?? 0;
  return (marginConfig as Record<string, number>)[part] ?? 0;
}

/**
 * 좌표가 피트니스 존 내부에 위치하는지 판정 (진입 마진 margin 적용 지원, Issue #170)
 */
export function isInsideZone(
  pos: { x: number; y: number },
  zone: FitnessZone,
  margin = 0
): boolean {
  return (
    pos.x >= zone.x - margin &&
    pos.x <= zone.x + zone.width + margin &&
    pos.y >= zone.y - margin &&
    pos.y <= zone.y + zone.height + margin
  );
}

/**
 * 피트니스 존 내 중심 거리 및 자석 존 연속 감쇠 가중치 계산
 * 중심(1.5) -> 가장자리(0.75) -> 자석 외곽(0.0)
 *
 * @see Issue #250 [INPUT-TOLERANCE-002]
 */
export function computeZoneWeight(
  pos: { x: number; y: number },
  zone: FitnessZone,
  centerWeight = POSTURE_TIMING_CONFIG.centerWeight,
  edgeWeight = POSTURE_TIMING_CONFIG.edgeWeight,
  snapRadius = DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG.snapRadius
): number {
  const distX = Math.max(0, zone.x - pos.x, pos.x - (zone.x + zone.width));
  const distY = Math.max(0, zone.y - pos.y, pos.y - (zone.y + zone.height));
  const outsideDist = Math.sqrt(distX * distX + distY * distY);

  if (outsideDist > 0) {
    if (outsideDist >= snapRadius) {
      return 0;
    }
    return (1 - outsideDist / snapRadius) * edgeWeight;
  }

  // 존 내부: 중심(1.5)에서 가장자리(0.75)까지 연속 감쇠
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height / 2;
  const dx = Math.abs(pos.x - cx) / (zone.width / 2);
  const dy = Math.abs(pos.y - cy) / (zone.height / 2);
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist >= 0.99999) return edgeWeight;
  return centerWeight - dist * (centerWeight - edgeWeight);
}

/**
 * 상태 유지형 피트니스 존 판정기 (히스테리시스 Schmitt Trigger 및 존 덮기 시간 누적 관리)
 */
export class PostureMatcher {
  private _activeZones: Set<string> = new Set();
  private _zoneCoveredTimestamps: Map<number, number> = new Map();

  public reset(): void {
    this._activeZones.clear();
    this._zoneCoveredTimestamps.clear();
  }

  public get zoneCoveredTimestamps(): Map<number, number> {
    return this._zoneCoveredTimestamps;
  }

  public isCursorInsideZone(
    cursorType: string,
    pos: { x: number; y: number },
    zone: FitnessZone,
    context?: MatcherContext
  ): boolean {
    const key = `${cursorType}_${zone.id}`;
    const enterMargin = getCursorMargin(cursorType, undefined, context);
    const exitMargin = enterMargin + DEFAULT_ZONE_SOFT_BOUNDARY_CONFIG.exitMarginBonus;
    const wasInside = this._activeZones.has(key);

    const inside = wasInside
      ? isInsideZone(pos, zone, exitMargin)
      : isInsideZone(pos, zone, enterMargin);

    if (inside) {
      this._activeZones.add(key);
    } else {
      this._activeZones.delete(key);
    }

    return inside;
  }

  public matchPosture(
    posture: AnswerPosture,
    cursors:
      | Map<string, { x: number; y: number } | null | undefined>
      | Record<string, { x: number; y: number } | null | undefined>,
    zones: readonly FitnessZone[],
    options?: MatchPostureOptions
  ): PostureMatchResult {
    return matchPosture(posture, cursors, zones, {
      ...options,
      zoneCoveredTimestamps: options?.zoneCoveredTimestamps ?? this._zoneCoveredTimestamps,
    });
  }
}

const defaultMatcherInstance = new PostureMatcher();

export function isCursorInsideZone(
  cursorType: string,
  pos: { x: number; y: number },
  zone: FitnessZone,
  context?: MatcherContext
): boolean {
  return defaultMatcherInstance.isCursorInsideZone(cursorType, pos, zone, context);
}

export function resetPostureMatcher(): void {
  defaultMatcherInstance.reset();
}

/**
 * AnswerPosture와 신체 커서 위치를 비교하여 집합 덮기 기반으로 판정
 *
 * @param posture 평가 대상 자세 (요구 부위, 목표 존, 바인딩 모드, 게이트)
 * @param cursors 신체 부위별 좌표 맵 (Map 또는 Key-Value 객체)
 * @param zones 전체 피트니스 존 목록
 * @param options 가중치 및 게이트 평가 함수 옵션
 */
export function matchPosture(
  posture: AnswerPosture,
  cursors:
    | Map<string, { x: number; y: number } | null | undefined>
    | Record<string, { x: number; y: number } | null | undefined>,
  zones: readonly FitnessZone[],
  options?: MatchPostureOptions
): PostureMatchResult {
  const centerWeight = options?.centerWeight ?? POSTURE_TIMING_CONFIG.centerWeight;
  const edgeWeight = options?.edgeWeight ?? POSTURE_TIMING_CONFIG.edgeWeight;

  const getCursorPos = (part: string): { x: number; y: number } | null => {
    if (cursors instanceof Map) {
      const pos = cursors.get(part);
      return pos && typeof pos.x === 'number' && typeof pos.y === 'number' ? pos : null;
    }
    const pos = (cursors as Record<string, { x: number; y: number } | null | undefined>)[part];
    return pos && typeof pos.x === 'number' && typeof pos.y === 'number' ? pos : null;
  };

  const partStates: {
    part: BodyPart;
    zoneId: number | null;
    inside: boolean;
  }[] = posture.parts.map((p) => ({
    part: p,
    zoneId: null,
    inside: false,
  }));

  const distinctTargetZoneIds = Array.from(new Set(posture.zoneIds));
  const zoneCovered: Record<number, boolean> = {};
  for (const zId of distinctTargetZoneIds) {
    zoneCovered[zId] = false;
  }

  // 요구 부위가 없거나 목표 존이 비어있으면 불충족
  if (posture.parts.length === 0 || distinctTargetZoneIds.length === 0) {
    return { met: false, avgWeight: 0, partStates, zoneCovered };
  }

  // 목표 존 객체 조회
  const targetZones = distinctTargetZoneIds
    .map((zId) => zones.find((z) => z.id === zId))
    .filter((z): z is FitnessZone => z !== undefined);

  // 목표 존 중 유효하지 않은 존 ID가 있는 경우
  if (targetZones.length !== distinctTargetZoneIds.length) {
    return { met: false, avgWeight: 0, partStates, zoneCovered };
  }

  let totalWeight = 0;

  // ─────────────────────────────────────────────────────────────
  // 1. 순서 엄격 바인딩 모드 ('ordered')
  // ─────────────────────────────────────────────────────────────
  if (posture.binding === 'ordered') {
    let orderedAllMet = true;
    const n = Math.min(posture.parts.length, posture.zoneIds.length);

    for (let i = 0; i < n; i++) {
      const part = posture.parts[i];
      const targetZoneId = posture.zoneIds[i];
      const zone = zones.find((z) => z.id === targetZoneId);
      const cPos = getCursorPos(part);

      if (!cPos || !zone) {
        orderedAllMet = false;
        continue;
      }

      // 비목표 존 침범 가드: 비목표 존 내부에 완벽히 위치할 경우 목표 존 매칭 차단
      const isStrictlyInOtherZone = zones.some(
        (otherZone) => !distinctTargetZoneIds.includes(otherZone.id) && isInsideZone(cPos, otherZone, 0)
      );
      if (isStrictlyInOtherZone) {
        orderedAllMet = false;
        continue;
      }

      const margin = getCursorMargin(part, options?.cursorEntryMargin);

      if (!isInsideZone(cPos, zone, margin)) {
        orderedAllMet = false;
        continue;
      }

      partStates[i].zoneId = zone.id;
      partStates[i].inside = true;
      zoneCovered[zone.id] = true;
      const evalPos = {
        x: Math.max(zone.x, Math.min(zone.x + zone.width, cPos.x)),
        y: Math.max(zone.y, Math.min(zone.y + zone.height, cPos.y)),
      };
      totalWeight += computeZoneWeight(evalPos, zone, centerWeight, edgeWeight);
    }

    // 모든 목표 존이 덮였는지 확인
    const allZonesCovered = distinctTargetZoneIds.every((zId) => zoneCovered[zId] === true);

    // 게이트 검증
    let gatesMet = true;
    if (posture.gates && posture.gates.length > 0 && options?.gateEvaluator) {
      gatesMet = posture.gates.every((g) => options.gateEvaluator!(g));
    }

    const met = orderedAllMet && allZonesCovered && gatesMet;
    return {
      met,
      avgWeight: met ? totalWeight / Math.max(1, posture.parts.length) : 0,
      partStates,
      zoneCovered,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 2. 집합 덮기(Set Coverage) 바인딩 모드 ('any')
  // ─────────────────────────────────────────────────────────────

  // 조건 (A): ∀ p ∈ P : ∃ z ∈ Z_target, inside(p, z)
  for (let i = 0; i < posture.parts.length; i++) {
    const part = posture.parts[i];
    const cPos = getCursorPos(part);
    if (!cPos) continue;

    // 비목표 존 침범 가드: 비목표 존 내부에 완벽히 위치할 경우 목표 존 매칭 차단 (Red 시나리오 8)
    const isStrictlyInOtherZone = zones.some(
      (otherZone) => !distinctTargetZoneIds.includes(otherZone.id) && isInsideZone(cPos, otherZone, 0)
    );
    if (isStrictlyInOtherZone) continue;

    const margin = getCursorMargin(part, options?.cursorEntryMargin);

    // 목표 존들 중 cPos가 들어간 존 탐색
    for (const zone of targetZones) {
      if (isInsideZone(cPos, zone, margin)) {
        partStates[i].zoneId = zone.id;
        partStates[i].inside = true;
        zoneCovered[zone.id] = true;
        const evalPos = {
          x: Math.max(zone.x, Math.min(zone.x + zone.width, cPos.x)),
          y: Math.max(zone.y, Math.min(zone.y + zone.height, cPos.y)),
        };
        totalWeight += computeZoneWeight(evalPos, zone, centerWeight, edgeWeight);
        break; // 하나의 목표 존에 안착
      }
    }
  }

  const allPartsInside = partStates.every((s) => s.inside);

  // 조건 (B): ∀ z ∈ Z_target : ∃ p ∈ P, inside(p, z) (시간 누적 완화 지원, Issue #253)
  // ordered 바인딩은 상단에서 조기 반환되므로 any 바인딩 모드에만 시간 누적 완화 적용
  const temporalConfig = options?.temporalConfig ?? DEFAULT_TEMPORAL_COVERAGE_CONFIG;
  const isTemporalActive =
    temporalConfig.enableTemporalCoverage &&
    (options?.tier === 3 || options?.tier === 4);

  let allZonesCovered = false;

  if (isTemporalActive) {
    const timestamps = options?.zoneCoveredTimestamps ?? defaultMatcherInstance.zoneCoveredTimestamps;
    const currentTime = options?.currentTime ?? 0;
    const coverageWindow =
      options?.coverageWindow ??
      (options?.tier === 4 ? temporalConfig.tier4Window : temporalConfig.tier3Window);

    // 1. 현재 프레임에서 덮인 목표 존의 타임스탬프 갱신
    for (const zId of distinctTargetZoneIds) {
      if (zoneCovered[zId]) {
        timestamps.set(zId, currentTime);
      }
    }

    // 2. 만료된 타임스탬프 정리 및 윈도우 내 덮임 상태 반영
    for (const [zId, ts] of Array.from(timestamps.entries())) {
      if (currentTime - ts > coverageWindow || currentTime < ts) {
        timestamps.delete(zId);
      } else if (distinctTargetZoneIds.includes(zId)) {
        zoneCovered[zId] = true;
      }
    }

    // 3. 모든 목표 존이 윈도우 내 유효 타임스탬프를 보유하는지 검증
    allZonesCovered = distinctTargetZoneIds.every((zId) => timestamps.has(zId));
  } else {
    allZonesCovered = distinctTargetZoneIds.every((zId) => zoneCovered[zId] === true);
  }

  // 게이트(PartGate) 검증
  let gatesMet = true;
  if (posture.gates && posture.gates.length > 0 && options?.gateEvaluator) {
    gatesMet = posture.gates.every((g) => options.gateEvaluator!(g));
  }

  const met = allPartsInside && allZonesCovered && gatesMet;
  const avgWeight = met ? totalWeight / Math.max(1, posture.parts.length) : 0;

  return {
    met,
    avgWeight,
    partStates,
    zoneCovered,
  };
}

/**
 * 프레임별 판정 결과를 PostureProgress 객체로 포맷팅
 */
export function createPostureProgress(
  choiceIndex: 0 | 1,
  currentProgress: number,
  matchResult: PostureMatchResult
): PostureProgress {
  return {
    choiceIndex,
    progress: currentProgress,
    met: matchResult.met,
    partStates: matchResult.partStates,
    zoneCovered: matchResult.zoneCovered,
  };
}
