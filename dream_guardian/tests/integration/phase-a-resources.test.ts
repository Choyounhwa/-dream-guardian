import { describe, it, expect, beforeEach } from 'vitest';
import { BeatRoundResolver } from '../../src/game/BeatRoundResolver.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { GuardianSystem } from '../../src/game/GuardianSystem.js';
import type { PhaseAResourceSnapshot } from '../../src/types/result.js';

describe('Phase A 미니언 및 별가루 자원 모델 통합 테스트 (Issue #242 / GAME-PHASE-A-RESOURCES-001)', () => {
  let battle: BattleState;
  let boss: BossController;
  let guardian: GuardianSystem;
  let resolver: BeatRoundResolver;

  beforeEach(() => {
    battle = new BattleState();
    boss = new BossController(1);
    guardian = new GuardianSystem();
    resolver = new BeatRoundResolver({
      battle,
      boss,
      guardian,
      nonLethalPhaseA: true,
      minBossHp: 1,
      maxPhaseARounds: 10,
    });
  });

  describe('1. 실제 정산(BeatRoundResolver) → 자원 모델(PhaseAResourceManager) 실연결 검증', () => {
    it('정답 정산 시 마나/콤보와 함께 미니언이 +1 증가하고 중복 정산 시 증가하지 않는다', () => {
      expect(resolver.resourceManager.minionCount).toBe(3);
      expect(resolver.resourceManager.guardianCount).toBe(1);

      // 라운드 1 정답 정산
      resolver.startNewRound(1);
      const res1 = resolver.resolveRound('correct', 1);
      expect(res1.manaGained).toBe(25);
      expect(battle.mana).toBe(25);
      expect(battle.combo).toBe(1);
      expect(resolver.resourceManager.minionCount).toBe(4);

      // 동일 라운드 1 중복 정산 호출 시 마나, 콤보, 미니언 모두 중복 가산 0
      resolver.resolveRound('correct', 1);
      expect(battle.mana).toBe(25);
      expect(battle.combo).toBe(1);
      expect(resolver.resourceManager.minionCount).toBe(4);
    });

    it('오답 및 타임아웃 시 미니언 증원은 0이며 기존 군단이 100% 보존된다', () => {
      // 1번 정답 → 4마리
      resolver.startNewRound(1);
      resolver.resolveRound('correct', 1);
      expect(resolver.resourceManager.minionCount).toBe(4);

      // 2번 오답 → 증원 0, 4마리 유지
      resolver.startNewRound(2);
      resolver.resolveRound('wrong', 2);
      expect(resolver.resourceManager.minionCount).toBe(4);

      // 3번 타임아웃 → 증원 0, 4마리 유지
      resolver.startNewRound(3);
      resolver.resolveRound('timeout', 3);
      expect(resolver.resourceManager.minionCount).toBe(4);
      expect(resolver.resourceManager.guardianCount).toBe(1);
    });

    it('10연속 정답 완주 시 미니언은 상한인 13마리(3 + 10)에 정확히 도달한다', () => {
      for (let r = 1; r <= 10; r++) {
        resolver.startNewRound(r);
        resolver.resolveRound('correct', r);
      }
      expect(resolver.isPhaseAComplete).toBe(true);
      expect(resolver.resourceManager.minionCount).toBe(13);
      expect(resolver.resourceManager.isMaxed).toBe(true);
    });
  });

  describe('2. 별가루 노트 판정 수집 및 멱등성 검증', () => {
    it('recordStarRating으로 별가루가 적립되고 중복 noteId는 차단된다', () => {
      // Perfect 2개 (+8)
      resolver.recordStarRating('Perfect', 'star_r1_n1');
      resolver.recordStarRating('Perfect', 'star_r1_n2');
      expect(resolver.resourceManager.stardust).toBe(8);

      // 동일 noteId 중복 이벤트 발생 시 추가 적립 0
      resolver.recordStarRating('Perfect', 'star_r1_n1');
      expect(resolver.resourceManager.stardust).toBe(8);

      // Good (+3), Late (+2), Miss (+0)
      resolver.recordStarRating('Good', 'star_r1_n3');
      resolver.recordStarRating('Late', 'star_r1_n4');
      resolver.recordStarRating('Miss', 'star_r1_n5');
      expect(resolver.resourceManager.stardust).toBe(13);
    });

    it('별 0개(전부 Miss)여도 기본 정답 보상(마나 +25, 콤보 +1, 미니언 +1)은 정상 지급된다', () => {
      resolver.startNewRound(1);
      // 7개 노트 모두 Miss
      for (let i = 1; i <= 7; i++) {
        resolver.recordStarRating('Miss', `star_miss_${i}`);
      }
      expect(resolver.resourceManager.stardust).toBe(0);

      // 정답 정산
      const result = resolver.resolveRound('correct', 1);
      expect(result.manaGained).toBe(25);
      expect(battle.mana).toBe(25);
      expect(battle.combo).toBe(1);
      expect(resolver.resourceManager.minionCount).toBe(4);
    });
  });

  describe('3. 10번째 최종 정산과 Phase B 인계 불변 스냅샷 검증', () => {
    it('10번째 최종 판정이 스냅샷에 포함되고 읽기/인계 준비가 상태 reset을 유발하지 않는다', () => {
      // 7문제 정답, 2문제 오답, 1문제 타임아웃 = 총 10문제 완료
      // 각 정답 라운드마다 4개씩 별 수집 (4 * 7 * Perfect 4 = 112)
      for (let r = 1; r <= 10; r++) {
        resolver.startNewRound(r);
        if (r <= 7) {
          for (let n = 1; n <= 4; n++) {
            resolver.recordStarRating('Perfect', `r${r}_n${n}`);
          }
          resolver.resolveRound('correct', r);
        } else if (r <= 9) {
          resolver.resolveRound('wrong', r);
        } else {
          resolver.resolveRound('timeout', r);
        }
      }

      expect(resolver.isPhaseAComplete).toBe(true);
      expect(resolver.settledRoundCount).toBe(10);

      const snap: PhaseAResourceSnapshot = resolver.getResourceSnapshot();
      expect(snap.isPhaseAComplete).toBe(true);
      expect(snap.totalSettledQuestions).toBe(10);
      expect(snap.correctCount).toBe(7);
      expect(snap.wrongCount).toBe(2);
      expect(snap.timeoutCount).toBe(1);
      expect(snap.minionCount).toBe(10); // 3 + 7 = 10
      expect(snap.guardianCount).toBe(1);
      expect(snap.stardust).toBe(112);
      expect(snap.totalStardustEarned).toBe(112);
      expect(Object.isFrozen(snap)).toBe(true);

      // 스냅샷을 여러 번 읽어도 내부 상태가 변경되거나 리셋되지 않음
      const snap2 = resolver.getResourceSnapshot();
      expect(snap2.minionCount).toBe(10);
      expect(snap2.stardust).toBe(112);
      expect(resolver.resourceManager.minionCount).toBe(10);
      expect(resolver.resourceManager.stardust).toBe(112);
    });

    it('스냅샷 생성 후 소비 API를 통해 잔량 초과/중복 요청 방지를 완비한다', () => {
      resolver.recordStarRating('Perfect', 'n1'); // 4
      resolver.recordStarRating('Perfect', 'n2'); // 4 -> total 8
      resolver.startNewRound(1);
      resolver.resolveRound('correct', 1);

      const rm = resolver.resourceManager;
      expect(rm.stardust).toBe(8);

      // 1) 정상 소비
      expect(rm.consumeStardust(5, 'phase_b_skill_1')).toBe(true);
      expect(rm.stardust).toBe(3);

      // 2) 동일 키 재요청 거부 (중복 차감 차단)
      expect(rm.consumeStardust(5, 'phase_b_skill_1')).toBe(false);
      expect(rm.stardust).toBe(3);

      // 3) 잔량 초과 거부
      expect(rm.consumeStardust(10, 'phase_b_skill_2')).toBe(false);
      expect(rm.stardust).toBe(3);

      // 4) 음수 거부
      expect(rm.consumeStardust(-1)).toBe(false);
      expect(rm.stardust).toBe(3);
    });
  });
});
