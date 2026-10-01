import { describe, it, expect, beforeEach } from 'vitest';
import {
  matchPosture,
  PostureMatcher,
  resetPostureMatcher,
} from '../../src/input/PostureMatcher.js';
import { AnswerSelector } from '../../src/input/AnswerSelector.js';
import {
  DEFAULT_FITNESS_ZONES,
  type FitnessZone,
  isCrossBodyViolation,
} from '../../config/zone.config.js';
import {
  DEFAULT_TEMPORAL_COVERAGE_CONFIG,
  type TemporalCoverageConfig,
} from '../../config/judgment.config.js';
import type { AnswerPosture } from '../../src/types/posture.js';

describe('[INPUT-TOLERANCE-005 / #253] 집합 덮기 조건 B 시간 누적 완화 및 Cross-Body 정합성', () => {
  const zones: readonly FitnessZone[] = DEFAULT_FITNESS_ZONES;

  const getZoneCenter = (zoneId: number) => {
    const z = zones.find((item) => item.id === zoneId);
    if (!z) throw new Error(`Zone ${zoneId} not found`);
    return { x: z.x + z.width / 2, y: z.y + z.height / 2 };
  };

  beforeEach(() => {
    resetPostureMatcher();
  });

  describe('기본 설정값 검증', () => {
    it('DEFAULT_TEMPORAL_COVERAGE_CONFIG 기본값이 올바르게 설정되어 있다', () => {
      expect(DEFAULT_TEMPORAL_COVERAGE_CONFIG.enableTemporalCoverage).toBe(true);
      expect(DEFAULT_TEMPORAL_COVERAGE_CONFIG.tier3Window).toBe(1.0);
      expect(DEFAULT_TEMPORAL_COVERAGE_CONFIG.tier4Window).toBe(1.2);
    });
  });

  describe('Scenario 1: Tier 3 윈도우(1.0s) 내 순차 덮기 시 조건 (B) 충족', () => {
    const posture: AnswerPosture = {
      choiceIndex: 0,
      parts: ['leftHand', 'rightHand'],
      zoneIds: [1, 3], // 목표 존: 1, 3
      binding: 'any',
      patternId: 'TEST_P1',
    };

    it('존 1을 0.2s에 덮고, 존 3을 0.6s에 덮으면 둘 다 window 1.0s 내이므로 조건 (B) 충족 및 met: true', () => {
      const timestamps = new Map<number, number>();

      // t = 0.2s: 두 손 모두 존 1에 위치 (조건 A 충족, 존 1만 덮임)
      const cursorsFrame1 = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(1)],
      ]);
      const res1 = matchPosture(posture, cursorsFrame1, zones, {
        tier: 3,
        currentTime: 0.2,
        zoneCoveredTimestamps: timestamps,
      });

      expect(res1.met).toBe(false);
      expect(res1.zoneCovered[1]).toBe(true);
      expect(res1.zoneCovered[3]).toBe(false);
      expect(timestamps.get(1)).toBe(0.2);

      // t = 0.6s: 두 손 모두 존 3으로 이동 (조건 A 충족, 존 3 덮임, 경과 0.4s <= 1.0s)
      const cursorsFrame2 = new Map([
        ['leftHand', getZoneCenter(3)],
        ['rightHand', getZoneCenter(3)],
      ]);
      const res2 = matchPosture(posture, cursorsFrame2, zones, {
        tier: 3,
        currentTime: 0.6,
        zoneCoveredTimestamps: timestamps,
      });

      expect(res2.met).toBe(true);
      expect(res2.zoneCovered[1]).toBe(true);
      expect(res2.zoneCovered[3]).toBe(true);
      expect(timestamps.get(3)).toBe(0.6);
    });

    it('PostureMatcher 인스턴스의 내부 zoneCoveredTimestamps를 통해서도 동일하게 순차 덮기 충족', () => {
      const matcher = new PostureMatcher();

      const cursorsFrame1 = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(1)],
      ]);
      const res1 = matcher.matchPosture(posture, cursorsFrame1, zones, {
        tier: 3,
        currentTime: 0.2,
      });
      expect(res1.met).toBe(false);

      const cursorsFrame2 = new Map([
        ['leftHand', getZoneCenter(3)],
        ['rightHand', getZoneCenter(3)],
      ]);
      const res2 = matcher.matchPosture(posture, cursorsFrame2, zones, {
        tier: 3,
        currentTime: 0.6,
      });
      expect(res2.met).toBe(true);
    });
  });

  describe('Scenario 2: 윈도우 초과 시 오래된 덮기 만료 및 조건 (B) 미충족', () => {
    const posture: AnswerPosture = {
      choiceIndex: 0,
      parts: ['leftHand', 'rightHand'],
      zoneIds: [1, 3],
      binding: 'any',
      patternId: 'TEST_P2',
    };

    it('존 1 덮기(0.2s) 후 1.3s 시점에 존 3을 덮으면 경과 시간 1.1s > window 1.0s이므로 존 1 만료되어 met: false', () => {
      const timestamps = new Map<number, number>();

      // t = 0.2s: 존 1 덮기
      const cursorsFrame1 = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(1)],
      ]);
      matchPosture(posture, cursorsFrame1, zones, {
        tier: 3,
        currentTime: 0.2,
        zoneCoveredTimestamps: timestamps,
      });
      expect(timestamps.get(1)).toBe(0.2);

      // t = 1.3s: 존 3 덮기 (0.2s의 존 1은 1.1s 경과로 만료)
      const cursorsFrame2 = new Map([
        ['leftHand', getZoneCenter(3)],
        ['rightHand', getZoneCenter(3)],
      ]);
      const res2 = matchPosture(posture, cursorsFrame2, zones, {
        tier: 3,
        currentTime: 1.3,
        zoneCoveredTimestamps: timestamps,
      });

      expect(res2.met).toBe(false);
      expect(res2.zoneCovered[1]).toBe(false);
      expect(res2.zoneCovered[3]).toBe(true);
      expect(timestamps.has(1)).toBe(false);
    });
  });

  describe('Scenario 3: Tier 1/2는 순차 덮기 불인정, 동시 덮기만 인정', () => {
    const posture: AnswerPosture = {
      choiceIndex: 0,
      parts: ['leftHand', 'rightHand'],
      zoneIds: [1, 3],
      binding: 'any',
      patternId: 'TEST_P3',
    };

    it('Tier 1: 0.2s 존 1 -> 0.6s 존 3 순차 이동 시 met: false (동시 덮기만 인정)', () => {
      const timestamps = new Map<number, number>();

      const cursors1 = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(1)],
      ]);
      matchPosture(posture, cursors1, zones, {
        tier: 1,
        currentTime: 0.2,
        zoneCoveredTimestamps: timestamps,
      });

      const cursors2 = new Map([
        ['leftHand', getZoneCenter(3)],
        ['rightHand', getZoneCenter(3)],
      ]);
      const res2 = matchPosture(posture, cursors2, zones, {
        tier: 1,
        currentTime: 0.6,
        zoneCoveredTimestamps: timestamps,
      });
      expect(res2.met).toBe(false);

      // 동시 덮기는 즉시 충족
      const cursorsSimultaneous = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(3)],
      ]);
      const resSimul = matchPosture(posture, cursorsSimultaneous, zones, {
        tier: 1,
        currentTime: 0.7,
        zoneCoveredTimestamps: timestamps,
      });
      expect(resSimul.met).toBe(true);
    });

    it('Tier 2: 0.2s 존 1 -> 0.6s 존 3 순차 이동 시 met: false (동시 덮기만 인정)', () => {
      const timestamps = new Map<number, number>();

      const cursors1 = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(1)],
      ]);
      matchPosture(posture, cursors1, zones, {
        tier: 2,
        currentTime: 0.2,
        zoneCoveredTimestamps: timestamps,
      });

      const cursors2 = new Map([
        ['leftHand', getZoneCenter(3)],
        ['rightHand', getZoneCenter(3)],
      ]);
      const res2 = matchPosture(posture, cursors2, zones, {
        tier: 2,
        currentTime: 0.6,
        zoneCoveredTimestamps: timestamps,
      });
      expect(res2.met).toBe(false);
    });
  });

  describe('Scenario 4: 조건 (A) 미충족(부위가 목표 존 밖) 시 누적 덮기와 무관하게 전체 미충족', () => {
    const posture: AnswerPosture = {
      choiceIndex: 0,
      parts: ['leftHand', 'rightHand'],
      zoneIds: [1, 3],
      binding: 'any',
      patternId: 'TEST_P4',
    };

    it('존 1이 0.2s에 덮였고 0.6s에 존 3이 덮였더라도, 한 손이 비목표 존(존 10)에 있으면 조건 (A) 위반으로 met: false', () => {
      const timestamps = new Map<number, number>();

      // t = 0.2s: 두 손 모두 존 1
      const cursors1 = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(1)],
      ]);
      matchPosture(posture, cursors1, zones, {
        tier: 3,
        currentTime: 0.2,
        zoneCoveredTimestamps: timestamps,
      });

      // t = 0.6s: 왼손은 존 3(목표 존), 오른손은 존 10(비목표 존)
      const cursors2 = new Map([
        ['leftHand', getZoneCenter(3)],
        ['rightHand', getZoneCenter(10)],
      ]);
      const res2 = matchPosture(posture, cursors2, zones, {
        tier: 3,
        currentTime: 0.6,
        zoneCoveredTimestamps: timestamps,
      });

      expect(res2.partStates[0].inside).toBe(true);
      expect(res2.partStates[1].inside).toBe(false); // 존 10은 목표 존(1, 3)이 아님
      expect(res2.met).toBe(false);
    });
  });

  describe('Scenario 5: binding: "ordered" 모드는 완화가 적용되지 않음', () => {
    const orderedPosture: AnswerPosture = {
      choiceIndex: 0,
      parts: ['leftHand', 'rightHand'],
      zoneIds: [1, 3],
      binding: 'ordered',
      patternId: 'TEST_P5',
    };

    it('ordered 바인딩은 Tier 3이라도 순차 덮기 완화가 적용되지 않고 동시 1:1 매칭만 인정된다', () => {
      const timestamps = new Map<number, number>();

      const cursors1 = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(1)],
      ]);
      matchPosture(orderedPosture, cursors1, zones, {
        tier: 3,
        currentTime: 0.2,
        zoneCoveredTimestamps: timestamps,
      });

      const cursors2 = new Map([
        ['leftHand', getZoneCenter(3)],
        ['rightHand', getZoneCenter(3)],
      ]);
      const res2 = matchPosture(orderedPosture, cursors2, zones, {
        tier: 3,
        currentTime: 0.6,
        zoneCoveredTimestamps: timestamps,
      });
      expect(res2.met).toBe(false);

      // 1:1 동시 충족
      const cursorsCorrect = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(3)],
      ]);
      const resSimul = matchPosture(orderedPosture, cursorsCorrect, zones, {
        tier: 3,
        currentTime: 0.7,
        zoneCoveredTimestamps: timestamps,
      });
      expect(resSimul.met).toBe(true);
    });
  });

  describe('Scenario 6: config 플래그 off 시 기존 동시 덮기 동작과 완전히 동일', () => {
    const posture: AnswerPosture = {
      choiceIndex: 0,
      parts: ['leftHand', 'rightHand'],
      zoneIds: [1, 3],
      binding: 'any',
      patternId: 'TEST_P6',
    };

    it('enableTemporalCoverage: false인 경우 Tier 3에서도 순차 덮기가 차단된다', () => {
      const timestamps = new Map<number, number>();
      const customConfig: TemporalCoverageConfig = {
        enableTemporalCoverage: false,
        tier3Window: 1.0,
        tier4Window: 1.2,
      };

      const cursors1 = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(1)],
      ]);
      matchPosture(posture, cursors1, zones, {
        tier: 3,
        currentTime: 0.2,
        zoneCoveredTimestamps: timestamps,
        temporalConfig: customConfig,
      });

      const cursors2 = new Map([
        ['leftHand', getZoneCenter(3)],
        ['rightHand', getZoneCenter(3)],
      ]);
      const res2 = matchPosture(posture, cursors2, zones, {
        tier: 3,
        currentTime: 0.6,
        zoneCoveredTimestamps: timestamps,
        temporalConfig: customConfig,
      });

      expect(res2.met).toBe(false);
    });
  });

  describe('Scenario 7: isComplexQuestion=true 시 Tier 2로 강등되어 완화 미적용', () => {
    it('AnswerSelector에서 문제 8(원래 Tier 3)이라도 isComplexQuestion=true이면 Tier 2로 설정되어 완화 미적용', () => {
      const selector = new AnswerSelector();
      selector.startQuestion(8, true);

      expect(selector.tierInfo.tier).toBe(2);
      expect(selector.dwellTime).toBe(0.8);
    });
  });

  describe('Scenario 8: isCrossBodyViolation 용도 명시 및 런타임 미적용 검증', () => {
    it('isCrossBodyViolation은 골반 하단(9~11)과 손 상단(1~3) 조합을 올바르게 감지한다', () => {
      expect(isCrossBodyViolation(1, 9)).toBe(true);
      expect(isCrossBodyViolation(2, 10)).toBe(true);
      expect(isCrossBodyViolation(3, 11)).toBe(true);
      expect(isCrossBodyViolation(4, 9)).toBe(false);
      expect(isCrossBodyViolation(1, 8)).toBe(false);
    });

    it('런타임 matchPosture는 isCrossBodyViolation 제약으로 유효한 자세를 임의로 차단하지 않는다 (생성/에디터 단계 전용)', () => {
      // 왼손 존 1, 골반 존 9 요구 자세
      const postureWithCrossBody: AnswerPosture = {
        choiceIndex: 0,
        parts: ['leftHand', 'hip'],
        zoneIds: [1, 9],
        binding: 'any',
        patternId: 'TEST_P8',
      };

      const cursors = new Map([
        ['leftHand', getZoneCenter(1)],
        ['hip', getZoneCenter(9)],
      ]);

      const result = matchPosture(postureWithCrossBody, cursors, zones);
      // 런타임 판정에서는 차단되지 않고 조건 A, B 충족 시 정상 통과
      expect(result.met).toBe(true);
    });
  });

  describe('Scenario 9: Tier 4 1.2s 누적 윈도우 검증', () => {
    const posture: AnswerPosture = {
      choiceIndex: 0,
      parts: ['leftHand', 'rightHand'],
      zoneIds: [1, 3],
      binding: 'any',
      patternId: 'TEST_P9',
    };

    it('Tier 4에서는 1.1s 경과(0.2s -> 1.3s) 시에도 윈도우 1.2s 이내이므로 met: true', () => {
      const timestamps = new Map<number, number>();

      const cursors1 = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(1)],
      ]);
      matchPosture(posture, cursors1, zones, {
        tier: 4,
        currentTime: 0.2,
        zoneCoveredTimestamps: timestamps,
      });

      const cursors2 = new Map([
        ['leftHand', getZoneCenter(3)],
        ['rightHand', getZoneCenter(3)],
      ]);
      const res2 = matchPosture(posture, cursors2, zones, {
        tier: 4,
        currentTime: 1.3, // 경과 1.1s <= tier4Window 1.2s
        zoneCoveredTimestamps: timestamps,
      });

      expect(res2.met).toBe(true);
    });

    it('Tier 4에서도 1.3s 경과(0.2s -> 1.5s) 시에는 윈도우 1.2s를 초과하여 만료(met: false)', () => {
      const timestamps = new Map<number, number>();

      const cursors1 = new Map([
        ['leftHand', getZoneCenter(1)],
        ['rightHand', getZoneCenter(1)],
      ]);
      matchPosture(posture, cursors1, zones, {
        tier: 4,
        currentTime: 0.2,
        zoneCoveredTimestamps: timestamps,
      });

      const cursors2 = new Map([
        ['leftHand', getZoneCenter(3)],
        ['rightHand', getZoneCenter(3)],
      ]);
      const res2 = matchPosture(posture, cursors2, zones, {
        tier: 4,
        currentTime: 1.5, // 경과 1.3s > tier4Window 1.2s
        zoneCoveredTimestamps: timestamps,
      });

      expect(res2.met).toBe(false);
    });
  });
});
