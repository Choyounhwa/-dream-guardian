/**
 * assault-tutorial.test.ts - 접근전 3단계 튜토리얼 컨트롤러 및 정적 패턴 TDD 단위 테스트
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §15.3-C8)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-45 / Issue #548)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TUTORIAL_PUNCH_PATTERN,
  TUTORIAL_SQUAT_PATTERN,
  TUTORIAL_SLOW_ROUND_PATTERN,
  TUTORIAL_PATTERNS,
  TUTORIAL_SLOW_ROUND_BPM,
  TUTORIAL_SLOW_ROUND_BPM_RANGE,
} from '../../src/data/assault/tutorialPatterns.js';
import {
  AssaultTutorialController,
} from '../../src/game/assault/AssaultTutorialController.js';
import { validateAssaultPlan } from '../../src/game/assault/AssaultPlanValidator.js';
import { compileAssaultPlan } from '../../src/game/assault/AssaultPlanCompiler.js';

describe('[BOSS-ASSAULT-45 / #548] 접근전 3단계 튜토리얼 시스템', () => {
  describe('1. 정적 튜토리얼 패턴 데이터 (tutorialPatterns.ts)', () => {
    it('1단계(펀치) 패턴은 8박 구조에 오직 answer_pair 조우만 포함한다', () => {
      expect(TUTORIAL_PUNCH_PATTERN.schemaVersion).toBe('1.0.0');
      expect(TUTORIAL_PUNCH_PATTERN.patternId).toBe('pattern_tutorial_step1_punch');
      expect(TUTORIAL_PUNCH_PATTERN.totalBeats).toBe(8);
      expect(TUTORIAL_PUNCH_PATTERN.encounters.length).toBeGreaterThanOrEqual(1);
      expect(TUTORIAL_PUNCH_PATTERN.encounters.every((e) => e.kind === 'answer_pair')).toBe(true);
      expect(TUTORIAL_PUNCH_PATTERN.balanceProfileId).toBe('assault_tutorial_zero_damage');
    });

    it('2단계(스쿼트/가드) 패턴은 8박 구조에 오직 squat 조우만 포함한다', () => {
      expect(TUTORIAL_SQUAT_PATTERN.schemaVersion).toBe('1.0.0');
      expect(TUTORIAL_SQUAT_PATTERN.patternId).toBe('pattern_tutorial_step2_squat');
      expect(TUTORIAL_SQUAT_PATTERN.totalBeats).toBe(8);
      expect(TUTORIAL_SQUAT_PATTERN.encounters.length).toBeGreaterThanOrEqual(1);
      expect(TUTORIAL_SQUAT_PATTERN.encounters.every((e) => e.kind === 'squat')).toBe(true);
      expect(TUTORIAL_SQUAT_PATTERN.balanceProfileId).toBe('assault_tutorial_zero_damage');
    });

    it('3단계(느린 실전 라운드) 패턴은 answer_pair와 squat가 교대된다', () => {
      expect(TUTORIAL_SLOW_ROUND_PATTERN.schemaVersion).toBe('1.0.0');
      expect(TUTORIAL_SLOW_ROUND_PATTERN.patternId).toBe('pattern_tutorial_step3_slow_round');
      expect(TUTORIAL_SLOW_ROUND_PATTERN.totalBeats).toBe(8);
      const kinds = TUTORIAL_SLOW_ROUND_PATTERN.encounters.map((e) => e.kind);
      expect(kinds).toContain('answer_pair');
      expect(kinds).toContain('squat');
    });

    it('느린 BPM 상수(60~75 BPM)가 정상 선언되어 있다', () => {
      expect(TUTORIAL_SLOW_ROUND_BPM).toBeGreaterThanOrEqual(60);
      expect(TUTORIAL_SLOW_ROUND_BPM).toBeLessThanOrEqual(75);
      expect(TUTORIAL_SLOW_ROUND_BPM_RANGE.min).toBe(60);
      expect(TUTORIAL_SLOW_ROUND_BPM_RANGE.max).toBe(75);
    });

    it('모든 튜토리얼 패턴은 deepFreeze되어 불변성이 보장된다', () => {
      expect(Object.isFrozen(TUTORIAL_PUNCH_PATTERN)).toBe(true);
      expect(Object.isFrozen(TUTORIAL_PUNCH_PATTERN.encounters)).toBe(true);
      expect(Object.isFrozen(TUTORIAL_SQUAT_PATTERN)).toBe(true);
      expect(Object.isFrozen(TUTORIAL_SLOW_ROUND_PATTERN)).toBe(true);
      expect(Object.isFrozen(TUTORIAL_PATTERNS)).toBe(true);
      expect(() => {
        (TUTORIAL_PUNCH_PATTERN as any).totalBeats = 16;
      }).toThrow();
    });

    it('모든 튜토리얼 패턴은 validateAssaultPlan 검증을 통과한다', () => {
      const punchValidation = validateAssaultPlan(TUTORIAL_PUNCH_PATTERN);
      expect(punchValidation.valid).toBe(true);

      const squatValidation = validateAssaultPlan(TUTORIAL_SQUAT_PATTERN);
      expect(squatValidation.valid).toBe(true);

      const slowRoundValidation = validateAssaultPlan(TUTORIAL_SLOW_ROUND_PATTERN);
      expect(slowRoundValidation.valid).toBe(true);
    });

    it('3단계 패턴은 60 BPM에서 compileAssaultPlan으로 성공적으로 컴파일된다', () => {
      const compiled = compileAssaultPlan(TUTORIAL_SLOW_ROUND_PATTERN, {
        bpm: TUTORIAL_SLOW_ROUND_BPM,
        seed: 'tutorial_test_seed',
      });
      expect(compiled.bpm).toBe(60);
      expect(compiled.totalDurationSeconds).toBe(8); // (8 beats * 60) / 60 = 8 seconds
      expect(compiled.encounters.length).toBe(2);
    });
  });

  describe('2. 튜토리얼 생명주기 및 컨트롤러 (AssaultTutorialController)', () => {
    let controller: AssaultTutorialController;

    beforeEach(() => {
      controller = new AssaultTutorialController();
    });

    it('초기 상태는 punch_practice(0/3)이며 가이드 메시지와 펀치 패턴을 제공한다', () => {
      const snapshot = controller.getSnapshot();
      expect(snapshot.currentStep).toBe('punch_practice');
      expect(snapshot.stepIndex).toBe(0);
      expect(snapshot.totalSteps).toBe(3);
      expect(snapshot.isCompleted).toBe(false);
      expect(snapshot.stepSuccess).toBe(false);
      expect(snapshot.progressRatio).toBe(0);
      expect(snapshot.guideMessage).toContain('펀치');
      expect(snapshot.activePattern).toBe(TUTORIAL_PUNCH_PATTERN);
      expect(Object.isFrozen(snapshot)).toBe(true);
    });

    it('1단계: 펀치 2회 성공 시 2단계(squat_practice)로 자동 전이한다', () => {
      // 1회 펀치
      const snap1 = controller.handlePunch({ side: 'left', hitSuccess: true });
      expect(snap1.currentStep).toBe('punch_practice');
      expect(snap1.stepProgress.punchesDone).toBe(1);
      expect(snap1.stepIndex).toBe(0);

      // 2회 펀치 -> 전이
      const snap2 = controller.handlePunch({ side: 'right', hitSuccess: true });
      expect(snap2.currentStep).toBe('squat_practice');
      expect(snap2.stepIndex).toBe(1);
      expect(snap2.activePattern).toBe(TUTORIAL_SQUAT_PATTERN);
      expect(snap2.guideMessage).toContain('스쿼트');
    });

    it('2단계: 스쿼트/가드 2회 성공 시 3단계(slow_round)로 자동 전이한다', () => {
      // 1단계 건너뛰기
      controller.skip();
      expect(controller.getSnapshot().currentStep).toBe('squat_practice');

      // 1회 스쿼트
      const snap1 = controller.handleSquat({ success: true, isGuarded: false });
      expect(snap1.currentStep).toBe('squat_practice');
      expect(snap1.stepProgress.squatsDone).toBe(1);

      // 2회 스쿼트/가드 -> 전이
      const snap2 = controller.handleSquat({ success: true, isGuarded: true });
      expect(snap2.currentStep).toBe('slow_round');
      expect(snap2.stepIndex).toBe(2);
      expect(snap2.activePattern).toBe(TUTORIAL_SLOW_ROUND_PATTERN);
      expect(snap2.guideMessage).toContain('느린');
    });

    it('3단계: 라운드 완료 이벤트 수신 시 completed로 자동 전이한다', () => {
      controller.skip(); // -> squat_practice
      controller.skip(); // -> slow_round
      expect(controller.getSnapshot().currentStep).toBe('slow_round');

      const finalSnap = controller.handleRoundEvent({ completed: true });
      expect(finalSnap.currentStep).toBe('completed');
      expect(finalSnap.stepIndex).toBe(3);
      expect(finalSnap.isCompleted).toBe(true);
      expect(finalSnap.stepSuccess).toBe(true);
      expect(finalSnap.progressRatio).toBe(1);
      expect(finalSnap.activePattern).toBeNull();
    });

    it('실패 이벤트(hitSuccess: false, success: false, completed: false)는 진행도를 올리지 않는다', () => {
      // 1단계 실패 펀치
      const s1 = controller.handlePunch({ hitSuccess: false });
      expect(s1.stepProgress.punchesDone).toBe(0);
      expect(s1.currentStep).toBe('punch_practice');

      // 2단계 이동 후 실패 스쿼트
      controller.skip();
      const s2 = controller.handleSquat({ success: false });
      expect(s2.stepProgress.squatsDone).toBe(0);
      expect(s2.currentStep).toBe('squat_practice');

      // 3단계 이동 후 실패/중단 라운드
      controller.skip();
      const s3 = controller.handleRoundEvent({ completed: false, aborted: true });
      expect(s3.isCompleted).toBe(false);
      expect(s3.currentStep).toBe('slow_round');
    });

    it('단계에 맞지 않는 핸들러 호출은 안전하게 무시된다', () => {
      // 1단계에서 handleSquat 호출 -> 무시
      const s1 = controller.handleSquat({ success: true });
      expect(s1.currentStep).toBe('punch_practice');
      expect(s1.stepProgress.squatsDone).toBe(0);

      // 1단계에서 handleRoundEvent 호출 -> 무시
      const s2 = controller.handleRoundEvent({ completed: true });
      expect(s2.currentStep).toBe('punch_practice');
    });

    it('skip() 호출 시 순차적으로 단계가 건너뛰어지며 최종적으로 completed가 된다', () => {
      expect(controller.getSnapshot().currentStep).toBe('punch_practice');
      expect(controller.skip().currentStep).toBe('squat_practice');
      expect(controller.skip().currentStep).toBe('slow_round');
      const snapCompleted = controller.skip();
      expect(snapCompleted.currentStep).toBe('completed');
      expect(snapCompleted.isCompleted).toBe(true);

      // completed 이후 추가 skip 호출해도 completed 유지
      expect(controller.skip().currentStep).toBe('completed');
    });

    it('restart() 호출 시 1단계(punch_practice) 및 초기 상태로 완전히 리셋된다', () => {
      controller.skip();
      controller.skip();
      controller.skip();
      expect(controller.getSnapshot().isCompleted).toBe(true);

      const resetSnap = controller.restart();
      expect(resetSnap.currentStep).toBe('punch_practice');
      expect(resetSnap.stepIndex).toBe(0);
      expect(resetSnap.isCompleted).toBe(false);
      expect(resetSnap.stepProgress.punchesDone).toBe(0);
      expect(resetSnap.stepProgress.squatsDone).toBe(0);
      expect(resetSnap.stepProgress.roundCompleted).toBe(false);
      expect(resetSnap.progressRatio).toBe(0);
    });

    it('자원 오염 검증: localStorage 접근 0회 및 legacy 키 수정 없음', () => {
      const mockStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      vi.stubGlobal('localStorage', mockStorage);

      const ctrl = new AssaultTutorialController();
      ctrl.handlePunch();
      ctrl.handlePunch();
      ctrl.handleSquat();
      ctrl.handleSquat();
      ctrl.handleRoundEvent({ completed: true });
      ctrl.skip();
      ctrl.restart();

      expect(mockStorage.getItem).not.toHaveBeenCalled();
      expect(mockStorage.setItem).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });
});
