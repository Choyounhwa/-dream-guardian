import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameSessionContext } from '../../src/core/GameSessionContext.js';

describe('GameSessionContext [REFACTOR-CORE-001]', () => {
  describe('생성 및 초기화', () => {
    it('기본 옵션으로 생성 시 기본 메타데이터 및 빈 의존성으로 초기화된다', () => {
      const ctx = new GameSessionContext();

      expect(ctx.metadata.chapterId).toBe(1);
      expect(ctx.metadata.difficulty).toBe('normal');
      expect(ctx.metadata.gameMode).toBe('story');
      expect(ctx.metadata.score).toBe(0);
      expect(ctx.metadata.elapsedTime).toBe(0);
      expect(ctx.metadata.phase).toBe('IDLE');
      expect(ctx.isActive).toBe(false);

      expect(ctx.metrics.totalSteps).toBe(0);
      expect(ctx.metrics.totalJumps).toBe(0);
      expect(ctx.metrics.totalDwellTime).toBe(0);
      expect(ctx.metrics.combo).toBe(0);
      expect(ctx.metrics.consecutiveWrongCount).toBe(0);
    });

    it('커스텀 메타데이터 및 의존성을 주입하여 생성할 수 있다', () => {
      const mockEventBus = { emit: vi.fn(), on: vi.fn() } as any;
      const mockBattle = { hp: 100, reset: vi.fn() } as any;

      const ctx = new GameSessionContext({
        metadata: {
          chapterId: 3,
          difficulty: 'hard',
          gameMode: 'practice',
          score: 500,
        },
        systems: {
          eventBus: mockEventBus,
        },
        controllers: {
          battle: mockBattle,
        },
      });

      expect(ctx.metadata.chapterId).toBe(3);
      expect(ctx.metadata.difficulty).toBe('hard');
      expect(ctx.metadata.gameMode).toBe('practice');
      expect(ctx.metadata.score).toBe(500);
      expect(ctx.systems.eventBus).toBe(mockEventBus);
      expect(ctx.controllers.battle).toBe(mockBattle);
    });
  });

  describe('의존성 레지스트리 (Systems & Controllers)', () => {
    let ctx: GameSessionContext;

    beforeEach(() => {
      ctx = new GameSessionContext();
    });

    it('시스템을 동적으로 등록하고 조회할 수 있다', () => {
      const mockEngine = { update: vi.fn() } as any;
      const mockCanvas = { virtualWidth: 1280 } as any;

      ctx.registerSystem('gameEngine', mockEngine);
      ctx.registerSystem('canvasManager', mockCanvas);

      expect(ctx.getSystem('gameEngine')).toBe(mockEngine);
      expect(ctx.getSystem('canvasManager')).toBe(mockCanvas);
      expect(ctx.systems.gameEngine).toBe(mockEngine);
    });

    it('컨트롤러를 동적으로 등록하고 조회할 수 있다', () => {
      const mockBoss = { hp: 10, reset: vi.fn() } as any;
      const mockGuardian = { reset: vi.fn() } as any;

      ctx.registerController('boss', mockBoss);
      ctx.registerController('guardian', mockGuardian);

      expect(ctx.getController('boss')).toBe(mockBoss);
      expect(ctx.getController('guardian')).toBe(mockGuardian);
      expect(ctx.controllers.boss).toBe(mockBoss);
    });
  });

  describe('세션 메타데이터 및 지표(Metrics) 변경', () => {
    let ctx: GameSessionContext;

    beforeEach(() => {
      ctx = new GameSessionContext();
    });

    it('점수(Score)를 누적할 수 있다', () => {
      ctx.addScore(100);
      ctx.addScore(50);
      expect(ctx.metadata.score).toBe(150);
    });

    it('페이즈(Phase)를 변경할 수 있다', () => {
      ctx.setPhase('A');
      expect(ctx.metadata.phase).toBe('A');

      ctx.setPhase('B');
      expect(ctx.metadata.phase).toBe('B');
    });

    it('활동 지표(Steps, Jumps, DwellTime, Combo)를 업데이트할 수 있다', () => {
      ctx.incrementSteps(5);
      ctx.incrementSteps(); // default 1
      expect(ctx.metrics.totalSteps).toBe(6);

      ctx.incrementJumps(2);
      ctx.incrementJumps(); // default 1
      expect(ctx.metrics.totalJumps).toBe(3);

      ctx.addDwellTime(1.5);
      expect(ctx.metrics.totalDwellTime).toBeCloseTo(1.5);

      ctx.setCombo(7);
      expect(ctx.metrics.combo).toBe(7);

      ctx.incrementWrongCount();
      ctx.incrementWrongCount();
      expect(ctx.metrics.consecutiveWrongCount).toBe(2);

      ctx.resetWrongCount();
      expect(ctx.metrics.consecutiveWrongCount).toBe(0);
    });
  });

  describe('생명주기(Lifecycle) 동작', () => {
    it('update(dt) 호출 시 경과 시간(elapsedTime)이 누적된다', () => {
      const ctx = new GameSessionContext();
      ctx.setActive(true);

      ctx.update(0.16);
      ctx.update(0.34);

      expect(ctx.metadata.elapsedTime).toBeCloseTo(0.5);
    });

    it('비활성 상태에서는 update(dt) 시 경과 시간이 증가하지 않는다', () => {
      const ctx = new GameSessionContext();
      ctx.setActive(false);

      ctx.update(0.5);

      expect(ctx.metadata.elapsedTime).toBe(0);
    });

    it('resetSession() 호출 시 타이머, 점수, 지표를 초기화하고 바인딩된 컨트롤러를 리셋한다', () => {
      const mockBattle = { reset: vi.fn() } as any;
      const mockGuardian = { reset: vi.fn() } as any;
      const mockStageProgress = { reset: vi.fn() } as any;

      const ctx = new GameSessionContext({
        controllers: {
          battle: mockBattle,
          guardian: mockGuardian,
          stageProgress: mockStageProgress,
        },
      });

      ctx.setActive(true);
      ctx.addScore(300);
      ctx.update(2.5);
      ctx.incrementSteps(10);
      ctx.setCombo(4);
      ctx.setPhase('B');

      ctx.resetSession();

      expect(ctx.metadata.score).toBe(0);
      expect(ctx.metadata.elapsedTime).toBe(0);
      expect(ctx.metadata.phase).toBe('IDLE');
      expect(ctx.metrics.totalSteps).toBe(0);
      expect(ctx.metrics.combo).toBe(0);
      expect(ctx.isActive).toBe(false);

      expect(mockBattle.reset).toHaveBeenCalledTimes(1);
      expect(mockGuardian.reset).toHaveBeenCalledTimes(1);
      expect(mockStageProgress.reset).toHaveBeenCalledTimes(1);
    });

    it('startChapter(chapterId, subLevel) 호출 시 챕터 정보가 갱신되고 새 세션이 시작된다', () => {
      const mockBoss = { reset: vi.fn() } as any;
      const mockBattle = { reset: vi.fn() } as any;
      const mockLifecycle = { startSession: vi.fn() } as any;
      const mockEventBus = { emit: vi.fn(), on: vi.fn() } as any;

      const ctx = new GameSessionContext({
        systems: {
          sessionLifecycle: mockLifecycle,
          eventBus: mockEventBus,
        },
        controllers: {
          boss: mockBoss,
          battle: mockBattle,
        },
      });

      ctx.startChapter(2, 3);

      expect(ctx.metadata.chapterId).toBe(2);
      expect(ctx.metadata.subLevel).toBe(3);
      expect(ctx.metadata.phase).toBe('READY');
      expect(ctx.isActive).toBe(true);

      expect(mockLifecycle.startSession).toHaveBeenCalledTimes(1);
      expect(mockBoss.reset).toHaveBeenCalledWith(2);
      expect(mockBattle.reset).toHaveBeenCalledTimes(1);
      expect(mockEventBus.emit).toHaveBeenCalledWith('session:start', {
        chapterId: 2,
        subLevel: 3,
      });
    });
  });

  describe('헬퍼 상태 질의 (Helper Queries)', () => {
    it('isBossDefeated: 보스 컨트롤러의 HP 상태에 따라 보스 격파 여부를 반환한다', () => {
      const mockBoss = { hp: 0, maxHp: 10 } as any;
      const ctx = new GameSessionContext({
        controllers: { boss: mockBoss },
      });

      expect(ctx.isBossDefeated()).toBe(true);

      mockBoss.hp = 5;
      expect(ctx.isBossDefeated()).toBe(false);
    });

    it('isPlayerDefeated: 플레이어 HP 상태에 따라 패배 여부를 반환한다', () => {
      const mockBattle = { hp: 0, maxHp: 100 } as any;
      const ctx = new GameSessionContext({
        controllers: { battle: mockBattle },
      });

      expect(ctx.isPlayerDefeated()).toBe(true);

      mockBattle.hp = 25;
      expect(ctx.isPlayerDefeated()).toBe(false);
    });

    it('isEnraged: bossHazardController가 있으면 그 상태를, 없으면 HP 30% 이하 기준으로 판단한다', () => {
      const mockHazard = { isEnraged: true } as any;
      const mockBoss = { hp: 8, maxHp: 10 } as any;

      const ctx1 = new GameSessionContext({
        controllers: { boss: mockBoss, bossHazard: mockHazard },
      });
      expect(ctx1.isEnraged()).toBe(true);

      const ctx2 = new GameSessionContext({
        controllers: { boss: mockBoss },
      });
      expect(ctx2.isEnraged()).toBe(false);

      mockBoss.hp = 2; // 2 / 10 = 20% <= 30%
      expect(ctx2.isEnraged()).toBe(true);
    });
  });
});
