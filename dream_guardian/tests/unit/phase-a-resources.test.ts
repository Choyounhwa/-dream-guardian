import { describe, it, expect, beforeEach } from 'vitest';
import { MinionTroopManager } from '../../src/game/MinionTroopManager.js';
import { PhaseAResourceManager } from '../../src/game/PhaseAResourceManager.js';
import { DEFAULT_BATTLE_CONFIG } from '../../config/battle.config.js';

describe('Phase A 미니언 및 별가루 자원 모델 단위 테스트 (Issue #242 / GAME-PHASE-A-RESOURCES-001)', () => {
  describe('1. MinionTroopManager (아군 미니언 군단 모델)', () => {
    let troopManager: MinionTroopManager;

    beforeEach(() => {
      troopManager = new MinionTroopManager();
    });

    it('초기 미니언 수는 3, 수호신 수는 1 (총 4체)이어야 한다', () => {
      expect(troopManager.minionCount).toBe(3);
      expect(troopManager.guardianCount).toBe(1);
      expect(troopManager.totalTroopCount).toBe(4);
    });

    it('정답 정산 1회당 미니언이 +1 증원된다', () => {
      troopManager.onRoundSettled('correct', 1);
      expect(troopManager.minionCount).toBe(4);
      expect(troopManager.totalTroopCount).toBe(5);

      troopManager.onRoundSettled('correct', 2);
      expect(troopManager.minionCount).toBe(5);
    });

    it('동일한 roundId로 중복 정산이 호출되어도 미니언이 중복 증원되지 않는다 (멱등성)', () => {
      troopManager.onRoundSettled('correct', 1);
      expect(troopManager.minionCount).toBe(4);

      troopManager.onRoundSettled('correct', 1);
      expect(troopManager.minionCount).toBe(4);

      troopManager.onRoundSettled('correct', 1);
      expect(troopManager.minionCount).toBe(4);
    });

    it('10연속 정답 시 최대 13마리 상한(3 + 10 = 13)에 도달한다', () => {
      for (let r = 1; r <= 10; r++) {
        troopManager.onRoundSettled('correct', r);
      }
      expect(troopManager.minionCount).toBe(13);
      expect(troopManager.isMaxed).toBe(true);

      // 상한 도달 후 추가 증원 시도 시에도 13 유지
      troopManager.onRoundSettled('correct', 11);
      expect(troopManager.minionCount).toBe(13);
    });

    it('오답(wrong) 정산 시 미니언 증원은 0이며 기존 군단과 수호신이 보존된다', () => {
      troopManager.onRoundSettled('correct', 1); // 4
      expect(troopManager.minionCount).toBe(4);

      troopManager.onRoundSettled('wrong', 2);
      expect(troopManager.minionCount).toBe(4);
      expect(troopManager.guardianCount).toBe(1);
      expect(troopManager.totalTroopCount).toBe(5);
    });

    it('타임아웃(timeout) 정산 시 미니언 증원은 0이며 기존 군단과 수호신이 보존된다', () => {
      troopManager.onRoundSettled('timeout', 1);
      expect(troopManager.minionCount).toBe(3);
      expect(troopManager.guardianCount).toBe(1);
    });

    it('reset 호출 시 초기 미니언 수(3) 및 상태가 복원된다', () => {
      troopManager.onRoundSettled('correct', 1);
      troopManager.onRoundSettled('correct', 2);
      expect(troopManager.minionCount).toBe(5);

      troopManager.reset();
      expect(troopManager.minionCount).toBe(3);
      expect(troopManager.guardianCount).toBe(1);
    });

    it('removeMinion 호출 시 미니언 수가 감소하며 0마리 하한 클램프된다 (#193, #194)', () => {
      troopManager.removeMinion(1);
      expect(troopManager.minionCount).toBe(2);
      expect(troopManager.totalTroopCount).toBe(3);

      troopManager.removeMinion(5);
      expect(troopManager.minionCount).toBe(0);
      expect(troopManager.totalTroopCount).toBe(1); // 수호신 1마리 보존
    });
  });

  describe('2. PhaseAResourceManager - 별가루 적립 및 중복 방지', () => {
    let resourceManager: PhaseAResourceManager;

    beforeEach(() => {
      resourceManager = new PhaseAResourceManager();
    });

    it('별 판정별 승인 적립 규격을 준수한다 (Perfect 4, Good 3, Late 2, Miss 0)', () => {
      expect(DEFAULT_BATTLE_CONFIG.stardustReward).toEqual({
        Perfect: 4,
        Good: 3,
        Late: 2,
        Miss: 0,
      });

      const pGain = resourceManager.recordStarRating('Perfect', 'note_1');
      expect(pGain).toBe(4);
      expect(resourceManager.stardust).toBe(4);
      expect(resourceManager.totalStardustEarned).toBe(4);

      const gGain = resourceManager.recordStarRating('Good', 'note_2');
      expect(gGain).toBe(3);
      expect(resourceManager.stardust).toBe(7);

      const lGain = resourceManager.recordStarRating('Late', 'note_3');
      expect(lGain).toBe(2);
      expect(resourceManager.stardust).toBe(9);

      const mGain = resourceManager.recordStarRating('Miss', 'note_4');
      expect(mGain).toBe(0);
      expect(resourceManager.stardust).toBe(9);
    });

    it('동일 noteId에 대한 중복 평가 시 추가 적립이 차단된다 (중복 noteId 적립 0)', () => {
      const firstGain = resourceManager.recordStarRating('Perfect', 'note_duplicate');
      expect(firstGain).toBe(4);
      expect(resourceManager.stardust).toBe(4);

      const dupGain = resourceManager.recordStarRating('Perfect', 'note_duplicate');
      expect(dupGain).toBe(0);
      expect(resourceManager.stardust).toBe(4);
      expect(resourceManager.totalStardustEarned).toBe(4);
    });

    it('별 0개(올 Miss)여도 미니언 군단과 정답 정산에 영향을 주지 않는다', () => {
      resourceManager.recordStarRating('Miss', 'n1');
      resourceManager.recordStarRating('Miss', 'n2');
      expect(resourceManager.stardust).toBe(0);

      resourceManager.onRoundSettled('correct', 1);
      expect(resourceManager.minionCount).toBe(4);
    });
  });

  describe('3. PhaseAResourceManager - 별가루 소비 API 계약 (consumeStardust)', () => {
    let resourceManager: PhaseAResourceManager;

    beforeEach(() => {
      resourceManager = new PhaseAResourceManager();
      // 별가루 20 적립 (5 Perfects)
      for (let i = 1; i <= 5; i++) {
        resourceManager.recordStarRating('Perfect', `note_${i}`);
      }
      expect(resourceManager.stardust).toBe(20);
    });

    it('정상 소비 시 잔량이 즉시 차감되고 true를 반환한다', () => {
      const ok = resourceManager.consumeStardust(8);
      expect(ok).toBe(true);
      expect(resourceManager.stardust).toBe(12);
      expect(resourceManager.totalStardustEarned).toBe(20); // 누적 획득 통계는 보존
    });

    it('잔량 초과 소비 요청 시 거부되고 false를 반환하며 잔량은 보존된다', () => {
      const ok = resourceManager.consumeStardust(25);
      expect(ok).toBe(false);
      expect(resourceManager.stardust).toBe(20);
    });

    it('음수, 0, 또는 비정상 수치(NaN, Infinity) 요청 시 거부되고 false를 반환한다', () => {
      expect(resourceManager.consumeStardust(-5)).toBe(false);
      expect(resourceManager.consumeStardust(0)).toBe(false);
      expect(resourceManager.consumeStardust(NaN)).toBe(false);
      expect(resourceManager.consumeStardust(Infinity)).toBe(false);
      expect(resourceManager.stardust).toBe(20);
    });

    it('동일한 idempotencyKey 요청에 대해 중복 차단을 보장한다 (동일 요청 중복 차감 거부)', () => {
      const first = resourceManager.consumeStardust(5, 'tx_001');
      expect(first).toBe(true);
      expect(resourceManager.stardust).toBe(15);

      const second = resourceManager.consumeStardust(5, 'tx_001');
      expect(second).toBe(false);
      expect(resourceManager.stardust).toBe(15); // 중복 차감 없음

      // 다른 키는 정상 차감 가능
      const otherKey = resourceManager.consumeStardust(5, 'tx_002');
      expect(otherKey).toBe(true);
      expect(resourceManager.stardust).toBe(10);
    });
  });

  describe('4. PhaseAResourceManager - Phase B 인계 불변 스냅샷 계약', () => {
    let resourceManager: PhaseAResourceManager;

    beforeEach(() => {
      resourceManager = new PhaseAResourceManager();
    });

    it('스냅샷 생성 시 동결된 불변 객체를 반환하며 자원 상태를 보존한다', () => {
      resourceManager.recordStarRating('Perfect', 'n1'); // +4
      resourceManager.recordStarRating('Good', 'n2'); // +3
      resourceManager.onRoundSettled('correct', 1); // minion 4

      const snap = resourceManager.createSnapshot();
      expect(snap.minionCount).toBe(4);
      expect(snap.guardianCount).toBe(1);
      expect(snap.stardust).toBe(7);
      expect(snap.totalStardustEarned).toBe(7);
      expect(Object.isFrozen(snap)).toBe(true);
    });

    it('스냅샷 읽기 및 취득이 내부 상태 reset을 유발하지 않는다', () => {
      resourceManager.recordStarRating('Perfect', 'n1');
      resourceManager.onRoundSettled('correct', 1);

      const snap1 = resourceManager.createSnapshot();
      const snap2 = resourceManager.getResourceSnapshot();

      expect(snap1.minionCount).toBe(4);
      expect(snap2.minionCount).toBe(4);
      expect(resourceManager.minionCount).toBe(4);
      expect(resourceManager.stardust).toBe(4);
    });
  });
});
