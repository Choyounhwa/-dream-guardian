import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PAIR_JUDGE_CONFIG,
  reducePairState,
  createInitialPairState,
  type AssaultPairPlan,
  type AssaultPairAction,
} from '../../src/game/assault/AssaultPairJudge.js';
import { DEFAULT_ASSAULT_CONFIG } from '../../config/assault.config.js';
import { AssaultRoundController } from '../../src/game/assault/AssaultRoundController.js';
import { AssaultRoundSummaryAggregator } from '../../src/game/assault/AssaultRoundSummary.js';
import type { AttackId, SessionId, RoundId } from '../../src/types/assault.js';

describe('BUG-ASSAULT-005 (#673): 리듬 등급·콤보 정의 DOC-14 C4/config 정합성 검증', () => {
  const defaultPlan: AssaultPairPlan = Object.freeze({
    sessionId: 'session_bug_005' as SessionId,
    roundId: 'round_bug_005' as RoundId,
    attackId: 'att_01' as AttackId,
    correctSide: 'left',
    arrivalMs: 2000,
    windowStartMs: 0,
  });

  describe('1. config 리듬 윈도우(Late 170) 주입 및 delta 185ms 판정', () => {
    it('DEFAULT_PAIR_JUDGE_CONFIG의 rhythmWindows.Late가 config 값(170)과 일치해야 한다 (DRY)', () => {
      expect(DEFAULT_PAIR_JUDGE_CONFIG.rhythmWindows.Late).toBe(DEFAULT_ASSAULT_CONFIG.rhythmWindows.Late);
      expect(DEFAULT_PAIR_JUDGE_CONFIG.rhythmWindows.Late).toBe(170);
    });

    it('AssaultRoundController가 생성하는 pairJudge에 config.rhythmWindows가 올바르게 주입되어야 한다', () => {
      const controller = new AssaultRoundController({
        sessionId: 'session_bug_005' as SessionId,
        roundId: 'round_bug_005' as RoundId,
        question: {
          id: 'q_01',
          text: '2 + 2',
          options: [{ text: '4', correct: true }, { text: '5', correct: false }],
          correctAnswerSide: 'left',
        },
        plan: {
          bpm: 120,
          encounters: [
            {
              id: 'attack_pair_01',
              kind: 'answer_pair',
              startBeat: 0,
              durationBeats: 4,
              pairId: 'pair_01',
              correctAnswerSide: 'left',
            },
          ],
        } as any,
        bpm: 120,
      });

      const encounters = (controller as any)._encounters;
      const pairEnc = encounters.find((e: any) => e.def.kind === 'answer_pair');
      expect(pairEnc).toBeDefined();
      expect(pairEnc.pairJudge).toBeDefined();
      expect(pairEnc.pairJudge.config.rhythmWindows.Late).toBe(170);
    });

    it('delta 185ms 타격은 Late 윈도우(170ms)를 초과하므로 Late가 아닌 Miss로 판정되어야 한다', () => {
      const state = createInitialPairState();
      const action: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 2185, // arrivalMs(2000) + 185ms (> 170ms)
        inputId: 'punch_185',
      };

      // lateGraceMs를 200으로 설정하여 마감 초과 이전에 리듬 등급 평가를 거치도록 함
      const judgeConfig = {
        lateGraceMs: 200,
        rhythmWindows: DEFAULT_ASSAULT_CONFIG.rhythmWindows, // Late: 170
      };

      const result = reducePairState(state, action, judgeConfig, defaultPlan);
      expect(result.state.deltaMs).toBe(185);
      expect(result.state.rhythmRating).toBe('Miss');
    });
  });

  describe('2. 이른 타격(Early) 리듬 등급 판정', () => {
    it('도착보다 이른 타격(delta -150ms, Good 120ms 초과 · EarlyMiss 170ms 이내)은 Late가 아니라 Early로 판정되어야 한다', () => {
      const state = createInitialPairState();
      const action: AssaultPairAction = {
        type: 'punch',
        hand: 'left',
        timestampMs: 1850, // arrivalMs(2000) - 150ms (delta: -150ms, EarlyMiss 170ms 유효창 내)
        inputId: 'punch_early',
      };

      const result = reducePairState(state, action, undefined, defaultPlan);
      expect(result.state.deltaMs).toBe(-150);
      expect(result.state.rhythmRating).toBe('Early');
      expect(result.state.status).toBe('correct');
      expect(result.state.isCorrect).toBe(true);
    });
  });

  describe('3. 콤보 집계에서 스쿼트 제외 (DOC-14 §15.3-C4)', () => {
    it('[정답 -> 스쿼트 실패 -> 정답] 시퀀스에서 콤보가 리셋되지 않고 최대 콤보가 2가 되어야 한다', () => {
      const aggregator = new AssaultRoundSummaryAggregator({
        sessionId: 'session_bug_005' as SessionId,
        roundId: 'round_bug_005' as RoundId,
      });

      // 1. 정답 타격 -> 콤보 1
      aggregator.recordAnswerHit('att_ans_1' as AttackId, { isCorrect: true });
      expect(aggregator.finalize().maxCombo).toBe(1);

      // 2. 스쿼트 실패 -> 콤보는 유지되어야 함 (스쿼트는 콤보 무관)
      aggregator.recordSquatFail('att_sq_fail' as AttackId);
      // finalize() 후 캐시 재계산을 위해 새 인스턴스로 시퀀스 테스트
      const seqAggregator = new AssaultRoundSummaryAggregator({
        sessionId: 'session_bug_005' as SessionId,
        roundId: 'round_bug_005' as RoundId,
      });
      seqAggregator.recordAnswerHit('att_ans_1' as AttackId, { isCorrect: true });
      seqAggregator.recordSquatFail('att_sq_fail' as AttackId);
      seqAggregator.recordAnswerHit('att_ans_2' as AttackId, { isCorrect: true });

      const summary = seqAggregator.finalize();
      expect(summary.maxCombo).toBe(2);
      expect(summary.endCombo).toBe(2);
      expect(summary.squatFailCount).toBe(1);
      expect(summary.correctCount).toBe(2);
    });

    it('스쿼트 성공이 콤보를 증가시키지 않아야 한다', () => {
      const aggregator = new AssaultRoundSummaryAggregator({
        sessionId: 'session_bug_005' as SessionId,
        roundId: 'round_bug_005' as RoundId,
      });

      // 스쿼트 성공 기록
      aggregator.recordSquatEvade('att_sq_1' as AttackId);
      aggregator.recordSquatEvade('att_sq_2' as AttackId);

      const summary = aggregator.finalize();
      expect(summary.maxCombo).toBe(0);
      expect(summary.endCombo).toBe(0);
      expect(summary.evadeSuccessCount).toBe(2);
    });
  });
});
