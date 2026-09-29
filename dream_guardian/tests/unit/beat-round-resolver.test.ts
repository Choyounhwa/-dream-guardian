/**
 * beat-round-resolver.test.ts - BEAT MOTION 8박 종료 전투 및 리듬 통계 단일 정산 단위 테스트
 *
 * @see Issue #184 [GAME-ROUND-001]
 * @see Issue #176 [BEAT-SPEC-001]
 * @see Issue #182 [INPUT-STAR-001]
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BeatRoundResolver } from '../../src/game/BeatRoundResolver.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { GuardianSystem } from '../../src/game/GuardianSystem.js';
import { DEFAULT_CONFIG } from '../../src/core/Config.js';

describe('BeatRoundResolver (Issue #184 - GAME-ROUND-001)', () => {
  let resolver: BeatRoundResolver;
  let battle: BattleState;
  let boss: BossController;
  let guardian: GuardianSystem;

  beforeEach(() => {
    battle = new BattleState(100);
    boss = new BossController(1); // Ch.1 boss HP = 10
    guardian = new GuardianSystem();
    resolver = new BeatRoundResolver({ battle, boss, guardian });
  });

  describe('1. 정답 라운드 종료 시 단일 정산', () => {
    it('정답 시 마나 +25, 콤보 +1, 보스 기본 피해 1이 단 한 번 적용된다', () => {
      const res = resolver.resolveRound('correct');

      expect(res.status).toBe('correct');
      expect(res.manaGained).toBe(DEFAULT_CONFIG.mana.correctReward); // 25
      expect(res.damageDealt).toBe(DEFAULT_CONFIG.battle.correctDamage); // 1
      expect(res.damageTaken).toBe(0);
      expect(res.combo).toBe(1);

      expect(battle.mana).toBe(25);
      expect(battle.combo).toBe(1);
      expect(boss.hp).toBe(9); // 10 - 1
    });

    it('4회 연속 정답 시 마나 100 도달하여 수호신 스펠 시전 및 추가 보스 피해 4가 발동한다', () => {
      // 1~3라운드 정답
      for (let i = 1; i <= 3; i++) {
        resolver.startNewRound(i);
        resolver.resolveRound('correct');
      }
      expect(battle.mana).toBe(75);
      expect(battle.combo).toBe(3);
      expect(boss.hp).toBe(7); // 10 - 3

      // 4라운드 정답 -> 마나 100 도달 및 스펠 시전
      resolver.startNewRound(4);
      const res4 = resolver.resolveRound('correct');

      expect(res4.spellCast).toBe(true);
      expect(res4.damageDealt).toBe(1 + 4); // 기본 1 + 스펠 4 = 5
      expect(battle.mana).toBe(0); // 100 소모
      expect(battle.combo).toBe(4);
      expect(boss.hp).toBe(2); // 7 - 5 = 2
      expect(guardian.castCount).toBe(1);
    });
  });

  describe('2. 오답 라운드 종료 시 단일 정산', () => {
    it('오답 시 플레이어 HP -25, 콤보 0 리셋, 보스 반격이 적용된다', () => {
      // 사전 콤보 2 적립
      battle.onCorrect();
      battle.onCorrect();
      expect(battle.combo).toBe(2);

      const res = resolver.resolveRound('wrong');

      expect(res.status).toBe('wrong');
      expect(res.damageTaken).toBe(DEFAULT_CONFIG.player.wrongDamage); // 25
      expect(res.damageDealt).toBe(0);
      expect(res.combo).toBe(0);

      expect(battle.hp).toBe(75);
      expect(battle.combo).toBe(0);
      expect(boss.isAttacking).toBe(true);
      expect(resolver.rhythmStats.wrongAnswerCount).toBe(1);
      expect(resolver.rhythmStats.timeoutCount).toBe(0);
    });
  });

  describe('3. 타임아웃(미응답) 라운드 종료 시 단일 정산 및 오답 구분 통계', () => {
    it('타임아웃은 HP -25와 콤보 리셋을 적용하되, 오답과 분리된 timeoutCount 통계를 남긴다', () => {
      battle.onCorrect();
      expect(battle.combo).toBe(1);

      const res = resolver.resolveRound('timeout');

      expect(res.status).toBe('timeout');
      expect(res.damageTaken).toBe(25);
      expect(res.combo).toBe(0);
      expect(battle.hp).toBe(75);
      expect(battle.combo).toBe(0);

      // 통계 분리 검증 (timeoutCount는 1, wrongAnswerCount는 0)
      expect(resolver.rhythmStats.timeoutCount).toBe(1);
      expect(resolver.rhythmStats.wrongAnswerCount).toBe(0);
    });
  });

  describe('4. 중복 resolve 차단 (Idempotency Guard / 단일 정산 원칙)', () => {
    it('동일 라운드에서 resolveRound를 중복 호출해도 전투 자원이 중복 차감/가산되지 않는다', () => {
      // 첫 번째 resolve
      const first = resolver.resolveRound('correct');
      expect(battle.mana).toBe(25);
      expect(battle.combo).toBe(1);
      expect(boss.hp).toBe(9);

      // 동일 라운드 두 번째 resolve (중복 호출)
      const second = resolver.resolveRound('correct');
      expect(second).toEqual(first);
      expect(battle.mana).toBe(25); // 50으로 증가하지 않음
      expect(battle.combo).toBe(1); // 2로 증가하지 않음
      expect(boss.hp).toBe(9); // 8로 감소하지 않음
    });

    it('오답 시 동일 라운드 중복 호출해도 HP가 두 번 차감되지 않는다', () => {
      resolver.resolveRound('wrong');
      expect(battle.hp).toBe(75);
      expect(resolver.rhythmStats.wrongAnswerCount).toBe(1);

      // 중복 호출
      resolver.resolveRound('wrong');
      expect(battle.hp).toBe(75); // 50으로 감소하지 않음
      expect(resolver.rhythmStats.wrongAnswerCount).toBe(1); // 2로 증가하지 않음
    });

    it('startNewRound 호출 시 다음 라운드 정산이 정상 개방된다', () => {
      resolver.resolveRound('correct');
      expect(battle.mana).toBe(25);

      resolver.startNewRound(2);
      expect(resolver.isRoundSettled).toBe(false);

      resolver.resolveRound('correct');
      expect(battle.mana).toBe(50);
      expect(battle.combo).toBe(2);
    });
  });

  describe('5. 별 및 리듬 통계와 전투 자원의 완전 분리', () => {
    it('별 판정(Perfect, Good, Late, Miss) 누적은 전투 자원(HP/마나/보스HP)을 일체 변경하지 않는다', () => {
      resolver.recordStarRating('Perfect');
      resolver.recordStarRating('Good');
      resolver.recordStarRating('Late');
      resolver.recordStarRating('Miss');

      expect(resolver.rhythmStats.beatStarsCollected).toBe(3); // Perfect(1) + Good(1) + Late(1)
      expect(resolver.rhythmStats.perfectHits).toBe(1);
      expect(resolver.rhythmStats.goodHits).toBe(1);
      expect(resolver.rhythmStats.lateHits).toBe(1);
      expect(resolver.rhythmStats.missedStars).toBe(1);

      // 전투 자원 불변 확인
      expect(battle.hp).toBe(100);
      expect(battle.mana).toBe(0);
      expect(battle.combo).toBe(0);
      expect(boss.hp).toBe(10);
    });

    it('별 성공/실패와 무관하게 정답 시 기본 마나 +25 및 콤보 +1이 보장된다', () => {
      // 별을 모두 Miss했더라도
      resolver.recordStarRating('Miss');
      resolver.recordStarRating('Miss');
      resolver.recordStarRating('Miss');

      // 정답이면 기본 마나 100% 보장
      const res = resolver.resolveRound('correct');
      expect(res.manaGained).toBe(25);
      expect(battle.mana).toBe(25);
      expect(battle.combo).toBe(1);
    });
  });

  describe('6. 회복 스웨이 통계 (recoverySwayCount)', () => {
    it('recoverySway 횟수가 정확히 누적되고 전투 자원에 영향을 주지 않는다', () => {
      resolver.recordRecoverySway();
      resolver.recordRecoverySway(2);

      expect(resolver.rhythmStats.recoverySwayCount).toBe(3);
      expect(battle.hp).toBe(100);
      expect(battle.mana).toBe(0);
    });
  });

  describe('7. 리셋 (reset)', () => {
    it('reset 호출 시 모든 누적 통계와 전투 상태가 초기화된다', () => {
      resolver.recordStarRating('Perfect');
      resolver.recordRecoverySway();
      resolver.resolveRound('correct');

      resolver.reset();

      expect(resolver.rhythmStats.beatStarsCollected).toBe(0);
      expect(resolver.rhythmStats.perfectHits).toBe(0);
      expect(resolver.rhythmStats.recoverySwayCount).toBe(0);
      expect(resolver.isRoundSettled).toBe(false);
      expect(resolver.lastResolveResult).toBeNull();
      expect(battle.mana).toBe(0);
    });
  });

  describe('8. 콜백 및 패배/승리 조건 감지', () => {
    it('보스 격파 시 onBossDefeated 콜백이 트리거된다', () => {
      let bossDefeatedCalled = false;
      const customResolver = new BeatRoundResolver({
        battle,
        boss,
        guardian,
        onBossDefeated: () => {
          bossDefeatedCalled = true;
        },
      });

      // 보스 HP 10 -> 10회 정답
      for (let i = 1; i <= 10; i++) {
        customResolver.startNewRound(i);
        customResolver.resolveRound('correct');
        if (boss.isDefeated) break;
      }

      expect(boss.isDefeated).toBe(true);
      expect(bossDefeatedCalled).toBe(true);
    });

    it('플레이어 HP 소진 시 onPlayerDefeated 콜백이 트리거된다', () => {
      let playerDefeatedCalled = false;
      const customResolver = new BeatRoundResolver({
        battle,
        boss,
        guardian,
        onPlayerDefeated: () => {
          playerDefeatedCalled = true;
        },
      });

      // HP 100 -> 4회 오답 시 0
      for (let i = 1; i <= 4; i++) {
        customResolver.startNewRound(i);
        customResolver.resolveRound('wrong');
      }

      expect(battle.isAlive).toBe(false);
      expect(playerDefeatedCalled).toBe(true);
    });

    it('옵션 미지정 시 기본 인스턴스를 자동 생성하여 동작한다', () => {
      const defaultResolver = new BeatRoundResolver();
      expect(defaultResolver.battle).toBeDefined();
      expect(defaultResolver.boss).toBeDefined();
      expect(defaultResolver.guardian).toBeDefined();

      const res = defaultResolver.resolveRound('correct');
      expect(res.manaGained).toBe(25);
    });
  });

  describe('9. 혼합 라운드 시퀀스 무결성 검증', () => {
    it('정답 -> 오답 -> 타임아웃 -> 정답 연속 진행 시 모든 자원과 통계가 일관성 있게 유지된다', () => {
      // Round 1: Correct
      const r1 = resolver.resolveRound('correct');
      expect(r1.combo).toBe(1);
      expect(battle.mana).toBe(25);
      expect(battle.hp).toBe(100);

      // Round 2: Wrong
      resolver.startNewRound(2);
      const r2 = resolver.resolveRound('wrong');
      expect(r2.combo).toBe(0);
      expect(battle.hp).toBe(75);
      expect(resolver.rhythmStats.wrongAnswerCount).toBe(1);
      expect(resolver.rhythmStats.timeoutCount).toBe(0);

      // Round 3: Timeout
      resolver.startNewRound(3);
      const r3 = resolver.resolveRound('timeout');
      expect(r3.combo).toBe(0);
      expect(battle.hp).toBe(50);
      expect(resolver.rhythmStats.wrongAnswerCount).toBe(1);
      expect(resolver.rhythmStats.timeoutCount).toBe(1);

      // Round 4: Correct
      resolver.startNewRound(4);
      const r4 = resolver.resolveRound('correct');
      expect(r4.combo).toBe(1);
      expect(battle.mana).toBe(50);
      expect(battle.hp).toBe(50);
    });
  });
});
