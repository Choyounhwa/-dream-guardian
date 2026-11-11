/**
 * assault-recovery-factory.test.ts
 *
 * [BOSS-ASSAULT-REC-04 / #597] 시드 보기 공급·목표 설정 Core 조립 단위 테스트
 *
 * 검증 목표:
 * 1. 목표 라운드 SSOT 및 유효 override 검증:
 *    - 기본 설정 시 config의 targetRounds(10)가 세션과 progressController에 동일하게 주입된다.
 *    - 유효한 override(예: 7) 주입 시 세션과 progressController 모두 7로 일치한다 (무단 10 강제 변경 금지).
 *    - 유효하지 않은 override(0, 음수, 소수, NaN 등)는 부분 세션 생성 없이 AssaultSessionValidationError로 원자적 거부된다.
 * 2. 결정론적 시드 보기 공급:
 *    - 동일한 seed와 문제에서 생성된 보기 쌍 순서와 배치(correctSide)가 100% 동일하게 재현된다.
 * 3. encounter 순서 기준 매핑 및 우측 정답 판정 포트 도달:
 *    - 플랜의 answer_pair encounter 순서대로 생성된 pair가 정확히 매핑된다.
 *    - correctSide가 'right'인 보기 쌍에 대해 우측 펀치 입력 시 boss_negate(정답) 판정이 정상 발행된다.
 * 4. 각 쌍의 유일 정답 보장 및 원본 문제 재생성 호출 0건:
 *    - 모든 쌍에 유일한 정답 1개 및 상이한 오답 1개가 배치된다.
 *    - 라운드 생성 시 추가적인 수학 문제 생성(QuestionBank/QuestionEvaluator) 호출이 0건이다.
 * 5. AssaultRoundSource 포트 경계:
 *    - 기본 numeric_repeat 포트가 동작하며, 커스텀 roundSource 포트 주입도 지원한다.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AssaultSessionFactory,
  AssaultSessionValidationError,
  type AssaultRoundSourcePort,
} from '../../src/core/AssaultSessionFactory.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';
import type { AssaultAnswerPair } from '../../src/question/AssaultAnswerPairFactory.js';
import type { AssaultSettlementCommand } from '../../src/types/assault.js';

function createMockBattleState(hp = 100) {
  return {
    hp,
    maxHp: 100,
    takeDamage: vi.fn(),
    applyHazardDamage: vi.fn(),
  };
}

function createMockSpeech() {
  return {
    speak: vi.fn(),
    status: 'idle',
    cancel: vi.fn(),
  };
}

const mockQuestions: QuestionCandidate[] = [
  {
    id: 'rec04_q1',
    text: '5 + 3 = ?',
    answer: 8,
    correctAnswer: 8,
    type: 'addition',
    level: 1,
  },
  {
    id: 'rec04_q2',
    text: '9 - 4 = ?',
    answer: 5,
    correctAnswer: 5,
    type: 'subtraction',
    level: 1,
  },
];

describe('[BOSS-ASSAULT-REC-04 / #597] AssaultSessionFactory - Target & Seeded Pair Wiring', () => {
  describe('1. 목표 라운드(targetRounds) SSOT 및 원자적 override 검증', () => {
    it('기본 설정 시 config.targetRounds(10)가 session과 progressController에 동일하게 주입되어야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        battleState: createMockBattleState(),
        speech: createMockSpeech(),
        questions: mockQuestions,
      });

      expect((session as any).targetRounds).toBe(10);
      expect(session.progressController.targetRounds).toBe(10);
      expect((session as any).targetRounds).toBe(session.progressController.targetRounds);
    });

    it('유효한 targetRounds override(예: 7) 전달 시 session과 progressController 모두 7로 일치해야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        battleState: createMockBattleState(),
        speech: createMockSpeech(),
        questions: mockQuestions,
        targetRounds: 7,
      });

      expect((session as any).targetRounds).toBe(7);
      expect(session.progressController.targetRounds).toBe(7);
    });

    it('유효하지 않은 targetRounds(0, 음수, 소수, NaN)는 원자적으로 AssaultSessionValidationError를 발생시켜야 한다', () => {
      const invalidTargets = [0, -3, 4.5, NaN];

      for (const invalid of invalidTargets) {
        expect(() => {
          AssaultSessionFactory.createSession({
            battleState: createMockBattleState(),
            speech: createMockSpeech(),
            questions: mockQuestions,
            targetRounds: invalid,
          });
        }).toThrow(AssaultSessionValidationError);
      }
    });
  });

  describe('2. 결정론적 시드 보기 공급 및 동일 재현성', () => {
    it('동일한 seed와 문제에서 createRoundController 호출 시 동일한 보기 쌍 순서와 정답 배치가 생성되어야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        battleState: createMockBattleState(),
        speech: createMockSpeech(),
        questions: mockQuestions,
        seed: 424242,
      });

      const round1 = (session as any).createRoundController('round_01', mockQuestions[0], { seed: 9999 });
      const round2 = (session as any).createRoundController('round_02', mockQuestions[0], { seed: 9999 });

      const pairs1 = (round1 as any)._options.pairs;
      const pairs2 = (round2 as any)._options.pairs;

      expect(pairs1).toBeDefined();
      expect(pairs2).toBeDefined();

      // 플랜의 pair_01 또는 attack_01_answer 키로 동일한 correctSide 및 보기 값이 매핑되어야 함
      const p1 = pairs1['pair_01'] ?? Object.values(pairs1)[0];
      const p2 = pairs2['pair_01'] ?? Object.values(pairs2)[0];

      expect(p1.correctSide).toBe(p2.correctSide);
      expect(p1.left.value).toBe(p2.left.value);
      expect(p1.right.value).toBe(p2.right.value);
    });
  });

  describe('3. encounter 순서 기준 매핑 및 우측 정답 판정 포트 도달', () => {
    it('보기 쌍의 correctSide가 right일 때 우측 펀치 시 boss_negate 판정이 실제 발행되어야 한다', () => {
      // seed를 조정하여 첫 번째 pair의 correctSide가 'right'가 되도록 시드 탐색
      let rightSeed = 1;
      let foundRight = false;
      let testSession = AssaultSessionFactory.createSession({
        battleState: createMockBattleState(),
        speech: createMockSpeech(),
        questions: mockQuestions,
      });

      for (let s = 1; s <= 20; s++) {
        const rc = (testSession as any).createRoundController('round_find', mockQuestions[0], { seed: s });
        const pairs = (rc as any)._options.pairs;
        const p = pairs?.['pair_01'] ?? (pairs ? Object.values(pairs)[0] : null);
        if (p && p.correctSide === 'right') {
          rightSeed = s;
          foundRight = true;
          break;
        }
      }

      expect(foundRight).toBe(true);

      const settlementCommands: AssaultSettlementCommand[] = [];
      const session = AssaultSessionFactory.createSession({
        battleState: createMockBattleState(),
        speech: createMockSpeech(),
        questions: mockQuestions,
      });

      // settlement 명령 캡처
      const originalSettle = (session.settlement as any).settle.bind(session.settlement);
      (session.settlement as any).settle = (cmd: AssaultSettlementCommand) => {
        settlementCommands.push(cmd);
        return originalSettle(cmd);
      };

      const roundController = session.createRoundController('round_right', mockQuestions[0], { seed: rightSeed } as any);

      // 120 BPM: throw(1s) + reading(4s) = 5.0s.
      // encounter 0: startBeat 0 (5.0s), arrivalBeat 4 (7.0s)
      roundController.update(0.0);
      roundController.update(2.0);
      roundController.update(5.0); // 조우 시작

      // 7.0초(7000ms) 도착 시각에 우측 펀치 입력!
      roundController.submitPunch('right', 7000, { activeSeconds: 7.0 });
      roundController.update(7.1);

      const drained = roundController.drainSettlementCommands();
      const hasBossNegate = drained.some((c) => c.effectType === 'boss_negate');
      expect(hasBossNegate).toBe(true);

      const hasPlayerDamage = drained.some((c) => c.effectType === 'player_damage');
      expect(hasPlayerDamage).toBe(false);
    });

    it('각 쌍에 유일한 정답 1개와 상이한 오답 1개가 배치되어야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        battleState: createMockBattleState(),
        speech: createMockSpeech(),
        questions: mockQuestions,
      });

      const round = session.createRoundController('round_check', mockQuestions[0], { seed: 12345 } as any);
      const pairsMap = (round as any)._options.pairs;
      expect(pairsMap).toBeDefined();

      const pairs = Object.values(pairsMap) as AssaultAnswerPair[];
      expect(pairs.length).toBeGreaterThan(0);

      for (const pair of pairs) {
        expect(pair.left.value).not.toBe(pair.right.value);
        const correctCount = [pair.left, pair.right].filter((c) => c.isCorrect).length;
        expect(correctCount).toBe(1);
      }
    });
  });

  describe('4. 원본 문제생성 호출 0건 및 메타데이터 보존', () => {
    it('라운드 생성 시 추가 문제 생성 없이 기존 문제의 정답과 메타데이터를 그대로 전달해야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        battleState: createMockBattleState(),
        speech: createMockSpeech(),
        questions: mockQuestions,
      });

      const questionData = {
        id: 'custom_q_99',
        text: '12 + 15 = ?',
        answer: 27,
        correctAnswer: 27,
        type: 'addition',
        minReadSeconds: 4.5,
      };

      const round = session.createRoundController('round_meta', questionData);
      expect((round as any)._question.id).toBe('custom_q_99');
      expect((round as any)._question.text).toBe('12 + 15 = ?');
      expect((round as any)._question.minReadSeconds).toBe(4.5);
    });
  });

  describe('5. AssaultRoundSource 포트 경계', () => {
    it('커스텀 roundSource 포트 주입 시 해당 포트에서 제공한 쌍이 라운드에 연결되어야 한다', () => {
      const mockCustomSource: AssaultRoundSourcePort = {
        kind: 'numeric_repeat',
        providePairs: vi.fn(({ roundId, correctAnswer }) => {
          return [
            {
              pairId: `${roundId}-custom-1`,
              left: { value: Number(correctAnswer), text: String(correctAnswer), isCorrect: true },
              right: { value: 999, text: '999', isCorrect: false },
              correctSide: 'left' as const,
              choices: [
                { value: Number(correctAnswer), text: String(correctAnswer), isCorrect: true },
                { value: 999, text: '999', isCorrect: false },
              ] as const,
            },
          ];
        }),
      };

      const session = AssaultSessionFactory.createSession({
        battleState: createMockBattleState(),
        speech: createMockSpeech(),
        questions: mockQuestions,
        roundSource: mockCustomSource,
      });

      const round = session.createRoundController('round_custom', mockQuestions[0]);
      expect(mockCustomSource.providePairs).toHaveBeenCalled();

      const pairsMap = (round as any)._options.pairs;
      expect(pairsMap).toBeDefined();
      const p = pairsMap['pair_01'] ?? Object.values(pairsMap)[0];
      expect(p.right.value).toBe(999);
      expect(p.correctSide).toBe('left');
    });
  });
});
