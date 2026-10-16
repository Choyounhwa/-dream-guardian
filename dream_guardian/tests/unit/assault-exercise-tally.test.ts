/**
 * assault-exercise-tally.test.ts - 보스 접근전(Boss Assault) 실측 운동량 집계 단위 테스트
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§11.2, 15.3-C5, A31)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-43 / Issue #546)
 */

import { describe, it, expect } from 'vitest';
import {
  AssaultExerciseTally,
  deepFreeze,
  type AssaultExerciseSummary,
  type AssaultPunchRecord,
  type AssaultSquatRecord,
  type AssaultAlternativeRecord,
} from '../../src/game/assault/AssaultExerciseTally.js';

describe('AssaultExerciseTally (BOSS-ASSAULT-43 / #546)', () => {
  // ─── 1. 기본 초기화 및 초기 스냅샷 검증 ───
  describe('1. 초기 상태 및 기본값', () => {
    it('초기 생성 시 모든 운동량 수치가 0이고 빈 목록이어야 한다', () => {
      const tally = new AssaultExerciseTally();
      const summary: AssaultExerciseSummary = tally.getSummary();

      expect(summary.leftPunchCount).toBe(0);
      expect(summary.rightPunchCount).toBe(0);
      expect(summary.totalPunchCount).toBe(0);
      expect(summary.squatCount).toBe(0);
      expect(summary.guardCount).toBe(0);
      expect(summary.alternativeCount).toBe(0);
      expect(summary.activeDurationSeconds).toBe(0);
      expect(summary.processedInputIds).toEqual([]);
    });

    it('DEC-C5 규약: 미승인 펀치 칼로리는 임의의 0이 아닌 미지원(unsupported) 상태로 명시해야 한다', () => {
      const tally = new AssaultExerciseTally();
      const summary = tally.getSummary();

      expect(summary.kcalSupported).toBe(false);
      expect(summary.estimatedKcal).toBeNull();
      expect(summary.kcalDetails).toBeDefined();
      expect(summary.kcalDetails.supported).toBe(false);
      expect(summary.kcalDetails.reason).toContain('DEC-C5');
    });

    it('반환된 요약 DTO는 deepFreeze된 불변 객체여야 한다', () => {
      const tally = new AssaultExerciseTally();
      const summary = tally.getSummary();

      expect(Object.isFrozen(summary)).toBe(true);
      expect(Object.isFrozen(summary.processedInputIds)).toBe(true);
      expect(Object.isFrozen(summary.kcalDetails)).toBe(true);

      expect(() => {
        // @ts-expect-error - runtime immutability test
        summary.leftPunchCount = 99;
      }).toThrow();
    });
  });

  // ─── 2. 펀치 실측 집계 (#511) ───
  describe('2. 펀치(#511) 실측 집계 및 좌/우 분리', () => {
    it('왼손 펀치와 오른손 펀치가 분리되어 집계되고 총합이 일치해야 한다', () => {
      const tally = new AssaultExerciseTally();

      const punch: AssaultPunchRecord = { inputId: 'punch-L-1', hand: 'left' };
      const res1 = tally.recordPunch(punch);
      const res2 = tally.recordPunch({ inputId: 'punch-R-1', hand: 'right' });
      const res3 = tally.recordPunch({ inputId: 'punch-L-2', hand: 'left' });

      expect(res1).toBe(true);
      expect(res2).toBe(true);
      expect(res3).toBe(true);

      const summary = tally.getSummary();
      expect(summary.leftPunchCount).toBe(2);
      expect(summary.rightPunchCount).toBe(1);
      expect(summary.totalPunchCount).toBe(3);
    });

    it('동일한 inputId를 가진 펀치 입력은 중복 집계되지 않아야 한다 (멱등성)', () => {
      const tally = new AssaultExerciseTally();

      const first = tally.recordPunch({ inputId: 'punch-duplicate-01', hand: 'left' });
      const second = tally.recordPunch({ inputId: 'punch-duplicate-01', hand: 'left' });
      const third = tally.recordPunch({ inputId: 'punch-duplicate-01', hand: 'right' });

      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(third).toBe(false);

      const summary = tally.getSummary();
      expect(summary.leftPunchCount).toBe(1);
      expect(summary.rightPunchCount).toBe(0);
      expect(summary.totalPunchCount).toBe(1);
      expect(summary.processedInputIds).toContain('punch-duplicate-01');
      expect(summary.processedInputIds.length).toBe(1);
    });

    it('유효하지 않은 손 방향 또는 유효하지 않은 펀치는 무시되어야 한다', () => {
      const tally = new AssaultExerciseTally();

      // @ts-expect-error - invalid hand
      const invalidHand = tally.recordPunch({ inputId: 'punch-bad-1', hand: 'center' });
      const invalidFlag = tally.recordPunch({ inputId: 'punch-bad-2', hand: 'left', isValid: false });

      expect(invalidHand).toBe(false);
      expect(invalidFlag).toBe(false);

      const summary = tally.getSummary();
      expect(summary.totalPunchCount).toBe(0);
    });
  });

  // ─── 3. 스쿼트 실측 집계 (#512) ───
  describe('3. 스쿼트(#512) 실측 집계', () => {
    it('유효한 스쿼트 이벤트가 정상 누적되어야 한다', () => {
      const tally = new AssaultExerciseTally();

      const squat: AssaultSquatRecord = { inputId: 'squat-gen-1' };
      const s1 = tally.recordSquat(squat);
      const s2 = tally.recordSquat({ inputId: 'squat-gen-2', isValid: true, isDucking: true });

      expect(s1).toBe(true);
      expect(s2).toBe(true);

      const summary = tally.getSummary();
      expect(summary.squatCount).toBe(2);
    });

    it('동일한 inputId를 가진 스쿼트는 중복 집계되지 않아야 한다', () => {
      const tally = new AssaultExerciseTally();

      expect(tally.recordSquat({ inputId: 'squat-dup' })).toBe(true);
      expect(tally.recordSquat({ inputId: 'squat-dup' })).toBe(false);

      expect(tally.getSummary().squatCount).toBe(1);
    });

    it('isValid: false인 무효 스쿼트는 카운트되지 않아야 한다', () => {
      const tally = new AssaultExerciseTally();

      const invalidSquat = tally.recordSquat({
        inputId: 'squat-invalid-01',
        isValid: false,
        invalidReason: 'low_confidence',
      });

      expect(invalidSquat).toBe(false);
      expect(tally.getSummary().squatCount).toBe(0);
    });
  });

  // ─── 4. 저충격 대체 동작 집계 (#547 / DEC-C6 / A31) ───
  describe('4. 저충격 대체 동작(#547) 집계 및 스쿼트와의 명확한 분리', () => {
    it('양팔 가드 등 대체 동작은 guardCount 및 alternativeCount로 집계되어야 한다', () => {
      const tally = new AssaultExerciseTally();

      const guard: AssaultAlternativeRecord = { inputId: 'guard-01', kind: 'dual_arm_guard' };
      const g1 = tally.recordGuard(guard);
      const g2 = tally.recordAlternative({ inputId: 'guard-02', kind: 'dual_arm_guard' });

      expect(g1).toBe(true);
      expect(g2).toBe(true);

      const summary = tally.getSummary();
      expect(summary.guardCount).toBe(2);
      expect(summary.alternativeCount).toBe(2);
      // 스쿼트와 혼합되지 않아야 함 (A31 준수)
      expect(summary.squatCount).toBe(0);
    });

    it('동일한 inputId의 대체 동작은 중복 집계되지 않아야 한다', () => {
      const tally = new AssaultExerciseTally();

      expect(tally.recordGuard({ inputId: 'guard-dup' })).toBe(true);
      expect(tally.recordGuard({ inputId: 'guard-dup' })).toBe(false);

      expect(tally.getSummary().guardCount).toBe(1);
    });
  });

  // ─── 5. 다른 운동 종류 간 inputId 중복 차단 ───
  describe('5. 이종 운동 간 inputId 고유성 보장', () => {
    it('이미 펀치로 처리된 inputId로 스쿼트나 가드가 들어와도 중복으로 집계되지 않아야 한다', () => {
      const tally = new AssaultExerciseTally();

      expect(tally.recordPunch({ inputId: 'shared-id-1', hand: 'left' })).toBe(true);
      expect(tally.recordSquat({ inputId: 'shared-id-1' })).toBe(false);
      expect(tally.recordGuard({ inputId: 'shared-id-1' })).toBe(false);

      const summary = tally.getSummary();
      expect(summary.leftPunchCount).toBe(1);
      expect(summary.squatCount).toBe(0);
      expect(summary.guardCount).toBe(0);
    });
  });

  // ─── 6. 활성 시간축(#510) 누적 및 Wall time 배제 ───
  describe('6. #510 활성 시각축만 반영 (Wall time 금지)', () => {
    it('활성 시간은 명시적으로 전달된 활성 초만 누적되어야 한다', () => {
      const tally = new AssaultExerciseTally();

      tally.addActiveDuration(1.5);
      tally.addActiveDuration(2.25);

      expect(tally.getSummary().activeDurationSeconds).toBeCloseTo(3.75, 5);
    });

    it('setActiveDuration을 통해 절대 활성 시간을 동기화할 수 있어야 한다', () => {
      const tally = new AssaultExerciseTally();

      tally.setActiveDuration(12.5);
      expect(tally.getSummary().activeDurationSeconds).toBe(12.5);

      // 음수는 0으로 클램핑
      tally.setActiveDuration(-5);
      expect(tally.getSummary().activeDurationSeconds).toBe(0);
    });

    it('음수 델타 시간은 가산되지 않아야 한다', () => {
      const tally = new AssaultExerciseTally();

      tally.addActiveDuration(10);
      tally.addActiveDuration(-4);

      expect(tally.getSummary().activeDurationSeconds).toBe(10);
    });

    it('AssaultClockAdapter 호환 객체로부터 활성 시간을 직접 동기화할 수 있어야 한다', () => {
      const tally = new AssaultExerciseTally();
      const mockClock = { activeSeconds: 24.8 };

      tally.syncWithClock(mockClock);
      expect(tally.getSummary().activeDurationSeconds).toBe(24.8);
    });
  });

  // ─── 7. 칼로리(DEC-C5) 부분 계산 및 정직한 미지원 보고 ───
  describe('7. 칼로리(kcal) 상태 처리 (DEC-C5)', () => {
    it('스쿼트 등 기존 승인 공식(0.35 kcal/회)이 있는 항목은 부분 계산 정보를 제공해야 한다', () => {
      const tally = new AssaultExerciseTally();

      tally.recordSquat({ inputId: 'sq-1' });
      tally.recordSquat({ inputId: 'sq-2' });
      tally.recordSquat({ inputId: 'sq-3' }); // 3회 * 0.35 = 1.05

      const summary = tally.getSummary();
      expect(summary.kcalSupported).toBe(false); // 펀치 계수 미승인으로 전체 kcal은 미지원
      expect(summary.estimatedKcal).toBeNull();
      expect(summary.partialSquatKcal).toBeCloseTo(1.05, 3);
      expect(summary.kcalDetails.partialSquatKcal).toBeCloseTo(1.05, 3);
    });
  });

  // ─── 8. 결과 화면 및 레거시 패치 호환 ───
  describe('8. 결과 화면 호환 (toLegacyResultPatch)', () => {
    it('기존 하드코딩 상수(squats: 0, elapsedTime: 60)를 대체하는 실측 패치 객체를 생성해야 한다', () => {
      const tally = new AssaultExerciseTally();

      tally.recordPunch({ inputId: 'p-L', hand: 'left' });
      tally.recordPunch({ inputId: 'p-R', hand: 'right' });
      tally.recordSquat({ inputId: 'sq-1' });
      tally.recordSquat({ inputId: 'sq-2' });
      tally.recordGuard({ inputId: 'gd-1' });
      tally.setActiveDuration(42.5);

      const patch = tally.toLegacyResultPatch();

      expect(patch.squats).toBe(2);
      expect(patch.elapsedTime).toBe(42.5);
      expect(patch.totalPunches).toBe(2);
      expect(patch.leftPunches).toBe(1);
      expect(patch.rightPunches).toBe(1);
      expect(patch.guards).toBe(1);
      expect(patch.calories).toBeNull(); // 임의의 0이 아닌 null
    });
  });

  // ─── 9. 불변 스냅샷 무결성 ───
  describe('9. 불변 스냅샷 무결성 및 연속 동작', () => {
    it('요약을 발행한 후 추가 운동이 기록되어도 이미 발행된 이전 요약은 불변이어야 한다', () => {
      const tally = new AssaultExerciseTally();

      tally.recordPunch({ inputId: 'p-1', hand: 'left' });
      const snap1 = tally.getSummary();

      expect(snap1.leftPunchCount).toBe(1);
      expect(snap1.totalPunchCount).toBe(1);

      // 이후 추가 기록
      tally.recordPunch({ inputId: 'p-2', hand: 'right' });
      tally.recordSquat({ inputId: 's-1' });
      tally.addActiveDuration(5);

      const snap2 = tally.getSummary();

      // snap1은 여전히 1 유지
      expect(snap1.leftPunchCount).toBe(1);
      expect(snap1.totalPunchCount).toBe(1);
      expect(snap1.squatCount).toBe(0);
      expect(snap1.activeDurationSeconds).toBe(0);

      // snap2는 최신 값 반영
      expect(snap2.leftPunchCount).toBe(1);
      expect(snap2.rightPunchCount).toBe(1);
      expect(snap2.totalPunchCount).toBe(2);
      expect(snap2.squatCount).toBe(1);
      expect(snap2.activeDurationSeconds).toBe(5);
    });
  });

  // ─── 10. 순수 도메인 제약 (부작용 0건) ───
  describe('10. 순수 도메인 제약', () => {
    it('deepFreeze 함수는 중첩 객체와 배열을 완전히 동결해야 한다', () => {
      const target = {
        nested: { count: 10 },
        list: [1, 2, 3],
      };

      const frozen = deepFreeze(target);
      expect(Object.isFrozen(frozen)).toBe(true);
      expect(Object.isFrozen(frozen.nested)).toBe(true);
      expect(Object.isFrozen(frozen.list)).toBe(true);
    });
  });
});
