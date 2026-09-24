/**
 * PostureGenerator - 패턴 풀 기반 좌/우 선택지 생성기 및 C1~C7 제약 검증기
 *
 * RC-4 (활성 존 집합 파생 및 존 수 제어 불가) 및 RC-6 (도달 가능성 제약 부재) 완전 해결:
 * - 7대 생성 안전 제약조건 (C1~C7):
 *     C1: |union(A.zoneIds, B.zoneIds)| <= maxActiveZones (기본 3)
 *     C2: A.parts \ B.parts ≠ ∅ AND B.parts \ A.parts ≠ ∅ (배타적 부위 보장으로 동시 충족 Deadlock 원천 차단)
 *     C3: head와 hip 동일 존 요구 배제
 *     C4: head와 hip 동시 요구 시 zone(head).y < zone(hip).y 보장
 *     C5: 부위별 허용 존 검증 (머리: HEAD_ZONES, 골반: HIP_ZONES)
 *     C6: parts.length >= distinct(zoneIds).length (집합 덮기 가능성 보장)
 *     C7: 최근 3문제 내 동일 patternId 제외 쿨다운
 *
 * @see Issue #125 (POSE-003)
 */

import {
  DEFAULT_FITNESS_ZONES,
  HEAD_ZONES,
  HIP_ZONES,
  LEFT_HAND_ZONES,
  RIGHT_HAND_ZONES,
  isCrossBodyViolation,
  type FitnessZone,
} from '../../config/zone.config.js';
import { TIER_CONFIGS, type TierConfig } from '../../config/posture.config.js';
import type {
  AnswerPosture,
  FitnessPatternRecord,
  QuestionPosturePlan,
} from '../types/posture.js';
import type { QuestionRecipePlan } from './RecipeGenerator.js';
import { postureToChoiceRecipe } from '../types/posture.js';

export interface ConstraintCheckResult {
  valid: boolean;
  violatedConstraint?: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8';
  reason?: string;
}

export interface PostureGeneratorOptions {
  patterns?: FitnessPatternRecord[];
  zones?: readonly FitnessZone[];
  maxActiveZones?: number;
  cooldownQuestionCount?: number;
  seedFn?: () => number;
}

/**
 * 큐레이션된 기본 피트니스 체조 패턴 16종 (외부 데이터 부재 시 내장 풀)
 *
 * Issue #156 (FEAT-ZONE-003):
 * - 양손 전 존(1~11) 허용
 * - 머리 중단 존(HEAD_ZONES: 4, 5) 한정
 * - Cross-Body 물리 연동 제약 (골반 9~11 시 손 1~3 배제)
 * - 완전 색상 비공유 원칙 (A.parts ∩ B.parts = ∅) 준수
 */
export const DEFAULT_CURATED_PATTERNS: AnswerPosture[] = [
  // Tier 1 (단일 손 및 기본 도달: 왼손 vs 오른손)
  { choiceIndex: 0, parts: ['leftHand'], zoneIds: [1], binding: 'any', patternId: 'P01_L_UP' },
  { choiceIndex: 1, parts: ['rightHand'], zoneIds: [3], binding: 'any', patternId: 'P02_R_UP' },
  { choiceIndex: 0, parts: ['leftHand'], zoneIds: [4], binding: 'any', patternId: 'P03_L_MID' },
  { choiceIndex: 1, parts: ['rightHand'], zoneIds: [8], binding: 'any', patternId: 'P04_R_MID' },

  // Tier 2 (머리 vs 손 스트레칭: 상호 배타)
  { choiceIndex: 0, parts: ['head'], zoneIds: [4], binding: 'ordered', patternId: 'P05_HEAD_L' },
  { choiceIndex: 1, parts: ['rightHand'], zoneIds: [3], binding: 'any', patternId: 'P06_RH_UP' },
  { choiceIndex: 0, parts: ['leftHand'], zoneIds: [1], binding: 'any', patternId: 'P07_LH_UP' },
  { choiceIndex: 1, parts: ['head'], zoneIds: [5], binding: 'ordered', patternId: 'P08_HEAD_R' },

  // Tier 3 (전신 협응 2부위: {왼손, 골반} vs {오른손, 머리})
  { choiceIndex: 0, parts: ['leftHand', 'hip'], zoneIds: [4, 7], binding: 'any', patternId: 'P09_L_SQUAT' },
  { choiceIndex: 1, parts: ['rightHand', 'head'], zoneIds: [8, 5], binding: 'any', patternId: 'P10_R_HEAD' },
  { choiceIndex: 0, parts: ['head', 'leftHand'], zoneIds: [4, 1], binding: 'any', patternId: 'P11_HEAD_LH' },
  { choiceIndex: 1, parts: ['hip', 'rightHand'], zoneIds: [7, 8], binding: 'any', patternId: 'P12_HIP_RH' },

  // Tier 4 (보스 피니시 2부위: 완전 색상 비공유 조합)
  { choiceIndex: 0, parts: ['leftHand', 'hip'], zoneIds: [2, 7], binding: 'any', patternId: 'P13_FINISH_L' },
  { choiceIndex: 1, parts: ['rightHand', 'head'], zoneIds: [2, 5], binding: 'any', patternId: 'P14_FINISH_R' },
  { choiceIndex: 0, parts: ['leftHand', 'head'], zoneIds: [1, 4], binding: 'any', patternId: 'P15_FINISH_ALT_L' },
  { choiceIndex: 1, parts: ['rightHand', 'hip'], zoneIds: [3, 7], binding: 'any', patternId: 'P16_FINISH_ALT_R' },
];

/**
 * 두 선택지 자세(A, B)가 7대 안전 제약조건(C1~C7)을 만족하는지 엄격히 검증
 */
export function validatePosturePair(
  postureA: AnswerPosture,
  postureB: AnswerPosture,
  options?: {
    zones?: readonly FitnessZone[];
    maxActiveZones?: number;
    recentPatternIds?: string[];
  }
): ConstraintCheckResult {
  const zones = options?.zones ?? DEFAULT_FITNESS_ZONES;
  const maxActiveZones = options?.maxActiveZones ?? 3;
  const recentPatternIds = options?.recentPatternIds ?? [];

  // ── C1: 활성 존 합집합 개수 제한 (<= maxActiveZones, 기본 3) ──
  const unionZones = new Set([...postureA.zoneIds, ...postureB.zoneIds]);
  if (unionZones.size > maxActiveZones) {
    return {
      valid: false,
      violatedConstraint: 'C1',
      reason: `활성 존 개수(${unionZones.size})가 최대 허용치(${maxActiveZones})를 초과합니다.`,
    };
  }

  // ── C2: 완전 색상 비공유 보장 (A.parts ∩ B.parts = ∅, Issue #151) ──
  const setB = new Set(postureB.parts);
  const sharedParts = postureA.parts.filter((p) => setB.has(p));

  if (sharedParts.length > 0) {
    return {
      valid: false,
      violatedConstraint: 'C2',
      reason: `양측 선택지 간 공유하는 신체 부위(${sharedParts.join(', ')})가 존재하여 완전 색상 비공유 원칙을 위반합니다.`,
    };
  }

  // ── C6: 부위 수 >= 고유 존 수 검증 (parts.length >= distinct(zoneIds).length) ──
  const distinctA = new Set(postureA.zoneIds);
  const distinctB = new Set(postureB.zoneIds);
  if (postureA.parts.length < distinctA.size) {
    return {
      valid: false,
      violatedConstraint: 'C6',
      reason: `선택지 A의 부위 수(${postureA.parts.length})가 존 수(${distinctA.size})보다 적습니다.`,
    };
  }
  if (postureB.parts.length < distinctB.size) {
    return {
      valid: false,
      violatedConstraint: 'C6',
      reason: `선택지 B의 부위 수(${postureB.parts.length})가 존 수(${distinctB.size})보다 적습니다.`,
    };
  }

  // ── C5 & C3 & C4: 개별 자세 및 상호 신체 도달 가능성 검증 ──
  for (const posture of [postureA, postureB]) {
    const hasHead = posture.parts.includes('head');
    const hasHip = posture.parts.includes('hip');

    // C5: 부위별 허용 존 검증
    for (let i = 0; i < posture.parts.length; i++) {
      const p = posture.parts[i];
      const zId = posture.zoneIds[i] ?? posture.zoneIds[0];

      if (p === 'head' && !HEAD_ZONES.has(zId)) {
        return {
          valid: false,
          violatedConstraint: 'C5',
          reason: `머리 커서는 중단 좌/우 존(HEAD_ZONES: 4, 5)만 사용 가능하나 존 ${zId}가 할당되었습니다.`,
        };
      }
      if (p === 'hip' && !HIP_ZONES.has(zId)) {
        return {
          valid: false,
          violatedConstraint: 'C5',
          reason: `골반 커서는 하단 존(HIP_ZONES: 6~11)만 사용 가능하나 존 ${zId}가 할당되었습니다.`,
        };
      }
      if (p === 'leftHand' && !LEFT_HAND_ZONES.has(zId)) {
        return {
          valid: false,
          violatedConstraint: 'C5',
          reason: `왼손 커서는 허용 존(LEFT_HAND_ZONES: 1~11)만 사용 가능하나 존 ${zId}가 할당되었습니다.`,
        };
      }
      if (p === 'rightHand' && !RIGHT_HAND_ZONES.has(zId)) {
        return {
          valid: false,
          violatedConstraint: 'C5',
          reason: `오른손 커서는 허용 존(RIGHT_HAND_ZONES: 1~11)만 사용 가능하나 존 ${zId}가 할당되었습니다.`,
        };
      }
    }

    // ── C8: Cross-Body 물리 연동 제약 (골반 최하단 9~11 시 손 최상단 1~3 차단, Issue #156 / #158) ──
    const hipIndices = posture.parts
      .map((p, idx) => (p === 'hip' ? idx : -1))
      .filter((idx) => idx !== -1);
    const handIndices = posture.parts
      .map((p, idx) => (p === 'leftHand' || p === 'rightHand' ? idx : -1))
      .filter((idx) => idx !== -1);

    for (const hipIdx of hipIndices) {
      const zHip = posture.zoneIds[hipIdx] ?? posture.zoneIds[0];
      for (const handIdx of handIndices) {
        const zHand = posture.zoneIds[handIdx] ?? posture.zoneIds[0];
        if (isCrossBodyViolation(zHand, zHip)) {
          return {
            valid: false,
            violatedConstraint: 'C8',
            reason: `골반이 최하단 존(${zHip})일 때 손이 최상단 존(${zHand})에 위치할 수 없습니다 (Cross-Body 제약 위반).`,
          };
        }
      }
    }

    // C3: head와 hip 동일 존 요구 배제
    if (hasHead && hasHip) {
      const headIndices = posture.parts
        .map((p, idx) => (p === 'head' ? idx : -1))
        .filter((idx) => idx !== -1);
      const hipIndices = posture.parts
        .map((p, idx) => (p === 'hip' ? idx : -1))
        .filter((idx) => idx !== -1);

      for (const hIdx of headIndices) {
        for (const hipIdx of hipIndices) {
          const zHead = posture.zoneIds[hIdx] ?? posture.zoneIds[0];
          const zHip = posture.zoneIds[hipIdx] ?? posture.zoneIds[0];

          if (zHead === zHip) {
            return {
              valid: false,
              violatedConstraint: 'C3',
              reason: `머리와 골반이 동일한 존(${zHead})을 요구할 수 없습니다.`,
            };
          }

          // C4: zone(head).y < zone(hip).y 보장
          const zoneHeadObj = zones.find((z) => z.id === zHead);
          const zoneHipObj = zones.find((z) => z.id === zHip);
          if (zoneHeadObj && zoneHipObj && zoneHeadObj.y >= zoneHipObj.y) {
            return {
              valid: false,
              violatedConstraint: 'C4',
              reason: `머리 존(y: ${zoneHeadObj.y})이 골반 존(y: ${zoneHipObj.y})보다 아래에 위치할 수 없습니다.`,
            };
          }
        }
      }
    }
  }

  // ── C7: 최근 N문제 내 동일 patternId 제외 쿨다운 ──
  if (recentPatternIds.length > 0) {
    if (recentPatternIds.includes(postureA.patternId) || recentPatternIds.includes(postureB.patternId)) {
      return {
        valid: false,
        violatedConstraint: 'C7',
        reason: `최근 출제된 패턴(${postureA.patternId}, ${postureB.patternId}) 쿨다운 제약 위반`,
      };
    }
  }

  return { valid: true };
}

/**
 * 패턴 풀 기반 좌/우 답안 자세 생성기
 */
export class PostureGenerator {
  private _patterns: AnswerPosture[] = [];
  private _zones: readonly FitnessZone[];
  private _maxActiveZones: number;
  private _cooldownQueue: string[] = [];
  private _cooldownLimit: number;
  private _seedFn: () => number;

  constructor(options?: PostureGeneratorOptions) {
    this._zones = options?.zones ?? DEFAULT_FITNESS_ZONES;
    this._maxActiveZones = options?.maxActiveZones ?? 3;
    this._cooldownLimit = (options?.cooldownQuestionCount ?? 3) * 2; // 문제당 2개 패턴
    this._seedFn = options?.seedFn ?? Math.random;

    if (options?.patterns && options.patterns.length > 0) {
      this._patterns = options.patterns.map((r, idx) => ({
        choiceIndex: (idx % 2 === 0 ? 0 : 1) as 0 | 1,
        parts: [...r.parts],
        zoneIds: [...r.zoneIds],
        binding: 'any',
        patternId: r.id,
      }));
    } else {
      this._patterns = [...DEFAULT_CURATED_PATTERNS];
    }
  }

  /**
   * 외부 패턴 레코드(CSV 로더 산출물 등) 풀 등록
   */
  setPatterns(records: FitnessPatternRecord[]): void {
    this._patterns = records.map((r, idx) => ({
      choiceIndex: (idx % 2 === 0 ? 0 : 1) as 0 | 1,
      parts: [...r.parts],
      zoneIds: [...r.zoneIds],
      binding: 'any',
      patternId: r.id,
    }));
  }

  /**
   * 쿨다운 큐 초기화
   */
  resetCooldown(): void {
    this._cooldownQueue = [];
  }

  /**
   * 현재 쿨다운 큐 조회
   */
  get cooldownQueue(): readonly string[] {
    return this._cooldownQueue;
  }

  /**
   * 티어 정보에 따라 7대 안전 제약을 만족하는 QuestionPosturePlan 생성
   * @param tier 1~4 난이도 티어
   */
  generatePlan(tier: 1 | 2 | 3 | 4): QuestionPosturePlan {
    const candidates = this.getCandidatesForTier(tier);

    // 최대 50회 시도하며 C1~C7 제약 충족 쌍 탐색
    const maxAttempts = 50;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const idxA = Math.floor(this._seedFn() * candidates.length);
      let idxB = Math.floor(this._seedFn() * candidates.length);
      if (idxA === idxB && candidates.length > 1) {
        idxB = (idxB + 1) % candidates.length;
      }

      const rawA = candidates[idxA];
      const rawB = candidates[idxB];

      const postureA: AnswerPosture = {
        ...rawA,
        choiceIndex: 0,
      };
      const postureB: AnswerPosture = {
        ...rawB,
        choiceIndex: 1,
      };

      const check = validatePosturePair(postureA, postureB, {
        zones: this._zones,
        maxActiveZones: this._maxActiveZones,
        recentPatternIds: this._cooldownQueue,
      });

      if (check.valid) {
        this.pushCooldown(postureA.patternId);
        this.pushCooldown(postureB.patternId);

        const activeZoneIds = Array.from(new Set([...postureA.zoneIds, ...postureB.zoneIds]));
        return {
          tier,
          activeZoneIds,
          postures: [postureA, postureB],
        };
      }
    }

    // 50회 시도 실패 시 (쿨다운 제외 후 재시도)
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const idxA = Math.floor(this._seedFn() * candidates.length);
      let idxB = (idxA + 1) % candidates.length;

      const postureA: AnswerPosture = { ...candidates[idxA], choiceIndex: 0 };
      const postureB: AnswerPosture = { ...candidates[idxB], choiceIndex: 1 };

      const check = validatePosturePair(postureA, postureB, {
        zones: this._zones,
        maxActiveZones: this._maxActiveZones,
        // 쿨다운 검사 제외
        recentPatternIds: [],
      });

      if (check.valid) {
        this.pushCooldown(postureA.patternId);
        this.pushCooldown(postureB.patternId);

        const activeZoneIds = Array.from(new Set([...postureA.zoneIds, ...postureB.zoneIds]));
        return {
          tier,
          activeZoneIds,
          postures: [postureA, postureB],
        };
      }
    }

    // 최종 안전 폴백 (C1~C6 항상 보장)
    const fallbackA: AnswerPosture = {
      choiceIndex: 0,
      parts: ['leftHand'],
      zoneIds: [4],
      binding: 'any',
      patternId: 'SAFE_FALLBACK_L',
    };
    const fallbackB: AnswerPosture = {
      choiceIndex: 1,
      parts: ['rightHand'],
      zoneIds: [8],
      binding: 'any',
      patternId: 'SAFE_FALLBACK_R',
    };

    return {
      tier,
      activeZoneIds: [4, 8],
      postures: [fallbackA, fallbackB],
    };
  }

  /**
   * QuestionPosturePlan을 기존 RecipePlan 형태로 변환 (하위 호환)
   */
  toRecipePlan(plan: QuestionPosturePlan): QuestionRecipePlan {
    const activeZones = plan.activeZoneIds
      .map((id) => this._zones.find((z) => z.id === id))
      .filter((z): z is FitnessZone => z !== undefined);

    const tierConfig: TierConfig = TIER_CONFIGS[plan.tier as 1 | 2 | 3 | 4] ?? TIER_CONFIGS[1];

    return {
      tier: tierConfig,
      activeZones,
      choices: [
        postureToChoiceRecipe(plan.postures[0]),
        postureToChoiceRecipe(plan.postures[1]),
      ],
    };
  }

  /**
   * 티어별 후보 패턴 필터링
   */
  private getCandidatesForTier(tier: 1 | 2 | 3 | 4): AnswerPosture[] {
    const list = this._patterns.filter((p) => {
      const parts = p.parts;
      if (tier === 1) {
        // Tier 1: 단일 손 또는 머리 제외 1~2부위
        return parts.length === 1 && (parts.includes('leftHand') || parts.includes('rightHand'));
      }
      if (tier === 2) {
        // Tier 2: 머리 포함 또는 양손
        return parts.includes('head') || (parts.includes('leftHand') && parts.includes('rightHand'));
      }
      if (tier === 3) {
        // Tier 3: 골반 포함 또는 2~3부위 전신
        return parts.includes('hip') || parts.length >= 2;
      }
      // Tier 4: 2~4부위 전신 협응
      return parts.length >= 2;
    });

    return list.length > 0 ? list : DEFAULT_CURATED_PATTERNS;
  }

  private pushCooldown(id: string): void {
    this._cooldownQueue.push(id);
    if (this._cooldownQueue.length > this._cooldownLimit) {
      this._cooldownQueue.shift();
    }
  }
}
