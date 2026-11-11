/**
 * assault-recovery-summary.test.ts
 *
 * [BOSS-ASSAULT-REC-11 / #596] 실측 라운드 요약·완료/중단 계약 복구 단위 테스트
 *
 * 검증 목표:
 * 1. 실제 컨트롤러 판정 결과(정답/오답/미선택/스쿼트)가 고유 attackId로 1회만 요약에 기록된다.
 * 2. 실제 AssaultSettlement 영수증(applied:true, 동일 세션/라운드)만 actualDamage 기준으로 합산된다.
 * 3. finalize 이전 요약은 null, finalize 이후 동일 deepFrozen 객체를 반환한다.
 * 4. 정상 완료 → completedQuestions 1 / abort·사망 → 0, isAborted true (사망 우선).
 * 5. 중복/거부/stale/finalize 이후 영수증은 무효과, onSummaryFinalized는 최대 1회.
 * 6. 일시정지 중 경과 시간은 활성 시간에 포함되지 않는다.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AssaultRoundController,
  type AssaultRoundQuestionData,
} from '../../src/game/assault/AssaultRoundController.js';
import {
  AssaultSettlement,
  type AssaultSettlementReceipt,
  type PlayerResourceTarget,
  type BossResourceTarget,
} from '../../src/game/assault/AssaultSettlement.js';
import type { AssaultSettlementCommand } from '../../src/types/assault.js';

// ─── Fixtures ───

const SESSION = 'sess_rec11';
const ROUND = 'round_rec11';

const question: AssaultRoundQuestionData = {
  id: 'q_rec11',
  text: '2 * 3 = ?',
  minReadSeconds: 4.0,
};

function pairDef(id: string, startBeat: number, correctSide: 'left' | 'right') {
  return {
    id,
    kind: 'answer_pair' as const,
    startBeat,
    durationBeats: 4,
    interactionProfileId: 'profile_punch_default',
    visualProfileId: 'bullet_choice_basic',
    pairId: `${id}_pair`,
    correctSide,
  };
}

function squatDef(id: string, startBeat: number) {
  return {
    id,
    kind: 'squat' as const,
    startBeat,
    durationBeats: 4,
    interactionProfileId: 'profile_squat_default',
    visualProfileId: 'bullet_squat_basic',
  };
}

// 120 BPM (1박 0.5초): 시작 R, R+3, R+6, R+9 / 도착 +2.0 / 마감 +2.17
const plan = {
  bpm: 120,
  encounters: [
    pairDef('pair_a', 0, 'left'),
    pairDef('pair_b', 6, 'left'),
    pairDef('pair_c', 12, 'left'),
    squatDef('squat_d', 18),
  ],
};

function createPlayer(hp: number): PlayerResourceTarget {
  return {
    hp,
    applyHazardDamage(amount = 0) {
      this.hp = Math.max(0, this.hp - amount);
    },
  };
}

function createBoss(hp: number): BossResourceTarget {
  return {
    hp,
    takeDamage(amount: number) {
      this.hp = Math.max(0, this.hp - amount);
    },
  };
}

function createHarness(options?: { playerHp?: number; onSummaryFinalized?: (s: unknown) => void }) {
  const commands: AssaultSettlementCommand[] = [];
  const roundComplete = vi.fn();
  const summaryFinalized = vi.fn(options?.onSummaryFinalized ?? (() => {}));
  const player = createPlayer(options?.playerHp ?? 100);
  const boss = createBoss(10);
  const settlement = new AssaultSettlement({
    activeSessionId: SESSION,
    battleState: player,
    bossController: boss,
  });
  const controller = new AssaultRoundController({
    sessionId: SESSION,
    roundId: ROUND,
    question,
    plan,
    bpm: 120,
    throwDurationSeconds: 1.0,
    onSettlementCommand: (cmd) => commands.push(cmd),
    onRoundComplete: roundComplete,
    onSummaryFinalized: summaryFinalized,
  });
  return { controller, commands, roundComplete, summaryFinalized, player, boss, settlement };
}

/** 정답 / 오답 / 미선택 / 스쿼트(회피 또는 실패) 전체 라운드를 실제 컨트롤러로 진행 */
function playFullRound(
  h: ReturnType<typeof createHarness>,
  squat: 'evade' | 'miss' = 'evade',
): number {
  const { controller } = h;
  const R = controller.readingEndTime;
  controller.update(R + 2.0);
  // pair_a 정답 (left)
  controller.submitPunch('left', Math.round((R + 2.0) * 1000), { activeSeconds: R + 2.0, inputId: 'in_a' });
  controller.update(R + 5.0);
  // pair_b 오답 (right)
  controller.submitPunch('right', Math.round((R + 5.0) * 1000), { activeSeconds: R + 5.0, inputId: 'in_b' });
  controller.update(R + 6.5);
  // pair_c 미선택 → 마감 시 timeout
  controller.update(R + 9.5);
  if (squat === 'evade') {
    controller.submitSquat('ducking', Math.round((R + 10.0) * 1000), {
      activeSeconds: R + 10.0,
      standGeneration: 1,
    });
  }
  const endT = R + 12.0;
  controller.update(endT);
  return endT;
}

function settleAll(h: ReturnType<typeof createHarness>): AssaultSettlementReceipt[] {
  const drained = h.controller.drainSettlementCommands();
  return drained.map((cmd) => h.settlement.settle(cmd));
}

function expectDeepFrozen(obj: unknown): void {
  expect(Object.isFrozen(obj)).toBe(true);
  if (obj && typeof obj === 'object') {
    for (const value of Object.values(obj as Record<string, unknown>)) {
      if (value && typeof value === 'object') {
        expectDeepFrozen(value);
      }
    }
  }
}

// ─── Tests ───

describe('[BOSS-ASSAULT-REC-11 / #596] 실측 라운드 요약·완료/중단 계약', () => {
  describe('1. 실제 판정 결과 + 실제 정산 영수증 기반 요약', () => {
    it('정답/오답/미선택 + 스쿼트 회피를 실제 컨트롤러와 AssaultSettlement로 진행하면 정확한 요약을 만든다', () => {
      const h = createHarness();
      const endT = playFullRound(h, 'evade');

      expect(h.controller.isCompleted).toBe(true);
      expect(h.roundComplete).toHaveBeenCalledTimes(1);
      expect(h.roundComplete.mock.calls[0][0].success).toBe(true);

      const receipts = settleAll(h);
      expect(receipts.length).toBe(4);
      expect(receipts.every((r) => r.applied)).toBe(true);
      for (const r of receipts) {
        expect(h.controller.recordSettlementReceipt(r)).toBe(true);
      }

      expect(h.controller.getRoundSummary()).toBeNull();
      const summary = h.controller.finalizeRoundSummary({ isDefeated: false });
      expect(summary).not.toBeNull();

      const expectedPlayerDamage = receipts
        .filter((r) => r.target === 'player')
        .reduce((sum, r) => sum + r.actualDamage, 0);

      expect(summary!.sessionId).toBe(SESSION);
      expect(summary!.roundId).toBe(ROUND);
      expect(summary!.completedQuestions).toBe(1);
      expect(summary!.isAborted).toBe(false);
      expect(summary!.isDefeated).toBe(false);
      expect(summary!.correctCount).toBe(1);
      expect(summary!.wrongCount).toBe(1);
      expect(summary!.timeoutCount).toBe(1);
      expect(summary!.evadeSuccessCount).toBe(1);
      expect(summary!.squatFailCount).toBe(0);
      expect(summary!.totalEncounters).toBe(4);
      expect(summary!.totalPlayerDamage).toBe(expectedPlayerDamage);
      expect(summary!.totalPlayerDamage).toBe(100 - h.player.hp);
      expect(summary!.totalBossDamage).toBe(0);
      expect(summary!.activeDurationSeconds).toBeCloseTo(endT, 6);
      expect([...summary!.processedAttackIds].sort()).toEqual(['pair_a', 'pair_b', 'pair_c', 'squat_d']);
      // 리듬 등급은 정답 여부와 별도로 기록 (timeout은 Miss)
      const ratingTotal =
        summary!.ratingCounts.Perfect + summary!.ratingCounts.Good +
        summary!.ratingCounts.Late + summary!.ratingCounts.Miss;
      expect(ratingTotal).toBe(3);
      expect(summary!.ratingCounts.Miss).toBeGreaterThanOrEqual(1);
    });

    it('스쿼트 미수행 시 squatFailCount 1과 실제 피해 합계가 반영된다', () => {
      const h = createHarness();
      playFullRound(h, 'miss');
      const receipts = settleAll(h);
      receipts.forEach((r) => h.controller.recordSettlementReceipt(r));
      const summary = h.controller.finalizeRoundSummary({ isDefeated: false })!;
      expect(summary.squatFailCount).toBe(1);
      expect(summary.evadeSuccessCount).toBe(0);
      expect(summary.totalPlayerDamage).toBe(100 - h.player.hp);
      expect(summary.completedQuestions).toBe(1);
    });

    it('요약은 requestedDamage가 아닌 actualDamage를 합산하고 HP를 재차감하지 않는다', () => {
      const h = createHarness({ playerHp: 12 });
      playFullRound(h, 'evade');
      const receipts = settleAll(h);
      receipts.forEach((r) => h.controller.recordSettlementReceipt(r));
      const hpBeforeFinalize = h.player.hp;
      const summary = h.controller.finalizeRoundSummary({ isDefeated: false })!;
      expect(h.player.hp).toBe(hpBeforeFinalize);
      expect(summary.totalPlayerDamage).toBe(12);
      expect(summary.totalRequestedDamage).toBeGreaterThan(summary.totalPlayerDamage);
    });
  });

  describe('2. finalize 순서 및 사망/중단 계약', () => {
    it('finalize 이전에는 getRoundSummary가 null이고, 라운드 미완료 상태의 finalize는 null을 반환한다', () => {
      const h = createHarness();
      h.controller.update(h.controller.readingEndTime + 0.5);
      expect(h.controller.getRoundSummary()).toBeNull();
      expect(h.controller.finalizeRoundSummary({ isDefeated: false })).toBeNull();
      expect(h.summaryFinalized).not.toHaveBeenCalled();

      playFullRound(h, 'evade');
      const summary = h.controller.finalizeRoundSummary({ isDefeated: false });
      expect(summary).not.toBeNull();
      expect(h.controller.getRoundSummary()).toBe(summary);
    });

    it('finalize 직전 마지막 치명 피해 영수증(newHp 0)이 있으면 defeated, completedQuestions 0', () => {
      const h = createHarness({ playerHp: 20 });
      playFullRound(h, 'evade');
      expect(h.roundComplete.mock.calls[0][0].success).toBe(true);
      const receipts = settleAll(h);
      const fatal = receipts.find((r) => r.target === 'player' && r.newHp === 0);
      expect(fatal).toBeDefined();
      receipts.forEach((r) => h.controller.recordSettlementReceipt(r));

      const summary = h.controller.finalizeRoundSummary({ isDefeated: false })!;
      expect(summary.isDefeated).toBe(true);
      expect(summary.isAborted).toBe(true);
      expect(summary.completedQuestions).toBe(0);
    });

    it('finalize({ isDefeated: true })는 정상 완료 라운드라도 사망 우선으로 completedQuestions 0', () => {
      const h = createHarness();
      playFullRound(h, 'evade');
      const summary = h.controller.finalizeRoundSummary({ isDefeated: true })!;
      expect(summary.isDefeated).toBe(true);
      expect(summary.isAborted).toBe(true);
      expect(summary.completedQuestions).toBe(0);
    });

    it('abort() 후 finalize하면 completedQuestions 0, isAborted true, isDefeated false', () => {
      const h = createHarness();
      const R = h.controller.readingEndTime;
      h.controller.update(R + 0.5);
      // pair_a 도착(R + 2.0) 100ms 전 정답 (EarlyMiss 170ms 유효창 내)
      h.controller.submitPunch('left', Math.round((R + 1.9) * 1000), { activeSeconds: R + 1.9, inputId: 'in_a' });
      h.controller.abort('user_quit');
      expect(h.roundComplete).toHaveBeenCalledTimes(1);
      expect(h.roundComplete.mock.calls[0][0].success).toBe(false);

      const summary = h.controller.finalizeRoundSummary({ isDefeated: false })!;
      expect(summary.completedQuestions).toBe(0);
      expect(summary.isAborted).toBe(true);
      expect(summary.isDefeated).toBe(false);
      expect(summary.correctCount).toBe(1);
      expect(summary.activeDurationSeconds).toBeCloseTo(R + 1.9, 6);
    });
  });

  describe('3. 멱등성·거부 영수증·불변성', () => {
    it('중복 onRoundComplete / 중복 finalize는 동일 객체를 반환하고 onSummaryFinalized는 1회만 호출된다', () => {
      const h = createHarness();
      playFullRound(h, 'evade');
      h.controller.update(h.controller.readingEndTime + 20);
      h.controller.abort('late_abort');
      expect(h.roundComplete).toHaveBeenCalledTimes(1);

      const first = h.controller.finalizeRoundSummary({ isDefeated: false });
      const second = h.controller.finalizeRoundSummary({ isDefeated: true });
      expect(second).toBe(first);
      expect(h.controller.getRoundSummary()).toBe(first);
      expect(first!.isDefeated).toBe(false);
      expect(first!.completedQuestions).toBe(1);
      expect(h.summaryFinalized).toHaveBeenCalledTimes(1);
      expect(h.summaryFinalized.mock.calls[0][0]).toBe(first);
      expectDeepFrozen(first);
    });

    it('중복 영수증은 false를 반환하고 집계에 영향이 없다', () => {
      const h = createHarness();
      playFullRound(h, 'evade');
      const receipts = settleAll(h);
      const playerReceipt = receipts.find((r) => r.target === 'player' && r.actualDamage > 0)!;
      expect(h.controller.recordSettlementReceipt(playerReceipt)).toBe(true);
      expect(h.controller.recordSettlementReceipt(playerReceipt)).toBe(false);
      const summary = h.controller.finalizeRoundSummary({ isDefeated: false })!;
      expect(summary.totalPlayerDamage).toBe(playerReceipt.actualDamage);
    });

    it('applied:false 또는 null 영수증은 거부되며 멱등 키를 소비하지 않는다', () => {
      const h = createHarness();
      playFullRound(h, 'evade');
      const receipts = settleAll(h);
      const valid = receipts.find((r) => r.target === 'player' && r.actualDamage > 0)!;
      const rejected: AssaultSettlementReceipt = Object.freeze({
        ...valid,
        applied: false,
        actualDamage: 0,
        rejectionReason: 'duplicate' as const,
      });
      // 실제 정산기의 중복 거부 영수증
      const realDuplicate = h.settlement.settle({
        sessionId: SESSION,
        roundId: ROUND,
        attackId: valid.attackId,
        target: 'player',
        resultKind: valid.resultKind,
        effectType: valid.effectType as AssaultSettlementCommand['effectType'],
        idempotencyKey: valid.idempotencyKey,
      } as AssaultSettlementCommand);
      expect(realDuplicate.applied).toBe(false);

      expect(h.controller.recordSettlementReceipt(null)).toBe(false);
      expect(h.controller.recordSettlementReceipt(rejected)).toBe(false);
      expect(h.controller.recordSettlementReceipt(realDuplicate)).toBe(false);
      // 거부 영수증이 키를 소비하지 않았으므로 정상 영수증은 수락
      expect(h.controller.recordSettlementReceipt(valid)).toBe(true);
      const summary = h.controller.finalizeRoundSummary({ isDefeated: false })!;
      expect(summary.totalPlayerDamage).toBe(valid.actualDamage);
    });

    it('다른 세션/라운드(stale) 영수증은 거부되고 키를 소비하지 않는다', () => {
      const h = createHarness();
      playFullRound(h, 'evade');
      const receipts = settleAll(h);
      const valid = receipts.find((r) => r.target === 'player' && r.actualDamage > 0)!;
      const staleSession = Object.freeze({ ...valid, sessionId: 'sess_old' });
      const staleRound = Object.freeze({ ...valid, roundId: 'round_old' });
      expect(h.controller.recordSettlementReceipt(staleSession)).toBe(false);
      expect(h.controller.recordSettlementReceipt(staleRound)).toBe(false);
      expect(h.controller.recordSettlementReceipt(valid)).toBe(true);
    });

    it('finalize 이후 영수증은 false이며 요약 객체는 변경되지 않는다', () => {
      const h = createHarness();
      playFullRound(h, 'evade');
      const receipts = settleAll(h);
      const summary = h.controller.finalizeRoundSummary({ isDefeated: false })!;
      const before = JSON.stringify(summary);
      for (const r of receipts) {
        expect(h.controller.recordSettlementReceipt(r)).toBe(false);
      }
      expect(h.controller.getRoundSummary()).toBe(summary);
      expect(JSON.stringify(h.controller.getRoundSummary())).toBe(before);
      expect(summary.totalPlayerDamage).toBe(0);
      expectDeepFrozen(summary);
    });
  });

  describe('4. 활성 시간 측정', () => {
    it('일시정지 중 update 호출은 활성 시간에 포함되지 않는다', () => {
      const h = createHarness();
      h.controller.update(1.0);
      h.controller.pause('menu');
      h.controller.update(3.0);
      h.controller.update(6.0);
      h.controller.resume();
      h.controller.update(2.5);
      h.controller.abort('user_quit');
      const summary = h.controller.finalizeRoundSummary({ isDefeated: false })!;
      expect(summary.activeDurationSeconds).toBeCloseTo(2.5, 6);
    });

    it('라운드 완료 이후의 시간 진행은 활성 시간에 누적되지 않는다', () => {
      const h = createHarness();
      const endT = playFullRound(h, 'evade');
      h.controller.update(endT + 30);
      const summary = h.controller.finalizeRoundSummary({ isDefeated: false })!;
      expect(summary.activeDurationSeconds).toBeCloseTo(endT, 6);
    });
  });
});
