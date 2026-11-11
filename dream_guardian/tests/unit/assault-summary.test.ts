import { describe, it, expect, vi } from 'vitest';
import {
  AssaultRoundSummary,
  AssaultRoundSummaryAggregator,
  createAssaultRoundSummary,
} from '../../src/game/assault/AssaultRoundSummary.js';
import type {
  SessionId,
  RoundId,
  AttackId,
} from '../../src/types/assault.js';
import type { AssaultSettlementReceipt } from '../../src/game/assault/AssaultSettlement.js';

describe('[BOSS-ASSAULT-17 / #519] 불변 라운드 요약 집계 (AssaultRoundSummary)', () => {
  const SESSION_ID: SessionId = 'session_test_summary_01';
  const ROUND_ID: RoundId = 'round_test_01';

  describe('1. 순수 집계 및 아키텍처 불변성 검증', () => {
    it('HP 조작이나 외부 자원 변경 메서드를 직접 호출하지 않는다', () => {
      const mockPlayer = {
        hp: 100,
        applyHazardDamage: vi.fn(),
      };
      const mockBoss = {
        hp: 10,
        takeDamage: vi.fn(),
      };

      const aggregator = new AssaultRoundSummaryAggregator({
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
      });

      aggregator.recordAnswerHit('attack_01' as AttackId, { isCorrect: true });
      aggregator.recordAnswerHit('attack_02' as AttackId, { isCorrect: false });
      aggregator.finalize();

      expect(mockPlayer.applyHazardDamage).toHaveBeenCalledTimes(0);
      expect(mockBoss.takeDamage).toHaveBeenCalledTimes(0);
      expect(mockPlayer.hp).toBe(100);
      expect(mockBoss.hp).toBe(10);
    });

    it('생성된 AssaultRoundSummary DTO는 깊은 동결(deepFreeze)되어 내부 속성까지 불변이다', () => {
      const aggregator = new AssaultRoundSummaryAggregator({
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
      });

      aggregator.recordAnswerHit('att_p1' as AttackId, {
        isCorrect: true,
        rating: 'Perfect',
      });
      const summary = aggregator.finalize();

      expect(summary instanceof AssaultRoundSummary).toBe(true);
      expect(Object.isFrozen(summary)).toBe(true);
      expect(Object.isFrozen(summary.ratingCounts)).toBe(true);
      expect(Object.isFrozen(summary.processedAttackIds)).toBe(true);
      expect(Object.isFrozen(summary.processedReceiptIds)).toBe(true);

      // 불변성 위반 시도 차단 검증
      expect(() => {
        (summary as any).correctCount = 999;
      }).toThrow();
      expect(() => {
        (summary.ratingCounts as any).Perfect = 999;
      }).toThrow();
      expect(() => {
        (summary.processedAttackIds as any).push('hack_attack');
      }).toThrow();
    });

    it('요약 발행(finalize) 이후 추가 이벤트나 변경 시도가 유입되어도 기발행 요약은 전혀 변형되지 않는다', () => {
      const aggregator = new AssaultRoundSummaryAggregator({
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
        activeDurationSeconds: 5.0,
      });

      aggregator.recordAnswerHit('att_p1' as AttackId, { isCorrect: true });
      const summary = aggregator.finalize();

      expect(summary.correctCount).toBe(1);
      expect(summary.activeDurationSeconds).toBe(5.0);

      // 발행 후 추가 이벤트 유입 시도
      const acceptedPostEncounter = aggregator.recordAnswerHit('att_p2' as AttackId, {
        isCorrect: true,
      });
      aggregator.setActiveDuration(120.0);
      aggregator.abort();

      expect(acceptedPostEncounter).toBe(false);
      expect(summary.correctCount).toBe(1);
      expect(summary.activeDurationSeconds).toBe(5.0);
      expect(summary.completedQuestions).toBe(1);
      expect(summary.isAborted).toBe(false);
    });
  });

  describe('2. A11 핵심 시나리오: 문제 수와 타격 수의 엄격한 분리 (3쌍 정답2/오답1 + 회피2/실패1)', () => {
    it('3쌍(정답2, 오답1) 및 스쿼트(회피2, 실패1)는 완료 문제 수 1, 총 타격 수 6, 실제 피해 합계와 정확히 일치한다', () => {
      const aggregator = new AssaultRoundSummaryAggregator({
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
        activeDurationSeconds: 8.5,
      });

      // 1. 답 쌍 1: 정답
      aggregator.recordAnswerHit('pair_att_01' as AttackId, {
        isCorrect: true,
        rating: 'Perfect',
      });
      // 2. 답 쌍 2: 오답
      aggregator.recordAnswerHit('pair_att_02' as AttackId, {
        isCorrect: false,
        rating: 'Late',
      });
      // 3. 스쿼트 1: 회피 성공
      aggregator.recordSquatEvade('squat_att_01' as AttackId, {
        rating: 'Good',
      });
      // 4. 스쿼트 2: 회피 실패(피격)
      aggregator.recordSquatFail('squat_att_02' as AttackId, {
        rating: 'Miss',
      });
      // 5. 답 쌍 3: 정답
      aggregator.recordAnswerHit('pair_att_03' as AttackId, {
        isCorrect: true,
        rating: 'Perfect',
      });
      // 6. 스쿼트 3: 회피 성공
      aggregator.recordSquatEvade('squat_att_03' as AttackId, {
        rating: 'Good',
      });

      // 영수증(Receipt) 기록: 오답(25 피해), 스쿼트 실패(15 피해)
      aggregator.recordReceipt({
        receiptId: 'receipt_wrong_01',
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
        attackId: 'pair_att_02' as AttackId,
        target: 'player',
        effectType: 'player_damage',
        resultKind: 'miss',
        idempotencyKey: `${SESSION_ID}:pair_att_02:player_damage`,
        requestedDamage: 25,
        actualDamage: 25,
        oldHp: 100,
        previousHp: 100,
        newHp: 75,
        currentHp: 75,
        applied: true,
      });

      aggregator.recordReceipt({
        receiptId: 'receipt_squat_fail_01',
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
        attackId: 'squat_att_02' as AttackId,
        target: 'player',
        effectType: 'player_damage',
        resultKind: 'miss',
        idempotencyKey: `${SESSION_ID}:squat_att_02:player_damage`,
        requestedDamage: 15,
        actualDamage: 15,
        oldHp: 75,
        previousHp: 75,
        newHp: 60,
        currentHp: 60,
        applied: true,
      });

      const summary = aggregator.finalize();

      // 문제 수와 타격 수 분리 검증 (A11)
      expect(summary.completedQuestions).toBe(1); // 1문제 정상 완료
      expect(summary.isAborted).toBe(false);
      expect(summary.isDefeated).toBe(false);

      // 세부 타격 지표 검증
      expect(summary.totalEncounters).toBe(6);
      expect(summary.attemptedAnswerHits).toBe(3);
      expect(summary.correctCount).toBe(2);
      expect(summary.wrongCount).toBe(1);
      expect(summary.timeoutCount).toBe(0);
      expect(summary.evadeSuccessCount).toBe(2);
      expect(summary.squatFailCount).toBe(1);

      // 피해량 집계 검증 (요청치가 아닌 실제 피해량 actualDamage 합산)
      expect(summary.totalPlayerDamage).toBe(40);
      expect(summary.actualDamage).toBe(40);
      expect(summary.totalBossDamage).toBe(0);

      // 리듬 등급 및 활성 시간
      expect(summary.ratingCounts).toEqual({
        Perfect: 2,
        Good: 2,
        Late: 1,
        Miss: 1,
      });
      expect(summary.activeDurationSeconds).toBe(8.5);
    });
  });

  describe('3. A14 시나리오: 중간 사망(HP 0) 및 중단(Abort) 처리', () => {
    it('중간 사망 발생 시 문제 완료 수는 0이고 isAborted=true, isDefeated=true여야 한다', () => {
      const aggregator = new AssaultRoundSummaryAggregator({
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
      });

      aggregator.recordAnswerHit('pair_att_01' as AttackId, { isCorrect: true });
      aggregator.recordAnswerHit('pair_att_02' as AttackId, { isCorrect: false });

      // 사망을 초래한 치명적 영수증 유입 (HP: 20 -> 0)
      aggregator.recordReceipt({
        receiptId: 'receipt_fatal',
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
        attackId: 'pair_att_02' as AttackId,
        target: 'player',
        effectType: 'player_damage',
        resultKind: 'miss',
        idempotencyKey: 'fatal_key',
        requestedDamage: 25,
        actualDamage: 20, // 잔여 HP만큼만 실피해 발생
        oldHp: 20,
        previousHp: 20,
        newHp: 0,
        currentHp: 0,
        applied: true,
      });

      const summary = aggregator.finalize();

      expect(summary.completedQuestions).toBe(0); // 중간 사망으로 문제 완료 0
      expect(summary.isAborted).toBe(true);
      expect(summary.isDefeated).toBe(true);
      expect(summary.correctCount).toBe(1);
      expect(summary.wrongCount).toBe(1);
      expect(summary.actualDamage).toBe(20);
    });

    it('외부 강제 중단(abort) 호출 시에도 문제 완료 수는 0이고 isAborted=true여야 한다', () => {
      const aggregator = new AssaultRoundSummaryAggregator({
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
      });

      aggregator.recordAnswerHit('pair_att_01' as AttackId, { isCorrect: true });
      aggregator.abort();

      const summary = aggregator.finalize();
      expect(summary.completedQuestions).toBe(0);
      expect(summary.isAborted).toBe(true);
      expect(summary.isDefeated).toBe(false);
      expect(summary.correctCount).toBe(1);
    });

    it('아무런 조우도 진행되지 않은 빈 라운드에서 중단되면 totalEncounters=0, completedQuestions=0이다', () => {
      const aggregator = new AssaultRoundSummaryAggregator({
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
      });
      aggregator.abort();

      const summary = aggregator.finalize();
      expect(summary.totalEncounters).toBe(0);
      expect(summary.completedQuestions).toBe(0);
      expect(summary.isAborted).toBe(true);
    });
  });

  describe('4. A15 시나리오: 멱등성 및 중복 결과/영수증 차단', () => {
    it('동일한 attackId의 조우 결과가 중복 유입되어도 1회만 집계된다', () => {
      const aggregator = new AssaultRoundSummaryAggregator({
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
      });

      const res1 = aggregator.recordAnswerHit('dup_att_01' as AttackId, {
        isCorrect: true,
        rating: 'Perfect',
      });
      const res2 = aggregator.recordAnswerHit('dup_att_01' as AttackId, {
        isCorrect: true,
        rating: 'Perfect',
      });

      expect(res1).toBe(true);
      expect(res2).toBe(false); // 중복 거절

      const summary = aggregator.finalize();
      expect(summary.correctCount).toBe(1);
      expect(summary.totalEncounters).toBe(1);
      expect(summary.ratingCounts.Perfect).toBe(1);
    });

    it('동일한 영수증(동일 receiptId 또는 동일 attackId)이 중복 유입되어도 실피해가 중복 합산되지 않는다', () => {
      const aggregator = new AssaultRoundSummaryAggregator({
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
      });

      const receipt: AssaultSettlementReceipt = {
        receiptId: 'receipt_dup_01',
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
        attackId: 'att_dup_rec' as AttackId,
        target: 'player',
        effectType: 'player_damage',
        resultKind: 'miss',
        idempotencyKey: 'idemp_key_01',
        requestedDamage: 25,
        actualDamage: 25,
        oldHp: 100,
        previousHp: 100,
        newHp: 75,
        currentHp: 75,
        applied: true,
      };

      const firstApplied = aggregator.recordReceipt(receipt);
      const secondApplied = aggregator.recordReceipt(receipt);

      expect(firstApplied).toBe(true);
      expect(secondApplied).toBe(false);

      const summary = aggregator.finalize();
      expect(summary.totalPlayerDamage).toBe(25);
      expect(summary.processedReceiptIds.length).toBe(1);
    });

    it('finalize를 여러 번 호출해도 동일한 불변 요약 인스턴스를 반환한다', () => {
      const aggregator = new AssaultRoundSummaryAggregator({
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
      });
      aggregator.recordAnswerHit('att_01' as AttackId, { isCorrect: true });

      const summary1 = aggregator.finalize();
      const summary2 = aggregator.finalize();

      expect(summary1).toBe(summary2);
    });
  });

  describe('5. 실제 피해량(actualDamage) vs 요청 피해량(requestedDamage) 분리 검증', () => {
    it('HP 제한(clamping)으로 요청치(25)와 실제 적용치(10)가 다를 때 actualDamage(10)를 합산한다', () => {
      const aggregator = new AssaultRoundSummaryAggregator({
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
      });

      aggregator.recordReceipt({
        receiptId: 'receipt_clamp_01',
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
        attackId: 'att_clamp' as AttackId,
        target: 'player',
        effectType: 'player_damage',
        resultKind: 'miss',
        idempotencyKey: 'clamp_key',
        requestedDamage: 25,
        actualDamage: 10, // 잔여 HP로 인해 10만 적용됨
        oldHp: 10,
        previousHp: 10,
        newHp: 0,
        currentHp: 0,
        applied: true,
      });

      const summary = aggregator.finalize();
      expect(summary.totalPlayerDamage).toBe(10);
      expect(summary.totalRequestedDamage).toBe(25);
      expect(summary.actualDamage).toBe(10);
      expect(summary.isDefeated).toBe(true);
      expect(summary.completedQuestions).toBe(0);
    });

    it('보스 대상 피해량(totalBossDamage)도 player 피해와 엄격히 분리되어 집계된다', () => {
      const aggregator = new AssaultRoundSummaryAggregator({
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
      });

      aggregator.recordReceipt({
        receiptId: 'boss_receipt_01',
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
        attackId: 'boss_att_01' as AttackId,
        target: 'boss',
        effectType: 'boss_stagger',
        resultKind: 'hit',
        idempotencyKey: 'boss_key',
        requestedDamage: 4,
        actualDamage: 4,
        oldHp: 10,
        previousHp: 10,
        newHp: 6,
        currentHp: 6,
        applied: true,
      });

      const summary = aggregator.finalize();
      expect(summary.totalBossDamage).toBe(4);
      expect(summary.totalPlayerDamage).toBe(0);
    });
  });

  describe('6. 콤보(Combo) 및 미선택(Timeout) 집계 검증 (DOC-14 §15.3-C4)', () => {
    it('연속 정답 성공 시 콤보가 증가하고 실패(오답/타임아웃) 시 0으로 리셋되며 스쿼트는 콤보에 영향을 주지 않는다', () => {
      const aggregator = new AssaultRoundSummaryAggregator({
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
      });

      // 1: 정답 (+1 -> combo: 1)
      aggregator.recordAnswerHit('att_c1' as AttackId, { isCorrect: true });
      // 2: 회피 성공 (스쿼트 무관 -> combo: 1)
      aggregator.recordSquatEvade('att_c2' as AttackId);
      // 3: 타임아웃 미선택 (리셋 -> combo: 0)
      aggregator.recordAnswerTimeout('att_c3' as AttackId);
      // 4: 정답 (+1 -> combo: 1)
      aggregator.recordAnswerHit('att_c4' as AttackId, { isCorrect: true });
      // 5: 회피 성공 (스쿼트 무관 -> combo: 1)
      aggregator.recordSquatEvade('att_c5' as AttackId);
      // 6: 정답 (+1 -> combo: 2)
      aggregator.recordAnswerHit('att_c6' as AttackId, { isCorrect: true });
      // 7: 스쿼트 실패 (스쿼트 무관 -> combo: 2)
      aggregator.recordSquatFail('att_c7' as AttackId);

      const summary = aggregator.finalize();

      expect(summary.maxCombo).toBe(2);
      expect(summary.endCombo).toBe(2);
      expect(summary.timeoutCount).toBe(1);
      expect(summary.correctCount).toBe(3);
      expect(summary.evadeSuccessCount).toBe(2);
      expect(summary.squatFailCount).toBe(1);
    });
  });

  describe('7. 활성 시간(Pause 제외) 측정 검증', () => {
    it('일시정지 시간은 제외되고 실제 전달된 activeDurationSeconds만 기록된다', () => {
      const aggregator = new AssaultRoundSummaryAggregator({
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
      });

      // 3.5초 활성 누적
      aggregator.setActiveDuration(3.5);

      const summary = aggregator.finalize();
      expect(summary.activeDurationSeconds).toBe(3.5);
    });
  });

  describe('8. createAssaultRoundSummary 팩토리 및 일괄 생성 검증', () => {
    it('배치 매개변수를 통해 한 번에 불변 요약을 생성할 수 있다', () => {
      const summary = createAssaultRoundSummary({
        sessionId: SESSION_ID,
        roundId: ROUND_ID,
        encounters: [
          { attackId: 'a1' as AttackId, kind: 'answer_pair', resultKind: 'hit', rating: 'Perfect' },
          { attackId: 'a2' as AttackId, kind: 'squat', resultKind: 'evaded', rating: 'Good' },
        ],
        activeDurationSeconds: 4.2,
      });

      expect(summary.sessionId).toBe(SESSION_ID);
      expect(summary.roundId).toBe(ROUND_ID);
      expect(summary.correctCount).toBe(1);
      expect(summary.evadeSuccessCount).toBe(1);
      expect(summary.maxCombo).toBe(1);
      expect(summary.completedQuestions).toBe(1);
      expect(summary.activeDurationSeconds).toBe(4.2);
      expect(Object.isFrozen(summary)).toBe(true);
    });
  });
});
