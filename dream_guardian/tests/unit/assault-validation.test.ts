import { describe, it, expect } from 'vitest';
import {
  validateAssaultPlan,
  isAssaultApproachPattern,
} from '../../src/game/assault/AssaultPlanValidator.js';
import {
  DEFAULT_APPROACH_PATTERN,
  type AssaultApproachPattern,
} from '../../src/data/assault/approachPatterns.js';

describe('[BOSS-ASSAULT-05 / #507] 공격 데이터 사전 유효성 검증기 (AssaultPlanValidator)', () => {
  describe('1. 기본 MVP 패턴 및 유효 데이터 검증', () => {
    it('DEFAULT_APPROACH_PATTERN을 성공적으로 검증하고 원본 데이터를 반환해야 한다', () => {
      const result = validateAssaultPlan(DEFAULT_APPROACH_PATTERN);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toBe(DEFAULT_APPROACH_PATTERN);
        expect(result.data.patternId).toBe('pattern_approach_standard_mvp');
        expect(result.data.encounters).toHaveLength(2);
      }
    });

    it('isAssaultApproachPattern 타입 가드가 유효 데이터에 대해 true를 반환해야 한다', () => {
      expect(isAssaultApproachPattern(DEFAULT_APPROACH_PATTERN)).toBe(true);
    });

    it('모든 승인된 kind(answer_pair, squat, jump)를 포함하는 유효 패턴을 통과시켜야 한다', () => {
      const validCustomPattern: AssaultApproachPattern = {
        schemaVersion: '1.0.0',
        patternId: 'pattern_valid_combo',
        timingProfileId: 'profile_assault_standard',
        balanceProfileId: 'assault_mvp_v1',
        totalBeats: 12,
        encounters: [
          {
            id: 'atk_01',
            kind: 'answer_pair',
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
          },
          {
            id: 'atk_02',
            kind: 'squat',
            startBeat: 4,
            durationBeats: 4,
            interactionProfileId: 'profile_squat_standard',
            visualProfileId: 'profile_visual_boss_charge',
          },
          {
            id: 'atk_03',
            kind: 'jump',
            startBeat: 8,
            durationBeats: 4,
            interactionProfileId: 'profile_jump_standard',
            visualProfileId: 'profile_visual_shockwave',
          },
        ],
      };

      const result = validateAssaultPlan(validCustomPattern);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.encounters).toHaveLength(3);
      }
    });

    it('하위 창(windowStartBeat <= windowEndBeat <= arrivalBeat <= recoveryBeat)이 슬롯 내에 있는 유효 데이터를 통과시켜야 한다', () => {
      const patternWithWindows = {
        schemaVersion: '1.0.0',
        patternId: 'pattern_with_windows',
        timingProfileId: 'profile_assault_standard',
        totalBeats: 8,
        encounters: [
          {
            id: 'atk_window_01',
            kind: 'answer_pair',
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
            windowStartBeat: 0.5,
            windowEndBeat: 3.5,
            arrivalBeat: 3.8,
            recoveryBeat: 4.0,
          },
        ],
      };

      const result = validateAssaultPlan(patternWithWindows);
      expect(result.valid).toBe(true);
    });
  });

  describe('2. 비객체 및 잘못된 루트 입력 검증', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['string', 'not an object'],
      ['number', 42],
      ['boolean', true],
      ['array', []],
      ['function', () => {}],
    ])('%s 입력은 INVALID_OBJECT 오류로 거부되어야 한다', (_, input) => {
      const result = validateAssaultPlan(input);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThanOrEqual(1);
        expect(result.errors[0].path).toBe('');
        expect(result.errors[0].code).toBe('INVALID_OBJECT');
      }
      expect(isAssaultApproachPattern(input)).toBe(false);
    });
  });

  describe('3. 스키마 버전 및 패턴 ID 검증', () => {
    it('schemaVersion이 누락되거나 빈 문자열이면 오류를 반환해야 한다', () => {
      const missingVersion = { ...DEFAULT_APPROACH_PATTERN, schemaVersion: undefined };
      const emptyVersion = { ...DEFAULT_APPROACH_PATTERN, schemaVersion: '' };

      const res1 = validateAssaultPlan(missingVersion);
      expect(res1.valid).toBe(false);
      if (!res1.valid) {
        expect(res1.errors.some((e) => e.path === 'schemaVersion')).toBe(true);
      }

      const res2 = validateAssaultPlan(emptyVersion);
      expect(res2.valid).toBe(false);
      if (!res2.valid) {
        expect(res2.errors.some((e) => e.path === 'schemaVersion')).toBe(true);
      }
    });

    it('allowedSchemaVersions 옵션에 포함되지 않은 버전은 거부해야 한다', () => {
      const invalidVersion = { ...DEFAULT_APPROACH_PATTERN, schemaVersion: '2.0.0-beta' };
      const result = validateAssaultPlan(invalidVersion, {
        allowedSchemaVersions: ['1.0.0'],
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === 'schemaVersion' && e.code === 'INVALID_SCHEMA_VERSION')).toBe(true);
      }
    });

    it('patternId가 누락되거나 빈 문자열이면 오류를 반환해야 한다', () => {
      const missingId = { ...DEFAULT_APPROACH_PATTERN, patternId: '' };
      const result = validateAssaultPlan(missingId);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === 'patternId')).toBe(true);
      }
    });
  });

  describe('4. 총 박자(totalBeats) 및 최소 박자(A03) 검증', () => {
    it('totalBeats가 숫자가 아니거나 음수, NaN, Infinity이면 거부해야 한다', () => {
      const invalidBeatsList = [
        { ...DEFAULT_APPROACH_PATTERN, totalBeats: -8 },
        { ...DEFAULT_APPROACH_PATTERN, totalBeats: NaN },
        { ...DEFAULT_APPROACH_PATTERN, totalBeats: Infinity },
        { ...DEFAULT_APPROACH_PATTERN, totalBeats: '8' as unknown as number },
      ];

      for (const invalid of invalidBeatsList) {
        const result = validateAssaultPlan(invalid);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors.some((e) => e.path === 'totalBeats')).toBe(true);
        }
      }
    });

    it('최소 8박 미만(totalBeats < 8)인 경우 A03 규칙 위반으로 거부해야 한다', () => {
      const tooShortPattern = {
        ...DEFAULT_APPROACH_PATTERN,
        totalBeats: 7,
        encounters: [
          {
            id: 'atk_short',
            kind: 'answer_pair' as const,
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
          },
        ],
      };

      const result = validateAssaultPlan(tooShortPattern);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(
          result.errors.some((e) => e.path === 'totalBeats' && (e.code === 'MIN_TOTAL_BEATS_VIOLATION' || e.code === 'INVALID_TOTAL_BEATS'))
        ).toBe(true);
      }
    });

    it('minTotalBeats 옵션으로 지정된 임계치 미만이면 거부해야 한다', () => {
      const result = validateAssaultPlan(DEFAULT_APPROACH_PATTERN, {
        minTotalBeats: 16,
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === 'totalBeats')).toBe(true);
      }
    });
  });

  describe('5. 프로필 식별자 참조 검증', () => {
    it('timingProfileId가 누락되거나 빈 문자열이면 거부해야 한다', () => {
      const invalid = { ...DEFAULT_APPROACH_PATTERN, timingProfileId: '' };
      const result = validateAssaultPlan(invalid);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === 'timingProfileId')).toBe(true);
      }
    });

    it('allowedTimingProfiles 목록에 없는 타이밍 프로필은 거부해야 한다', () => {
      const result = validateAssaultPlan(DEFAULT_APPROACH_PATTERN, {
        allowedTimingProfiles: ['allowed_profile_other'],
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === 'timingProfileId' && e.code === 'UNKNOWN_PROFILE')).toBe(true);
      }
    });

    it('allowedBalanceProfiles 목록에 없는 밸런스 프로필은 거부해야 한다', () => {
      const result = validateAssaultPlan(DEFAULT_APPROACH_PATTERN, {
        allowedBalanceProfiles: ['allowed_balance_other'],
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === 'balanceProfileId' && e.code === 'UNKNOWN_PROFILE')).toBe(true);
      }
    });
  });

  describe('6. encounters 배열 무결성 검증', () => {
    it('encounters가 배열이 아니거나 빈 배열이면 거부해야 한다', () => {
      const notArray = { ...DEFAULT_APPROACH_PATTERN, encounters: null as unknown as [] };
      const emptyArray = { ...DEFAULT_APPROACH_PATTERN, encounters: [] };

      const res1 = validateAssaultPlan(notArray);
      expect(res1.valid).toBe(false);
      if (!res1.valid) {
        expect(res1.errors.some((e) => e.path === 'encounters')).toBe(true);
      }

      const res2 = validateAssaultPlan(emptyArray);
      expect(res2.valid).toBe(false);
      if (!res2.valid) {
        expect(res2.errors.some((e) => e.path === 'encounters')).toBe(true);
      }
    });

    it('encounters 원소가 객체가 아니면 거부해야 한다', () => {
      const invalidElements = {
        ...DEFAULT_APPROACH_PATTERN,
        encounters: [null, 'invalid', 123] as unknown as typeof DEFAULT_APPROACH_PATTERN.encounters,
      };

      const result = validateAssaultPlan(invalidElements);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === 'encounters[0]')).toBe(true);
      }
    });
  });

  describe('7. 개별 조우 필드 무결성 (ID, kind, 박자 수치) 검증', () => {
    it('중복된 attackId를 가진 조우가 존재하면 거부해야 한다', () => {
      const duplicateIdsPattern = {
        ...DEFAULT_APPROACH_PATTERN,
        encounters: [
          {
            id: 'dup_attack_01',
            kind: 'answer_pair' as const,
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
          },
          {
            id: 'dup_attack_01', // 중복 ID
            kind: 'squat' as const,
            startBeat: 4,
            durationBeats: 4,
            interactionProfileId: 'profile_squat_standard',
            visualProfileId: 'profile_visual_boss_charge',
          },
        ],
      };

      const result = validateAssaultPlan(duplicateIdsPattern);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(
          result.errors.some((e) => e.path === 'encounters[1].id' && e.code === 'DUPLICATE_ATTACK_ID')
        ).toBe(true);
      }
    });

    it('알 수 없는 kind(예: punch, dodge, laser 등)는 거부해야 한다', () => {
      const unknownKindPattern = {
        ...DEFAULT_APPROACH_PATTERN,
        encounters: [
          {
            id: 'atk_unknown',
            kind: 'punch' as unknown as 'answer_pair',
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
          },
        ],
      };

      const result = validateAssaultPlan(unknownKindPattern);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(
          result.errors.some((e) => e.path === 'encounters[0].kind' && e.code === 'INVALID_KIND')
        ).toBe(true);
      }
    });

    it('startBeat가 음수, NaN, Infinity이면 거부해야 한다', () => {
      const invalidStartBeats = [-1, NaN, Infinity];

      for (const startBeat of invalidStartBeats) {
        const pattern = {
          ...DEFAULT_APPROACH_PATTERN,
          encounters: [
            {
              id: 'atk_test',
              kind: 'answer_pair' as const,
              startBeat,
              durationBeats: 4,
              interactionProfileId: 'profile_touch_standard',
              visualProfileId: 'profile_visual_card',
            },
          ],
        };

        const result = validateAssaultPlan(pattern);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors.some((e) => e.path === 'encounters[0].startBeat')).toBe(true);
        }
      }
    });

    it('durationBeats가 0 이하, NaN, Infinity이면 거부해야 한다', () => {
      const invalidDurations = [0, -2, NaN, Infinity];

      for (const durationBeats of invalidDurations) {
        const pattern = {
          ...DEFAULT_APPROACH_PATTERN,
          encounters: [
            {
              id: 'atk_test',
              kind: 'answer_pair' as const,
              startBeat: 0,
              durationBeats,
              interactionProfileId: 'profile_touch_standard',
              visualProfileId: 'profile_visual_card',
            },
          ],
        };

        const result = validateAssaultPlan(pattern);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors.some((e) => e.path === 'encounters[0].durationBeats')).toBe(true);
        }
      }
    });

    it('interactionProfileId 또는 visualProfileId가 누락되면 거부해야 한다', () => {
      const missingProfiles = {
        ...DEFAULT_APPROACH_PATTERN,
        encounters: [
          {
            id: 'atk_missing_profiles',
            kind: 'answer_pair' as const,
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: '',
            visualProfileId: '',
          },
        ],
      };

      const result = validateAssaultPlan(missingProfiles);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === 'encounters[0].interactionProfileId')).toBe(true);
        expect(result.errors.some((e) => e.path === 'encounters[0].visualProfileId')).toBe(true);
      }
    });
  });

  describe('8. 박자 경계, 순서 역전 및 중첩(Overlap) 검증', () => {
    it('startBeat + durationBeats가 totalBeats를 초과하면 SLOT_EXCEEDED 오류로 거부해야 한다', () => {
      const exceededPattern = {
        ...DEFAULT_APPROACH_PATTERN,
        totalBeats: 8,
        encounters: [
          {
            id: 'atk_exceeded',
            kind: 'answer_pair' as const,
            startBeat: 5,
            durationBeats: 4, // 5 + 4 = 9 > 8
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
          },
        ],
      };

      const result = validateAssaultPlan(exceededPattern);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(
          result.errors.some((e) => e.path === 'encounters[0]' && e.code === 'SLOT_EXCEEDED')
        ).toBe(true);
      }
    });

    it('슬롯 끝 경계값(startBeat + durationBeats === totalBeats)은 통과하지만 0.001만 초과해도 거부해야 한다', () => {
      const exactBoundary = {
        ...DEFAULT_APPROACH_PATTERN,
        totalBeats: 8,
        encounters: [
          {
            id: 'atk_exact',
            kind: 'answer_pair' as const,
            startBeat: 4,
            durationBeats: 4, // 4 + 4 = 8 === totalBeats
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
          },
        ],
      };
      expect(validateAssaultPlan(exactBoundary).valid).toBe(true);

      const slightlyExceeded = {
        ...DEFAULT_APPROACH_PATTERN,
        totalBeats: 8,
        encounters: [
          {
            id: 'atk_slightly_over',
            kind: 'answer_pair' as const,
            startBeat: 4,
            durationBeats: 4.001, // 8.001 > 8
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
          },
        ],
      };
      const result = validateAssaultPlan(slightlyExceeded);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.code === 'SLOT_EXCEEDED')).toBe(true);
      }
    });

    it('조우 시작 박자가 이전 조우보다 앞서는 순서 역전(ORDER_INVERSION)을 거부해야 한다', () => {
      const invertedPattern = {
        ...DEFAULT_APPROACH_PATTERN,
        encounters: [
          {
            id: 'atk_first',
            kind: 'answer_pair' as const,
            startBeat: 4,
            durationBeats: 4,
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
          },
          {
            id: 'atk_second_inverted',
            kind: 'squat' as const,
            startBeat: 1, // 역전: 1 < 4
            durationBeats: 2,
            interactionProfileId: 'profile_squat_standard',
            visualProfileId: 'profile_visual_boss_charge',
          },
        ],
      };

      const result = validateAssaultPlan(invertedPattern);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(
          result.errors.some(
            (e) => e.path === 'encounters[1].startBeat' && e.code === 'ORDER_INVERSION'
          )
        ).toBe(true);
      }
    });

    it('인접 활성창이 시간상 중첩(ENCOUNTER_OVERLAP)되면 거부해야 한다', () => {
      const overlappingPattern = {
        ...DEFAULT_APPROACH_PATTERN,
        encounters: [
          {
            id: 'atk_01',
            kind: 'answer_pair' as const,
            startBeat: 0,
            durationBeats: 4, // 0~4박
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
          },
          {
            id: 'atk_02',
            kind: 'squat' as const,
            startBeat: 3.5, // 3.5박에 시작 -> 0.5박 중첩 발생!
            durationBeats: 4,
            interactionProfileId: 'profile_squat_standard',
            visualProfileId: 'profile_visual_boss_charge',
          },
        ],
      };

      const result = validateAssaultPlan(overlappingPattern);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(
          result.errors.some(
            (e) => e.path === 'encounters[1]' && e.code === 'ENCOUNTER_OVERLAP'
          )
        ).toBe(true);
      }
    });

    it('minRecoveryBeats 옵션이 지정되었을 때 간격이 부족하면 INSUFFICIENT_RECOVERY_GAP으로 거부해야 한다', () => {
      const tightGapPattern = {
        ...DEFAULT_APPROACH_PATTERN,
        encounters: [
          {
            id: 'atk_01',
            kind: 'answer_pair' as const,
            startBeat: 0,
            durationBeats: 4, // 끝: 4박
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
          },
          {
            id: 'atk_02',
            kind: 'squat' as const,
            startBeat: 4.5, // 간격: 0.5박
            durationBeats: 3,
            interactionProfileId: 'profile_squat_standard',
            visualProfileId: 'profile_visual_boss_charge',
          },
        ],
      };

      // 1.0박의 복귀 유예를 요구하는 경우 0.5박 간격은 거부되어야 함
      const failedResult = validateAssaultPlan(tightGapPattern, {
        minRecoveryBeats: 1.0,
      });
      expect(failedResult.valid).toBe(false);
      if (!failedResult.valid) {
        expect(
          failedResult.errors.some(
            (e) => e.path === 'encounters[1]' && e.code === 'INSUFFICIENT_RECOVERY_GAP'
          )
        ).toBe(true);
      }

      // 정확히 1.0박 확보된 경우 통과
      const validGapPattern = {
        ...DEFAULT_APPROACH_PATTERN,
        encounters: [
          {
            id: 'atk_01',
            kind: 'answer_pair' as const,
            startBeat: 0,
            durationBeats: 4, // 끝: 4박
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
          },
          {
            id: 'atk_02',
            kind: 'squat' as const,
            startBeat: 5.0, // 간격: 1.0박
            durationBeats: 3,
            interactionProfileId: 'profile_squat_standard',
            visualProfileId: 'profile_visual_boss_charge',
          },
        ],
      };
      const passResult = validateAssaultPlan(validGapPattern, {
        minRecoveryBeats: 1.0,
      });
      expect(passResult.valid).toBe(true);
    });
  });

  describe('9. 조우 내부 하위 창(Window Timing) 순서 및 경계 검증', () => {
    it('windowStartBeat가 startBeat보다 앞서면 거부해야 한다', () => {
      const pattern = {
        ...DEFAULT_APPROACH_PATTERN,
        encounters: [
          {
            id: 'atk_window_err',
            kind: 'answer_pair' as const,
            startBeat: 2,
            durationBeats: 4,
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
            windowStartBeat: 1.5, // 1.5 < startBeat 2
          },
        ],
      };

      const result = validateAssaultPlan(pattern);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(
          result.errors.some(
            (e) => e.path === 'encounters[0].windowStartBeat' && e.code === 'INVALID_WINDOW_TIMING'
          )
        ).toBe(true);
      }
    });

    it('windowStartBeat > windowEndBeat 이면 거부해야 한다', () => {
      const pattern = {
        ...DEFAULT_APPROACH_PATTERN,
        encounters: [
          {
            id: 'atk_window_err',
            kind: 'answer_pair' as const,
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
            windowStartBeat: 3.5,
            windowEndBeat: 2.0, // 시작보다 끝이 앞섬
          },
        ],
      };

      const result = validateAssaultPlan(pattern);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(
          result.errors.some(
            (e) => e.path === 'encounters[0].windowEndBeat' && e.code === 'INVALID_WINDOW_TIMING'
          )
        ).toBe(true);
      }
    });

    it('windowEndBeat > arrivalBeat 이면 거부해야 한다', () => {
      const pattern = {
        ...DEFAULT_APPROACH_PATTERN,
        encounters: [
          {
            id: 'atk_window_err',
            kind: 'answer_pair' as const,
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
            windowStartBeat: 1.0,
            windowEndBeat: 3.5,
            arrivalBeat: 3.0, // 도착이 끝보다 앞섬
          },
        ],
      };

      const result = validateAssaultPlan(pattern);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(
          result.errors.some(
            (e) => e.path === 'encounters[0].arrivalBeat' && e.code === 'INVALID_WINDOW_TIMING'
          )
        ).toBe(true);
      }
    });

    it('recoveryBeat가 슬롯 끝(startBeat + durationBeats)을 초과하면 거부해야 한다', () => {
      const pattern = {
        ...DEFAULT_APPROACH_PATTERN,
        encounters: [
          {
            id: 'atk_window_err',
            kind: 'answer_pair' as const,
            startBeat: 0,
            durationBeats: 4, // 슬롯 끝: 4박
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
            windowStartBeat: 1.0,
            windowEndBeat: 3.0,
            arrivalBeat: 3.5,
            recoveryBeat: 4.5, // 슬롯 4박 초과
          },
        ],
      };

      const result = validateAssaultPlan(pattern);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(
          result.errors.some(
            (e) => e.path === 'encounters[0].recoveryBeat' && e.code === 'INVALID_WINDOW_TIMING'
          )
        ).toBe(true);
      }
    });
  });

  describe('10. 순수 함수성, 불변성 보장 및 무부작용(No Side-effects) 검증', () => {
    it('동결된(Object.freeze) 입력을 검증해도 예외 없이 불변을 유지하며 항상 동일한 결과를 반환해야 한다', () => {
      const frozenInput = Object.freeze({
        schemaVersion: '1.0.0',
        patternId: 'pattern_frozen',
        timingProfileId: 'profile_assault_standard',
        totalBeats: 8,
        encounters: Object.freeze([
          Object.freeze({
            id: 'atk_frozen_01',
            kind: 'answer_pair' as const,
            startBeat: 0,
            durationBeats: 4,
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
          }),
        ]),
      });

      const res1 = validateAssaultPlan(frozenInput);
      const res2 = validateAssaultPlan(frozenInput);

      expect(res1.valid).toBe(true);
      expect(res2.valid).toBe(true);
      if (res1.valid && res2.valid) {
        expect(res1.data).toBe(frozenInput);
        expect(res2.data).toBe(frozenInput);
      }
    });

    it('검증 실패 시에도 원본 입력 객체를 수정(자동 보정/절삭)하지 않아야 한다', () => {
      const originalInput = {
        schemaVersion: '1.0.0',
        patternId: 'pattern_err',
        timingProfileId: 'profile_assault_standard',
        totalBeats: 8,
        encounters: [
          {
            id: 'atk_1',
            kind: 'answer_pair' as const,
            startBeat: 5,
            durationBeats: 4, // 초과 (5 + 4 = 9 > 8)
            interactionProfileId: 'profile_touch_standard',
            visualProfileId: 'profile_visual_card',
          },
        ],
      };

      const snapshotBefore = JSON.stringify(originalInput);
      const result = validateAssaultPlan(originalInput);

      expect(result.valid).toBe(false);
      const snapshotAfter = JSON.stringify(originalInput);
      // 원본 데이터 변경 0건 보장
      expect(snapshotAfter).toBe(snapshotBefore);
    });
  });
});
