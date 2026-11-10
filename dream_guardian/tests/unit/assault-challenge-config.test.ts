/**
 * assault-challenge-config.test.ts - 보스 접근전 챌린지 출제 조정값 config 단위 테스트
 *
 * @see Issue #649 [ASSAULT-CHALLENGE-CH-04]
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 4.3, 11.2)
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  DEFAULT_ASSAULT_CHALLENGE_CONFIG,
  type AssaultChallengeConfig,
  type AssaultChallengeFamilyTrapRules,
} from '../../config/assault-challenge.config.js';
import { DEFAULT_ASSAULT_QUESTION_CONFIG } from '../../config/assault-question.config.js';
import type { AssaultChallengeFamily } from '../../src/types/assaultChallenge.js';

describe('[ASSAULT-CHALLENGE-CH-04 / #649] 챌린지 출제 조정값 config', () => {
  describe('1. 기본 객체 및 불변성 (deepFreeze)', () => {
    it('타입 계약: DEFAULT_ASSAULT_CHALLENGE_CONFIG는 AssaultChallengeConfig를 만족한다', () => {
      expectTypeOf(DEFAULT_ASSAULT_CHALLENGE_CONFIG).toMatchTypeOf<AssaultChallengeConfig>();
      expectTypeOf(DEFAULT_ASSAULT_CHALLENGE_CONFIG.familyTrapRules).toMatchTypeOf<AssaultChallengeFamilyTrapRules>();
    });

    it('DEFAULT_ASSAULT_CHALLENGE_CONFIG가 정의되어 있어야 한다', () => {
      expect(DEFAULT_ASSAULT_CHALLENGE_CONFIG).toBeDefined();
      expect(typeof DEFAULT_ASSAULT_CHALLENGE_CONFIG).toBe('object');
    });

    it('최상위 및 모든 중첩 객체/배열이 deepFreeze로 동결되어 있어야 한다', () => {
      const cfg = DEFAULT_ASSAULT_CHALLENGE_CONFIG;
      expect(Object.isFrozen(cfg)).toBe(true);
      expect(Object.isFrozen(cfg.chapterFamilyWeights)).toBe(true);
      expect(Object.isFrozen(cfg.chapterFamilyWeights[1])).toBe(true);
      expect(Object.isFrozen(cfg.chapterFamilyWeights[2])).toBe(true);
      expect(Object.isFrozen(cfg.chapterFamilyWeights[3])).toBe(true);
      expect(Object.isFrozen(cfg.chapterFamilyWeights[4])).toBe(true);
      expect(Object.isFrozen(cfg.chapterFamilyWeights[5])).toBe(true);
      expect(Object.isFrozen(cfg.pairIndexDifficultyScale)).toBe(true);
      expect(Object.isFrozen(cfg.familyTrapRules)).toBe(true);
      expect(Object.isFrozen(cfg.familyTrapRules.rule_hunt)).toBe(true);
      expect(Object.isFrozen(cfg.familyTrapRules.rule_hunt.deltaOffsets)).toBe(true);
      expect(Object.isFrozen(cfg.familyTrapRules.duel)).toBe(true);
      expect(Object.isFrozen(cfg.familyTrapRules.duel.diffRange)).toBe(true);
      expect(Object.isFrozen(cfg.familyTrapRules.equivalence)).toBe(true);
      expect(Object.isFrozen(cfg.familyTrapRules.equivalence.operandTrapOffsets)).toBe(true);
      expect(Object.isFrozen(cfg.familyTrapRules.progression)).toBe(true);
      expect(Object.isFrozen(cfg.familyTrapRules.progression.deltaOffsets)).toBe(true);
      expect(Object.isFrozen(cfg.familyTrapRules.progression.skipStepOffsets)).toBe(true);
    });

    it('동결된 객체에 속성을 추가하거나 수정하려고 하면 예외가 발생해야 한다', () => {
      const cfg = DEFAULT_ASSAULT_CHALLENGE_CONFIG as Record<string, unknown>;
      expect(() => {
        cfg.minSessionFamilies = 999;
      }).toThrow();

      expect(() => {
        (cfg.chapterFamilyWeights as Record<string, unknown>)['1'] = {};
      }).toThrow();
    });
  });

  describe('2. 보기 라벨 글자 수 상한 (maxLabelChars)', () => {
    it('DEFAULT_ASSAULT_QUESTION_CONFIG.maxLabelChars(6)와 정확히 일치해야 한다 (재정의 금지)', () => {
      expect(DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxLabelChars).toBe(
        DEFAULT_ASSAULT_QUESTION_CONFIG.maxLabelChars
      );
      expect(DEFAULT_ASSAULT_CHALLENGE_CONFIG.maxLabelChars).toBe(6);
    });
  });

  describe('3. 챕터별 계열 가중치 (chapterFamilyWeights, DOC-18 §4.1 매핑)', () => {
    const chapters: (1 | 2 | 3 | 4 | 5)[] = [1, 2, 3, 4, 5];
    const allFamilies: AssaultChallengeFamily[] = ['rule_hunt', 'duel', 'equivalence', 'progression'];

    it('1부터 5까지 모든 챕터가 정의되어 있어야 한다', () => {
      for (const ch of chapters) {
        expect(DEFAULT_ASSAULT_CHALLENGE_CONFIG.chapterFamilyWeights[ch]).toBeDefined();
      }
    });

    it('각 챕터의 4개 계열 가중치는 유한값이며 음수나 NaN이 아니어야 한다', () => {
      for (const ch of chapters) {
        const weights = DEFAULT_ASSAULT_CHALLENGE_CONFIG.chapterFamilyWeights[ch];
        for (const fam of allFamilies) {
          const w = weights[fam];
          expect(typeof w).toBe('number');
          expect(Number.isFinite(w)).toBe(true);
          expect(Number.isNaN(w)).toBe(false);
          expect(w).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('DOC-18 §4.1 매핑에 부합해야 한다', () => {
      const { chapterFamilyWeights } = DEFAULT_ASSAULT_CHALLENGE_CONFIG;

      // Ch.1: rule_hunt, equivalence, progression (duel은 미배정 0)
      expect(chapterFamilyWeights[1].rule_hunt).toBeGreaterThan(0);
      expect(chapterFamilyWeights[1].equivalence).toBeGreaterThan(0);
      expect(chapterFamilyWeights[1].progression).toBeGreaterThan(0);
      expect(chapterFamilyWeights[1].duel).toBe(0);

      // Ch.2: rule_hunt, duel, equivalence, progression (전 계열)
      expect(chapterFamilyWeights[2].rule_hunt).toBeGreaterThan(0);
      expect(chapterFamilyWeights[2].duel).toBeGreaterThan(0);
      expect(chapterFamilyWeights[2].equivalence).toBeGreaterThan(0);
      expect(chapterFamilyWeights[2].progression).toBeGreaterThan(0);

      // Ch.3: duel, equivalence (분수 대결 및 동치)
      expect(chapterFamilyWeights[3].duel).toBeGreaterThan(0);
      expect(chapterFamilyWeights[3].equivalence).toBeGreaterThan(0);
      expect(chapterFamilyWeights[3].rule_hunt).toBe(0);
      expect(chapterFamilyWeights[3].progression).toBe(0);

      // Ch.4: duel, equivalence (소수 대결 및 동치)
      expect(chapterFamilyWeights[4].duel).toBeGreaterThan(0);
      expect(chapterFamilyWeights[4].equivalence).toBeGreaterThan(0);
      expect(chapterFamilyWeights[4].rule_hunt).toBe(0);
      expect(chapterFamilyWeights[4].progression).toBe(0);

      // Ch.5: rule_hunt, duel, progression (종합)
      expect(chapterFamilyWeights[5].rule_hunt).toBeGreaterThan(0);
      expect(chapterFamilyWeights[5].duel).toBeGreaterThan(0);
      expect(chapterFamilyWeights[5].progression).toBeGreaterThan(0);
      expect(chapterFamilyWeights[5].equivalence).toBe(0);
    });

    it('각 챕터의 활성 계열 가중치 합은 0보다 커야 한다', () => {
      for (const ch of chapters) {
        const weights = DEFAULT_ASSAULT_CHALLENGE_CONFIG.chapterFamilyWeights[ch];
        const sum = allFamilies.reduce((acc, f) => acc + weights[f], 0);
        expect(sum).toBeGreaterThan(0);
      }
    });
  });

  describe('4. 세션 구성 및 연속 제한 수치', () => {
    it('세션 계열 수는 3~4종 범위로 지정되어야 한다 (min: 3, max: 4)', () => {
      const { minSessionFamilies, maxSessionFamilies } = DEFAULT_ASSAULT_CHALLENGE_CONFIG;
      expect(minSessionFamilies).toBe(3);
      expect(maxSessionFamilies).toBe(4);
      expect(minSessionFamilies).toBeLessThanOrEqual(maxSessionFamilies);
      expect(Number.isInteger(minSessionFamilies)).toBe(true);
      expect(Number.isInteger(maxSessionFamilies)).toBe(true);
    });

    it('같은 계열 최대 연속 라운드는 2여야 한다', () => {
      const { maxConsecutiveSameFamily } = DEFAULT_ASSAULT_CHALLENGE_CONFIG;
      expect(maxConsecutiveSameFamily).toBe(2);
      expect(Number.isInteger(maxConsecutiveSameFamily)).toBe(true);
      expect(maxConsecutiveSameFamily).toBeGreaterThan(0);
    });

    it('같은 쪽 정답 최대 연속 수는 3이어야 한다 (좌우 강제 교대 방지 및 편향 방지)', () => {
      const { maxConsecutiveSameSide } = DEFAULT_ASSAULT_CHALLENGE_CONFIG;
      expect(maxConsecutiveSameSide).toBe(3);
      expect(Number.isInteger(maxConsecutiveSameSide)).toBe(true);
      expect(maxConsecutiveSameSide).toBeGreaterThan(0);
    });

    it('계열 첫 등장 가산 읽기 시간은 1.0초(양의 유한수)여야 한다', () => {
      const { firstAppearanceExtraReadSeconds } = DEFAULT_ASSAULT_CHALLENGE_CONFIG;
      expect(firstAppearanceExtraReadSeconds).toBe(1.0);
      expect(Number.isFinite(firstAppearanceExtraReadSeconds)).toBe(true);
      expect(Number.isNaN(firstAppearanceExtraReadSeconds)).toBe(false);
      expect(firstAppearanceExtraReadSeconds).toBeGreaterThan(0);
    });
  });

  describe('5. 쌍 인덱스별 범위 난도 스케일 (pairIndexDifficultyScale)', () => {
    it('배열이 비어있지 않고 4개 이상의 스케일 값이 정의되어 있어야 한다', () => {
      const { pairIndexDifficultyScale } = DEFAULT_ASSAULT_CHALLENGE_CONFIG;
      expect(Array.isArray(pairIndexDifficultyScale)).toBe(true);
      expect(pairIndexDifficultyScale.length).toBeGreaterThanOrEqual(4);
    });

    it('모든 스케일 비율은 0 이하 비율이 없어야 하며, 양의 유한수여야 한다 (음수/NaN/0 이하 금지)', () => {
      const { pairIndexDifficultyScale } = DEFAULT_ASSAULT_CHALLENGE_CONFIG;
      for (const scale of pairIndexDifficultyScale) {
        expect(typeof scale).toBe('number');
        expect(Number.isFinite(scale)).toBe(true);
        expect(Number.isNaN(scale)).toBe(false);
        expect(scale).toBeGreaterThan(0);
      }
    });

    it('쌍 진행에 따라 난도가 단조 증가(또는 유지)해야 한다', () => {
      const { pairIndexDifficultyScale } = DEFAULT_ASSAULT_CHALLENGE_CONFIG;
      expect(pairIndexDifficultyScale[0]).toBe(1.0);
      for (let i = 1; i < pairIndexDifficultyScale.length; i++) {
        expect(pairIndexDifficultyScale[i]).toBeGreaterThanOrEqual(pairIndexDifficultyScale[i - 1]);
      }
    });
  });

  describe('6. 계열별 함정 규칙표 (familyTrapRules)', () => {
    it('4개 계열 모두의 함정 규칙이 정의되어 있어야 한다', () => {
      const { familyTrapRules } = DEFAULT_ASSAULT_CHALLENGE_CONFIG;
      expect(familyTrapRules.rule_hunt).toBeDefined();
      expect(familyTrapRules.duel).toBeDefined();
      expect(familyTrapRules.equivalence).toBeDefined();
      expect(familyTrapRules.progression).toBeDefined();
    });

    it('A 계열(rule_hunt) 함정 규칙: deltaOffsets, reverseDigits, neighborOutOfRange 검증', () => {
      const rule = DEFAULT_ASSAULT_CHALLENGE_CONFIG.familyTrapRules.rule_hunt;
      expect(rule.deltaOffsets).toEqual([-2, -1, 1, 2]);
      expect(rule.deltaOffsets.includes(0)).toBe(false);
      expect(rule.reverseDigits).toBe(true);
      expect(rule.neighborOutOfRange).toBe(true);
    });

    it('B 계열(duel) 함정 규칙: diffRange, decimalPrecisionTrap, fractionDenominatorTrap 검증', () => {
      const rule = DEFAULT_ASSAULT_CHALLENGE_CONFIG.familyTrapRules.duel;
      expect(Array.isArray(rule.diffRange)).toBe(true);
      expect(rule.diffRange.length).toBe(2);
      expect(rule.diffRange[0]).toBeGreaterThan(0);
      expect(rule.diffRange[1]).toBeGreaterThanOrEqual(rule.diffRange[0]);
      expect(rule.decimalPrecisionTrap).toBe(true);
      expect(rule.fractionDenominatorTrap).toBe(true);
    });

    it('C 계열(equivalence) 함정 규칙: operandTrapOffsets 검증', () => {
      const rule = DEFAULT_ASSAULT_CHALLENGE_CONFIG.familyTrapRules.equivalence;
      expect(rule.operandTrapOffsets).toEqual([-2, -1, 1, 2]);
      expect(rule.operandTrapOffsets.includes(0)).toBe(false);
    });

    it('D 계열(progression) 함정 규칙: deltaOffsets, skipStepOffsets 검증', () => {
      const rule = DEFAULT_ASSAULT_CHALLENGE_CONFIG.familyTrapRules.progression;
      expect(rule.deltaOffsets).toEqual([-1, 1]);
      expect(rule.deltaOffsets.includes(0)).toBe(false);
      expect(rule.skipStepOffsets).toEqual([-1, 1]);
      expect(rule.skipStepOffsets.includes(0)).toBe(false);
    });
  });

  describe('7. 오프라인 기본 생성 분량 (rowsPerVariant, DOC-18 §11.2)', () => {
    it('유형당 생성 행 수는 20이어야 한다 (총 280행 검수 분량 규격)', () => {
      const { rowsPerVariant } = DEFAULT_ASSAULT_CHALLENGE_CONFIG;
      expect(rowsPerVariant).toBe(20);
      expect(Number.isInteger(rowsPerVariant)).toBe(true);
      expect(rowsPerVariant).toBeGreaterThan(0);
    });
  });

  describe('8. [CH-23 / #680] CSV 행당 보기 쌍 수 (pairsPerRow SSOT)', () => {
    it('pairsPerRow는 4여야 한다 (문제 1개 = 펀치 4회)', () => {
      const { pairsPerRow } = DEFAULT_ASSAULT_CHALLENGE_CONFIG;
      expect(pairsPerRow).toBe(4);
      expect(Number.isInteger(pairsPerRow)).toBe(true);
    });
  });
});
