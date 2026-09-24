/**
 * RecipeGenerator - 4색 커서 및 10개 피트니스 존 기반 답안 레시피 생성기
 *
 * Tier 1~4 점증적 난이도 곡선 및 색상 비공유 원칙 준수:
 * - Tier 1 (문제 1~3): 단일 손 (leftHand vs rightHand)
 * - Tier 2 (문제 4~7): 머리/얼굴 (head vs leftHand, head vs rightHand)
 * - Tier 3 (문제 8~11): 전신 협응 (leftHand+hip vs rightHand+head 등)
 * - Tier 4 (문제 12+): 상단 만세 포즈 (양손 상단존 도달)
 *
 * @see Issue #104, Issue #105
 */

import {
  FITNESS_ZONES,
  isValidZoneForCursor,
  type FitnessZone,
} from '../../config/zone.config.js';
import type { CursorType } from '../../config/cursor.config.js';
import type { TierConfig as TierInfo } from '../../config/posture.config.js';
import { PostureGenerator } from './PostureGenerator.js';
import type { QuestionPosturePlan } from '../types/posture.js';

export interface ChoiceRecipe {
  choiceIndex: number; // 0 (left), 1 (right)
  requiredCursors: CursorType[];
  targetZoneIds: number[];
}

export interface QuestionRecipePlan {
  tier: TierInfo;
  activeZones: FitnessZone[];
  choices: [ChoiceRecipe, ChoiceRecipe];
}

export class RecipeGenerator {
  private _postureGenerator = new PostureGenerator();
  private _lastZoneKey = '';

  /**
   * PostureGenerator 인스턴스 반환
   */
  get postureGenerator(): PostureGenerator {
    return this._postureGenerator;
  }

  /**
   * 최근 출제된 존 키 (쿨다운 상태)
   */
  get lastZoneKey(): string {
    return this._lastZoneKey;
  }

  /**
   * 쿨다운 초기화
   */
  resetCooldown(): void {
    this._lastZoneKey = '';
    this._postureGenerator.resetCooldown();
  }

  /**
   * 신규 자세 계획(QuestionPosturePlan) 생성
   */
  generatePosturePlan(tier: 1 | 2 | 3 | 4): QuestionPosturePlan {
    return this._postureGenerator.generatePlan(tier);
  }

  /**
   * 문제 번호와 티어 정보에 따라 두 선택지(0: 좌, 1: 우)의 레시피 계획 생성
   *
   * Issue #150 (REFACTOR-POSE-001) & Issue #175 (BUG-ZONE-003):
   * - 공용 활성 피트니스 존(Shared Active Zone) 메커니즘 준수
   * - 좌측(0번) 답안과 우측(1번) 답안 모두 동일한 공용 활성 존(targetZoneIds) 공유
   * - 좌측 답안과 우측 답안은 서로 다른 신체 커서 색상(requiredCursors)을 요구
   * - 전 구역(1~11번) 다채로운 순환/랜덤 출제 및 직전 문제 연속 중복 방지 쿨다운 적용
   *
   * @param tierInfo getTierInfo()로 산출된 티어 정보
   * @param seed 난수 시드 (선택)
   * @param questionNumber 현재 문제 번호 (1-based, 선택)
   */
  generatePlan(tierInfo: TierInfo, seed = Math.random(), questionNumber?: number): QuestionRecipePlan {
    const tier = tierInfo.tier;

    if (tier === 1) {
      // Tier 1 (웜업): 단일 손 (공용 활성 존: 4, 5, 2, 1, 3, 6, 8 등 다양화)
      // 문제 1번은 튜토리얼/첫 진입 일관성을 위해 4번(좌중)으로 시작
      const TIER1_ZONES = [4, 5, 2, 1, 3, 6, 8];
      let selectedId: number;

      if (questionNumber === 1) {
        selectedId = 4;
      } else {
        let candidates = TIER1_ZONES;
        if (this._lastZoneKey) {
          const filtered = candidates.filter((id) => String(id) !== this._lastZoneKey);
          if (filtered.length > 0) candidates = filtered;
        }
        selectedId = candidates[Math.floor(seed * candidates.length) % candidates.length];
      }

      this._lastZoneKey = String(selectedId);
      const commonZone = FITNESS_ZONES.find((z) => z.id === selectedId)!;

      return {
        tier: tierInfo,
        activeZones: [commonZone],
        choices: [
          { choiceIndex: 0, requiredCursors: ['leftHand'], targetZoneIds: [selectedId] },
          { choiceIndex: 1, requiredCursors: ['rightHand'], targetZoneIds: [selectedId] },
        ],
      };
    }

    if (tier === 2) {
      // Tier 2 (체간 스트레칭): 머리 기울이기 vs 반대쪽 손 뻗기 (공용 중단 존 4 또는 5 교차)
      interface Tier2Config {
        readonly zoneId: number;
        readonly c0: readonly CursorType[];
        readonly c1: readonly CursorType[];
      }
      const TIER2_CONFIGS: readonly Tier2Config[] = [
        { zoneId: 4, c0: ['head'], c1: ['rightHand'] },
        { zoneId: 4, c0: ['leftHand'], c1: ['head'] },
        { zoneId: 5, c0: ['head'], c1: ['leftHand'] },
        { zoneId: 5, c0: ['rightHand'], c1: ['head'] },
      ];

      let candidates: readonly Tier2Config[] = TIER2_CONFIGS;
      if (this._lastZoneKey) {
        const filtered = candidates.filter((c) => String(c.zoneId) !== this._lastZoneKey);
        if (filtered.length > 0) candidates = filtered;
      }

      const pick = candidates[Math.floor(seed * candidates.length) % candidates.length];
      this._lastZoneKey = String(pick.zoneId);
      const commonZone = FITNESS_ZONES.find((z) => z.id === pick.zoneId)!;

      return {
        tier: tierInfo,
        activeZones: [commonZone],
        choices: [
          { choiceIndex: 0, requiredCursors: [...pick.c0], targetZoneIds: [pick.zoneId] },
          { choiceIndex: 1, requiredCursors: [...pick.c1], targetZoneIds: [pick.zoneId] },
        ],
      };
    }

    if (tier === 3) {
      // Tier 3 (전신 협응 2존): 손 + 골반(스쿼트) vs 손 + 머리
      // [4, 10], [5, 10], [4, 6], [5, 8], [4, 8], [5, 6], [4, 11], [5, 9] 등 8종 2존 조합 다양화
      interface Tier3Config {
        readonly mid: number;
        readonly squat: number;
        readonly c0: readonly CursorType[];
        readonly c1: readonly CursorType[];
      }
      const TIER3_COMBINATIONS: readonly Tier3Config[] = [
        { mid: 4, squat: 10, c0: ['leftHand', 'hip'], c1: ['rightHand', 'head'] },
        { mid: 5, squat: 10, c0: ['leftHand', 'head'], c1: ['rightHand', 'hip'] },
        { mid: 4, squat: 6,  c0: ['leftHand', 'hip'], c1: ['rightHand', 'head'] },
        { mid: 5, squat: 8,  c0: ['leftHand', 'head'], c1: ['rightHand', 'hip'] },
        { mid: 4, squat: 8,  c0: ['leftHand', 'hip'], c1: ['rightHand', 'head'] },
        { mid: 5, squat: 6,  c0: ['leftHand', 'head'], c1: ['rightHand', 'hip'] },
        { mid: 4, squat: 11, c0: ['leftHand', 'hip'], c1: ['rightHand', 'head'] },
        { mid: 5, squat: 9,  c0: ['leftHand', 'head'], c1: ['rightHand', 'hip'] },
      ];

      let candidates: readonly Tier3Config[] = TIER3_COMBINATIONS;
      if (this._lastZoneKey) {
        const filtered = candidates.filter((c) => {
          const key = [c.mid, c.squat].sort((a, b) => a - b).join(',');
          return key !== this._lastZoneKey;
        });
        if (filtered.length > 0) candidates = filtered;
      }

      const pick = candidates[Math.floor(seed * candidates.length) % candidates.length];
      const key = [pick.mid, pick.squat].sort((a, b) => a - b).join(',');
      this._lastZoneKey = key;

      const midZone = FITNESS_ZONES.find((z) => z.id === pick.mid)!;
      const squatZone = FITNESS_ZONES.find((z) => z.id === pick.squat)!;

      return {
        tier: tierInfo,
        activeZones: [midZone, squatZone],
        choices: [
          { choiceIndex: 0, requiredCursors: [...pick.c0], targetZoneIds: [pick.mid, pick.squat] },
          { choiceIndex: 1, requiredCursors: [...pick.c1], targetZoneIds: [pick.mid, pick.squat] },
        ],
      };
    }

    // Tier 4 (보스 피니시): 공용 상단존 (상단 1, 2, 3번 만세 및 중단 도달 다양화)
    const TIER4_ZONES = [2, 1, 3, 5, 4];
    let candidates = TIER4_ZONES;
    if (this._lastZoneKey) {
      const filtered = candidates.filter((id) => String(id) !== this._lastZoneKey);
      if (filtered.length > 0) candidates = filtered;
    }
    const selectedId = candidates[Math.floor(seed * candidates.length) % candidates.length];
    this._lastZoneKey = String(selectedId);
    const topZone = FITNESS_ZONES.find((z) => z.id === selectedId)!;

    return {
      tier: tierInfo,
      activeZones: [topZone],
      choices: [
        { choiceIndex: 0, requiredCursors: ['leftHand'], targetZoneIds: [selectedId] },
        { choiceIndex: 1, requiredCursors: ['rightHand'], targetZoneIds: [selectedId] },
      ],
    };
  }

  /**
   * 주어진 신체 커서가 특정 피트니스 존에 유효한지 검증 (zone.config.ts 연동)
   */
  isValidZoneForCursor(cursor: CursorType, zoneId: number): boolean {
    return isValidZoneForCursor(cursor, zoneId);
  }
}
