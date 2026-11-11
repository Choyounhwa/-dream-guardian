import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_ASSAULT_VISUAL_CONFIG } from '../../config/assault-visual.config.js';
import { AssaultImpactVFX } from '../../src/render/assault/AssaultImpactVFX.js';
import { AssaultSceneHandler } from '../../src/core/director/AssaultSceneHandler.js';
import { AssaultPairPainter } from '../../src/render/AssaultPairPainter.js';
import { AssaultSessionWireHelper } from '../../src/core/bootstrap/AssaultSessionWireHelper.js';

describe('[ASSAULT-FX-003] 정답 사방 폭죽·글자 팝핑 및 오답 디졸브 타격 이펙트', () => {
  describe('1. AssaultImpactVFX 기본 생성 및 생명주기', () => {
    it('초기 생성 시 활성 파티클, 디졸브 조각, 팝핑 텍스트 수가 0이어야 한다', () => {
      const vfx = new AssaultImpactVFX();
      expect(vfx.activeCount).toBe(0);
      expect(vfx.particles.length).toBe(0);
      expect(vfx.shards.length).toBe(0);
      expect(vfx.poppingTexts.length).toBe(0);
    });

    it('clear() 호출 시 모든 활성 이펙트가 초기화되어야 한다', () => {
      const vfx = new AssaultImpactVFX();
      vfx.triggerCorrect(100, 200, '42');
      vfx.triggerWrong(300, 400, '99');
      expect(vfx.activeCount).toBeGreaterThan(0);

      vfx.clear();
      expect(vfx.activeCount).toBe(0);
      expect(vfx.particles.length).toBe(0);
      expect(vfx.shards.length).toBe(0);
      expect(vfx.poppingTexts.length).toBe(0);
    });
  });

  describe('2. triggerCorrect (정답 사방 폭죽 및 글자 팝핑 연출)', () => {
    it('EffectManager에 correctShake(강도 14, 지속시간 0.35s)를 트리거해야 한다', () => {
      const mockEffectManager = {
        triggerShake: vi.fn(),
      };
      const vfx = new AssaultImpactVFX({ effectManager: mockEffectManager as any });

      vfx.triggerCorrect(400, 300, '12');

      expect(mockEffectManager.triggerShake).toHaveBeenCalledWith(
        DEFAULT_ASSAULT_VISUAL_CONFIG.correctShake.intensity,
        DEFAULT_ASSAULT_VISUAL_CONFIG.correctShake.duration
      );
    });

    it('정답 타격 위치에서 5색 고속 방사형 폭죽 파티클을 사방 360도로 방출해야 한다', () => {
      const vfx = new AssaultImpactVFX();
      vfx.triggerCorrect(500, 350, '77');

      expect(vfx.particles.length).toBeGreaterThanOrEqual(20);

      const fiveColors = ['#28E6FF', '#FFCB4D', '#00FF88', '#FF865E', '#FFFFFF'];
      const spawnedColors = new Set(vfx.particles.map((p) => p.color.toUpperCase()));
      // 5색 팔레트 색상들이 포함되어 있는지 검증
      let matchedColorCount = 0;
      for (const c of fiveColors) {
        if (spawnedColors.has(c.toUpperCase())) matchedColorCount++;
      }
      expect(matchedColorCount).toBeGreaterThanOrEqual(3);

      // 360도 전방향 속도 분산 검증 (x와 y 속도 방향의 양수/음수 혼재)
      const hasPositiveVx = vfx.particles.some((p) => p.vx > 0);
      const hasNegativeVx = vfx.particles.some((p) => p.vx < 0);
      const hasPositiveVy = vfx.particles.some((p) => p.vy > 0);
      const hasNegativeVy = vfx.particles.some((p) => p.vy < 0);
      expect(hasPositiveVx && hasNegativeVx).toBe(true);
      expect(hasPositiveVy && hasNegativeVy).toBe(true);
    });

    it('정답 텍스트에 오버슈트 팝핑 애니메이션(초기 Scale 1.35x -> 1.0x)을 등록해야 한다', () => {
      const vfx = new AssaultImpactVFX();
      vfx.triggerCorrect(200, 150, '35', { side: 'left' });

      expect(vfx.poppingTexts.length).toBe(1);
      const popping = vfx.poppingTexts[0];
      expect(popping.text).toBe('35');
      expect(popping.scale).toBeCloseTo(1.35, 2);
      expect(vfx.getPoppingScale('left')).toBeCloseTo(1.35, 2);

      // 시간 경과 시 스케일이 1.0 방향으로 안착해야 함
      vfx.update(0.35);
      expect(popping.scale).toBeLessThan(1.35);
    });
  });

  describe('3. triggerWrong (오답 디졸브 및 약한 화면 흔들림)', () => {
    it('EffectManager에 wrongShake(강도 4, 지속시간 0.18s)를 트리거해야 한다', () => {
      const mockEffectManager = {
        triggerShake: vi.fn(),
      };
      const vfx = new AssaultImpactVFX({ effectManager: mockEffectManager as any });

      vfx.triggerWrong(600, 300, '99');

      expect(mockEffectManager.triggerShake).toHaveBeenCalledWith(
        DEFAULT_ASSAULT_VISUAL_CONFIG.wrongShake.intensity,
        DEFAULT_ASSAULT_VISUAL_CONFIG.wrongShake.duration
      );
    });

    it('사각 파편 조각들이 중력 및 회전을 받으며 산란되는 디졸브 조각 파티클을 생성해야 한다', () => {
      const vfx = new AssaultImpactVFX();
      vfx.triggerWrong(600, 300, '99');

      expect(vfx.shards.length).toBeGreaterThanOrEqual(12);

      // 사각 규격(w, h) 및 회전 각속도 존재 확인
      for (const shard of vfx.shards) {
        expect(shard.width).toBeGreaterThan(0);
        expect(shard.height).toBeGreaterThan(0);
        expect(typeof shard.rotationSpeed).toBe('number');
      }

      // update 후 중력에 의해 vy가 증가하고 회전각이 변경되어야 함
      const initialVy = vfx.shards[0].vy;
      const initialRot = vfx.shards[0].rotation;
      vfx.update(0.1);
      expect(vfx.shards[0].vy).toBeGreaterThan(initialVy);
      expect(vfx.shards[0].rotation).not.toBe(initialRot);
    });
  });

  describe('4. update 물리 및 수명 만료 처리', () => {
    it('충분한 시간이 경과하면 파티클, 조각, 팝핑 텍스트가 모두 페이드아웃 및 정리되어야 한다', () => {
      const vfx = new AssaultImpactVFX();
      vfx.triggerCorrect(100, 100, 'A');
      vfx.triggerWrong(200, 200, 'B');
      expect(vfx.activeCount).toBeGreaterThan(0);

      // 1.5초 업데이트 후 모두 제거
      vfx.update(0.5);
      vfx.update(0.5);
      vfx.update(0.6);
      expect(vfx.activeCount).toBe(0);
      expect(vfx.particles.length).toBe(0);
      expect(vfx.shards.length).toBe(0);
      expect(vfx.poppingTexts.length).toBe(0);
    });
  });

  describe('5. render 캔버스 렌더링 검증', () => {
    it('파티클, 조각, 팝핑 텍스트가 존재할 때 정상적으로 context2d 드로잉 메서드를 호출해야 한다', () => {
      const mockCtx: any = {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        fillRect: vi.fn(),
        fillText: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
      };

      const vfx = new AssaultImpactVFX();
      vfx.triggerCorrect(100, 100, 'POP');
      vfx.triggerWrong(200, 200, 'SHARD');

      vfx.render(mockCtx, 1280, 720);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalledWith('POP', 0, 0);
    });
  });

  describe('6. AssaultSceneHandler 연동 검증', () => {
    it('AssaultSceneHandler 인스턴스는 assaultImpactVFX 인스턴스를 소유해야 한다', () => {
      const handler = new AssaultSceneHandler();
      expect(handler.assaultImpactVFX).toBeDefined();
      expect(handler.assaultImpactVFX instanceof AssaultImpactVFX).toBe(true);
    });

    it('AssaultSceneHandler.update 와 render 시 assaultImpactVFX 의 update 및 render 가 호출되어야 한다', () => {
      const mockImpactVFX = {
        update: vi.fn(),
        render: vi.fn(),
        setEffectManager: vi.fn(),
      };
      const handler = new AssaultSceneHandler({
        assaultImpactVFX: mockImpactVFX as any,
      });

      const mockCtx: any = {
        canvasManager: {
          ctx: {
            save: vi.fn(),
            translate: vi.fn(),
            restore: vi.fn(),
          },
          virtualWidth: 1280,
          virtualHeight: 720,
        },
        effectManager: {
          update: vi.fn(),
          render: vi.fn(),
        },
      };

      handler.update(0.016, mockCtx);
      expect(mockImpactVFX.update).toHaveBeenCalledWith(0.016);

      handler.render(mockCtx);
      expect(mockImpactVFX.render).toHaveBeenCalledWith(mockCtx.canvasManager.ctx, 1280, 720);
    });
  });

  describe('7. AssaultPairPainter 정답 텍스트 팝핑 연동 검증', () => {
    it('AssaultPairPainter에 AssaultImpactVFX 연동 시 poppingScale이 적용되어야 한다', () => {
      const vfx = new AssaultImpactVFX();
      vfx.triggerCorrect(200, 200, '42', { side: 'left' });

      const painter = new AssaultPairPainter(DEFAULT_ASSAULT_VISUAL_CONFIG, { impactVFX: vfx });
      expect(painter.impactVFX).toBe(vfx);

      const mockCtx: any = {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        fillRect: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        roundRect: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        measureText: vi.fn(() => ({ width: 40 })),
      };

      painter.render(
        mockCtx,
        {
          leftText: '42',
          rightText: '88',
          status: 'negated',
          lockedSide: 'left',
          progress: 0.8,
        },
        { width: 1280, height: 720 }
      );

      // scale이 1.0 초과로 적용되었는지 검증 (1.35x 부근)
      const scaleCalls = mockCtx.scale.mock.calls;
      const hasPoppingScale = scaleCalls.some(
        ([sx, sy]: [number, number]) => sx > 1.2 && sy > 1.2
      );
      expect(hasPoppingScale).toBe(true);
    });
  });

  describe('8. AssaultSessionWireHelper 타격 이펙트 트리거 연동 검증', () => {
    let mockHost: any;
    let mockVFX: any;
    let wireHelper: AssaultSessionWireHelper;

    beforeEach(() => {
      mockVFX = {
        triggerCorrect: vi.fn(),
        triggerWrong: vi.fn(),
      };
      mockHost = {
        eventBus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
        battle: { hp: 100, maxHp: 100, applyDamage: vi.fn() },
        boss: { hp: 100, maxHp: 100 },
        bossController: { hp: 100 },
        stateMachine: { canTransition: vi.fn(() => true), changeState: vi.fn() },
        sessionLifecycle: {
          setActiveAssaultSessionToken: vi.fn(),
          clearActiveAssaultSessionToken: vi.fn(),
          setTestSession: vi.fn(),
        },
        questionBank: {},
        sessionContext: { setMode: vi.fn() },
        motionIntentBus: { setPhase: vi.fn() },
        mainSceneContext: {
          canvasManager: { virtualWidth: 1280, virtualHeight: 720 },
          effectManager: { triggerShake: vi.fn() },
        },
        goToMenu: vi.fn(),
      };
      wireHelper = new AssaultSessionWireHelper(mockHost);
      wireHelper.setAssaultImpactVFX(mockVFX as any);
    });

    it('settlement 커맨드가 boss_negate일 때 triggerCorrect가 적절한 착지 타깃 좌표와 함께 호출되어야 한다', () => {
      wireHelper.handleAssaultSettlementImpact(
        {
          sessionId: 'test_session',
          roundId: 'round_01',
          attackId: 'atk_01',
          target: 'boss',
          resultKind: 'hit',
          effectType: 'boss_negate',
          idempotencyKey: 'test_session:round_01:atk_01:boss_negate',
        },
        {
          presentation: {
            leftChoiceText: '10',
            rightChoiceText: '20',
          },
        }
      );

      expect(mockVFX.triggerCorrect).toHaveBeenCalled();
      const [x, y, text] = mockVFX.triggerCorrect.mock.calls[0];
      expect(typeof x).toBe('number');
      expect(typeof y).toBe('number');
      expect(x).toBeGreaterThan(0);
      expect(y).toBeGreaterThan(0);
      expect(typeof text).toBe('string');
    });

    it('settlement 커맨드가 player_damage일 때 triggerWrong이 적절한 착지 타깃 좌표와 함께 호출되어야 한다', () => {
      wireHelper.handleAssaultSettlementImpact(
        {
          sessionId: 'test_session',
          roundId: 'round_01',
          attackId: 'atk_01',
          target: 'player',
          resultKind: 'miss',
          effectType: 'player_damage',
          idempotencyKey: 'test_session:round_01:atk_01:player_damage',
        },
        {
          presentation: {
            leftChoiceText: '10',
            rightChoiceText: '20',
          },
        }
      );

      expect(mockVFX.triggerWrong).toHaveBeenCalled();
      const [x, y, text] = mockVFX.triggerWrong.mock.calls[0];
      expect(typeof x).toBe('number');
      expect(typeof y).toBe('number');
      expect(x).toBeGreaterThan(0);
      expect(y).toBeGreaterThan(0);
      expect(typeof text).toBe('string');
    });
  });

  describe('9. [ASSAULT-FX-005] 정답 펀치 별모으기 페이즈 시각효과 융합', () => {
    it('triggerCorrect 호출 시 4각 회전 반짝임(Twinkle) 별가루 파티클을 방출해야 한다', () => {
      const vfx = new AssaultImpactVFX();
      vfx.triggerCorrect(400, 300, '55');

      expect(vfx.starParticles.length).toBeGreaterThanOrEqual(12);

      const starPalette = ['#FFD700', '#28E6FF', '#C889FF', '#FFFFFF'];
      const spawnedColors = new Set(vfx.starParticles.map((s) => s.color.toUpperCase()));
      let matched = 0;
      for (const c of starPalette) {
        if (spawnedColors.has(c.toUpperCase())) matched++;
      }
      expect(matched).toBeGreaterThanOrEqual(2);

      // 회전 속도 및 방사형 속도 검증
      for (const s of vfx.starParticles) {
        expect(typeof s.rotation).toBe('number');
        expect(typeof s.rotationSpeed).toBe('number');
        expect(s.size).toBeGreaterThan(0);
        expect(s.alpha).toBeGreaterThan(0);
      }

      // update 후 이동 및 회전 확인
      const initialRot = vfx.starParticles[0].rotation;
      vfx.update(0.1);
      expect(vfx.starParticles[0].rotation).not.toBe(initialRot);
    });

    it('triggerCorrect 호출 시 20px -> 90px로 팽창하는 동심원 충격파 펄스 링(Shockwave Ring)을 생성해야 한다', () => {
      const vfx = new AssaultImpactVFX();
      vfx.triggerCorrect(350, 250, '100');

      expect(vfx.shockwaves.length).toBeGreaterThanOrEqual(1);
      const ring = vfx.shockwaves[0];
      expect(ring.x).toBe(350);
      expect(ring.y).toBe(250);
      expect(ring.radius).toBeCloseTo(20, 1);
      expect(ring.maxRadius).toBeGreaterThanOrEqual(80);

      // 시간 경과에 따라 반경이 확장되고 알파가 감소해야 함
      const initialRadius = ring.radius;
      vfx.update(0.15);
      expect(ring.radius).toBeGreaterThan(initialRadius);
      expect(ring.alpha).toBeLessThan(1.0);
    });

    it('triggerCorrect 호출 시 상단으로 부유(floatY: -40px)하는 PERFECT 배지를 생성해야 한다', () => {
      const vfx = new AssaultImpactVFX();
      vfx.triggerCorrect(300, 200, '77', { combo: 3 });

      expect(vfx.floatingBadges.length).toBeGreaterThanOrEqual(1);
      const badge = vfx.floatingBadges[0];
      expect(badge.text).toBe('PERFECT');
      expect(badge.combo).toBe(3);
      expect(badge.offsetY).toBe(0);

      // update 후 위쪽으로 부유(offsetY 음수화)
      vfx.update(0.2);
      expect(badge.offsetY).toBeLessThan(0);
      expect(badge.offsetY).toBeGreaterThanOrEqual(-40);
    });

    it('정답 타격 시 별가루 파티클, 충격파 링, PERFECT 배지, 폭죽 파티클, 팝핑 텍스트가 동시 발동되어야 한다', () => {
      const vfx = new AssaultImpactVFX();
      vfx.triggerCorrect(500, 400, '88');

      expect(vfx.particles.length).toBeGreaterThan(0);
      expect(vfx.poppingTexts.length).toBe(1);
      expect(vfx.starParticles.length).toBeGreaterThan(0);
      expect(vfx.shockwaves.length).toBeGreaterThan(0);
      expect(vfx.floatingBadges.length).toBeGreaterThan(0);
      expect(vfx.activeCount).toBe(
        vfx.particles.length +
        vfx.shards.length +
        vfx.poppingTexts.length +
        vfx.starParticles.length +
        vfx.shockwaves.length +
        vfx.floatingBadges.length
      );
    });

    it('수명 만료 후 모든 효과(별가루, 충격파, 배지 등)가 완전히 정리되어야 한다', () => {
      const vfx = new AssaultImpactVFX();
      vfx.triggerCorrect(400, 300, '99');
      expect(vfx.activeCount).toBeGreaterThan(0);

      vfx.update(0.7);
      vfx.update(0.5);
      expect(vfx.activeCount).toBe(0);
      expect(vfx.starParticles.length).toBe(0);
      expect(vfx.shockwaves.length).toBe(0);
      expect(vfx.floatingBadges.length).toBe(0);
    });

    it('render 호출 시 별가루, 충격파 링, PERFECT 배지가 정상적으로 드로잉되어야 한다', () => {
      const mockCtx: any = {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        fillRect: vi.fn(),
        fillText: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
      };

      const vfx = new AssaultImpactVFX();
      vfx.triggerCorrect(250, 180, '12', { combo: 2 });
      vfx.render(mockCtx, 1280, 720);

      // 충격파 링 stroke, 별가루 moveTo/lineTo/fill, 배지 fillText 확인
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalledWith(expect.stringContaining('PERFECT'), 0, 0);
    });

    it('타격 정답 텍스트와 판정 등급 뱃지가 bold 50px로 렌더링되어야 한다', () => {
      const fontHistory: string[] = [];
      const mockCtx: any = {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        fillRect: vi.fn(),
        fillText: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        measureText: vi.fn().mockReturnValue({ width: 60 }),
        set font(val: string) {
          fontHistory.push(val);
        },
        get font() {
          return fontHistory[fontHistory.length - 1] ?? '';
        },
      };

      const vfx = new AssaultImpactVFX();
      vfx.triggerCorrect(250, 180, '12', { combo: 2 });
      vfx.render(mockCtx, 1280, 720);

      expect(fontHistory).toContain('bold 50px sans-serif');
      expect(fontHistory).toContain('bold 50px NanumSquareRound, sans-serif');
    });
  });

  describe('9. [BUG-ASSAULT-FX-001 / #718] SceneDirector를 통한 런타임 AssaultImpactVFX 자동 주입 검증', () => {
    it('SceneDirector 인스턴스는 assaultHandler 공개 게터를 정상 노출해야 한다', async () => {
      const { SceneDirector } = await import('../../src/core/SceneDirector.js');
      const director = new SceneDirector();
      expect(director.assaultHandler).toBeDefined();
      expect(director.assaultHandler.assaultImpactVFX).toBeDefined();
    });

    it('수동 setAssaultImpactVFX 없이도 host.sceneDirector 경로를 통해 AssaultImpactVFX가 자동 해석되어 트리거되어야 한다', async () => {
      const { SceneDirector } = await import('../../src/core/SceneDirector.js');
      const director = new SceneDirector();
      const spyTriggerCorrect = vi.spyOn(director.assaultHandler.assaultImpactVFX, 'triggerCorrect');

      const mockHostWithDirector: any = {
        sceneDirector: director,
        mainSceneContext: {
          canvasManager: { virtualWidth: 1280, virtualHeight: 720 },
          effectManager: { triggerShake: vi.fn() },
        },
      };

      const realWireHelper = new AssaultSessionWireHelper(mockHostWithDirector);
      // 수동 주입을 호출하지 않음: wireHelper.setAssaultImpactVFX() 미호출 상태!
      expect(realWireHelper.assaultImpactVFX).toBe(director.assaultHandler.assaultImpactVFX);

      realWireHelper.handleAssaultSettlementImpact(
        {
          sessionId: 'runtime_session',
          roundId: 'round_01',
          attackId: 'atk_99',
          effectType: 'boss_negate',
        },
        {
          presentation: {
            leftChoiceText: '77',
            rightChoiceText: '88',
          },
        }
      );

      expect(spyTriggerCorrect).toHaveBeenCalled();
    });
  });

  describe('10. [ASSAULT-FX-006 / #720] 풍선 팝핑 스케일 펄스 (Balloon Scale Pulse) 타격감 검증', () => {
    it('정답 타격 시 텍스트 및 UI 팝핑 스케일이 1.45x 이상으로 순간 급팽창(풍선 팝핑)해야 한다', () => {
      const vfx = new AssaultImpactVFX();
      vfx.triggerCorrect(400, 300, '42', { side: 'left', balloonPulse: true });

      const initialScale = vfx.getPoppingScale('left');
      expect(initialScale).toBeGreaterThanOrEqual(1.45);
      expect(initialScale).toBeLessThanOrEqual(1.55);
    });

    it('풍선 팝핑은 탄성 감쇠 진동을 거쳐 1.0 근방으로 매끄럽게 안착해야 한다', () => {
      const vfx = new AssaultImpactVFX();
      vfx.triggerCorrect(400, 300, '42', { side: 'right', balloonPulse: true });

      // t=0: 급팽창 (>= 1.45)
      expect(vfx.getPoppingScale('right')).toBeGreaterThanOrEqual(1.45);

      // t=0.15: 수축 반동 진행
      vfx.update(0.15);
      const midScale = vfx.getPoppingScale('right');
      expect(midScale).toBeLessThan(1.45);

      // t=0.45: 최종 수명 종료 후 1.0 복귀
      vfx.update(0.35);
      expect(vfx.getPoppingScale('right')).toBe(1.0);
    });

    it('오답 타격 시에도 타격감 전달을 위한 스케일 펄스(>= 1.25x)가 활성화되어야 한다', () => {
      const vfx = new AssaultImpactVFX();
      vfx.triggerWrong(500, 300, '99', { side: 'left', balloonPulse: true });

      const wrongScale = vfx.getPoppingScale('left');
      expect(wrongScale).toBeGreaterThanOrEqual(1.25);
    });
  });
});
