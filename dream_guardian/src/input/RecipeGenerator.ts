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

  /**
   * PostureGenerator 인스턴스 반환
   */
  get postureGenerator(): PostureGenerator {
    return this._postureGenerator;
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
   * Issue #150 (REFACTOR-POSE-001):
   * - 공용 활성 피트니스 존(Shared Active Zone) 메커니즘 준수
   * - 좌측(0번) 답안과 우측(1번) 답안 모두 동일한 공용 활성 존(targetZoneIds) 공유
   * - 좌측 답안과 우측 답안은 서로 다른 신체 커서 색상(requiredCursors)을 요구
   *
   * @param tierInfo getTierInfo()로 산출된 티어 정보
   * @param seed 난수 시드 (선택)
   */
  generatePlan(tierInfo: TierInfo, seed = Math.random()): QuestionRecipePlan {
    const tier = tierInfo.tier;

    if (tier === 1) {
      // Tier 1 (웜업): 단일 손 (공용 활성 존: Zone 4 좌측)
      // 좌측(0번) 답안: 왼손 (시안), 우측(1번) 답안: 오른손 (노랑)
      const commonZone = FITNESS_ZONES.find((z) => z.id === 4)!;

      return {
        tier: tierInfo,
        activeZones: [commonZone],
        choices: [
          { choiceIndex: 0, requiredCursors: ['leftHand'], targetZoneIds: [4] },
          { choiceIndex: 1, requiredCursors: ['rightHand'], targetZoneIds: [4] },
        ],
      };
    }

    if (tier === 2) {
      // Tier 2 (체간 스트레칭): 머리 기울이기 vs 반대쪽 손 뻗기 (공용 상단 존 2 또는 1)
      const pickHeadLeft = seed > 0.5;
      const commonZoneId = pickHeadLeft ? 2 : 1;
      const commonZone = FITNESS_ZONES.find((z) => z.id === commonZoneId)!;

      return {
        tier: tierInfo,
        activeZones: [commonZone],
        choices: pickHeadLeft
          ? [
              { choiceIndex: 0, requiredCursors: ['head'], targetZoneIds: [commonZoneId] },
              { choiceIndex: 1, requiredCursors: ['rightHand'], targetZoneIds: [commonZoneId] },
            ]
          : [
              { choiceIndex: 0, requiredCursors: ['leftHand'], targetZoneIds: [commonZoneId] },
              { choiceIndex: 1, requiredCursors: ['head'], targetZoneIds: [commonZoneId] },
            ],
      };
    }

    if (tier === 3) {
      // Tier 3 (전신 협응): 손 + 골반(스쿼트) vs 손 + 머리 (공용 2존: 상단 2번, 중하 7번)
      const topZone = FITNESS_ZONES.find((z) => z.id === 2)!; // 상단 (머리/손)
      const hipZone = FITNESS_ZONES.find((z) => z.id === 7)!; // 중하 (골반/손)

      return {
        tier: tierInfo,
        activeZones: [topZone, hipZone],
        choices: [
          { choiceIndex: 0, requiredCursors: ['leftHand', 'hip'], targetZoneIds: [2, 7] },
          { choiceIndex: 1, requiredCursors: ['rightHand', 'head'], targetZoneIds: [2, 7] },
        ],
      };
    }

    // Tier 4 (보스 피니시): 공용 상단존 (상단 2번 만세)
    const zoneCenterTop = FITNESS_ZONES.find((z) => z.id === 2)!;

    return {
      tier: tierInfo,
      activeZones: [zoneCenterTop],
      choices: [
        { choiceIndex: 0, requiredCursors: ['leftHand'], targetZoneIds: [2] },
        { choiceIndex: 1, requiredCursors: ['rightHand'], targetZoneIds: [2] },
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
