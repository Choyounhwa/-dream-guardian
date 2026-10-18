import { describe, it, expect } from 'vitest';
import {
  AssaultFinaleController,
  type AssaultFinaleHandoffSnapshot,
  type AssaultFinaleSnapshot,
} from '../../src/game/assault/AssaultFinaleController.js';
import { DEFAULT_FINALE_PATTERN } from '../../src/data/assault/finalePatterns.js';
import { DEFAULT_ASSAULT_FINALE_CONFIG } from '../../config/assault-finale.config.js';
import type { AssaultSettlementReceipt } from '../../src/game/assault/AssaultSettlement.js';

describe('[BOSS-ASSAULT-29 / #531] 근접 결전 컨트롤러 (AssaultFinaleController)', () => {
  const createStandardHandoff = (
    overrides?: Partial<AssaultFinaleHandoffSnapshot>
  ): AssaultFinaleHandoffSnapshot => ({
    sessionId: 'session_finale_001',
    playerHp: 100,
    bossHp: 20,
    rulesVersion: 'v0.3',
    timingProfileId: 'assault_finale_v1',
    ...overrides,
  });

  describe('1. 초기화 및 스냅샷 기본 상태 검증', () => {
    it('인계 스냅샷과 DEFAULT_FINALE_PATTERN으로 초기화 시 ready 상태여야 한다', () => {
      const handoff = createStandardHandoff();
      const controller = new AssaultFinaleController(handoff, DEFAULT_FINALE_PATTERN);
      const snapshot: AssaultFinaleSnapshot = controller.getSnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot.sessionId).toBe('session_finale_001');
      expect(snapshot.phase).toBe('ready');
      expect(snapshot.playerHp).toBe(100);
      expect(snapshot.bossHp).toBe(20);
      expect(snapshot.totalEncounters).toBe(5);
      expect(snapshot.currentEncounterIndex).toBe(0);
      expect(snapshot.isVictory).toBe(false);
      expect(snapshot.isDefeat).toBe(false);
      expect(snapshot.rushHitCount).toBe(0);
      expect(snapshot.pendingCommandCount).toBe(0);
    });

    it('인계 시점에 이미 플레이어 HP가 0 이하이면 즉시 defeat 상태여야 한다', () => {
      const handoff = createStandardHandoff({ playerHp: 0 });
      const controller = new AssaultFinaleController(handoff);
      const snapshot = controller.getSnapshot();

      expect(snapshot.phase).toBe('defeat');
      expect(snapshot.isDefeat).toBe(true);
      expect(snapshot.isVictory).toBe(false);
    });

    it('인계 시점에 이미 보스 HP가 0 이하이고 플레이어는 생존해 있으면 victory 상태여야 한다', () => {
      const handoff = createStandardHandoff({ bossHp: 0 });
      const controller = new AssaultFinaleController(handoff);
      const snapshot = controller.getSnapshot();

      expect(snapshot.phase).toBe('victory');
      expect(snapshot.isVictory).toBe(true);
      expect(snapshot.isDefeat).toBe(false);
    });
  });

  describe('2. 조우 시간순 진행 및 판정창 경계 (예고/창/복귀) 검증', () => {
    it('첫 update 호출 시 active 또는 encounter 상태로 진입해야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff());
      const snapshot = controller.update(0, 0);

      expect(['active', 'encounter']).toContain(snapshot.phase);
      expect(snapshot.currentEncounterIndex).toBe(0);
      expect(snapshot.currentEncounter?.id).toBe('enc_finale_punch_1');
    });

    it('약점 펀치 판정창 전(예고 단계) 입력은 거부되어야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff());
      // 120 BPM 기준 1박 = 0.5초. punch 예고 2박 = 1.0초. activeSeconds 0.5초는 예고 단계
      controller.update(500, 0.5);
      const res = controller.handlePunch({
        hand: 'left',
        timestampMs: 500,
        activeSeconds: 0.5,
      });

      expect(res.accepted).toBe(false);
      expect(res.reason).toBe('BEFORE_WINDOW');
      expect(controller.getPendingSettlementCommands()).toHaveLength(0);
    });

    it('약점 펀치 판정창 내(window) 입력은 성공 판정되고 정산 명령이 발행되어야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff());
      // activeSeconds 1.5초는 펀치 유효창 (1.0초 ~ 2.0초)
      controller.update(1500, 1.5);
      const res = controller.handlePunch({
        hand: 'left',
        timestampMs: 1500,
        activeSeconds: 1.5,
      });

      expect(res.accepted).toBe(true);
      expect(res.reason).toBe('SUCCESS');

      const commands = controller.getPendingSettlementCommands();
      expect(commands).toHaveLength(1);
      expect(commands[0].target).toBe('boss');
      expect(commands[0].resultKind).toBe('hit');
      expect(commands[0].attackId).toBe('enc_finale_punch_1');
      expect((commands[0] as any).damage).toBe(DEFAULT_ASSAULT_FINALE_CONFIG.punchDamage);
    });

    it('조우 판정창 종료 후(복귀 단계) 입력은 거부되어야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff());
      // 큰 빈틈 연타(rush): 10.0초 ~ 14.0초, 유효창 10.5초 ~ 12.5초, 복귀 단계 12.5초 ~ 14.0초
      // 13.0초는 rush 조우 내부의 복귀 단계 (창 마감 후)
      controller.update(13000, 13.0);
      const res = controller.handlePunch({
        hand: 'left',
        timestampMs: 13000,
        activeSeconds: 13.0,
      });

      expect(res.accepted).toBe(false);
      expect(res.reason).toBe('AFTER_WINDOW');
    });

    it('스쿼트 조우 중 펀치 입력 등 잘못된 동작 종류는 거부되어야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff());
      // 스쿼트 조우: startBeat 4(2.0초) ~ 10(5.0초). 유효창 3.0초 ~ 5.0초
      controller.update(3500, 3.5);
      expect(controller.getSnapshot().currentEncounter?.kind).toBe('squat');

      const punchRes = controller.handlePunch({
        hand: 'left',
        timestampMs: 3500,
        activeSeconds: 3.5,
      });
      expect(punchRes.accepted).toBe(false);
      expect(punchRes.reason).toBe('MISMATCHED_MOTION_KIND');
    });
  });

  describe('3. 조우 성공/실패에 따른 정산 명령 발행 검증', () => {
    it('스쿼트 유효창에서 회피 성공 시 evade_success 명령이 발행되어야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff());
      controller.update(3500, 3.5); // 스쿼트 창 안

      const res = controller.handleSquat({
        isDucking: true,
        posture: 'squatting',
        timestampMs: 3500,
        activeSeconds: 3.5,
      });

      expect(res.accepted).toBe(true);
      expect(res.reason).toBe('SUCCESS');

      const commands = controller.getPendingSettlementCommands();
      const squatCmd = commands.find((c) => c.attackId === 'enc_finale_squat_1');
      expect(squatCmd).toBeDefined();
      expect(squatCmd?.target).toBe('player');
      expect(squatCmd?.resultKind).toBe('evaded');
      expect(squatCmd?.effectType).toBe('evade_success');
    });

    it('스쿼트 유효창 마감까지 회피하지 않으면 플레이어 피격 명령이 발행되어야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff());
      // 스쿼트 미수행 상태로 창 종료(5.0초) 통과
      controller.update(5100, 5.1);

      const commands = controller.getPendingSettlementCommands();
      const squatFailCmd = commands.find((c) => c.attackId === 'enc_finale_squat_1');
      expect(squatFailCmd).toBeDefined();
      expect(squatFailCmd?.target).toBe('player');
      expect(squatFailCmd?.resultKind).toBe('miss');
      expect(squatFailCmd?.effectType).toBe('player_damage');
      expect((squatFailCmd as any).damage).toBe(DEFAULT_ASSAULT_FINALE_CONFIG.bossAttackDamage);
    });

    it('점프 유효창에서 점프 회피 성공 시 evade_success 명령이 발행되어야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff());
      // 점프 조우: 14박(7.0초) ~ 20박(10.0초). 유효창 8.0초 ~ 9.5초
      controller.update(8500, 8.5);
      expect(controller.getSnapshot().currentEncounter?.kind).toBe('jump');

      const res = controller.handleJump({
        isJumping: true,
        posture: 'jumping',
        timestampMs: 8500,
        activeSeconds: 8.5,
      });

      expect(res.accepted).toBe(true);
      const jumpCmd = controller.getPendingSettlementCommands().find((c) => c.attackId === 'enc_finale_jump_1');
      expect(jumpCmd?.target).toBe('player');
      expect(jumpCmd?.resultKind).toBe('evaded');
    });

    it('저충격(heel_raise) 대체 동작으로도 점프 회피가 성공해야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff());
      controller.update(8500, 8.5);

      const res = controller.handleJump({
        isLowImpact: true,
        timestampMs: 8500,
        activeSeconds: 8.5,
      });

      expect(res.accepted).toBe(true);
      const jumpCmd = controller.getPendingSettlementCommands().find((c) => c.attackId === 'enc_finale_jump_1');
      expect(jumpCmd?.resultKind).toBe('evaded');
    });

    it('점프 유효창 마감까지 회피하지 않으면 플레이어 피해 명령이 발행되어야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff());
      // 점프 미수행 상태로 마감(9.6초) 통과
      controller.update(9600, 9.6);

      const jumpFailCmd = controller.getPendingSettlementCommands().find((c) => c.attackId === 'enc_finale_jump_1');
      expect(jumpFailCmd).toBeDefined();
      expect(jumpFailCmd?.target).toBe('player');
      expect(jumpFailCmd?.resultKind).toBe('miss');
      expect(jumpFailCmd?.effectType).toBe('player_damage');
      expect((jumpFailCmd as any).damage).toBe(DEFAULT_ASSAULT_FINALE_CONFIG.hazardDamage);
    });

    it('큰 빈틈 연타(rush) 조우에서 여러 번 타격 시 각각 정산 명령이 발행되어야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff());
      // 연타 조우: startBeat 20(10.0초) ~ 28(14.0초). 유효창 10.5초 ~ 12.5초
      controller.update(11000, 11.0);
      expect(controller.getSnapshot().currentEncounter?.id).toBe('enc_finale_rush_1');

      const hit1 = controller.handlePunch({ hand: 'left', timestampMs: 11000, activeSeconds: 11.0 });
      const hit2 = controller.handlePunch({ hand: 'right', timestampMs: 11200, activeSeconds: 11.2 });
      const hit3 = controller.handlePunch({ hand: 'left', timestampMs: 11400, activeSeconds: 11.4 });

      expect(hit1.accepted).toBe(true);
      expect(hit2.accepted).toBe(true);
      expect(hit3.accepted).toBe(true);
      expect(controller.getSnapshot().rushHitCount).toBe(3);

      const rushCommands = controller
        .getPendingSettlementCommands()
        .filter((c) => c.attackId.startsWith('enc_finale_rush_1'));
      expect(rushCommands).toHaveLength(3);
      rushCommands.forEach((cmd) => {
        expect(cmd.target).toBe('boss');
        expect(cmd.resultKind).toBe('hit');
        expect((cmd as any).damage).toBe(DEFAULT_ASSAULT_FINALE_CONFIG.punchDamage);
      });
    });
  });

  describe('4. 멱등성 및 중복 방지 검증', () => {
    it('단일 펀치 조우에서 동일 창 내 중복 입력 시 추가 정산 명령이 발행되지 않아야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff());
      controller.update(1500, 1.5);

      const firstHit = controller.handlePunch({ hand: 'left', timestampMs: 1500, activeSeconds: 1.5 });
      expect(firstHit.accepted).toBe(true);

      const secondHit = controller.handlePunch({ hand: 'right', timestampMs: 1600, activeSeconds: 1.6 });
      expect(secondHit.accepted).toBe(false);
      expect(secondHit.reason).toBe('ALREADY_HIT');

      const commands = controller
        .getPendingSettlementCommands()
        .filter((c) => c.attackId === 'enc_finale_punch_1');
      expect(commands).toHaveLength(1);
    });

    it('스쿼트 이미 성공 후 추가 스쿼트 입력 시 중복 명령이 발행되지 않아야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff());
      controller.update(3500, 3.5);

      const firstSquat = controller.handleSquat({ isDucking: true, timestampMs: 3500, activeSeconds: 3.5 });
      expect(firstSquat.accepted).toBe(true);

      const secondSquat = controller.handleSquat({ isDucking: true, timestampMs: 3600, activeSeconds: 3.6 });
      expect(secondSquat.accepted).toBe(false);
      expect(secondSquat.reason).toBe('ALREADY_RESOLVED');

      const squatCommands = controller
        .getPendingSettlementCommands()
        .filter((c) => c.attackId === 'enc_finale_squat_1');
      expect(squatCommands).toHaveLength(1);
    });

    it('타임아웃으로 실패한 조우에 대해 이후 update가 중복 피해 명령을 발행하지 않아야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff());
      controller.update(5100, 5.1); // 스쿼트 만료
      const countAfterFirst = controller.getPendingSettlementCommands().length;

      controller.update(5200, 5.2);
      controller.update(5300, 5.3);
      const countAfterRepeated = controller.getPendingSettlementCommands().length;

      expect(countAfterRepeated).toBe(countAfterFirst);
    });

    it('동일한 영수증(receipt)을 중복 적용해도 체력이 중복 차감되지 않아야 한다 (Idempotent Receipt)', () => {
      const controller = new AssaultFinaleController(createStandardHandoff());
      const receipt: AssaultSettlementReceipt = {
        receiptId: 'rcpt_001',
        sessionId: 'session_finale_001',
        roundId: 'round_finale',
        attackId: 'enc_finale_punch_1',
        target: 'boss',
        effectType: 'boss_damage',
        resultKind: 'hit',
        idempotencyKey: 'session_finale_001:enc_finale_punch_1:boss_damage',
        requestedDamage: 2,
        actualDamage: 2,
        oldHp: 20,
        previousHp: 20,
        newHp: 18,
        currentHp: 18,
        applied: true,
      };

      controller.applySettlementReceipt(receipt);
      expect(controller.getSnapshot().bossHp).toBe(18);

      // 동일 영수증 재적용
      controller.applySettlementReceipt(receipt);
      expect(controller.getSnapshot().bossHp).toBe(18);
    });
  });

  describe('5. 승리(victory) 및 패배(defeat) 전이 검증', () => {
    it('영수증을 통해 보스 HP가 0 이하가 되면 victory 상태로 전이되어야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff({ bossHp: 2 }));
      const receipt: AssaultSettlementReceipt = {
        receiptId: 'rcpt_victory',
        sessionId: 'session_finale_001',
        roundId: 'round_finale',
        attackId: 'enc_finale_punch_1',
        target: 'boss',
        effectType: 'boss_damage',
        resultKind: 'hit',
        idempotencyKey: 'session_finale_001:enc_finale_punch_1:boss_damage',
        requestedDamage: 2,
        actualDamage: 2,
        oldHp: 2,
        previousHp: 2,
        newHp: 0,
        currentHp: 0,
        applied: true,
      };

      controller.applySettlementReceipt(receipt);
      const snapshot = controller.getSnapshot();

      expect(snapshot.bossHp).toBe(0);
      expect(snapshot.phase).toBe('victory');
      expect(snapshot.isVictory).toBe(true);
      expect(snapshot.isDefeat).toBe(false);

      // 승리 후 추가 입력은 거부되어야 함
      const postPunch = controller.handlePunch({ hand: 'left', timestampMs: 2000, activeSeconds: 2.0 });
      expect(postPunch.accepted).toBe(false);
      expect(postPunch.reason).toBe('GAME_OVER');
    });

    it('영수증을 통해 플레이어 HP가 0 이하가 되면 defeat 상태로 전이되어야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff({ playerHp: 10 }));
      const receipt: AssaultSettlementReceipt = {
        receiptId: 'rcpt_defeat',
        sessionId: 'session_finale_001',
        roundId: 'round_finale',
        attackId: 'enc_finale_squat_1',
        target: 'player',
        effectType: 'player_damage',
        resultKind: 'miss',
        idempotencyKey: 'session_finale_001:enc_finale_squat_1:player_damage',
        requestedDamage: 10,
        actualDamage: 10,
        oldHp: 10,
        previousHp: 10,
        newHp: 0,
        currentHp: 0,
        applied: true,
      };

      controller.applySettlementReceipt(receipt);
      const snapshot = controller.getSnapshot();

      expect(snapshot.playerHp).toBe(0);
      expect(snapshot.phase).toBe('defeat');
      expect(snapshot.isDefeat).toBe(true);
      expect(snapshot.isVictory).toBe(false);

      // 패배 후 추가 입력 거부
      const postPunch = controller.handlePunch({ hand: 'left', timestampMs: 5000, activeSeconds: 5.0 });
      expect(postPunch.accepted).toBe(false);
      expect(postPunch.reason).toBe('GAME_OVER');
    });

    it('동일 시점에 플레이어 HP 0과 보스 HP 0이 동시에 발생하면 플레이어 사망(defeat)이 우선되어야 한다 (A14, A22)', () => {
      // 플레이어 HP 10, 보스 HP 2인 상태에서 두 영수증이 동시에 적용되는 상황
      const controller = new AssaultFinaleController(createStandardHandoff({ playerHp: 10, bossHp: 2 }));

      const bossKillReceipt: AssaultSettlementReceipt = {
        receiptId: 'rcpt_boss_dead',
        sessionId: 'session_finale_001',
        roundId: 'round_finale',
        attackId: 'enc_finale_punch_1',
        target: 'boss',
        effectType: 'boss_damage',
        resultKind: 'hit',
        idempotencyKey: 'session_finale_001:enc_finale_punch_1:boss_damage',
        requestedDamage: 2,
        actualDamage: 2,
        oldHp: 2,
        previousHp: 2,
        newHp: 0,
        currentHp: 0,
        applied: true,
      };

      const playerKillReceipt: AssaultSettlementReceipt = {
        receiptId: 'rcpt_player_dead',
        sessionId: 'session_finale_001',
        roundId: 'round_finale',
        attackId: 'enc_finale_squat_1',
        target: 'player',
        effectType: 'player_damage',
        resultKind: 'miss',
        idempotencyKey: 'session_finale_001:enc_finale_squat_1:player_damage',
        requestedDamage: 10,
        actualDamage: 10,
        oldHp: 10,
        previousHp: 10,
        newHp: 0,
        currentHp: 0,
        applied: true,
      };

      // 보스 처치 영수증 후 플레이어 사망 영수증 도착
      controller.applySettlementReceipt(bossKillReceipt);
      controller.applySettlementReceipt(playerKillReceipt);

      const snapshot = controller.getSnapshot();
      expect(snapshot.bossHp).toBe(0);
      expect(snapshot.playerHp).toBe(0);
      expect(snapshot.phase).toBe('defeat');
      expect(snapshot.isDefeat).toBe(true);
      expect(snapshot.isVictory).toBe(false);
    });

    it('인계 시점에 양측 모두 HP가 0 이하인 경우에도 플레이어 사망(defeat)이 우선되어야 한다 (A14, A22)', () => {
      const handoff = createStandardHandoff({ playerHp: 0, bossHp: 0 });
      const controller = new AssaultFinaleController(handoff);
      const snapshot = controller.getSnapshot();

      expect(snapshot.phase).toBe('defeat');
      expect(snapshot.isDefeat).toBe(true);
      expect(snapshot.isVictory).toBe(false);
    });
  });

  describe('6. 프레임 점프 및 다중 경계 건너뜀 (A17)', () => {
    it('긴 일시정지나 프레임 지연으로 여러 조우 경계를 한 번에 건너뛰어도 순서대로 판정되어야 한다', () => {
      const controller = new AssaultFinaleController(createStandardHandoff());
      // 0초에서 갑자기 6.0초로 점프 (약점 펀치 1 만료, 스쿼트 1 만료 통과)
      controller.update(6000, 6.0);

      const commands = controller.getPendingSettlementCommands();
      // 스쿼트 미수행 피격 명령이 발행되어 있어야 함
      const squatFailCmd = commands.find((c) => c.attackId === 'enc_finale_squat_1');
      expect(squatFailCmd).toBeDefined();
      expect(squatFailCmd?.target).toBe('player');
      expect(squatFailCmd?.resultKind).toBe('miss');
    });
  });
});
