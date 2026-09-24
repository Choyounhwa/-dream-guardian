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
import type { AnswerPosture, BodyPart, PartGate, PostureProgress } from '../types/posture.js';

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
}

/**
 * 부위별 진입 마진값 조회 (기본값: CURSOR_ENTRY_MARGIN)
 */
export function getCursorMargin(
  part: string,
  margins?: Partial<Record<string, number>> | CursorEntryMarginConfig
): number {
  const marginConfig = {
    ...CURSOR_ENTRY_MARGIN,
    ...margins,
  };
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
 * 피트니스 존 내 중심 거리 가중치 계산 (중심 0.5 이내: centerWeight, 그 외: edgeWeight)
 */
export function computeZoneWeight(
  pos: { x: number; y: number },
  zone: FitnessZone,
  centerWeight = POSTURE_TIMING_CONFIG.centerWeight,
  edgeWeight = POSTURE_TIMING_CONFIG.edgeWeight
): number {
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height / 2;
  const dx = Math.abs(pos.x - cx) / (zone.width / 2);
  const dy = Math.abs(pos.y - cy) / (zone.height / 2);
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < 0.5 ? centerWeight : edgeWeight;
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
      const margin = getCursorMargin(part, options?.cursorEntryMargin);

      if (!cPos || !zone || !isInsideZone(cPos, zone, margin)) {
        orderedAllMet = false;
        continue;
      }

      partStates[i].zoneId = zone.id;
      partStates[i].inside = true;
      zoneCovered[zone.id] = true;
      totalWeight += computeZoneWeight(cPos, zone, centerWeight, edgeWeight);
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
    const margin = getCursorMargin(part, options?.cursorEntryMargin);

    // 목표 존들 중 cPos가 들어간 존 탐색
    for (const zone of targetZones) {
      if (isInsideZone(cPos, zone, margin)) {
        partStates[i].zoneId = zone.id;
        partStates[i].inside = true;
        zoneCovered[zone.id] = true;
        totalWeight += computeZoneWeight(cPos, zone, centerWeight, edgeWeight);
        break; // 하나의 목표 존에 안착
      }
    }
  }

  const allPartsInside = partStates.every((s) => s.inside);

  // 조건 (B): ∀ z ∈ Z_target : ∃ p ∈ P, inside(p, z)
  const allZonesCovered = distinctTargetZoneIds.every((zId) => zoneCovered[zId] === true);

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
