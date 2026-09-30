/**
 * phase-a-settlement.test.ts - Phase A 보상 정산과 Phase B 보스 처치 책임 분리 통합 테스트
 *
 * @see Issue #240 [BATTLE-PHASE-A-SETTLEMENT-001]
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BeatRoundResolver } from '../../src/game/BeatRoundResolver.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { GuardianSystem } from '../../src/game/GuardianSystem.js';
import type { PhaseAResourceSnapshot } from '../../src/types/result.js';

describe('Phase A 보상 정산과 처치 분리 통합 검증 (Issue #240)', () => {
  let battle: BattleState;
  let boss: BossController;
  let guardian: GuardianSystem;
  let onBossDefeatedMock: ReturnType<typeof vi.fn>;
  let onPlayerDefeatedMock: ReturnType<typeof vi.fn>;
  let onSpellCastMock: ReturnType<typeof vi.fn>;
  let resolver: BeatRoundResolver;

  beforeEach(() => {
    battle = new BattleState(100);
    boss = new BossController(1); // Ch.1 Boss HP = 10
    guardian = new GuardianSystem();
    onBossDefeatedMock = vi.fn();
    onPlayerDefeatedMock = vi.fn();
    onSpellCastMock = vi.fn();

    resolver = new BeatRoundResolver({
      battle,
      boss,
      guardian,
      onBossDefeated: onBossDefeatedMock,
      onPlayerDefeated: onPlayerDefeatedMock,
      onSpellCast: onSpellCastMock,
      nonLethalPhaseA: true,
      minBossHp: 1,
      maxPhaseARounds: 10,
    });
  });

  describe('1. 10연속 정답에도 Phase A 조기 보스 처치 / 승리 0', () => {
    it('10연속 정답을 달성해도 보스 HP는 1 미만으로 떨어지지 않고 처치되지 않는다', () => {
      for (let round = 1; round <= 10; round++) {
        resolver.startNewRound(round);
        const result = resolver.resolveRound('correct', round);

        expect(result.bossDefeated).toBe(false);
        expect(boss.isDefeated).toBe(false);
        expect(boss.hp).toBeGreaterThanOrEqual(1);
      }

      // 10문제 완료 시점 확인
      expect(resolver.settledRoundCount).toBe(10);
      expect(resolver.isPhaseAComplete).toBe(true);
      expect(boss.hp).toBe(1); // 10 정답 + 2회 스펠(각 4)에도 최소 1 보장
      expect(boss.isDefeated).toBe(false);
      expect(onBossDefeatedMock).not.toHaveBeenCalled(); // Phase A에서는 조기 승리 콜백 0회
      expect(onSpellCastMock).toHaveBeenCalledTimes(2); // 마나 100 도달 2회 (4번, 8번 정답)
      expect(guardian.castCount).toBe(2);
      expect(guardian.stage).toBe(2);
    });
  });

  describe('2. 라운드 중복 콜백에서 마나·문제수·콤보 중복 가산 0 (idempotent per roundId)', () => {
    it('동일 roundId로 resolveRound가 여러 번 호출되어도 단 1회만 정산된다', () => {
      resolver.startNewRound(1);
      const res1 = resolver.resolveRound('correct', 1);
      expect(res1.manaGained).toBe(25);
      expect(battle.mana).toBe(25);
      expect(battle.combo).toBe(1);
      expect(battle.correctCount).toBe(1);

      // 동일 roundId 1로 중복 콜백 3회 호출
      const dup1 = resolver.resolveRound('correct', 1);
      const dup2 = resolver.resolveRound('correct', 1);
      const dup3 = resolver.resolveRound('wrong', 1); // 상태가 달라도 roundId 이미 정산됨

      expect(dup1).toBe(res1);
      expect(dup2).toBe(res1);
      expect(dup3).toBe(res1);
      expect(battle.mana).toBe(25); // 50 또는 75로 가산되지 않음
      expect(battle.combo).toBe(1);
      expect(battle.correctCount).toBe(1);
      expect(resolver.settledRoundCount).toBe(1);
    });

    it('라운드 2 진행 중 지연된 라운드 1 콜백이 도착해도 라운드 2에 영향을 주지 않는다', () => {
      resolver.startNewRound(1);
      resolver.resolveRound('correct', 1);

      resolver.startNewRound(2);
      expect(resolver.currentRoundIndex).toBe(2);

      // 지연된 라운드 1 콜백
      const delayedRes = resolver.resolveRound('correct', 1);
      expect(delayedRes.roundIndex).toBe(1);
      expect(battle.mana).toBe(25);
      expect(battle.combo).toBe(1);

      // 라운드 2 정상 정산
      const res2 = resolver.resolveRound('correct', 2);
      expect(res2.roundIndex).toBe(2);
      expect(battle.mana).toBe(50);
      expect(battle.combo).toBe(2);
      expect(resolver.settledRoundCount).toBe(2);
    });
  });

  describe('3. 별 0개여도 기본 정답 보상 유지', () => {
    it('모든 노트를 놓쳐 별 0개(올 Miss)여도 정답에 대한 마나 +25 및 콤보 +1이 보장된다', () => {
      for (let i = 0; i < 7; i++) {
        resolver.recordStarRating('Miss');
      }
      expect(resolver.rhythmStats.beatStarsCollected).toBe(0);
      expect(resolver.rhythmStats.missedStars).toBe(7);

      const res = resolver.resolveRound('correct', 1);
      expect(res.manaGained).toBe(25);
      expect(res.combo).toBe(1);
      expect(battle.mana).toBe(25);
      expect(battle.combo).toBe(1);
    });
  });

  describe('4. wrong / timeout도 완료문제 1개 집계하며 직접피해 0', () => {
    it('오답 및 타임아웃 정산 시 완료 문제로 집계되며 플레이어 HP는 감소하지 않는다', () => {
      // 1번: wrong
      resolver.startNewRound(1);
      const r1 = resolver.resolveRound('wrong', 1);
      expect(r1.damageTaken).toBe(0);
      expect(battle.hp).toBe(100);
      expect(battle.wrongCount).toBe(1);
      expect(battle.totalQuestions).toBe(1);
      expect(resolver.rhythmStats.wrongAnswerCount).toBe(1);

      // 2번: timeout
      resolver.startNewRound(2);
      const r2 = resolver.resolveRound('timeout', 2);
      expect(r2.damageTaken).toBe(0);
      expect(battle.hp).toBe(100);
      expect(battle.wrongCount).toBe(2);
      expect(battle.totalQuestions).toBe(2);
      expect(resolver.rhythmStats.timeoutCount).toBe(1);

      expect(resolver.settledRoundCount).toBe(2);
    });
  });

  describe('5. 플레이어 HP 0 우선순위 (게임오버가 완료보다 우선)', () => {
    it('10번째 라운드에서 플레이어 HP가 0이면 onPlayerDefeated가 트리거된다', () => {
      // 1~9 라운드 정답
      for (let r = 1; r <= 9; r++) {
        resolver.startNewRound(r);
        resolver.resolveRound('correct', r);
      }

      // 10번째 라운드 중 치명적 장판 피해 발생 (HP = 0)
      battle.applyHazardDamage(100);
      expect(battle.hp).toBe(0);
      expect(battle.isAlive).toBe(false);

      resolver.startNewRound(10);
      const r10 = resolver.resolveRound('wrong', 10);

      expect(r10.playerDefeated).toBe(true);
      expect(onPlayerDefeatedMock).toHaveBeenCalledTimes(1);
      expect(onBossDefeatedMock).not.toHaveBeenCalled();

      const snapshot = resolver.getResourceSnapshot();
      expect(snapshot.isPlayerDefeated).toBe(true);
    });
  });

  describe('6. 자원 스냅샷 인터페이스 (PhaseAResourceSnapshot)', () => {
    it('10문제 혼합 완주 후 정확하고 불변인 Phase A 자원 스냅샷을 제공한다', () => {
      // 7 정답, 2 오답, 1 타임아웃
      const pattern: ('correct' | 'wrong' | 'timeout')[] = [
        'correct', 'correct', 'wrong', 'correct', 'correct',
        'timeout', 'correct', 'correct', 'wrong', 'correct',
      ];

      pattern.forEach((status, idx) => {
        const roundId = idx + 1;
        resolver.startNewRound(roundId);
        resolver.recordStarRating('Perfect');
        resolver.resolveRound(status, roundId);
      });

      const snapshot: PhaseAResourceSnapshot = resolver.getResourceSnapshot();

      expect(snapshot.totalSettledQuestions).toBe(10);
      expect(snapshot.correctCount).toBe(7);
      expect(snapshot.wrongCount).toBe(2);
      expect(snapshot.timeoutCount).toBe(1);
      expect(snapshot.isPhaseAComplete).toBe(true);
      expect(snapshot.isPlayerDefeated).toBe(false);
      expect(snapshot.isBossDefeated).toBe(false);
      expect(snapshot.bossHp).toBeGreaterThanOrEqual(1);
      expect(snapshot.playerHp).toBe(100);
      expect(snapshot.rhythmStats.beatStarsCollected).toBe(10);
      expect(snapshot.timestamp).toBeGreaterThan(0);

      // 스냅샷 객체 불변성 검증 (수정 시도 시 예외 또는 무시)
      expect(() => {
        (snapshot as any).playerHp = 0;
      }).toThrow();
    });

    it('스냅샷 조회가 내부 상태를 변경하거나 초기화하지 않는다', () => {
      resolver.startNewRound(1);
      resolver.resolveRound('correct', 1);

      const snap1 = resolver.getResourceSnapshot();
      const snap2 = resolver.getResourceSnapshot();

      expect(snap1.playerMana).toBe(snap2.playerMana);
      expect(snap1.totalSettledQuestions).toBe(1);
      expect(resolver.settledRoundCount).toBe(1);
      expect(battle.mana).toBe(25);
    });
  });
});
