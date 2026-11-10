import { describe, it, expect } from 'vitest';
import { AssaultProgressController } from '../../src/game/assault/AssaultProgressController.js';
import { AssaultRoundSummary } from '../../src/game/assault/AssaultRoundSummary.js';
import type { SessionId, RoundId, AttackId } from '../../src/types/assault.js';

describe('[BOSS-ASSAULT-18 / #520] 접근 진행 및 종료 의도 판정 (AssaultProgressController)', () => {
  const SESSION_ID: SessionId = 'session_assault_prog_01';

  /** 헬퍼: 정상 완료 라운드 요약 생성 */
  function createMockCompletedSummary(roundIndex: number, overrides?: {
    correctCount?: number;
    wrongCount?: number;
    playerDamage?: number;
    maxCombo?: number;
  }) {
    const roundId = `round_${roundIndex}` as RoundId;
    return new AssaultRoundSummary({
      sessionId: SESSION_ID,
      roundId,
      completedQuestions: 1,
      isAborted: false,
      isDefeated: false,
      correctCount: overrides?.correctCount ?? 2,
      wrongCount: overrides?.wrongCount ?? 0,
      timeoutCount: 0,
      evadeSuccessCount: 1,
      squatFailCount: 0,
      totalEncounters: 3,
      attemptedAnswerHits: 2,
      ratingCounts: { Perfect: 2, Good: 1, Late: 0, Miss: 0 },
      maxCombo: overrides?.maxCombo ?? 3,
      endCombo: 3,
      totalPlayerDamage: overrides?.playerDamage ?? 0,
      totalBossDamage: 20,
      totalActualDamage: (overrides?.playerDamage ?? 0) + 20,
      actualDamage: overrides?.playerDamage ?? 0,
      totalRequestedDamage: 20,
      activeDurationSeconds: 15.5,
      processedAttackIds: ['atk_1' as AttackId, 'atk_2' as AttackId],
      processedReceiptIds: ['rcpt_1', 'rcpt_2'],
    });
  }

  /** 헬퍼: 중단/사망 라운드 요약 생성 */
  function createMockAbortedSummary(roundIndex: number, isDefeated = false) {
    const roundId = `round_aborted_${roundIndex}` as RoundId;
    return new AssaultRoundSummary({
      sessionId: SESSION_ID,
      roundId,
      completedQuestions: 0,
      isAborted: true,
      isDefeated,
      correctCount: 0,
      wrongCount: 1,
      timeoutCount: 0,
      evadeSuccessCount: 0,
      squatFailCount: 1,
      totalEncounters: 2,
      attemptedAnswerHits: 1,
      ratingCounts: { Perfect: 0, Good: 0, Late: 0, Miss: 2 },
      maxCombo: 0,
      endCombo: 0,
      totalPlayerDamage: 50,
      totalBossDamage: 0,
      totalActualDamage: 50,
      actualDamage: 50,
      totalRequestedDamage: 50,
      activeDurationSeconds: 5.0,
      processedAttackIds: ['atk_fail_1' as AttackId],
      processedReceiptIds: ['rcpt_fail_1'],
    });
  }

  describe('1. 순수 의도 산출 및 아키텍처 불변성 검증', () => {
    it('입력된 summary 객체와 HP 값을 변경하지 않는다', () => {
      const controller = new AssaultProgressController({ targetRounds: 10 });
      const summary = createMockCompletedSummary(1);
      const originalSummaryFrozen = Object.isFrozen(summary);
      const playerHp = 80;

      const result = controller.evaluate(summary, playerHp);

      expect(summary.completedQuestions).toBe(1);
      expect(originalSummaryFrozen).toBe(true);
      expect(playerHp).toBe(80);
      expect(result).toBeDefined();
    });

    it('반환되는 진행 판정 결과(AssaultProgressEvaluation)는 완전히 불변(deepFreeze)이다', () => {
      const controller = new AssaultProgressController({ targetRounds: 10 });
      const summary = createMockCompletedSummary(1);
      const result = controller.evaluate(summary, 100);

      expect(Object.isFrozen(result)).toBe(true);
      expect(() => {
        // @ts-expect-error 불변 객체 쓰기 시도 차단 검증
        result.intent = 'game_over';
      }).toThrow();
    });

    it('유효하지 않은 목표 라운드(<= 0, NaN, 정수 아님)는 생성 시 차단한다', () => {
      expect(() => new AssaultProgressController({ targetRounds: 0 })).toThrow(/targetRounds/i);
      expect(() => new AssaultProgressController({ targetRounds: -5 })).toThrow(/targetRounds/i);
      expect(() => new AssaultProgressController({ targetRounds: NaN })).toThrow(/targetRounds/i);
      expect(() => new AssaultProgressController({ targetRounds: 3.5 })).toThrow(/targetRounds/i);
    });

    it('기본 옵션 시 기본 목표 라운드는 10으로 설정된다 (DOC-14 §10.1)', () => {
      const controller = new AssaultProgressController();
      expect(controller.targetRounds).toBe(10);
    });
  });

  describe('2. 진행도(Progress) 계산 및 전진 규칙 (A14)', () => {
    it('정상 완료된 라운드마다 진행도가 1씩 증가하고 비율이 정확히 계산된다', () => {
      const controller = new AssaultProgressController({ targetRounds: 5 });

      const res1 = controller.evaluate(createMockCompletedSummary(1), 100);
      expect(res1.completedRounds).toBe(1);
      expect(res1.targetRounds).toBe(5);
      expect(res1.progress).toBe(0.2); // 1 / 5
      expect(res1.intent).toBe('next_round');

      const res2 = controller.evaluate(createMockCompletedSummary(2), 100);
      expect(res2.completedRounds).toBe(2);
      expect(res2.progress).toBe(0.4); // 2 / 5
      expect(res2.intent).toBe('next_round');
    });

    it('전부 오답이어도 생존하여 라운드를 마쳤다면 정상 전진한다 (A14)', () => {
      const controller = new AssaultProgressController({ targetRounds: 5 });

      // 정답 0, 오답 2이지만 생존 완료 (completedQuestions: 1, HP > 0)
      const allWrongSummary = createMockCompletedSummary(1, {
        correctCount: 0,
        wrongCount: 2,
        playerDamage: 30,
      });

      const result = controller.evaluate(allWrongSummary, 70);
      expect(result.completedRounds).toBe(1);
      expect(result.progress).toBe(0.2);
      expect(result.intent).toBe('next_round');
    });

    it('중단/사망 라운드(completedQuestions: 0, isAborted: true)는 진행도가 증가하지 않는다 (0회 증가)', () => {
      const controller = new AssaultProgressController({ targetRounds: 5 });

      controller.evaluate(createMockCompletedSummary(1), 100);
      expect(controller.completedRounds).toBe(1);

      // 미사망 중단 라운드 (예: 일시정지 중단)
      const abortedSummary = createMockAbortedSummary(2, false);
      const resAborted = controller.evaluate(abortedSummary, 80);

      expect(resAborted.completedRounds).toBe(1);
      expect(resAborted.progress).toBe(0.2);
      expect(controller.completedRounds).toBe(1);
    });

    it('동일한 라운드 요약(중복 roundId) 유입 시 진행도가 중복 증가하지 않는다 (A14 멱등성)', () => {
      const controller = new AssaultProgressController({ targetRounds: 5 });
      const summary1 = createMockCompletedSummary(1);

      const resFirst = controller.evaluate(summary1, 100);
      expect(resFirst.completedRounds).toBe(1);
      expect(resFirst.progress).toBe(0.2);

      // 동일한 요약 재전송
      const resDup = controller.evaluate(summary1, 100);
      expect(resDup.completedRounds).toBe(1);
      expect(resDup.progress).toBe(0.2);
      expect(controller.completedRounds).toBe(1);
    });
  });

  describe('3. 사망 최우선 정책 (A15, A22)', () => {
    it('HP === 0 또는 HP < 0 발생 시 항상 game_over 의도가 반환된다', () => {
      const controller = new AssaultProgressController({ targetRounds: 5 });
      const summary = createMockCompletedSummary(1);

      const result = controller.evaluate(summary, 0);

      expect(result.intent).toBe('game_over');
      expect(result.isGameOver).toBe(true);
      expect(result.handoverSnapshot).toBeNull();
      expect(controller.isGameOver).toBe(true);
    });

    it('목표 라운드 도달과 동시에 HP === 0이 된 경우 결전 인계보다 사망이 절대적 우선한다 (A15, A22)', () => {
      const controller = new AssaultProgressController({ targetRounds: 3 });

      controller.evaluate(createMockCompletedSummary(1), 100);
      controller.evaluate(createMockCompletedSummary(2), 50);

      // 3번째 라운드(목표 도달)에서 HP 0 사망 발생
      const finalRoundSummary = createMockCompletedSummary(3, { playerDamage: 50 });
      const finalResult = controller.evaluate(finalRoundSummary, 0);

      expect(finalResult.intent).toBe('game_over');
      expect(finalResult.isGameOver).toBe(true);
      // 결전 인계 스냅샷은 절대 발행되지 않아야 함
      expect(finalResult.handoverSnapshot).toBeNull();
      expect(controller.handoverCount).toBe(0);
    });

    it('사망 상태 이후 추가 요약 유입 시 진행도 증가 및 인계가 원천 차단된다', () => {
      const controller = new AssaultProgressController({ targetRounds: 5 });

      // 사망 처리
      controller.evaluate(createMockAbortedSummary(1, true), 0);
      expect(controller.isGameOver).toBe(true);

      // 사망 후 들어오는 추가 요약
      const postDeathResult = controller.evaluate(createMockCompletedSummary(2), 0);
      expect(postDeathResult.intent).toBe('game_over');
      expect(postDeathResult.completedRounds).toBe(0);
      expect(controller.completedRounds).toBe(0);
      expect(postDeathResult.handoverSnapshot).toBeNull();
    });
  });

  describe('4. 목표 달성 및 결전 인계(Handover) 스냅샷 (A22)', () => {
    it('목표 - 1 라운드(예: 9라운드)까지는 next_round를 발행한다', () => {
      const controller = new AssaultProgressController({ targetRounds: 3 });

      const res1 = controller.evaluate(createMockCompletedSummary(1), 100);
      expect(res1.intent).toBe('next_round');
      expect(res1.handoverSnapshot).toBeNull();

      const res2 = controller.evaluate(createMockCompletedSummary(2), 80);
      expect(res2.intent).toBe('next_round');
      expect(res2.handoverSnapshot).toBeNull();
      expect(controller.scheduledNextRoundCount).toBe(2);
    });

    it('목표 라운드에 정상 도달하고 생존한 경우 handover_climax 의도와 인계 스냅샷을 1회 발행한다', () => {
      const controller = new AssaultProgressController({ targetRounds: 3 });

      controller.evaluate(createMockCompletedSummary(1), 100);
      controller.evaluate(createMockCompletedSummary(2), 80);

      // 마지막 3번째 라운드 완료 (생존 HP 60)
      const res3 = controller.evaluate(createMockCompletedSummary(3), 60);

      expect(res3.intent).toBe('handover_climax');
      expect(res3.isTargetReached).toBe(true);
      expect(res3.handoverSnapshot).not.toBeNull();
      expect(controller.handoverCount).toBe(1);

      const snapshot = res3.handoverSnapshot!;
      expect(snapshot.sessionId).toBe(SESSION_ID);
      expect(snapshot.mode).toBe('boss_assault');
      expect(snapshot.rulesVersion).toBe('0.3.0');
      expect(snapshot.finalHp).toBe(60);
      expect(snapshot.completedRounds).toBe(3);
      expect(snapshot.targetRounds).toBe(3);
    });

    it('마지막 라운드 도달 시 추가 next_round 발행 횟수는 정확히 0회이다 (A15, A22)', () => {
      const controller = new AssaultProgressController({ targetRounds: 2 });

      controller.evaluate(createMockCompletedSummary(1), 100);
      expect(controller.scheduledNextRoundCount).toBe(1);

      // 2번째 라운드 (목표 달성)
      const res2 = controller.evaluate(createMockCompletedSummary(2), 90);
      expect(res2.intent).toBe('handover_climax');

      // 마지막 라운드 도달 시 next_round 발행 수는 여전히 1 (추가 발행 0)
      expect(controller.scheduledNextRoundCount).toBe(1);
    });

    it('발행된 AssaultHandoverSnapshot은 완전히 불변(deepFreeze)이다', () => {
      const controller = new AssaultProgressController({ targetRounds: 1 });
      const res = controller.evaluate(createMockCompletedSummary(1), 100);

      const snapshot = res.handoverSnapshot!;
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(Object.isFrozen(snapshot.stats)).toBe(true);
      expect(Object.isFrozen(snapshot.stats.ratingCounts)).toBe(true);

      expect(() => {
        // @ts-expect-error 불변 객체 쓰기 차단 검증
        snapshot.finalHp = 999;
      }).toThrow();
    });

    it('목표 도달 후 추가 요약이 유입되어도 인계 스냅샷은 최대 1회만 발행된다 (중복 발행 0회)', () => {
      const controller = new AssaultProgressController({ targetRounds: 2 });

      controller.evaluate(createMockCompletedSummary(1), 100);
      const res2 = controller.evaluate(createMockCompletedSummary(2), 90);
      expect(res2.intent).toBe('handover_climax');
      expect(controller.handoverCount).toBe(1);

      // 목표 도달 후 초과 유입되는 요약
      const res3 = controller.evaluate(createMockCompletedSummary(3), 90);
      expect(res3.intent).not.toBe('next_round');
      // 추가 스냅샷 새로 발행 0회 (기존 스냅샷 유지 또는 중복 발행 방지)
      expect(controller.handoverCount).toBe(1);
    });

    it('인계 스냅샷의 통계는 누적 라운드들의 수치가 정확히 합산된다', () => {
      const controller = new AssaultProgressController({ targetRounds: 2 });

      // Round 1: correct 2, wrong 0, playerDamage 10, maxCombo 3
      controller.evaluate(createMockCompletedSummary(1, {
        correctCount: 2,
        wrongCount: 0,
        playerDamage: 10,
        maxCombo: 3,
      }), 90);

      // Round 2: correct 1, wrong 1, playerDamage 20, maxCombo 5
      const res2 = controller.evaluate(createMockCompletedSummary(2, {
        correctCount: 1,
        wrongCount: 1,
        playerDamage: 20,
        maxCombo: 5,
      }), 70);

      const stats = res2.handoverSnapshot!.stats;
      expect(stats.totalCompletedQuestions).toBe(2);
      expect(stats.totalCorrectHits).toBe(3); // 2 + 1
      expect(stats.totalWrongHits).toBe(1); // 0 + 1
      expect(stats.maxCombo).toBe(5); // max(3, 5)
      expect(stats.totalPlayerDamage).toBe(30); // 10 + 20
      expect(stats.processedRoundIds).toEqual(['round_1', 'round_2']);
    });
  });

  describe('5. reset 및 세션 초기화', () => {
    it('reset() 호출 시 진행도, 라운드 카운터, 게임오버 상태가 깨끗하게 초기화된다', () => {
      const controller = new AssaultProgressController({ targetRounds: 5 });

      controller.evaluate(createMockCompletedSummary(1), 100);
      controller.evaluate(createMockCompletedSummary(2), 80);
      expect(controller.completedRounds).toBe(2);

      controller.reset();

      expect(controller.completedRounds).toBe(0);
      expect(controller.progress).toBe(0);
      expect(controller.isGameOver).toBe(false);
      expect(controller.isTargetReached).toBe(false);
      expect(controller.handoverCount).toBe(0);
      expect(controller.scheduledNextRoundCount).toBe(0);
      expect(controller.handoverSnapshot).toBeNull();
    });
  });

  describe('6. 추가 옵션, 엣지 케이스 및 별칭 검증', () => {
    it('processRoundSummary 별칭 메서드가 evaluate와 동일하게 작동한다', () => {
      const controller = new AssaultProgressController({ targetRounds: 3 });
      const summary = createMockCompletedSummary(1);
      const res = controller.processRoundSummary(summary, 100);

      expect(res.intent).toBe('next_round');
      expect(res.completedRounds).toBe(1);
    });

    it('summary.isDefeated가 true인 경우 playerHp가 양수여도 game_over가 발동한다 (사망 최우선)', () => {
      const controller = new AssaultProgressController({ targetRounds: 3 });
      const defeatedSummary = createMockAbortedSummary(1, true);

      const res = controller.evaluate(defeatedSummary, 50);
      expect(res.intent).toBe('game_over');
      expect(res.isGameOver).toBe(true);
      expect(controller.isGameOver).toBe(true);
    });

    it('커스텀 sessionId, mode, rulesVersion이 정상 보존된다', () => {
      const controller = new AssaultProgressController({
        sessionId: 'custom_sess_999' as SessionId,
        mode: 'boss_assault',
        rulesVersion: '0.3.0',
        targetRounds: 1,
      });

      const res = controller.evaluate(createMockCompletedSummary(1), 100);
      expect(res.handoverSnapshot?.sessionId).toBe('custom_sess_999');
      expect(res.handoverSnapshot?.mode).toBe('boss_assault');
      expect(res.handoverSnapshot?.rulesVersion).toBe('0.3.0');
    });

    it('processedRoundIds getter를 통해 처리된 라운드 ID 목록을 조회할 수 있다', () => {
      const controller = new AssaultProgressController({ targetRounds: 3 });
      controller.evaluate(createMockCompletedSummary(1), 100);
      controller.evaluate(createMockCompletedSummary(2), 90);

      expect(controller.processedRoundIds).toEqual(['round_1', 'round_2']);
    });
  });
});
