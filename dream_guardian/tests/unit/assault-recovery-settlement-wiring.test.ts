/**
 * assault-recovery-settlement-wiring.test.ts
 *
 * [BOSS-ASSAULT-REC-10 / #598] 정산 실행 단일 경로·영수증 전달 복구 단위 테스트
 *
 * 검증 목표:
 * 1. 고유 명령 1개당 settle 호출 1회, 자원 적용 1회, applied receipt 집계 1회 (단일 실행 소유자).
 * 2. Factory onSettlementCommand -> settle 시 반환된 AssaultSettlementReceipt가 roundController.recordSettlementReceipt에 전달된다.
 * 3. 정산 -> HP 0 확인 -> 중단/완료요약 -> 진행 순서가 연결되며, 요약 처리에서 HP를 재차감하지 않는다.
 * 4. HP 상한/치명 피해의 실제 차이만 요약에 반영되고, duplicate/stale receipt는 안전하게 거부/무효화된다.
 * 5. 완료 콜백(onRoundComplete)이 update 도중 와도 최종 명령 및 HP 0 처리를 완료하기 전에는 진행(progress 전진)하지 않는다.
 */

import { describe, it, expect, vi } from 'vitest';
import { AssaultSessionWireHelper } from '../../src/core/bootstrap/AssaultSessionWireHelper.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';

describe('[BOSS-ASSAULT-REC-10 / #598] Single Settlement Execution Path & Receipt Wiring', () => {
  const sampleQuestion: QuestionCandidate = {
    id: 'q_settle_01',
    level: 1,
    subLevel: 1,
    type: 'add',
    text: '3 + 4 = ?',
    answer: '7',
    wrongAnswer: '8',
    choices: ['7', '8'],
  };

  function createMockHost(initialPlayerHp: number = 100, initialBossHp: number = 10) {
    const battle = new BattleState(initialPlayerHp);
    const boss = new BossController(initialBossHp);
    const sessionLifecycle = {
      setActiveAssaultSessionToken: vi.fn(),
      setTestSession: vi.fn(),
      isValidAssaultToken: vi.fn(() => true),
      activeAssaultSessionToken: 'test_token',
      lastHandoverSnapshot: null,
      hasResultShown: false,
      claimResultTransition: vi.fn(() => true),
      handleAssaultIntent: vi.fn((_intent: string) => true),
    };
    const sessionContext = {
      mode: 'boss_assault',
      setMode: vi.fn(),
      setActive: vi.fn(),
      assaultSession: null as any,
    };
    const motionIntentBus = {
      setPhase: vi.fn(),
    };
    const stateMachine = {
      currentState: 'ASSAULT_ROUND',
      canTransition: vi.fn(() => true),
      changeState: vi.fn(),
    };
    const sfx = {
      play: vi.fn(),
      stopDwellCharge: vi.fn(),
    };
    const speech = {
      speak: vi.fn(),
      speakFeedback: vi.fn(),
    };

    const host: any = {
      battle,
      boss,
      bossController: boss,
      speech,
      sfx,
      sessionLifecycle,
      sessionContext,
      motionIntentBus,
      stateMachine,
    };

    const wireHelper = new AssaultSessionWireHelper(host);
    return { host, battle, boss, wireHelper };
  }

  function stepSession(session: any, targetSeconds: number, stepDt: number = 0.05): void {
    const rawSession = session.__rawSession ?? session;
    const clock = rawSession.clockAdapter ?? rawSession.clock;
    while ((clock?.activeSeconds ?? 0) < targetSeconds - 1e-6) {
      const current = clock?.activeSeconds ?? 0;
      const dt = Math.min(stepDt, targetSeconds - current);
      session.update(dt);
    }
  }

  describe('1. 고유 명령당 단일 settle 호출 및 이중 진입 제거', () => {
    it('세션 update 실행 시 고유 정산 명령 1개당 settle이 정확히 1회만 호출되어야 한다 (Factory가 단일 소유)', () => {
      const { wireHelper, battle } = createMockHost(100);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
      });

      const rawSession = (session as any).__rawSession ?? session;
      const settleSpy = vi.spyOn(rawSession.settlement, 'settle');

      const rc = wireHelper.createRoundController(session, 'round_s1', sampleQuestion);
      const readingEnd = rc.readingEndTime;

      // 읽기 시간 경과
      stepSession(session, readingEnd + 1.0);

      // 오답 펀치 제출 (wrongDamage 발생 예정)
      const enc = rc.encounters.find((e: any) => e.kind === 'answer_pair');
      expect(enc).toBeDefined();

      const wrongSide = enc.correctSide === 'left' ? 'right' : 'left';
      rc.submitPunch(wrongSide as any, Math.round((readingEnd + 1.0) * 1000), {
        activeSeconds: readingEnd + 1.0,
        inputId: 'p_wrong_1',
      });

      // 조우 도착/마감 시점(readingEnd + 2.0s arrival, 2.17s deadline)으로 업데이트 진행 -> 명령 발생 (BUG-ASSAULT-003)
      stepSession(session, readingEnd + 2.2);

      // settle이 정확히 1회 호출되었는지 검증 (drain에서 이중 settle 호출 0회)
      expect(settleSpy).toHaveBeenCalledTimes(1);
      expect(battle.hp).toBe(90); // 100 - 10 = 90

      // 다음 프레임 update 시에도 추가 settle 호출 0회
      (session as any).update(0.016);
      expect(settleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. 명령별 receipt 전달 및 applied=true 영수증 집계', () => {
    it('Factory onSettlementCommand 실행 시 반환된 receipt가 roundController.recordSettlementReceipt에 전달되어야 한다', () => {
      const { wireHelper } = createMockHost(100);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
      });

      const rc = wireHelper.createRoundController(session, 'round_s2', sampleQuestion);
      const recordReceiptSpy = vi.spyOn(rc, 'recordSettlementReceipt');

      const readingEnd = rc.readingEndTime;
      stepSession(session, readingEnd + 1.0);

      const enc = rc.encounters.find((e: any) => e.kind === 'answer_pair');
      const wrongSide = enc.correctSide === 'left' ? 'right' : 'left';
      rc.submitPunch(wrongSide as any, Math.round((readingEnd + 1.0) * 1000), {
        activeSeconds: readingEnd + 1.0,
        inputId: 'p_wrong_s2',
      });

      stepSession(session, readingEnd + 2.2);

      // recordSettlementReceipt가 영수증과 함께 1회 호출되었어야 함
      expect(recordReceiptSpy).toHaveBeenCalledTimes(1);
      const receiptArg = recordReceiptSpy.mock.calls[0][0] as any;
      expect(receiptArg).toBeDefined();
      expect(receiptArg?.applied).toBe(true);
      expect(receiptArg?.target).toBe('player');
      expect(receiptArg?.actualDamage).toBe(10);
    });

    it('중복/stale 영수증은 집계되지 않고 0건으로 무효화되어야 한다', () => {
      const { wireHelper } = createMockHost(100);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
      });

      const rc = wireHelper.createRoundController(session, 'round_s3', sampleQuestion);
      const readingEnd = rc.readingEndTime;
      stepSession(session, readingEnd + 1.0);

      const enc = rc.encounters.find((e: any) => e.kind === 'answer_pair');
      const wrongSide = enc.correctSide === 'left' ? 'right' : 'left';
      rc.submitPunch(wrongSide as any, Math.round((readingEnd + 1.0) * 1000), {
        activeSeconds: readingEnd + 1.0,
        inputId: 'p_wrong_s3',
      });

      stepSession(session, readingEnd + 2.2);

      // 이미 기록된 영수증을 임의로 다시 전달할 경우 recordSettlementReceipt는 false 반환
      const receipts = ((session as any).__rawSession ?? session).settlement.getReceipts();
      expect(receipts.length).toBe(1);

      const dupResult = rc.recordSettlementReceipt(receipts[0]);
      expect(dupResult).toBe(false);
    });
  });

  describe('3. 정산 -> HP 0 확인 -> 중단/완료요약 -> 진행 순서 보장', () => {
    it('치명 피해로 HP가 0이 되었을 때 요약에 isDefeated가 반영되고 HP 재차감 없이 game_over로 진행되어야 한다', () => {
      // HP 10으로 시작 (피해 1회 10으로 즉시 0)
      const { wireHelper, battle, host } = createMockHost(10);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
      });

      const rc = wireHelper.createRoundController(session, 'round_s4', sampleQuestion);
      const readingEnd = rc.readingEndTime;
      stepSession(session, readingEnd + 1.0);

      const enc = rc.encounters.find((e: any) => e.kind === 'answer_pair');
      const wrongSide = enc.correctSide === 'left' ? 'right' : 'left';
      rc.submitPunch(wrongSide as any, Math.round((readingEnd + 1.0) * 1000), {
        activeSeconds: readingEnd + 1.0,
        inputId: 'p_wrong_s4',
      });

      // 조우 마감 -> settle 발생 -> HP 0
      stepSession(session, readingEnd + 2.2);
      expect(battle.hp).toBe(0);

      // 라운드 종료 시점까지 시간 전진
      stepSession(session, readingEnd + 15.0);
      expect(rc.isCompleted).toBe(true);

      // 요약 검증
      const summary = rc.getRoundSummary();
      expect(summary).toBeDefined();
      expect(summary?.isDefeated).toBe(true);
      expect(summary?.totalPlayerDamage).toBe(10);
      // HP 재차감 0건 확인
      expect(battle.hp).toBe(0);

      // game_over 인텐트 라우팅 확인
      expect(host.sessionLifecycle.handleAssaultIntent).toHaveBeenCalledWith(
        'game_over',
        null,
        expect.any(String),
      );
    });

    it('HP 상한/치명 피해의 실제 차이만 요약에 반영되어야 한다 (HP 5 상태에서 10 피해 시 actualDamage=5)', () => {
      // HP 5로 시작
      const { wireHelper, battle } = createMockHost(5);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
      });

      const rc = wireHelper.createRoundController(session, 'round_s5', sampleQuestion);
      const readingEnd = rc.readingEndTime;
      stepSession(session, readingEnd + 1.0);

      const enc = rc.encounters.find((e: any) => e.kind === 'answer_pair');
      const wrongSide = enc.correctSide === 'left' ? 'right' : 'left';
      rc.submitPunch(wrongSide as any, Math.round((readingEnd + 1.0) * 1000), {
        activeSeconds: readingEnd + 1.0,
        inputId: 'p_wrong_s5',
      });

      stepSession(session, readingEnd + 2.2);
      expect(battle.hp).toBe(0);

      stepSession(session, readingEnd + 15.0);
      const summary = rc.getRoundSummary();
      expect(summary).toBeDefined();
      // 실제 차감된 피해는 5여야 함 (요청 10 vs 실제 5)
      expect(summary?.totalPlayerDamage).toBe(5);
      expect(summary?.isDefeated).toBe(true);
    });
  });

  describe('4. update 도중 완료 콜백 도착 시 처리 순서 보장', () => {
    it('완료 콜백이 발생할 때 이미 정산과 HP 0 확인이 완료된 상태여야 하며 진행도가 비정상 전진하지 않아야 한다', () => {
      const { wireHelper, battle } = createMockHost(10);
      const session = wireHelper.assembleAssaultSession({
        questions: [sampleQuestion],
      });

      const rawSession = (session as any).__rawSession ?? session;
      const progressController = rawSession.progressController;
      const initialProgress = progressController.progress;

      let callbackObservedHp = -1;
      let callbackObservedDefeated = false;

      const rc = wireHelper.createRoundController(session, 'round_s6', sampleQuestion);
      const originalOptions = (rc as any)._options;
      (rc as any)._options = {
        ...originalOptions,
        onRoundComplete: (res: any) => {
          callbackObservedHp = battle.hp;
          callbackObservedDefeated = battle.hp <= 0;
          originalOptions?.onRoundComplete?.(res);
        },
      };

      const readingEnd = rc.readingEndTime;
      stepSession(session, readingEnd + 1.0);

      const enc = rc.encounters.find((e: any) => e.kind === 'answer_pair');
      const wrongSide = enc.correctSide === 'left' ? 'right' : 'left';
      rc.submitPunch(wrongSide as any, Math.round((readingEnd + 1.0) * 1000), {
        activeSeconds: readingEnd + 1.0,
        inputId: 'p_wrong_s6',
      });

      // 라운드 종료까지 전진
      stepSession(session, readingEnd + 15.0);

      // 콜백 시점에 이미 HP는 0으로 정산되어 있어야 함
      expect(callbackObservedHp).toBe(0);
      expect(callbackObservedDefeated).toBe(true);

      // 사망 시 progressController 진행도는 전진하지 않아야 함
      expect(progressController.progress).toBe(initialProgress);
      expect(progressController.isGameOver).toBe(true);
    });
  });
});
