import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AssaultSettlement,
  resolveSettlementDamage,
  type PlayerResourceTarget,
  type BossResourceTarget,
} from '../../src/game/assault/AssaultSettlement.js';
import type {
  AssaultSettlementCommand,
  SessionId,
  RoundId,
  AttackId,
} from '../../src/types/assault.js';
import { DEFAULT_ASSAULT_CONFIG } from '../../config/assault.config.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';

describe('AssaultSettlement (BOSS-ASSAULT-16 / Issue #518)', () => {
  const SESSION_A: SessionId = 'session_assault_alpha';
  const SESSION_B: SessionId = 'session_assault_beta';
  const ROUND_1: RoundId = 'round_01';

  let mockPlayer: PlayerResourceTarget;
  let mockBoss: BossResourceTarget;

  beforeEach(() => {
    mockPlayer = {
      hp: 100,
      applyHazardDamage: vi.fn((amount: number = 25) => {
        mockPlayer.hp = Math.max(0, mockPlayer.hp - amount);
      }),
    };

    mockBoss = {
      hp: 10,
      takeDamage: vi.fn((amount: number) => {
        mockBoss.hp = Math.max(0, mockBoss.hp - amount);
      }),
    };
  });

  describe('1. 멱등성(Idempotency) 및 중복 차단', () => {
    it('동일한 (sessionId, attackId, effectType) 키의 중복 명령은 1회만 피해가 적용되고 중복분은 0회여야 한다', () => {
      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        config: { wrongDamage: 25 },
      });

      const cmd: AssaultSettlementCommand = Object.freeze({
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'attack_pair_01' as AttackId,
        target: 'player',
        resultKind: 'miss',
        effectType: 'player_damage',
        idempotencyKey: `${SESSION_A}:attack_pair_01:player_damage`,
      });

      // 1회차: 정상 정산
      const receipt1 = settlement.settle(cmd);
      expect(receipt1.applied).toBe(true);
      expect(receipt1.actualDamage).toBe(25);
      expect(receipt1.newHp).toBe(75);
      expect(mockPlayer.hp).toBe(75);
      expect(mockPlayer.applyHazardDamage).toHaveBeenCalledTimes(1);

      // 2회차 (동일 키 중복 유입): 거부, 추가 피해 0회
      const receipt2 = settlement.settle(cmd);
      expect(receipt2.applied).toBe(false);
      expect(receipt2.actualDamage).toBe(0);
      expect(receipt2.rejectionReason).toBe('duplicate');
      expect(receipt2.newHp).toBe(75);
      expect(mockPlayer.hp).toBe(75);
      expect(mockPlayer.applyHazardDamage).toHaveBeenCalledTimes(1);

      // 3회차 재유입 역시 거부
      const receipt3 = settlement.settle(cmd);
      expect(receipt3.applied).toBe(false);
      expect(receipt3.actualDamage).toBe(0);
      expect(mockPlayer.hp).toBe(75);
      expect(mockPlayer.applyHazardDamage).toHaveBeenCalledTimes(1);
    });

    it('동일 attackId라도 effectType이 다르면 각각 1회씩 독립적으로 정산되어야 한다', () => {
      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        config: { wrongDamage: 25 },
      });

      const cmd1: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'attack_01' as AttackId,
        target: 'player',
        resultKind: 'miss',
        effectType: 'player_damage',
        idempotencyKey: `${SESSION_A}:attack_01:player_damage`,
      };

      const cmd2: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'attack_01' as AttackId,
        target: 'player',
        resultKind: 'evaded',
        effectType: 'evade_success',
        idempotencyKey: `${SESSION_A}:attack_01:evade_success`,
      };

      const receipt1 = settlement.settle(cmd1);
      const receipt2 = settlement.settle(cmd2);

      expect(receipt1.applied).toBe(true);
      expect(receipt1.actualDamage).toBe(25);
      expect(receipt2.applied).toBe(true);
      expect(receipt2.actualDamage).toBe(0);
      expect(settlement.hasSettled(cmd1.idempotencyKey)).toBe(true);
      expect(settlement.hasSettled(cmd2.idempotencyKey)).toBe(true);
    });
  });

  describe('2. 활성 세션(activeSessionId) 검증 및 Stale 세션 차단', () => {
    it('현재 활성 세션과 다른 stale 세션의 정산 명령은 거부되어야 한다', () => {
      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        config: { wrongDamage: 25 },
      });

      const staleCmd: AssaultSettlementCommand = {
        sessionId: SESSION_B, // Stale!
        roundId: ROUND_1,
        attackId: 'attack_stale_01' as AttackId,
        target: 'player',
        resultKind: 'miss',
        effectType: 'player_damage',
        idempotencyKey: `${SESSION_B}:attack_stale_01:player_damage`,
      };

      const receipt = settlement.settle(staleCmd);
      expect(receipt.applied).toBe(false);
      expect(receipt.rejectionReason).toBe('stale_session');
      expect(receipt.actualDamage).toBe(0);
      expect(mockPlayer.hp).toBe(100);
      expect(mockPlayer.applyHazardDamage).not.toHaveBeenCalled();
      expect(settlement.hasSettled(staleCmd.idempotencyKey)).toBe(false);
    });

    it('setActiveSession으로 세션을 갱신하면 신규 세션의 명령이 정상 수용되어야 한다', () => {
      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        config: { wrongDamage: 25 },
      });

      settlement.setActiveSession(SESSION_B);

      const cmdB: AssaultSettlementCommand = {
        sessionId: SESSION_B,
        roundId: ROUND_1,
        attackId: 'attack_new_01' as AttackId,
        target: 'player',
        resultKind: 'miss',
        effectType: 'player_damage',
        idempotencyKey: `${SESSION_B}:attack_new_01:player_damage`,
      };

      const receipt = settlement.settle(cmdB);
      expect(receipt.applied).toBe(true);
      expect(receipt.actualDamage).toBe(25);
      expect(mockPlayer.hp).toBe(75);
    });
  });

  describe('3. 수치 해석 (Balance Config 해석)', () => {
    it('오답 명령(pair miss 또는 wrong_damage)은 config.wrongDamage를 적용해야 한다', () => {
      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        config: { wrongDamage: 25 },
      });

      const cmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'attack_pair_01' as AttackId,
        target: 'player',
        resultKind: 'miss',
        effectType: 'player_damage',
        idempotencyKey: 'k1',
      };

      const receipt = settlement.settle(cmd);
      expect(receipt.requestedDamage).toBe(25);
      expect(receipt.actualDamage).toBe(25);
      expect(mockPlayer.hp).toBe(75);
    });

    it('타임아웃 명령(timeout)은 config.missDamage를 적용해야 한다', () => {
      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        config: { missDamage: 20 },
      });

      const cmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'attack_pair_02' as AttackId,
        target: 'player',
        resultKind: 'timeout',
        effectType: 'player_damage',
        idempotencyKey: 'k2',
      };

      const receipt = settlement.settle(cmd);
      expect(receipt.requestedDamage).toBe(20);
      expect(receipt.actualDamage).toBe(20);
      expect(mockPlayer.hp).toBe(80);
    });

    it('스쿼트 실패 명령(squat_fail 또는 squat attackId miss)은 config.squatFailDamage를 적용해야 한다', () => {
      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        config: { squatFailDamage: 15 },
      });

      const cmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'attack_squat_01' as AttackId,
        target: 'player',
        resultKind: 'miss',
        effectType: 'player_damage',
        idempotencyKey: 'k3',
      };

      const receipt = settlement.settle(cmd);
      expect(receipt.requestedDamage).toBe(15);
      expect(receipt.actualDamage).toBe(15);
      expect(mockPlayer.hp).toBe(85);
    });

    it('정답 무효화(boss_negate) 및 회피 성공(evade_success)은 플레이어 피해가 0이어야 한다', () => {
      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        bossController: mockBoss,
      });

      const negateCmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'attack_pair_03' as AttackId,
        target: 'boss',
        resultKind: 'hit',
        effectType: 'boss_negate',
        idempotencyKey: 'k_negate',
      };

      const receiptNegate = settlement.settle(negateCmd);
      expect(receiptNegate.requestedDamage).toBe(0);
      expect(receiptNegate.actualDamage).toBe(0);
      expect(receiptNegate.applied).toBe(true);
      expect(mockPlayer.hp).toBe(100);
      expect(mockPlayer.applyHazardDamage).not.toHaveBeenCalled();

      const evadeCmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'attack_squat_02' as AttackId,
        target: 'player',
        resultKind: 'evaded',
        effectType: 'evade_success',
        idempotencyKey: 'k_evade',
      };

      const receiptEvade = settlement.settle(evadeCmd);
      expect(receiptEvade.requestedDamage).toBe(0);
      expect(receiptEvade.actualDamage).toBe(0);
      expect(receiptEvade.applied).toBe(true);
      expect(mockPlayer.hp).toBe(100);
    });

    it('명시적 effectType wrong_damage 및 squat_fail 처리', () => {
      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        config: { wrongDamage: 25, squatFailDamage: 15 },
      });

      const wrongCmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'generic_atk_01' as AttackId,
        target: 'player',
        resultKind: 'miss',
        effectType: 'wrong_damage' as any,
        idempotencyKey: 'k_wd',
      };
      const receiptWrong = settlement.settle(wrongCmd);
      expect(receiptWrong.requestedDamage).toBe(25);
      expect(receiptWrong.actualDamage).toBe(25);

      const squatFailCmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'generic_atk_02' as AttackId,
        target: 'player',
        resultKind: 'miss',
        effectType: 'squat_fail' as any,
        idempotencyKey: 'k_sf',
      };
      const receiptSquat = settlement.settle(squatFailCmd);
      expect(receiptSquat.requestedDamage).toBe(15);
      expect(receiptSquat.actualDamage).toBe(15);
    });

    it('encounterKind 필드가 squat일 때 attackId에 squat가 없어도 squatFailDamage를 적용해야 한다', () => {
      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        config: { wrongDamage: 25, squatFailDamage: 15 },
      });

      const squatEncounterCmd = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'custom_motion_01' as AttackId,
        encounterKind: 'squat',
        target: 'player' as const,
        resultKind: 'miss' as const,
        effectType: 'player_damage' as const,
        idempotencyKey: 'k_enc_squat',
      };

      const receipt = settlement.settle(squatEncounterCmd as any);
      expect(receipt.requestedDamage).toBe(15);
      expect(receipt.actualDamage).toBe(15);
    });

    it('idempotencyKey가 명시되지 않아도 (sessionId:attackId:effectType) 키로 자동 fallback 처리되어야 한다', () => {
      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        config: { wrongDamage: 25 },
      });

      const cmdWithoutKey = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'atk_auto_01' as AttackId,
        target: 'player' as const,
        resultKind: 'miss' as const,
        effectType: 'player_damage' as const,
        idempotencyKey: '',
      };

      const r1 = settlement.settle(cmdWithoutKey);
      expect(r1.applied).toBe(true);
      expect(r1.idempotencyKey).toBe(`${SESSION_A}:atk_auto_01:player_damage`);

      // 동일 조건 2회차 유입 시 자동 생성된 키로 중복 차단
      const r2 = settlement.settle(cmdWithoutKey);
      expect(r2.applied).toBe(false);
      expect(r2.rejectionReason).toBe('duplicate');
      expect(mockPlayer.applyHazardDamage).toHaveBeenCalledTimes(1);
    });

    it('보스 컨트롤러가 없는 상태에서 보스 정산 요청 시 invalid_command로 거부되어야 한다', () => {
      const settlementWithoutBoss = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
      });

      const bossCmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'atk_boss_99' as AttackId,
        target: 'boss',
        resultKind: 'hit',
        effectType: 'boss_damage' as any,
        idempotencyKey: 'k_no_boss',
      };

      const receipt = settlementWithoutBoss.settle(bossCmd);
      expect(receipt.applied).toBe(false);
      expect(receipt.rejectionReason).toBe('invalid_command');
    });

    it('설정을 지정하지 않으면 DEFAULT_ASSAULT_CONFIG의 기본값을 사용해야 한다', () => {
      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
      });

      const cmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'attack_pair_def' as AttackId,
        target: 'player',
        resultKind: 'miss',
        effectType: 'player_damage',
        idempotencyKey: 'k_def',
      };

      const receipt = settlement.settle(cmd);
      expect(receipt.requestedDamage).toBe(DEFAULT_ASSAULT_CONFIG.wrongDamage);
      expect(receipt.actualDamage).toBe(DEFAULT_ASSAULT_CONFIG.wrongDamage);
      expect(mockPlayer.hp).toBe(100 - DEFAULT_ASSAULT_CONFIG.wrongDamage);
    });
  });

  describe('4. 실제 HP 경계 및 잔속 피해량 영수증 기록', () => {
    it('잔여 HP보다 큰 피해 발생 시 실제 감소된 양만 actualDamage에 기록되어야 한다 (예: HP 10에서 25 피해 시 actualDamage: 10, newHp: 0)', () => {
      mockPlayer.hp = 10;
      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        config: { wrongDamage: 25 },
      });

      const cmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'attack_fatal' as AttackId,
        target: 'player',
        resultKind: 'miss',
        effectType: 'player_damage',
        idempotencyKey: 'k_fatal',
      };

      const receipt = settlement.settle(cmd);
      expect(receipt.requestedDamage).toBe(25);
      expect(receipt.actualDamage).toBe(10);
      expect(receipt.oldHp).toBe(10);
      expect(receipt.previousHp).toBe(10);
      expect(receipt.newHp).toBe(0);
      expect(receipt.currentHp).toBe(0);
      expect(receipt.applied).toBe(true);
      expect(mockPlayer.hp).toBe(0);
    });

    it('이미 HP가 0일 때 피해 발생 시 actualDamage는 0이어야 한다', () => {
      mockPlayer.hp = 0;
      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        config: { wrongDamage: 25 },
      });

      const cmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'attack_zero' as AttackId,
        target: 'player',
        resultKind: 'miss',
        effectType: 'player_damage',
        idempotencyKey: 'k_zero',
      };

      const receipt = settlement.settle(cmd);
      expect(receipt.requestedDamage).toBe(25);
      expect(receipt.actualDamage).toBe(0);
      expect(receipt.oldHp).toBe(0);
      expect(receipt.newHp).toBe(0);
      expect(receipt.applied).toBe(true);
      expect(mockPlayer.hp).toBe(0);
    });
  });

  describe('5. 실제 BattleState / BossController 클래스와의 연동 및 자원 격리', () => {
    it('BattleState 실제 인스턴스 연동 시 correctCount, mana, combo가 불변이어야 한다', () => {
      const realBattleState = new BattleState();
      // 기존 점수/마나 설정
      realBattleState.onCorrect();
      expect(realBattleState.mana).toBe(25);
      expect(realBattleState.combo).toBe(1);
      expect(realBattleState.correctCount).toBe(1);

      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: realBattleState,
        config: { wrongDamage: 25 },
      });

      const cmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'attack_01' as AttackId,
        target: 'player',
        resultKind: 'miss',
        effectType: 'player_damage',
        idempotencyKey: 'k_bs',
      };

      const receipt = settlement.settle(cmd);

      // HP만 25 차감
      expect(receipt.actualDamage).toBe(25);
      expect(realBattleState.hp).toBe(75);

      // 자원 격리 검증: mana, combo, correctCount는 절대 변경되지 않아야 함
      expect(realBattleState.mana).toBe(25);
      expect(realBattleState.combo).toBe(1);
      expect(realBattleState.correctCount).toBe(1);
    });

    it('보스 대상 피해 정산 시 BossController.takeDamage가 호출되어야 한다', () => {
      const realBoss = new BossController(1);
      const initialHp = realBoss.hp;

      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        bossController: realBoss,
      });

      const bossDamageCmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'attack_boss_hit' as AttackId,
        target: 'boss',
        resultKind: 'hit',
        effectType: 'boss_damage' as any,
        idempotencyKey: 'k_boss_dmg',
      };

      const receipt = settlement.settle(bossDamageCmd, { wrongDamage: 25, squatFailDamage: 15, missDamage: 25, bossDamage: 4 } as any);
      expect(receipt.applied).toBe(true);
      expect(receipt.actualDamage).toBe(4);
      expect(realBoss.hp).toBe(initialHp - 4);
    });
  });

  describe('6. 불변성 및 동결 객체 처리', () => {
    it('동결된 command 및 config가 주입되어도 안전하게 동작하고 receipt는 동결되어야 한다', () => {
      const frozenConfig = Object.freeze({
        wrongDamage: 25,
        squatFailDamage: 15,
        missDamage: 25,
      });

      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        config: frozenConfig,
      });

      const frozenCmd: AssaultSettlementCommand = Object.freeze({
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'frozen_atk_01' as AttackId,
        target: 'player',
        resultKind: 'miss',
        effectType: 'player_damage',
        idempotencyKey: 'frozen_k1',
      });

      const receipt = settlement.settle(frozenCmd);
      expect(Object.isFrozen(receipt)).toBe(true);
      expect(receipt.actualDamage).toBe(25);
    });
  });

  describe('7. settleBatch 및 상태 조회 / 초기화', () => {
    it('여러 명령을 순차 배치 정산할 수 있어야 한다', () => {
      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        config: { wrongDamage: 25, squatFailDamage: 15 },
      });

      const commands: AssaultSettlementCommand[] = [
        {
          sessionId: SESSION_A,
          roundId: ROUND_1,
          attackId: 'cmd_01' as AttackId,
          target: 'player',
          resultKind: 'miss',
          effectType: 'player_damage',
          idempotencyKey: 'b1',
        },
        {
          sessionId: SESSION_A,
          roundId: ROUND_1,
          attackId: 'cmd_01' as AttackId, // 중복
          target: 'player',
          resultKind: 'miss',
          effectType: 'player_damage',
          idempotencyKey: 'b1',
        },
        {
          sessionId: SESSION_A,
          roundId: ROUND_1,
          attackId: 'cmd_squat_02' as AttackId,
          target: 'player',
          resultKind: 'miss',
          effectType: 'player_damage',
          idempotencyKey: 'b2',
        },
      ];

      const receipts = settlement.settleBatch(commands);
      expect(receipts.length).toBe(3);
      expect(receipts[0].applied).toBe(true);
      expect(receipts[0].actualDamage).toBe(25);

      expect(receipts[1].applied).toBe(false);
      expect(receipts[1].actualDamage).toBe(0);

      expect(receipts[2].applied).toBe(true);
      expect(receipts[2].actualDamage).toBe(15);

      expect(mockPlayer.hp).toBe(60); // 100 - 25 - 15 = 60
    });

    it('reset 호출 시 정산 이력이 초기화되어야 한다', () => {
      const settlement = new AssaultSettlement({
        activeSessionId: SESSION_A,
        battleState: mockPlayer,
        config: { wrongDamage: 25 },
      });

      const cmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'rst_atk_01' as AttackId,
        target: 'player',
        resultKind: 'miss',
        effectType: 'player_damage',
        idempotencyKey: 'rst_k1',
      };

      settlement.settle(cmd);
      expect(settlement.hasSettled('rst_k1')).toBe(true);

      settlement.reset();
      expect(settlement.hasSettled('rst_k1')).toBe(false);
      expect(settlement.getReceipts().length).toBe(0);
    });

    it('resolveSettlementDamage 순수 함수 단독 호출 검증', () => {
      const customConfig = {
        wrongDamage: 30,
        squatFailDamage: 12,
        missDamage: 18,
      };

      const wrongCmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'atk_p' as AttackId,
        target: 'player',
        resultKind: 'miss',
        effectType: 'player_damage',
        idempotencyKey: 'k',
      };
      expect(resolveSettlementDamage(wrongCmd, customConfig)).toBe(30);

      const timeoutCmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'atk_t' as AttackId,
        target: 'player',
        resultKind: 'timeout',
        effectType: 'player_damage',
        idempotencyKey: 'k',
      };
      expect(resolveSettlementDamage(timeoutCmd, customConfig)).toBe(18);

      const squatCmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'attack_squat_99' as AttackId,
        target: 'player',
        resultKind: 'miss',
        effectType: 'player_damage',
        idempotencyKey: 'k',
      };
      expect(resolveSettlementDamage(squatCmd, customConfig)).toBe(12);

      const zeroCmd: AssaultSettlementCommand = {
        sessionId: SESSION_A,
        roundId: ROUND_1,
        attackId: 'atk_z' as AttackId,
        target: 'boss',
        resultKind: 'hit',
        effectType: 'boss_negate',
        idempotencyKey: 'k',
      };
      expect(resolveSettlementDamage(zeroCmd, customConfig)).toBe(0);
    });
  });
});
