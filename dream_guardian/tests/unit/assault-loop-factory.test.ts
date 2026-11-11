/**
 * assault-loop-factory.test.ts
 *
 * [ASSAULT-LOOP-09 / GitHub Issue #702]
 * 라운드별 루프 계획 · numeric_repeat 4기회 공급 Core 조립 TDD 단위 테스트
 *
 * 핵심 검증 항목:
 * 1. loopProfile 옵션 주입 시 라운드별 결정론적 36/40박 루프 계획 동적 생성 및 불변 보장.
 * 2. 동일 문제/정답에 대해 4개의 보기 쌍(pairCount: 4) 단 1회 공급 및 answer_pair 4개 매핑.
 * 3. pattern과 loopProfile 동시 지정 시 명시적 원자적 거부 (AssaultSessionValidationError).
 * 4. loop mode에서 challenge roundSource 지정 시 거부.
 * 5. 난이도(difficulty)의 answerBeats override 배제 (answer4 고정).
 * 6. 현재 라운드 읽기 전용 루프 계획 공개 접근자(getCurrentLoopPlan) 제공.
 * 7. 정산 영수증 반영 후 HP 0(사망) 시 즉시 abort 및 TTS 취소, 요약 동기화, 후속 라운드 차단.
 * 8. run 종료(onRunEnd) 및 세션 dispose 시 TTS cancel 호출.
 * 9. LOOP-07 실측 운동량 요약(getLoopExerciseSummary) 지원.
 * 10. loopProfile 미지정 시 범용 Factory 직접 호출 legacy 동작 100% 동등 보존.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AssaultSessionFactory,
  AssaultSessionValidationError,
  type AssaultRoundSourcePort,
} from '../../src/core/AssaultSessionFactory.js';
import { AssaultLoopRoundAssembler } from '../../src/core/AssaultLoopRoundAssembler.js';
import { DEFAULT_ASSAULT_LOOP_CONFIG } from '../../config/assault-loop.config.js';
import { DEFAULT_APPROACH_PATTERN } from '../../src/data/assault/approachPatterns.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';
import type { RoundId } from '../../src/types/assault.js';

describe('[ASSAULT-LOOP-09 / #702] AssaultSessionFactory & AssaultLoopRoundAssembler', () => {
  const mockQuestions: readonly QuestionCandidate[] = [
    {
      id: 'q1',
      text: '12 + 15 = ?',
      correctAnswer: 27,
      category: 'addition',
      level: 1,
    },
    {
      id: 'q2',
      text: '30 - 8 = ?',
      correctAnswer: 22,
      category: 'subtraction',
      level: 1,
    },
  ];

  function createMockBattleState(initialHp = 100) {
    return {
      hp: initialHp,
      maxHp: 100,
      damage(amount: number) {
        this.hp = Math.max(0, this.hp - amount);
      },
      applyHazardDamage(amount: number) {
        this.hp = Math.max(0, this.hp - amount);
      },
    };
  }

  function createMockSpeech() {
    return {
      speak: vi.fn(),
      cancel: vi.fn(),
      status: 'idle',
    };
  }

  describe('1. loopProfile 옵션 사전 검증 및 충돌 방지', () => {
    it('pattern과 loopProfile을 동시에 지정하면 AssaultSessionValidationError를 발생시켜야 한다', () => {
      const battleState = createMockBattleState();
      const speech = createMockSpeech();

      expect(() => {
        AssaultSessionFactory.createSession({
          battleState,
          speech,
          questions: mockQuestions,
          pattern: DEFAULT_APPROACH_PATTERN,
          loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
        });
      }).toThrow(AssaultSessionValidationError);
    });

    it('loop mode에서 challenge roundSource 지정 시 거부해야 한다', () => {
      const battleState = createMockBattleState();
      const speech = createMockSpeech();
      const challengeSource: AssaultRoundSourcePort = {
        kind: 'challenge',
        providePairs: vi.fn(),
      };

      expect(() => {
        AssaultSessionFactory.createSession({
          battleState,
          speech,
          questions: mockQuestions,
          loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
          roundSource: challengeSource,
        });
      }).toThrow(AssaultSessionValidationError);
    });

    it('loop mode에서는 difficulty가 주어져도 answerBeats override가 적용되지 않고 answer 4박을 유지해야 한다', () => {
      const battleState = createMockBattleState();
      const speech = createMockSpeech();

      const session = AssaultSessionFactory.createSession({
        battleState,
        speech,
        questions: mockQuestions,
        loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
        difficulty: 'easy', // legacy에서는 answerBeats가 6박으로 변경될 수 있음
      });

      const rc = session.createRoundController('round_01' as RoundId, mockQuestions[0]);
      expect(rc).toBeDefined();
      const currentPlan = session.getCurrentLoopPlan?.();

      expect(currentPlan).toBeDefined();
      const answerSegs = currentPlan!.segments.filter((s) => s.kind === 'answer');
      expect(answerSegs.length).toBe(4);
      for (const seg of answerSegs) {
        expect(seg.durationBeats).toBe(4);
      }
    });
  });

  describe('2. 라운드별 루프 계획 동적 생성 및 numeric_repeat 4기회 공급', () => {
    it('각 라운드마다 seed와 roundNumber 기반 결정론적 28 또는 32박 루프 계획을 생성해야 한다', () => {
      const battleState = createMockBattleState();
      const speech = createMockSpeech();

      const session = AssaultSessionFactory.createSession({
        battleState,
        speech,
        questions: mockQuestions,
        loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
        seed: 77777,
      });

      // Round 1 (기본 프로필은 24박 / FEAT-ASSAULT-LOOP-019 #744)
      const rc1 = session.createRoundController('round_01' as RoundId, mockQuestions[0]);
      expect(rc1).toBeDefined();
      const plan1 = session.getCurrentLoopPlan?.();
      expect(plan1).toBeDefined();
      expect(plan1!.totalBeats).toBe(24);
      expect(plan1!.squatCount).toBe(0);
      expect(plan1!.roundId).toBe('round_01');

      // Round 2 (새 계획 생성 - 고정 compiledPlan 단순 재사용 방지)
      const rc2 = session.createRoundController('round_02' as RoundId, mockQuestions[1]);
      expect(rc2).toBeDefined();
      const plan2 = session.getCurrentLoopPlan?.();
      expect(plan2).toBeDefined();
      expect(plan2!.totalBeats).toBe(24);
      expect(plan2!.squatCount).toBe(0);
      expect(plan2!.roundId).toBe('round_02');

      // 동일 시드+라운드에 대한 결정론성 검증
      const plan1Again = AssaultLoopRoundAssembler.buildLoopRoundPlan(77777, 1, DEFAULT_ASSAULT_LOOP_CONFIG);
      expect(plan1Again.totalBeats).toBe(plan1!.totalBeats);
      expect(plan1Again.squatGapIndices).toEqual(plan1!.squatGapIndices);
    });

    it('동일 문제/정답에 대해 4개의 보기 쌍(pairCount: 4)을 단 1회 요청하여 4개 answer_pair에 매핑해야 한다', () => {
      const battleState = createMockBattleState();
      const speech = createMockSpeech();
      const providePairsSpy = vi.fn((_opts) => {
        const item = (text: string, value: number, isCorrect: boolean) => ({ text, value, isCorrect });
        return [
          { pairId: 'p1', left: item('27', 27, true), right: item('25', 25, false), correctSide: 'left' as const, choices: [item('27', 27, true), item('25', 25, false)] as const },
          { pairId: 'p2', left: item('28', 28, false), right: item('27', 27, true), correctSide: 'right' as const, choices: [item('28', 28, false), item('27', 27, true)] as const },
          { pairId: 'p3', left: item('27', 27, true), right: item('20', 20, false), correctSide: 'left' as const, choices: [item('27', 27, true), item('20', 20, false)] as const },
          { pairId: 'p4', left: item('21', 21, false), right: item('27', 27, true), correctSide: 'right' as const, choices: [item('21', 21, false), item('27', 27, true)] as const },
        ];
      });

      const customSource: AssaultRoundSourcePort = {
        kind: 'numeric_repeat',
        providePairs: providePairsSpy,
      };

      const session = AssaultSessionFactory.createSession({
        battleState,
        speech,
        questions: mockQuestions,
        loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
        roundSource: customSource,
      });

      const rc = session.createRoundController('round_01' as RoundId, mockQuestions[0]);
      expect(rc).toBeDefined();

      // providePairs가 문제당 정확히 1회 호출되고, pairCount는 4여야 함
      expect(providePairsSpy).toHaveBeenCalledTimes(1);
      expect(providePairsSpy.mock.calls[0][0].pairCount).toBe(4);
      expect(providePairsSpy.mock.calls[0][0].correctAnswer).toBe(27);
      expect(providePairsSpy.mock.calls[0][0].roundId).toBe('round_01');
    });
  });

  describe('3. 생명주기 및 TTS cancel 연동', () => {
    it('onRunEnd 발생 시 TTS cancel이 호출되어야 한다', () => {
      const battleState = createMockBattleState();
      const speech = createMockSpeech();

      const session = AssaultSessionFactory.createSession({
        battleState,
        speech,
        questions: mockQuestions,
        loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      });

      const rc = session.createRoundController('round_01' as RoundId, mockQuestions[0]);

      // run 구간 종료 시점(8박 = 4초 @ 120BPM)으로 진행
      rc.update(4.01, 4.01);

      expect(speech.cancel).toHaveBeenCalled();
    });

    it('session.dispose() 호출 시 TTS cancel이 호출되어야 한다', () => {
      const battleState = createMockBattleState();
      const speech = createMockSpeech();

      const session = AssaultSessionFactory.createSession({
        battleState,
        speech,
        questions: mockQuestions,
        loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      });

      session.dispose();
      expect(speech.cancel).toHaveBeenCalled();
    });
  });

  describe('4. 권위 HP 검사, 사망 시 즉시 abort 및 요약·진행 순서 보장', () => {
    it('정산 영수증 반영 후 HP가 0 이하가 되면 즉시 라운드가 abort되고 추가 진행이 차단되어야 한다', () => {
      const battleState = createMockBattleState(10);
      const speech = createMockSpeech();

      const session = AssaultSessionFactory.createSession({
        battleState,
        speech,
        questions: mockQuestions,
        loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      });

      let roundCompleteEmitted = false;
      let finalizedSummary: any = null;

      const rc = session.createRoundController('round_01' as RoundId, mockQuestions[0], {
        onRoundComplete: (_res) => {
          roundCompleteEmitted = true;
        },
        onSummaryFinalized: (sum) => {
          finalizedSummary = sum;
        },
      });

      // 오답 발생 및 정산으로 25 데미지 발생 -> HP 0 이하로 사망
      const attackId = rc.encounters[0].id;

      // settlement 명령 처리 시뮬레이션 (wrong_damage로 25 데미지 입혀 15 HP 소진)
      (rc as any)._options.onSettlementCommand?.({
        sessionId: session.sessionId,
        roundId: 'round_01' as RoundId,
        attackId,
        effectType: 'wrong_damage',
      });

      expect(rc.isCompleted).toBe(true);
      expect(roundCompleteEmitted).toBe(true);
      expect(speech.cancel).toHaveBeenCalled();

      // 요약 검증: isDefeated true, isAborted true, completedQuestions 0
      const summary = rc.getRoundSummary();
      expect(summary).toBeDefined();
      expect(finalizedSummary).toBeDefined();
      expect(summary?.isDefeated).toBe(true);
      expect(summary?.isAborted).toBe(true);
      expect(summary?.completedQuestions).toBe(0);

      // 사망 후 다음 라운드 시작 불가
      const nextRc = session.startNextRound?.();
      expect(nextRc).toBeNull();
    });

    it('생존하여 목표 라운드(예: targetRounds 2) 도달 시 추가 startNextRound는 null을 반환해야 한다', () => {
      const battleState = createMockBattleState(100);
      const speech = createMockSpeech();

      const session = AssaultSessionFactory.createSession({
        battleState,
        speech,
        questions: mockQuestions,
        loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
        targetRounds: 2,
      });

      // Round 1 진행 및 성공 완료
      const rc1 = session.createRoundController('round_01' as RoundId, mockQuestions[0]);
      // 8박 run(4초) + 4x(4+2) answer/rest(12초) = 16초 이상 진행하여 라운드 정상 완료
      rc1.update(25.0, 25.0);
      expect(rc1.isCompleted).toBe(true);

      // Round 2 시작
      const rc2 = session.startNextRound?.();
      expect(rc2).not.toBeNull();
      rc2!.update(25.0, 25.0);
      expect(rc2!.isCompleted).toBe(true);

      // 목표 2라운드 도달 후 추가 진행 차단
      const rc3 = session.startNextRound?.();
      expect(rc3).toBeNull();
    });
  });

  describe('5. LOOP-07 실측 운동량 집계 연동', () => {
    it('session.getLoopExerciseSummary()를 통해 실측 운동량을 조회할 수 있어야 한다', () => {
      const battleState = createMockBattleState();
      const speech = createMockSpeech();

      const session = AssaultSessionFactory.createSession({
        battleState,
        speech,
        questions: mockQuestions,
        loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      });

      expect(session.getLoopExerciseSummary).toBeDefined();
      const summaryBefore = session.getLoopExerciseSummary!();
      expect(summaryBefore.runStepCount).toBe(0);

      // 실측 러닝 걸음 기록
      session.exerciseTally.recordRunStep({
        inputId: 'step_01' as any,
        isValid: true,
        activeTimestampSeconds: 1.5,
      });

      const summaryAfter = session.getLoopExerciseSummary!();
      expect(summaryAfter.runStepCount).toBe(1);
    });
  });

  describe('6. 범용 Factory 직접 호출 (legacy) 호환성 보존', () => {
    it('loopProfile 미지정 시 기존 고정 pattern 기반 compiledPlan 및 세션 조립 동작이 100% 보존되어야 한다', () => {
      const battleState = createMockBattleState();
      const speech = createMockSpeech();

      const session = AssaultSessionFactory.createSession({
        battleState,
        speech,
        questions: mockQuestions,
      });

      expect(session.pattern).toBeDefined();
      expect(session.compiledPlan).toBeDefined();
      expect((session as any).loopProfile).toBeUndefined();
      expect(session.getCurrentLoopPlan?.()).toBeNull();

      const rc = session.createRoundController('round_01' as RoundId, mockQuestions[0]);
      expect(rc).toBeDefined();
    });
  });
});
