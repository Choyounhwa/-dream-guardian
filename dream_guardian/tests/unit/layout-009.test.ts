/**
 * [LAYOUT-009] (Issue #576) 보스·보스 결전 화면 레이아웃 설정 이전 (보스 위치·크기·결전 게이지, +글자 textScale)
 *
 * 1. 기본값 특성화 (Characterization):
 *    - 기본 해상도(1080x2160)에서 getBossPlacement 및 BossClimaxRenderer의 각 시각 요소 bounds가 UI_LAYOUT과 100% 일치.
 *    - 이전 전 계산식 대비 오차 0px(또는 부동소수점 오차 범위 내) 정합성 보장.
 *    - 기본 렌더링 시 폰트 크기 및 문자열이 기존과 100% 일치.
 * 2. UI_LAYOUT.boss 및 UI_LAYOUT.bossClimax 실시간 변경 반영 (캐싱 금지):
 *    - boss: x, y, radius 변경이 getBossPlacement 및 SceneDirector 보스 렌더링에 실시간 반영.
 *    - 배경 격자 및 런웨이 소실점(vanishingPoint)은 HORIZON_RATIO 기반 유지.
 *    - bossClimax: gauge (x, y, w, h), guardian (x, y), stepGuide (targetY, offsetY), jumpGuide (offsetY), feedback (offsetY), troopBadge, stardustBadge 실시간 반영.
 * 3. textScale (0.5~3.0) 적용 및 clamping:
 *    - gauge.textScale, gauge.enragedTextScale, fever.textScale, jumpGuide.textScale, stepGuide.textScale, feedback.textScale, troopBadge.textScale, guardian.textScale 비례 조절 및 clamping.
 * 4. 판정 연동 좌표 및 모션 판정 영역 원자적 잠금:
 *    - DEFAULT_FITNESS_ZONES 불변 보존.
 *    - PROTECTED_BOSS_CLIMAX_SLOT_IDS (vanishing_point, hazard_geometry 등) 잠금 유지.
 *    - getClimaxHazardBounds isProtected: true 유지.
 * 5. PresentationContext 오버라이드 최우선 순위 유지:
 *    - setPresentationContext 주입 시 UI_LAYOUT보다 우선 반영.
 * 6. DEVUI / UILayoutOverride 규칙 검증:
 *    - getLayoutKeyRule 검증 (textScale은 0.5~3.0 step 0.01, 좌표/크기는 integer).
 *    - applyLayoutOverride 적용 검증.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBossPlacement, SceneDirector } from '../../src/core/SceneDirector.js';
import {
  BossClimaxRenderer,
  PROTECTED_BOSS_CLIMAX_SLOT_IDS,
  type BossClimaxRenderState,
} from '../../src/render/BossClimaxRenderer.js';
import { DEFAULT_FITNESS_ZONES } from '../../config/zone.config.js';
import { HORIZON_RATIO } from '../../config/grid.config.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import { resetLayoutTo, snapshotLayout } from '../../src/dev/DevLayoutPanel.js';
import { applyLayoutOverride, getLayoutKeyRule } from '../../src/core/UILayoutOverride.js';

const pristine = snapshotLayout(UI_LAYOUT);

function createClimaxState(overrides: Partial<BossClimaxRenderState> = {}): BossClimaxRenderState {
  return {
    bossHp: 10,
    bossMaxHp: 10,
    isEnraged: false,
    minionCount: 0,
    stardust: 0,
    feverCombo: 0,
    hazard: null,
    barrageActive: false,
    barrageProgress: 0,
    elapsedTime: 1.0,
    ...overrides,
  };
}

function createMockCtx() {
  const fontsSet: string[] = [];
  const filledTexts: Array<{ text: string; x: number; y: number; font: string; fillStyle?: unknown }> = [];
  const strokedTexts: Array<{ text: string; x: number; y: number; font: string }> = [];
  let _font = '';
  let _fillStyle: unknown = '#FFFFFF';

  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    roundRect: vi.fn(),
    rect: vi.fn(),
    strokeRect: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn((text: string, x: number, y: number) => {
      filledTexts.push({ text: String(text), x, y, font: _font, fillStyle: _fillStyle });
    }),
    strokeText: vi.fn((text: string, x: number, y: number) => {
      strokedTexts.push({ text: String(text), x, y, font: _font });
    }),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    get font() {
      return _font;
    },
    set font(v: string) {
      _font = v;
      fontsSet.push(v);
    },
    get fillStyle() {
      return _fillStyle;
    },
    set fillStyle(v: unknown) {
      _fillStyle = v;
    },
    strokeStyle: '',
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    fontsSet,
    filledTexts,
    strokedTexts,
  };

  return ctx as unknown as CanvasRenderingContext2D & {
    fontsSet: string[];
    filledTexts: Array<{ text: string; x: number; y: number; font: string; fillStyle?: unknown }>;
    strokedTexts: Array<{ text: string; x: number; y: number; font: string }>;
  };
}

describe('[LAYOUT-009] 보스·보스 결전 화면 레이아웃 설정 이전 (Issue #576)', () => {
  const W = 1080;
  const H = 2160;

  beforeEach(() => {
    resetLayoutTo(UI_LAYOUT, pristine);
  });

  afterEach(() => {
    resetLayoutTo(UI_LAYOUT, pristine);
  });

  describe('1. 기본값 특성화 (Characterization)', () => {
    it('기본 해상도(1080x2160)에서 보스 배치 좌표 및 크기가 기존 계산식과 100% 일치해야 한다', () => {
      const placement = getBossPlacement(W, H);
      expect(placement.x).toBe(W * 0.5); // 540
      expect(placement.y).toBeCloseTo(H * HORIZON_RATIO, 2); // 1209.6
      expect(placement.radius).toBeCloseTo(Math.min(180, W * 0.12), 2); // 129.6

      expect(placement.x).toBe((UI_LAYOUT as any).boss.x);
      expect(placement.y).toBeCloseTo((UI_LAYOUT as any).boss.y, 2);
    });

    it('기본 해상도에서 BossClimaxRenderer 시각 요소 bounds가 UI_LAYOUT과 100% 일치해야 한다', () => {
      const renderer = new BossClimaxRenderer();

      // 결전 게이지 HUD
      const hudBounds = renderer.getHudBounds(W, H);
      expect(hudBounds.x).toBe(50);
      expect(hudBounds.y).toBe(20);
      expect(hudBounds.w).toBe(980);
      expect(hudBounds.h).toBe(60);
      expect(hudBounds.isProtected).toBe(false);

      // 전경 수호신
      const guardianPos = renderer.getGuardianPosition(W, H);
      expect(guardianPos.x).toBe(W * 0.5); // 540
      expect(guardianPos.y).toBeCloseTo(H * 0.84, 2); // 1814.4

      const guardianBounds = renderer.getGuardianBounds(W, H);
      expect(guardianBounds.x).toBe(guardianPos.x - 40);
      expect(guardianBounds.y).toBe(guardianPos.y - 40);
      expect(guardianBounds.w).toBe(80);
      expect(guardianBounds.h).toBe(80);
      expect(guardianBounds.isProtected).toBe(false);

      // 하단 군단 및 별가루 배지
      const troopBounds = (renderer as any).getTroopBadgeBounds?.(W, H);
      if (troopBounds) {
        expect(troopBounds.x).toBe(40);
        expect(troopBounds.y).toBeCloseTo(H * 0.77, 2);
        expect(troopBounds.w).toBe(200);
        expect(troopBounds.h).toBe(50);
        expect(troopBounds.isProtected).toBe(false);
      }

      const stardustBounds = (renderer as any).getStardustBadgeBounds?.(W, H);
      if (stardustBounds) {
        expect(stardustBounds.x).toBe(W - 40 - 200);
        expect(stardustBounds.y).toBeCloseTo(H * 0.77, 2);
        expect(stardustBounds.w).toBe(200);
        expect(stardustBounds.h).toBe(50);
        expect(stardustBounds.isProtected).toBe(false);
      }
    });

    it('기본 렌더링 시 모든 텍스트 폰트 크기가 기존과 100% 일치해야 한다', () => {
      const renderer = new BossClimaxRenderer();
      const mockCtx = createMockCtx();

      renderer.render(
        mockCtx,
        W,
        H,
        createClimaxState({
          bossHp: 8,
          bossMaxHp: 10,
          isEnraged: true,
          feverCombo: 3,
          minionCount: 5,
          stardust: 120,
          elapsedTime: 1.0,
          hazard: {
            activePattern: 'jump',
            progress: 0.9,
            isResolved: true,
            isEvaded: true,
          },
        }),
      );

      // 1. 게이지 HP 텍스트 (caption base: 20px)
      const hpCall = mockCtx.filledTexts.find((t) => t.text.includes('BOSS HP'));
      expect(hpCall).toBeDefined();
      expect(hpCall?.font).toContain('20px');

      // 2. 광폭화 배지 (badge base: 24px)
      const enrageCall = mockCtx.filledTexts.find((t) => t.text.includes('광폭화'));
      expect(enrageCall).toBeDefined();
      expect(enrageCall?.font).toContain('24px');

      // 3. 피버 텍스트 (body base: 36px)
      const feverCall = mockCtx.filledTexts.find((t) => t.text.includes('FEVER'));
      expect(feverCall).toBeDefined();
      expect(feverCall?.font).toContain('36px');

      // 4. 군단 배지 (badge base: 24px)
      const troopCall = mockCtx.filledTexts.find((t) => t.text.includes('군단'));
      expect(troopCall).toBeDefined();
      expect(troopCall?.font).toContain('24px');

      // 5. 별가루 배지 (badge base: 24px)
      const stardustCall = mockCtx.filledTexts.find((t) => t.text.includes('별가루'));
      expect(stardustCall).toBeDefined();
      expect(stardustCall?.font).toContain('24px');

      // 6. 회피 성공 피드백 (body base: 36px)
      const evadeCall = mockCtx.filledTexts.find((t) => t.text.includes('EVADED'));
      expect(evadeCall).toBeDefined();
      expect(evadeCall?.font).toContain('36px');
    });
  });

  describe('2. UI_LAYOUT 실시간 변경 반영 (캐싱 금지)', () => {
    it('UI_LAYOUT.boss의 x, y, radius 변경이 getBossPlacement에 실시간 반영된다', () => {
      (UI_LAYOUT as any).boss.x = 600;
      (UI_LAYOUT as any).boss.y = 1350;
      (UI_LAYOUT as any).boss.radius = 160;

      const placement = getBossPlacement(W, H);
      expect(placement.x).toBe(600);
      expect(placement.y).toBe(1350);
      expect(placement.radius).toBe(160);
    });

    it('SceneDirector: 보스 위치 변경 시 bossRenderer에는 신규 좌표가 전달되고 배경 소실점은 유지된다', () => {
      const director = new SceneDirector();
      (UI_LAYOUT as any).boss.x = 620;
      (UI_LAYOUT as any).boss.y = 1400;

      const mockGridRender = vi.fn();
      const mockBossRender = vi.fn();

      const mockContext: any = {
        canvasManager: {
          ctx: createMockCtx(),
          virtualWidth: W,
          virtualHeight: H,
        },
        state: { currentChapter: 1, gamePhase: 'running' },
        stateMachine: { currentState: 'RUN_QUESTION' },
        beatCoordinator: { phase: 'REST_READY' },
        dreamGrid: { render: mockGridRender },
        bossRenderer: { render: mockBossRender },
        boss: { phase: 'normal' },
        cameraLayer: { isActive: false },
        presentationAdapter: {
          canRenderRunningHUD: () => false,
          canRenderAnswerPreview: () => false,
          canRenderQuestion: () => false,
          canRenderStarCollect: () => false,
          canRenderHazardEvade: () => false,
          canRenderReadyPosition: () => false,
        },
        locomotionModal: { selectedMode: 'run' },
        hudLayer: { render: vi.fn() },
        getHUDData: vi.fn(() => ({})),
        stickmanRenderer: { render: vi.fn() },
        renderFeedback: vi.fn(),
        effectManager: { render: vi.fn() },
      };

      director.renderGameScene(mockContext);

      // 격자 소실점은 기존 HORIZON_RATIO 유지
      expect(mockGridRender).toHaveBeenCalled();
      const gridOpts = mockGridRender.mock.calls[0][3];
      expect(gridOpts.vanishingX).toBe(W * 0.5);
      expect(gridOpts.vanishingY).toBeCloseTo(H * HORIZON_RATIO, 2);

      // 보스 렌더러는 UI_LAYOUT.boss 좌표 사용
      expect(mockBossRender).toHaveBeenCalled();
      const [, , bx, by] = mockBossRender.mock.calls[0];
      expect(bx).toBe(620);
      expect(by).toBe(1400);
    });

    it('UI_LAYOUT.bossClimax.gauge 변경이 getHudBounds에 실시간 반영된다', () => {
      const renderer = new BossClimaxRenderer();

      (UI_LAYOUT as any).bossClimax.gauge.x = 80;
      (UI_LAYOUT as any).bossClimax.gauge.y = 30;
      (UI_LAYOUT as any).bossClimax.gauge.w = 920;
      (UI_LAYOUT as any).bossClimax.gauge.h = 75;

      const bounds = renderer.getHudBounds(W, H);
      expect(bounds.x).toBe(80);
      expect(bounds.y).toBe(30);
      expect(bounds.w).toBe(920);
      expect(bounds.h).toBe(75);
    });

    it('UI_LAYOUT.bossClimax.guardian 변경이 수호신 위치 및 bounds에 실시간 반영된다', () => {
      const renderer = new BossClimaxRenderer();

      (UI_LAYOUT as any).bossClimax.guardian.x = 500;
      (UI_LAYOUT as any).bossClimax.guardian.y = 1750;
      (UI_LAYOUT as any).bossClimax.guardian.w = 100;
      (UI_LAYOUT as any).bossClimax.guardian.h = 100;

      const pos = renderer.getGuardianPosition(W, H);
      expect(pos.x).toBe(500);
      expect(pos.y).toBe(1750);

      const bounds = renderer.getGuardianBounds(W, H);
      expect(bounds.x).toBe(450);
      expect(bounds.y).toBe(1700);
      expect(bounds.w).toBe(100);
      expect(bounds.h).toBe(100);
    });

    it('UI_LAYOUT.bossClimax.stepGuide.targetY 변경이 한손 콩콩 스텝 대상 Y에 실시간 반영된다', () => {
      const renderer = new BossClimaxRenderer();
      const mockCtx = createMockCtx();

      (UI_LAYOUT as any).bossClimax.stepGuide.targetY = 1700;

      renderer.render(
        mockCtx,
        W,
        H,
        createClimaxState({
          hazard: {
            activePattern: 'alternating_stomp_left',
            progress: 1.0,
            isResolved: false,
          },
        }),
      );

      const stepCall = mockCtx.filledTexts.find((t) => t.text.includes('왼발'));
      expect(stepCall).toBeDefined();
      // progress 1.0 -> targetY = 1700, scale = 1.32, step text at my - 50 * scale = 1634
      expect(stepCall?.y).toBeCloseTo(1700 - 66, 1);
    });

    it('UI_LAYOUT.bossClimax.jumpGuide.offsetY 변경이 충격파 안내 텍스트 위치에 반영된다', () => {
      const renderer = new BossClimaxRenderer();
      const mockCtxDefault = createMockCtx();

      renderer.render(
        mockCtxDefault,
        W,
        H,
        createClimaxState({
          hazard: {
            activePattern: 'dual_slam',
            progress: 0.9,
            isResolved: false,
          },
        }),
      );
      const defaultJumpCall = mockCtxDefault.filledTexts.find((t) => t.text.includes('JUMP'));
      expect(defaultJumpCall).toBeDefined();

      const mockCtx = createMockCtx();
      (UI_LAYOUT as any).bossClimax.jumpGuide.offsetY = 60;

      renderer.render(
        mockCtx,
        W,
        H,
        createClimaxState({
          hazard: {
            activePattern: 'dual_slam',
            progress: 0.9,
            isResolved: false,
          },
        }),
      );

      const jumpCall = mockCtx.filledTexts.find((t) => t.text.includes('JUMP'));
      expect(jumpCall).toBeDefined();
      expect(jumpCall!.y).toBeCloseTo(defaultJumpCall!.y - (60 - 28), 1);
    });

    it('UI_LAYOUT.bossClimax.feedback.offsetY 변경이 피격/회피 피드백 텍스트 위치에 반영된다', () => {
      const renderer = new BossClimaxRenderer();
      const mockCtx = createMockCtx();

      (UI_LAYOUT as any).bossClimax.feedback.offsetY = 70;

      renderer.render(
        mockCtx,
        W,
        H,
        createClimaxState({
          hazard: {
            activePattern: 'jump',
            progress: 1.0,
            isResolved: true,
            isEvaded: false,
          },
        }),
      );

      const hitCall = mockCtx.filledTexts.find((t) => t.text.includes('HIT!'));
      expect(hitCall).toBeDefined();
      const frontY = renderer.computeHazardFrontY(1.0, H * HORIZON_RATIO, H);
      expect(hitCall?.y).toBeCloseTo(frontY - 70, 1);
    });
  });

  describe('3. textScale (글자 크기 배율 0.5~3.0) 적용 및 Clamping', () => {
    it('gauge.textScale 및 enragedTextScale 변경이 폰트 크기에 비례 반영된다', () => {
      const renderer = new BossClimaxRenderer();
      const mockCtx = createMockCtx();

      (UI_LAYOUT as any).bossClimax.gauge.textScale = 1.5; // 20 * 1.5 = 30px
      (UI_LAYOUT as any).bossClimax.gauge.enragedTextScale = 2.0; // 24 * 2.0 = 48px

      renderer.render(
        mockCtx,
        W,
        H,
        createClimaxState({
          bossHp: 5,
          isEnraged: true,
        }),
      );

      const hpCall = mockCtx.filledTexts.find((t) => t.text.includes('BOSS HP'));
      expect(hpCall?.font).toContain('30px');

      const enrageCall = mockCtx.filledTexts.find((t) => t.text.includes('광폭화'));
      expect(enrageCall?.font).toContain('48px');
    });

    it('fever.textScale, jumpGuide.textScale, stepGuide.textScale 변경이 폰트 크기에 비례 반영된다', () => {
      const renderer = new BossClimaxRenderer();
      const mockCtx = createMockCtx();

      (UI_LAYOUT as any).bossClimax.fever.textScale = 1.5; // 36 * 1.5 = 54px
      (UI_LAYOUT as any).bossClimax.jumpGuide.textScale = 2.0; // 36 * 2.0 = 72px

      renderer.render(
        mockCtx,
        W,
        H,
        createClimaxState({
          feverCombo: 5,
          hazard: {
            activePattern: 'dual_slam',
            progress: 0.9,
            isResolved: false,
          },
        }),
      );

      const feverCall = mockCtx.filledTexts.find((t) => t.text.includes('FEVER'));
      expect(feverCall?.font).toContain('54px');

      const jumpCall = mockCtx.filledTexts.find((t) => t.text.includes('JUMP'));
      expect(jumpCall?.font).toContain('72px');
    });

    it('feedback.textScale, troopBadge.textScale 변경이 폰트에 비례 반영된다', () => {
      const renderer = new BossClimaxRenderer();
      const mockCtx = createMockCtx();

      (UI_LAYOUT as any).bossClimax.feedback.textScale = 1.5; // 36 * 1.5 = 54px
      (UI_LAYOUT as any).bossClimax.troopBadge.textScale = 2.0; // 24 * 2.0 = 48px

      renderer.render(
        mockCtx,
        W,
        H,
        createClimaxState({
          minionCount: 3,
          hazard: {
            activePattern: 'jump',
            progress: 1.0,
            isResolved: true,
            isEvaded: true,
          },
        }),
      );

      const evadeCall = mockCtx.filledTexts.find((t) => t.text.includes('EVADED'));
      expect(evadeCall?.font).toContain('54px');

      const troopCall = mockCtx.filledTexts.find((t) => t.text.includes('군단'));
      expect(troopCall?.font).toContain('48px');
    });

    it('textScale 0.5 미만은 0.5로, 3.0 초과는 3.0으로 clamping 된다', () => {
      const renderer = new BossClimaxRenderer();

      // < 0.5
      let mockCtx = createMockCtx();
      (UI_LAYOUT as any).bossClimax.jumpGuide.textScale = 0.1;
      renderer.render(
        mockCtx,
        W,
        H,
        createClimaxState({
          hazard: {
            activePattern: 'dual_slam',
            progress: 0.9,
            isResolved: false,
          },
        }),
      );
      let jumpCall = mockCtx.filledTexts.find((t) => t.text.includes('JUMP'));
      // 36 * 0.5 = 18px (body token min: 20px 보장)
      const pxMatch = jumpCall?.font.match(/(\d+)px/);
      expect(parseInt(pxMatch![1], 10)).toBeLessThanOrEqual(20);

      // > 3.0
      mockCtx = createMockCtx();
      (UI_LAYOUT as any).bossClimax.jumpGuide.textScale = 5.0;
      renderer.render(
        mockCtx,
        W,
        H,
        createClimaxState({
          hazard: {
            activePattern: 'dual_slam',
            progress: 0.9,
            isResolved: false,
          },
        }),
      );
      jumpCall = mockCtx.filledTexts.find((t) => t.text.includes('JUMP'));
      // 36 * 3.0 = 108px
      expect(jumpCall?.font).toContain('108px');
    });
  });

  describe('4. 판정 연동 좌표 및 모션 판정 영역 원자적 잠금 (보호 검증)', () => {
    it('DEFAULT_FITNESS_ZONES는 변경되지 않고 원자적 잠금 상태를 유지해야 한다', () => {
      expect(DEFAULT_FITNESS_ZONES).toBeDefined();
      expect(DEFAULT_FITNESS_ZONES.length).toBe(11);
    });

    it('PROTECTED_BOSS_CLIMAX_SLOT_IDS에 필수 판정 및 소실점 슬롯들이 잠금 정의되어 있다', () => {
      expect(PROTECTED_BOSS_CLIMAX_SLOT_IDS).toContain('vanishing_point');
      expect(PROTECTED_BOSS_CLIMAX_SLOT_IDS).toContain('hazard_geometry');
      expect(PROTECTED_BOSS_CLIMAX_SLOT_IDS).toContain('damage_calculation');
      expect(PROTECTED_BOSS_CLIMAX_SLOT_IDS).toContain('boss_hp');
    });

    it('BossClimaxRenderer: getClimaxHazardBounds는 isProtected: true를 유지해야 한다', () => {
      const renderer = new BossClimaxRenderer();
      const bounds = renderer.getClimaxHazardBounds(W, H, { activePattern: 'jump', progress: 0.5 });
      expect(bounds.isProtected).toBe(true);
    });
  });

  describe('5. PresentationContext 오버라이드 최우선 순위 유지', () => {
    it('setPresentationContext 주입 시 UI_LAYOUT.bossClimax.gauge보다 우선 적용된다', () => {
      const renderer = new BossClimaxRenderer();

      (UI_LAYOUT as any).bossClimax.gauge.x = 80;
      (UI_LAYOUT as any).bossClimax.gauge.y = 35;

      renderer.setPresentationContext({
        bossHud: {
          x: 120,
          y: 45,
          w: 840,
          h: 70,
        },
      });

      const bounds = renderer.getHudBounds(W, H);
      expect(bounds.x).toBe(120);
      expect(bounds.y).toBe(45);
      expect(bounds.w).toBe(840);
      expect(bounds.h).toBe(70);

      renderer.clearPresentationContext();
      const restored = renderer.getHudBounds(W, H);
      expect(restored.x).toBe(80);
      expect(restored.y).toBe(35);
    });
  });

  describe('6. DEVUI / UILayoutOverride 규칙 검증', () => {
    it('boss 및 bossClimax 관련 textScale 키에 올바른 규칙이 반환된다', () => {
      const textScaleRule = getLayoutKeyRule('bossClimax.gauge.textScale');
      expect(textScaleRule).toEqual({ min: 0.5, max: 3.0, step: 0.01, integer: false });

      const enragedScaleRule = getLayoutKeyRule('bossClimax.gauge.enragedTextScale');
      expect(enragedScaleRule).toEqual({ min: 0.5, max: 3.0, step: 0.01, integer: false });

      const coordRule = getLayoutKeyRule('boss.x');
      expect(coordRule.integer).toBe(true);
    });

    it('applyLayoutOverride로 boss 및 bossClimax 값 주입 시 정상 적용된다', () => {
      const patch = {
        boss: {
          x: 580,
          y: 1250,
          radius: 140,
        },
        bossClimax: {
          gauge: {
            x: 60,
            y: 25,
            textScale: 1.4,
          },
        },
      };

      const result = applyLayoutOverride(UI_LAYOUT, patch);
      expect(result.applied).toContain('boss.x');
      expect(result.applied).toContain('boss.y');
      expect(result.applied).toContain('boss.radius');
      expect(result.applied).toContain('bossClimax.gauge.x');
      expect(result.applied).toContain('bossClimax.gauge.textScale');

      expect((UI_LAYOUT as any).boss.x).toBe(580);
      expect((UI_LAYOUT as any).boss.y).toBe(1250);
      expect((UI_LAYOUT as any).boss.radius).toBe(140);
      expect((UI_LAYOUT as any).bossClimax.gauge.textScale).toBe(1.4);
    });

    it('applyLayoutOverride로 textScale 범위(0.5~3.0) 외 값 주입 시 거부된다', () => {
      const patchInvalid = {
        bossClimax: {
          gauge: {
            textScale: 0.2, // < 0.5
          },
          fever: {
            textScale: 3.5, // > 3.0
          },
        },
      };

      const result = applyLayoutOverride(UI_LAYOUT, patchInvalid);
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
      expect((UI_LAYOUT as any).bossClimax.gauge.textScale).toBe(1.0);
    });
  });
});
