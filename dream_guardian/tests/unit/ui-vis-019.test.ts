import { describe, expect, it, vi } from 'vitest';
import {
  BossRenderer,
  BOSS_SLOT_IDS,
  PROTECTED_BOSS_SLOT_IDS,
  DEFAULT_BOSS_FIXTURE,
  ENRAGED_BOSS_FIXTURE,
  ATTACKING_BOSS_FIXTURE,
  WARNING_BOSS_FIXTURE,
  DEFEATED_BOSS_FIXTURE,
  type BossBounds,
  type BossPresentationContext,
  type BossFixtureDTO,
} from '../../src/render/BossRenderer.js';
import {
  BossClimaxRenderer,
  BOSS_CLIMAX_SLOT_IDS,
  PROTECTED_BOSS_CLIMAX_SLOT_IDS,
  DEFAULT_BOSS_CLIMAX_FIXTURE,
  ENRAGED_BOSS_CLIMAX_FIXTURE,
  FEVER_BOSS_CLIMAX_FIXTURE,
  HAZARD_STOMP_BOSS_CLIMAX_FIXTURE,
  HAZARD_MINION_RUSH_BOSS_CLIMAX_FIXTURE,
  type BossClimaxBounds,
  type BossClimaxPresentationContext,
  type BossClimaxFixtureDTO,
  type BossClimaxRenderState,
} from '../../src/render/BossClimaxRenderer.js';
import { createDefaultUIPresentationDocument } from '../../src/data/UIPresentation.js';
import { imageLoader } from '../../src/utils/UIImageLoader.js';

function createMockCtx(): CanvasRenderingContext2D & {
  calls: { method: string; args: unknown[] }[];
  fillStyles: string[];
  strokeStyles: string[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  const fillStyles: string[] = [];
  const strokeStyles: string[] = [];
  let _fillStyle = '';
  let _strokeStyle = '';

  const mock = {
    calls,
    fillStyles,
    strokeStyles,
    save: vi.fn(() => calls.push({ method: 'save', args: [] })),
    restore: vi.fn(() => calls.push({ method: 'restore', args: [] })),
    beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
    closePath: vi.fn(() => calls.push({ method: 'closePath', args: [] })),
    moveTo: vi.fn((x: number, y: number) => calls.push({ method: 'moveTo', args: [x, y] })),
    lineTo: vi.fn((x: number, y: number) => calls.push({ method: 'lineTo', args: [x, y] })),
    arc: vi.fn((...args: unknown[]) => calls.push({ method: 'arc', args })),
    ellipse: vi.fn((...args: unknown[]) => calls.push({ method: 'ellipse', args })),
    rect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'rect', args: [x, y, w, h] }),
    ),
    roundRect: vi.fn((x: number, y: number, w: number, h: number, r?: unknown) =>
      calls.push({ method: 'roundRect', args: [x, y, w, h, r] }),
    ),
    quadraticCurveTo: vi.fn((...args: unknown[]) => calls.push({ method: 'quadraticCurveTo', args })),
    bezierCurveTo: vi.fn((...args: unknown[]) => calls.push({ method: 'bezierCurveTo', args })),
    fill: vi.fn(() => calls.push({ method: 'fill', args: [] })),
    stroke: vi.fn(() => calls.push({ method: 'stroke', args: [] })),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'fillRect', args: [x, y, w, h] }),
    ),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'strokeRect', args: [x, y, w, h] }),
    ),
    clearRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'clearRect', args: [x, y, w, h] }),
    ),
    fillText: vi.fn((text: string, x: number, y: number, maxW?: number) =>
      calls.push({ method: 'fillText', args: [text, x, y, maxW] }),
    ),
    strokeText: vi.fn((text: string, x: number, y: number) =>
      calls.push({ method: 'strokeText', args: [text, x, y] }),
    ),
    measureText: vi.fn((text: string) => ({ width: text.length * 16 })),
    translate: vi.fn((x: number, y: number) => calls.push({ method: 'translate', args: [x, y] })),
    scale: vi.fn((x: number, y: number) => calls.push({ method: 'scale', args: [x, y] })),
    rotate: vi.fn((angle: number) => calls.push({ method: 'rotate', args: [angle] })),
    drawImage: vi.fn((...args: unknown[]) => calls.push({ method: 'drawImage', args })),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    setLineDash: vi.fn((segments: number[]) => calls.push({ method: 'setLineDash', args: [segments] })),
    getLineDash: vi.fn(() => []),
    resetTransform: vi.fn(() => calls.push({ method: 'resetTransform', args: [] })),
  };

  Object.defineProperty(mock, 'fillStyle', {
    get: () => _fillStyle,
    set: (val: string) => {
      _fillStyle = val;
      fillStyles.push(val);
    },
  });

  Object.defineProperty(mock, 'strokeStyle', {
    get: () => _strokeStyle,
    set: (val: string) => {
      _strokeStyle = val;
      strokeStyles.push(val);
    },
  });

  return mock as unknown as CanvasRenderingContext2D & {
    calls: { method: string; args: unknown[] }[];
    fillStyles: string[];
    strokeStyles: string[];
  };
}

describe('[UI-VIS-019 / Issue #449] 보스 결전 실제 표시 주입 경계', () => {
  const W = 1080;
  const H = 2160;

  describe('1. BossRenderer 선택적 표시 컨텍스트 및 bounds 조회', () => {
    it('getBossBounds가 지정된 중심점과 반지름 기반으로 정확한 바운딩 박스를 계산한다', () => {
      const renderer = new BossRenderer();
      const bounds: BossBounds = renderer.getBossBounds(540, 400, 90);

      expect(bounds.x).toBe(450);
      expect(bounds.y).toBe(310);
      expect(bounds.w).toBe(180);
      expect(bounds.h).toBe(180);
      expect(bounds.width).toBe(180);
      expect(bounds.height).toBe(180);
      expect(bounds.isProtected).toBe(false);
    });

    it('setPresentationContext, getPresentationContext, clearPresentationContext 라이프사이클이 정확하다', () => {
      const renderer = new BossRenderer();
      expect(renderer.getPresentationContext()).toBeUndefined();

      const customCtx: BossPresentationContext = {
        bossTitle: { text: '망각의 요괴 하얘시니', color: '#28E6FF' },
        bossAuraStyle: { glowColor: '#00FFFF' },
      };

      renderer.setPresentationContext(customCtx);
      expect(renderer.getPresentationContext()).toEqual(customCtx);

      renderer.clearPresentationContext();
      expect(renderer.getPresentationContext()).toBeUndefined();
    });

    it('BOSS_SLOT_IDS 및 PROTECTED_BOSS_SLOT_IDS 상수가 올바르게 정의되어 있다', () => {
      expect(BOSS_SLOT_IDS).toContain('boss_visual');
      expect(BOSS_SLOT_IDS).toContain('boss_title');
      expect(BOSS_SLOT_IDS).toContain('boss_aura_style');

      expect(PROTECTED_BOSS_SLOT_IDS).toContain('boss_hp');
      expect(PROTECTED_BOSS_SLOT_IDS).toContain('boss_max_hp');
      expect(PROTECTED_BOSS_SLOT_IDS).toContain('damage_calculation');
      expect(PROTECTED_BOSS_SLOT_IDS).toContain('attack_power');
      expect(PROTECTED_BOSS_SLOT_IDS).toContain('boss_phase_logic');
    });

    it('보스 Fixture DTO 5종이 올바르게 정의되어 있다', () => {
      expect(DEFAULT_BOSS_FIXTURE.chapter).toBe(1);
      expect(DEFAULT_BOSS_FIXTURE.phase).toBe('idle');

      expect(ENRAGED_BOSS_FIXTURE.chapter).toBe(2);
      expect(ENRAGED_BOSS_FIXTURE.isEnraged).toBe(true);

      expect(ATTACKING_BOSS_FIXTURE.chapter).toBe(3);
      expect(ATTACKING_BOSS_FIXTURE.phase).toBe('attacking');

      expect(WARNING_BOSS_FIXTURE.chapter).toBe(4);
      expect(WARNING_BOSS_FIXTURE.phase).toBe('warning');

      expect(DEFEATED_BOSS_FIXTURE.chapter).toBe(5);
      expect(DEFEATED_BOSS_FIXTURE.phase).toBe('defeated');
    });

    it('renderFixture를 통해 5개 챕터 보스를 결정론적으로 드로잉한다', () => {
      const renderer = new BossRenderer();
      const chapters = [1, 2, 3, 4, 5];

      for (const ch of chapters) {
        const ctx = createMockCtx();
        const fixture: BossFixtureDTO = {
          chapter: ch,
          phase: 'idle',
          x: 540,
          y: 400,
          radius: 90,
        };
        renderer.renderFixture(ctx, fixture);
        expect(ctx.calls.length).toBeGreaterThan(0);
        expect(ctx.calls.some((c) => c.method === 'save')).toBe(true);
        expect(ctx.calls.some((c) => c.method === 'restore')).toBe(true);
      }
    });
  });

  describe('2. BossRenderer 보호 게임플레이 가드 & 안전한 에셋 캐시', () => {
    it('isSlotLocked 및 getSlotLockReason이 보호 슬롯에 대해 올바른 잠금 플래그와 사유를 반환한다', () => {
      const renderer = new BossRenderer();

      expect(renderer.isSlotLocked('boss_hp')).toBe(true);
      expect(renderer.isSlotLocked('damage_calculation')).toBe(true);
      expect(renderer.isSlotLocked('attack_power')).toBe(true);
      expect(renderer.isSlotLocked('boss_visual')).toBe(false);
      expect(renderer.isSlotLocked('boss_title')).toBe(false);

      expect(renderer.getSlotLockReason('boss_hp')).toContain('보호');
      expect(renderer.getSlotLockReason('boss_visual')).toBeNull();
    });

    it('validatePresentationContext가 보호 필드 및 불법 조작 시도를 감지하여 거부한다', () => {
      const renderer = new BossRenderer();
      const illegalCtx = {
        boss_hp: 999,
        damage_calculation: 50,
      } as unknown as BossPresentationContext;

      const result = renderer.validatePresentationContext(illegalCtx);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some((i) => i.includes('boss_hp'))).toBe(true);

      const validCtx: BossPresentationContext = {
        bossTitle: { text: '정상 타이틀' },
      };
      const validResult = renderer.validatePresentationContext(validCtx);
      expect(validResult.valid).toBe(true);
      expect(validResult.issues).toHaveLength(0);
    });

    it('registerLocalSprite가 안전한 키만 캐시하고 전역 imageLoader를 변형하지 않는다', () => {
      const renderer = new BossRenderer();
      const fakeCanvas = {} as HTMLCanvasElement;

      // 올바른 키 등록 성공
      const ok = renderer.registerLocalSprite('ch1_idle', fakeCanvas);
      expect(ok).toBe(true);

      // 위험/악성 키 거부 (URL, javascript:, 슬래시 등)
      expect(renderer.registerLocalSprite('javascript:alert(1)', fakeCanvas)).toBe(false);
      expect(renderer.registerLocalSprite('http://evil.com/asset.png', fakeCanvas)).toBe(false);
      expect(renderer.registerLocalSprite('../sneaky', fakeCanvas)).toBe(false);

      // 전역 imageLoader에는 등록되지 않음 (누출 0)
      expect(imageLoader.get('boss', 'javascript:alert(1)')).toBeNull();
    });

    it('로컬 스프라이트가 등록된 경우 render 시 전역 imageLoader 대신 로컬 스프라이트를 드로잉한다', () => {
      const renderer = new BossRenderer();
      const fakeCanvas = { width: 100, height: 100 } as HTMLCanvasElement;
      renderer.registerLocalSprite('ch1_idle', fakeCanvas);

      const ctx = createMockCtx();
      renderer.render(ctx, 1, 540, 400, 90, 'idle', false);

      const drawImageCalls = ctx.calls.filter((c) => c.method === 'drawImage');
      expect(drawImageCalls.length).toBe(1);
      expect(drawImageCalls[0].args[0]).toBe(fakeCanvas);
    });
  });

  describe('3. BossClimaxRenderer 선택적 표시 컨텍스트 및 bounds 조회', () => {
    it('getBossBounds, getGuardianBounds, getHudBounds가 정확한 바운딩 박스를 계산한다', () => {
      const renderer = new BossClimaxRenderer();

      const bossBounds: BossClimaxBounds = renderer.getBossBounds(W, H);
      expect(bossBounds.x).toBeGreaterThan(0);
      expect(bossBounds.y).toBeGreaterThan(0);
      expect(bossBounds.w).toBeGreaterThan(0);
      expect(bossBounds.h).toBeGreaterThan(0);
      expect(bossBounds.isProtected).toBe(false);

      const guardianBounds: BossClimaxBounds = renderer.getGuardianBounds(W, H);
      expect(guardianBounds.x).toBeCloseTo(W * 0.5 - 40, -1);
      expect(guardianBounds.y).toBeCloseTo(H * 0.84 - 40, -1);

      const hudBounds: BossClimaxBounds = renderer.getHudBounds(W, H);
      expect(hudBounds.x).toBe(50);
      expect(hudBounds.y).toBe(20);
      expect(hudBounds.w).toBe(980);
      expect(hudBounds.h).toBe(60);
    });

    it('getMinionTroopBounds가 아군 미니언 편대 전체를 포함하는 바운딩 박스를 계산한다', () => {
      const renderer = new BossClimaxRenderer();

      // 미니언 0마리일 때 수호신 주변 기본 박스 반환
      const emptyBounds = renderer.getMinionTroopBounds(W, H, 0);
      expect(emptyBounds.w).toBeGreaterThan(0);

      // 미니언 13마리일 때 좌우 날개를 모두 포괄하는 충분한 너비 반환
      const fullBounds = renderer.getMinionTroopBounds(W, H, 13);
      expect(fullBounds.w).toBeGreaterThan(emptyBounds.w);
      expect(fullBounds.x).toBeLessThan(W * 0.5);
      expect(fullBounds.x + fullBounds.w).toBeGreaterThan(W * 0.5);
    });

    it('getClimaxHazardBounds는 보호 영역(isProtected: true)으로 표시되며 바닥 장판을 포함한다', () => {
      const renderer = new BossClimaxRenderer();
      const hazardState = {
        activePattern: 'stomp_wave',
        progress: 0.5,
      };

      const hazardBounds = renderer.getClimaxHazardBounds(W, H, hazardState);
      expect(hazardBounds.isProtected).toBe(true);
      expect(hazardBounds.h).toBeGreaterThan(0);
      expect(hazardBounds.y).toBeGreaterThanOrEqual(H * 0.24);
    });

    it('getBarrageBounds는 수호신 위치에서 보스 소실점까지의 탄막 궤적 박스를 반환한다', () => {
      const renderer = new BossClimaxRenderer();
      const barrageBounds = renderer.getBarrageBounds(W, H);

      expect(barrageBounds.y).toBeLessThan(H * 0.84);
      expect(barrageBounds.h).toBeGreaterThan(H * 0.25);
    });

    it('setPresentationContext, getPresentationContext, clearPresentationContext 라이프사이클이 정확하다', () => {
      const renderer = new BossClimaxRenderer();
      expect(renderer.getPresentationContext()).toBeUndefined();

      const customCtx: BossClimaxPresentationContext = {
        bossHud: { fillColor: '#1A0B2E', textColor: '#FFCC00' },
        feverTextStyle: { text: 'FEVER OVERDRIVE!' },
      };

      renderer.setPresentationContext(customCtx);
      expect(renderer.getPresentationContext()).toEqual(customCtx);

      renderer.clearPresentationContext();
      expect(renderer.getPresentationContext()).toBeUndefined();
    });

    it('fromPresentationDocument를 통해 boss_battle 페이지 요소를 BossClimaxPresentationContext로 매핑한다', () => {
      const doc = createDefaultUIPresentationDocument();
      const ctx = BossClimaxRenderer.fromPresentationDocument(doc);

      expect(ctx.presentationDocument).toBe(doc);
      expect(ctx.pageId).toBe('boss_battle');
      expect(ctx.bossHud).toBeDefined();
      expect(ctx.bossHud?.x).toBe(50);
      expect(ctx.bossHud?.y).toBe(20);
      expect(ctx.bossHud?.w).toBe(980);
      expect(ctx.bossHud?.h).toBe(60);
    });
  });

  describe('4. BossClimaxRenderer 보호 게임플레이 가드', () => {
    it('isSlotLocked 및 getSlotLockReason이 전투 수치 및 기하 영역에 대해 잠금을 적용한다', () => {
      const renderer = new BossClimaxRenderer();

      expect(BOSS_CLIMAX_SLOT_IDS).toContain('boss_hud');
      expect(PROTECTED_BOSS_CLIMAX_SLOT_IDS).toContain('boss_hp');
      expect(PROTECTED_BOSS_CLIMAX_SLOT_IDS).toContain('hazard_geometry');

      expect(renderer.isSlotLocked('boss_hp')).toBe(true);
      expect(renderer.isSlotLocked('boss_max_hp')).toBe(true);
      expect(renderer.isSlotLocked('minion_count')).toBe(true);
      expect(renderer.isSlotLocked('fever_combo')).toBe(true);
      expect(renderer.isSlotLocked('hazard_geometry')).toBe(true);
      expect(renderer.isSlotLocked('vanishing_point')).toBe(true);
      expect(renderer.isSlotLocked('damage_calculation')).toBe(true);
      expect(renderer.isSlotLocked('attack_power')).toBe(true);
      expect(renderer.isSlotLocked('shield_state')).toBe(true);

      expect(renderer.isSlotLocked('boss_hud')).toBe(false);
      expect(renderer.isSlotLocked('titleBanner')).toBe(false);
      expect(renderer.isSlotLocked('feverTextStyle')).toBe(false);

      expect(renderer.getSlotLockReason('boss_hp')).toContain('보호');
      expect(renderer.getSlotLockReason('fever_combo')).toContain('보호');
      expect(renderer.getSlotLockReason('boss_hud')).toBeNull();
    });

    it('validatePresentationContext가 보호된 전투 수치 변조 시도를 감지하여 차단한다', () => {
      const renderer = new BossClimaxRenderer();
      const illegalCtx = {
        boss_hp: 0,
        minion_count: 99,
        fever_combo: 100,
      } as unknown as BossClimaxPresentationContext;

      const result = renderer.validatePresentationContext(illegalCtx);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some((i) => i.includes('boss_hp'))).toBe(true);
      expect(result.issues.some((i) => i.includes('minion_count'))).toBe(true);
    });

    it('외부 컨텍스트에 bossHp가 전달되더라도 실제 render() 시 상태(state)의 원래 HP만 표시된다 (변조 불가)', () => {
      const renderer = new BossClimaxRenderer();
      // 변조 시도 컨텍스트
      const hackedCtx = {
        boss_hp: 1, // 조작 시도
      } as unknown as BossClimaxPresentationContext;
      renderer.setPresentationContext(hackedCtx);

      const ctx = createMockCtx();
      const state: BossClimaxRenderState = {
        bossHp: 8,
        bossMaxHp: 10,
        isEnraged: false,
        minionCount: 5,
        stardust: 0,
        feverCombo: 0,
        hazard: null,
        barrageActive: false,
        barrageProgress: 0,
        elapsedTime: 1.0,
      };

      renderer.render(ctx, W, H, state);

      const fillTextCalls = ctx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => String(c.args[0]));

      // 8 / 10 텍스트가 표시되어야 하며 1 / 10 으로 왜곡되지 않아야 함
      expect(fillTextCalls.some((t) => t.includes('8 / 10'))).toBe(true);
      expect(fillTextCalls.some((t) => t.includes('1 / 10'))).toBe(false);
    });
  });

  describe('5. BossClimaxRenderer Fixture DTO 결정론적 렌더링 & 에셋 격리', () => {
    it('BOSS_CLIMAX Fixture DTO 5종이 올바르게 정의되어 있다', () => {
      expect(DEFAULT_BOSS_CLIMAX_FIXTURE.bossHp).toBe(10);
      expect(DEFAULT_BOSS_CLIMAX_FIXTURE.isEnraged).toBe(false);

      expect(ENRAGED_BOSS_CLIMAX_FIXTURE.isEnraged).toBe(true);
      expect(FEVER_BOSS_CLIMAX_FIXTURE.feverCombo).toBe(10);
      expect(FEVER_BOSS_CLIMAX_FIXTURE.barrageActive).toBe(true);

      expect(HAZARD_STOMP_BOSS_CLIMAX_FIXTURE.hazard?.activePattern).toBe('stomp_wave');
      expect(HAZARD_MINION_RUSH_BOSS_CLIMAX_FIXTURE.hazard?.activePattern).toBe('enemy_minion_rush');
    });

    it('renderFixture를 통해 배틀 엔진/타이머 없이 5종 결전 Fixture를 결정론적으로 드로잉한다', () => {
      const renderer = new BossClimaxRenderer();
      const fixtures: BossClimaxFixtureDTO[] = [
        DEFAULT_BOSS_CLIMAX_FIXTURE,
        ENRAGED_BOSS_CLIMAX_FIXTURE,
        FEVER_BOSS_CLIMAX_FIXTURE,
        HAZARD_STOMP_BOSS_CLIMAX_FIXTURE,
        HAZARD_MINION_RUSH_BOSS_CLIMAX_FIXTURE,
      ];

      for (const fix of fixtures) {
        const ctx = createMockCtx();
        renderer.renderFixture(ctx, W, H, fix);
        expect(ctx.calls.length).toBeGreaterThan(0);
        expect(ctx.calls.some((c) => c.method === 'save')).toBe(true);
        expect(ctx.calls.some((c) => c.method === 'restore')).toBe(true);
      }
    });

    it('registerLocalSprite가 안전한 키만 캐시하고 악성 입력을 거부한다', () => {
      const renderer = new BossClimaxRenderer();
      const fakeCanvas = {} as HTMLCanvasElement;

      expect(renderer.registerLocalSprite('stage2_idle', fakeCanvas)).toBe(true);
      expect(renderer.registerLocalSprite('ch5_enrage', fakeCanvas)).toBe(true);

      expect(renderer.registerLocalSprite('javascript:void(0)', fakeCanvas)).toBe(false);
      expect(renderer.registerLocalSprite('data:image/svg+xml,...', fakeCanvas)).toBe(false);
      expect(renderer.registerLocalSprite('http://malicious.org/x', fakeCanvas)).toBe(false);
    });
  });
});
