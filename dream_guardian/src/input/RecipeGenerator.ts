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
  type CursorType,
  type FitnessZone,
  type TierInfo,
  FITNESS_ZONES,
  HEAD_ZONES,
  HIP_ZONES,
} from './AnswerSelector.js';

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
  /**
   * 문제 번호와 티어 정보에 따라 두 선택지(0: 좌, 1: 우)의 레시피 계획 생성
   * @param tierInfo getTierInfo()로 산출된 티어 정보
   * @param seed 난수 시드 (선택)
   */
  generatePlan(tierInfo: TierInfo, seed = Math.random()): QuestionRecipePlan {
    const tier = tierInfo.tier;

    if (tier === 1) {
      // Tier 1 (웜업): 단일 손 (좌측: 왼손, 우측: 오른손)
      // 활성 존: 좌측존(id=4), 우측존(id=5)
      const leftZone = FITNESS_ZONES.find((z) => z.id === 4)!;
      const rightZone = FITNESS_ZONES.find((z) => z.id === 5)!;

      return {
        tier: tierInfo,
        activeZones: [leftZone, rightZone],
        choices: [
          { choiceIndex: 0, requiredCursors: ['leftHand'], targetZoneIds: [4] },
          { choiceIndex: 1, requiredCursors: ['rightHand'], targetZoneIds: [5] },
        ],
      };
    }

    if (tier === 2) {
      // Tier 2 (체간 스트레칭): 머리 기울이기 vs 반대쪽 손 뻗기
      const pickHeadLeft = seed > 0.5;
      if (pickHeadLeft) {
        const leftZone = FITNESS_ZONES.find((z) => z.id === 1)!; // 좌상
        const rightZone = FITNESS_ZONES.find((z) => z.id === 3)!; // 우상
        return {
          tier: tierInfo,
          activeZones: [leftZone, rightZone],
          choices: [
            { choiceIndex: 0, requiredCursors: ['head'], targetZoneIds: [1] },
            { choiceIndex: 1, requiredCursors: ['rightHand'], targetZoneIds: [3] },
          ],
        };
      } else {
        const leftZone = FITNESS_ZONES.find((z) => z.id === 1)!;
        const rightZone = FITNESS_ZONES.find((z) => z.id === 3)!;
        return {
          tier: tierInfo,
          activeZones: [leftZone, rightZone],
          choices: [
            { choiceIndex: 0, requiredCursors: ['leftHand'], targetZoneIds: [1] },
            { choiceIndex: 1, requiredCursors: ['head'], targetZoneIds: [3] },
          ],
        };
      }
    }

    if (tier === 3) {
      // Tier 3 (전신 협응): 손 + 골반(미니 스쿼트) vs 머리 + 손
      const leftZoneTop = FITNESS_ZONES.find((z) => z.id === 4)!; // 좌
      const rightZoneTop = FITNESS_ZONES.find((z) => z.id === 5)!; // 우
      const bottomZone = FITNESS_ZONES.find((z) => z.id === 7)!; // 중하

      return {
        tier: tierInfo,
        activeZones: [leftZoneTop, rightZoneTop, bottomZone],
        choices: [
          { choiceIndex: 0, requiredCursors: ['leftHand', 'hip'], targetZoneIds: [4, 7] },
          { choiceIndex: 1, requiredCursors: ['rightHand', 'head'], targetZoneIds: [5, 7] },
        ],
      };
    }

    // Tier 4 (보스 피니시): 양손 만세 포즈
    const zoneLeftTop = FITNESS_ZONES.find((z) => z.id === 1)!;
    const zoneRightTop = FITNESS_ZONES.find((z) => z.id === 3)!;
    const zoneCenterTop = FITNESS_ZONES.find((z) => z.id === 2)!;

    return {
      tier: tierInfo,
      activeZones: [zoneLeftTop, zoneRightTop, zoneCenterTop],
      choices: [
        { choiceIndex: 0, requiredCursors: ['leftHand'], targetZoneIds: [1] },
        { choiceIndex: 1, requiredCursors: ['rightHand'], targetZoneIds: [3] },
      ],
    };
  }

  /**
   * 주어진 신체 커서가 특정 피트니스 존에 유효한지 검증
   */
  isValidZoneForCursor(cursor: CursorType, zoneId: number): boolean {
    if (cursor === 'head') return HEAD_ZONES.has(zoneId);
    if (cursor === 'hip') return HIP_ZONES.has(zoneId);
    return true; // 손(leftHand, rightHand)은 전 구역 사용 가능
  }
}
